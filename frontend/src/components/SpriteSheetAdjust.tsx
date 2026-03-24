import React, { forwardRef, useCallback, useEffect, useRef, useState } from 'react'
import { Button, Checkbox, ColorPicker, InputNumber, message, Progress, Segmented, Slider, Space, Typography, Upload } from 'antd'
// @ts-expect-error gifenc has no types
import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import { ArrowDownOutlined, ArrowLeftOutlined, ArrowRightOutlined, ArrowUpOutlined, MinusOutlined, PlusOutlined, StepBackwardOutlined, StepForwardOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import { useLanguage } from '../i18n/context'
import StashDropZone from './StashDropZone'

const { Dragger } = Upload
const { Text } = Typography

const IMAGE_ACCEPT = ['.png', '.jpg', '.jpeg', '.webp']
const IMAGE_MAX_MB = 20

type FrameOffset = { dx: number; dy: number }

const ShiftedFrameCanvas = forwardRef<HTMLCanvasElement | null, {
  src: string
  dx: number
  dy: number
  displayWidth?: number
  displayHeight?: number
  onSize?: (w: number, h: number) => void
  style?: React.CSSProperties
}>(function ShiftedFrameCanvas({
  src,
  dx,
  dy,
  displayWidth,
  displayHeight,
  onSize,
  style,
}, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const innerRef = (el: HTMLCanvasElement | null) => {
    (canvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = el
    if (typeof ref === 'function') ref(el)
    else if (ref) ref.current = el
  }

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      const canvas = canvasRef.current
      if (!canvas || !img.naturalWidth || !img.naturalHeight) return
      const w = img.naturalWidth
      const h = img.naturalHeight
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h, dx, dy, w, h)
      onSize?.(w, h)
    }
    img.src = src
    return () => {
      img.src = ''
    }
  }, [src, dx, dy, onSize])

  return (
    <canvas
      ref={innerRef}
      style={{
        width: displayWidth ? `${displayWidth}px` : '100%',
        height: displayHeight ? `${displayHeight}px` : '100%',
        maxWidth: '100%',
        maxHeight: '100%',
        minWidth: 0,
        minHeight: 0,
        objectFit: 'contain',
        imageRendering: 'pixelated',
        display: 'block',
        ...style,
      }}
    />
  )
})

function splitSpriteSheet(
  img: HTMLImageElement,
  cols: number,
  rows: number
): HTMLCanvasElement[] {
  const fullW = img.naturalWidth
  const fullH = img.naturalHeight
  const colsNum = Math.max(1, Math.floor(cols))
  const rowsNum = Math.max(1, Math.floor(rows))
  const results: HTMLCanvasElement[] = []

  for (let row = 0; row < rowsNum; row++) {
    for (let col = 0; col < colsNum; col++) {
      const sx = Math.floor((col * fullW) / colsNum)
      const ex = Math.floor(((col + 1) * fullW) / colsNum)
      const sy = Math.floor((row * fullH) / rowsNum)
      const ey = Math.floor(((row + 1) * fullH) / rowsNum)
      const w = Math.max(1, ex - sx)
      const h = Math.max(1, ey - sy)
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      c.getContext('2d')!.drawImage(img, sx, sy, w, h, 0, 0, w, h)
      results.push(c)
    }
  }
  return results
}

async function recombineFrames(
  frameUrls: string[],
  frameOffsets: FrameOffset[],
  cols: number,
  rows: number
): Promise<{ url: string; cellW: number; cellH: number }> {
  if (frameUrls.length === 0) throw new Error('No frames')
  const firstImg = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load frame'))
    img.src = frameUrls[0]!
  })
  const cellW = firstImg.naturalWidth
  const cellH = firstImg.naturalHeight
  const outW = cellW * cols
  const outH = cellH * rows
  const out = document.createElement('canvas')
  out.width = outW
  out.height = outH
  const ctx = out.getContext('2d')!
  for (let i = 0; i < frameUrls.length; i++) {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image()
      im.onload = () => resolve(im)
      im.onerror = () => reject(new Error('Failed to load frame'))
      im.src = frameUrls[i]!
    })
    const r = Math.floor(i / cols)
    const c = i % cols
    const dx = frameOffsets[i]?.dx ?? 0
    const dy = frameOffsets[i]?.dy ?? 0
    const tmp = document.createElement('canvas')
    tmp.width = cellW
    tmp.height = cellH
    const tctx = tmp.getContext('2d')!
    tctx.drawImage(img, 0, 0, cellW, cellH, dx, dy, cellW, cellH)
    ctx.drawImage(tmp, 0, 0, cellW, cellH, c * cellW, r * cellH, cellW, cellH)
  }
  return new Promise<{ url: string; cellW: number; cellH: number }>((resolve, reject) => {
    out.toBlob((b) => {
      if (b) resolve({ url: URL.createObjectURL(b), cellW, cellH })
      else reject(new Error('toBlob failed'))
    }, 'image/png')
  })
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('load'))
    img.src = src
  })
}

