/**
 * 备份：旧版 Canvas drawImage 缩放逻辑。
 * 原 resizeImageToBlob 的 pixelated 分支曾用 imageSmoothingEnabled=false，
 * 在 1024→192 等非整数倍缩小时边缘较糊，已由 resizeImageToBlobNearestNeighborPS 取代。
 * 若后续需要恢复旧行为，可从此文件取用。
 */
export async function resizeImageToBlobCanvasLegacy(
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
