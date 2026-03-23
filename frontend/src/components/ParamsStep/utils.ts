/** 工具函数：帧处理、画布、抠图等 */
import { resizeImageToBlobCanvasLegacy } from './utilsResizeCanvasLegacy'

/** 裁切图片：按 left/top/right/bottom 裁掉边缘 */
export async function cropImageBlob(
  blob: Blob,
  crop: { left: number; top: number; right: number; bottom: number }
): Promise<Blob> {
  const { left, top, right, bottom } = crop
  if (left === 0 && top === 0 && right === 0 && bottom === 0) return blob
  const img = await (typeof createImageBitmap === 'function'
    ? createImageBitmap(blob)
    : new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image()
        const url = URL.createObjectURL(blob)
        im.onload = () => { URL.revokeObjectURL(url); resolve(im) }
        im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('ERR_IMAGE_LOAD')) }
        im.src = url
      }))
  const srcW = img.width
  const srcH = img.height
  const dstW = Math.max(1, srcW - left - right)
  const dstH = Math.max(1, srcH - top - bottom)
  const canvas = document.createElement('canvas')
  canvas.width = dstW
  canvas.height = dstH
  const ctx = canvas.getContext('2d')
  if (!ctx) return blob
  ctx.drawImage(img, left, top, dstW, dstH, 0, 0, dstW, dstH)
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('ERR_TOBLOB'))), 'image/png', 0.95)
  })
}

/** 单图缩放：按比例缩放至目标尺寸内，居中放置。pixelated=true 时使用 PS 风格最近邻（硬边缘）；false 时平滑缩放 */
export async function resizeImageToBlob(
  blob: Blob,
  targetW: number,
  targetH: number,
  keepAspect = true,
  pixelated = false
): Promise<Blob> {
  if (pixelated) {
    return resizeImageToBlobNearestNeighborPS(blob, targetW, targetH, keepAspect)
  }
  return resizeImageToBlobCanvasLegacy(blob, targetW, targetH, keepAspect, false)
}

/**
 * PS 风格硬缩放：逐像素最近邻采样，模仿 Photoshop「邻近（硬边缘）」重采样。
 * Canvas drawImage + imageSmoothingEnabled=false 在 1024→192 等非整数倍缩小时会模糊，
 * 本函数使用 ImageData 手动采样，保证边缘锐利。
 */
export async function resizeImageToBlobNearestNeighborPS(
  blob: Blob,
  targetW: number,
  targetH: number,
  keepAspect: boolean
): Promise<Blob> {
  const img = await (typeof createImageBitmap === 'function'
    ? createImageBitmap(blob)
    : new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image()
        const url = URL.createObjectURL(blob)
        im.onload = () => { URL.revokeObjectURL(url); resolve(im) }
        im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('ERR_IMAGE_LOAD')) }
        im.src = url
      }))
  const srcW = img.width
  const srcH = img.height
  const tmp = document.createElement('canvas')
  tmp.width = srcW
  tmp.height = srcH
  const tmpCtx = tmp.getContext('2d')
  if (!tmpCtx) return blob
  tmpCtx.drawImage(img, 0, 0)
  const srcData = tmpCtx.getImageData(0, 0, srcW, srcH).data

  let cw: number, ch: number, cx: number, cy: number
  if (keepAspect) {
    const scale = Math.min(targetW / srcW, targetH / srcH)
    cw = Math.max(1, Math.round(srcW * scale))
    ch = Math.max(1, Math.round(srcH * scale))
    cx = Math.round((targetW - cw) / 2)
    cy = Math.round((targetH - ch) / 2)
  } else {
    cw = targetW
    ch = targetH
    cx = 0
    cy = 0
  }

  const out = document.createElement('canvas')
  out.width = targetW
  out.height = targetH
  const outCtx = out.getContext('2d')
  if (!outCtx) return blob
  const outImg = outCtx.createImageData(targetW, targetH)
  const dst = outImg.data

  for (let dy = 0; dy < targetH; dy++) {
    for (let dx = 0; dx < targetW; dx++) {
      const dstIdx = (dy * targetW + dx) * 4
      if (dx < cx || dx >= cx + cw || dy < cy || dy >= cy + ch) {
        dst[dstIdx] = 0
        dst[dstIdx + 1] = 0
        dst[dstIdx + 2] = 0
        dst[dstIdx + 3] = 0
        continue
      }
      const rx = dx - cx
      const ry = dy - cy
      const sx = Math.min(srcW - 1, Math.max(0, Math.floor((rx + 0.5) * srcW / cw)))
      const sy = Math.min(srcH - 1, Math.max(0, Math.floor((ry + 0.5) * srcH / ch)))
      const srcIdx = (sy * srcW + sx) * 4
      dst[dstIdx] = srcData[srcIdx]
      dst[dstIdx + 1] = srcData[srcIdx + 1]
      dst[dstIdx + 2] = srcData[srcIdx + 2]
      dst[dstIdx + 3] = srcData[srcIdx + 3]
    }
  }
  outCtx.putImageData(outImg, 0, 0)
  return new Promise((resolve, reject) => {
    out.toBlob((b) => (b ? resolve(b) : reject(new Error('ERR_TOBLOB'))), 'image/png', 0.95)
  })
}

