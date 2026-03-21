/**
 * RoninPro 工作流：扩边、平分条带、合并条带、网格删扩复制行列、翻转行列
 * 网格类：单格宽高由「当前图尺寸 ÷ 列数/行数」自动推算；行列索引在业务层用 1 起始传入。
 */

async function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('ERR_IMAGE_LOAD'))
    }
    img.src = url
  })
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('ERR_EXPORT'))), 'image/png', 0.95)
  })
}

function inferCellSize(
  img: HTMLImageElement,
  gCols: number,
  gRows: number
): { cw: number; ch: number; gc: number; gr: number } {
  const gc = Math.max(1, Math.floor(gCols))
  const gr = Math.max(1, Math.floor(gRows))
  const cw = Math.max(1, Math.floor(img.naturalWidth / gc))
  const ch = Math.max(1, Math.floor(img.naturalHeight / gr))
  return { cw, ch, gc, gr }
}

/** 四向扩透明边 */
export async function wfPadExpand(
  blob: Blob,
  padTop: number,
  padRight: number,
  padBottom: number,
  padLeft: number
): Promise<Blob> {
  const img = await blobToImage(blob)
  const w = img.naturalWidth
  const h = img.naturalHeight
  const pt = Math.max(0, Math.round(padTop))
  const pr = Math.max(0, Math.round(padRight))
  const pb = Math.max(0, Math.round(padBottom))
  const pl = Math.max(0, Math.round(padLeft))
  const cw = w + pl + pr
  const ch = h + pt + pb
  const c = document.createElement('canvas')
  c.width = cw
  c.height = ch
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('ERR_CANVAS')
  ctx.drawImage(img, pl, pt)
  return canvasToPngBlob(c)
}

/**
 * 将图按 cols×rows 平分取样，按行主序拼成一条横向图带（每格 floor(W/cols)×floor(H/rows)）
 */
export async function wfEvenSplitStrip(blob: Blob, cols: number, rows: number): Promise<Blob> {
  const img = await blobToImage(blob)
  const W = img.naturalWidth
  const H = img.naturalHeight
  const c = Math.max(1, Math.floor(cols))
  const r = Math.max(1, Math.floor(rows))
  const aw = Math.floor(W / c)
  const ah = Math.floor(H / r)
  if (aw < 1 || ah < 1) throw new Error('ERR_GRID_TOO_LARGE')
  const n = c * r
  const out = document.createElement('canvas')
  out.width = n * aw
  out.height = ah
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('ERR_CANVAS')
  let x = 0
  for (let row = 0; row < r; row++) {
    for (let col = 0; col < c; col++) {
      const sx = col * aw
      const sy = row * ah
      ctx.drawImage(img, sx, sy, aw, ah, x, 0, aw, ah)
      x += aw
    }
  }
  return canvasToPngBlob(out)
}

export type MergeStripOpts = {
  /** 横条总帧数（≥1 时优先）：单帧宽 ≈ floor(图宽/帧数)，帧高=图高 */
  frameCount?: number
  /** 旧版：固定帧宽高 */
  frameW?: number
  frameH?: number
}

/**
 * 横向图带 → 按 mergeCols 列合并成图集。
 * 优先 frameCount；否则使用 frameW × frameH（与旧 JSON 兼容）。
 */
export async function wfMergeStrip(
  blob: Blob,
  mergeCols: number,
  opts: MergeStripOpts
): Promise<Blob> {
  const img = await blobToImage(blob)
  const W = img.naturalWidth
  const H = img.naturalHeight
  const mc = Math.max(1, Math.floor(mergeCols))
  let fw: number
  let fh: number
  let n: number
  let clipH: number

  const fc = opts.frameCount
  const useCount =
    fc !== undefined && fc !== null && Number.isFinite(fc) && (fc as number) >= 1

  if (useCount) {
    const want = Math.max(1, Math.floor(fc as number))
    n = Math.min(want, W)
    fw = Math.max(1, Math.floor(W / n))
    n = Math.floor(W / fw)
    fh = Math.max(1, H)
    clipH = H
  } else {
    fw = Math.max(1, Math.floor(opts.frameW ?? 32))
    fh = Math.max(1, Math.floor(opts.frameH ?? H))
    clipH = Math.min(H, fh)
    if (clipH < 1) throw new Error('ERR_FRAME_H')
    n = Math.floor(W / fw)
    if (n < 1) throw new Error('ERR_FRAME_W')
  }

  const mr = Math.ceil(n / mc)
  const out = document.createElement('canvas')
  out.width = mc * fw
  out.height = mr * fh
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('ERR_CANVAS')
  for (let i = 0; i < n; i++) {
    const col = i % mc
    const row = Math.floor(i / mc)
    const sx = i * fw
    ctx.drawImage(img, sx, 0, fw, clipH, col * fw, row * fh, fw, clipH)
  }
  return canvasToPngBlob(out)
}

