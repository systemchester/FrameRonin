/**
 * RoninPro 自定义流程：预设节点顺序执行（多图共用同一 JSON 流程）
 */
import {
  applyChromaKey,
  applyChromaKeyContiguousFromTopLeft,
  cropImageBlob,
  getTopLeftPixelColor,
  resizeImageToBlob,
  resizeImageToBlobNearestNeighborPS,
} from '../components/ParamsStep/utils'
import { removeGeminiWatermarkFromBlob } from './geminiWatermark'
import {
  wfEvenSplitStrip,
  wfEvenSplitPerCellEdge,
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
import {
  applyAlphaErosionToBlob,
  doubleBackgroundMatteFromBlobs,
  postProcessDoubleBgMatteBlob,
} from './doubleBackgroundMatte'
import { stitchVerticalImageBlobs } from './simpleStitchVertical'

export const RONIN_PRO_WORKFLOW_VERSION = 1

export type WorkflowNodeType =
  | 'workflowInputImage'
  | 'geminiWatermarkRemove'
  | 'resize'
  | 'resizeHard'
  | 'crop'
  | 'matteContiguous'
  | 'matteGlobal'
  /** 双背景抠图：需两条输入（黑底 inA、白底 inB） */
  | 'matteDoubleBackground'
  /** 双背景/透明抠图结果后修复：单输入，与去背页「去背景后处理」一致 */
  | 'mattePostRepair'
  /** 贴边 Alpha 硬削：与去背页「边缘侵蚀」相同，0–100 强度 */
  | 'alphaFrontierErode'
  | 'padExpand'
  | 'evenSplitStrip'
  /** 与平分取样相同的 cols×rows 划分，对每个格子统一扩边或裁边后再拼回整图 */
  | 'evenSplitPerCellEdge'
  | 'mergeStrip'
  /** 简易上下拼接：可多路输入连到同一输入点，自上而下拼接（与 GIF 工具简易拼接一致） */
  | 'simpleStitchVertical'
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

/** 双输入节点的输入口：inA=黑底支路，inB=白底支路 */
export type WorkflowInputPort = 'inA' | 'inB'

/** 蓝图连线：上游 output → 下游 input */
export interface WorkflowEdge {
  id: string
  source: string
  target: string
  /** 仅 matteDoubleBackground：必须标明 inA / inB */
  targetPort?: WorkflowInputPort
}

/** 画布上的节点（含坐标） */
export type GraphNode = WorkflowNode & { x: number; y: number }

export const RONIN_PRO_WORKFLOW_GRAPH_VERSION = 6

/** 从批量列表拖入蓝图时的 dataTransfer type，值为 1-based 序号字符串 */
export const WORKFLOW_DRAG_INPUT_IMAGE_INDEX = 'application/x-frameronin-workflow-input-image-index'

export interface WorkflowDocument {
  version: number
  nodes: WorkflowNode[]
  edges?: WorkflowEdge[]
  /** 用户为预设起的名称（可选，用于展示与导出文件名） */
  presetName?: string
}

export const WORKFLOW_PALETTE: { type: WorkflowNodeType; defaultParams: Record<string, number> }[] = [
  { type: 'geminiWatermarkRemove', defaultParams: {} },
  { type: 'resize', defaultParams: { w: 256, h: 256, keepAspect: 1, pixelated: 1 } },
  { type: 'resizeHard', defaultParams: { w: 256, h: 256, keepAspect: 0 } },
  { type: 'crop', defaultParams: { left: 0, top: 0, right: 0, bottom: 0 } },
  { type: 'matteContiguous', defaultParams: { tolerance: 80, feather: 5 } },
  { type: 'matteGlobal', defaultParams: { tolerance: 80, feather: 5 } },
  {
    type: 'matteDoubleBackground',
    defaultParams: { tolerance: 70, edgeContrast: 53 },
  },
  { type: 'mattePostRepair', defaultParams: {} },
  { type: 'alphaFrontierErode', defaultParams: { erosion: 0 } },
  { type: 'padExpand', defaultParams: { padTop: 0, padRight: 0, padBottom: 0, padLeft: 0 } },
  { type: 'evenSplitStrip', defaultParams: { evenCols: 4, evenRows: 4 } },
  {
    type: 'evenSplitPerCellEdge',
    defaultParams: {
      evenCols: 4,
      evenRows: 4,
      cellEdgeMode: 0,
      edgeL: 0,
      edgeT: 0,
      edgeR: 0,
      edgeB: 0,
    },
  },
  { type: 'mergeStrip', defaultParams: { mergeCols: 4, frameCount: 16 } },
  { type: 'simpleStitchVertical', defaultParams: {} },
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
  if (type === 'workflowInputImage') {
    return {
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `n-${Date.now()}-${Math.random()}`,
      type: 'workflowInputImage',
      params: { imageIndex: 1 },
    }
  }
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

/** 多路汇入「简易上下拼接」时，按上游节点画布位置排序：靠上、靠左优先（与视觉顺序一致） */
function orderIncomingEdgesForVerticalStitch(
  targetId: string,
  edges: WorkflowEdge[],
  allNodes: WorkflowNode[]
): WorkflowEdge[] {
  const byId = new Map(allNodes.map((n) => [n.id, n]))
  const list = edges.filter((e) => e.target === targetId && e.targetPort == null)
  return [...list].sort((ea, eb) => {
    const na = byId.get(ea.source) as GraphNode | undefined
    const nb = byId.get(eb.source) as GraphNode | undefined
    const ya = na?.y ?? 0
    const yb = nb?.y ?? 0
    if (ya !== yb) return ya - yb
    const xa = na?.x ?? 0
    const xb = nb?.x ?? 0
    if (xa !== xb) return xa - xb
    return ea.source.localeCompare(eb.source)
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
    case 'resizeHard': {
      const w = Math.max(1, Math.round(p.w ?? 256))
      const h = Math.max(1, Math.round(p.h ?? 256))
      const keepAspect = (p.keepAspect ?? 0) !== 0
      return resizeImageToBlobNearestNeighborPS(blob, w, h, keepAspect)
    }
    case 'crop': {
      return cropImageBlob(blob, {
        left: Math.max(0, Math.round(p.left ?? 0)),
        top: Math.max(0, Math.round(p.top ?? 0)),
        right: Math.max(0, Math.round(p.right ?? 0)),
        bottom: Math.max(0, Math.round(p.bottom ?? 0)),
      })
    }
    case 'mattePostRepair':
      return postProcessDoubleBgMatteBlob(blob)
    case 'alphaFrontierErode': {
      const erosionUi = Math.min(100, Math.max(0, Math.round(p.erosion ?? 0)))
      return applyAlphaErosionToBlob(blob, erosionUi)
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
    case 'evenSplitPerCellEdge': {
      const mode = (p.cellEdgeMode ?? 0) !== 0 ? 1 : 0
      return wfEvenSplitPerCellEdge(
        blob,
        p.evenCols ?? 4,
        p.evenRows ?? 4,
        mode,
        p.edgeL ?? 0,
        p.edgeT ?? 0,
        p.edgeR ?? 0,
        p.edgeB ?? 0
      )
    }
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
    case 'workflowInputImage':
      return blob
    case 'matteDoubleBackground':
    case 'simpleStitchVertical':
      return blob
    default:
      return blob
  }
}

async function executeDagNode(
  n: WorkflowNode,
  edges: WorkflowEdge[],
  blobMap: Map<string, Blob>,
  allNodes: WorkflowNode[]
): Promise<Blob> {
  if (n.type === 'workflowInputImage') {
    const b = blobMap.get(n.id)
    if (!b) throw new Error('DAG_HEAD_MISSING_BLOB')
    return b
  }
  if (n.type === 'matteDoubleBackground') {
    const ea = edges.find((e) => e.target === n.id && e.targetPort === 'inA')
    const eb = edges.find((e) => e.target === n.id && e.targetPort === 'inB')
    if (!ea || !eb) throw new Error('DAG_DOUBLE_BG_WIRES')
    const ba = blobMap.get(ea.source)
    const bb = blobMap.get(eb.source)
    if (!ba || !bb) throw new Error('DAG_DOUBLE_BG_BLOBS')
    const p = n.params
    const tolerance = Math.min(100, Math.max(0, Math.round(p.tolerance ?? 70)))
    const edgeContrast = Math.min(100, Math.max(0, Math.round(p.edgeContrast ?? 53)))
    return doubleBackgroundMatteFromBlobs(ba, bb, tolerance, edgeContrast)
  }
  if (n.type === 'simpleStitchVertical') {
    const ordered = orderIncomingEdgesForVerticalStitch(n.id, edges, allNodes)
    if (ordered.length === 0) throw new Error('DAG_STITCH_VERTICAL_NO_IN')
    const blobs = ordered.map((e) => blobMap.get(e.source)).filter((b): b is Blob => !!b)
    if (blobs.length !== ordered.length) throw new Error('DAG_STITCH_VERTICAL_BLOBS')
    return stitchVerticalImageBlobs(blobs)
  }
  const inc = edges.filter((e) => e.target === n.id && e.targetPort == null)
  if (inc.length === 1) {
    const b = blobMap.get(inc[0]!.source)
    if (!b) throw new Error('DAG_PRED_MISSING')
    return runOneStep(b, n)
  }
  if (inc.length === 0) {
    const b = blobMap.get(n.id)
    if (!b) throw new Error('DAG_HEAD_PROC_MISSING')
    return runOneStep(b, n)
  }
  throw new Error('DAG_INVALID_IN')
}

/**
 * 按拓扑序执行 DAG；heads 由调用方通过 getHeadBlob 注入初始 Blob
 */
export async function runDagExecution(
  topo: WorkflowNode[],
  edges: WorkflowEdge[],
  sinkId: string,
  getHeadBlob: (head: WorkflowNode) => Blob | Promise<Blob>
): Promise<Blob> {
  const heads = topo.filter((n) => !edges.some((e) => e.target === n.id))
  const blobMap = new Map<string, Blob>()
  for (const h of heads) {
    blobMap.set(h.id, await getHeadBlob(h))
  }
  for (const n of topo) {
    const out = await executeDagNode(n, edges, blobMap, topo)
    blobMap.set(n.id, out)
  }
  const finalB = blobMap.get(sinkId)
  if (!finalB) throw new Error('DAG_NO_SINK_BLOB')
  return finalB
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

export function serializeWorkflowGraph(
  nodes: GraphNode[],
  edges: WorkflowEdge[],
  options?: { presetName?: string }
): string {
  const doc: WorkflowDocument = {
    version: RONIN_PRO_WORKFLOW_GRAPH_VERSION,
    nodes,
    edges,
  }
  const name = options?.presetName?.trim()
  if (name) doc.presetName = name.slice(0, 120)
  return JSON.stringify(doc, null, 2)
}

/** 生成安全的下载文件名（不含扩展名） */
export function sanitizeWorkflowPresetFileBase(name: string): string {
  const trimmed = name.trim().slice(0, 80)
  if (!trimmed) return 'roninpro-workflow'
  const safe = trimmed.replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, '-')
  return safe || 'roninpro-workflow'
}

export type ExecutionOrderError =
  | 'MULTIPLE_HEADS'
  | 'MULTIPLE_OUTPUT'
  | 'MULTIPLE_INPUT'
  | 'CYCLE'
  | 'DISCONNECTED'

export type DagGraphError =
  | 'MULTIPLE_OUTPUT'
  | 'CYCLE'
  | 'DOUBLE_BG_INCOMPLETE'
  | 'DOUBLE_BG_PORTS'
  | 'INVALID_MULTI_INPUT'
  | 'INVALID_TARGET_PORT'
  | 'NO_SINK'
  | 'MULTIPLE_SINKS'
  | 'DISCONNECTED_DAG'
  | 'INPUT_IMAGE_NOT_HEAD'
  | 'TARGETED_HEAD_MIX'
  | 'STITCH_VERTICAL_NO_INPUT'

/** 校验含双输入节点的 DAG：单出、双入端口、唯一汇点、可达、拓扑序 */
export function validateDagWorkflow(
  nodes: GraphNode[],
  edges: WorkflowEdge[]
): { ok: true; topo: WorkflowNode[]; sinkId: string; heads: WorkflowNode[] } | { ok: false; reason: DagGraphError } {
  if (nodes.length === 0) {
    return { ok: false, reason: 'NO_SINK' }
  }
  const idSet = new Set(nodes.map((n) => n.id))
  const filtered = edges.filter((e) => idSet.has(e.source) && idSet.has(e.target))

  const outgoing = new Map<string, string>()
  for (const e of filtered) {
    if (outgoing.has(e.source)) return { ok: false, reason: 'MULTIPLE_OUTPUT' }
    outgoing.set(e.source, e.target)
  }

  const incoming = new Map<string, WorkflowEdge[]>()
  for (const e of filtered) {
    const arr = incoming.get(e.target) ?? []
    arr.push(e)
    incoming.set(e.target, arr)
  }

  const byId = new Map(nodes.map((n) => [n.id, n]))

  for (const n of nodes) {
    const ins = incoming.get(n.id) ?? []
    if (n.type === 'matteDoubleBackground') {
      if (ins.length !== 2) return { ok: false, reason: 'DOUBLE_BG_INCOMPLETE' }
      const ports = ins.map((e) => e.targetPort)
      if (!ports.every((p) => p === 'inA' || p === 'inB')) {
        return { ok: false, reason: 'DOUBLE_BG_PORTS' }
      }
      if (new Set(ports).size !== 2) return { ok: false, reason: 'DOUBLE_BG_PORTS' }
    } else if (n.type === 'simpleStitchVertical') {
      if (ins.length < 1) return { ok: false, reason: 'STITCH_VERTICAL_NO_INPUT' }
      for (const e of ins) {
        if (e.targetPort != null) return { ok: false, reason: 'INVALID_TARGET_PORT' }
      }
    } else {
      if (ins.length > 1) return { ok: false, reason: 'INVALID_MULTI_INPUT' }
      for (const e of ins) {
        if (e.targetPort != null) return { ok: false, reason: 'INVALID_TARGET_PORT' }
      }
    }
    if (n.type === 'workflowInputImage' && ins.length > 0) {
      return { ok: false, reason: 'INPUT_IMAGE_NOT_HEAD' }
    }
  }

  const sinks = nodes.filter((n) => !outgoing.has(n.id))
  if (sinks.length === 0) return { ok: false, reason: 'NO_SINK' }
  if (sinks.length > 1) return { ok: false, reason: 'MULTIPLE_SINKS' }
  const sinkId = sinks[0]!.id

  const heads = nodes.filter((n) => !(incoming.get(n.id)?.length))
  if (heads.length === 0) return { ok: false, reason: 'CYCLE' }

  const reached = new Set<string>()
  const stack = heads.map((h) => h.id)
  while (stack.length) {
    const id = stack.pop()!
    if (reached.has(id)) continue
    reached.add(id)
    const t = outgoing.get(id)
    if (t) stack.push(t)
  }
  if (reached.size !== nodes.length) return { ok: false, reason: 'DISCONNECTED_DAG' }

  const indeg = new Map<string, number>()
  for (const n of nodes) indeg.set(n.id, 0)
  for (const e of filtered) {
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1)
  }

  const q: string[] = []
  for (const n of nodes) {
    if ((indeg.get(n.id) ?? 0) === 0) q.push(n.id)
  }
  const topoIds: string[] = []
  while (q.length) {
    const id = q.shift()!
    topoIds.push(id)
    const t = outgoing.get(id)
    if (t) {
      const next = (indeg.get(t) ?? 0) - 1
      indeg.set(t, next)
      if (next === 0) q.push(t)
    }
  }
  if (topoIds.length !== nodes.length) return { ok: false, reason: 'CYCLE' }

  const topo = topoIds.map((id) => byId.get(id)!).filter(Boolean)
  return { ok: true, topo, sinkId, heads }
}

export function graphNeedsDagExecution(nodes: GraphNode[], edges: WorkflowEdge[]): boolean {
  if (nodes.some((n) => n.type === 'matteDoubleBackground' || n.type === 'simpleStitchVertical')) return true
  return edges.some((e) => e.targetPort != null)
}

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

export type WorkflowRunStrategy =
  | { kind: 'all'; order: WorkflowNode[] }
  | { kind: 'targeted'; plans: { fileIndex0: number; steps: WorkflowNode[] }[] }
  | {
      kind: 'dag_per_file'
      topo: WorkflowNode[]
      edges: WorkflowEdge[]
      sinkId: string
    }
  | {
      kind: 'dag_once'
      topo: WorkflowNode[]
      edges: WorkflowEdge[]
      sinkId: string
    }

export type WorkflowRunStrategyError =
  | ExecutionOrderError
  | DagGraphError
  | 'PROCESSOR_REUSED'
  | 'NESTED_INPUT_IMAGE'

/**
 * 无「输入图」节点：与现有一致，对所有批量图执行整条链（order 不含输入图节点类型）。
 * 有「输入图」节点：仅执行从这些节点沿出线走出的链；每条链上的处理节点不可被多条链共用。
 * 含「双背景抠图」或带 targetPort 的边：走 DAG，每张图一轮或仅执行一次（全为输入图头）。
 */
export function computeWorkflowRunStrategy(
  nodes: GraphNode[],
  edges: WorkflowEdge[],
  fileCount: number
): { ok: true; strategy: WorkflowRunStrategy } | { ok: false; reason: WorkflowRunStrategyError } {
  const inputNodes = nodes.filter((n) => n.type === 'workflowInputImage')
  const idSet = new Set(nodes.map((n) => n.id))
  const filtered = edges.filter((e) => idSet.has(e.source) && idSet.has(e.target))

  if (graphNeedsDagExecution(nodes, filtered)) {
    const dag = validateDagWorkflow(nodes, filtered)
    if (!dag.ok) return { ok: false, reason: dag.reason }
    const { topo, sinkId, heads } = dag
    if (inputNodes.length === 0) {
      if (heads.some((h) => h.type === 'workflowInputImage')) {
        return { ok: false, reason: 'TARGETED_HEAD_MIX' }
      }
      return {
        ok: true,
        strategy: { kind: 'dag_per_file', topo, edges: filtered, sinkId },
      }
    }
    const headIdSet = new Set(heads.map((h) => h.id))
    if (heads.some((h) => h.type !== 'workflowInputImage')) {
      return { ok: false, reason: 'TARGETED_HEAD_MIX' }
    }
    if (inputNodes.some((n) => !headIdSet.has(n.id))) {
      return { ok: false, reason: 'INPUT_IMAGE_NOT_HEAD' }
    }
    if (heads.length !== inputNodes.length) {
      return { ok: false, reason: 'TARGETED_HEAD_MIX' }
    }
    return {
      ok: true,
      strategy: { kind: 'dag_once', topo, edges: filtered, sinkId },
    }
  }

  if (inputNodes.length === 0) {
    const orderResult = getExecutionOrder(nodes, filtered)
    if (!orderResult.ok) return { ok: false, reason: orderResult.reason }
    const order = orderResult.order.filter((n) => n.type !== 'workflowInputImage')
    return { ok: true, strategy: { kind: 'all', order } }
  }

  const out = new Map<string, string>()
  for (const e of filtered) {
    if (out.has(e.source)) return { ok: false, reason: 'MULTIPLE_OUTPUT' }
    out.set(e.source, e.target)
  }

  const byId = new Map(nodes.map((n) => [n.id, n]))
  const usedProcessorIds = new Set<string>()
  const plans: { fileIndex0: number; steps: WorkflowNode[] }[] = []
  const sortedInputs = [...inputNodes].sort((a, b) => a.x - b.x || a.y - b.y)

  for (const head of sortedInputs) {
    const chain: GraphNode[] = []
    let cur: string | undefined = head.id
    const seen = new Set<string>()
    while (cur) {
      if (seen.has(cur)) return { ok: false, reason: 'CYCLE' }
      seen.add(cur)
      const n = byId.get(cur)
      if (!n) return { ok: false, reason: 'DISCONNECTED' }
      chain.push(n)
      cur = out.get(cur)
    }
    for (let i = 1; i < chain.length; i++) {
      if (chain[i]!.type === 'workflowInputImage') return { ok: false, reason: 'NESTED_INPUT_IMAGE' }
    }
    const processors = chain.slice(1)
    for (const p of processors) {
      if (usedProcessorIds.has(p.id)) return { ok: false, reason: 'PROCESSOR_REUSED' }
      usedProcessorIds.add(p.id)
    }
    const rawIdx = Math.round(head.params.imageIndex ?? 1)
    const imageIndex1 = Math.min(Math.max(1, rawIdx), Math.max(1, fileCount))
    const steps: WorkflowNode[] = processors.map((g) => {
      const { x: _x, y: _y, ...rest } = g
      return rest
    })
    plans.push({ fileIndex0: imageIndex1 - 1, steps })
  }

  return { ok: true, strategy: { kind: 'targeted', plans } }
}

const VALID_TYPES = new Set<WorkflowNodeType>([
  'workflowInputImage',
  'geminiWatermarkRemove',
  'resize',
  'resizeHard',
  'crop',
  'matteContiguous',
  'matteGlobal',
  'matteDoubleBackground',
  'mattePostRepair',
  'alphaFrontierErode',
  'padExpand',
  'evenSplitStrip',
  'evenSplitPerCellEdge',
  'mergeStrip',
  'simpleStitchVertical',
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
  const defaults =
    type === 'workflowInputImage' ? { imageIndex: 1 } : (preset?.defaultParams ?? {})
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

export function parseWorkflowGraph(text: string): {
  nodes: GraphNode[]
  edges: WorkflowEdge[]
  presetName?: string
} {
  const data = JSON.parse(text) as WorkflowDocument & { edges?: unknown[] }
  if (!data || typeof data.version !== 'number' || !Array.isArray(data.nodes)) {
    throw new Error('INVALID_WORKFLOW_JSON')
  }
  const presetName =
    typeof data.presetName === 'string' && data.presetName.trim()
      ? data.presetName.trim().slice(0, 120)
      : undefined
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
      const tp = ex.targetPort
      const targetPort =
        tp === 'inA' || tp === 'inB' ? (tp as WorkflowInputPort) : undefined
      edges.push({
        id:
          typeof ex.id === 'string'
            ? ex.id
            : `e-${ex.source}-${ex.target}-${Math.random().toString(36).slice(2, 9)}`,
        source: ex.source,
        target: ex.target,
        ...(targetPort ? { targetPort } : {}),
      })
    }
  }
  return { nodes, edges, presetName }
}

export function parseWorkflowJson(text: string): WorkflowNode[] {
  return parseWorkflowGraph(text).nodes
}