/** 图片按3行切分，行高=h/3。将第3行下移1行高度，第2行复制到第3行位置并水平翻转。输出高度 = h + rowHeight */
export async function extendImageBottom(blob: Blob, _bottomPx: number): Promise<Blob> {
  const img = await (typeof createImageBitmap === 'function'
    ? createImageBitmap(blob)
    : new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image()
        const url = URL.createObjectURL(blob)
        im.onload = () => { URL.revokeObjectURL(url); resolve(im) }
        im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('ERR_IMAGE_LOAD')) }
        im.src = url
      }))
  const w = img.width
  const h = img.height
  const rowH = Math.floor(h / 3)
  if (rowH <= 0) return blob
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h + rowH
  const ctx = canvas.getContext('2d')
  if (!ctx) return blob
  ctx.drawImage(img, 0, 0, w, rowH, 0, 0, w, rowH)
  ctx.drawImage(img, 0, rowH, w, rowH, 0, rowH, w, rowH)
  ctx.save()
  ctx.translate(w, 2 * rowH)
  ctx.scale(-1, 1)
  ctx.drawImage(img, 0, rowH, w, rowH, 0, 0, w, rowH)
  ctx.restore()
  ctx.drawImage(img, 0, 2 * rowH, w, rowH, 0, 3 * rowH, w, rowH)
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('ERR_TOBLOB'))), 'image/png', 0.95)
  })
}

