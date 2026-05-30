"""FastAPI 主应用"""
import asyncio
import io
import json
import os
import sys
import threading
from pathlib import Path

# 确保项目根目录在 path 中
ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from PIL import Image

from .config import (
    ALLOWED_VIDEO_EXTENSIONS,
    MAX_UPLOAD_SIZE_MB,
    OUTPUT_DIR,
    TEMP_DIR,
    UPLOAD_DIR,
)
from .gemini_provider import (
    GeminiProviderError,
    generate_character_action_candidates_with_gemini,
    is_gemini_configured,
    remove_background_with_gemini,
)
from .qwen_provider import (
    QwenProviderError,
    generate_character_action_candidates_with_qwen,
    is_qwen_configured,
)

ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
MAX_IMAGE_MB = 20

# Worker 与 API 共享存储路径
from .models import JobParams, JobResponse
from .storage import (
    ensure_dirs,
    generate_job_id,
    get_result_paths,
    get_video_path,
    get_watermark_output_path,
    save_uploaded_file,
)

# 任务状态存储（生产环境应使用 Redis）
_jobs: dict[str, dict] = {}
_watermark_jobs: dict[str, dict] = {}
_character_action_jobs: dict[str, dict] = {}

CHARACTER_ACTION_FRAME_COUNTS = {
    "idle": 2,
    "walk": 4,
    "run": 4,
    "attack": 3,
    "skill": 3,
    "hurt": 2,
    "death": 3,
}
CHARACTER_ACTION_GENERATION_BATCH_SIZE = 3
CHARACTER_ACTION_MAX_FRAMES = 28
CHARACTER_ACTION_STATE_FILENAME = "character_action_job.json"
CHARACTER_ACTION_LABELS = {
    "idle": "Idle",
    "walk": "Walk",
    "run": "Run",
    "attack": "Attack",
    "skill": "Skill",
    "hurt": "Hurt",
    "death": "Death",
}


def _character_action_total_frames(fixed_counts: dict) -> int:
    return sum(max(0, int(fixed_counts.get(action, 0))) for action in CHARACTER_ACTION_FRAME_COUNTS)


def _character_action_batch_size(params: dict) -> int:
    try:
        requested = int(params.get("batch_size") or CHARACTER_ACTION_GENERATION_BATCH_SIZE)
    except Exception:
        requested = CHARACTER_ACTION_GENERATION_BATCH_SIZE
    return max(1, min(3, requested))


def _character_action_frame_plan(params: dict, fixed_counts: dict) -> list[dict] | None:
    raw_plan = params.get("frame_plan")
    if not isinstance(raw_plan, list):
        return None
    plan = []
    seen = set()
    for item in raw_plan:
        if not isinstance(item, dict):
            continue
        action = str(item.get("action"))
        if action not in CHARACTER_ACTION_FRAME_COUNTS:
            continue
        frame_count = max(1, int(fixed_counts.get(action, CHARACTER_ACTION_FRAME_COUNTS[action])))
        frame_index = max(0, int(item.get("frame_index", 0)))
        if frame_index >= frame_count:
            continue
        key = (action, frame_index)
        if key in seen:
            continue
        seen.add(key)
        plan.append({"action": action, "frame_index": frame_index, "frame_count": frame_count})
    return plan or None


def _decorate_character_action_candidate(job_id: str, candidate: dict) -> dict:
    next_candidate = dict(candidate)
    filename = next_candidate.get("filename")
    action = next_candidate.get("action")
    next_candidate["url"] = f"/api/character-action/analyze/{job_id}/assets/{filename}"
    next_candidate["action_label"] = CHARACTER_ACTION_LABELS.get(action, action)
    return next_candidate