/** rowIndex: 0 起始，内部用 */
export async function wfGridDeleteRow(
  blob: Blob,
  gCols: number,
  gRows: number,
  rowIndex0: number
): Promise<Blob> {
  const img = await blobToImage(blob)
  const { cw, ch, gc, gr } = inferCellSize(img, gCols, gRows)
  if (gr < 2) throw new Error('ERR_GRID_ROWS')
  const del = Math.max(0, Math.min(gr - 1, Math.floor(rowIndex0)))
  const out = document.createElement('canvas')
  out.width = gc * cw
  out.height = (gr - 1) * ch
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('ERR_CANVAS')
  let dr = 0
  for (let row = 0; row < gr; row++) {
    if (row === del) continue
    for (let col = 0; col < gc; col++) {
      const sx = col * cw
      const sy = row * ch
      ctx.drawImage(img, sx, sy, cw, ch, col * cw, dr * ch, cw, ch)
    }
    dr++
  }
  return canvasToPngBlob(out)
}

export async function wfGridDeleteCol(
  blob: Blob,
  gCols: number,
  gRows: number,
  colIndex0: number
): Promise<Blob> {
  const img = await blobToImage(blob)
  const { cw, ch, gc, gr } = inferCellSize(img, gCols, gRows)
  if (gc < 2) throw new Error('ERR_GRID_COLS')
  const del = Math.max(0, Math.min(gc - 1, Math.floor(colIndex0)))
  const out = document.createElement('canvas')
  out.width = (gc - 1) * cw
  out.height = gr * ch
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('ERR_CANVAS')
  let dc = 0
  for (let col = 0; col < gc; col++) {
    if (col === del) continue
    for (let row = 0; row < gr; row++) {
      const sx = col * cw
      const sy = row * ch
      ctx.drawImage(img, sx, sy, cw, ch, dc * cw, row * ch, cw, ch)
    }
    dc++
  }
  return canvasToPngBlob(out)
}

/**
 * 复制指定行到目标位置：从 sourceRow0 取整行像素，在 insertBefore0 行之前插入（0..gr，gr=贴底）；
 * 图集变为 gr+1 行。与扩行的「第 N 行之前」语义一致。
 */
export async function wfGridCopyRow(
  blob: Blob,
  gCols: number,
  gRows: number,
  sourceRow0: number,
  insertBefore0: number
): Promise<Blob> {
  const img = await blobToImage(blob)
  const { cw, ch, gc, gr } = inferCellSize(img, gCols, gRows)
  const src = Math.max(0, Math.min(gr - 1, Math.floor(sourceRow0)))
  const ins = Math.max(0, Math.min(gr, Math.floor(insertBefore0)))
  const sheetW = gc * cw
  const out = document.createElement('canvas')
  out.width = sheetW
  out.height = (gr + 1) * ch
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('ERR_CANVAS')
  let dy = 0
  for (let row = 0; row < gr; row++) {
    if (row === ins) {
      for (let col = 0; col < gc; col++) {
        const sx = col * cw
        const sy = src * ch
        ctx.drawImage(img, sx, sy, cw, ch, col * cw, dy, cw, ch)
      }
      dy += ch
    }
    for (let col = 0; col < gc; col++) {
      const sx = col * cw
      const sy = row * ch
      ctx.drawImage(img, sx, sy, cw, ch, col * cw, dy, cw, ch)
    }
    dy += ch
  }
  if (ins === gr) {
    for (let col = 0; col < gc; col++) {
      const sx = col * cw
      const sy = src * ch
      ctx.drawImage(img, sx, sy, cw, ch, col * cw, dy, cw, ch)
    }
  }
  return canvasToPngBlob(out)
}