/** 古装全动作：256x256 → 4x4 切分 → 每格加边 → 按规则重排 */
export async function processAncientCostumeAllActions(blob: Blob): Promise<Blob> {
  const img = await (typeof createImageBitmap === 'function'
    ? createImageBitmap(blob)
    : new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image()
        const url = URL.createObjectURL(blob)
        im.onload = () => { URL.revokeObjectURL(url); resolve(im) }
        im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('ERR_IMAGE_LOAD')) }
        im.src = url
      }))
  if (img.width !== 256 || img.height !== 256) {
    throw new Error('processAncientCostumeAllActions expects 256x256 input')
  }
  const cellSize = 64
  const pad = { top: 34, bottom: 30, left: 32, right: 32 }
  const outCellW = cellSize + pad.left + pad.right
  const outCellH = cellSize + pad.top + pad.bottom

  const getCell = (row: number, col: number) => {
    const canvas = document.createElement('canvas')
    canvas.width = outCellW
    canvas.height = outCellH
    const ctx = canvas.getContext('2d')
    if (!ctx) return canvas
    const sx = col * cellSize
    const sy = row * cellSize
    ctx.drawImage(img, sx, sy, cellSize, cellSize, pad.left, pad.top, cellSize, cellSize)
    return canvas
  }

  const flipH = (src: HTMLCanvasElement) => {
    const c = document.createElement('canvas')
    c.width = src.width
    c.height = src.height
    const ctx = c.getContext('2d')
    if (!ctx) return c
    ctx.save()
    ctx.translate(c.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(src, 0, 0, src.width, src.height, 0, 0, src.width, src.height)
    ctx.restore()
    return c
  }

  const cells: Record<string, HTMLCanvasElement> = {}
  for (let r = 1; r <= 4; r++) {
    for (let c = 1; c <= 4; c++) {
      const key = `${r}K${c}`
      cells[key] = getCell(r - 1, c - 1)
    }
  }

  const outW = 1024
  const outH = 7 * outCellH
  const out = document.createElement('canvas')
  out.width = outW
  out.height = outH
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('ERR_CANVAS_CREATE')
  ctx.clearRect(0, 0, outW, outH)

  let y = 0
  const draw = (key: string, flipped: boolean, count: number, xStart = 0) => {
    const c = flipped ? flipH(cells[key]!) : cells[key]!
    for (let i = 0; i < count; i++) {
      ctx.drawImage(c, xStart + i * outCellW, y, outCellW, outCellH)
    }
  }

  draw('2K4', false, 4)
  draw('2K4', true, 4, 4 * outCellW)
  y += outCellH
  ctx.drawImage(cells['1K1']!, 0, y)
  ctx.drawImage(cells['1K2']!, outCellW, y)
  ctx.drawImage(cells['1K3']!, 2 * outCellW, y)
  ctx.drawImage(cells['1K4']!, 3 * outCellW, y)
  ctx.drawImage(cells['2K1']!, 4 * outCellW, y)
  ctx.drawImage(cells['2K2']!, 5 * outCellW, y)
  y += outCellH
  ctx.drawImage(flipH(cells['1K1']!), 0, y)
  ctx.drawImage(flipH(cells['1K2']!), outCellW, y)
  ctx.drawImage(flipH(cells['1K3']!), 2 * outCellW, y)
  ctx.drawImage(flipH(cells['1K4']!), 3 * outCellW, y)
  ctx.drawImage(flipH(cells['2K1']!), 4 * outCellW, y)
  ctx.drawImage(flipH(cells['2K2']!), 5 * outCellW, y)
  y += outCellH
  draw('4K4', false, 4)
  draw('4K4', true, 4, 4 * outCellW)
  y += outCellH
  ctx.drawImage(cells['3K1']!, 0, y)
  ctx.drawImage(cells['3K2']!, outCellW, y)
  ctx.drawImage(cells['3K3']!, 2 * outCellW, y)
  ctx.drawImage(cells['3K4']!, 3 * outCellW, y)
  ctx.drawImage(cells['4K1']!, 4 * outCellW, y)
  ctx.drawImage(cells['4K2']!, 5 * outCellW, y)
  y += outCellH
  ctx.drawImage(flipH(cells['3K1']!), 0, y)
  ctx.drawImage(flipH(cells['3K2']!), outCellW, y)
  ctx.drawImage(flipH(cells['3K3']!), 2 * outCellW, y)
  ctx.drawImage(flipH(cells['3K4']!), 3 * outCellW, y)
  ctx.drawImage(flipH(cells['4K1']!), 4 * outCellW, y)
  ctx.drawImage(flipH(cells['4K2']!), 5 * outCellW, y)
  y += outCellH
  ctx.drawImage(cells['2K3']!, 0, y)
  ctx.drawImage(flipH(cells['2K3']!), outCellW, y)
  ctx.drawImage(cells['4K3']!, 2 * outCellW, y)
  ctx.drawImage(flipH(cells['4K3']!), 3 * outCellW, y)

  return new Promise((resolve, reject) => {
    out.toBlob((b) => (b ? resolve(b) : reject(new Error('ERR_TOBLOB'))), 'image/png', 0.95)
  })
}

export function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function resizeFrameToCanvas(
  img: HTMLImageElement | ImageBitmap,
  targetW: number,
  targetH: number,
  padding: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const innerW = targetW - padding * 2
  const innerH = targetH - padding * 2
  const scale = Math.min(innerW / img.width, innerH / img.height, 1)
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)
  const x = padding + (innerW - w) / 2
  const y = padding + (innerH - h) / 2
  ctx.clearRect(0, 0, targetW, targetH)
  ctx.drawImage(img, x, y, w, h)
  return canvas
}

