import { useEffect, useRef, useState } from 'react'
import { DownloadOutlined, ExpandOutlined, ReloadOutlined, RetweetOutlined, UndoOutlined } from '@ant-design/icons'
import { Button, Col, ColorPicker, Divider, Form, Input, InputNumber, message, Modal, Progress, Radio, Row, Slider, Space, Spin, Typography } from 'antd'
import JSZip from 'jszip'
import type { JobParams } from '../api'
import { useLanguage } from '../i18n/context'
import { formatError } from '../i18n/locales'
import FrameAnimationPreview from './ParamsStep/FrameAnimationPreview'
import FrameThumbnails from './ParamsStep/FrameThumbnails'
import {
  analyzeDuplicateFrames,
  applyBrushMask,
  applyChromaKey,
  applyInnerStroke,
  composeSpriteSheetClient,
  formatTime,
  resizeFrameToBlob,
  resizeFrameToCanvas,
} from './ParamsStep/utils'

const { Text } = Typography

interface Props {
  file: File | null
  params: JobParams
  onParamsChange: (p: JobParams) => void
}

const HANDLE_SIZE = 12
type CropHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | 'move' | null

function CropCanvasEditor({
  imageDataUrl,
  videoSize,
  cropRegion,
  onChange,
}: {
  imageDataUrl: string
  videoSize: { w: number; h: number }
  cropRegion: { left: number; top: number; right: number; bottom: number }
  onChange: (r: { left: number; top: number; right: number; bottom: number }) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dragging, setDragging] = useState<CropHandle>(null)
  const [startPos, setStartPos] = useState<{ x: number; y: number; left: number; top: number; right: number; bottom: number } | null>(null)

  const hitTest = (vx: number, vy: number): CropHandle => {
    const { left, top, right, bottom } = cropRegion
    const r = videoSize.w - left - right
    const b = videoSize.h - top - bottom
    const hs = HANDLE_SIZE
    if (vx >= left - hs && vx <= left + hs && vy >= top - hs && vy <= top + hs) return 'nw'
    if (vx >= left + r - hs && vx <= left + r + hs && vy >= top - hs && vy <= top + hs) return 'ne'
    if (vx >= left - hs && vx <= left + hs && vy >= top + b - hs && vy <= top + b + hs) return 'sw'
    if (vx >= left + r - hs && vx <= left + r + hs && vy >= top + b - hs && vy <= top + b + hs) return 'se'
    if (vx >= left - hs && vx <= left + hs && vy >= top && vy <= top + b) return 'w'
    if (vx >= left + r - hs && vx <= left + r + hs && vy >= top && vy <= top + b) return 'e'
    if (vx >= left && vx <= left + r && vy >= top - hs && vy <= top + hs) return 'n'
    if (vx >= left && vx <= left + r && vy >= top + b - hs && vy <= top + b + hs) return 's'
    if (vx >= left && vx <= left + r && vy >= top && vy <= top + b) return 'move'
    return null
  }

  const toVideoCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return { vx: 0, vy: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = videoSize.w / rect.width
    const scaleY = videoSize.h / rect.height
    return {
      vx: Math.round((clientX - rect.left) * scaleX),
      vy: Math.round((clientY - rect.top) * scaleY),
    }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { vx, vy } = toVideoCoords(e.clientX, e.clientY)
    const handle = hitTest(vx, vy)
    setDragging(handle)
    setStartPos({ x: vx, y: vy, ...cropRegion })
  }

  const [hoverHandle, setHoverHandle] = useState<CropHandle>(null)

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = toVideoCoords(e.clientX, e.clientY)
    if (!dragging || !startPos) {
      setHoverHandle(hitTest(coords.vx, coords.vy))
      return
    }
    const dx = coords.vx - startPos.x
    const dy = coords.vy - startPos.y
    let { left, top, right, bottom } = startPos
    if (dragging === 'move') {
      const w = videoSize.w - startPos.left - startPos.right
      const h = videoSize.h - startPos.top - startPos.bottom
      left = Math.max(0, Math.min(videoSize.w - w - 1, startPos.left + dx))
      top = Math.max(0, Math.min(videoSize.h - h - 1, startPos.top + dy))
      right = videoSize.w - left - w
      bottom = videoSize.h - top - h
    } else {
      const minW = 1
      const minH = 1
      if (dragging.includes('w')) left = Math.max(0, Math.min(videoSize.w - startPos.right - minW, startPos.left + dx))
      if (dragging.includes('e')) right = Math.max(0, Math.min(videoSize.w - startPos.left - minW, startPos.right - dx))
      if (dragging.includes('n')) top = Math.max(0, Math.min(videoSize.h - startPos.bottom - minH, startPos.top + dy))
      if (dragging.includes('s')) bottom = Math.max(0, Math.min(videoSize.h - startPos.top - minH, startPos.bottom - dy))
    }
    onChange({ left, top, right, bottom })
  }

  const handleMouseUp = () => {
    setDragging(null)
    setStartPos(null)
  }

  const getCursor = () => {
    if (dragging) return 'grabbing'
    const h = hoverHandle ?? null
    const map: Record<string, string> = {
      move: 'grab',
      n: 'n-resize', s: 's-resize', e: 'e-resize', w: 'w-resize',
      ne: 'ne-resize', nw: 'nw-resize', se: 'se-resize', sw: 'sw-resize',
    }
    return (h && map[h]) ?? 'crosshair'
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !imageDataUrl) return
    const img = new Image()
    img.onload = () => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      canvas.width = videoSize.w
      canvas.height = videoSize.h
      ctx.drawImage(img, 0, 0)
      const { left, top, right, bottom } = cropRegion
      const w = videoSize.w - left - right
      const h = videoSize.h - top - bottom
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      if (left > 0) ctx.fillRect(0, 0, left, videoSize.h)
      if (right > 0) ctx.fillRect(videoSize.w - right, 0, right, videoSize.h)
      if (top > 0) ctx.fillRect(left, 0, w, top)
      if (bottom > 0) ctx.fillRect(left, videoSize.h - bottom, w, bottom)
      ctx.strokeStyle = '#b55233'
      ctx.lineWidth = 2
      ctx.strokeRect(left, top, w, h)
      ctx.fillStyle = '#b55233'
      ;[
        [left, top], [left + w, top], [left + w, top + h], [left, top + h],
        [left + w / 2, top], [left + w / 2, top + h], [left, top + h / 2], [left + w, top + h / 2],
      ].forEach(([x, y]) => {
        ctx.fillRect(x - 4, y - 4, 8, 8)
      })
    }
    img.onerror = () => {
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#d4c8b8'
        ctx.fillRect(0, 0, videoSize.w, videoSize.h)
        ctx.fillStyle = '#6b5d4d'
        ctx.font = '14px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('图片加载失败', videoSize.w / 2, videoSize.h / 2)
      }
    }
    img.src = imageDataUrl
  }, [imageDataUrl, cropRegion, videoSize])

  if (!imageDataUrl) return null

  return (
    <div style={{ marginTop: 8, overflow: 'auto', maxHeight: 400, border: '1px solid #9a8b78', borderRadius: 8 }}>
      <canvas
        ref={canvasRef}
        width={videoSize.w}
        height={videoSize.h}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ maxWidth: '100%', cursor: getCursor(), display: 'block' }}
      />
    </div>
  )
}

