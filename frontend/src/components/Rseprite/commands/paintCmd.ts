import type { Document } from '../types'

/** 单次涂抹命令：矩形区域内的前后像素快照（用于撤销/重做） */
export interface PaintCmd {
  frameIndex: number
  celIndex: number
  x: number
  y: number
  width: number
  height: number
  /** 操作前 w×h×4 */
  before: Uint8ClampedArray
  /** 操作后 w×h×4 */
  after: Uint8ClampedArray
}

export const MAX_UNDO_STACK = 50

export function boundsFromPixels(
  pixels: ReadonlyArray<{ x: number; y: number }>,
  docW: number,
  docH: number,
): { x: number; y: number; width: number; height: number } | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pixels) {
    if (p.x < 0 || p.y < 0 || p.x >= docW || p.y >= docH) continue
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  if (minX === Infinity) return null
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  }
}

export function copyRegion(
  imageData: ImageData,
  x: number,
  y: number,
  rw: number,
  rh: number,
): Uint8ClampedArray {
  const src = imageData.data
  const fullW = imageData.width
  const out = new Uint8ClampedArray(rw * rh * 4)
  for (let row = 0; row < rh; row++) {
    const srcBase = ((y + row) * fullW + x) * 4
    const dstBase = row * rw * 4
    for (let col = 0; col < rw; col++) {
      const si = srcBase + col * 4
      const di = dstBase + col * 4
      out[di] = src[si]
      out[di + 1] = src[si + 1]
      out[di + 2] = src[si + 2]
      out[di + 3] = src[si + 3]
    }
  }
  return out
}

/** 将 patch 贴回 cel 的矩形区域，返回新 Document */
export function applyRegionToDocument(
  doc: Document,
  frameIndex: number,
  celIndex: number,
  x: number,
  y: number,
  rw: number,
  rh: number,
  patch: Uint8ClampedArray,
): Document {
  if (patch.length !== rw * rh * 4) return doc
  const frame = doc.frames[frameIndex]
  if (!frame) return doc
  const cel = frame.cels[celIndex]
  if (!cel) return doc
  const img = cel.imageData
  const fullW = img.width
  const fullH = img.height
  if (x < 0 || y < 0 || x + rw > fullW || y + rh > fullH) return doc

  const data = new Uint8ClampedArray(img.data)
  for (let row = 0; row < rh; row++) {
    const dstRow = ((y + row) * fullW + x) * 4
    const srcRow = row * rw * 4
    for (let col = 0; col < rw; col++) {
      const di = dstRow + col * 4
      const si = srcRow + col * 4
      data[di] = patch[si]
      data[di + 1] = patch[si + 1]
      data[di + 2] = patch[si + 2]
      data[di + 3] = patch[si + 3]
    }
  }

  const newImageData = new ImageData(data, fullW, fullH)
  const newCel = { ...cel, imageData: newImageData }
  const newCels = [...frame.cels]
  newCels[celIndex] = newCel
  const newFrame = { ...frame, cels: newCels }
  const newFrames = [...doc.frames]
  newFrames[frameIndex] = newFrame
  return { ...doc, frames: newFrames }
}

function trimUndoStack<T>(stack: T[], max: number): T[] {
  if (stack.length <= max) return stack
  return stack.slice(stack.length - max)
}

export function pushPaintCommand(
  undoStack: PaintCmd[],
  cmd: PaintCmd,
): PaintCmd[] {
  return trimUndoStack([...undoStack, cmd], MAX_UNDO_STACK)
}