/** 将帧缩放至目标尺寸（与 resizeFrameToCanvas 逻辑一致），用于描边前缩小以加速 */
export async function resizeFrameToBlob(
  blob: Blob,
  targetW: number,
  targetH: number,
  padding: number
): Promise<Blob> {
  const img = await (typeof createImageBitmap === 'function'
    ? createImageBitmap(blob)
    : new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image()
        const url = URL.createObjectURL(blob)
        im.onload = () => { URL.revokeObjectURL(url); resolve(im) }
        im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('ERR_IMAGE_LOAD')) }
        im.src = url
      }))
  const canvas = resizeFrameToCanvas(img, targetW, targetH, padding)
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('ERR_TOBLOB'))), 'image/png', 0.95)
  })
}

const YIELD_BATCH = 8000

function yieldToMain(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0))
}

export async function applyInnerStroke(blob: Blob, strokeWidth: number, strokeColor: string): Promise<Blob> {
  if (strokeWidth <= 0) return blob
  const img = await (typeof createImageBitmap === 'function'
    ? createImageBitmap(blob)
    : new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image()
        const url = URL.createObjectURL(blob)
        im.onload = () => { URL.revokeObjectURL(url); resolve(im) }
        im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('ERR_IMAGE_LOAD')) }
        im.src = url
      }))
  const w = img.width
  const h = img.height
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return blob
  ctx.drawImage(img, 0, 0)
  const imageData = ctx.getImageData(0, 0, w, h)
  const data = imageData.data

  const alphaTransparent = 5
  const m = strokeColor.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
  const sr = m ? parseInt(m[1], 16) : 0
  const sg = m ? parseInt(m[2], 16) : 0
  const sb = m ? parseInt(m[3], 16) : 0

  const INF = 0xffff
  const dist = new Uint16Array(w * h)
  const total = w * h
  for (let i = 0; i < total; i += YIELD_BATCH) {
    const end = Math.min(i + YIELD_BATCH, total)
    for (let j = i; j < end; j++) {
      dist[j] = data[j * 4 + 3]! <= alphaTransparent ? 0 : INF
    }
    if (end < total) await yieldToMain()
  }

  const queue: number[] = []
  for (let i = 0; i < total; i++) {
    if (dist[i] === 0) queue.push(i)
  }
  const dx = [-1, -1, -1, 0, 0, 1, 1, 1]
  const dy = [-1, 0, 1, -1, 1, -1, 0, 1]
  while (queue.length > 0) {
    let processed = 0
    while (queue.length > 0 && processed < YIELD_BATCH) {
      const idx = queue.shift()!
      const d = dist[idx]
      const x = idx % w
      const y = (idx / w) | 0
      for (let k = 0; k < 8; k++) {
        const nx = x + dx[k]!
        const ny = y + dy[k]!
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
        const ni = ny * w + nx
        if (dist[ni] !== INF) continue
        dist[ni] = d + 1
        queue.push(ni)
      }
      processed++
    }
    if (queue.length > 0) await yieldToMain()
  }

  const stroked = new Uint8Array(w * h)
  for (let i = 0; i < total; i += YIELD_BATCH) {
    const end = Math.min(i + YIELD_BATCH, total)
    for (let j = i; j < end; j++) {
      const d = dist[j]
      if (d >= 1 && d <= strokeWidth) {
        data[j * 4] = sr
        data[j * 4 + 1] = sg
        data[j * 4 + 2] = sb
        data[j * 4 + 3] = 255
        stroked[j] = 1
      }
    }
    if (end < total) await yieldToMain()
  }

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const a = data[i * 4 + 3]!
      if (a > 0 && a <= alphaTransparent) {
        for (let k = 0; k < 8; k++) {
          const ni = (y + dy[k]!) * w + (x + dx[k]!)
          if (stroked[ni]) {
            data[i * 4] = sr
            data[i * 4 + 1] = sg
            data[i * 4 + 2] = sb
            data[i * 4 + 3] = 255
            break
          }
        }
      }
    }
    if (y % 32 === 0) await yieldToMain()
  }

  ctx.putImageData(imageData, 0, 0)
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('ERR_TOBLOB'))), 'image/png', 0.95)
  })
}

