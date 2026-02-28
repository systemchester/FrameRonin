"""应用配置"""
import os
from pathlib import Path

# 存储路径（支持环境变量，便于 Docker 挂载）
BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", str(BASE_DIR / "uploads")))
OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", str(BASE_DIR / "outputs")))
TEMP_DIR = Path(os.getenv("TEMP_DIR", str(BASE_DIR / "temp")))

# 文件限制
MAX_UPLOAD_SIZE_MB = int(os.getenv("MAX_UPLOAD_SIZE_MB", "200"))
MAX_VIDEO_DURATION_SEC = int(os.getenv("MAX_VIDEO_DURATION_SEC", "300"))
MAX_FRAMES = int(os.getenv("MAX_FRAMES", "2000"))
MAX_SHEET_EDGE = int(os.getenv("MAX_SHEET_EDGE", "16384"))

# Redis
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# 允许的视频格式
ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".mov", ".webm", ".avi", ".mkv"}
ALLOWED_VIDEO_MIMES = {
    "video/mp4", "video/quicktime", "video/webm",
    "video/x-msvideo", "video/x-matroska"
}
