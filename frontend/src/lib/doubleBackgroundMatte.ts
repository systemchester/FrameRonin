/**
 * 双背景抠图：黑底图与白底图差分提取 Alpha（与 ImageMatte 中算法一致）
 */

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('ERR_LOAD_IMAGE'))
    }
    img.src = url
  })
}

/** 黑底 + 白底 → 带透明通道结果 Canvas */
export function processDoubleBackground(
  blackImg: HTMLImageElement,
  whiteImg: HTMLImageElement,
  tolerance: number = 50,
  edgeContrast: number = 50
): HTMLCanvasElement {
  const width = blackImg.naturalWidth
  const height = blackImg.naturalHeight
  if (whiteImg.naturalWidth !== width || whiteImg.naturalHeight !== height) {
    throw new Error('dimension mismatch')
  }
  const tolScale = 0.5 + tolerance / 100
  const gamma = 0.5 + edgeContrast / 100
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(blackImg, 0, 0)
  const blackData = ctx.getImageData(0, 0, width, height).data
  ctx.drawImage(whiteImg, 0, 0)
  const whiteData = ctx.getImageData(0, 0, width, height).data
  const result = ctx.createImageData(width, height)
  const resData = result.data
  for (let i = 0; i < blackData.length; i += 4) {
    const rb = blackData[i]!
    const gb = blackData[i + 1]!
    const bb = blackData[i + 2]!
    const rw = whiteData[i]!
    const gw = whiteData[i + 1]!
    const bw = whiteData[i + 2]!
    const diff = ((rw - rb) + (gw - gb) + (bw - bb)) / 3
    let alpha = Math.max(0, Math.min(255, 255 - diff * tolScale))
    alpha = Math.round(255 * Math.pow(alpha / 255, gamma))
    resData[i] = alpha > 0 ? Math.round((rb * 255) / alpha) : 0
    resData[i + 1] = alpha > 0 ? Math.round((gb * 255) / alpha) : 0
    resData[i + 2] = alpha > 0 ? Math.round((bb * 255) / alpha) : 0
    resData[i + 3] = alpha
  }
  ctx.putImageData(result, 0, 0)
  return canvas
}

export async function doubleBackgroundMatteFromBlobs(
  blackBlob: Blob,
  whiteBlob: Blob,
  tolerance: number,
  edgeContrast: number
): Promise<Blob> {
  const [blackImg, whiteImg] = await Promise.all([
    loadImageFromBlob(blackBlob),
    loadImageFromBlob(whiteBlob),
  ])
  const canvas = processDoubleBackground(blackImg, whiteImg, tolerance, edgeContrast)
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
  })
}