export function composeSpriteSheetClient(
  frames: { blob: Blob; dataUrl: string }[],
  timestamps: number[],
  targetW: number,
  targetH: number,
  padding: number,
  spacing: number,
  columns: number,
  resizeFn: (img: HTMLImageElement, tw: number, th: number, pad: number) => HTMLCanvasElement
): Promise<{ pngBlob: Blob; index: object }> {
  return new Promise((resolve, reject) => {
    const cols = Math.max(1, columns)
    const rows = Math.ceil(frames.length / cols)
    const sheetW = cols * (targetW + spacing) - spacing
    const sheetH = rows * (targetH + spacing) - spacing
    const sheet = document.createElement('canvas')
    sheet.width = sheetW
    sheet.height = sheetH
    const ctx = sheet.getContext('2d')
    if (!ctx) return reject(new Error('ERR_CANVAS_CREATE'))
    ctx.clearRect(0, 0, sheetW, sheetH)

    const framesIndex: { i: number; x: number; y: number; w: number; h: number; t: number }[] = []
    let loaded = 0

    const processFrame = (i: number) => {
      const img = new Image()
      img.onload = () => {
        const resized = resizeFn(img, targetW, targetH, padding)
        const col = i % cols
        const row = Math.floor(i / cols)
        const x = col * (targetW + spacing)
        const y = row * (targetH + spacing)
        ctx.drawImage(resized, x, y, targetW, targetH)
        framesIndex.push({
          i,
          x,
          y,
          w: targetW,
          h: targetH,
          t: Math.round((timestamps[i] ?? 0) * 1000) / 1000,
        })
        loaded++
        if (loaded === frames.length) {
          sheet.toBlob(
            (blob) => {
              if (blob) {
                resolve({
                  pngBlob: blob,
                  index: {
                    version: '1.0',
                    frame_size: { w: targetW, h: targetH },
                    sheet_size: { w: sheetW, h: sheetH },
                    frames: framesIndex,
                  },
                })
              } else reject(new Error('ERR_EXPORT'))
            },
            'image/png',
            0.95
          )
        }
      }
      img.onerror = () => reject(new Error('ERR_FRAME_LOAD'))
      img.src = frames[i].dataUrl
    }

    for (let i = 0; i < frames.length; i++) processFrame(i)
  })
}

export function applyBrushMask(
  baseDataUrl: string,
  maskDataUrl: string
): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const baseImg = new Image()
    const maskImg = new Image()
    baseImg.onload = () => {
      maskImg.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = baseImg.width
        canvas.height = baseImg.height
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('ERR_CANVAS_CREATE'))
        ctx.drawImage(baseImg, 0, 0)
        ctx.globalCompositeOperation = 'destination-out'
        ctx.drawImage(maskImg, 0, 0)
        ctx.globalCompositeOperation = 'source-over'
        const dataUrl = canvas.toDataURL('image/png')
        canvas.toBlob(
          (blob) => (blob ? resolve({ blob, dataUrl }) : reject(new Error('ERR_EXPORT'))),
          'image/png',
          0.95
        )
      }
      maskImg.onerror = () => reject(new Error('ERR_MASK_LOAD'))
      maskImg.src = maskDataUrl
    }
    baseImg.onerror = () => reject(new Error('ERR_BASE_LOAD'))
    baseImg.src = baseDataUrl
  })
}

/** 获取图片左上角像素的 RGB 颜色 */
export async function getTopLeftPixelColor(blob: Blob): Promise<{ r: number; g: number; b: number }> {
  const img = await (typeof createImageBitmap === 'function'
    ? createImageBitmap(blob)
    : new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image()
        const url = URL.createObjectURL(blob)
        im.onload = () => { URL.revokeObjectURL(url); resolve(im) }
        im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('ERR_IMAGE_LOAD')) }
        im.src = url
      }))
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('ERR_CANVAS_CREATE')
  ctx.drawImage(img, 0, 0)
  const d = ctx.getImageData(0, 0, 1, 1).data
  return { r: d[0] ?? 0, g: d[1] ?? 0, b: d[2] ?? 0 }
}

