/**
 * 归档：服务端任务处理流程（依赖后端 API /jobs）。
 * 当前应用采用纯前端处理，此组件暂未使用。
 * 若需启用服务端模式，可移回 components/ 并接入 App。
 */
import { useState } from 'react'
import { Button, Progress, Spin, Alert, Space } from 'antd'
import { createJob, getJob, type JobParams } from '../../api'

interface Props {
  file: File | null
  params: JobParams
  onJobCreated: (id: string) => void
  onComplete: () => void
  onBack: () => void
}

export default function ProcessStep({ file, params, onJobCreated, onComplete, onBack }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<string>('')

  const poll = async (id: string) => {
    const job = await getJob(id)
    setProgress(job.progress ?? 0)
    setStatus(job.status)
    if (job.status === 'completed') {
      onComplete()
      return
    }
    if (job.status === 'failed') {
      setError(job.error?.message || '处理失败')
      return
    }
    setTimeout(() => poll(id), 1500)
  }

  const handleStart = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const { job_id } = await createJob(file, params)
      setJobId(job_id)
      onJobCreated(job_id)
      setLoading(false)
      poll(job_id)
    } catch (e) {
      setError(String(e))
      setLoading(false)
    }
  }

  const statusText: Record<string, string> = {
    queued: '排队中',
    processing: '处理中',
    completed: '已完成',
    failed: '失败',
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%', paddingTop: 8 }}>
      {error && <Alert type="error" message={error} showIcon />}
      {!jobId ? (
        <>
          <Button type="primary" size="large" onClick={handleStart} loading={loading} disabled={!file}>
            开始处理
          </Button>
          <Button onClick={onBack} style={{ marginLeft: 8 }}>
            上一步
          </Button>
        </>
      ) : (
        <>
          <Spin spinning={loading && !jobId} />
          <div>
            <div>任务 ID: {jobId}</div>
            <div>状态: {statusText[status] || status}</div>
          </div>
          <Progress percent={progress} status={status === 'failed' ? 'exception' : 'active'} />
          {status === 'queued' && (
            <Alert message="任务已入队，Worker 启动后将自动处理" type="info" showIcon />
          )}
          {status === 'processing' && (
            <Alert message="正在提取帧、抠图、合成，请稍候..." type="info" showIcon />
          )}
          {status === 'failed' && (
            <Button type="primary" onClick={() => setJobId(null)}>
              重试
            </Button>
          )}
        </>
      )}
    </Space>
  )
}
