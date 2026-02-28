const API_BASE = '/api'

export interface JobParams {
  fps?: number
  frame_range?: { start_sec?: number; end_sec?: number }
  max_frames?: number
  target_size?: { w: number; h: number }
  bg_color?: string
  transparent?: boolean
  padding?: number
  spacing?: number
  layout_mode?: 'fixed_columns' | 'auto_square'
  columns?: number
  matte_strength?: number
  crop_mode?: 'none' | 'tight_bbox' | 'safe_bbox'
}

export interface Job {
  id: string
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'canceled'
  progress: number
  params?: JobParams
  result?: { frame_count?: number; width?: number; height?: number }
  error?: { code: string; message: string }
}

export async function createJob(file: File, params: JobParams): Promise<{ job_id: string }> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('params', JSON.stringify(params))
  const res = await fetch(`${API_BASE}/jobs`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || String(err))
  }
  return res.json()
}

export async function getJob(jobId: string): Promise<Job> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}`)
  if (!res.ok) throw new Error('任务不存在')
  return res.json()
}

export function getResultUrl(jobId: string, format: 'png' | 'zip' = 'png'): string {
  return `${API_BASE}/jobs/${jobId}/result?format=${format}`
}

export function getIndexUrl(jobId: string): string {
  return `${API_BASE}/jobs/${jobId}/index`
}