export function applyChromaKey(
  dataUrl: string,
  bgR: number,
  bgG: number,
  bgB: number,
  tolerance: number,
  feather: number
): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('ERR_CANVAS_CREATE'))
      ctx.drawImage(img, 0, 0)
      const id = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const d = id.data
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i]
        const g = d[i + 1]
        const b = d[i + 2]
        const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2)
        if (dist <= tolerance) {
          d[i + 3] = 0
        } else if (feather > 0 && dist < tolerance + feather) {
          const t = (dist - tolerance) / feather
          d[i + 3] = Math.round(255 * Math.min(1, t))
        }
      }
      ctx.putImageData(id, 0, 0)
      const resultDataUrl = canvas.toDataURL('image/png')
      canvas.toBlob(
        (blob) => (blob ? resolve({ blob, dataUrl: resultDataUrl }) : reject(new Error('ERR_EXPORT'))),
        'image/png',
        0.95
      )
    }
    img.onerror = () => reject(new Error('ERR_IMAGE_LOAD'))
    img.src = dataUrl
  })
}

/**
 * ChromaKey 色度键：连续区域（与左上角连通）用 80 容差，非连续区域用 30 容差。
 * 取色仍为左上角第一像素。
 */
export function applyChromaKeyHybridTolerance(
  dataUrl: string,
  bgR: number,
  bgG: number,
  bgB: number,
  contiguousTolerance: number,
  nonContiguousTolerance: number,
  feather: number
): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('ERR_CANVAS_CREATE'))
      ctx.drawImage(img, 0, 0)
      const id = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const d = id.data
      const w = canvas.width
      const h = canvas.height

      const idx = (x: number, y: number) => (y * w + x) * 4
      const dist = (i: number) =>
        Math.sqrt(
          (d[i]! - bgR) ** 2 + (d[i + 1]! - bgG) ** 2 + (d[i + 2]! - bgB) ** 2
        )
      const matchContiguous = (i: number) => dist(i) <= contiguousTolerance

      const contiguous = new Set<number>()
      const start = idx(0, 0)
      if (matchContiguous(start)) {
        const stack: [number, number][] = [[0, 0]]
        contiguous.add(start)
        const vis = new Set<number>()
        vis.add(start)
        const dx = [0, 1, 0, -1]
        const dy = [-1, 0, 1, 0]
        while (stack.length > 0) {
          const [x, y] = stack.pop()!
          for (let k = 0; k < 4; k++) {
            const nx = x + dx[k]!
            const ny = y + dy[k]!
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
            const i = idx(nx, ny)
            if (vis.has(i)) continue
            vis.add(i)
            if (matchContiguous(i)) {
              contiguous.add(i)
              stack.push([nx, ny])
            }
          }
        }
      }

      for (let i = 0; i < d.length; i += 4) {
        const dst = Math.sqrt(
          (d[i]! - bgR) ** 2 + (d[i + 1]! - bgG) ** 2 + (d[i + 2]! - bgB) ** 2
        )
        const isContiguous = contiguous.has(i)
        const tol = isContiguous ? contiguousTolerance : nonContiguousTolerance
        if (dst <= tol) {
          d[i + 3] = 0
        } else if (feather > 0 && dst < tol + feather) {
          const t = (dst - tol) / feather
          d[i + 3] = Math.round(255 * Math.min(1, t))
        }
      }
      ctx.putImageData(id, 0, 0)
      const resultDataUrl = canvas.toDataURL('image/png')
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve({ blob, dataUrl: resultDataUrl })
            : reject(new Error('ERR_EXPORT')),
        'image/png',
        0.95
      )
    }
    img.onerror = () => reject(new Error('ERR_IMAGE_LOAD'))
    img.src = dataUrl
  })
}

/**
 * ChromaKey 自适应：非连续区域抠图时，若某区域像素数 > 20，该区域容差 +40。
 * 连续区域仍用 80 容差。
 */
