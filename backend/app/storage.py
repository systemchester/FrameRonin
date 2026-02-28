"""存储管理"""
import json
import shutil
import uuid
from pathlib import Path
from typing import Optional

from .config import UPLOAD_DIR, OUTPUT_DIR, TEMP_DIR


def ensure_dirs():
    """确保目录存在"""
    for d in [UPLOAD_DIR, OUTPUT_DIR, TEMP_DIR]:
        d.mkdir(parents=True, exist_ok=True)


def generate_job_id() -> str:
    """生成任务ID"""
    return str(uuid.uuid4())[:12]


def get_job_dirs(job_id: str) -> tuple[Path, Path, Path]:
    """获取任务的各目录路径"""
    upload_path = UPLOAD_DIR / job_id
    temp_path = TEMP_DIR / job_id
    output_path = OUTPUT_DIR / job_id
    return upload_path, temp_path, output_path


def save_uploaded_file(job_id: str, filename: str, content: bytes) -> Path:
    """保存上传的文件"""
    ensure_dirs()
    upload_path, _, _ = get_job_dirs(job_id)
    upload_path.mkdir(parents=True, exist_ok=True)
    file_path = upload_path / filename
    file_path.write_bytes(content)
    return file_path


def get_video_path(job_id: str) -> Optional[Path]:
    """获取任务的视频文件路径"""
    upload_path, _, _ = get_job_dirs(job_id)
    if not upload_path.exists():
        return None
    for ext in [".mp4", ".mov", ".webm", ".avi", ".mkv"]:
        for f in upload_path.glob(f"*{ext}"):
            return f
    return None


def save_result(job_id: str, sprite_path: Path, index_data: dict) -> tuple[Path, Path]:
    """保存结果文件"""
    output_path, _, _ = get_job_dirs(job_id)
    output_path.mkdir(parents=True, exist_ok=True)
    dest_sprite = output_path / "sprite.png"
    dest_index = output_path / "index.json"
    shutil.copy(sprite_path, dest_sprite)
    with open(dest_index, "w", encoding="utf-8") as f:
        json.dump(index_data, f, indent=2, ensure_ascii=False)
    return dest_sprite, dest_index


def get_result_paths(job_id: str) -> Optional[tuple[Path, Path]]:
    """获取结果文件路径"""
    output_path, _, _ = get_job_dirs(job_id)
    sprite = output_path / "sprite.png"
    index = output_path / "index.json"
    if sprite.exists() and index.exists():
        return sprite, index
    return None