export default function SpriteSheetAdjust() {
  const { t } = useLanguage()
  const [file, setFile] = useState<File | null>(null)
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const [cols, setCols] = useState(8)
  const [rows, setRows] = useState(4)
  const [frameUrls, setFrameUrls] = useState<string[]>([])
  const [selected, setSelected] = useState<boolean[]>([])
  const frameDelay = 100
  const [playing, setPlaying] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [speedScale, setSpeedScale] = useState(1)
  const [previewZoom, setPreviewZoom] = useState(4)
  const [previewImgSize, setPreviewImgSize] = useState<{ w: number; h: number } | null>(null)
  const [previewBg, setPreviewBg] = useState<'checkered' | string>('#e4dbcf')
  const [previewBgColor, setPreviewBgColor] = useState('#e4dbcf')
  const [frameOffsets, setFrameOffsets] = useState<FrameOffset[]>([])
  const [fixedPixelMode, setFixedPixelMode] = useState(false)
  const [fixedPixelRange, setFixedPixelRange] = useState(1)
  type FixedPixelFix = { imgX: number; imgY: number; range: number; data: Uint8ClampedArray }
  const [fixedPixelFixes, setFixedPixelFixes] = useState<FixedPixelFix[]>([])
  const [mouseInPreview, setMouseInPreview] = useState(false)
  const [previewMousePos, setPreviewMousePos] = useState<{ x: number; y: number } | null>(null)
  const [gifExporting, setGifExporting] = useState(false)
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const previewContainerRef = useRef<HTMLDivElement | null>(null)

  type PressCountKey = 'up' | 'down' | 'left' | 'right'
  const [framePressCounts, setFramePressCounts] = useState<Record<PressCountKey, number>[]>([])

  const setFrameOffsetAndCount = useCallback((idx: number, delta: Partial<FrameOffset>, countKey: PressCountKey) => {
    setFrameOffsets((prev) => {
      const next = [...prev]
      if (!next[idx]) next[idx] = { dx: 0, dy: 0 }
      next[idx] = {
        dx: (next[idx]!.dx ?? 0) + (delta.dx ?? 0),
        dy: (next[idx]!.dy ?? 0) + (delta.dy ?? 0),
      }
      return next
    })
    setFramePressCounts((prev) => {
      const next = [...prev]
      if (!next[idx]) next[idx] = { up: 0, down: 0, left: 0, right: 0 }
      next[idx] = { ...next[idx]!, [countKey]: (next[idx]![countKey] ?? 0) + 1 }
      return next
    })
  }, [])

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file)
      setOriginalUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    setOriginalUrl(null)
    setFrameUrls([])
    setSelected([])
  }, [file])

  useEffect(() => {
    const urls = frameUrls
    return () => urls.forEach(URL.revokeObjectURL)
  }, [frameUrls])

  useEffect(() => {
    if (!originalUrl || !file) return
    const img = new Image()
    img.onload = async () => {
      const canvases = splitSpriteSheet(img, cols, rows)
      const urls = canvases.map((c) => {
        return new Promise<string>((resolve, reject) => {
          c.toBlob((b) => {
            if (b) resolve(URL.createObjectURL(b))
            else reject(new Error('blob'))
          }, 'image/png')
        })
      })
      const resolved = await Promise.all(urls)
      setPreviewImgSize(null)
      setFrameOffsets([])
      setFramePressCounts([])
      setRecombinedUrl((old) => {
        if (old) URL.revokeObjectURL(old)
        return null
      })
      setRecombinedParams(null)
      setFixedPixelMode(false)
      setFixedPixelFixes([])
      setFrameUrls(resolved)
      setSelected(resolved.map((_, i) => i < 6))
      setCurrentIdx(0)
    }
    img.src = originalUrl
  }, [originalUrl, file, cols, rows])

  const [recombinedUrl, setRecombinedUrl] = useState<string | null>(null)
  const [recombinedParams, setRecombinedParams] = useState<{ cellW: number; cellH: number } | null>(null)
  const [recombining, setRecombining] = useState(false)
  const [applyProgress, setApplyProgress] = useState<number | null>(null)

  const handleRecombine = async () => {
    if (frameUrls.length === 0) return
    setRecombining(true)
    setRecombinedUrl((old) => {
      if (old) URL.revokeObjectURL(old)
      return null
    })
    setRecombinedParams(null)
    try {
      const { url, cellW, cellH } = await recombineFrames(frameUrls, frameOffsets, cols, rows)
      setRecombinedUrl(url)
      setRecombinedParams({ cellW, cellH })
    } finally {
      setRecombining(false)
    }
  }

  const applyFixedPixels = async () => {
    if (fixedPixelFixes.length === 0 || selectedIndices.length === 0) return
    const frameW = previewImgSize?.w ?? 0
    const frameH = previewImgSize?.h ?? 0
    if (frameW <= 0 || frameH <= 0) return
    setApplyProgress(0)
    const newUrls: string[] = []
    const total = frameUrls.length
    try {
    for (let i = 0; i < total; i++) {
      if (!selected[i]) {
        const resp = await fetch(frameUrls[i]!)
        const blob = await resp.blob()
        newUrls.push(URL.createObjectURL(blob))
      } else {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const im = new Image()
          im.onload = () => resolve(im)
          im.onerror = () => reject(new Error('Failed to load frame'))
          im.src = frameUrls[i]!
        })
        const c = document.createElement('canvas')
        c.width = img.naturalWidth
        c.height = img.naturalHeight
        const ctx = c.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        if (fixedPixelFixes.length > 0) {
          const fullData = ctx.getImageData(0, 0, frameW, frameH)
          const mask = new Uint8Array(frameW * frameH)
          for (let fi = fixedPixelFixes.length - 1; fi >= 0; fi--) {
            const fix = fixedPixelFixes[fi]!
            const d = fix.data
            for (let oy = 0; oy < fix.range; oy++) {
              for (let ox = 0; ox < fix.range; ox++) {
                const px = fix.imgX + ox
                const py = fix.imgY + oy
                if (mask[py * frameW + px]) continue
                mask[py * frameW + px] = 1
                const src = (oy * fix.range + ox) * 4
                const dst = (py * frameW + px) * 4
                fullData.data[dst] = d[src]!
                fullData.data[dst + 1] = d[src + 1]!
                fullData.data[dst + 2] = d[src + 2]!
                fullData.data[dst + 3] = d[src + 3]!
              }
            }
          }
          ctx.putImageData(fullData, 0, 0)
        }
        const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'))
        if (blob) newUrls.push(URL.createObjectURL(blob))
        else newUrls.push(frameUrls[i]!)
      }
      setApplyProgress(Math.round(((i + 1) / total) * 100))
    }
    setFrameUrls(newUrls)
    setFixedPixelFixes([])
    setFixedPixelMode(false)
    } finally {
      setApplyProgress(null)
    }
  }

  const cancelFixedPixels = () => {
    setFixedPixelFixes([])
    setFixedPixelMode(false)
  }

  const handlePreviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!fixedPixelMode || !previewCanvasRef.current || !previewImgSize || !displayUrl) return
    const canvas = previewCanvasRef.current
    const rect = canvas.getBoundingClientRect()
    const dx = frameOffsets[displayIdx]?.dx ?? 0
    const dy = frameOffsets[displayIdx]?.dy ?? 0
    const relX = (e.clientX - rect.left) / rect.width
    const relY = (e.clientY - rect.top) / rect.height
    const canvasX = Math.floor(relX * canvas.width)
    const canvasY = Math.floor(relY * canvas.height)
    const centerImgX = canvasX - dx
    const centerImgY = canvasY - dy
    const imgX = Math.max(0, Math.min(previewImgSize.w - fixedPixelRange, centerImgX - Math.floor(fixedPixelRange / 2)))
    const imgY = Math.max(0, Math.min(previewImgSize.h - fixedPixelRange, centerImgY - Math.floor(fixedPixelRange / 2)))
    const w = previewImgSize.w
    const h = previewImgSize.h
    if (imgX < 0 || imgY < 0 || imgX + fixedPixelRange > w || imgY + fixedPixelRange > h) return
    const srcX = dx + imgX
    const srcY = dy + imgY
    if (srcX < 0 || srcY < 0 || srcX + fixedPixelRange > canvas.width || srcY + fixedPixelRange > canvas.height) return
    try {
      const imgData = canvas.getContext('2d')!.getImageData(srcX, srcY, fixedPixelRange, fixedPixelRange)
      setFixedPixelFixes((prev) => [...prev, { imgX, imgY, range: fixedPixelRange, data: new Uint8ClampedArray(imgData.data) }])
    } catch (_) {}
  }

  const selectedIndices = frameUrls.map((_, i) => i).filter((i) => selected[i])
  const displayIdx = selectedIndices.length > 0 ? selectedIndices[currentIdx % selectedIndices.length] ?? 0 : 0
  const displayUrl = frameUrls[displayIdx]
  const speed = Math.max(50, frameDelay / speedScale)

  const handleExportGif = useCallback(async () => {
    const indices = frameUrls.map((_, i) => i).filter((i) => selected[i])
    if (indices.length === 0) {
      message.warning(t('spriteAdjustExportGifNoFrames'))
      return
    }
    setGifExporting(true)
    try {
      const delayMs = Math.round(Math.max(50, frameDelay / speedScale))
      const frameImgs: ImageData[] = []
      for (const idx of indices) {
        const img = await loadImageElement(frameUrls[idx]!)
        const w = img.naturalWidth
        const h = img.naturalHeight
        const dx = frameOffsets[idx]?.dx ?? 0
        const dy = frameOffsets[idx]?.dy ?? 0
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        const ctx = c.getContext('2d')!
        ctx.clearRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h, dx, dy, w, h)
        frameImgs.push(ctx.getImageData(0, 0, w, h))
      }

      const maxW = Math.max(...frameImgs.map((m) => m.width))
      const maxH = Math.max(...frameImgs.map((m) => m.height))
      const normalizeToMax = (im: ImageData): ImageData => {
        if (im.width === maxW && im.height === maxH) return im
        const out = new ImageData(maxW, maxH)
        out.data.fill(0)
        for (let y = 0; y < im.height; y++) {
          for (let x = 0; x < im.width; x++) {
            const src = (y * im.width + x) * 4
            const dst = (y * maxW + x) * 4
            out.data[dst] = im.data[src]!
            out.data[dst + 1] = im.data[src + 1]!
            out.data[dst + 2] = im.data[src + 2]!
            out.data[dst + 3] = im.data[src + 3]!
          }
        }
        return out
      }

      const gif = GIFEncoder()
      for (let i = 0; i < frameImgs.length; i++) {
        const { data } = normalizeToMax(frameImgs[i]!)
        const palette = quantize(data, 255, {
          format: 'rgba4444',
          oneBitAlpha: 128,
          clearAlpha: true,
          clearAlphaThreshold: 128,
        })
        const index = applyPalette(data, palette, 'rgba4444')
        const transIdx = palette.findIndex((c: number[]) => c[3] === 0)
        let finalPalette: number[][]
        let finalIndex: Uint8Array
        let transparentIndex: number
        if (transIdx >= 0) {
          finalPalette = [...palette]
          finalIndex = index
          transparentIndex = transIdx
        } else {
          finalPalette = [[0, 0, 0, 0], ...palette]
          finalIndex = new Uint8Array(index.length)
          for (let j = 0; j < data.length; j += 4) {
            if (data[j + 3]! < 128) {
              finalIndex[j / 4] = 0
            } else {
              finalIndex[j / 4] = index[j / 4]! + 1
            }
          }
          transparentIndex = 0
        }
        gif.writeFrame(finalIndex, maxW, maxH, {
          palette: finalPalette,
          delay: delayMs,
          transparent: true,
          transparentIndex,
        })
      }
      gif.finish()
      const blob = new Blob([gif.bytes()], { type: 'image/gif' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const base = file?.name?.replace(/\.[^.]+$/, '') ?? 'sprite_adjust'
      a.download = `${base}_frames.gif`
      a.click()
      URL.revokeObjectURL(url)
      message.success(t('gifEncodeSuccess'))
    } catch (e) {
      message.error(t('gifEncodeFailed') + ': ' + String(e))
    } finally {
      setGifExporting(false)
    }
  }, [frameUrls, selected, frameOffsets, frameDelay, speedScale, file?.name, t])

  /** 避免勾选变化后 displayIdx 未变导致键盘回调闭包过期 */
  const selMin = selectedIndices.length > 0 ? Math.min(...selectedIndices) : 0
  const selMax = selectedIndices.length > 0 ? Math.max(...selectedIndices) : 0
  const animKbdRef = useRef({ displayIdx: 0, selectedLen: 0, selMin: 0, selMax: 0 })
  animKbdRef.current = { displayIdx, selectedLen: selectedIndices.length, selMin, selMax }

  useEffect(() => {
    if (!playing || selectedIndices.length === 0) return
    const id = setInterval(() => {
      setCurrentIdx((i) => (i + 1) % selectedIndices.length)
    }, speed)
    return () => clearInterval(id)
  }, [playing, selectedIndices.length, speed])

  useEffect(() => {
    /** Q/E 扩选：按行优先（左→右、上→下）连续编号，行尾下一格为下一行第一格 */
    const totalCells = frameUrls.length
    const neighborLeftRowMajor = (idx: number): number | null => {
      if (idx <= 0) return null
      return idx - 1
    }
    const neighborRightRowMajor = (idx: number): number | null => {
      if (idx >= totalCells - 1) return null
      return idx + 1
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea') return
      if ((document.activeElement as HTMLElement | null)?.isContentEditable) return
      if (frameUrls.length === 0) return

      const { displayIdx: dIdx, selectedLen, selMin: rangeMin, selMax: rangeMax } = animKbdRef.current

      // Q/E：按「已激活范围」扩张到行优先顺序上的外侧一格（含跨行：行末 → 下一行首）
      if (e.code === 'KeyQ') {
        if (selectedLen === 0) return
        if (e.shiftKey) {
          e.preventDefault()
          setSelected((prev) => {
            const next = [...prev]
            next[rangeMin] = false
            return next
          })
          return
        }
        const n = neighborLeftRowMajor(rangeMin)
        if (n == null) return
        e.preventDefault()
        setSelected((prev) => {
          const next = [...prev]
          next[n] = true
          return next
        })
        return
      }
      if (e.code === 'KeyE') {
        if (selectedLen === 0) return
        if (e.shiftKey) {
          e.preventDefault()
          setSelected((prev) => {
            const next = [...prev]
            next[rangeMax] = false
            return next
          })
          return
        }
        const n = neighborRightRowMajor(rangeMax)
        if (n == null) return
        e.preventDefault()
        setSelected((prev) => {
          const next = [...prev]
          next[n] = true
          return next
        })
        return
      }

      if (selectedLen === 0) return

      if (e.code === 'KeyA') {
        e.preventDefault()
        setCurrentIdx((i) => (i - 1 + selectedLen) % selectedLen)
        return
      }
      if (e.code === 'KeyD') {
        e.preventDefault()
        setCurrentIdx((i) => (i + 1) % selectedLen)
        return
      }
      // 与动态帧预览旁的上下左右位移按钮一致（微调当前预览帧在格内偏移）
      if (e.code === 'ArrowUp') {
        e.preventDefault()
        setFrameOffsetAndCount(dIdx, { dy: -1 }, 'up')
        return
      }
      if (e.code === 'ArrowDown') {
        e.preventDefault()
        setFrameOffsetAndCount(dIdx, { dy: 1 }, 'down')
        return
      }
      if (e.code === 'ArrowLeft') {
        e.preventDefault()
        setFrameOffsetAndCount(dIdx, { dx: -1 }, 'left')
        return
      }
      if (e.code === 'ArrowRight') {
        e.preventDefault()
        setFrameOffsetAndCount(dIdx, { dx: 1 }, 'right')
        return
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setFrameOffsetAndCount, frameUrls.length])

  const toggleSelect = (idx: number) => {
    setSelected((prev) => {
      const next = [...prev]
      next[idx] = !next[idx]
      return next
    })
  }

  const isRowAllSelected = (r: number) => {
    for (let c = 0; c < cols; c++) {
      if (!selected[r * cols + c]) return false
    }
    return true
  }
  const isColAllSelected = (c: number) => {
    for (let r = 0; r < rows; r++) {
      if (!selected[r * cols + c]) return false
    }
    return true
  }

  const toggleRow = (rowIdx: number) => {
    const r = Math.max(0, Math.min(rowIdx, rows - 1))
    const allSel = isRowAllSelected(r)
    setSelected((prev) => {
      const next = [...prev]
      for (let c = 0; c < cols; c++) next[r * cols + c] = !allSel
      return next
    })
  }

  const shiftBtnStyle: React.CSSProperties = {
    padding: 2,
    minWidth: 20,
    border: '1px solid #9a8b78',
    borderRadius: 2,
    background: '#e4dbcf',
    color: '#3d3428',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
  }

  const toggleCol = (colIdx: number) => {
    const c = Math.max(0, Math.min(colIdx, cols - 1))
    const allSel = isColAllSelected(c)
    setSelected((prev) => {
      const next = [...prev]
      for (let r = 0; r < rows; r++) next[r * cols + c] = !allSel
      return next
    })
  }

  return (
    <div className="sprite-adjust-module">
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Text type="secondary">{t('spriteAdjustHint')}</Text>
      <StashDropZone
        onStashDrop={(f) => setFile(f)}
        maxSizeMB={IMAGE_MAX_MB}
      >
        <Dragger
          accept={IMAGE_ACCEPT.join(',')}
          maxCount={1}
          fileList={file ? [{ uid: '1', name: file.name } as UploadFile] : []}
          beforeUpload={(f) => {
            setFile(f)
            return false
          }}
          onRemove={() => setFile(null)}
        >
          <p className="ant-upload-text">{t('imageUploadHint')}</p>
          <p className="ant-upload-hint">{t('imageFormats')}</p>
        </Dragger>
      </StashDropZone>
      {file && originalUrl && (
        <>
          <Space wrap align="center">
            <Text type="secondary">{t('spriteColumns')} N:</Text>
            <InputNumber min={1} max={64} value={cols} onChange={(v) => setCols(v ?? 8)} style={{ width: 72 }} />
            <Text type="secondary">{t('spriteRows')} M:</Text>
            <InputNumber min={1} max={64} value={rows} onChange={(v) => setRows(v ?? 4)} style={{ width: 72 }} />
          </Space>
          {frameUrls.length > 0 && (
            <>
              <Text strong style={{ display: 'block' }}>{t('spriteAdjustPreview')}</Text>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>{t('spriteAdjustCheckHint')}</Text>
              <div
                className="sprite-adjust-grid sprite-adjust-grid-with-headers"
                style={{
                  display: 'grid',
                  gridTemplateColumns: `22px repeat(${cols}, minmax(56px, 1fr))`,
                  gridTemplateRows: `22px repeat(${rows}, minmax(56px, 1fr))`,
                  gap: 8,
                  overflow: 'auto',
                  alignItems: 'stretch',
                  justifyItems: 'stretch',
                }}
              >
                <div key="corner" className="sprite-adjust-corner" />
                {Array.from({ length: cols }, (_, c) => (
                  <div key={`col-wrap-${c}`} className="sprite-adjust-header-cell">
                    <Checkbox
                      checked={isColAllSelected(c)}
                      onChange={() => toggleCol(c)}
                      title={t('spriteAdjustSelectCol')}
                    />
                  </div>
                ))}
                {Array.from({ length: rows }, (_, r) => [
                  <div key={`row-wrap-${r}`} className="sprite-adjust-header-cell">
                    <Checkbox
                      checked={isRowAllSelected(r)}
                      onChange={() => toggleRow(r)}
                      title={t('spriteAdjustSelectRow')}
                    />
                  </div>,
                  ...Array.from({ length: cols }, (_, c) => {
                    const i = r * cols + c
                    return (
                      <div
                        key={i}
                        className="sprite-adjust-cell"
                        style={{
                          position: 'relative',
                          display: 'flex',
                          flexDirection: 'row',
                          width: '100%',
                          maxHeight: '100%',
                          minHeight: 0,
                          aspectRatio: '1',
                          border: selected[i] ? '2px solid #b55233' : '1px solid rgba(0,0,0,0.1)',
                          borderRadius: 6,
                          overflow: 'hidden',
                          background: '#e4dbcf',
                          boxSizing: 'border-box',
                        }}
                      >
                        <Checkbox
                          checked={selected[i]}
                          onChange={() => toggleSelect(i)}
                          style={{
                            position: 'absolute',
                            top: 2,
                            left: 2,
                            zIndex: 1,
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                          <ShiftedFrameCanvas
                            src={frameUrls[i]!}
                            dx={frameOffsets[i]?.dx ?? 0}
                            dy={frameOffsets[i]?.dy ?? 0}
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, padding: 2, flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setFrameOffsetAndCount(i, { dy: -1 }, 'up') }}
                              title={t('spriteAdjustShiftUp')}
                              style={shiftBtnStyle}
                            >
                              {(framePressCounts[i]?.up ?? 0) === 0 ? <ArrowUpOutlined style={{ fontSize: 10 }} /> : (framePressCounts[i]?.up ?? 0)}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setFrameOffsetAndCount(i, { dy: 1 }, 'down') }}
                              title={t('spriteAdjustShiftDown')}
                              style={shiftBtnStyle}
                            >
                              {(framePressCounts[i]?.down ?? 0) === 0 ? <ArrowDownOutlined style={{ fontSize: 10 }} /> : (framePressCounts[i]?.down ?? 0)}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setFrameOffsetAndCount(i, { dx: -1 }, 'left') }}
                              title={t('spriteAdjustShiftLeft')}
                              style={shiftBtnStyle}
                            >
                              {(framePressCounts[i]?.left ?? 0) === 0 ? <ArrowLeftOutlined style={{ fontSize: 10 }} /> : (framePressCounts[i]?.left ?? 0)}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setFrameOffsetAndCount(i, { dx: 1 }, 'right') }}
                              title={t('spriteAdjustShiftRight')}
                              style={shiftBtnStyle}
                            >
                              {(framePressCounts[i]?.right ?? 0) === 0 ? <ArrowRightOutlined style={{ fontSize: 10 }} /> : (framePressCounts[i]?.right ?? 0)}
                            </button>
                          </div>
                      </div>
                    )
                  }),
                ])}
              </div>
              {selectedIndices.length > 0 && (
                <div className="sprite-adjust-anim" style={{ marginTop: 24 }}>
                  <Text strong style={{ display: 'block' }}>{t('spriteAdjustAnimPreview')}</Text>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
                    {t('frameAnimPreviewHint', { n: selectedIndices.length, idx: (currentIdx % selectedIndices.length) + 1 })}
                  </Text>
                  <Space style={{ marginBottom: 12 }} wrap>
                    <Slider
                      min={0.25}
                      max={4}
                      step={0.25}
                      value={speedScale}
                      onChange={setSpeedScale}
                      style={{ width: 120 }}
                      tooltip={{ formatter: (v) => `${v}×` }}
                    />
                    <Text type="secondary" style={{ fontSize: 12 }}>{speedScale}×</Text>
                    <button
                      type="button"
                      onClick={() => setPlaying((p) => !p)}
                      style={{
                        padding: '6px 16px',
                        border: '1px solid #9a8b78',
                        borderRadius: 4,
                        background: playing ? '#b55233' : '#e4dbcf',
                        color: playing ? '#fff' : '#3d3428',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                    >
                      {playing ? t('pause') : t('play')}
                    </button>
                    <button
                      type="button"
                      title={t('prevFrame')}
                      onClick={() => setCurrentIdx((i) => (selectedIndices.length > 0 ? (i - 1 + selectedIndices.length) % selectedIndices.length : 0))}
                      style={{
                        padding: '6px 10px',
                        border: '1px solid #9a8b78',
                        borderRadius: 4,
                        background: '#e4dbcf',
                        color: '#3d3428',
                        cursor: 'pointer',
                        fontSize: 13,
                      }}
                    >
                      <StepBackwardOutlined />
                    </button>
                    <button
                      type="button"
                      title={t('nextFrame')}
                      onClick={() => setCurrentIdx((i) => (i + 1) % selectedIndices.length)}
                      style={{
                        padding: '6px 10px',
                        border: '1px solid #9a8b78',
                        borderRadius: 4,
                        background: '#e4dbcf',
                        color: '#3d3428',
                        cursor: 'pointer',
                        fontSize: 13,
                      }}
                    >
                      <StepForwardOutlined />
                    </button>
                    <span style={{ marginLeft: 16, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => setPreviewZoom((z) => Math.max(1, z - 1))}
                        disabled={previewZoom <= 1}
                        style={{
                          padding: '4px 8px',
                          border: '1px solid #9a8b78',
                          borderRadius: 4,
                          background: '#e4dbcf',
                          color: '#3d3428',
                          cursor: previewZoom <= 1 ? 'not-allowed' : 'pointer',
                          opacity: previewZoom <= 1 ? 0.5 : 1,
                        }}
                      >
                        <MinusOutlined />
                      </button>
                      <Text type="secondary" style={{ fontSize: 12, minWidth: 32, textAlign: 'center' }}>{previewZoom}×</Text>
                      <button
                        type="button"
                        onClick={() => setPreviewZoom((z) => Math.min(8, z + 1))}
                        disabled={previewZoom >= 8}
                        style={{
                          padding: '4px 8px',
                          border: '1px solid #9a8b78',
                          borderRadius: 4,
                          background: '#e4dbcf',
                          color: '#3d3428',
                          cursor: previewZoom >= 8 ? 'not-allowed' : 'pointer',
                          opacity: previewZoom >= 8 ? 0.5 : 1,
                        }}
                      >
                        <PlusOutlined />
                      </button>
                    </span>
                    <span style={{ marginLeft: 16, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>{t('spriteAdjustPreviewBg')}:</Text>
                      <Segmented
                        size="small"
                        value={previewBg === 'checkered' ? 'checkered' : 'solid'}
                        onChange={(v) => setPreviewBg(v === 'solid' ? previewBgColor : 'checkered')}
                        options={[
                          { label: t('spriteAdjustPreviewBgCheckered'), value: 'checkered' },
                          { label: t('spriteAdjustPreviewBgSolid'), value: 'solid' },
                        ]}
                      />
                      {previewBg === 'solid' && (
                        <ColorPicker
                          value={previewBgColor}
                          onChange={(_, hex) => setPreviewBgColor(hex ?? '#e4dbcf')}
                          showText
                          size="small"
                          presets={[
                            { label: '', colors: ['#ffffff', '#e4dbcf', '#c9bfb0', '#808080', '#404040', '#000000'] },
                          ]}
                        />
                      )}
                    </span>
                  </Space>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'stretch', gap: 8 }}>
                    <div
                      ref={previewContainerRef}
                      className="sprite-adjust-anim-display"
                      style={{
                        padding: 16,
                        background: previewBg === 'checkered'
                          ? 'repeating-conic-gradient(#c9bfb0 0% 25%, #e4dbcf 0% 50%) 50% / 16px 16px'
                          : previewBgColor,
                        borderRadius: 8,
                        border: '1px solid #9a8b78',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        maxWidth: 480,
                        minHeight: 240,
                        overflow: 'auto',
                        position: 'relative',
                        cursor: fixedPixelMode ? 'crosshair' : undefined,
                      }}
                      onMouseEnter={() => setMouseInPreview(true)}
                      onMouseLeave={() => { setMouseInPreview(false); setPreviewMousePos(null) }}
                      onMouseMove={(e) => {
                        if (!previewContainerRef.current) return
                        const rect = previewContainerRef.current.getBoundingClientRect()
                        setPreviewMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
                      }}
                      onClick={handlePreviewClick}
                    >
                      {displayUrl && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '100%', minHeight: '100%' }}>
                          <div
                            style={{
                              position: 'relative',
                              display: 'inline-block',
                              width: previewImgSize ? previewImgSize.w * previewZoom : undefined,
                              height: previewImgSize ? previewImgSize.h * previewZoom : undefined,
                              border: '1px solid rgba(154,139,120,0.9)',
                              boxSizing: 'border-box',
                            }}
                          >
                            <ShiftedFrameCanvas
                              ref={previewCanvasRef}
                              src={displayUrl}
                              dx={frameOffsets[displayIdx]?.dx ?? 0}
                              dy={frameOffsets[displayIdx]?.dy ?? 0}
                              displayWidth={previewImgSize ? previewImgSize.w * previewZoom : undefined}
                              displayHeight={previewImgSize ? previewImgSize.h * previewZoom : undefined}
                              onSize={(w, h) => setPreviewImgSize({ w, h })}
                              style={{ display: 'block', position: 'relative', zIndex: 1 }}
                            />
                            {/* 背景网格线：每 2 像素一格，叠加在图上以辅助对齐 */}
                            {previewImgSize && (
                              <div
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  backgroundImage: `
                                    linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px),
                                    linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)
                                  `,
                                  backgroundSize: `${2 * previewZoom}px ${2 * previewZoom}px`,
                                  pointerEvents: 'none',
                                  zIndex: 2,
                                }}
                              />
                            )}
                            {/* 水平、垂直参考中线 */}
                            {previewImgSize && (
                              <>
                                <div
                                  style={{
                                    position: 'absolute',
                                    left: 0,
                                    right: 0,
                                    top: '50%',
                                    height: 1,
                                    background: 'rgba(181,82,51,0.75)',
                                    transform: 'translateY(-50%)',
                                    pointerEvents: 'none',
                                    zIndex: 3,
                                  }}
                                />
                                <div
                                  style={{
                                    position: 'absolute',
                                    left: '50%',
                                    top: 0,
                                    bottom: 0,
                                    width: 1,
                                    background: 'rgba(181,82,51,0.75)',
                                    transform: 'translateX(-50%)',
                                    pointerEvents: 'none',
                                    zIndex: 3,
                                  }}
                                />
                              </>
                            )}
                            {/* 分辨率显示 */}
                            {previewImgSize && (
                              <div
                                style={{
                                  position: 'absolute',
                                  left: 4,
                                  bottom: 4,
                                  padding: '2px 6px',
                                  background: 'rgba(0,0,0,0.5)',
                                  color: '#fff',
                                  fontSize: 11,
                                  borderRadius: 4,
                                  pointerEvents: 'none',
                                  zIndex: 4,
                                }}
                              >
                                {previewImgSize.w} × {previewImgSize.h}
                              </div>
                            )}
                            {fixedPixelFixes.map((fix, idx) => (
                              <div
                                key={idx}
                                style={{
                                  position: 'absolute',
                                  left: fix.imgX * previewZoom,
                                  top: fix.imgY * previewZoom,
                                  width: fix.range * previewZoom,
                                  height: fix.range * previewZoom,
                                  backgroundColor: 'rgba(181,82,51,0.35)',
                                  border: '2px solid #b55233',
                                  boxSizing: 'border-box',
                                  pointerEvents: 'none',
                                  zIndex: 5,
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      {fixedPixelMode && mouseInPreview && previewMousePos && previewImgSize && (
                        <div
                          style={{
                            position: 'absolute',
                            left: previewMousePos.x - (fixedPixelRange * previewZoom) / 2,
                            top: previewMousePos.y - (fixedPixelRange * previewZoom) / 2,
                            width: fixedPixelRange * previewZoom,
                            height: fixedPixelRange * previewZoom,
                            border: '2px solid #b55233',
                            borderRadius: 2,
                            pointerEvents: 'none',
                            boxSizing: 'border-box',
                          }}
                        />
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, padding: 2, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setFrameOffsetAndCount(displayIdx, { dy: -1 }, 'up') }}
                        title={t('spriteAdjustShiftUp')}
                        style={shiftBtnStyle}
                      >
                        {(framePressCounts[displayIdx]?.up ?? 0) === 0 ? <ArrowUpOutlined style={{ fontSize: 10 }} /> : (framePressCounts[displayIdx]?.up ?? 0)}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setFrameOffsetAndCount(displayIdx, { dy: 1 }, 'down') }}
                        title={t('spriteAdjustShiftDown')}
                        style={shiftBtnStyle}
                      >
                        {(framePressCounts[displayIdx]?.down ?? 0) === 0 ? <ArrowDownOutlined style={{ fontSize: 10 }} /> : (framePressCounts[displayIdx]?.down ?? 0)}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setFrameOffsetAndCount(displayIdx, { dx: -1 }, 'left') }}
                        title={t('spriteAdjustShiftLeft')}
                        style={shiftBtnStyle}
                      >
                        {(framePressCounts[displayIdx]?.left ?? 0) === 0 ? <ArrowLeftOutlined style={{ fontSize: 10 }} /> : (framePressCounts[displayIdx]?.left ?? 0)}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setFrameOffsetAndCount(displayIdx, { dx: 1 }, 'right') }}
                        title={t('spriteAdjustShiftRight')}
                        style={shiftBtnStyle}
                      >
                        {(framePressCounts[displayIdx]?.right ?? 0) === 0 ? <ArrowRightOutlined style={{ fontSize: 10 }} /> : (framePressCounts[displayIdx]?.right ?? 0)}
                      </button>
                    </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 140 }}>
                      <Button
                        type="primary"
                        loading={gifExporting}
                        disabled={selectedIndices.length === 0}
                        onClick={handleExportGif}
                        block
                      >
                        {t('spriteAdjustExportGif')}
                      </Button>
                      {!fixedPixelMode ? (
                        <button
                          type="button"
                          disabled={playing}
                          onClick={() => { setPlaying(false); setFixedPixelMode(true) }}
                          style={{
                            padding: '8px 16px',
                            border: '1px solid #9a8b78',
                            borderRadius: 4,
                            background: '#e4dbcf',
                            color: '#3d3428',
                            cursor: playing ? 'not-allowed' : 'pointer',
                            fontSize: 13,
                            fontWeight: 500,
                            opacity: playing ? 0.6 : 1,
                          }}
                        >
                          {t('spriteAdjustFixedPixel')}
                        </button>
                      ) : (
                        <>
                          <Text type="secondary" style={{ fontSize: 12 }}>{t('spriteAdjustFixedPixelHint')}</Text>
                          <div>
                            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>{t('spriteAdjustFixedPixelRange')}</Text>
                            <InputNumber
                              min={1}
                              max={8}
                              value={fixedPixelRange}
                              onChange={(v) => setFixedPixelRange(Math.max(1, Math.min(8, v ?? 1)))}
                              style={{ width: 64 }}
                            />
                          </div>
                          {fixedPixelFixes.length > 0 && (
                            <Space direction="vertical" size={8} style={{ width: '100%' }}>
                              <Space>
                                <button
                                  type="button"
                                  disabled={applyProgress !== null}
                                  onClick={applyFixedPixels}
                                  style={{
                                    padding: '6px 14px',
                                    border: '1px solid #9a8b78',
                                    borderRadius: 4,
                                    background: '#b55233',
                                    color: '#fff',
                                    cursor: applyProgress !== null ? 'not-allowed' : 'pointer',
                                    fontSize: 13,
                                    fontWeight: 500,
                                    opacity: applyProgress !== null ? 0.7 : 1,
                                  }}
                                >
                                  {applyProgress !== null ? t('spriteAdjustFixedPixelApplying') : t('spriteAdjustFixedPixelApply')}
                                </button>
                              <button
                                type="button"
                                disabled={applyProgress !== null}
                                onClick={cancelFixedPixels}
                                style={{
                                  padding: '6px 14px',
                                  border: '1px solid #9a8b78',
                                  borderRadius: 4,
                                  background: '#e4dbcf',
                                  color: '#3d3428',
                                  cursor: applyProgress !== null ? 'not-allowed' : 'pointer',
                                  fontSize: 13,
                                  opacity: applyProgress !== null ? 0.7 : 1,
                                }}
                              >
                                {t('spriteAdjustFixedPixelCancel')}
                              </button>
                            </Space>
                              {applyProgress !== null && (
                                <Progress percent={applyProgress} size="small" status="active" />
                              )}
                            </Space>
                          )}
                          <button
                            type="button"
                            onClick={() => { setFixedPixelMode(false); setFixedPixelFixes([]) }}
                            style={{
                              padding: '6px 14px',
                              border: '1px solid #9a8b78',
                              borderRadius: 4,
                              background: '#e4dbcf',
                              color: '#3d3428',
                              cursor: 'pointer',
                              fontSize: 12,
                            }}
                          >
                            {t('spriteAdjustFixedPixelExit')}
                          </button>
                        </>
                      )}
                      {fixedPixelFixes.length > 0 && (
                        <Text type="secondary" style={{ fontSize: 11 }}>{t('spriteAdjustFixedPixelCount', { n: fixedPixelFixes.length })}</Text>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {frameUrls.length > 0 && (
                <div className="sprite-adjust-recombine" style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid rgba(154,139,120,0.5)' }}>
                  <Text strong style={{ display: 'block', marginBottom: 4 }}>{t('spriteAdjustRecombine')}</Text>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
                    {t('spriteAdjustRecombineHint')}
                  </Text>
                  <Space wrap>
                    <button
                      type="button"
                      onClick={handleRecombine}
                      disabled={recombining}
                      style={{
                        padding: '8px 20px',
                        border: '1px solid #9a8b78',
                        borderRadius: 4,
                        background: '#b55233',
                        color: '#fff',
                        cursor: recombining ? 'not-allowed' : 'pointer',
                        fontSize: 14,
                        fontWeight: 500,
                        opacity: recombining ? 0.7 : 1,
                      }}
                    >
                      {recombining ? t('spriteAdjustRecombining') : t('spriteAdjustRecombineBtn')}
                    </button>
                    {recombinedUrl && (
                      <a
                        href={recombinedUrl}
                        download={
                          recombinedParams
                            ? `recombined_${cols}x${rows}_${recombinedParams.cellW}x${recombinedParams.cellH}_${cols * recombinedParams.cellW}x${rows * recombinedParams.cellH}.png`
                            : 'recombined-sprite.png'
                        }
                        style={{
                          padding: '8px 20px',
                          border: '1px solid #9a8b78',
                          borderRadius: 4,
                          background: '#e4dbcf',
                          color: '#3d3428',
                          textDecoration: 'none',
                          fontSize: 14,
                          fontWeight: 500,
                        }}
                      >
                        {t('spriteAdjustDownloadRecombined')}
                      </a>
                    )}
                  </Space>
                  {recombinedUrl && (
                    <div style={{ marginTop: 12, maxWidth: 480 }}>
                      <img
                        src={recombinedUrl}
                        alt=""
                        style={{ maxWidth: '100%', display: 'block', borderRadius: 6, border: '1px solid #9a8b78', imageRendering: 'pixelated' }}
                      />
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </Space>
    </div>
  )
}