function MatteBrushEditor({
  imageDataUrl,
  onMaskChange,
}: {
  imageDataUrl: string
  onMaskChange: (maskDataUrl: string | null) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const displayRef = useRef<HTMLCanvasElement>(null)
  const maskRef = useRef<HTMLCanvasElement>(null)
  const [brushSize, setBrushSize] = useState(20)
  const [drawing, setDrawing] = useState(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)
  const imgSize = useRef<{ w: number; h: number } | null>(null)
  const maskHistoryRef = useRef<string[]>([])
  const [canUndo, setCanUndo] = useState(false)

  const toCanvasCoords = (clientX: number, clientY: number) => {
    const canvas = maskRef.current
    const container = containerRef.current
    if (!canvas || !container) return null
    const rect = container.getBoundingClientRect()
    if (!imgSize.current) return null
    const { w, h } = imgSize.current
    const scaleX = w / rect.width
    const scaleY = h / rect.height
    return {
      x: Math.round((clientX - rect.left) * scaleX),
      y: Math.round((clientY - rect.top) * scaleY),
    }
  }

  const baseImgRef = useRef<HTMLImageElement | null>(null)

  const redrawDisplay = () => {
    const mask = maskRef.current
    const display = displayRef.current
    const base = baseImgRef.current
    if (!mask || !display || !base) return
    const dCtx = display.getContext('2d')
    if (!dCtx) return
    dCtx.drawImage(base, 0, 0)
    dCtx.globalCompositeOperation = 'destination-out'
    dCtx.drawImage(mask, 0, 0)
    dCtx.globalCompositeOperation = 'source-over'
  }

  const drawStroke = (x: number, y: number) => {
    const mask = maskRef.current
    if (!mask) return
    const mCtx = mask.getContext('2d')
    if (!mCtx) return
    mCtx.globalCompositeOperation = 'source-over'
    mCtx.fillStyle = 'rgba(255,255,255,0.9)'
    mCtx.beginPath()
    mCtx.arc(x, y, brushSize / 2, 0, Math.PI * 2)
    mCtx.fill()
    redrawDisplay()
    const dataUrl = mask.toDataURL('image/png')
    if (dataUrl && dataUrl.length > 100) onMaskChange(dataUrl)
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const pos = toCanvasCoords(e.clientX, e.clientY)
    if (pos) {
      const mask = maskRef.current
      if (mask) {
        const prev = mask.toDataURL('image/png')
        maskHistoryRef.current.push(prev)
        setCanUndo(true)
      }
      setDrawing(true)
      lastPos.current = pos
      drawStroke(pos.x, pos.y)
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!drawing) return
    const pos = toCanvasCoords(e.clientX, e.clientY)
    if (pos) {
      const prev = lastPos.current
      const mask = maskRef.current
      if (mask && prev) {
        const mCtx = mask.getContext('2d')
        if (mCtx) {
          mCtx.globalCompositeOperation = 'source-over'
          mCtx.strokeStyle = 'rgba(255,255,255,0.9)'
          mCtx.lineWidth = brushSize
          mCtx.lineCap = 'round'
          mCtx.beginPath()
          mCtx.moveTo(prev.x, prev.y)
          mCtx.lineTo(pos.x, pos.y)
          mCtx.stroke()
          redrawDisplay()
        }
      }
      lastPos.current = pos
      const dataUrl = maskRef.current?.toDataURL('image/png')
      if (dataUrl && dataUrl.length > 100) onMaskChange(dataUrl)
    }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId)
    setDrawing(false)
    lastPos.current = null
  }

  const clearMask = () => {
    const mask = maskRef.current
    if (mask) {
      const mCtx = mask.getContext('2d')
      if (mCtx) mCtx.clearRect(0, 0, mask.width, mask.height)
    }
    maskHistoryRef.current = []
    setCanUndo(false)
    onMaskChange(null)
    redrawDisplay()
  }

  const undoStroke = () => {
    const hist = maskHistoryRef.current
    if (hist.length === 0) return
    const prev = hist.pop()!
    setCanUndo(hist.length > 0)
    const mask = maskRef.current
    if (!mask) return
    const img = new Image()
    img.onload = () => {
      const mCtx = mask.getContext('2d')
      if (mCtx) {
        mCtx.clearRect(0, 0, mask.width, mask.height)
        mCtx.drawImage(img, 0, 0)
      }
      redrawDisplay()
      onMaskChange(prev.length > 100 ? prev : null)
    }
    img.src = prev
  }

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      const w = img.width
      const h = img.height
      imgSize.current = { w, h }
      baseImgRef.current = img
      const mask = maskRef.current
      const display = displayRef.current
      if (mask && display) {
        mask.width = w
        mask.height = h
        display.width = w
        display.height = h
        mask.getContext('2d')?.clearRect(0, 0, w, h)
        maskHistoryRef.current = []
        setCanUndo(false)
        onMaskChange(null)
        redrawDisplay()
      }
    }
    img.src = imageDataUrl
  }, [imageDataUrl])

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>画笔粗细</Text>
        <Slider
          min={4}
          max={80}
          value={brushSize}
          onChange={setBrushSize}
          style={{ width: 120 }}
        />
        <Button size="small" icon={<UndoOutlined />} onClick={undoStroke} disabled={!canUndo}>
          撤回
        </Button>
        <Button size="small" onClick={clearMask}>
          清除画笔
        </Button>
        <Text type="secondary" style={{ fontSize: 11 }}>在预览上涂抹需要擦除的区域</Text>
      </div>
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          maxWidth: '100%',
          overflow: 'auto',
          border: '1px solid #9a8b78',
          borderRadius: 4,
          cursor: 'crosshair',
        }}
      >
        <canvas
          ref={displayRef}
          style={{ width: '100%', height: 'auto', display: 'block', verticalAlign: 'bottom' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
        <canvas
          ref={maskRef}
          style={{ position: 'absolute', left: -9999, top: 0, pointerEvents: 'none' }}
        />
      </div>
    </div>
  )
}

