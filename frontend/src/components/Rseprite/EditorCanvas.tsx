import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { bresenhamLine } from './bresenham'
import {
  composeFrameToImageData,
  composeFrameWithStrokePreview,
} from './composeFrame'
import type { Rgba } from './paintDocument'
import type { Document, PixelPoint } from './types'

const MIN_SCALE = 1
const MAX_SCALE = 48

/** 第 3 步默认前景色：黑 */
export const DEFAULT_PAINT_RGBA: Rgba = [0, 0, 0, 255]

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n))
}

function clientToDocPixel(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  viewOx: number,
  viewOy: number,
  scale: number,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect()
  const mx = clientX - rect.left
  const my = clientY - rect.top
  return {
    x: Math.floor((mx - viewOx) / scale),
    y: Math.floor((my - viewOy) / scale),
  }
}

function strokeKey(x: number, y: number) {
  return `${x},${y}`
}

/**
 * 第 2 步：主画布 — 像素放大、棋盘格、平移、滚轮缩放（DPR）
 * 第 3 步：左键铅笔（Bresenham），与 Alt+左键/中键平移互斥
 * 一笔画仅在松手时提交一次 onPaintPixels，对应撤销栈中「一条动作」
 * 第 6 步：按 `doc` 多图层合成；笔划预览经 `composeFrameWithStrokePreview` 与下层正确叠色
 */
export interface EditorCanvasProps {
  doc: Document
  frameIndex: number
  activeLayerIndex: number
  className?: string
  style?: CSSProperties
  minHeight?: number
  /** 一笔结束（pointerup）时回调整笔像素，用于单次撤销 */
  onPaintPixels?: (pixels: PixelPoint[], rgba: Rgba) => void
  paintRgba?: Rgba
  /** 第 9 步：前后帧半透明显示（仅预览） */
  onionSkinEnabled?: boolean
  /** 0～1，相邻帧合成后再乘以此系数 */
  onionSkinOpacity?: number
}