def _character_action_progress_result(
    *,
    candidates: list[dict],
    fixed_counts: dict,
    canvas_size: int,
    provider: str,
    total_count: int,
    batch_size: int,
    model: str | None = None,
    current_batch_index: int | None = None,
) -> dict:
    generated_count = len(candidates)
    batch_index = current_batch_index
    if batch_index is None:
        batch_index = 0 if generated_count == 0 else ((generated_count - 1) // batch_size) + 1
    result = {
        "candidates": list(candidates),
        "fixed_frame_counts": fixed_counts,
        "canvas_size": canvas_size,
        "provider": provider,
        "generated_count": generated_count,
        "total_count": total_count,
        "batch_size": batch_size,
        "current_batch_index": batch_index,
    }
    if model:
        result["model"] = model
    return result


def _character_action_state_path(job_id: str) -> Path:
    return OUTPUT_DIR / job_id / CHARACTER_ACTION_STATE_FILENAME


def _save_character_action_job(job_id: str):
    job = _character_action_jobs.get(job_id)
    if not job:
        return
    state_path = _character_action_state_path(job_id)
    state_path.parent.mkdir(parents=True, exist_ok=True)
    state_path.write_text(json.dumps(job, ensure_ascii=False, indent=2), encoding="utf-8")


def _load_character_action_job(job_id: str) -> dict | None:
    state_path = _character_action_state_path(job_id)
    if state_path.exists():
        try:
            return json.loads(state_path.read_text(encoding="utf-8"))
        except Exception:
            return None

    output_dir = OUTPUT_DIR / job_id / "character_action_candidates"
    if not output_dir.exists():
        return None
    candidates = []
    for path in sorted(output_dir.glob("*.png")):
        stem_parts = path.stem.rsplit("_", 1)
        action = stem_parts[0] if stem_parts else "idle"
        if action not in CHARACTER_ACTION_FRAME_COUNTS:
            action = "idle"
        try:
            frame_index = max(0, int(stem_parts[1]) - 1)
        except Exception:
            frame_index = len(candidates)
        candidates.append({
            "id": path.stem,
            "action": action,
            "action_label": CHARACTER_ACTION_LABELS.get(action, action),
            "frame_index": frame_index,
            "filename": path.name,
            "url": f"/api/character-action/analyze/{job_id}/assets/{path.name}",
        })
    if not candidates:
        return None
    fixed_counts = CHARACTER_ACTION_FRAME_COUNTS
    return {
        "id": job_id,
        "status": "completed",
        "progress": 100,
        "params": {},
        "result": _character_action_progress_result(
            candidates=candidates,
            fixed_counts=fixed_counts,
            canvas_size=512,
            provider="recovered",
            total_count=len(candidates),
            batch_size=CHARACTER_ACTION_GENERATION_BATCH_SIZE,
        ),
        "error": None,
        "warning": None,
    }


def _get_character_action_job(job_id: str) -> dict | None:
    if job_id in _character_action_jobs:
        return _character_action_jobs[job_id]
    job = _load_character_action_job(job_id)
    if job:
        _character_action_jobs[job_id] = job
    return job


def _set_character_action_job(job_id: str, **kwargs):
    if job_id in _character_action_jobs:
        _character_action_jobs[job_id].update(kwargs)
        _save_character_action_job(job_id)


def _update_job(job_id: str, **kwargs):
    """更新任务"""
    if job_id in _jobs:
        _jobs[job_id].update(kwargs)


def _run_pipeline_sync(job_id: str, video_path: str):
    """同步模式：在后台线程中执行管线（Windows 无 Redis 时使用）"""
    try:
        from worker.processor import run_pipeline
        result = run_pipeline(job_id, video_path, str(OUTPUT_DIR), str(TEMP_DIR), _jobs[job_id]["params"])
        _update_job(job_id, status="completed", progress=100, result=result)
    except Exception as e:
        _update_job(job_id, status="failed", error={"code": "PROCESSING_ERROR", "message": str(e)})


def _run_watermark_sync(job_id: str, video_path: str):
    """同步模式：在后台线程中执行水印去除"""
    def _update_wm(jid: str, **kwargs):
        if jid in _watermark_jobs:
            _watermark_jobs[jid].update(kwargs)

    try:
        from worker.watermark_remover import run_watermark_pipeline
        result = run_watermark_pipeline(job_id, video_path, str(OUTPUT_DIR))
        _update_wm(job_id, status="completed", progress=100, result=result)
    except Exception as e:
        _update_wm(job_id, status="failed", error={"code": "PROCESSING_ERROR", "message": str(e)})


def _normalize_character_source(content: bytes, canvas_size: int = 512) -> Image.Image:
    source = Image.open(io.BytesIO(content)).convert("RGBA")
    bbox = source.getbbox()
    if bbox:
        source = source.crop(bbox)
    max_w = int(canvas_size * 0.68)
    max_h = int(canvas_size * 0.74)
    scale = min(max_w / max(source.width, 1), max_h / max(source.height, 1), 1)
    if scale <= 0:
        scale = 1
    draw_w = max(1, round(source.width * scale))
    draw_h = max(1, round(source.height * scale))
    source = source.resize((draw_w, draw_h), Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    x = round(canvas_size * 0.5 - draw_w / 2)
    y = round(canvas_size * 0.84 - draw_h)
    canvas.alpha_composite(source, (x, y))
    return canvas


def _run_character_action_placeholder(job_id: str, content: bytes, params: dict):
    try:
        _set_character_action_job(job_id, status="processing", progress=28)
        canvas_size = int(params.get("canvas_size") or 512)
        fixed_counts = params.get("fixed_frame_counts") or CHARACTER_ACTION_FRAME_COUNTS
        batch_size = _character_action_batch_size(params)
        frame_plan = _character_action_frame_plan(params, fixed_counts)
        output_dir = OUTPUT_DIR / job_id / "character_action_candidates"
        output_dir.mkdir(parents=True, exist_ok=True)
        base = _normalize_character_source(content, canvas_size)
        candidates = []
        total = max(1, len(frame_plan) if frame_plan else _character_action_total_frames(fixed_counts))
        written = 0
        plan = frame_plan or [
            {"action": action, "frame_index": index, "frame_count": int(fixed_counts.get(action, CHARACTER_ACTION_FRAME_COUNTS[action]))}
            for action in CHARACTER_ACTION_FRAME_COUNTS
            for index in range(int(fixed_counts.get(action, CHARACTER_ACTION_FRAME_COUNTS[action])))
        ]
        for item in plan:
            action = item["action"]
            index = item["frame_index"]
            filename = f"{action}_{index + 1:03d}.png"
            out_path = output_dir / filename
            base.save(out_path, "PNG")
            candidates.append({
                "id": f"{action}_{index + 1:03d}",
                "action": action,
                "action_label": CHARACTER_ACTION_LABELS[action],
                "frame_index": index,
                "filename": filename,
                "url": f"/api/character-action/analyze/{job_id}/assets/{filename}",
                "placeholder": True,
            })
            written += 1
            _set_character_action_job(
                job_id,
                status="processing",
                progress=min(95, 28 + round((written / total) * 60)),
                result=_character_action_progress_result(
                    candidates=candidates,
                    fixed_counts=fixed_counts,
                    canvas_size=canvas_size,
                    provider="placeholder",
                    total_count=total,
                    batch_size=batch_size,
                ),
            )
        _set_character_action_job(
            job_id,
            status="completed",
            progress=100,
            result=_character_action_progress_result(
                candidates=candidates,
                fixed_counts=fixed_counts,
                canvas_size=canvas_size,
                provider="placeholder",
                total_count=total,
                batch_size=batch_size,
            ),
            warning={
                "code": "AI_PROVIDER_NOT_CONFIGURED",
                "message": "No AI image provider is configured. Placeholder candidates are shown so the workflow can still be tested.",
            },
        )
    except Exception as e:
        _set_character_action_job(job_id, status="failed", progress=100, error={"code": "PROCESSING_ERROR", "message": str(e)})


def _run_character_action_analysis(job_id: str, content: bytes, params: dict):
    if not is_gemini_configured() and not is_qwen_configured():
        _run_character_action_placeholder(job_id, content, params)
        return

    job = _character_action_jobs[job_id]
    try:
        _set_character_action_job(job_id, status="processing", progress=12, warning=None)
        canvas_size = int(params.get("canvas_size") or 512)
        fixed_counts = params.get("fixed_frame_counts") or CHARACTER_ACTION_FRAME_COUNTS
        batch_size = _character_action_batch_size(params)
        frame_plan = _character_action_frame_plan(params, fixed_counts)
        total_count = max(1, len(frame_plan) if frame_plan else _character_action_total_frames(fixed_counts))
        output_dir = OUTPUT_DIR / job_id / "character_action_candidates"
        output_dir.mkdir(parents=True, exist_ok=True)

        base = _normalize_character_source(content, canvas_size)
        buffer = io.BytesIO()
        base.save(buffer, "PNG")
        base_png = buffer.getvalue()

        provider_warning = None
        partial_candidates: list[dict] = []
        current_provider = {"name": "gemini" if is_gemini_configured() else "qwen"}
        current_batch = {"index": 1 if total_count > 0 else 0}

        def _publish_progress(done: int, total: int):
            _set_character_action_job(
                job_id,
                status="processing",
                progress=min(96, 12 + round((done / max(total, 1)) * 82)),
            )

        def _publish_candidate(candidate: dict, done: int, total: int):
            decorated = _decorate_character_action_candidate(job_id, candidate)
            existing_index = next((i for i, item in enumerate(partial_candidates) if item.get("id") == decorated.get("id")), -1)
            if existing_index >= 0:
                partial_candidates[existing_index] = decorated
            else:
                partial_candidates.append(decorated)
            _set_character_action_job(
                job_id,
                status="processing",
                progress=min(96, 12 + round((done / max(total, 1)) * 82)),
                result=_character_action_progress_result(
                    candidates=partial_candidates,
                    fixed_counts=fixed_counts,
                    canvas_size=canvas_size,
                    provider=current_provider["name"],
                    total_count=total,
                    batch_size=batch_size,
                    current_batch_index=current_batch["index"],
                ),
                warning=provider_warning,
            )

        def _publish_batch_start(batch_index: int, done: int, total: int):
            current_batch["index"] = batch_index
            _set_character_action_job(
                job_id,
                status="processing",
                progress=min(96, 12 + round((done / max(total, 1)) * 82)),
                result=_character_action_progress_result(
                    candidates=partial_candidates,
                    fixed_counts=fixed_counts,
                    canvas_size=canvas_size,
                    provider=current_provider["name"],
                    total_count=total,
                    batch_size=batch_size,
                    current_batch_index=batch_index,
                ),
                warning=provider_warning,
            )

        if is_gemini_configured():
            try:
                result = generate_character_action_candidates_with_gemini(
                    base_png=base_png,
                    output_dir=output_dir,
                    fixed_counts=fixed_counts,
                    canvas_size=canvas_size,
                    pixel_art=bool(params.get("pixel_art_mode", True)),
                    on_progress=_publish_progress,
                    on_candidate=_publish_candidate,
                    on_batch_start=_publish_batch_start,
                    frame_plan=frame_plan,
                    max_concurrency=batch_size,
                )
            except GeminiProviderError as e:
                if not is_qwen_configured():
                    raise
                provider_warning = {
                    "code": "GEMINI_FALLBACK_TO_QWEN",
                    "message": f"Gemini failed, so Qwen was used instead: {e.message}",
                }
                current_provider["name"] = "qwen"
                result = generate_character_action_candidates_with_qwen(
                    base_png=base_png,
                    output_dir=output_dir,
                    fixed_counts=fixed_counts,
                    canvas_size=canvas_size,
                    pixel_art=bool(params.get("pixel_art_mode", True)),
                    on_progress=_publish_progress,
                    on_candidate=_publish_candidate,
                    on_batch_start=_publish_batch_start,
                    frame_plan=frame_plan,
                    max_concurrency=batch_size,
                )
        else:
            current_provider["name"] = "qwen"
            result = generate_character_action_candidates_with_qwen(
                base_png=base_png,
                output_dir=output_dir,
                fixed_counts=fixed_counts,
                canvas_size=canvas_size,
                pixel_art=bool(params.get("pixel_art_mode", True)),
                on_progress=_publish_progress,
                on_candidate=_publish_candidate,
                on_batch_start=_publish_batch_start,
                frame_plan=frame_plan,
                max_concurrency=batch_size,
            )
        decorated_candidates = [
            _decorate_character_action_candidate(job_id, candidate)
            for candidate in result.get("candidates", [])
        ]

        _set_character_action_job(
            job_id,
            status="completed",
            progress=100,
            result={
                **result,
                "candidates": decorated_candidates,
                "generated_count": len(decorated_candidates),
                "total_count": total_count,
                "batch_size": batch_size,
                "current_batch_index": 0 if not decorated_candidates else ((len(decorated_candidates) - 1) // batch_size) + 1,
            },
            error=None,
            warning=provider_warning,
        )
    except GeminiProviderError as e:
        partial_result = job.get("result")
        _set_character_action_job(
            job_id,
            status="failed",
            progress=100,
            result=partial_result,
            error={"code": e.code, "message": e.message},
            warning={"code": e.code, "message": e.message} if partial_result and partial_result.get("candidates") else job.get("warning"),
        )
    except QwenProviderError as e:
        partial_result = job.get("result")
        _set_character_action_job(
            job_id,
            status="failed",
            progress=100,
            result=partial_result,
            error={"code": e.code, "message": e.message},
            warning={"code": e.code, "message": e.message} if partial_result and partial_result.get("candidates") else job.get("warning"),
        )
    except Exception as e:
        partial_result = job.get("result")
        _set_character_action_job(
            job_id,
            status="failed",
            progress=100,
            result=partial_result,
            error={"code": "PROCESSING_ERROR", "message": str(e)},
            warning={"code": "PROCESSING_ERROR", "message": str(e)} if partial_result and partial_result.get("candidates") else job.get("warning"),
        )

app = FastAPI(
    title="Droi-game-tool API",
    version="1.6",
    description="上传视频后自动提取帧、抠图处理，生成序列帧 Sprite Sheet",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _init_job(job_id: str, params: JobParams, rq_job_id: str = ""):
    """初始化任务记录"""
    _jobs[job_id] = {
        "id": job_id,
        "status": "queued",
        "progress": 0,
        "params": params.model_dump(),
        "rq_job_id": rq_job_id,
        "result": None,
        "error": None,
    }


@app.on_event("startup")
async def startup():
    ensure_dirs()


@app.get("/")
async def root():
    return {
        "ok": True,
        "service": "Droi-game-tool API",
        "frontend": "http://127.0.0.1:5173",
        "docs": "http://127.0.0.1:8000/docs",
    }


@app.get("/health")
async def health():
    return {"ok": True}


@app.post("/jobs", response_model=dict)
async def create_job(
    file: UploadFile = File(None),
    params: str = Form(default="{}"),
):
    """
    创建任务。上传视频文件或提供 URL（URL 可选实现）。
    """
    job_id = generate_job_id()

    try:
        params_obj = JobParams.model_validate_json(params)
    except Exception as e:
        raise HTTPException(400, f"参数解析失败: {e}")

    if not file:
        raise HTTPException(400, "请上传视频文件")

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(400, f"不支持的格式，仅支持: {', '.join(ALLOWED_VIDEO_EXTENSIONS)}")

    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(400, f"文件过大，限制 {MAX_UPLOAD_SIZE_MB}MB")

    save_uploaded_file(job_id, file.filename or "video.mp4", content)
    video_path = get_video_path(job_id)
    if not video_path:
        raise HTTPException(500, "保存视频失败")

    _init_job(job_id, params_obj)

    try:
        from worker.tasks import enqueue_job
        rq_id = enqueue_job(
            job_id,
            str(video_path),
            str(OUTPUT_DIR),
            str(TEMP_DIR),
            params_obj.model_dump(),
        )
        _update_job(job_id, rq_job_id=rq_id)
    except Exception as e:
        # Windows 无 Redis 或 RQ 不支持时，使用同步模式在后台线程执行
        _update_job(job_id, status="processing", rq_job_id="")
        thread = threading.Thread(target=_run_pipeline_sync, args=(job_id, str(video_path)))
        thread.daemon = True
        thread.start()

    return {"job_id": job_id}


@app.get("/jobs/{job_id}", response_model=dict)
async def get_job(job_id: str):
    """查询任务状态"""
    if job_id not in _jobs:
        raise HTTPException(404, "任务不存在")

    job = _jobs[job_id]
    resp = {
        "id": job_id,
        "status": job["status"],
        "progress": job.get("progress", 0),
        "params": job.get("params"),
        "error": job.get("error"),
        "result": job.get("result"),
    }

    # 若内存状态为 queued/processing，尝试从 RQ 拉取最新状态
    if job["status"] in ("queued", "processing") and job.get("rq_job_id"):
        try:
            from worker.tasks import get_job_status
            rq_status = get_job_status(job["rq_job_id"])
            status_map = {"queued": "queued", "started": "processing", "finished": "completed", "failed": "failed", "deferred": "queued"}
            resp["status"] = status_map.get(rq_status["status"], job["status"])
            if rq_status.get("result"):
                resp["result"] = rq_status["result"]
                resp["progress"] = 100
                _update_job(job_id, status="completed", progress=100, result=rq_status["result"])
            if rq_status.get("exc_info"):
                resp["error"] = {"code": "PROCESSING_ERROR", "message": rq_status["exc_info"]}
                resp["status"] = "failed"
                _update_job(job_id, status="failed", error=resp["error"])
        except Exception:
            pass

    return resp


@app.get("/jobs/{job_id}/result")
async def get_result(job_id: str, format: str = "png"):
    """下载结果：png 或 zip"""
    if job_id not in _jobs:
        raise HTTPException(404, "任务不存在")
    if _jobs[job_id]["status"] != "completed":
        raise HTTPException(400, "任务未完成")

    paths = get_result_paths(job_id)
    if not paths:
        raise HTTPException(404, "结果文件不存在")

    sprite_path, index_path = paths
    if format == "zip":
        import zipfile
        zip_path = OUTPUT_DIR / job_id / "result.zip"
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.write(sprite_path, "sprite.png")
            zf.write(index_path, "index.json")
        return FileResponse(zip_path, filename="sprite_sheet.zip", media_type="application/zip")
    return FileResponse(sprite_path, filename="sprite.png", media_type="image/png")


@app.get("/jobs/{job_id}/index")
async def get_index(job_id: str):
    """获取索引 JSON"""
    paths = get_result_paths(job_id)
    if not paths:
        raise HTTPException(404, "结果不存在")
    _, index_path = paths
    return FileResponse(index_path, media_type="application/json")


def _run_matte_sync(content: bytes) -> bytes:
    """Run background removal in a worker thread. Gemini is preferred, rembg is the fallback."""
    gemini_error = None
    if is_gemini_configured():
        try:
            return remove_background_with_gemini(content)
        except GeminiProviderError as e:
            gemini_error = e.message
    from rembg import remove
    from worker.processor import _get_session
    try:
        return remove(content, session=_get_session())
    except Exception as e:
        if gemini_error:
            raise RuntimeError(f"Gemini matte failed ({gemini_error}); rembg fallback also failed ({e})") from e
        raise


@app.post("/matte")
async def matte_image(file: UploadFile = File(...)):
    """
    AI matte endpoint. Upload one image and receive a transparent PNG.
    Gemini is used first when configured; rembg is used as the local fallback.
    """
    if not file.filename:
        raise HTTPException(400, "Please upload an image file")
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(400, f"Unsupported format. Supported formats: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}")

    content = await file.read()
    if len(content) > MAX_IMAGE_MB * 1024 * 1024:
        raise HTTPException(400, f"Image must be under {MAX_IMAGE_MB}MB")

    try:
        result = await asyncio.to_thread(_run_matte_sync, content)
        return Response(content=result, media_type="image/png")
    except Exception as e:
        raise HTTPException(500, f"Background removal failed: {str(e)}")


@app.post("/character-action/analyze")
async def create_character_action_analysis_job(
    file: UploadFile = File(...),
    params: str = Form(default="{}"),
):
    """
    Character action AI analysis endpoint.
    Gemini is preferred; Qwen/DashScope is used as fallback when available.
    """
    if not file.filename:
        raise HTTPException(400, "Please upload a base character image")
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(400, f"Unsupported format. Supported formats: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}")

    content = await file.read()
    if len(content) > MAX_IMAGE_MB * 1024 * 1024:
        raise HTTPException(400, f"Image must be under {MAX_IMAGE_MB}MB")

    try:
        params_obj = json.loads(params or "{}")
    except Exception as e:
        raise HTTPException(400, f"Failed to parse params: {e}")

    fixed_counts = params_obj.get("fixed_frame_counts") or CHARACTER_ACTION_FRAME_COUNTS
    try:
        frame_plan = _character_action_frame_plan(params_obj, fixed_counts)
        total_frames = len(frame_plan) if frame_plan else _character_action_total_frames(fixed_counts)
    except Exception:
        raise HTTPException(400, "fixed_frame_counts must be a map of action names to frame counts")
    if total_frames < 1:
        raise HTTPException(400, "At least one action frame is required")
    if total_frames > CHARACTER_ACTION_MAX_FRAMES:
        raise HTTPException(400, f"Action analysis is limited to {CHARACTER_ACTION_MAX_FRAMES} frames per job")

    job_id = generate_job_id()
    save_uploaded_file(job_id, file.filename or "base_character.png", content)
    _character_action_jobs[job_id] = {
        "id": job_id,
        "status": "queued",
        "progress": 0,
        "params": params_obj,
        "result": _character_action_progress_result(
            candidates=[],
            fixed_counts=fixed_counts,
            canvas_size=int(params_obj.get("canvas_size") or 512),
            provider="pending",
            total_count=total_frames,
            batch_size=_character_action_batch_size(params_obj),
        ),
        "error": None,
        "warning": None,
    }
    _save_character_action_job(job_id)
    thread = threading.Thread(target=_run_character_action_analysis, args=(job_id, content, params_obj))
    thread.daemon = True
    thread.start()
    return {"job_id": job_id}


@app.get("/character-action/analyze/{job_id}")
async def get_character_action_analysis_job(job_id: str):
    """查询人物动作 AI 分析任务状态"""
    job = _get_character_action_job(job_id)
    if not job:
        raise HTTPException(404, "AI analysis job not found")
    return {
        "id": job_id,
        "status": job["status"],
        "progress": job.get("progress", 0),
        "error": job.get("error"),
        "warning": job.get("warning"),
        "result": job.get("result"),
    }


@app.get("/character-action/analyze/{job_id}/result")
async def get_character_action_analysis_result(job_id: str):
    """获取人物动作 AI 分析候选图清单"""
    job = _get_character_action_job(job_id)
    if not job:
        raise HTTPException(404, "AI analysis job not found")
    if job["status"] != "completed":
        raise HTTPException(400, "AI analysis job is not completed")
    return job.get("result") or {"candidates": []}


@app.get("/character-action/analyze/{job_id}/assets/{filename}")
async def get_character_action_analysis_asset(job_id: str, filename: str):
    """读取人物动作 AI 分析候选 PNG"""
    job = _get_character_action_job(job_id)
    if not job:
        raise HTTPException(404, "AI analysis job not found")
    safe_name = Path(filename).name
    if safe_name != filename or not safe_name.lower().endswith(".png"):
        raise HTTPException(400, "Invalid filename")
    path = OUTPUT_DIR / job_id / "character_action_candidates" / safe_name
    if not path.exists():
        raise HTTPException(404, "Candidate image not found")
    return FileResponse(path, filename=safe_name, media_type="image/png")


@app.post("/watermark")
async def create_watermark_job(file: UploadFile = File(...)):
    """
    创建 Seedance 水印去除任务。上传视频，返回 job_id，轮询 GET /watermark/{id} 获取状态。
    """
    job_id = generate_job_id()

    if not file.filename:
        raise HTTPException(400, "请上传视频文件")

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(400, f"不支持的格式，仅支持: {', '.join(ALLOWED_VIDEO_EXTENSIONS)}")

    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(400, f"文件过大，限制 {MAX_UPLOAD_SIZE_MB}MB")

    save_uploaded_file(job_id, file.filename or "video.mp4", content)
    video_path = get_video_path(job_id)
    if not video_path:
        raise HTTPException(500, "保存视频失败")

    _watermark_jobs[job_id] = {
        "id": job_id,
        "status": "queued",
        "progress": 0,
        "rq_job_id": "",
        "result": None,
        "error": None,
    }

    try:
        from worker.tasks import enqueue_watermark_job
        rq_id = enqueue_watermark_job(job_id, str(video_path), str(OUTPUT_DIR))
        _watermark_jobs[job_id]["rq_job_id"] = rq_id
    except Exception:
        _watermark_jobs[job_id]["status"] = "processing"
        _watermark_jobs[job_id]["rq_job_id"] = ""
        thread = threading.Thread(target=_run_watermark_sync, args=(job_id, str(video_path)))
        thread.daemon = True
        thread.start()

    return {"job_id": job_id}


@app.get("/watermark/{job_id}")
async def get_watermark_job(job_id: str):
    """查询水印去除任务状态"""
    if job_id not in _watermark_jobs:
        raise HTTPException(404, "任务不存在")

    job = _watermark_jobs[job_id]
    resp = {
        "id": job_id,
        "status": job["status"],
        "progress": job.get("progress", 0),
        "error": job.get("error"),
        "result": job.get("result"),
    }

    if job["status"] in ("queued", "processing") and job.get("rq_job_id"):
        try:
            from worker.tasks import get_job_status
            rq_status = get_job_status(job["rq_job_id"])
            status_map = {"queued": "queued", "started": "processing", "finished": "completed", "failed": "failed", "deferred": "queued"}
            resp["status"] = status_map.get(rq_status["status"], job["status"])
            if rq_status.get("result"):
                resp["result"] = rq_status["result"]
                resp["progress"] = 100
                job["status"] = "completed"
                job["progress"] = 100
                job["result"] = rq_status["result"]
            if rq_status.get("exc_info"):
                resp["error"] = {"code": "PROCESSING_ERROR", "message": rq_status["exc_info"]}
                resp["status"] = "failed"
                job["status"] = "failed"
                job["error"] = resp["error"]
        except Exception:
            pass

    return resp


@app.get("/watermark/{job_id}/result")
async def get_watermark_result(job_id: str):
    """下载去水印后的视频"""
    if job_id not in _watermark_jobs:
        raise HTTPException(404, "任务不存在")
    if _watermark_jobs[job_id]["status"] != "completed":
        raise HTTPException(400, "任务未完成")

    job = _watermark_jobs[job_id]
    out_path = None
    if job.get("result", {}).get("output"):
        p = Path(job["result"]["output"]).resolve()
        if p.exists():
            out_path = p
    if not out_path:
        out_path = get_watermark_output_path(job_id)
    if not out_path:
        raise HTTPException(404, "结果文件不存在")

    return FileResponse(out_path, filename="clean.mp4", media_type="video/mp4")


@app.delete("/watermark/{job_id}")
async def delete_watermark_job(job_id: str):
    """删除水印去除任务及结果"""
    if job_id in _watermark_jobs:
        del _watermark_jobs[job_id]
    import shutil
    for base in [UPLOAD_DIR, OUTPUT_DIR, TEMP_DIR]:
        d = base / job_id
        if d.exists():
            shutil.rmtree(d, ignore_errors=True)
    return {"ok": True}


@app.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    """删除任务及结果"""
    if job_id in _jobs:
        del _jobs[job_id]
    import shutil
    for base in [UPLOAD_DIR, OUTPUT_DIR, TEMP_DIR]:
        d = base / job_id
        if d.exists():
            shutil.rmtree(d, ignore_errors=True)
    return {"ok": True}


# 后台轮询更新：需要 worker 完成后更新 _jobs。可通过 RQ 的失败/成功回调实现。
# 此处简化：GET /jobs/{id} 时主动查 RQ。
