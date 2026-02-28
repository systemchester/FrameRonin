/** 工具函数：帧处理、画布、抠图等 */

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

/** 单图缩放：按比例缩放至目标尺寸内，居中放置。pixelated=true 时使用最近邻（硬边缘），适合像素图 */
export async function resizeImageToBlob(
  blob: Blob,
  targetW: number,
  targetH: number,
  keepAspect = true,
  pixelated = false
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
  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) return blob
  if (pixelated) {
    ctx.imageSmoothingEnabled = false
    ctx.imageSmoothingQuality = 'low'
  }
  let w: number, h: number, x: number, y: number
  if (keepAspect) {
    const scale = Math.min(targetW / img.width, targetH / img.height)
    w = Math.round(img.width * scale)
    h = Math.round(img.height * scale)
    x = (targetW - w) / 2
    y = (targetH - h) / 2
  } else {
    w = targetW
    h = targetH
    x = 0
    y = 0
  }
  ctx.clearRect(0, 0, targetW, targetH)
  ctx.drawImage(img, x, y, w, h)
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('ERR_TOBLOB'))), 'image/png', 0.95)
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
