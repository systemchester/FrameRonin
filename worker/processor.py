"""视频处理管线：帧提取、抠图、合成"""
import json
import math
import subprocess
from pathlib import Path
from typing import Any, Callable, Optional

from PIL import Image
from rembg import remove
from rembg.session_factory import new_session

# 预加载 rembg 会话
_matting_session = None


def _get_session():
    global _matting_session
    if _matting_session is None:
        _matting_session = new_session("u2net")
    return _matting_session


def get_video_info(video_path: Path) -> dict:
    """使用 ffprobe 获取视频信息"""
    cmd = [
        "ffprobe",
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        str(video_path)
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    data = json.loads(result.stdout)
    
    duration = 0
    width, height = 0, 0
    fps = 30
    
    for stream in data.get("streams", []):
        if stream.get("codec_type") == "video":
            width = int(stream.get("width", 0))
            height = int(stream.get("height", 0))
            if "r_frame_rate" in stream:
                num, den = map(int, stream["r_frame_rate"].split("/"))
                fps = num / den if den else 30
            break
    
    try:
        duration = float(data.get("format", {}).get("duration", 0))
    except (ValueError, KeyError, TypeError):
        duration = 0
    
    return {
        "duration": duration,
        "width": width,
        "height": height,
        "fps": fps,
        "frame_count": int(duration * fps) if duration and fps else 0
    }


def extract_frames(
    video_path: Path,
    output_dir: Path,
    fps: int,
    start_sec: float,
    end_sec: Optional[float],
    max_frames: int,
    on_progress: Optional[Callable[[int, int], None]] = None
) -> list[tuple[Path, float]]:
    """提取视频帧为 PNG 序列"""
    output_dir.mkdir(parents=True, exist_ok=True)
    
    info = get_video_info(video_path)
    duration = info["duration"]
    if end_sec is None or end_sec <= 0:
        end_sec = duration
    
    start_sec = max(0, min(start_sec, duration))
    end_sec = max(start_sec, min(end_sec, duration))
    
    interval = 1.0 / fps
    timestamps = []
    t = start_sec
    while t < end_sec and len(timestamps) < max_frames:
        timestamps.append(t)
        t += interval
    
    for i, ts in enumerate(timestamps):
        out_path = output_dir / f"frame_{i:05d}.png"
        cmd = [
            "ffmpeg", "-y",
            "-ss", str(ts),
            "-i", str(video_path),
            "-vframes", "1",
            "-f", "image2",
            str(out_path)
        ]
        subprocess.run(cmd, capture_output=True, check=True)
        if on_progress:
            on_progress(i + 1, len(timestamps))
    
    return [(output_dir / f"frame_{i:05d}.png", timestamps[i]) for i in range(len(timestamps))]


def process_matte(
    input_path: Path,
    output_path: Path,
    alpha_matting: bool = False,
    alpha_matting_foreground_threshold: int = 240,
    alpha_matting_background_threshold: int = 10
) -> None:
    """对单帧进行抠图"""
    with open(input_path, "rb") as f:
        input_data = f.read()
    
    output_data = remove(
        input_data,
        session=_get_session(),
        alpha_matting=alpha_matting,
        alpha_matting_foreground_threshold=alpha_matting_foreground_threshold,
        alpha_matting_background_threshold=alpha_matting_background_threshold
    )
    
    with open(output_path, "wb") as f:
        f.write(output_data)


def get_alpha_bbox(img: Image.Image) -> Optional[tuple[int, int, int, int]]:
    """获取 Alpha 非空区域的边界框"""
    if img.mode != "RGBA":
        return None
    alpha = img.split()[-1]
    bbox = alpha.getbbox()
    return bbox


def process_frame(
    src: Path,
    dest: Path,
    target_w: int,
    target_h: int,
    padding: int,
    bg_color: str,
    transparent: bool,
    crop_mode: str,
    matte_strength: float
) -> None:
    """单帧后处理：抠图、裁剪、缩放、填充"""
    # 抠图
    matte_tmp = dest.parent / f"_matte_{dest.name}"
    process_matte(
        src, matte_tmp,
        alpha_matting=matte_strength > 0.5,
        alpha_matting_foreground_threshold=int(240 * matte_strength),
        alpha_matting_background_threshold=int(10 * (1 - matte_strength))
    )
    
    img = Image.open(matte_tmp).convert("RGBA")
    matte_tmp.unlink(missing_ok=True)
    
    # 按 crop_mode 裁剪
    bbox = get_alpha_bbox(img)
    if crop_mode == "tight_bbox" and bbox:
        pad = 0
        x1 = max(0, bbox[0] - pad)
        y1 = max(0, bbox[1] - pad)
        x2 = min(img.width, bbox[2] + pad)
        y2 = min(img.height, bbox[3] + pad)
        img = img.crop((x1, y1, x2, y2))
    elif crop_mode == "safe_bbox" and bbox:
        pad = padding
        x1 = max(0, bbox[0] - pad)
        y1 = max(0, bbox[1] - pad)
        x2 = min(img.width, bbox[2] + pad)
        y2 = min(img.height, bbox[3] + pad)
        img = img.crop((x1, y1, x2, y2))
    
    # 缩放并居中到 target_size
    img.thumbnail((target_w - padding * 2, target_h - padding * 2), Image.Resampling.LANCZOS)
    
    canvas = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0) if transparent else _parse_bg_color(bg_color))
    paste_x = (target_w - img.width) // 2
    paste_y = (target_h - img.height) // 2
    canvas.paste(img, (paste_x, paste_y), img)
    
    canvas.save(dest, "PNG")


