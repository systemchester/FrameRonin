/**
 * 网格检测逻辑对齐 https://github.com/KennethJAllen/proper-pixel-art/blob/main/proper_pixel_art/mesh.py
 */
import type { Mesh } from './types'
import { clampAlphaCompositeForEdges, cropBorder, scaleNearestToSize } from './imageDataOps'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cv = any

function median(sortedOrArr: number[]): number {
  const s = [...sortedOrArr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]!
  return sorted[lo]! * (hi - idx) + sorted[hi]! * (idx - lo)
}

/** cluster_lines：与上一邻点距离 ≤ threshold 则并入，取簇中位数 */
function clusterLines(lines: number[], threshold = 4): number[] {
  if (lines.length === 0) return []
  const sorted = [...lines].sort((a, b) => a - b)
  const clusters: number[][] = [[sorted[0]!]]
  for (let i = 1; i < sorted.length; i++) {
    const p = sorted[i]!
    const last = clusters[clusters.length - 1]!
    const lastVal = last[last.length - 1]!
    if (Math.abs(p - lastVal) <= threshold) last.push(p)
    else clusters.push([p])
  }
  return clusters.map((c) => Math.round(median(c)))
}

function detectGridLines(cv: Cv, closed: Cv): Mesh {
  const width = closed.cols
  const height = closed.rows
  const lines = new cv.Mat()
  const houghThreshold = 100
  const minLineLength = 50
  const maxLineGap = 10
  const deg15 = (15 * Math.PI) / 180
  const deg75 = (75 * Math.PI) / 180

  let linesX = [0, width - 1]
  let linesY = [0, height - 1]

  try {
    cv.HoughLinesP(closed, lines, 1, Math.PI / 180, houghThreshold, minLineLength, maxLineGap)

    if (lines.rows > 0 && lines.data32S) {
      const d = lines.data32S
      const rowStride = 4
      for (let i = 0; i < lines.rows; i++) {
        const o = i * rowStride
        if (o + 3 >= d.length) break
        const x1 = d[o]!
        const y1 = d[o + 1]!
        const x2 = d[o + 2]!
        const y2 = d[o + 3]!
        const dx = x2 - x1
        const dy = y2 - y1
        const angle = Math.abs(Math.atan2(dy, dx))
        if (angle > deg75) {
          linesX.push(Math.round((x1 + x2) / 2))
        } else if (angle < deg15) {
          linesY.push(Math.round((y1 + y2) / 2))
        }
      }
    }

    linesX = clusterLines(linesX, 4)
    linesY = clusterLines(linesY, 4)
    return [linesX, linesY]
  } finally {
    lines.delete()
  }
}

function getPixelWidth(mesh: Mesh, trimOutlierFraction = 0.2): number {
  const gaps: number[] = []
  for (const L of mesh) {
    for (let i = 0; i < L.length - 1; i++) gaps.push(L[i + 1]! - L[i]!)
  }
  if (gaps.length === 0) return 8
  gaps.sort((a, b) => a - b)
  const low = percentile(gaps, 100 * trimOutlierFraction)
  const hi = percentile(gaps, 100 * (1 - trimOutlierFraction))
  const middle = gaps.filter((g) => g >= low && g <= hi)
  const use = middle.length > 0 ? middle : gaps
  return median(use)
}

/** homogenize_lines */
function homogenizeLines(lines: number[], pixelWidth: number): number[] {
  const n = lines.length
  if (n < 2) return [...lines]
  const sectionWidths: number[] = []
  for (let i = 0; i < n - 1; i++) sectionWidths.push(lines[i + 1]! - lines[i]!)

  const pieces: number[][] = []
  for (let index = 0; index < n - 1; index++) {
    const lineStart = lines[index]!
    const sectionWidth = sectionWidths[index]!
    let numPixels = Math.round(sectionWidth / pixelWidth)
    if (numPixels <= 0) {
      pieces.push([])
      continue
    }
    const sectionPixelWidth = sectionWidth / numPixels
    const sectionLines: number[] = []
    for (let nn = 0; nn < numPixels; nn++) {
      sectionLines.push(lineStart + Math.floor(nn * sectionPixelWidth))
    }
    pieces.push(sectionLines)
  }
  const flat = pieces.flat()
  flat.push(lines[n - 1]!)
  return [...new Set(flat)].sort((a, b) => a - b)
}