export function applyChromaKeyAdaptiveRegion(
  dataUrl: string,
  bgR: number,
  bgG: number,
  bgB: number,
  contiguousTolerance: number,
  nonContiguousTolerance: number,
  largeRegionThreshold: number,
  largeRegionToleranceBonus: number,
  feather: number
): Promise<{ blob: Blob; dataUrl: string }> {
  void feather
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('ERR_CANVAS_CREATE'))
      ctx.drawImage(img, 0, 0)
      const id = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const d = id.data
      const w = canvas.width
      const h = canvas.height

      const idx = (x: number, y: number) => (y * w + x) * 4
      const dist = (i: number) =>
        Math.sqrt(
          (d[i]! - bgR) ** 2 + (d[i + 1]! - bgG) ** 2 + (d[i + 2]! - bgB) ** 2
        )
      const matchContiguous = (i: number) => dist(i) <= contiguousTolerance

      const contiguous = new Set<number>()
      const start = idx(0, 0)
      if (matchContiguous(start)) {
        const stack: [number, number][] = [[0, 0]]
        contiguous.add(start)
        const vis = new Set<number>()
        vis.add(start)
        const dx = [0, 1, 0, -1]
        const dy = [-1, 0, 1, 0]
        while (stack.length > 0) {
          const [x, y] = stack.pop()!
          for (let k = 0; k < 4; k++) {
            const nx = x + dx[k]!
            const ny = y + dy[k]!
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
            const i = idx(nx, ny)
            if (vis.has(i)) continue
            vis.add(i)
            if (matchContiguous(i)) {
              contiguous.add(i)
              stack.push([nx, ny])
            }
          }
        }
      }

      const nonContiguousCandidates = new Set<number>()
      const groupTolerance = Math.max(
        nonContiguousTolerance + largeRegionToleranceBonus,
        contiguousTolerance
      )
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = idx(x, y)
          if (contiguous.has(i)) continue
          if (dist(i) <= groupTolerance) nonContiguousCandidates.add(i)
        }
      }

      const pixelToRegion = new Map<number, number>()
      const regionSizes: number[] = []
      const vis = new Set<number>()
      const dx = [0, 1, 0, -1]
      const dy = [-1, 0, 1, 0]
      let regionId = 0
      for (const seed of nonContiguousCandidates) {
        if (vis.has(seed)) continue
        const stack = [seed]
        vis.add(seed)
        const members: number[] = []
        while (stack.length > 0) {
          const i = stack.pop()!
          members.push(i)
          const x = (i / 4) % w
          const y = Math.floor(i / 4 / w)
          for (let k = 0; k < 4; k++) {
            const nx = x + dx[k]!
            const ny = y + dy[k]!
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
            const ni = idx(nx, ny)
            if (vis.has(ni) || !nonContiguousCandidates.has(ni)) continue
            vis.add(ni)
            stack.push(ni)
          }
        }
        for (const m of members) pixelToRegion.set(m, regionId)
        regionSizes.push(members.length)
        regionId++
      }

      const effectiveTol = (rId: number) =>
        regionSizes[rId]! > largeRegionThreshold
          ? nonContiguousTolerance + largeRegionToleranceBonus
          : nonContiguousTolerance

      for (let i = 0; i < d.length; i += 4) {
        const dst = Math.sqrt(
          (d[i]! - bgR) ** 2 + (d[i + 1]! - bgG) ** 2 + (d[i + 2]! - bgB) ** 2
        )
        if (contiguous.has(i)) {
          const tol = contiguousTolerance
          if (dst <= tol) d[i + 3] = 0
          else if (feather > 0 && dst < tol + feather) {
            const t = (dst - tol) / feather
            d[i + 3] = Math.round(255 * Math.min(1, t))
          }
        } else {
          const rId = pixelToRegion.get(i)
          const tol =
            rId !== undefined ? effectiveTol(rId) : nonContiguousTolerance
          if (dst <= tol) d[i + 3] = 0
          else if (feather > 0 && dst < tol + feather) {
            const t = (dst - tol) / feather
            d[i + 3] = Math.round(255 * Math.min(1, t))
          }
        }
      }
      ctx.putImageData(id, 0, 0)
      const resultDataUrl = canvas.toDataURL('image/png')
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve({ blob, dataUrl: resultDataUrl })
            : reject(new Error('ERR_EXPORT')),
        'image/png',
        0.95
      )
    }
    img.onerror = () => reject(new Error('ERR_IMAGE_LOAD'))
    img.src = dataUrl
  })
}

