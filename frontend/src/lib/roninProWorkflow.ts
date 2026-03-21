/**
 * RoninPro 自定义流程：预设节点顺序执行（多图共用同一 JSON 流程）
 */
import {
  applyChromaKey,
  applyChromaKeyContiguousFromTopLeft,
  cropImageBlob,
  getTopLeftPixelColor,
  resizeImageToBlob,
} from '../components/ParamsStep/utils'
import { removeGeminiWatermarkFromBlob } from './geminiWatermark'
import {
  wfEvenSplitStrip,
  wfGridCopyCol,
  wfGridCopyRow,
  wfGridDeleteCol,
  wfGridDeleteRow,
  wfGridExpandCol,
  wfGridExpandRow,
  wfCustomGridRearrange,
  wfGridFlipCol,
  wfGridFlipRow,
  wfMergeStrip,
  wfPadExpand,
} from './roninProWorkflowGridOps'

export const RONIN_PRO_WORKFLOW_VERSION = 1

export type WorkflowNodeType =
  | 'geminiWatermarkRemove'
  | 'resize'
  | 'crop'
  | 'matteContiguous'
  | 'matteGlobal'
  | 'padExpand'
  | 'evenSplitStrip'
  | 'mergeStrip'
  | 'gridDeleteRow'
  | 'gridDeleteCol'
  | 'gridExpandRow'
  | 'gridExpandCol'
  | 'gridFlipRow'
  | 'gridFlipCol'
  | 'gridCopyRow'
  | 'gridCopyCol'
  | 'customGridRearrange'

export interface WorkflowNode {
  id: string
  type: WorkflowNodeType
  /** 数值参数（布尔用 0/1 存 JSON） */
  params: Record<string, number>
  /**
   * 仅 customGridRearrange：输出格内切块编号（1 起行主序，0 空，负数为水平翻转）
   * 与 JSON 字段 rearrangeGrid 对应
   */
  rearrangeGrid?: number[][]
}

/** 蓝图连线：上游 output → 下游 input */
export interface WorkflowEdge {
  id: string
  source: string
  target: string
}

/** 画布上的节点（含坐标） */
export type GraphNode = WorkflowNode & { x: number; y: number }

export const RONIN_PRO_WORKFLOW_GRAPH_VERSION = 3

export interface WorkflowDocument {
  version: number
  nodes: WorkflowNode[]
  edges?: WorkflowEdge[]
}

export const WORKFLOW_PALETTE: { type: WorkflowNodeType; defaultParams: Record<string, number> }[] = [
  { type: 'geminiWatermarkRemove', defaultParams: {} },
  { type: 'resize', defaultParams: { w: 256, h: 256, keepAspect: 1, pixelated: 1 } },
  { type: 'crop', defaultParams: { left: 0, top: 0, right: 0, bottom: 0 } },
  { type: 'matteContiguous', defaultParams: { tolerance: 80, feather: 5 } },
  { type: 'matteGlobal', defaultParams: { tolerance: 80, feather: 5 } },
  { type: 'padExpand', defaultParams: { padTop: 0, padRight: 0, padBottom: 0, padLeft: 0 } },
  { type: 'evenSplitStrip', defaultParams: { evenCols: 4, evenRows: 4 } },
  { type: 'mergeStrip', defaultParams: { mergeCols: 4, frameCount: 16 } },
  {
    type: 'gridDeleteRow',
    defaultParams: { gCols: 4, gRows: 4, rowIndex: 1 },
  },
  {
    type: 'gridDeleteCol',
    defaultParams: { gCols: 4, gRows: 4, colIndex: 1 },
  },
  {
    type: 'gridExpandRow',
    defaultParams: { gCols: 4, gRows: 4, atRow: 1 },
  },
  {
    type: 'gridExpandCol',
    defaultParams: { gCols: 4, gRows: 4, atCol: 1 },
  },
  {
    type: 'gridFlipRow',
    defaultParams: { gCols: 4, gRows: 4, rowIndex: 1 },
  },
  {
    type: 'gridFlipCol',
    defaultParams: { gCols: 4, gRows: 4, colIndex: 1 },
  },
  {
    type: 'gridCopyRow',
    defaultParams: { gCols: 4, gRows: 4, rowIndex: 1, atRow: 2 },
  },
  {
    type: 'gridCopyCol',
    defaultParams: { gCols: 4, gRows: 4, colIndex: 1, atCol: 2 },
  },
  {
    type: 'customGridRearrange',
    defaultParams: { splitCols: 2, splitRows: 2, outRows: 2, outCols: 2 },
  },
]

