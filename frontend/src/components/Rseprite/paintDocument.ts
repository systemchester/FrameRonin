import type { Document } from './types'

export type Rgba = readonly [number, number, number, number]

/** 去重同一批次中的重复格点 */
export function dedupePixels(
  pixels: ReadonlyArray<{ x: number; y: number }>,
): Array<{ x: number; y: number }> {
  const seen = new Set<string>()
  const out: Array<{ x: number; y: number }> = []
  for (const p of pixels) {
    const k = `${p.x},${p.y}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push(p)
  }
  return out
}

/**
 * 在指定帧/cel 的 ImageData 上写入像素（拷贝缓冲，保持不可变文档语义）
 */
export function paintPixelsOnDocument(
  doc: Document,
  frameIndex: number,
  celIndex: number,
  pixels: ReadonlyArray<{ x: number; y: number }>,
  rgba: Rgba,
): Document {
  const frame = doc.frames[frameIndex]
  if (!frame) return doc
  const cel = frame.cels[celIndex]
  if (!cel) return doc

  const { width: w, height: h } = doc
  const old = cel.imageData
  if (old.width !== w || old.height !== h) return doc

  const unique = dedupePixels(pixels)
  if (unique.length === 0) return doc

  const nextData = new Uint8ClampedArray(old.data)
  const [r, g, b, a] = rgba
  for (const { x, y } of unique) {
    if (x < 0 || y < 0 || x >= w || y >= h) continue
    const i = (y * w + x) * 4
    nextData[i] = r
    nextData[i + 1] = g
    nextData[i + 2] = b
    nextData[i + 3] = a
  }

  const newImageData = new ImageData(nextData, w, h)
  const newCel = { ...cel, imageData: newImageData }
  const newCels = [...frame.cels]
  newCels[celIndex] = newCel
  const newFrame = { ...frame, cels: newCels }
  const newFrames = [...doc.frames]
  newFrames[frameIndex] = newFrame
  return { ...doc, frames: newFrames }
}
