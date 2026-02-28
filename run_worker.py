#!/usr/bin/env python3
"""启动 RQ Worker"""
import os
import sys

# 项目根目录加入 path
ROOT = os.path.dirname(os.path.abspath(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.chdir(ROOT)

# 启动 worker
from rq import Worker
from rq.cli import main

if __name__ == "__main__":
    # 使用 rq 命令行
    sys.argv = ["rq", "worker", "pixelwork", "--url", os.getenv("REDIS_URL", "redis://localhost:6379/0")]
    main()