/** 输出表默认按行主序填入 1..切分块数，超出为 0 */
export function buildDefaultRearrangeGrid(
  outRows: number,
  outCols: number,
  splitCols: number,
  splitRows: number
): number[][] {
  const or = Math.max(1, Math.floor(outRows))
  const oc = Math.max(1, Math.floor(outCols))
  const n = Math.max(1, Math.floor(splitCols)) * Math.max(1, Math.floor(splitRows))
  const grid: number[][] = []
  let k = 1
  for (let r = 0; r < or; r++) {
    const row: number[] = []
    for (let c = 0; c < oc; c++) {
      row.push(k <= n ? k : 0)
      k++
    }
    grid.push(row)
  }
  return grid
}

/** 改输出尺寸或切分尺寸时裁剪/补零，并钳位标号到有效块范围 */
export function resizeRearrangeGrid(
  grid: number[][] | undefined,
  outRows: number,
  outCols: number,
  splitCols: number,
  splitRows: number
): number[][] {
  const or = Math.max(1, Math.floor(outRows))
  const oc = Math.max(1, Math.floor(outCols))
  const n = Math.max(1, Math.floor(splitCols)) * Math.max(1, Math.floor(splitRows))
  const next: number[][] = []
  for (let r = 0; r < or; r++) {
    const row: number[] = []
    for (let c = 0; c < oc; c++) {
      const v = grid?.[r]?.[c]
      if (typeof v === 'number' && Number.isFinite(v)) {
        const t = Math.trunc(v)
        const abs = Math.abs(t)
        row.push(abs === 0 || abs > n ? 0 : t)
      } else {
        row.push(0)
      }
    }
    next.push(row)
  }
  return next
}

export function createWorkflowNode(type: WorkflowNodeType): WorkflowNode {
  const preset = WORKFLOW_PALETTE.find((p) => p.type === type)
  const params = { ...(preset?.defaultParams ?? {}) }
  const node: WorkflowNode = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `n-${Date.now()}-${Math.random()}`,
    type,
    params,
  }
  if (type === 'customGridRearrange') {
    const or = Math.max(1, Math.round(params.outRows ?? 2))
    const oc = Math.max(1, Math.round(params.outCols ?? 2))
    const sc = Math.max(1, Math.round(params.splitCols ?? 2))
    const sr = Math.max(1, Math.round(params.splitRows ?? 2))
    node.rearrangeGrid = buildDefaultRearrangeGrid(or, oc, sc, sr)
  }
  return node
}

export function createGraphNode(type: WorkflowNodeType, x: number, y: number): GraphNode {
  const base = createWorkflowNode(type)
  return { ...base, x, y }
}

/** 用户 1 起始行号 → 内部 0 起始 */
function gridRow1To0(row1: number | undefined, gRows: number): number {
  const gr = Math.max(1, Math.round(gRows))
  const r = Math.max(1, Math.round(row1 ?? 1))
  return Math.min(gr - 1, r - 1)
}

function gridCol1To0(col1: number | undefined, gCols: number): number {
  const gc = Math.max(1, Math.round(gCols))
  const c = Math.max(1, Math.round(col1 ?? 1))
  return Math.min(gc - 1, c - 1)
}

/** 在第 N 行前插入透明横带，N=1..行数+1（行数+1=贴底插入） */
function expandRow1To0(at1: number | undefined, gRows: number): number {
  const gr = Math.max(1, Math.round(gRows))
  const maxN = gr + 1
  const a = Math.max(1, Math.round(at1 ?? 1))
  const clamped = Math.min(maxN, a)
  return Math.min(gr, clamped - 1)
}

function expandCol1To0(at1: number | undefined, gCols: number): number {
  const gc = Math.max(1, Math.round(gCols))
  const maxN = gc + 1
  const a = Math.max(1, Math.round(at1 ?? 1))
  const clamped = Math.min(maxN, a)
  return Math.min(gc, clamped - 1)
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error('ERR_READ_BLOB'))
    r.readAsDataURL(blob)
  })
}

