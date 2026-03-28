/**
 * 简易多图拼接：与 GIF 工具「简易拼接」一致。
 * mode: 0 上下 | 1 左右 | 2 融合（同尺寸叠画，居中）
 */

export type StitchComposeMode = 0 | 1 | 2

async function blobsToImages(blobs: Blob[]): Promise<HTMLImageElement[]> {
  const imgs: HTMLImageElement[] = []
  for (const blob of blobs) {
    const url = URL.createObjectURL(blob)
    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image()
        i.onload = () => res(i)
        i.onerror = () => rej(new Error('load'))
        i.src = url
      })
      imgs.push(img)
    } finally {
      URL.revokeObjectURL(url)
    }
  }
  return imgs
}

export async function stitchImageBlobs(blobs: Blob[], mode: StitchComposeMode): Promise<Blob> {
  if (blobs.length === 0) throw new Error('STITCH_EMPTY')
  if (blobs.length === 1) return blobs[0]!

  const imgs = await blobsToImages(blobs)
  const isVertical = mode === 0
  const isOverlay = mode === 2
  let outW: number
  let outH: number
  if (isOverlay) {
    outW = Math.max(...imgs.map((i) => i.naturalWidth))
    outH = Math.max(...imgs.map((i) => i.naturalHeight))
  } else if (isVertical) {
    outW = Math.max(...imgs.map((i) => i.naturalWidth))
    outH = imgs.reduce((s, i) => s + i.naturalHeight, 0)
  } else {
    outW = imgs.reduce((s, i) => s + i.naturalWidth, 0)
    outH = Math.max(...imgs.map((i) => i.naturalHeight))
  }

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('STITCH_NO_CTX')

  let dx = 0
  let dy = 0
  for (let i = 0; i < imgs.length; i++) {
    const img = imgs[i]!
    const w = img.naturalWidth
    const h = img.naturalHeight
    if (isOverlay) {
      const ox = (outW - w) / 2
      const oy = (outH - h) / 2
      ctx.drawImage(img, 0, 0, w, h, ox, oy, w, h)
    } else if (isVertical) {
      const ox = (outW - w) / 2
      ctx.drawImage(img, 0, 0, w, h, ox, dy, w, h)
      dy += h
    } else {
      const oy = (outH - h) / 2
      ctx.drawImage(img, 0, 0, w, h, dx, oy, w, h)
      dx += w
    }
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('STITCH_TOBLOB'))), 'image/png', 0.95)
  })
}

/** @deprecated 使用 stitchImageBlobs(blobs, 0) */
export async function stitchVerticalImageBlobs(blobs: Blob[]): Promise<Blob> {
  return stitchImageBlobs(blobs, 0)
}
