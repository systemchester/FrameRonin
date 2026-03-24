import { applyPaletteSync, buildPaletteSync, utils } from 'image-q'
import { cloneImageData } from './imageDataOps'

export function paletteImage(imageData: ImageData, numColors: number): ImageData {
  const n = Math.max(2, Math.min(256, Math.floor(numColors)))
  const pc = utils.PointContainer.fromImageData(imageData)
  const palette = buildPaletteSync([pc], { paletteQuantization: 'wuquant', colors: n })
  const outPc = applyPaletteSync(pc, palette, { imageQuantization: 'nearest' })
  const w = outPc.getWidth()
  const h = outPc.getHeight()
  const u8 = outPc.toUint8Array()
  const copy = new Uint8ClampedArray(w * h * 4)
  copy.set(u8.subarray(0, w * h * 4))
  return new ImageData(copy, w, h)
}

/** 与 proper-pixel-art most_common_boundary_color + make_background_transparent：边界出现最多的 RGB 精确匹配则 alpha=0 */
export function makeBackgroundTransparent(img: ImageData): ImageData {
  const out = cloneImageData(img)
  const w = out.width
  const h = out.height
  if (w < 2 || h < 2) return out

  const counts = new Map<string, number>()
  const add = (base: number) => {
    if (out.data[base + 3]! < 128) return
    const k = `${out.data[base]!},${out.data[base + 1]!},${out.data[base + 2]!}`
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  for (let x = 0; x < w; x++) {
    add(x * 4)
    add(((h - 1) * w + x) * 4)
  }
  for (let y = 1; y < h - 1; y++) {
    add((y * w) * 4)
    add((y * w + (w - 1)) * 4)
  }
  if (counts.size === 0) return out
  let bestKey = '0,0,0'
  let bestN = 0
  for (const [k, n] of counts) {
    if (n > bestN) {
      bestN = n
      bestKey = k
    }
  }
  const [br, bg, bb] = bestKey.split(',').map(Number)
  for (let i = 0; i < out.data.length; i += 4) {
    if (out.data[i] === br && out.data[i + 1] === bg && out.data[i + 2] === bb) {
      out.data[i + 3] = 0
    }
  }
  return out
}