async function runOneStep(blob: Blob, node: WorkflowNode): Promise<Blob> {
  const p = node.params
  switch (node.type) {
    case 'geminiWatermarkRemove':
      return removeGeminiWatermarkFromBlob(blob)
    case 'resize': {
      const w = Math.max(1, Math.round(p.w ?? 256))
      const h = Math.max(1, Math.round(p.h ?? 256))
      const keepAspect = (p.keepAspect ?? 1) !== 0
      const pixelated = (p.pixelated ?? 1) !== 0
      return resizeImageToBlob(blob, w, h, keepAspect, pixelated)
    }
    case 'crop': {
      return cropImageBlob(blob, {
        left: Math.max(0, Math.round(p.left ?? 0)),
        top: Math.max(0, Math.round(p.top ?? 0)),
        right: Math.max(0, Math.round(p.right ?? 0)),
        bottom: Math.max(0, Math.round(p.bottom ?? 0)),
      })
    }
    case 'matteContiguous':
    case 'matteGlobal': {
      const { r, g, b } = await getTopLeftPixelColor(blob)
      const dataUrl = await blobToDataUrl(blob)
      const tolerance = Math.max(0, p.tolerance ?? 80)
      const feather = Math.max(0, p.feather ?? 5)
      const res =
        node.type === 'matteContiguous'
          ? await applyChromaKeyContiguousFromTopLeft(dataUrl, r, g, b, tolerance, feather)
          : await applyChromaKey(dataUrl, r, g, b, tolerance, feather)
      return res.blob
    }
    case 'padExpand':
      return wfPadExpand(
        blob,
        p.padTop ?? 0,
        p.padRight ?? 0,
        p.padBottom ?? 0,
        p.padLeft ?? 0
      )
    case 'evenSplitStrip':
      return wfEvenSplitStrip(blob, p.evenCols ?? 4, p.evenRows ?? 4)
    case 'mergeStrip':
      return wfMergeStrip(blob, p.mergeCols ?? 4, {
        frameCount: p.frameCount,
        frameW: p.frameW,
        frameH: p.frameH,
      })
    case 'gridDeleteRow': {
      const gc = Math.max(1, Math.round(p.gCols ?? 4))
      const gr = Math.max(1, Math.round(p.gRows ?? 4))
      return wfGridDeleteRow(blob, gc, gr, gridRow1To0(p.rowIndex, gr))
    }
    case 'gridDeleteCol': {
      const gc = Math.max(1, Math.round(p.gCols ?? 4))
      const gr = Math.max(1, Math.round(p.gRows ?? 4))
      return wfGridDeleteCol(blob, gc, gr, gridCol1To0(p.colIndex, gc))
    }
    case 'gridExpandRow': {
      const gc = Math.max(1, Math.round(p.gCols ?? 4))
      const gr = Math.max(1, Math.round(p.gRows ?? 4))
      return wfGridExpandRow(blob, gc, gr, expandRow1To0(p.atRow, gr))
    }
    case 'gridExpandCol': {
      const gc = Math.max(1, Math.round(p.gCols ?? 4))
      const gr = Math.max(1, Math.round(p.gRows ?? 4))
      return wfGridExpandCol(blob, gc, gr, expandCol1To0(p.atCol, gc))
    }
    case 'gridFlipRow': {
      const gc = Math.max(1, Math.round(p.gCols ?? 4))
      const gr = Math.max(1, Math.round(p.gRows ?? 4))
      return wfGridFlipRow(blob, gc, gr, gridRow1To0(p.rowIndex, gr))
    }
    case 'gridFlipCol': {
      const gc = Math.max(1, Math.round(p.gCols ?? 4))
      const gr = Math.max(1, Math.round(p.gRows ?? 4))
      return wfGridFlipCol(blob, gc, gr, gridCol1To0(p.colIndex, gc))
    }
    case 'gridCopyRow': {
      const gc = Math.max(1, Math.round(p.gCols ?? 4))
      const gr = Math.max(1, Math.round(p.gRows ?? 4))
      return wfGridCopyRow(
        blob,
        gc,
        gr,
        gridRow1To0(p.rowIndex, gr),
        expandRow1To0(p.atRow, gr)
      )
    }
    case 'gridCopyCol': {
      const gc = Math.max(1, Math.round(p.gCols ?? 4))
      const gr = Math.max(1, Math.round(p.gRows ?? 4))
      return wfGridCopyCol(
        blob,
        gc,
        gr,
        gridCol1To0(p.colIndex, gc),
        expandCol1To0(p.atCol, gc)
      )
    }
    case 'customGridRearrange': {
      const sc = Math.max(1, Math.round(p.splitCols ?? 2))
      const sr = Math.max(1, Math.round(p.splitRows ?? 2))
      const or = Math.max(1, Math.round(p.outRows ?? 2))
      const oc = Math.max(1, Math.round(p.outCols ?? 2))
      const grid =
        node.rearrangeGrid ??
        buildDefaultRearrangeGrid(or, oc, sc, sr)
      return wfCustomGridRearrange(blob, sc, sr, or, oc, grid)
    }
    default:
      return blob
  }
}