/**
 * 复制指定列到目标位置：从 sourceCol0 取整列像素，在 insertBefore0 列之前插入（0..gc，gc=贴右）；
 * 图集变为 gc+1 列。
 */
export async function wfGridCopyCol(
  blob: Blob,
  gCols: number,
  gRows: number,
  sourceCol0: number,
  insertBefore0: number
): Promise<Blob> {
  const img = await blobToImage(blob)
  const { cw, ch, gc, gr } = inferCellSize(img, gCols, gRows)
  const src = Math.max(0, Math.min(gc - 1, Math.floor(sourceCol0)))
  const ins = Math.max(0, Math.min(gc, Math.floor(insertBefore0)))
  const out = document.createElement('canvas')
  out.width = (gc + 1) * cw
  out.height = gr * ch
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('ERR_CANVAS')
  let dx = 0
  for (let col = 0; col < gc; col++) {
    if (col === ins) {
      for (let row = 0; row < gr; row++) {
        const sx = src * cw
        const sy = row * ch
        ctx.drawImage(img, sx, sy, cw, ch, dx, row * ch, cw, ch)
      }
      dx += cw
    }
    for (let row = 0; row < gr; row++) {
      const sx = col * cw
      const sy = row * ch
      ctx.drawImage(img, sx, sy, cw, ch, dx, row * ch, cw, ch)
    }
    dx += cw
  }
  if (ins === gc) {
    for (let row = 0; row < gr; row++) {
      const sx = src * cw
      const sy = row * ch
      ctx.drawImage(img, sx, sy, cw, ch, dx, row * ch, cw, ch)
    }
  }
  return canvasToPngBlob(out)
}

/** atRow0: 0..gr，在「第 atRow0 行」之前插入一行高的透明带（高度=单格高 ch，由分割自动算） */
export async function wfGridExpandRow(
  blob: Blob,
  gCols: number,
  gRows: number,
  atRow0: number
): Promise<Blob> {
  const img = await blobToImage(blob)
  const { cw, ch, gc, gr } = inferCellSize(img, gCols, gRows)
  const sheetW = gc * cw
  const sheetH = gr * ch
  const at = Math.max(0, Math.min(gr, Math.floor(atRow0)))
  const ins = ch
  const out = document.createElement('canvas')
  out.width = sheetW
  out.height = sheetH + ins
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('ERR_CANVAS')
  const ySplit = at * ch
  const hTop = ySplit
  const hBot = sheetH - ySplit
  if (hTop > 0) ctx.drawImage(img, 0, 0, sheetW, hTop, 0, 0, sheetW, hTop)
  if (hBot > 0) ctx.drawImage(img, 0, ySplit, sheetW, hBot, 0, ySplit + ins, sheetW, hBot)
  return canvasToPngBlob(out)
}

/** 在「第 atCol0 列」之前插入一列宽的透明带（宽度=单格宽 cw，由分割自动算） */
export async function wfGridExpandCol(
  blob: Blob,
  gCols: number,
  gRows: number,
  atCol0: number
): Promise<Blob> {
  const img = await blobToImage(blob)
  const { cw, ch, gc, gr } = inferCellSize(img, gCols, gRows)
  const sheetW = gc * cw
  const sheetH = gr * ch
  const at = Math.max(0, Math.min(gc, Math.floor(atCol0)))
  const ins = cw
  const out = document.createElement('canvas')
  out.width = sheetW + ins
  out.height = sheetH
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('ERR_CANVAS')
  const xSplit = at * cw
  const wLeft = xSplit
  const wRight = sheetW - xSplit
  if (wLeft > 0) ctx.drawImage(img, 0, 0, wLeft, sheetH, 0, 0, wLeft, sheetH)
  if (wRight > 0) ctx.drawImage(img, xSplit, 0, wRight, sheetH, xSplit + ins, 0, wRight, sheetH)
  return canvasToPngBlob(out)
}

