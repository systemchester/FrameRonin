import type { Rgba } from './paintDocument'
import type { Document } from './types'

/**
 * 将单帧内所有 **可见** 图层按自下而上顺序 alpha 合成到一张 ImageData（第 6 步）
 * 隐藏层跳过；使用离屏 canvas，与主画布一致为 source-over。
 */
export function composeFrameToImageData(
  doc: Document,
  frameIndex: number,
): ImageData {
  const w = doc.width
  const h = doc.height
  const frame = doc.frames[frameIndex]
  if (!frame) {
    return new ImageData(w, h)
  }

  const composite = document.createElement('canvas')
  composite.width = w
  composite.height = h
  const ctx = composite.getContext('2d')
  if (!ctx) return new ImageData(w, h)
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, w, h)

  const layerCanvas = document.createElement('canvas')
  layerCanvas.width = w
  layerCanvas.height = h
  const lctx = layerCanvas.getContext('2d')
  if (!lctx) return ctx.getImageData(0, 0, w, h)
  lctx.imageSmoothingEnabled = false

  for (let i = 0; i < doc.layers.length; i++) {
    const layer = doc.layers[i]
    if (!layer.visible) continue
    const cel = frame.cels[i]
    if (!cel) continue
    lctx.clearRect(0, 0, w, h)
    lctx.putImageData(cel.imageData, 0, 0)
    ctx.drawImage(layerCanvas, 0, 0)
  }

  return ctx.getImageData(0, 0, w, h)
}

/**
 * 合成时临时把 `previewLayerIndex` 的 cel 与笔划像素合并后再合成，用于多图层下笔触预览正确叠色。
 */
export function composeFrameWithStrokePreview(
  doc: Document,
  frameIndex: number,
  previewLayerIndex: number,
  strokeKeys: ReadonlySet<string>,
  rgba: Rgba,
): ImageData {
  if (strokeKeys.size === 0) {
    return composeFrameToImageData(doc, frameIndex)
  }
  const frame = doc.frames[frameIndex]
  if (!frame) return composeFrameToImageData(doc, frameIndex)
  const cel = frame.cels[previewLayerIndex]
  if (!cel) return composeFrameToImageData(doc, frameIndex)

  const w = doc.width
  const h = doc.height
  const data = new Uint8ClampedArray(cel.imageData.data)
  const [r, g, b, a] = rgba
  for (const key of strokeKeys) {
    const comma = key.indexOf(',')
    const x = Number(key.slice(0, comma))
    const y = Number(key.slice(comma + 1))
    if (x < 0 || y < 0 || x >= w || y >= h) continue
    const i = (y * w + x) * 4
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
    data[i + 3] = a
  }
  const patchedCel = { ...cel, imageData: new ImageData(data, w, h) }
  const virtualCels = frame.cels.map((c, i) =>
    i === previewLayerIndex ? patchedCel : c,
  )
  const virtualFrame = { ...frame, cels: virtualCels }
  const virtualFrames = doc.frames.map((fr, i) =>
    i === frameIndex ? virtualFrame : fr,
  )
  const virtualDoc: Document = { ...doc, frames: virtualFrames }
  return composeFrameToImageData(virtualDoc, frameIndex)
}