/** 按节点顺序处理单张 Blob，返回 PNG Blob */
export async function runWorkflowOnBlob(blob: Blob, nodes: WorkflowNode[]): Promise<Blob> {
  let b = blob
  for (const node of nodes) {
    b = await runOneStep(b, node)
  }
  return b
}

export function serializeWorkflow(nodes: WorkflowNode[]): string {
  const doc: WorkflowDocument = { version: RONIN_PRO_WORKFLOW_VERSION, nodes }
  return JSON.stringify(doc, null, 2)
}

export function serializeWorkflowGraph(nodes: GraphNode[], edges: WorkflowEdge[]): string {
  const doc: WorkflowDocument = {
    version: RONIN_PRO_WORKFLOW_GRAPH_VERSION,
    nodes,
    edges,
  }
  return JSON.stringify(doc, null, 2)
}

export type ExecutionOrderError =
  | 'MULTIPLE_HEADS'
  | 'MULTIPLE_OUTPUT'
  | 'MULTIPLE_INPUT'
  | 'CYCLE'
  | 'DISCONNECTED'

/** 无连线时按从左到右执行；有连线时必须为单链（每节点最多一进一出） */
export function getExecutionOrder(
  nodes: GraphNode[],
  edges: WorkflowEdge[]
): { ok: true; order: WorkflowNode[] } | { ok: false; reason: ExecutionOrderError } {
  if (nodes.length === 0) {
    return { ok: true, order: [] }
  }
  const idSet = new Set(nodes.map((n) => n.id))
  const filtered = edges.filter((e) => idSet.has(e.source) && idSet.has(e.target))

  if (filtered.length === 0) {
    const sorted = [...nodes].sort((a, b) => a.x - b.x || a.y - b.y)
    return { ok: true, order: sorted }
  }

  const out = new Map<string, string>()
  const inc = new Map<string, string>()
  for (const e of filtered) {
    if (out.has(e.source)) return { ok: false, reason: 'MULTIPLE_OUTPUT' }
    if (inc.has(e.target)) return { ok: false, reason: 'MULTIPLE_INPUT' }
    out.set(e.source, e.target)
    inc.set(e.target, e.source)
  }

  const heads = nodes.filter((n) => !inc.has(n.id))
  if (heads.length !== 1) {
    return { ok: false, reason: heads.length === 0 ? 'CYCLE' : 'MULTIPLE_HEADS' }
  }

  const byId = new Map(nodes.map((n) => [n.id, n]))
  const order: WorkflowNode[] = []
  let cur: string | undefined = heads[0]!.id
  const seen = new Set<string>()
  while (cur) {
    if (seen.has(cur)) return { ok: false, reason: 'CYCLE' }
    seen.add(cur)
    const n = byId.get(cur)
    if (n) order.push(n)
    cur = out.get(cur)
  }
  if (seen.size !== nodes.length) return { ok: false, reason: 'DISCONNECTED' }
  return { ok: true, order }
}

const VALID_TYPES = new Set<WorkflowNodeType>([
  'geminiWatermarkRemove',
  'resize',
  'crop',
  'matteContiguous',
  'matteGlobal',
  'padExpand',
  'evenSplitStrip',
  'mergeStrip',
  'gridDeleteRow',
  'gridDeleteCol',
  'gridExpandRow',
  'gridExpandCol',
  'gridFlipRow',
  'gridFlipCol',
  'gridCopyRow',
  'gridCopyCol',
  'customGridRearrange',
])

const GRID_ONE_BASED_INDEX_TYPES = new Set<WorkflowNodeType>([
  'gridDeleteRow',
  'gridDeleteCol',
  'gridExpandRow',
  'gridExpandCol',
  'gridFlipRow',
  'gridFlipCol',
  'gridCopyRow',
  'gridCopyCol',
])