export async function wfGridFlipRow(
  blob: Blob,
  gCols: number,
  gRows: number,
  rowIndex0: number
): Promise<Blob> {
  const img = await blobToImage(blob)
  const { cw, ch, gc, gr } = inferCellSize(img, gCols, gRows)
  const sheetW = gc * cw
  const sheetH = gr * ch
  const flipRow = Math.max(0, Math.min(gr - 1, Math.floor(rowIndex0)))
  const out = document.createElement('canvas')
  out.width = sheetW
  out.height = sheetH
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('ERR_CANVAS')
  for (let row = 0; row < gr; row++) {
    for (let col = 0; col < gc; col++) {
      const sx = col * cw
      const sy = row * ch
      const dx = col * cw
      const dy = row * ch
      if (row === flipRow) {
        ctx.save()
        ctx.translate(dx + cw, dy)
        ctx.scale(-1, 1)
        ctx.drawImage(img, sx, sy, cw, ch, 0, 0, cw, ch)
        ctx.restore()
      } else {
        ctx.drawImage(img, sx, sy, cw, ch, dx, dy, cw, ch)
      }
    }
  }
  return canvasToPngBlob(out)
}

export async function wfGridFlipCol(
  blob: Blob,
  gCols: number,
  gRows: number,
  colIndex0: number
): Promise<Blob> {
  const img = await blobToImage(blob)
  const { cw, ch, gc, gr } = inferCellSize(img, gCols, gRows)
  const sheetW = gc * cw
  const sheetH = gr * ch
  const flipCol = Math.max(0, Math.min(gc - 1, Math.floor(colIndex0)))
  const out = document.createElement('canvas')
  out.width = sheetW
  out.height = sheetH
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('ERR_CANVAS')
  for (let row = 0; row < gr; row++) {
    for (let col = 0; col < gc; col++) {
      const sx = col * cw
      const sy = row * ch
      const dx = col * cw
      const dy = row * ch
      if (col === flipCol) {
        ctx.save()
        ctx.translate(dx, dy + ch)
        ctx.scale(1, -1)
        ctx.drawImage(img, sx, sy, cw, ch, 0, 0, cw, ch)
        ctx.restore()
      } else {
        ctx.drawImage(img, sx, sy, cw, ch, dx, dy, cw, ch)
      }
    }
  }
  return canvasToPngBlob(out)
}

/** 与自定义切图一致：行主序，第 1 块 = 左上 */
function splitToFrames(img: HTMLImageElement, cols: number, rows: number): HTMLCanvasElement[] {
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
      const ctx = c.getContext('2d')
      if (!ctx) continue
      ctx.drawImage(img, sx, sy, w, h, 0, 0, w, h)
      results.push(c)
    }
  }
  return results
}

/**
 * 自定义均分重组：先按 splitCols×splitRows 均分切块（行主序编号 1..N），
 * 再按 grid[输出行][输出列] 填入块号（1 起，0 空，负数为水平翻转），输出 outCols×outRows 格图集。
 */
export async function wfCustomGridRearrange(
  blob: Blob,
  splitCols: number,
  splitRows: number,
  outRows: number,
  outCols: number,
  grid: number[][]
): Promise<Blob> {
  const img = await blobToImage(blob)
  const frames = splitToFrames(img, splitCols, splitRows)
  const frameCount = frames.length
  if (frameCount < 1) throw new Error('ERR_NO_FRAMES')

  const or = Math.max(1, Math.floor(outRows))
  const oc = Math.max(1, Math.floor(outCols))
  const sizes = frames.map((f) => ({ w: f.width, h: f.height }))
  const cellW = Math.max(1, ...sizes.map((s) => s.w))
  const cellH = Math.max(1, ...sizes.map((s) => s.h))

  const out = document.createElement('canvas')
  out.width = oc * cellW
  out.height = or * cellH
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('ERR_CANVAS')
  ctx.imageSmoothingEnabled = false

  for (let row = 0; row < or; row++) {
    for (let col = 0; col < oc; col++) {
      const val = grid[row]?.[col] ?? 0
      const absVal = Math.abs(val)
      if (absVal === 0 || absVal > frameCount) continue
      const f = frames[absVal - 1]!
      const dx = col * cellW
      const dy = row * cellH
      if (val < 0) {
        ctx.save()
        ctx.translate(dx + cellW, dy)
        ctx.scale(-1, 1)
        ctx.drawImage(f, 0, 0, f.width, f.height, 0, 0, cellW, cellH)
        ctx.restore()
      } else {
        ctx.drawImage(f, 0, 0, f.width, f.height, dx, dy, cellW, cellH)
      }
    }
  }
  return canvasToPngBlob(out)
}