export default function EditorCanvas({
  doc,
  frameIndex,
  activeLayerIndex,
  className,
  style,
  minHeight = 320,
  onPaintPixels,
  paintRgba = DEFAULT_PAINT_RGBA,
  onionSkinEnabled = false,
  onionSkinOpacity = 0.35,
}: EditorCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bufferRef = useRef<HTMLCanvasElement | null>(null)
  /** 洋葱皮 / 合成：putImageData 后 drawImage 以应用 globalAlpha */
  const onionScratchRef = useRef<HTMLCanvasElement | null>(null)

  const [scale, setScale] = useState(8)
  const [viewOx, setViewOx] = useState(0)
  const [viewOy, setViewOy] = useState(0)
  const [containerCss, setContainerCss] = useState({ w: 0, h: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)

  const panRef = useRef<{ active: boolean; px: number; py: number }>({
    active: false,
    px: 0,
    py: 0,
  })

  const drawRef = useRef<{
    active: boolean
    lastX: number
    lastY: number
  } | null>(null)

  /** 当前笔划累积（文档格），松手时一次性提交 */
  const strokePreviewRef = useRef<Set<string>>(new Set())

  const viewportRef = useRef({ scale, viewOx, viewOy })
  viewportRef.current = { scale, viewOx, viewOy }

  const onPaintRef = useRef(onPaintPixels)
  onPaintRef.current = onPaintPixels

  const rgbaRef = useRef(paintRgba)
  rgbaRef.current = paintRgba

  const iw = doc.width
  const ih = doc.height

  const recenter = useCallback(
    (s: number, cw: number, ch: number) => {
      setViewOx((cw - iw * s) / 2)
      setViewOy((ch - ih * s) / 2)
    },
    [iw, ih],
  )

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      setContainerCss({ w: r.width, h: r.height })
    })
    ro.observe(el)
    const r = el.getBoundingClientRect()
    setContainerCss({ w: r.width, h: r.height })
    return () => ro.disconnect()
  }, [])

  const prevDocRef = useRef({ iw: 0, ih: 0 })
  useLayoutEffect(() => {
    const { w: cw, h: ch } = containerCss
    if (cw < 1 || ch < 1) return
    const docChanged =
      prevDocRef.current.iw !== iw || prevDocRef.current.ih !== ih
    if (!docChanged) return
    prevDocRef.current = { iw, ih }
    const fit = Math.min((cw * 0.92) / iw, (ch * 0.92) / ih, MAX_SCALE)
    const s0 = clamp(Math.floor(fit) || 1, MIN_SCALE, MAX_SCALE)
    setScale(s0)
    recenter(s0, cw, ch)
  }, [iw, ih, containerCss.w, containerCss.h, recenter])

  const prevContainerRef = useRef({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const { w: cw, h: ch } = containerCss
    if (cw < 1 || ch < 1) return
    const pc = prevContainerRef.current
    if (pc.w > 0 && pc.h > 0 && (pc.w !== cw || pc.h !== ch)) {
      const dcx = (cw - pc.w) / 2
      const dcy = (ch - pc.h) / 2
      setViewOx((o) => o + dcx)
      setViewOy((o) => o + dcy)
    }
    prevContainerRef.current = { w: cw, h: ch }
  }, [containerCss.w, containerCss.h])

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    let buf = bufferRef.current
    if (!buf) {
      buf = document.createElement('canvas')
      bufferRef.current = buf
    }

    const dpr = window.devicePixelRatio || 1
    const cw = wrap.clientWidth
    const ch = wrap.clientHeight
    if (cw < 1 || ch < 1) return

    canvas.width = Math.round(cw * dpr)
    canvas.height = Math.round(ch * dpr)
    canvas.style.width = `${cw}px`
    canvas.style.height = `${ch}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.imageSmoothingEnabled = false

    ctx.fillStyle = '#2a2a2e'
    ctx.fillRect(0, 0, cw, ch)

    const sx = viewOx
    const sy = viewOy
    const sw = iw * scale
    const sh = ih * scale

    const cs = clamp(Math.max(4, scale), 4, 32)
    for (let y = 0; y < sh; y += cs) {
      for (let x = 0; x < sw; x += cs) {
        const parity = (Math.floor(x / cs) + Math.floor(y / cs)) % 2
        ctx.fillStyle = parity ? '#3a3a42' : '#323238'
        ctx.fillRect(sx + x, sy + y, Math.min(cs, sw - x), Math.min(cs, sh - y))
      }
    }

    const stroke = strokePreviewRef.current
    const composite =
      stroke.size > 0
        ? composeFrameWithStrokePreview(
            doc,
            frameIndex,
            activeLayerIndex,
            stroke,
            rgbaRef.current,
          )
        : composeFrameToImageData(doc, frameIndex)

    if (buf.width !== iw || buf.height !== ih) {
      buf.width = iw
      buf.height = ih
    }
    const bctx = buf.getContext('2d')
    if (!bctx) return
    bctx.clearRect(0, 0, iw, ih)
    bctx.imageSmoothingEnabled = false

    let scratch = onionScratchRef.current
    if (!scratch) {
      scratch = document.createElement('canvas')
      onionScratchRef.current = scratch
    }
    scratch.width = iw
    scratch.height = ih
    const sctx = scratch.getContext('2d')
    if (!sctx) return
    sctx.imageSmoothingEnabled = false

    const onion = onionSkinEnabled && doc.frames.length > 1
    const oa = clamp(onionSkinOpacity, 0, 1)
    if (onion && oa > 0) {
      if (frameIndex > 0) {
        sctx.clearRect(0, 0, iw, ih)
        sctx.putImageData(composeFrameToImageData(doc, frameIndex - 1), 0, 0)
        bctx.globalAlpha = oa
        bctx.drawImage(scratch, 0, 0)
      }
      if (frameIndex < doc.frames.length - 1) {
        sctx.clearRect(0, 0, iw, ih)
        sctx.putImageData(composeFrameToImageData(doc, frameIndex + 1), 0, 0)
        bctx.globalAlpha = oa
        bctx.drawImage(scratch, 0, 0)
      }
      bctx.globalAlpha = 1
    }

    sctx.clearRect(0, 0, iw, ih)
    sctx.putImageData(composite, 0, 0)
    bctx.drawImage(scratch, 0, 0)

    ctx.imageSmoothingEnabled = false
    ctx.drawImage(buf, sx, sy, sw, sh)
  }, [
    doc,
    frameIndex,
    activeLayerIndex,
    iw,
    ih,
    scale,
    viewOx,
    viewOy,
    onionSkinEnabled,
    onionSkinOpacity,
  ])

  const paintFnRef = useRef(paint)
  useLayoutEffect(() => {
    paintFnRef.current = paint
  }, [paint])

  useLayoutEffect(() => {
    paint()
  }, [paint])

  const requestRepaint = useCallback(() => {
    paintFnRef.current()
  }, [])

  const commitStrokePixels = useCallback(() => {
    const paintCb = onPaintRef.current
    const set = strokePreviewRef.current
    if (!paintCb || set.size === 0) {
      set.clear()
      return
    }
    const pixels: PixelPoint[] = []
    for (const k of set) {
      const i = k.indexOf(',')
      pixels.push({ x: Number(k.slice(0, i)), y: Number(k.slice(i + 1)) })
    }
    paintCb(pixels, rgbaRef.current)
    set.clear()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault()
      const { scale: s, viewOx: ox, viewOy: oy } = viewportRef.current
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const docX = (mx - ox) / s
      const docY = (my - oy) / s
      const delta = e.deltaY > 0 ? -1 : 1
      const factor = delta > 0 ? 1.12 : 1 / 1.12
      const newScale = clamp(s * factor, MIN_SCALE, MAX_SCALE)
      if (newScale === s) return
      setScale(newScale)
      setViewOx(mx - docX * newScale)
      setViewOy(my - docY * newScale)
    }

    canvas.addEventListener('wheel', onWheelNative, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheelNative)
  }, [])

  const shouldPan = (e: ReactPointerEvent) =>
    e.button === 1 || (e.button === 0 && e.altKey)

  const stopDrawing = useCallback(() => {
    drawRef.current = null
    setIsDrawing(false)
  }, [])

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget
    const paintCb = onPaintRef.current

    if (shouldPan(e)) {
      e.preventDefault()
      panRef.current = { active: true, px: e.clientX, py: e.clientY }
      setIsPanning(true)
      canvas.setPointerCapture(e.pointerId)
      return
    }

    if (e.button !== 0 || !paintCb) return

    e.preventDefault()
    const { viewOx: ox, viewOy: oy, scale: sc } = viewportRef.current
    const p = clientToDocPixel(e.clientX, e.clientY, canvas, ox, oy, sc)

    strokePreviewRef.current.clear()
    strokePreviewRef.current.add(strokeKey(p.x, p.y))
    drawRef.current = { active: true, lastX: p.x, lastY: p.y }
    setIsDrawing(true)
    canvas.setPointerCapture(e.pointerId)
    requestRepaint()
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget

    if (panRef.current.active) {
      const { px, py } = panRef.current
      const dx = e.clientX - px
      const dy = e.clientY - py
      panRef.current.px = e.clientX
      panRef.current.py = e.clientY
      setViewOx((o) => o + dx)
      setViewOy((o) => o + dy)
      return
    }

    const d = drawRef.current
    if (!d?.active) return

    const { viewOx: ox, viewOy: oy, scale: sc } = viewportRef.current
    const p = clientToDocPixel(e.clientX, e.clientY, canvas, ox, oy, sc)

    const line = bresenhamLine(d.lastX, d.lastY, p.x, p.y)
    const set = strokePreviewRef.current
    for (const pt of line) {
      if (pt.x >= 0 && pt.x < iw && pt.y >= 0 && pt.y < ih) {
        set.add(strokeKey(pt.x, pt.y))
      }
    }
    d.lastX = p.x
    d.lastY = p.y
    requestRepaint()
  }

  const endPan = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (panRef.current.active) {
      panRef.current.active = false
      setIsPanning(false)
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (drawRef.current?.active) {
      commitStrokePixels()
      stopDrawing()
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      requestRepaint()
    }
    endPan(e)
  }

  const pencilCursor = onPaintPixels ? 'crosshair' : 'default'
  const cursor = isPanning ? 'grabbing' : isDrawing ? 'crosshair' : pencilCursor

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        minHeight,
        height: minHeight,
        borderRadius: '0 0 8px 8px',
        overflow: 'hidden',
        background: '#1e1e22',
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        tabIndex={0}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          cursor,
          touchAction: 'none',
          outline: 'none',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onLostPointerCapture={() => {
          if (drawRef.current?.active && strokePreviewRef.current.size > 0) {
            commitStrokePixels()
          }
          panRef.current.active = false
          setIsPanning(false)
          strokePreviewRef.current.clear()
          stopDrawing()
          requestRepaint()
        }}
      />
    </div>
  )
}
