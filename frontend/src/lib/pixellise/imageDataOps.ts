export function cloneImageData(src: ImageData): ImageData {
  const out = new ImageData(src.width, src.height)
  out.data.set(src.data)
  return out
}

/** 最近邻缩放到目标宽高（Worker 可用，不依赖 DOM） */
export function scaleNearestToSize(img: ImageData, nw: number, nh: number): ImageData {
  const out = new ImageData(nw, nh)
  const iw = img.width
  const ih = img.height
  if (iw < 1 || ih < 1) return out
  for (let y = 0; y < nh; y++) {
    const sy = Math.min(ih - 1, Math.floor((y * ih) / nh))
    for (let x = 0; x < nw; x++) {
      const sx = Math.min(iw - 1, Math.floor((x * iw) / nw))
      const si = (sy * iw + sx) * 4
      const oi = (y * nw + x) * 4
      out.data[oi] = img.data[si]!
      out.data[oi + 1] = img.data[si + 1]!
      out.data[oi + 2] = img.data[si + 2]!
      out.data[oi + 3] = img.data[si + 3]!
    }
  }
  return out
}

export function scaleNearestByFactor(img: ImageData, factor: number): ImageData {
  const nw = Math.max(1, Math.round(img.width * factor))
  const nh = Math.max(1, Math.round(img.height * factor))
  return scaleNearestToSize(img, nw, nh)
}

export function cropBorder(img: ImageData, n: number): ImageData {
  const nw = img.width - 2 * n
  const nh = img.height - 2 * n
  if (nw < 1 || nh < 1) return cloneImageData(img)
  const out = new ImageData(nw, nh)
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const si = ((y + n) * img.width + (x + n)) * 4
      const oi = (y * nw + x) * 4
      out.data.set(img.data.subarray(si, si + 4), oi)
    }
  }
  return out
}

const ALPHA_THRESHOLD = 128

function rgbDist(a: [number, number, number], b: [number, number, number]): number {
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return dr * dr + dg * dg + db * db
}

const BG_CANDIDATES: [number, number, number][] = [
  [0, 255, 255],
  [255, 255, 255],
  [255, 0, 0],
  [0, 255, 0],
  [0, 0, 255],
  [255, 255, 0],
  [255, 0, 255],
  [255, 128, 0],
  [128, 0, 255],
  [0, 128, 255],
  [0, 255, 128],
  [255, 0, 128],
]

/** 与 proper-pixel-art clamp_alpha 类似：半透明像素用远离主色的背景色替换，便于 Canny */
export function clampAlphaCompositeForEdges(img: ImageData): ImageData {
  const w = img.width
  const h = img.height
  const counts = new Map<string, number>()
  const stepX = Math.max(1, Math.floor(w / 160))
  const stepY = Math.max(1, Math.floor(h / 160))
  for (let y = 0; y < h; y += stepY) {
    for (let x = 0; x < w; x += stepX) {
      const i = (y * w + x) * 4
      if (img.data[i + 3]! < ALPHA_THRESHOLD) continue
      const key = `${img.data[i]},${img.data[i + 1]},${img.data[i + 2]}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  const top: [number, number, number][] = []
  for (const [k, _] of [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    const p = k.split(',').map(Number) as [number, number, number]
    top.push(p)
  }
  let bg: [number, number, number] = [255, 255, 255]
  if (top.length > 0) {
    let best = BG_CANDIDATES[0]!
    let bestScore = -1
    for (const c of BG_CANDIDATES) {
      const score = Math.min(...top.map((t) => rgbDist(c, t)))
      if (score > bestScore) {
        bestScore = score
        best = c
      }
    }
    bg = best
  }
  const out = new ImageData(w, h)
  for (let i = 0; i < out.data.length; i += 4) {
    if (img.data[i + 3]! >= ALPHA_THRESHOLD) {
      out.data[i] = img.data[i]!
      out.data[i + 1] = img.data[i + 1]!
      out.data[i + 2] = img.data[i + 2]!
      out.data[i + 3] = 255
    } else {
      out.data[i] = bg[0]!
      out.data[i + 1] = bg[1]!
      out.data[i + 2] = bg[2]!
      out.data[i + 3] = 255
    }
  }
  return out
}

/** 单通道 alpha，最近邻缩放 */
export function scaleNearestAlpha(
  alpha: Uint8ClampedArray,
  w: number,
  h: number,
  nw: number,
  nh: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(nw * nh)
  if (w < 1 || h < 1) return out
  for (let y = 0; y < nh; y++) {
    const sy = Math.min(h - 1, Math.floor((y * h) / nh))
    for (let x = 0; x < nw; x++) {
      const sx = Math.min(w - 1, Math.floor((x * w) / nw))
      out[y * nw + x] = alpha[sy * w + sx]!
    }
  }
  return out
}

export async function fileToImageData(file: File): Promise<ImageData> {
  const bmp = await createImageBitmap(file)
  try {
    const w = bmp.width
    const h = bmp.height
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(bmp, 0, 0)
    return ctx.getImageData(0, 0, w, h)
  } finally {
    bmp.close()
  }
}

export function imageDataToPngBlob(data: ImageData): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = data.width
  canvas.height = data.height
  canvas.getContext('2d')!.putImageData(data, 0, 0)
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
  })
}

export function copyImageDataBuffer(data: ImageData): ArrayBuffer {
  const len = data.data.byteLength
  const ab = new ArrayBuffer(len)
  new Uint8Array(ab).set(new Uint8Array(data.data.buffer, data.data.byteOffset, len))
  return ab
}
