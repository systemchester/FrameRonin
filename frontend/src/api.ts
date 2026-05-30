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
  if (!res.ok) throw new Error('Task not found')
  return res.json()
}

export function getResultUrl(jobId: string, format: 'png' | 'zip' = 'png'): string {
  return `${API_BASE}/jobs/${jobId}/result?format=${format}`
}

export function getIndexUrl(jobId: string): string {
  return `${API_BASE}/jobs/${jobId}/index`
}

export interface WatermarkJob {
  id: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress: number
  result?: { output?: string }
  error?: { code: string; message: string }
}

export async function createWatermarkJob(file: File): Promise<{ job_id: string }> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${API_BASE}/watermark`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || String(err))
  }
  return res.json()
}

export async function getWatermarkJob(jobId: string): Promise<WatermarkJob> {
  const res = await fetch(`${API_BASE}/watermark/${jobId}`)
  if (!res.ok) throw new Error('Task not found')
  return res.json()
}

export function getWatermarkResultUrl(jobId: string): string {
  return `${API_BASE}/watermark/${jobId}/result`
}

/** AI matte: upload an image and receive a transparent PNG blob. The first call may be slower. */
export async function removeBackground(file: File): Promise<Blob> {
  const formData = new FormData()
  formData.append('file', file)
  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), 120_000)
  try {
    const res = await fetch(`${API_BASE}/matte`, {
      method: 'POST',
      body: formData,
      signal: ctrl.signal,
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || res.statusText)
    }
    return res.blob()
  } finally {
    clearTimeout(timeout)
  }
}

export type CharacterActionName = 'idle' | 'walk' | 'run' | 'attack' | 'skill' | 'hurt' | 'death'

export type CharacterActionAnalysisStatus = 'queued' | 'processing' | 'completed' | 'failed'

export type CharacterActionAnalysisCandidate = {
  id: string
  action: CharacterActionName
  frame_index: number
  filename: string
  url: string
  provider?: string
}

export type CharacterActionFramePlanItem = {
  action: CharacterActionName
  frame_index: number
  frame_count: number
}

export type CharacterActionAnalysisJob = {
  id: string
  status: CharacterActionAnalysisStatus
  progress: number
  error?: { code: string; message: string } | null
  warning?: { code: string; message: string } | null
  result?: {
    candidates?: CharacterActionAnalysisCandidate[]
    fixed_frame_counts?: Record<CharacterActionName, number>
    canvas_size?: number
    provider?: string
    model?: string
    generated_count?: number
    total_count?: number
    batch_size?: number
    current_batch_index?: number
  } | null
}

export async function createCharacterActionAnalysisJob(
  file: File,
  options: {
    pixelArtMode: boolean
    canvasSize: number
    fixedFrameCounts: Record<CharacterActionName, number>
    framePlan?: CharacterActionFramePlanItem[]
  },
): Promise<{ job_id: string }> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('params', JSON.stringify({
    canvas_size: options.canvasSize,
    pixel_art_mode: options.pixelArtMode,
    consistency_priority: true,
    fixed_frame_counts: options.fixedFrameCounts,
    frame_plan: options.framePlan,
  }))
  const res = await fetch(`${API_BASE}/character-action/analyze`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || String(err))
  }
  return res.json()
}

export async function getCharacterActionAnalysisJob(jobId: string): Promise<CharacterActionAnalysisJob> {
  const res = await fetch(`${API_BASE}/character-action/analyze/${jobId}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'AI analysis job not found')
  }
  return res.json()
}

export async function getCharacterActionAnalysisResult(jobId: string): Promise<NonNullable<CharacterActionAnalysisJob['result']>> {
  const res = await fetch(`${API_BASE}/character-action/analyze/${jobId}/result`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'AI analysis result not found')
  }
  return res.json()
}
