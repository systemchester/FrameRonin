/**
 * 蓝图「成品预设」：固定 id 的流程 JSON，供一键加载（与导出格式一致）
 */
import { serializeWorkflowGraph } from './roninProWorkflow'
import type { GraphNode, WorkflowEdge } from './roninProWorkflow'

export interface WorkflowFinishedPresetMeta {
  id: string
  /** i18n 键：按钮文案 */
  labelKey: string
  json: string
}

function doc(nodes: GraphNode[], edges: WorkflowEdge[], presetName: string): string {
  return serializeWorkflowGraph(nodes, edges, { presetName })
}

/** 预设列表顺序即 UI 按钮顺序 */
export const WORKFLOW_FINISHED_PRESETS: WorkflowFinishedPresetMeta[] = [
  (() => {
    const in1: GraphNode = {
      id: 'fp-in-1',
      type: 'workflowInputImage',
      params: { imageIndex: 1 },
      x: 120,
      y: 260,
    }
    const n: GraphNode = {
      id: 'fp-gemini',
      type: 'geminiWatermarkRemove',
      params: {},
      x: 460,
      y: 260,
    }
    return {
      id: 'gemini-watermark',
      labelKey: 'roninProWorkflowFinishedPreset_geminiWatermark',
      json: doc([in1, n], [{ id: 'fp-e1', source: in1.id, target: n.id }], 'Gemini watermark'),
    }
  })(),
  (() => {
    const in1: GraphNode = {
      id: 'fp-in-r',
      type: 'workflowInputImage',
      params: { imageIndex: 1 },
      x: 120,
      y: 260,
    }
    const n: GraphNode = {
      id: 'fp-resize',
      type: 'resize',
      params: { w: 256, h: 256, keepAspect: 1, pixelated: 1 },
      x: 460,
      y: 260,
    }
    return {
      id: 'resize-256',
      labelKey: 'roninProWorkflowFinishedPreset_resize256',
      json: doc([in1, n], [{ id: 'fp-e2', source: in1.id, target: n.id }], 'Resize 256'),
    }
  })(),
  (() => {
    const in1: GraphNode = {
      id: 'fp-in-m',
      type: 'workflowInputImage',
      params: { imageIndex: 1 },
      x: 120,
      y: 260,
    }
    const n: GraphNode = {
      id: 'fp-matte',
      type: 'matteContiguous',
      params: { tolerance: 80, feather: 5 },
      x: 460,
      y: 260,
    }
    return {
      id: 'matte-contiguous',
      labelKey: 'roninProWorkflowFinishedPreset_matteContiguous',
      json: doc([in1, n], [{ id: 'fp-e3', source: in1.id, target: n.id }], 'Matte contiguous'),
    }
  })(),
  (() => {
    const in1: GraphNode = {
      id: 'fp-in-split',
      type: 'workflowInputImage',
      params: { imageIndex: 1 },
      x: 120,
      y: 260,
    }
    const n: GraphNode = {
      id: 'fp-split',
      type: 'evenSplitStrip',
      params: { evenCols: 4, evenRows: 4 },
      x: 460,
      y: 260,
    }
    return {
      id: 'even-split-4',
      labelKey: 'roninProWorkflowFinishedPreset_evenSplit4',
      json: doc([in1, n], [{ id: 'fp-e4', source: in1.id, target: n.id }], 'Even split 4×4'),
    }
  })(),
  (() => {
    const in1: GraphNode = {
      id: 'fp-in-merge',
      type: 'workflowInputImage',
      params: { imageIndex: 1 },
      x: 120,
      y: 260,
    }
    const n: GraphNode = {
      id: 'fp-merge',
      type: 'mergeStrip',
      params: { mergeCols: 4, frameCount: 16 },
      x: 460,
      y: 260,
    }
    return {
      id: 'merge-strip',
      labelKey: 'roninProWorkflowFinishedPreset_mergeStrip',
      json: doc([in1, n], [{ id: 'fp-e5', source: in1.id, target: n.id }], 'Merge strip 4×16'),
    }
  })(),
  (() => {
    const inA: GraphNode = {
      id: 'fp-in-black',
      type: 'workflowInputImage',
      params: { imageIndex: 1 },
      x: 80,
      y: 180,
    }
    const inB: GraphNode = {
      id: 'fp-in-white',
      type: 'workflowInputImage',
      params: { imageIndex: 2 },
      x: 80,
      y: 380,
    }
    const n: GraphNode = {
      id: 'fp-dbl',
      type: 'matteDoubleBackground',
      params: { tolerance: 70, edgeContrast: 53 },
      x: 480,
      y: 280,
    }
    const edges: WorkflowEdge[] = [
      { id: 'fp-ea', source: inA.id, target: n.id, targetPort: 'inA' },
      { id: 'fp-eb', source: inB.id, target: n.id, targetPort: 'inB' },
    ]
    return {
      id: 'double-background',
      labelKey: 'roninProWorkflowFinishedPreset_doubleBackground',
      json: doc([inA, inB, n], edges, 'Double background matte'),
    }
  })(),
]
