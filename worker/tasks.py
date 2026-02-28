"""RQ 任务定义"""
import os
import redis
from rq import Queue
from rq.job import Job

from .processor import run_pipeline

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")


def get_queue():
    """获取 Redis 队列"""
    conn = redis.from_url(REDIS_URL)
    return Queue("pixelwork", connection=conn)


def enqueue_job(job_id: str, video_path: str, output_base: str, temp_base: str, params: dict) -> str:
    """将任务加入队列，返回 RQ job id"""
    q = get_queue()
    job = q.enqueue(
        run_pipeline,
        job_id, video_path, output_base, temp_base, params,
        job_timeout="30m"
    )
    return job.id


def get_job_status(rq_job_id: str) -> dict:
    """获取 RQ 任务状态"""
    conn = redis.from_url("redis://localhost:6379/0")
    job = Job.fetch(rq_job_id, connection=conn)
    return {
        "status": job.get_status(),
        "result": job.result,
        "exc_info": str(job.exc_info) if job.exc_info else None
    }