/**
 * 基于左上角(0,0)像素的连通域去背：仅移除与第一行第一像素连通的同色区域，
 * 不会移除图像中间孤立的同色像素。
 */
export function applyChromaKeyContiguousFromTopLeft(
  dataUrl: string,
  bgR: number,
  bgG: number,
  bgB: number,
  tolerance: number,
  feather: number
): Promise<{ blob: Blob; dataUrl: string }> {
  void feather // 保留参数与 applyChromaKey 一致
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('ERR_CANVAS_CREATE'))
      ctx.drawImage(img, 0, 0)
      const id = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const d = id.data
      const w = canvas.width
      const h = canvas.height

      const idx = (x: number, y: number) => (y * w + x) * 4
      const dist = (i: number) =>
        Math.sqrt(
          (d[i]! - bgR) ** 2 + (d[i + 1]! - bgG) ** 2 + (d[i + 2]! - bgB) ** 2
        )
      const match = (i: number) => dist(i) <= tolerance

      const toRemove = new Set<number>()
      const start = idx(0, 0)
      if (!match(start)) {
        ctx.putImageData(id, 0, 0)
        canvas.toBlob(
          (blob) =>
            blob
              ? resolve({ blob, dataUrl: canvas.toDataURL('image/png') })
              : reject(new Error('ERR_EXPORT')),
          'image/png',
          0.95
        )
        return
      }

      const stack: [number, number][] = [[0, 0]]
      toRemove.add(idx(0, 0))
      const vis = new Set<number>()
      vis.add(idx(0, 0))
      const dx = [0, 1, 0, -1]
      const dy = [-1, 0, 1, 0]
      while (stack.length > 0) {
        const [x, y] = stack.pop()!
        for (let k = 0; k < 4; k++) {
          const nx = x + dx[k]!
          const ny = y + dy[k]!
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
          const i = idx(nx, ny)
          if (vis.has(i)) continue
          vis.add(i)
          if (match(i)) {
            toRemove.add(i)
            stack.push([nx, ny])
          }
        }
      }

      for (const i of toRemove) {
        d[i + 3] = 0
      }
      ctx.putImageData(id, 0, 0)
      const resultDataUrl = canvas.toDataURL('image/png')
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve({ blob, dataUrl: resultDataUrl })
            : reject(new Error('ERR_EXPORT')),
        'image/png',
        0.95
      )
    }
    img.onerror = () => reject(new Error('ERR_IMAGE_LOAD'))
    img.src = dataUrl
  })
}

export function imageFingerprint(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const ctx = c.getContext('2d')
      if (!ctx) return reject(new Error('ERR_CANVAS_CREATE'))
      ctx.drawImage(img, 0, 0)
      const d = ctx.getImageData(0, 0, c.width, c.height).data
      let h1 = 0
      let h2 = 0
      for (let i = 0; i < d.length; i += 16) {
        h1 = ((h1 << 5) - h1 + d[i]! + d[i + 1]! + d[i + 2]! + d[i + 3]!) | 0
        h2 = ((h2 << 3) + h2 + d[i + 4]! + d[i + 5]! + d[i + 6]! + d[i + 7]!) | 0
      }
      resolve(`${h1}_${h2}`)
    }
    img.onerror = () => reject(new Error('ERR_IMAGE_LOAD'))
    img.src = dataUrl
  })
}

export async function analyzeDuplicateFrames(
  frames: { dataUrl: string }[]
): Promise<Map<number, { groupId: number; totalInGroup: number }>> {
  const hashes: string[] = []
  for (let i = 0; i < frames.length; i++) {
    hashes[i] = await imageFingerprint(frames[i]!.dataUrl)
  }
  const hashToIndices = new Map<string, number[]>()
  hashes.forEach((hash, i) => {
    const list = hashToIndices.get(hash) || []
    list.push(i)
    hashToIndices.set(hash, list)
  })
  const result = new Map<number, { groupId: number; totalInGroup: number }>()
  let groupId = 0
  hashToIndices.forEach((indices) => {
    if (indices.length > 1) {
      indices.forEach((i) => result.set(i, { groupId, totalInGroup: indices.length }))
      groupId++
    }
  })
  return result
}
