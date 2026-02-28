import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../../i18n/context'

const HANDLE_SIZE = 12
type CropHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | 'move' | null

interface Props {
  imageUrl: string
  imageSize: { w: number; h: number }
  cropRegion: { left: number; top: number; right: number; bottom: number }
  onChange: (r: { left: number; top: number; right: number; bottom: number }) => void
  onPickColor?: (r: number, g: number, b: number) => void
  pickingColor?: boolean
}

export default function ImageCropEditor({
  imageUrl,
  imageSize,
  cropRegion,
  onChange,
  onPickColor,
  pickingColor,
}: Props) {
  const { t } = useLanguage()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dragging, setDragging] = useState<CropHandle>(null)
  const [startPos, setStartPos] = useState<{
    x: number
    y: number
    left: number
    top: number
    right: number
    bottom: number
  } | null>(null)
  const [hoverHandle, setHoverHandle] = useState<CropHandle>(null)

  const hitTest = (vx: number, vy: number): CropHandle => {
    const { left, top, right, bottom } = cropRegion
    const r = imageSize.w - left - right
    const b = imageSize.h - top - bottom
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

  const toImageCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return { vx: 0, vy: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = imageSize.w / rect.width
    const scaleY = imageSize.h / rect.height
    return {
      vx: Math.round((clientX - rect.left) * scaleX),
      vy: Math.round((clientY - rect.top) * scaleY),
    }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { vx, vy } = toImageCoords(e.clientX, e.clientY)
    if (pickingColor && onPickColor) {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const scaleX = imageSize.w / rect.width
      const scaleY = imageSize.h / rect.height
      const x = Math.floor((e.clientX - rect.left) * scaleX)
      const y = Math.floor((e.clientY - rect.top) * scaleY)
      const ctx = canvas.getContext('2d')
      if (ctx) {
        const [r, g, b] = ctx.getImageData(x, y, 1, 1).data
        onPickColor(r, g, b)
      }
      return
    }
    const handle = hitTest(vx, vy)
    setDragging(handle)
    setStartPos({ x: vx, y: vy, ...cropRegion })
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = toImageCoords(e.clientX, e.clientY)
    if (!dragging || !startPos) {
      setHoverHandle(pickingColor ? null : hitTest(coords.vx, coords.vy))
      return
    }
    const dx = coords.vx - startPos.x
    const dy = coords.vy - startPos.y
    let { left, top, right, bottom } = startPos
    if (dragging === 'move') {
      const w = imageSize.w - startPos.left - startPos.right
      const h = imageSize.h - startPos.top - startPos.bottom
      left = Math.max(0, Math.min(imageSize.w - w - 1, startPos.left + dx))
      top = Math.max(0, Math.min(imageSize.h - h - 1, startPos.top + dy))
      right = imageSize.w - left - w
      bottom = imageSize.h - top - h
    } else {
      const minW = 1
      const minH = 1
      if (dragging.includes('w'))
        left = Math.max(0, Math.min(imageSize.w - startPos.right - minW, startPos.left + dx))
      if (dragging.includes('e'))
        right = Math.max(0, Math.min(imageSize.w - startPos.left - minW, startPos.right - dx))
      if (dragging.includes('n'))
        top = Math.max(0, Math.min(imageSize.h - startPos.bottom - minH, startPos.top + dy))
      if (dragging.includes('s'))
        bottom = Math.max(0, Math.min(imageSize.h - startPos.top - minH, startPos.bottom - dy))
    }
    onChange({ left, top, right, bottom })
  }

  const handleMouseUp = () => {
    setDragging(null)
    setStartPos(null)
  }

  const getCursor = () => {
    if (pickingColor) return 'crosshair'
    if (dragging) return 'grabbing'
    const h = hoverHandle ?? null
    const map: Record<string, string> = {
      move: 'grab',
      n: 'n-resize',
      s: 's-resize',
      e: 'e-resize',
      w: 'w-resize',
      ne: 'ne-resize',
      nw: 'nw-resize',
      se: 'se-resize',
      sw: 'sw-resize',
    }
    return (h && map[h]) ?? 'crosshair'
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !imageUrl) return
    const img = new Image()
    img.onload = () => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      canvas.width = imageSize.w
      canvas.height = imageSize.h
      ctx.drawImage(img, 0, 0)
      const { left, top, right, bottom } = cropRegion
      const w = imageSize.w - left - right
      const h = imageSize.h - top - bottom
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      if (left > 0) ctx.fillRect(0, 0, left, imageSize.h)
      if (right > 0) ctx.fillRect(imageSize.w - right, 0, right, imageSize.h)
      if (top > 0) ctx.fillRect(left, 0, w, top)
      if (bottom > 0) ctx.fillRect(left, imageSize.h - bottom, w, bottom)
      ctx.strokeStyle = '#b55233'
      ctx.lineWidth = 2
      ctx.strokeRect(left, top, w, h)
      ctx.fillStyle = '#b55233'
      ;[
        [left, top],
        [left + w, top],
        [left + w, top + h],
        [left, top + h],
        [left + w / 2, top],
        [left + w / 2, top + h],
        [left, top + h / 2],
        [left + w, top + h / 2],
      ].forEach(([x, y]) => {
        ctx.fillRect(x - 4, y - 4, 8, 8)
      })
    }
    img.onerror = () => {
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#d4c8b8'
        ctx.fillRect(0, 0, imageSize.w, imageSize.h)
        ctx.fillStyle = '#6b5d4d'
        ctx.font = '14px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(t('errImageLoad'), imageSize.w / 2, imageSize.h / 2)
      }
    }
    img.src = imageUrl
  }, [imageUrl, cropRegion, imageSize, t])

  if (!imageUrl) return null

  return (
    <div
      style={{
        overflow: 'auto',
        maxHeight: 400,
        border: '1px solid #9a8b78',
        borderRadius: 8,
        background: 'repeating-conic-gradient(#c9bfb0 0% 25%, #e4dbcf 0% 50%) 50% / 16px 16px',
      }}
    >
      <canvas
        ref={canvasRef}
        width={imageSize.w}
        height={imageSize.h}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ maxWidth: '100%', cursor: getCursor(), display: 'block', imageRendering: 'pixelated' }}
      />
    </div>
  )
}