export default function ParamsStep({ file, params, onParamsChange }: Props) {
  const { t } = useLanguage()
  const [form] = Form.useForm()
  const fps = Form.useWatch('fps', form) ?? params.fps ?? 12
  const maxFrames = Form.useWatch('max_frames', form) ?? params.max_frames ?? 300
  const columns = Form.useWatch('columns', form) ?? params.columns ?? 12
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [range, setRange] = useState<[number, number]>([
    params.frame_range?.start_sec ?? 0,
    params.frame_range?.end_sec ?? 5,
  ])
  const [autoReplay, setAutoReplay] = useState(false)
  const rangeRef = useRef(range)
  rangeRef.current = range

  const [extractedFrames, setExtractedFrames] = useState<{ blob: Blob; dataUrl: string; timestamp: number }[]>([])
  const [duplicateMarkers, setDuplicateMarkers] = useState<Map<number, { groupId: number; totalInGroup: number }>>(new Map())
  const [frameSelected, setFrameSelected] = useState<boolean[]>([])
  const [extracting, setExtracting] = useState(false)
  const [extractProgress, setExtractProgress] = useState(0)
  const [videoSize, setVideoSize] = useState<{ w: number; h: number } | null>(null)
  const [extractedFrameSize, setExtractedFrameSize] = useState<{ w: number; h: number } | null>(null)
  const [mattedFrames, setMattedFrames] = useState<{ blob: Blob; dataUrl: string }[]>([])
  const [matting, setMatting] = useState(false)
  const [mattingProgress, setMattingProgress] = useState(0)
  const [bgColor, setBgColor] = useState('#ffffff')
  const [matteTolerance, setMatteTolerance] = useState(40)
  const [matteFeather, setMatteFeather] = useState(10)
  const [cropRegion, setCropRegion] = useState({ left: 0, top: 0, right: 0, bottom: 0 })
  const [cropPreviewFrame, setCropPreviewFrame] = useState<string | null>(null)

  const captureCropPreviewFrame = () => {
    const video = videoRef.current
    if (!video || !videoSize || video.videoWidth === 0) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    setCropPreviewFrame(canvas.toDataURL('image/png'))
  }

  const openCropEditor = () => {
    const video = videoRef.current
    if (!video || !videoUrl) {
      message.warning(t('videoNotLoaded'))
      return
    }
    video.pause()
    video.currentTime = range[0]
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked)
      captureCropPreviewFrame()
    }
    video.addEventListener('seeked', onSeeked, { once: true })
  }

  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setVideoUrl(url)
    setCropRegion({ left: 0, top: 0, right: 0, bottom: 0 })
    setCropPreviewFrame(null)
    setExtractedFrameSize(null)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const onVideoLoaded = () => {
    const video = videoRef.current
    if (!video) return
    const d = video.duration
    if (isFinite(d) && d > 0) {
      setDuration(d)
      setVideoSize({ w: video.videoWidth, h: video.videoHeight })
      const end = params.frame_range?.end_sec
      const start = params.frame_range?.start_sec ?? 0
      setRange([
        Math.min(start, d),
        end && end <= d ? end : d,
      ])
      form.setFieldsValue({
        start_sec: Math.min(start, d),
        end_sec: end && end <= d ? end : d,
      })
    }
  }

  const handleRangeChange = (val: number | number[]) => {
    const [a, b] = Array.isArray(val) ? val : [val, val]
    const [prevA, prevB] = rangeRef.current
    setRange([a, b])
    form.setFieldsValue({ start_sec: a, end_sec: b })
    const video = videoRef.current
    if (video) {
      if (a !== prevA) video.currentTime = a
      else if (b !== prevB) video.currentTime = b
    }
  }

  const replayFromStart = () => {
    const video = videoRef.current
    if (video) {
      video.currentTime = range[0]
      video.play()
    }
  }

  const onVideoTimeUpdate = () => {
    if (!autoReplay) return
    const video = videoRef.current
    if (!video) return
    const [start, end] = rangeRef.current
    if (end > start && video.currentTime >= end - 0.05) {
      video.currentTime = start
      video.play()
    }
  }

  const [exporting, setExporting] = useState(false)
  const [exportedPreview, setExportedPreview] = useState<{
    rawPngBlob: Blob
    index: object
    composeParams: { targetW: number; targetH: number; padding: number; spacing: number; columns: number; timestamps: number[] }
  } | null>(null)
  const [strokeProgress, setStrokeProgress] = useState(0)
  const [exportFileName, setExportFileName] = useState('sprite_sheet')
  const [strokeWidth, setStrokeWidth] = useState(0)
  const [strokeColor, setStrokeColor] = useState('#000000')
  const [displayPngUrl, setDisplayPngUrl] = useState<string | null>(null)
  const [displayedPngBlob, setDisplayedPngBlob] = useState<Blob | null>(null)
  const [strokeApplying, setStrokeApplying] = useState(false)

  useEffect(() => {
    if (mattedFrames.length > 0) {
      const cols = Math.min(12, Math.max(4, Math.ceil(Math.sqrt(mattedFrames.length))))
      form.setFieldsValue({ columns: cols, padding: 4, spacing: 4 })
    }
  }, [mattedFrames.length, form])

  useEffect(() => {
    return () => {
      if (displayPngUrl) URL.revokeObjectURL(displayPngUrl)
    }
  }, [displayPngUrl])

  const exportSpriteSheet = async () => {
    if (mattedFrames.length === 0) return
    const targetW = form.getFieldValue('target_w') ?? videoSize?.w ?? 256
    const targetH = form.getFieldValue('target_h') ?? videoSize?.h ?? 256
    const padding = form.getFieldValue('padding') ?? 4
    const spacing = form.getFieldValue('spacing') ?? 4
    const columns = form.getFieldValue('columns') ?? 12
    const timestamps = selectedFrameIndices.map((idx) => extractedFrames[idx]?.timestamp ?? 0)
    setExporting(true)
    setExportedPreview(null)
    setDisplayPngUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setDisplayedPngBlob(null)
    try {
      const { pngBlob: rawBlob, index } = await composeSpriteSheetClient(
        mattedFrames,
        timestamps,
        targetW,
        targetH,
        padding,
        spacing,
        columns,
        resizeFrameToCanvas
      )
      setExportedPreview({
        rawPngBlob: rawBlob,
        index,
        composeParams: { targetW, targetH, padding, spacing, columns, timestamps },
      })
      setDisplayedPngBlob(rawBlob)
      setDisplayPngUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return URL.createObjectURL(rawBlob)
      })
      message.success(t('exportSuccess'))
    } catch (e) {
      message.error(t('exportFailed') + ': ' + formatError(e, t))
    } finally {
      setExporting(false)
    }
  }

  const applyStrokeAndGenerate = async () => {
    if (!exportedPreview?.rawPngBlob) return
    setStrokeApplying(true)
    setStrokeProgress(0)
    try {
      let blob: Blob
      if (strokeWidth > 0 && exportedPreview.composeParams && mattedFrames.length > 0) {
        const { targetW, targetH, padding, spacing, columns, timestamps } = exportedPreview.composeParams
        const CONCURRENCY = 4
        const strokedFrames: { blob: Blob; dataUrl: string }[] = new Array(mattedFrames.length)
        const urlsToRevoke: string[] = []
        for (let i = 0; i < mattedFrames.length; i += CONCURRENCY) {
          const batch = mattedFrames.slice(i, i + CONCURRENCY).map(async (f) => {
            const resized = await resizeFrameToBlob(f.blob, targetW, targetH, padding)
            return applyInnerStroke(resized, strokeWidth, strokeColor)
          })
          const results = await Promise.all(batch)
          for (let j = 0; j < results.length; j++) {
            const strokedBlob = results[j]!
            const dataUrl = URL.createObjectURL(strokedBlob)
            urlsToRevoke.push(dataUrl)
            strokedFrames[i + j] = { blob: strokedBlob, dataUrl }
          }
          setStrokeProgress(Math.round(((Math.min(i + CONCURRENCY, mattedFrames.length)) / mattedFrames.length) * 100))
        }
        const { pngBlob } = await composeSpriteSheetClient(
          strokedFrames,
          timestamps,
          targetW,
          targetH,
          padding,
          spacing,
          columns,
          resizeFrameToCanvas
        )
        urlsToRevoke.forEach(URL.revokeObjectURL)
        blob = pngBlob
      } else {
        blob = strokeWidth > 0
          ? await applyInnerStroke(exportedPreview.rawPngBlob, strokeWidth, strokeColor)
          : exportedPreview.rawPngBlob
      }
      setDisplayedPngBlob(blob)
      setDisplayPngUrl((old) => {
        if (old) URL.revokeObjectURL(old)
        return URL.createObjectURL(blob)
      })
      message.success(strokeWidth > 0 ? t('applyStrokeSuccess') : t('revertSuccess'))
    } catch (e) {
      message.error(t('strokeApplyFailed') + ': ' + formatError(e, t))
    } finally {
      setStrokeApplying(false)
      setStrokeProgress(0)
    }
  }

  const sanitizeFileName = (s: string) => s.replace(/[<>:"/\\|?*]/g, '_').trim() || 'sprite_sheet'

  const [downloading, setDownloading] = useState<'zip' | 'png' | null>(null)
  const downloadExportedZip = async () => {
    if (!exportedPreview?.rawPngBlob || !displayedPngBlob) return
    setDownloading('zip')
    const hide = message.loading(t('packing'), 0)
    try {
      const zip = new JSZip()
      zip.file('sprite.png', displayedPngBlob)
      zip.file('index.json', new Blob([JSON.stringify(exportedPreview.index, null, 2)], { type: 'application/json' }))
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const name = sanitizeFileName(exportFileName)
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${name}.zip`
      a.click()
      URL.revokeObjectURL(url)
      message.success(t('downloadZipStarted'))
    } finally {
      hide()
      setDownloading(null)
    }
  }

  const downloadExportedPng = async () => {
    if (!displayedPngBlob) return
    setDownloading('png')
    const hide = () => {}
    try {
      const name = sanitizeFileName(exportFileName)
      const url = URL.createObjectURL(displayedPngBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${name}.png`
      a.click()
      URL.revokeObjectURL(url)
      message.success(t('downloadPngStarted'))
    } finally {
      hide()
      setDownloading(null)
    }
  }

  const syncRangeFromForm = (all?: { start_sec?: number; end_sec?: number }) => {
    const start = all?.start_sec ?? form.getFieldValue('start_sec') ?? 0
    const end = all?.end_sec ?? form.getFieldValue('end_sec') ?? duration
    const max = duration || 9999
    const s = Math.max(0, Math.min(start, max))
    const e = Math.max(s, Math.min(end, max))
    setRange([s, e])
  }

  const maxSlider = duration > 0 ? duration : 300

  const expectedFrameCount = range[1] > range[0]
    ? Math.min(Math.ceil((range[1] - range[0]) * fps), maxFrames)
    : 0

  const extractFrames = async () => {
    const video = videoRef.current
    if (!video || !videoUrl || range[1] <= range[0]) {
      message.warning(t('selectValidRange'))
      return
    }
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      message.warning(t('videoNotReady'))
      return
    }
    setExtracting(true)
    setExtractedFrames([])
    setExtractedFrameSize(null)
    setDuplicateMarkers(new Map())
    setExtractProgress(0)

    const interval = 1 / fps
    const timestamps: number[] = []
    let ts = range[0]
    while (ts < range[1] && timestamps.length < maxFrames) {
      timestamps.push(ts)
      ts += interval
    }

    const vw = video.videoWidth
    const vh = video.videoHeight
    const { left, top, right, bottom } = cropRegion
    const cropW = Math.max(1, vw - left - right)
    const cropH = Math.max(1, vh - top - bottom)

    const frames: { blob: Blob; dataUrl: string; timestamp: number }[] = []
    const canvas = document.createElement('canvas')
    canvas.width = cropW
    canvas.height = cropH
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      message.error(t('canvasCreateFailed'))
      setExtracting(false)
      return
    }

    const seekAndCapture = (ts: number): Promise<{ blob: Blob; dataUrl: string }> =>
      new Promise((resolve, reject) => {
        const doCapture = () => {
          try {
            ctx.drawImage(video, left, top, cropW, cropH, 0, 0, cropW, cropH)
            const dataUrl = canvas.toDataURL('image/png')
            canvas.toBlob(
              (blob) => {
                if (blob && blob.size > 0) {
                  resolve({ blob, dataUrl })
                } else {
                  reject(new Error('ERR_TOBLOB'))
                }
              },
              'image/png',
              0.95
            )
          } catch (e) {
            reject(e)
          }
        }
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked)
          video.removeEventListener('error', onError)
          requestAnimationFrame(() => {
            requestAnimationFrame(doCapture)
          })
        }
        const onError = () => {
          video.removeEventListener('seeked', onSeeked)
          video.removeEventListener('error', onError)
          reject(new Error('ERR_VIDEO_SEEK'))
        }
        video.addEventListener('seeked', onSeeked, { once: true })
        video.addEventListener('error', onError, { once: true })
        video.currentTime = ts
      })

    try {
      video.pause()
      await new Promise<void>((resolve) => {
        const onLoaded = () => {
          video.removeEventListener('loadeddata', onLoaded)
          resolve()
        }
        if (video.readyState >= 2) resolve()
        else video.addEventListener('loadeddata', onLoaded, { once: true })
      })

      for (let i = 0; i < timestamps.length; i++) {
        const { blob, dataUrl } = await seekAndCapture(timestamps[i])
        frames.push({ blob, dataUrl, timestamp: timestamps[i] })
        setExtractProgress(Math.round(((i + 1) / timestamps.length) * 100))
      }
      setExtractedFrames(frames)
      setFrameSelected(frames.map(() => true))
      setExtractedFrameSize({ w: cropW, h: cropH })
      setMattedFrames([])
      setMattePreviewUrl(null)
      const markers = await analyzeDuplicateFrames(frames)
      setDuplicateMarkers(markers)
      const dupCount = markers.size
      if (dupCount > 0) {
        const groupCount = new Set([...markers.values()].map((v) => v.groupId)).size
        message.success(t('extractSuccessDup', { n: frames.length, dup: dupCount, groups: groupCount }))
      } else {
        message.success(t('extractSuccess', { n: frames.length }))
      }
    } catch (e) {
      message.error(t('extractFailed') + ': ' + formatError(e, t))
    } finally {
      setExtracting(false)
    }
  }

  const selectedFrameIndices = extractedFrames.map((_, i) => i).filter((i) => frameSelected[i])
  const previewFrameIndex = selectedFrameIndices[0] ?? 0
  const previewFrame = extractedFrames[previewFrameIndex]
  const [mattePreviewUrl, setMattePreviewUrl] = useState<string | null>(null)
  const [brushMaskDataUrl, setBrushMaskDataUrl] = useState<string | null>(null)
  const [mattePreviewBgSolid, setMattePreviewBgSolid] = useState(false)

  const runMattePreview = async () => {
    if (!previewFrame || !bgColor) return
    const m = bgColor.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
    if (!m) return
    const bgR = parseInt(m[1], 16)
    const bgG = parseInt(m[2], 16)
    const bgB = parseInt(m[3], 16)
    try {
      const { dataUrl } = await applyChromaKey(
        previewFrame.dataUrl,
        bgR, bgG, bgB,
        matteTolerance,
        matteFeather
      )
      setMattePreviewUrl(dataUrl)
      setBrushMaskDataUrl(null)
    } catch {
      setMattePreviewUrl(null)
    }
  }

  const startMatting = async () => {
    if (selectedFrameIndices.length === 0) {
      message.warning(t('selectFrameForMatte'))
      return
    }
    const m = bgColor.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
    if (!m) {
      message.warning(t('selectBgColor'))
      return
    }
    const bgR = parseInt(m[1], 16)
    const bgG = parseInt(m[2], 16)
    const bgB = parseInt(m[3], 16)
    setMatting(true)
    setMattedFrames([])
    setMattingProgress(0)
    const results: { blob: Blob; dataUrl: string }[] = []
    try {
      for (let i = 0; i < selectedFrameIndices.length; i++) {
        const idx = selectedFrameIndices[i]
        const frame = extractedFrames[idx]
        let r = await applyChromaKey(frame.dataUrl, bgR, bgG, bgB, matteTolerance, matteFeather)
        if (brushMaskDataUrl) {
          r = await applyBrushMask(r.dataUrl, brushMaskDataUrl)
        }
        results.push(r)
        setMattingProgress(Math.round(((i + 1) / selectedFrameIndices.length) * 100))
      }
      setMattedFrames(results)
      const frameSize = extractedFrameSize ?? videoSize
      if (frameSize && results.length > 0) {
        form.setFieldsValue({ target_w: frameSize.w, target_h: frameSize.h })
      }
      message.success(t('matteSuccess', { n: results.length }))
    } catch (e) {
      message.error(t('matteFailed') + ': ' + formatError(e, t))
    } finally {
      setMatting(false)
    }
  }

  const downloadMattedZip = async () => {
    if (mattedFrames.length === 0) return
    const zip = new JSZip()
    const folder = zip.folder('matted_frames')
    if (!folder) return
    mattedFrames.forEach(({ blob }, i) => {
      folder.file(`matte_${String(i + 1).padStart(5, '0')}.png`, blob)
    })
    const content = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(content)
    const a = document.createElement('a')
    a.href = url
    a.download = 'matted_frames.zip'
    a.click()
    URL.revokeObjectURL(url)
    message.success(t('downloadStarted'))
  }

  const downloadFramesZip = async () => {
    if (extractedFrames.length === 0) {
      message.warning(t('extractFrameFirst'))
      return
    }
    const zip = new JSZip()
    const folder = zip.folder('frames')
    if (!folder) return
    extractedFrames.forEach(({ blob }, i) => {
      folder.file(`frame_${String(i + 1).padStart(5, '0')}.png`, blob)
    })
    const content = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(content)
    const a = document.createElement('a')
    a.href = url
    a.download = 'frames.zip'
    a.click()
    URL.revokeObjectURL(url)
    message.success(t('downloadStarted'))
  }

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        fps: params.fps ?? 12,
        start_sec: params.frame_range?.start_sec ?? 0,
        end_sec: params.frame_range?.end_sec ?? 5,
        max_frames: params.max_frames ?? 300,
        target_w: params.target_size?.w ?? 256,
        target_h: params.target_size?.h ?? 256,
        transparent: params.transparent ?? true,
        padding: params.padding ?? 4,
        spacing: params.spacing ?? 4,
        layout_mode: params.layout_mode ?? 'fixed_columns',
        columns: params.columns ?? 12,
        matte_strength: (params.matte_strength ?? 0.6) * 100,
        crop_mode: params.crop_mode ?? 'tight_bbox',
      }}
      onValuesChange={(changed, all) => {
        if ('start_sec' in changed || 'end_sec' in changed) syncRangeFromForm(all)
        const v = all as Record<string, unknown>
        onParamsChange({
          fps: (v.fps as number) ?? 12,
          frame_range: { start_sec: (v.start_sec as number) ?? 0, end_sec: (v.end_sec as number) || undefined },
          max_frames: (v.max_frames as number) ?? 300,
          target_size: { w: (v.target_w as number) ?? 256, h: (v.target_h as number) ?? 256 },
          transparent: (v.transparent as boolean) ?? true,
          padding: (v.padding as number) ?? 4,
          spacing: (v.spacing as number) ?? 4,
          layout_mode: (v.layout_mode as 'fixed_columns' | 'auto_square') ?? 'fixed_columns',
          columns: (v.columns as number) ?? 12,
          matte_strength: ((v.matte_strength as number) ?? 60) / 100,
          crop_mode: (v.crop_mode as 'none' | 'tight_bbox' | 'safe_bbox') ?? 'tight_bbox',
        })
      }}
    >
    <div style={{ paddingTop: 8 }}>
      {file && videoUrl && (
        <>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>视频预览与时间范围</Text>
          <div
            style={{
              background: '#2c2520',
              borderRadius: 8,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              style={{ width: '100%', maxHeight: 280, display: 'block' }}
              onLoadedMetadata={onVideoLoaded}
              onTimeUpdate={onVideoTimeUpdate}
            />
            <div style={{ padding: '12px 16px', background: '#3d3430' }}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                {t('timeSliderHint')}
              </Text>
              <Slider
                range
                min={0}
                max={maxSlider}
                step={fps > 0 ? Math.min(0.05, 1 / fps) : 0.05}
                value={range}
                onChange={handleRangeChange}
                tooltip={{ formatter: (v) => formatTime(Number(v)) }}
              />
              <Space style={{ marginTop: 8 }} wrap>
                <Button size="small" type="primary" icon={<ReloadOutlined />} onClick={replayFromStart}>
                  {t('replay')}
                </Button>
                <Button
                  size="small"
                  type={autoReplay ? 'primary' : 'default'}
                  icon={<RetweetOutlined />}
                  onClick={() => setAutoReplay((v) => !v)}
                >
                  {t('autoReplay')}
                </Button>
                <Text type="secondary">
                  {formatTime(range[0])} — {formatTime(range[1])}{' '}
                  {duration > 0 && `(${t('totalLength')} ${formatTime(duration)})`}
                </Text>
                {range[1] > range[0] && (
                  <Text type="secondary">
                    {t('duration')} {(range[1] - range[0]).toFixed(1)} {t('seconds')}
                    · {t('approxFrames', { n: Math.min(Math.ceil((range[1] - range[0]) * fps), maxFrames) })}
                  </Text>
                )}
              </Space>
            </div>
          </div>

          <Divider style={{ margin: '20px 0 16px' }} />

          <Row gutter={24} align="top">
            <Col xs={24} md={videoSize && mattedFrames.length === 0 ? 14 : 24}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>{t('extractFrames')}</Text>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
                {t('extractHint')}
                {videoSize && ` · ${t('originalRes')} ${videoSize.w}×${videoSize.h}`}
                {expectedFrameCount > 0 && ` · ${t('expectedFrames', { n: expectedFrameCount })}`}
              </Text>
              {videoSize && (
            <div
              style={{
                marginBottom: 16,
                padding: 12,
                background: '#e4dbcf',
                borderRadius: 8,
                border: '1px solid #b8a898',
              }}
            >
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                {t('cropHint')}
              </Text>
              <Space style={{ marginBottom: 8 }} wrap>
                <Button size="small" type="primary" icon={<ExpandOutlined />} onClick={openCropEditor}>
                  {t('cropManual')}
                </Button>
                {cropPreviewFrame && (
                  <Button size="small" onClick={() => setCropPreviewFrame(null)}>
                    {t('cropClose')}
                  </Button>
                )}
              </Space>
              {cropPreviewFrame && videoSize ? (
                <>
                  <CropCanvasEditor
                    imageDataUrl={cropPreviewFrame}
                    videoSize={videoSize}
                    cropRegion={cropRegion}
                    onChange={setCropRegion}
                  />
                  <Row gutter={12} style={{ marginTop: 12 }}>
                    <Col span={6}>
                      <InputNumber
                        size="small"
                        min={0}
                        max={Math.max(0, videoSize.w - 1)}
                        value={cropRegion.left}
                        onChange={(v) => setCropRegion((r) => ({ ...r, left: v ?? 0 }))}
                        style={{ width: '100%' }}
                        addonBefore={t('left')}
                      />
                    </Col>
                    <Col span={6}>
                      <InputNumber
                        size="small"
                        min={0}
                        max={Math.max(0, videoSize.h - 1)}
                        value={cropRegion.top}
                        onChange={(v) => setCropRegion((r) => ({ ...r, top: v ?? 0 }))}
                        style={{ width: '100%' }}
                        addonBefore={t('top')}
                      />
                    </Col>
                    <Col span={6}>
                      <InputNumber
                        size="small"
                        min={0}
                        max={Math.max(0, videoSize.w - cropRegion.left - 1)}
                        value={cropRegion.right}
                        onChange={(v) => setCropRegion((r) => ({ ...r, right: v ?? 0 }))}
                        style={{ width: '100%' }}
                        addonBefore={t('right')}
                      />
                    </Col>
                    <Col span={6}>
                      <InputNumber
                        size="small"
                        min={0}
                        max={Math.max(0, videoSize.h - cropRegion.top - 1)}
                        value={cropRegion.bottom}
                        onChange={(v) => setCropRegion((r) => ({ ...r, bottom: v ?? 0 }))}
                        style={{ width: '100%' }}
                        addonBefore={t('bottom')}
                      />
                    </Col>
                  </Row>
                </>
              ) : (
                <Row gutter={12}>
                  <Col span={6}>
                    <InputNumber
                      min={0}
                      max={Math.max(0, videoSize.w - 1)}
                      value={cropRegion.left}
                      onChange={(v) => setCropRegion((r) => ({ ...r, left: v ?? 0 }))}
                      style={{ width: '100%' }}
                      addonBefore={t('left')}
                    />
                  </Col>
                  <Col span={6}>
                    <InputNumber
                      min={0}
                      max={Math.max(0, videoSize.h - 1)}
                      value={cropRegion.top}
                      onChange={(v) => setCropRegion((r) => ({ ...r, top: v ?? 0 }))}
                      style={{ width: '100%' }}
                      addonBefore={t('top')}
                    />
                  </Col>
                  <Col span={6}>
                    <InputNumber
                      min={0}
                      max={Math.max(0, videoSize.w - cropRegion.left - 1)}
                      value={cropRegion.right}
                      onChange={(v) => setCropRegion((r) => ({ ...r, right: v ?? 0 }))}
                      style={{ width: '100%' }}
                      addonBefore={t('right')}
                    />
                  </Col>
                  <Col span={6}>
                    <InputNumber
                      min={0}
                      max={Math.max(0, videoSize.h - cropRegion.top - 1)}
                      value={cropRegion.bottom}
                      onChange={(v) => setCropRegion((r) => ({ ...r, bottom: v ?? 0 }))}
                      style={{ width: '100%' }}
                      addonBefore={t('bottom')}
                    />
                  </Col>
                </Row>
              )}
              {(cropRegion.left > 0 || cropRegion.top > 0 || cropRegion.right > 0 || cropRegion.bottom > 0) && (
                <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
                  {t('cropResultSize')}: {videoSize.w - cropRegion.left - cropRegion.right} × {videoSize.h - cropRegion.top - cropRegion.bottom}
                </Text>
              )}
              {(cropRegion.left > 0 || cropRegion.top > 0 || cropRegion.right > 0 || cropRegion.bottom > 0) && (
                <Button
                  size="small"
                  type="link"
                  style={{ padding: 0, marginTop: 4 }}
                  onClick={() => setCropRegion({ left: 0, top: 0, right: 0, bottom: 0 })}
                >
                  {t('resetCrop')}
                </Button>
              )}
            </div>
          )}
          <Space wrap style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              loading={extracting}
              onClick={extractFrames}
              disabled={expectedFrameCount === 0}
            >
                {t('extract')}
            </Button>
            {extractedFrames.length > 0 && (
              <Button
                type="default"
                icon={<DownloadOutlined />}
                onClick={downloadFramesZip}
              >
                {t('downloadExtractedFrames', { n: extractedFrames.length })}
              </Button>
            )}
          </Space>
          {extracting && (
            <Progress percent={extractProgress} size="small" style={{ marginBottom: 16 }} />
          )}
            </Col>
            {videoSize && mattedFrames.length === 0 && (
              <Col xs={24} md={10}>
                <div style={{ padding: 16, border: '1px solid #9a8b78', borderRadius: 8, background: '#e4dbcf' }}>
                  <Text strong style={{ display: 'block', marginBottom: 12 }}>{t('exportParams')}</Text>
                  <Form.Item name="fps" label={t('targetFps')} rules={[{ required: true }]} style={{ marginBottom: 12 }}>
                    <InputNumber min={1} max={60} style={{ width: '100%' }} />
                  </Form.Item>
                  <Row gutter={8}>
                    <Col span={12}>
                      <Form.Item name="start_sec" label={t('startTime')} style={{ marginBottom: 12 }}>
                        <InputNumber
                          min={0}
                          max={duration || 9999}
                          step={0.1}
                          style={{ width: '100%' }}
                          onChange={() => setTimeout(() => syncRangeFromForm(), 0)}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="end_sec" label={t('endTime')} style={{ marginBottom: 12 }}>
                        <InputNumber
                          min={0}
                          max={duration || 9999}
                          step={0.1}
                          style={{ width: '100%' }}
                          onChange={() => setTimeout(() => syncRangeFromForm(), 0)}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="max_frames" label={t('maxFrames')} rules={[{ required: true }]} style={{ marginBottom: 12 }}>
                    <InputNumber min={1} max={2000} style={{ width: '100%' }} />
                  </Form.Item>
                </div>
              </Col>
            )}
          </Row>
          {extractedFrames.length > 0 && !extracting && (
            <>
              <Space style={{ marginBottom: 8 }} wrap>
                <Text strong>{t('selectFrames')} ({frameSelected.filter(Boolean).length}/{extractedFrames.length})</Text>
                <Button size="small" type="link" onClick={() => setFrameSelected(extractedFrames.map(() => true))}>
                  {t('selectAll')}
                </Button>
                <Button size="small" type="link" onClick={() => setFrameSelected(extractedFrames.map(() => false))}>
                  {t('selectNone')}
                </Button>
              </Space>
              <FrameThumbnails
                frames={extractedFrames}
                selected={frameSelected}
                onSelectionChange={(i, checked) => {
                  setFrameSelected((prev) => {
                    const next = [...prev]
                    next[i] = checked
                    return next
                  })
                }}
                duplicateMarkers={duplicateMarkers}
              />
              <FrameAnimationPreview
                frames={extractedFrames}
                selected={frameSelected}
                fps={fps}
                onRemoveFirstSelected={() => {
                  const indices = extractedFrames.map((_, i) => i).filter((i) => frameSelected[i])
                  if (indices.length === 0) return
                  const first = indices[0]!
                  setFrameSelected((prev) => {
                    const next = [...prev]
                    next[first] = false
                    return next
                  })
                }}
                onAddPrevBeforeFirst={() => {
                  const indices = extractedFrames.map((_, i) => i).filter((i) => frameSelected[i])
                  if (indices.length === 0) return
                  const first = indices[0]!
                  if (first <= 0) return
                  setFrameSelected((prev) => {
                    const next = [...prev]
                    next[first - 1] = true
                    return next
                  })
                }}
                onRemoveLastSelected={() => {
                  const indices = extractedFrames.map((_, i) => i).filter((i) => frameSelected[i])
                  if (indices.length === 0) return
                  const last = indices[indices.length - 1]!
                  setFrameSelected((prev) => {
                    const next = [...prev]
                    next[last] = false
                    return next
                  })
                }}
                onAddNextAfterLast={() => {
                  const indices = extractedFrames.map((_, i) => i).filter((i) => frameSelected[i])
                  if (indices.length === 0) return
                  const last = indices[indices.length - 1]!
                  if (last >= extractedFrames.length - 1) return
                  setFrameSelected((prev) => {
                    const next = [...prev]
                    next[last + 1] = true
                    return next
                  })
                }}
                onRangeSample={(start, end, step) => {
                  const indices = extractedFrames.map((_, i) => i).filter((i) => frameSelected[i])
                  if (indices.length === 0) return
                  const s = Math.max(1, Math.min(start, indices.length))
                  const e = Math.max(1, Math.min(end, indices.length))
                  const a = Math.min(s, e) - 1
                  const b = Math.max(s, e) - 1
                  const sliced = indices.slice(a, b + 1)
                  const sampled: number[] = []
                  for (let i = 0; i < sliced.length; i += Math.max(1, step)) sampled.push(sliced[i]!)
                  const toKeep = new Set(sampled)
                  setFrameSelected((prev) => prev.map((_, i) => toKeep.has(i)))
                }}
              />

              <Divider style={{ margin: '20px 0 16px' }} />

              <Text strong style={{ display: 'block', marginBottom: 8 }}>{t('matte')}</Text>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
                {t('matteHint')}
              </Text>
              <Radio.Group value="chromakey" style={{ marginBottom: 16 }}>
                <Radio value="chromakey">{t('chromaKeyMatte')}</Radio>
              </Radio.Group>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                <div style={{ flex: '1 1 200px', minWidth: 160 }}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>{t('bgColor')}</Text>
                  <ColorPicker
                    value={bgColor}
                    onChange={(_: unknown, hex: string) => setBgColor(hex || '#ffffff')}
                    showText
                  />
                </div>
                <div style={{ flex: '1 1 200px', minWidth: 160 }}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>{t('tolerance')}</Text>
                  <Slider min={1} max={100} value={matteTolerance} onChange={setMatteTolerance} />
                </div>
                <div style={{ flex: '1 1 200px', minWidth: 160 }}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>{t('featherEdge')}</Text>
                  <Slider min={0} max={30} value={matteFeather} onChange={setMatteFeather} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                <div
                  style={{ flex: 1, minWidth: 200, border: '1px solid #9a8b78', borderRadius: 8, overflow: 'hidden', padding: 8 }}
                >
                  <Text type="secondary" style={{ fontSize: 12 }}>{t('originalImageFirst')}</Text>
                  {previewFrame && (
                    <img
                      src={previewFrame.dataUrl}
                      alt={t('originalImage')}
                      style={{ width: '100%', display: 'block', marginTop: 8, cursor: 'crosshair' }}
                      onClick={(e) => {
                        const img = e.currentTarget
                        const rect = img.getBoundingClientRect()
                        const canvas = document.createElement('canvas')
                        canvas.width = img.naturalWidth
                        canvas.height = img.naturalHeight
                        const ctx = canvas.getContext('2d')
                        if (!ctx) return
                        const tempImg = new Image()
                        tempImg.onload = () => {
                          ctx.drawImage(tempImg, 0, 0)
                          const x = Math.floor(((e.clientX - rect.left) / rect.width) * img.naturalWidth)
                          const y = Math.floor(((e.clientY - rect.top) / rect.height) * img.naturalHeight)
                          const [r, g, b] = ctx.getImageData(x, y, 1, 1).data
                          setBgColor(`#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`)
                          message.success(t('pickedBgColor', { color: [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('') }))
                        }
                        tempImg.src = previewFrame.dataUrl
                      }}
                    />
                  )}
                </div>
                <div
                  style={{
                    flex: 1,
                    minWidth: 200,
                    border: '1px solid #9a8b78',
                    borderRadius: 8,
                    overflow: 'hidden',
                    padding: 8,
                    background: mattePreviewBgSolid ? '#a63d2e' : 'repeating-conic-gradient(#c9bfb0 0% 25%, #e4dbcf 0% 50%) 50% / 16px 16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>{t('mattePreview')}</Text>
                    {mattePreviewUrl && (
                      <Button
                        size="small"
                        type={mattePreviewBgSolid ? 'primary' : 'default'}
                        onClick={() => setMattePreviewBgSolid((v) => !v)}
                      >
                        {mattePreviewBgSolid ? t('gridBg') : t('solidBg')}
                      </Button>
                    )}
                  </div>
                  {mattePreviewUrl ? (
                    <MatteBrushEditor
                      imageDataUrl={mattePreviewUrl}
                      onMaskChange={setBrushMaskDataUrl}
                    />
                  ) : (
                    <div style={{ textAlign: 'center', padding: 40, color: '#6b5d4d' }}>
                      {t('mattePickColorHint')}
                    </div>
                  )}
                </div>
              </div>
              <Space wrap>
                <Button size="small" onClick={runMattePreview}>
                  {t('updatePreview')}
                </Button>
                <Button
                  type="primary"
                  loading={matting}
                  onClick={startMatting}
                  disabled={selectedFrameIndices.length === 0}
                >
                  {t('startMatteWithFrames', { n: selectedFrameIndices.length })}
                </Button>
              </Space>
              {matting && <Progress percent={mattingProgress} size="small" style={{ marginTop: 12 }} />}

              {mattedFrames.length > 0 && (
                <>
                  <Divider style={{ margin: '24px 0 16px' }} />
                  <Space style={{ marginBottom: 12 }} wrap>
                    <Text strong>{t('mattedFramesTitle', { n: mattedFrames.length })}</Text>
                    <Button type="primary" icon={<DownloadOutlined />} onClick={downloadMattedZip}>
                      {t('downloadMattedFrames', { n: mattedFrames.length })}
                    </Button>
                  </Space>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 8,
                      padding: 12,
                      background: '#e4dbcf',
                      borderRadius: 8,
                    }}
                  >
                    {mattedFrames.map((f, i) => (
                      <div
                        key={i}
                        style={{
                          width: 88,
                          border: '1px solid #9a8b78',
                          borderRadius: 6,
                          overflow: 'hidden',
                          background: 'repeating-conic-gradient(#b8a898 0% 25%, #ede6dc 0% 50%) 50% / 12px 12px',
                        }}
                      >
                        <img
                          src={f.dataUrl}
                          alt={`${t('matte')} ${i + 1}`}
                          style={{ width: '100%', height: 66, objectFit: 'contain', display: 'block' }}
                        />
                        <div style={{ background: '#2c2520', color: '#e8dcc8', fontSize: 11, padding: '2px 0', textAlign: 'center' }}>
                          {t('matteFrameN', { n: i + 1 })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          <Divider style={{ margin: '20px 0 16px' }} />
        </>
      )}

        {mattedFrames.length > 0 && (
          <Text strong style={{ display: 'block', marginBottom: 12 }}>{t('exportParams')}</Text>
        )}
        {mattedFrames.length > 0 && (() => {
          const frameSize = extractedFrameSize ?? videoSize ?? { w: 256, h: 256 }
          const aspectRatio = frameSize.w / frameSize.h
          const sizePresets = [64, 128, 256, 512].map((baseW) => [
            baseW,
            Math.max(32, Math.round(baseW / aspectRatio)),
          ] as [number, number])
          return (
            <div style={{ marginBottom: 24, padding: 16, border: '1px solid #9a8b78', borderRadius: 8, background: '#e4dbcf' }}>
                  <Text strong style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: 16 }}>⚙</span> {t('frameSize')}
              </Text>
              <Row gutter={24}>
                <Col xs={24} md={12}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>{t('customSize')}</Text>
                  <Form.Item noStyle name="target_w">
                    <InputNumber
                      min={32}
                      max={4096}
                      style={{ width: '100%', marginBottom: 8 }}
                      addonBefore={t('width')}
                      onChange={(w) => {
                        if (w && frameSize.h > 0) {
                          const ratio = frameSize.w / frameSize.h
                          form.setFieldsValue({ target_h: Math.round((w as number) / ratio) })
                        }
                      }}
                    />
                  </Form.Item>
                  <Form.Item noStyle name="target_h">
                    <InputNumber
                      min={32}
                      max={4096}
                      style={{ width: '100%' }}
                      addonBefore={t('height')}
                      onChange={(h) => {
                        if (h && frameSize.w > 0) {
                          const ratio = frameSize.w / frameSize.h
                          form.setFieldsValue({ target_w: Math.round((h as number) * ratio) })
                        }
                      }}
                    />
                  </Form.Item>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                    {t('singleFrameSize')}: {frameSize.w} × {frameSize.h}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                    {t('aspectRatio')}: {aspectRatio.toFixed(2)} : 1
                  </Text>
                  <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                    {t('aspectAuto')}
                  </Text>
                </Col>
                <Col xs={24} md={12}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>{t('sizePresets')}</Text>
                  <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 8 }}>
                    {t('aspectHint')}
                  </Text>
                  <Space wrap>
                    {sizePresets.map(([w, h]) => (
                      <Button
                        key={`${w}x${h}`}
                        type="primary"
                        ghost
                        style={{ borderColor: '#b55233', color: '#b55233' }}
                        onClick={() => form.setFieldsValue({ target_w: w, target_h: h })}
                      >
                        {w} × {h}
                      </Button>
                    ))}
                  </Space>
                  <div style={{ marginTop: 16 }}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>{t('layout')}</Text>
                    <Row gutter={8}>
                      <Col span={8}>
                        <Form.Item name="columns" style={{ marginBottom: 8 }}>
                          <InputNumber min={1} max={64} style={{ width: '100%' }} placeholder={t('colsPlaceholder')} />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name="padding" style={{ marginBottom: 8 }}>
                          <InputNumber min={0} max={64} style={{ width: '100%' }} placeholder={t('paddingPlaceholder')} />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name="spacing" style={{ marginBottom: 8 }}>
                          <InputNumber min={0} max={64} style={{ width: '100%' }} placeholder={t('spacingPlaceholder')} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {t('rowsCount')}: {Math.ceil(mattedFrames.length / columns)}
                    </Text>
                  </div>
                </Col>
              </Row>
              <Divider style={{ margin: '16px 0' }} />
              <Space>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  loading={exporting}
                  onClick={exportSpriteSheet}
                >
                  {t('exportSprite')}
                </Button>
              </Space>
              {exportedPreview && (
                <>
                  <Divider style={{ margin: '20px 0 12px' }} />
                  <Text strong style={{ display: 'block', marginBottom: 12 }}>{t('preview')}</Text>
                  <div
                    style={{
                      maxWidth: '100%',
                      overflow: 'auto',
                      marginBottom: 12,
                      border: '1px solid #9a8b78',
                      borderRadius: 8,
                      padding: 8,
                      background: '#e4dbcf',
                      position: 'relative',
                      minHeight: 120,
                    }}
                  >
                    {strokeApplying && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(228,219,207,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: 4 }}>
                        <Spin size="large" />
                        <Text type="secondary" style={{ marginTop: 8, fontSize: 12 }}>{t('extracting')}</Text>
                      </div>
                    )}
                    {displayPngUrl && (
                      <img
                        src={displayPngUrl}
                        alt="Sprite Sheet 预览"
                        style={{ maxWidth: '100%', height: 'auto', display: 'block', borderRadius: 4 }}
                      />
                    )}
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>{t('innerStroke')}</Text>
                    <Space wrap align="center">
                      <span style={{ fontSize: 12 }}>{t('strokeWidth')}</span>
                      <InputNumber
                        min={0}
                        max={16}
                        value={strokeWidth}
                        onChange={(v) => setStrokeWidth(Math.max(0, v ?? 0))}
                        style={{ width: 80 }}
                        addonAfter="px"
                      />
                      <span style={{ fontSize: 12 }}>{t('strokeColor')}</span>
                      <ColorPicker
                        value={strokeColor}
                        onChange={(_: unknown, hex: string) => setStrokeColor(hex || '#000000')}
                        showText
                      />
                      <Button
                        type="primary"
                        loading={strokeApplying}
                        onClick={applyStrokeAndGenerate}
                      >
                        {t('applyStroke')}
                      </Button>
                    </Space>
                    <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                      {t('strokeHint')}
                    </Text>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>{t('filename')}</Text>
                    <Input
                      value={exportFileName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExportFileName(e.target.value)}
                      placeholder="sprite_sheet"
                      style={{ width: 200 }}
                      addonAfter=".zip / .png"
                    />
                  </div>
                  <Space wrap>
                    <Button type="primary" icon={<DownloadOutlined />} loading={downloading === 'zip'} onClick={downloadExportedZip}>
                      {t('downloadZip')}
                    </Button>
                    <Button icon={<DownloadOutlined />} loading={downloading === 'png'} onClick={downloadExportedPng}>
                      {t('downloadPng')}
                    </Button>
                  </Space>
                </>
              )}
            </div>
          )
        })()}

      <Modal
        open={strokeApplying}
        footer={null}
        closable={false}
        maskClosable={false}
        centered
        width={340}
      >
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16, fontSize: 15 }}>{t('extracting')}</div>
          {strokeProgress > 0 && (
            <Progress percent={strokeProgress} size="small" style={{ marginTop: 12, maxWidth: 240, margin: '12px auto 0' }} />
          )}
          <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>{t('strokeWaitHint')}</div>
        </div>
      </Modal>
    </div>
    </Form>
  )
}