def _parse_bg_color(s: str) -> tuple[int, int, int, int]:
    """解析背景色 #RRGGBB -> (R,G,B,A)"""
    if s == "transparent" or not s:
        return (0, 0, 0, 0)
    s = s.lstrip("#")
    if len(s) == 6:
        return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), 255)
    return (0, 0, 0, 0)


def compute_layout(
    frame_count: int,
    frame_w: int,
    frame_h: int,
    spacing: int,
    layout_mode: str,
    columns: Optional[int] = None
) -> tuple[int, int, int, int]:
    """计算布局，返回 (cols, rows, sheet_w, sheet_h)"""
    if layout_mode == "fixed_columns" and columns:
        cols = columns
    else:
        cols = max(1, math.ceil(math.sqrt(frame_count)))
    
    rows = math.ceil(frame_count / cols) if frame_count else 0
    sheet_w = cols * (frame_w + spacing) - spacing
    sheet_h = rows * (frame_h + spacing) - spacing
    return cols, rows, sheet_w, sheet_h


def compose_sprite_sheet(
    processed_frames: list[Path],
    timestamps: list[float],
    frame_w: int,
    frame_h: int,
    spacing: int,
    layout_mode: str,
    columns: int,
    output_path: Path
) -> dict:
    """合成序列帧图并生成索引"""
    n = len(processed_frames)
    cols, rows, sheet_w, sheet_h = compute_layout(n, frame_w, frame_h, spacing, layout_mode, columns)
    
    sheet = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))
    frames_index = []
    
    for i, (fp, t) in enumerate(zip(processed_frames, timestamps)):
        img = Image.open(fp).convert("RGBA")
        col = i % cols
        row = i // cols
        x = col * (frame_w + spacing)
        y = row * (frame_h + spacing)
        sheet.paste(img, (x, y), img)
        frames_index.append({
            "i": i,
            "x": x,
            "y": y,
            "w": frame_w,
            "h": frame_h,
            "t": round(t, 3)
        })
    
    sheet.save(output_path, "PNG")

    return {
        "version": "1.0",
        "frame_size": {"w": frame_w, "h": frame_h},
        "sheet_size": {"w": sheet_w, "h": sheet_h},
        "frames": frames_index
    }


def run_pipeline(job_id: str, video_path: str, output_base: str, temp_base: str, params: dict) -> dict:
    """
    完整处理管线入口。
    由 RQ worker 调用；video_path/output_base/temp_base 由 API 传入绝对路径。
    """
    vpath = Path(video_path)
    if not vpath.exists():
        raise FileNotFoundError(f"Video not found: {video_path}")

    temp_path = Path(temp_base) / job_id
    output_path = Path(output_base) / job_id
    temp_path.mkdir(parents=True, exist_ok=True)
    output_path.mkdir(parents=True, exist_ok=True)

    fr = params.get("frame_range", {})
    start_sec = fr.get("start_sec", 0)
    end_sec = fr.get("end_sec")
    fps = params.get("fps", 12)
    max_frames = params.get("max_frames", 300)
    target_size = params.get("target_size", {"w": 256, "h": 256})
    target_w = target_size.get("w", 256)
    target_h = target_size.get("h", 256)
    padding = params.get("padding", 4)
    spacing = params.get("spacing", 4)
    bg_color = params.get("bg_color", "transparent")
    transparent = params.get("transparent", True)
    crop_mode = params.get("crop_mode", "tight_bbox")
    matte_strength = params.get("matte_strength", 0.6)
    layout_mode = params.get("layout_mode", "fixed_columns")
    columns = params.get("columns", 12)

    # 1. 帧提取
    frames_dir = temp_path / "frames"
    extracted = extract_frames(vpath, frames_dir, fps, start_sec, end_sec, max_frames)

    if not extracted:
        raise ValueError("No frames extracted")

    # 2. 抠图 + 后处理
    processed_dir = temp_path / "processed"
    processed_dir.mkdir(parents=True, exist_ok=True)
    processed = []
    total = len(extracted)
    for i, (src, ts) in enumerate(extracted):
        dest = processed_dir / f"out_{i:05d}.png"
        process_frame(src, dest, target_w, target_h, padding, bg_color, transparent, crop_mode, matte_strength)
        processed.append((dest, ts))

    # 3. 合成
    sprite_path = output_path / "sprite.png"
    index_data = compose_sprite_sheet(
        [p[0] for p in processed],
        [p[1] for p in processed],
        target_w, target_h, spacing, layout_mode, columns, sprite_path
    )
    index_path = output_path / "index.json"
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(index_data, f, indent=2, ensure_ascii=False)

    # 4. 清理临时帧
    import shutil
    if frames_dir.exists():
        shutil.rmtree(frames_dir, ignore_errors=True)
    if processed_dir.exists():
        shutil.rmtree(processed_dir, ignore_errors=True)

    return {
        "frame_count": len(processed),
        "width": index_data["sheet_size"]["w"],
        "height": index_data["sheet_size"]["h"]
    }
