/**
 * 精灵表网格均分切分 + 像素级重复帧分组（同尺寸格之间比较）
 */

export function splitSpriteSheetGrid(
  img: HTMLImageElement,
  cols: number,
  rows: number
): HTMLCanvasElement[] {
  const fullW = img.naturalWidth
  const fullH = img.naturalHeight
  const colsNum = Math.max(1, Math.floor(cols))
  const rowsNum = Math.max(1, Math.floor(rows))
  const results: HTMLCanvasElement[] = []

  for (let row = 0; row < rowsNum; row++) {
    for (let col = 0; col < colsNum; col++) {
      const sx = Math.floor((col * fullW) / colsNum)
      const ex = Math.floor(((col + 1) * fullW) / colsNum)
      const sy = Math.floor((row * fullH) / rowsNum)
      const ey = Math.floor(((row + 1) * fullH) / rowsNum)
      const w = Math.max(1, ex - sx)
      const h = Math.max(1, ey - sy)
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d')!
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(img, sx, sy, w, h, 0, 0, w, h)
      results.push(c)
    }
  }
  return results
}

function equalRgba(a: Uint8ClampedArray, b: Uint8ClampedArray): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

function fnv1a32(bytes: Uint8Array): number {
  let h = 0x811c9dc5
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i]!
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** 返回若干组「全局帧下标」（0-based），每组至少 2 个下标且像素内容完全相同 */
export function findDuplicateFrameIndexGroups(canvases: HTMLCanvasElement[]): number[][] {
  const imageDatas: ImageData[] = []
  for (const c of canvases) {
    const ctx = c.getContext('2d')!
    imageDatas.push(ctx.getImageData(0, 0, c.width, c.height))
  }

  const n = imageDatas.length
  const byDim = new Map<string, number[]>()
  for (let i = 0; i < n; i++) {
    const id = imageDatas[i]!
    const key = `${id.width}x${id.height}`
    const arr = byDim.get(key) ?? []
    arr.push(i)
    byDim.set(key, arr)
  }

  const out: number[][] = []

  for (const globalIdx of byDim.values()) {
    if (globalIdx.length < 2) continue
    const m = globalIdx.length
    const parent = new Uint32Array(m)
    for (let i = 0; i < m; i++) parent[i] = i

    const find = (x: number): number => {
      let p = parent[x]!
      while (p !== parent[p]!) p = parent[p]!
      while (x !== p) {
        const t = parent[x]!
        parent[x] = p
        x = t
      }
      return p
    }
    const union = (a: number, b: number) => {
      const ra = find(a)
      const rb = find(b)
      if (ra !== rb) parent[ra] = rb
    }

    const dataAt = (local: number) => imageDatas[globalIdx[local]!]!.data
    const bytesAt = (local: number) =>
      new Uint8Array(dataAt(local).buffer, dataAt(local).byteOffset, dataAt(local).byteLength)

    const byHash = new Map<number, number[]>()
    for (let li = 0; li < m; li++) {
      const h = fnv1a32(bytesAt(li))
      const arr = byHash.get(h) ?? []
      arr.push(li)
      byHash.set(h, arr)
    }

    for (const bucket of byHash.values()) {
      if (bucket.length < 2) continue
      for (let a = 0; a < bucket.length; a++) {
        for (let b = a + 1; b < bucket.length; b++) {
          const ia = bucket[a]!
          const ib = bucket[b]!
          if (equalRgba(dataAt(ia), dataAt(ib))) union(ia, ib)
        }
      }
    }

    const clusters = new Map<number, number[]>()
    for (let li = 0; li < m; li++) {
      const r = find(li)
      const arr = clusters.get(r) ?? []
      arr.push(li)
      clusters.set(r, arr)
    }

    for (const locals of clusters.values()) {
      if (locals.length < 2) continue
      const globals = locals.map((li) => globalIdx[li]!).sort((x, y) => x - y)
      out.push(globals)
    }
  }

  out.sort((a, b) => a[0]! - b[0]!)
  return out
}