/** v2 文档里网格索引为 0 起始，v3 起为 1 起始（仅对 JSON 里出现过的字段 +1） */
function migrateGridIndicesV2ToV3(
  type: WorkflowNodeType,
  params: Record<string, number>,
  rawKeys: Set<string>
) {
  if (!GRID_ONE_BASED_INDEX_TYPES.has(type)) return
  for (const k of ['rowIndex', 'colIndex', 'atRow', 'atCol'] as const) {
    if (
      rawKeys.has(k) &&
      typeof params[k] === 'number' &&
      Number.isFinite(params[k])
    ) {
      params[k] = params[k] + 1
    }
  }
}

function parseOneNode(n: unknown, index: number, docVersion: number): GraphNode | null {
  if (!n || typeof n !== 'object') return null
  const rec = n as Record<string, unknown>
  if (typeof rec.type !== 'string' || !VALID_TYPES.has(rec.type as WorkflowNodeType)) {
    return null
  }
  const type = rec.type as WorkflowNodeType
  const preset = WORKFLOW_PALETTE.find((p) => p.type === type)
  const defaults = preset?.defaultParams ?? {}
  const raw =
    typeof rec.params === 'object' && rec.params ? (rec.params as Record<string, number>) : {}
  const rawKeys = new Set(Object.keys(raw))
  const params: Record<string, number> = { ...defaults }
  for (const k of Object.keys(raw)) {
    const v = raw[k]
    if (typeof v === 'number' && Number.isFinite(v)) params[k] = v
  }
  if (docVersion < RONIN_PRO_WORKFLOW_GRAPH_VERSION) {
    migrateGridIndicesV2ToV3(type, params, rawKeys)
  }
  if (type === 'mergeStrip' && rawKeys.has('frameW') && !rawKeys.has('frameCount')) {
    delete params.frameCount
  }
  const id = rec.id && typeof rec.id === 'string' ? rec.id : createWorkflowNode(type).id
  const x =
    typeof rec.x === 'number' && Number.isFinite(rec.x) ? rec.x : 100 + index * 260
  const y = typeof rec.y === 'number' && Number.isFinite(rec.y) ? rec.y : 160
  if (type !== 'customGridRearrange') {
    return { id, type, params, x, y }
  }
  const or = Math.max(1, Math.round(params.outRows ?? 2))
  const oc = Math.max(1, Math.round(params.outCols ?? 2))
  const sc = Math.max(1, Math.round(params.splitCols ?? 2))
  const sr = Math.max(1, Math.round(params.splitRows ?? 2))
  let parsedFromJson: number[][] | undefined
  const rg = rec.rearrangeGrid
  if (Array.isArray(rg)) {
    parsedFromJson = rg.map((row) => {
      if (!Array.isArray(row)) return []
      return row.map((cell) =>
        typeof cell === 'number' && Number.isFinite(cell) ? Math.trunc(cell) : 0
      )
    })
  }
  const rearrangeGrid = resizeRearrangeGrid(parsedFromJson, or, oc, sc, sr)
  return { id, type, params, x, y, rearrangeGrid }
}

export function parseWorkflowGraph(text: string): { nodes: GraphNode[]; edges: WorkflowEdge[] } {
  const data = JSON.parse(text) as WorkflowDocument & { edges?: unknown[] }
  if (!data || typeof data.version !== 'number' || !Array.isArray(data.nodes)) {
    throw new Error('INVALID_WORKFLOW_JSON')
  }
  const docVersion = data.version
  const nodes: GraphNode[] = []
  let i = 0
  for (const n of data.nodes) {
    const parsed = parseOneNode(n, i, docVersion)
    if (parsed) {
      nodes.push(parsed)
      i++
    }
  }
  const edges: WorkflowEdge[] = []
  if (Array.isArray(data.edges)) {
    for (const e of data.edges) {
      if (!e || typeof e !== 'object') continue
      const ex = e as unknown as Record<string, unknown>
      if (typeof ex.source !== 'string' || typeof ex.target !== 'string') continue
      edges.push({
        id:
          typeof ex.id === 'string'
            ? ex.id
            : `e-${ex.source}-${ex.target}-${Math.random().toString(36).slice(2, 9)}`,
        source: ex.source,
        target: ex.target,
      })
    }
  }
  return { nodes, edges }
}

export function parseWorkflowJson(text: string): WorkflowNode[] {
  return parseWorkflowGraph(text).nodes
}
