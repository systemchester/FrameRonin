/**
 * 下采样与量化流程对齐 https://github.com/KennethJAllen/proper-pixel-art/blob/main/proper_pixel_art/pixelate.py
 */
import type { Mesh } from './types'
import { makeBackgroundTransparent, paletteImage } from './colors'
import { scaleNearestAlpha, scaleNearestToSize } from './imageDataOps'

export interface ProcessWithMeshOptions {
  mesh: Mesh
  scaledWidth: number
  scaledHeight: number
  numColors: number | null
  /** 逻辑分辨率输出后，每格再最近邻放大倍数（CLI 默认 1；示例常用 8～20 便于观看） */
  scaleResult: number
  transparentBackground: boolean
}

const ALPHA_THRESHOLD = 128

function isMajorityTransparent(opaqueCount: number, totalCount: number): boolean {
  return opaqueCount <= totalCount / 2
}

function mostCommonRgbInCell(
  rgbData: Uint8ClampedArray,
  iw: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): [number, number, number] {
  const counts = new Map<string, number>()
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const p = (y * iw + x) * 4
      const k = `${rgbData[p]!},${rgbData[p + 1]!},${rgbData[p + 2]!}`
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
  }
  let best = '0,0,0'
  let bn = -1
  for (const [k, n] of counts) {
    if (n > bn) {
      bn = n
      best = k
    }
  }
  const [r, g, b] = best.split(',').map(Number)
  return [r!, g!, b!]
}

/**
 * scaledRgb：已量化并放大到 scaled 尺寸的 RGBA（仅用 RGB）
 * scaledAlpha：原图 alpha 最近邻到同尺寸
 */
function downsampleProper(
  scaledRgb: ImageData,
  scaledAlpha: Uint8ClampedArray,
  mesh: Mesh,
): ImageData {
  const [vx, hy] = mesh
  const iw = scaledRgb.width
  const ih = scaledRgb.height
  const outW = vx.length - 1
  const outH = hy.length - 1
  const out = new ImageData(outW, outH)

  for (let j = 0; j < outH; j++) {
    const y0 = Math.max(0, Math.min(ih, hy[j]!))
    const y1 = Math.max(0, Math.min(ih, hy[j + 1]!))
    for (let i = 0; i < outW; i++) {
      const x0 = Math.max(0, Math.min(iw, vx[i]!))
      const x1 = Math.max(0, Math.min(iw, vx[i + 1]!))
      const cellPixels = (x1 - x0) * (y1 - y0)
      if (cellPixels <= 0) {
        const oi = (j * outW + i) * 4
        out.data[oi + 3] = 0
        continue
      }
      let opaqueCount = 0
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          if (scaledAlpha[y * iw + x]! >= ALPHA_THRESHOLD) opaqueCount++
        }
      }
      const oi = (j * outW + i) * 4
      if (isMajorityTransparent(opaqueCount, cellPixels)) {
        out.data[oi] = 0
        out.data[oi + 1] = 0
        out.data[oi + 2] = 0
        out.data[oi + 3] = 0
      } else {
        const [r, g, b] = mostCommonRgbInCell(scaledRgb.data, iw, x0, y0, x1, y1)
        out.data[oi] = r
        out.data[oi + 1] = g
        out.data[oi + 2] = b
        out.data[oi + 3] = 255
      }
    }
  }
  return out
}

export function processWithMesh(originalRgba: ImageData, opts: ProcessWithMeshOptions): ImageData {
  const W = originalRgba.width
  const H = originalRgba.height
  const sw = opts.scaledWidth
  const sh = opts.scaledHeight

  const alpha = new Uint8ClampedArray(W * H)
  for (let i = 0, p = 0; i < alpha.length; i++, p += 4) {
    alpha[i] = originalRgba.data[p + 3]!
  }
  const scaledAlpha = scaleNearestAlpha(alpha, W, H, sw, sh)

  let processed = originalRgba
  if (opts.numColors != null && opts.numColors > 0) {
    processed = paletteImage(originalRgba, opts.numColors)
  }

  const scaledRgb = scaleNearestToSize(processed, sw, sh)

  let result = downsampleProper(scaledRgb, scaledAlpha, opts.mesh)

  if (opts.transparentBackground) {
    result = makeBackgroundTransparent(result)
  }

  const sr = Math.max(1, Math.min(5, Math.floor(opts.scaleResult)))
  if (sr > 1) {
    result = scaleNearestToSize(result, result.width * sr, result.height * sr)
  }

  return result
}
