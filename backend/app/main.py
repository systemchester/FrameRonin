"""FastAPI 主应用"""
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
from fastapi.responses import FileResponse, JSONResponse

from .config import (
    ALLOWED_VIDEO_EXTENSIONS,
    MAX_UPLOAD_SIZE_MB,
    OUTPUT_DIR,
    TEMP_DIR,
    UPLOAD_DIR,
)

# Worker 与 API 共享存储路径
from .models import JobParams, JobResponse
from .storage import ensure_dirs, generate_job_id, get_result_paths, get_video_path, save_uploaded_file

# 任务状态存储（生产环境应使用 Redis）
_jobs: dict[str, dict] = {}


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

app = FastAPI(
    title="PixelWork - 视频转序列帧",
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