function isTrivialMesh(mesh: Mesh): boolean {
  const xn = mesh[0].length
  const yn = mesh[1].length
  return (xn === 2 || xn === 3) && (yn === 2 || yn === 3)
}

/** 裁边 2px 后的坐标系中的网格线 */
function computeMeshOnImage(cv: Cv, rgba: ImageData, closureKernelSize = 8): Mesh {
  const cropped = cropBorder(rgba, 2)
  const cw = cropped.width
  const ch = cropped.height
  if (cw < 16 || ch < 16) {
    return [
      [0, cw - 1],
      [0, ch - 1],
    ]
  }

  const composite = clampAlphaCompositeForEdges(cropped)
  const src = cv.matFromImageData(composite)
  const gray = new cv.Mat()
  const edges = new cv.Mat()
  const closed = new cv.Mat()
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(closureKernelSize, closureKernelSize))

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
    cv.Canny(gray, edges, 50, 200)
    cv.morphologyEx(edges, closed, cv.MORPH_CLOSE, kernel)

    let meshInitial = detectGridLines(cv, closed)
    const pixelWidth = Math.max(2, Math.round(getPixelWidth(meshInitial)))
    let linesX = homogenizeLines(meshInitial[0], pixelWidth)
    let linesY = homogenizeLines(meshInitial[1], pixelWidth)
    return [linesX, linesY]
  } finally {
    src.delete()
    gray.delete()
    edges.delete()
    kernel.delete()
    closed.delete()
  }
}

/** 裁边空间 → 完整放大图坐标（裁掉的两圈边补回 +2） */
function shiftCroppedMeshToFull(mesh: Mesh, fullW: number, fullH: number): Mesh {
  const vx = new Set<number>([0])
  for (const x of mesh[0]) vx.add(x + 2)
  vx.add(fullW)
  const hy = new Set<number>([0])
  for (const y of mesh[1]) hy.add(y + 2)
  hy.add(fullH)
  return [[...vx].sort((a, b) => a - b), [...hy].sort((a, b) => a - b)]
}

function fallbackUniformMesh(fullW: number, fullH: number, cell: number): Mesh {
  const c = Math.max(4, Math.floor(cell))
  const vx: number[] = [0]
  for (let x = c; x < fullW; x += c) vx.push(x)
  if (vx[vx.length - 1]! < fullW) vx.push(fullW)
  const ys: number[] = [0]
  for (let y = c; y < fullH; y += c) ys.push(y)
  if (ys[ys.length - 1]! < fullH) ys.push(fullH)
  return [vx, ys]
}

export interface MeshWithScale {
  mesh: Mesh
  scaleUsed: number
  scaledWidth: number
  scaledHeight: number
}

/**
 * 与 compute_mesh_with_scaling 一致：先对图做 nearest upscale，检测网格；
 * 若仅有 trivial 网格则退回在原图上 scale=1 检测。
 * 返回的 mesh 位于「与量化图同一尺寸」的坐标系：scaledWidth × scaledHeight。
 */
export function computeMeshWithScaling(cv: Cv, input: ImageData, upscale: number): MeshWithScale {
  const W = input.width
  const H = input.height
  const u = Math.max(2, Math.min(7, Math.floor(upscale)))
  const scaledW = Math.round(W * u)
  const scaledH = Math.round(H * u)
  const upscaled = scaleNearestToSize(input, scaledW, scaledH)

  let meshCrop = computeMeshOnImage(cv, upscaled)
  let scaleUsed = u

  if (isTrivialMesh(meshCrop)) {
    meshCrop = computeMeshOnImage(cv, input)
    scaleUsed = 1
  }

  const fw = scaleUsed === 1 ? W : scaledW
  const fh = scaleUsed === 1 ? H : scaledH
  let mesh = shiftCroppedMeshToFull(meshCrop, fw, fh)

  if (mesh[0].length < 3 || mesh[1].length < 3) {
    mesh = fallbackUniformMesh(fw, fh, Math.max(8, Math.min(fw, fh) / 24))
  }

  return { mesh, scaleUsed, scaledWidth: fw, scaledHeight: fh }
}
