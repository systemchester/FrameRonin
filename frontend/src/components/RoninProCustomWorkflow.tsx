import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  Button,
  Checkbox,
  Col,
  Dropdown,
  Input,
  InputNumber,
  message,
  Row,
  Select,
  Slider,
  Space,
  Typography,
  Upload,
} from 'antd'
import { CloseOutlined, ExpandOutlined, OrderedListOutlined, PlusOutlined } from '@ant-design/icons'
import { useLanguage } from '../i18n/context'
import {
  WORKFLOW_DRAG_INPUT_IMAGE_INDEX,
  WORKFLOW_PALETTE,
  buildDefaultRearrangeGrid,
  computeWorkflowRunStrategy,
  createGraphNode,
  getStitchInputSlotCount,
  parseWorkflowGraph,
  resizeRearrangeGrid,
  runDagExecution,
  runWorkflowOnBlob,
  sanitizeWorkflowPresetFileBase,
  serializeWorkflowGraph,
  type GraphNode,
  type WorkflowEdge,
  type WorkflowNodeType,
} from '../lib/roninProWorkflow'
import { WORKFLOW_BPSET_PRESETS } from '../lib/workflowBpsetPresets'
import StashDropZone from './StashDropZone'
import WorkflowBlueprintCanvas, {
  BLUEPRINT_INPUT_IMAGE_NODE_WIDTH,
  BLUEPRINT_WORLD_W,
  type BlueprintToolPlaceAction,
  getBlueprintNodeWidth,
  getCustomRearrangeInputWidth,
} from './WorkflowBlueprintCanvas'

const { Dragger } = Upload
const { Text } = Typography

const STORAGE_KEY = 'roninProCustomWorkflow.v3'
const IMAGE_ACCEPT = ['.png', '.jpg', '.jpeg', '.webp']

/** 右侧预设节点浮窗（fixed，不随画布滚动） */
const PALETTE_FLOAT_OUTER: CSSProperties = {
  position: 'fixed',
  right: 16,
  top: 'max(72px, 8vh)',
  bottom: 24,
  width: 'min(320px, calc(100vw - 32px))',
  zIndex: 500,
  display: 'flex',
  flexDirection: 'column',
  boxSizing: 'border-box',
  padding: 12,
  gap: 10,
  background: 'var(--ant-color-bg-container)',
  borderRadius: 12,
  boxShadow: '0 8px 32px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)',
  border: '1px solid var(--ant-color-border-secondary)',
}

const PALETTE_FLOAT_SCROLL: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  paddingRight: 2,
}

const NODE_LABEL_I18N: Record<WorkflowNodeType, string> = {
  geminiWatermarkRemove: 'roninProWorkflowNode_geminiWatermarkRemove',
  resize: 'roninProWorkflowNode_resize',
  resizeHard: 'roninProWorkflowNode_resizeHard',
  crop: 'roninProWorkflowNode_crop',
  matteContiguous: 'roninProWorkflowNode_matteContiguous',
  matteGlobal: 'roninProWorkflowNode_matteGlobal',
  matteDoubleBackground: 'roninProWorkflowNode_matteDoubleBackground',
  mattePostRepair: 'roninProWorkflowNode_mattePostRepair',
  alphaFrontierErode: 'roninProWorkflowNode_alphaFrontierErode',
  padExpand: 'roninProWorkflowNode_padExpand',
  evenSplitStrip: 'roninProWorkflowNode_evenSplitStrip',
  evenSplitPerCellEdge: 'roninProWorkflowNode_evenSplitPerCellEdge',
  mergeStrip: 'roninProWorkflowNode_mergeStrip',
  simpleStitchVertical: 'roninProWorkflowNode_simpleStitchVertical',
  gridDeleteRow: 'roninProWorkflowNode_gridDeleteRow',
  gridDeleteCol: 'roninProWorkflowNode_gridDeleteCol',
  gridExpandRow: 'roninProWorkflowNode_gridExpandRow',
  gridExpandCol: 'roninProWorkflowNode_gridExpandCol',
  gridFlipRow: 'roninProWorkflowNode_gridFlipRow',
  gridFlipCol: 'roninProWorkflowNode_gridFlipCol',
  gridCopyRow: 'roninProWorkflowNode_gridCopyRow',
  gridCopyCol: 'roninProWorkflowNode_gridCopyCol',
  customGridRearrange: 'roninProWorkflowNode_customGridRearrange',
  workflowInputImage: 'roninProWorkflowNode_workflowInputImage',
}

/** 节点参数输入框：钳位到 [min,max]，非法则用 fallback */
function wfClampInt(
  v: number | string | null | undefined,
  min: number,
  max: number,
  fallback: number
): number {
  if (v === null || v === undefined || v === '') return fallback
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

const INPUT_FULL: CSSProperties = { width: '100%' }

type WorkflowInputFile = { id: string; file: File; thumbUrl: string }

function createWorkflowInputFile(file: File): WorkflowInputFile {
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `f-${Date.now()}-${Math.random()}`
  return { id, file, thumbUrl: URL.createObjectURL(file) }
}

export interface RoninProCustomWorkflowProps {
  /** 右键结果图「发送到精细处理」：跳转像素图片 → 精细处理并带入该图 */
  onSendToFineProcess?: (blob: Blob, suggestedFilename: string) => void
}

export default function RoninProCustomWorkflow({ onSendToFineProcess }: RoninProCustomWorkflowProps = {}) {
  const { t } = useLanguage()
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([])
  const [graphEdges, setGraphEdges] = useState<WorkflowEdge[]>([])
  const [fileItems, setFileItems] = useState<WorkflowInputFile[]>([])
  const fileItemsRef = useRef(fileItems)
  fileItemsRef.current = fileItems
  const [results, setResults] = useState<{ name: string; url: string }[]>([])
  const [running, setRunning] = useState(false)
  /** 导出预设名：写入 JSON 的 presetName，并用于下载文件名 */
  const [presetName, setPresetName] = useState('')
  const [finishedPresetsOpen, setFinishedPresetsOpen] = useState(false)
  const [bpsetLoadingId, setBpsetLoadingId] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      fileItemsRef.current.forEach(({ thumbUrl }) => URL.revokeObjectURL(thumbUrl))
      setResults((prev) => {
        prev.forEach((r) => URL.revokeObjectURL(r.url))
        return []
      })
    }
  }, [])

  const removeWorkflowInputFile = useCallback((uid: string) => {
    setFileItems((prev) => {
      const item = prev.find((x) => x.id === uid)
      if (item) URL.revokeObjectURL(item.thumbUrl)
      return prev.filter((x) => x.id !== uid)
    })
  }, [])

  const updateNodeParam = useCallback((id: string, key: string, value: number) => {
    setGraphNodes((list) =>
      list.map((n) => (n.id === id ? { ...n, params: { ...n.params, [key]: value } } : n))
    )
  }, [])

  const adjustStitchSlotCount = useCallback((id: string, delta: number) => {
    let nextCount: number | null = null
    setGraphNodes((list) => {
      const node = list.find((x) => x.id === id && x.type === 'simpleStitchVertical')
      if (!node) return list
      const cur = getStitchInputSlotCount(node)
      const next = Math.max(2, Math.min(16, cur + delta))
      if (next === cur) return list
      nextCount = next
      return list.map((n) =>
        n.id === id && n.type === 'simpleStitchVertical'
          ? { ...n, params: { ...n.params, stitchSlotCount: next } }
          : n
      )
    })
    if (nextCount !== null) {
      setGraphEdges((prev) =>
        prev.filter((ed) => {
          if (ed.target !== id) return true
          const m = /^in(\d+)$/.exec(ed.targetPort ?? '')
          if (!m) return true
          return parseInt(m[1], 10) <= nextCount!
        })
      )
    }
  }, [])

  const updateCustomRearrangeDimension = useCallback(
    (id: string, key: 'splitCols' | 'splitRows' | 'outRows' | 'outCols', value: number) => {
      setGraphNodes((list) =>
        list.map((n) => {
          if (n.id !== id) return n
          if (n.type !== 'customGridRearrange') {
            return { ...n, params: { ...n.params, [key]: value } }
          }
          const nextParams = { ...n.params, [key]: value }
          const sc = Math.max(1, Math.round(nextParams.splitCols ?? 2))
          const sr = Math.max(1, Math.round(nextParams.splitRows ?? 2))
          const or = Math.max(1, Math.round(nextParams.outRows ?? 2))
          const oc = Math.max(1, Math.round(nextParams.outCols ?? 2))
          return {
            ...n,
            params: nextParams,
            rearrangeGrid: resizeRearrangeGrid(n.rearrangeGrid, or, oc, sc, sr),
          }
        })
      )
    },
    []
  )

  const updateCustomRearrangeCell = useCallback(
    (id: string, row: number, col: number, value: number | null) => {
      setGraphNodes((list) =>
        list.map((n) => {
          if (n.id !== id || n.type !== 'customGridRearrange') return n
          const sc = Math.max(1, Math.round(n.params.splitCols ?? 2))
          const sr = Math.max(1, Math.round(n.params.splitRows ?? 2))
          const or = Math.max(1, Math.round(n.params.outRows ?? 2))
          const oc = Math.max(1, Math.round(n.params.outCols ?? 2))
          const maxIdx = sc * sr
          const base =
            n.rearrangeGrid ?? buildDefaultRearrangeGrid(or, oc, sc, sr)
          const grid = base.map((r) => [...r])
          let v = value === null || value === undefined ? 0 : Math.trunc(Number(value))
          if (!Number.isFinite(v)) v = 0
          const abs = Math.abs(v)
          const cell = abs === 0 || abs > maxIdx ? 0 : v
          if (grid[row]?.[col] !== undefined) {
            grid[row]![col] = cell
          }
          return { ...n, rearrangeGrid: grid }
        })
      )
    },
    []
  )

  /** 按行主序自动填入 1、2、3…（超出切块数填 0），与新建节点默认一致 */
  const fillRearrangeGridAutoSequence = useCallback((nodeId: string) => {
    setGraphNodes((list) =>
      list.map((n) => {
        if (n.id !== nodeId || n.type !== 'customGridRearrange') return n
        const sc = Math.max(1, Math.round(n.params.splitCols ?? 2))
        const sr = Math.max(1, Math.round(n.params.splitRows ?? 2))
        const or = Math.max(1, Math.round(n.params.outRows ?? 2))
        const oc = Math.max(1, Math.round(n.params.outCols ?? 2))
        return {
          ...n,
          rearrangeGrid: buildDefaultRearrangeGrid(or, oc, sc, sr),
        }
      })
    )
  }, [])

  const addNodeAt = useCallback((type: WorkflowNodeType, x?: number, y?: number) => {
    setGraphNodes((prev) => {
      let nx: number
      if (x != null) {
        nx = x
      } else if (prev.length) {
        const last = prev[prev.length - 1]!
        const lastW = getBlueprintNodeWidth(last)
        nx = Math.min(BLUEPRINT_WORLD_W - lastW - 28, last.x + lastW + 28)
      } else {
        nx = 220
      }
      const ny = y ?? (prev.length ? prev[prev.length - 1]!.y : 200)
      return [...prev, createGraphNode(type, nx, ny)]
    })
  }, [])

  /**
   * 添加「输入图」节点。传入 x,y 时用该位置（如画布点击/拖放）；省略时按最后一个节点右侧自动排布。
   */
  const addInputImageAt = useCallback((imageIndex1: number, x?: number, y?: number) => {
    setGraphNodes((prev) => {
      let nx: number
      let ny: number
      if (x !== undefined && y !== undefined) {
        nx = Math.max(0, Math.min(BLUEPRINT_WORLD_W - BLUEPRINT_INPUT_IMAGE_NODE_WIDTH, x))
        ny = y
      } else if (prev.length) {
        const last = prev[prev.length - 1]!
        const lastW = getBlueprintNodeWidth(last)
        const newW = BLUEPRINT_INPUT_IMAGE_NODE_WIDTH
        nx = Math.min(BLUEPRINT_WORLD_W - newW - 28, last.x + lastW + 28)
        ny = last.y
      } else {
        nx = 220
        ny = 200
      }
      const node = createGraphNode('workflowInputImage', nx, ny)
      const nFiles = fileItemsRef.current.length
      const idx = Math.min(Math.max(1, Math.round(imageIndex1)), Math.max(1, nFiles))
      return [...prev, { ...node, params: { ...node.params, imageIndex: idx } }]
    })
  }, [])

  const onBlueprintToolPlaceAt = useCallback(
    (action: BlueprintToolPlaceAction, x: number, y: number) => {
      if (action.type === 'resize') {
        addNodeAt('resize', x, y)
        return
      }
      if (fileItemsRef.current.length === 0) {
        message.warning(t('roninProWorkflowNoFiles'))
        return
      }
      addInputImageAt(action.imageIndex1, x, y)
    },
    [addInputImageAt, addNodeAt, t]
  )

  const handleRunAll = async () => {
    if (graphNodes.length === 0) {
      message.warning(t('roninProWorkflowNoNodes'))
      return
    }
    if (fileItems.length === 0) {
      message.warning(t('roninProWorkflowNoFiles'))
      return
    }
    const strategyResult = computeWorkflowRunStrategy(graphNodes, graphEdges, fileItems.length)
    if (!strategyResult.ok) {
      message.warning(t(`roninProWorkflowGraphErr_${strategyResult.reason}`))
      return
    }
    setRunning(true)
    setResults((prev) => {
      prev.forEach((r) => URL.revokeObjectURL(r.url))
      return []
    })
    const out: { name: string; url: string }[] = []
    try {
      const { strategy } = strategyResult
      if (strategy.kind === 'all') {
        for (const { file } of fileItems) {
          const blob = await runWorkflowOnBlob(file, strategy.order)
          const url = URL.createObjectURL(blob)
          const base = file.name.replace(/\.[^.]+$/, '')
          out.push({ name: `${base}_workflow.png`, url })
        }
      } else if (strategy.kind === 'targeted') {
        for (const plan of strategy.plans) {
          const item = fileItems[plan.fileIndex0]
          if (!item) continue
          const blob = await runWorkflowOnBlob(item.file, plan.steps)
          const url = URL.createObjectURL(blob)
          const base = item.file.name.replace(/\.[^.]+$/, '')
          out.push({ name: `${base}_workflow.png`, url })
        }
      } else if (strategy.kind === 'dag_per_file') {
        for (const { file } of fileItems) {
          const blob = await runDagExecution(
            strategy.topo,
            strategy.edges,
            strategy.sinkId,
            () => file
          )
          const url = URL.createObjectURL(blob)
          const base = file.name.replace(/\.[^.]+$/, '')
          out.push({ name: `${base}_workflow.png`, url })
        }
      } else if (strategy.kind === 'dag_once') {
        const blob = await runDagExecution(
          strategy.topo,
          strategy.edges,
          strategy.sinkId,
          (h) => {
            const maxIdx = Math.max(1, fileItems.length)
            const idx1 = Math.min(
              Math.max(1, Math.round(h.params.imageIndex ?? 1)),
              maxIdx
            )
            return fileItems[idx1 - 1]!.file
          }
        )
        const url = URL.createObjectURL(blob)
        const heads = strategy.topo.filter((n) => !strategy.edges.some((e) => e.target === n.id))
        const firstIn = heads.find((n) => n.type === 'workflowInputImage')
        const maxIdx = Math.max(1, fileItems.length)
        const idx1 = firstIn
          ? Math.min(Math.max(1, Math.round(firstIn.params.imageIndex ?? 1)), maxIdx)
          : 1
        const refFile = fileItems[idx1 - 1]?.file ?? fileItems[0]!.file
        const base = refFile.name.replace(/\.[^.]+$/, '')
        const dagSuffix = strategy.topo.some((x) => x.type === 'matteDoubleBackground')
          ? '_workflow_doublebg.png'
          : '_workflow.png'
        out.push({ name: `${base}${dagSuffix}`, url })
      }
      setResults(out)
      message.success(t('roninProWorkflowDone'))
    } catch (e) {
      console.error(e)
      message.error(t('roninProWorkflowFailed'))
    } finally {
      setRunning(false)
    }
  }

  const saveJsonToFile = () => {
    try {
      const json = serializeWorkflowGraph(graphNodes, graphEdges, {
        presetName: presetName.trim() || undefined,
      })
      const blob = new Blob([json], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      const base = sanitizeWorkflowPresetFileBase(presetName)
      a.download = `${base}.json`
      a.click()
      URL.revokeObjectURL(a.href)
      try {
        localStorage.setItem(STORAGE_KEY, json)
        message.success(t('roninProWorkflowSavedLast'))
      } catch {
        /* ignore quota */
      }
    } catch {
      message.error(t('roninProWorkflowFailed'))
    }
  }

  const loadJsonFromStorage = () => {
    try {
      let raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) raw = localStorage.getItem('roninProCustomWorkflow.v2')
      if (!raw) raw = localStorage.getItem('roninProCustomWorkflow.v1')
      if (!raw) {
        message.warning(t('roninProWorkflowNoLast'))
        return
      }
      const { nodes, edges, presetName: loadedName } = parseWorkflowGraph(raw)
      setGraphNodes(nodes)
      setGraphEdges(edges)
      setPresetName(loadedName ?? '')
      message.success(t('roninProWorkflowLoadSuccess'))
    } catch {
      message.error(t('roninProWorkflowLoadFailed'))
    }
  }

  const applyFinishedPresetJson = (json: string) => {
    try {
      const { nodes, edges, presetName: loadedName } = parseWorkflowGraph(json)
      setGraphNodes(nodes)
      setGraphEdges(edges)
      setPresetName(loadedName ?? '')
      try {
        localStorage.setItem(STORAGE_KEY, json)
      } catch {
        /* ignore */
      }
      message.success(t('roninProWorkflowLoadSuccess'))
    } catch {
      message.error(t('roninProWorkflowLoadFailed'))
    }
  }

  const loadBpsetPreset = async (presetId: string, url: string) => {
    setBpsetLoadingId(presetId)
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(String(res.status))
      const json = await res.text()
      applyFinishedPresetJson(json)
    } catch {
      message.error(t('roninProWorkflowBpsetLoadFailed'))
    } finally {
      setBpsetLoadingId(null)
    }
  }

  const onPickJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const { nodes, edges, presetName: loadedName } = parseWorkflowGraph(String(reader.result))
        setGraphNodes(nodes)
        setGraphEdges(edges)
        setPresetName(loadedName ?? '')
        try {
          localStorage.setItem(STORAGE_KEY, String(reader.result))
        } catch {
          /* ignore */
        }
        message.success(t('roninProWorkflowLoadSuccess'))
      } catch {
        message.error(t('roninProWorkflowLoadFailed'))
      }
    }
    reader.readAsText(f)
  }

  const renderNodeBody = useCallback(
    (n: GraphNode) => {
      const id = n.id
      const p = n.params
      switch (n.type) {
        case 'workflowInputImage': {
          const maxIdx = Math.max(1, fileItems.length)
          const idx1 = wfClampInt(p.imageIndex, 1, maxIdx, 1)
          const thumbUrl = fileItems[idx1 - 1]?.thumbUrl
          return (
            <div>
              {thumbUrl ? (
                <div
                  style={{
                    marginBottom: 8,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    minHeight: 48,
                    borderRadius: 6,
                    overflow: 'hidden',
                    background: 'rgba(0,0,0,0.25)',
                    border: '1px solid #3d4555',
                  }}
                >
                  <img
                    src={thumbUrl}
                    alt=""
                    draggable={false}
                    style={{
                      maxWidth: '100%',
                      maxHeight: 56,
                      width: 'auto',
                      height: 'auto',
                      objectFit: 'contain',
                      display: 'block',
                    }}
                  />
                </div>
              ) : null}
              <Text style={{ color: '#9aa3b5', fontSize: 11 }}>{t('roninProWorkflowInputImageIndex')}</Text>
              <InputNumber
                min={1}
                max={maxIdx}
                size="small"
                style={INPUT_FULL}
                value={idx1}
                onChange={(v) => updateNodeParam(id, 'imageIndex', wfClampInt(v, 1, maxIdx, 1))}
              />
            </div>
          )
        }
        case 'geminiWatermarkRemove':
          return <Text style={{ color: '#9aa3b5', fontSize: 12 }}>{t('roninProWorkflowNoParams')}</Text>
        case 'resize':
          return (
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <div>
                <Text style={{ color: '#9aa3b5', fontSize: 11 }}>{t('roninProCustomScaleTargetW')}</Text>
                <InputNumber
                  min={8}
                  max={2048}
                  size="small"
                  style={INPUT_FULL}
                  value={Math.round(p.w ?? 256)}
                  onChange={(v) => updateNodeParam(id, 'w', wfClampInt(v, 8, 2048, 256))}
                />
              </div>
              <div>
                <Text style={{ color: '#9aa3b5', fontSize: 11 }}>{t('roninProCustomScaleTargetH')}</Text>
                <InputNumber
                  min={8}
                  max={2048}
                  size="small"
                  style={INPUT_FULL}
                  value={Math.round(p.h ?? 256)}
                  onChange={(v) => updateNodeParam(id, 'h', wfClampInt(v, 8, 2048, 256))}
                />
              </div>
              <Space size="small" wrap>
                <Checkbox
                  checked={(p.keepAspect ?? 1) !== 0}
                  onChange={(e) => updateNodeParam(id, 'keepAspect', e.target.checked ? 1 : 0)}
                  style={{ color: '#c8d0e0' }}
                >
                  {t('roninProCustomScaleKeepAspect')}
                </Checkbox>
                <Checkbox
                  checked={(p.pixelated ?? 1) !== 0}
                  onChange={(e) => updateNodeParam(id, 'pixelated', e.target.checked ? 1 : 0)}
                  style={{ color: '#c8d0e0' }}
                >
                  {t('roninProWorkflowPixelated')}
                </Checkbox>
              </Space>
            </Space>
          )
        case 'resizeHard':
          return (
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <div>
                <Text style={{ color: '#9aa3b5', fontSize: 11 }}>{t('roninProCustomScaleTargetW')}</Text>
                <InputNumber
                  min={8}
                  max={2048}
                  size="small"
                  style={INPUT_FULL}
                  value={Math.round(p.w ?? 256)}
                  onChange={(v) => updateNodeParam(id, 'w', wfClampInt(v, 8, 2048, 256))}
                />
              </div>
              <div>
                <Text style={{ color: '#9aa3b5', fontSize: 11 }}>{t('roninProCustomScaleTargetH')}</Text>
                <InputNumber
                  min={8}
                  max={2048}
                  size="small"
                  style={INPUT_FULL}
                  value={Math.round(p.h ?? 256)}
                  onChange={(v) => updateNodeParam(id, 'h', wfClampInt(v, 8, 2048, 256))}
                />
              </div>
              <Checkbox
                checked={(p.keepAspect ?? 0) !== 0}
                onChange={(e) => updateNodeParam(id, 'keepAspect', e.target.checked ? 1 : 0)}
                style={{ color: '#c8d0e0' }}
              >
                {t('roninProCustomScaleKeepAspect')}
              </Checkbox>
            </Space>
          )
        case 'crop':
          return (
            <Row gutter={[6, 6]}>
              {(['left', 'top', 'right', 'bottom'] as const).map((k) => (
                <Col span={12} key={k}>
                  <Text style={{ color: '#9aa3b5', fontSize: 11 }}>
                    {t(`roninProWorkflowCrop_${k}`)}
                  </Text>
                  <InputNumber
                    min={0}
                    max={2048}
                    size="small"
                    style={{ width: '100%' }}
                    value={Math.round(p[k] ?? 0)}
                    onChange={(v) => updateNodeParam(id, k, Number(v) || 0)}
                  />
                </Col>
              ))}
            </Row>
          )
        case 'matteContiguous':
        case 'matteGlobal':
          return (
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <div>
                <Text style={{ color: '#9aa3b5', fontSize: 11 }}>{t('roninProWorkflowTolerance')}</Text>
                <InputNumber
                  min={0}
                  max={150}
                  size="small"
                  style={INPUT_FULL}
                  value={Math.round(p.tolerance ?? 80)}
                  onChange={(v) => updateNodeParam(id, 'tolerance', wfClampInt(v, 0, 150, 80))}
                />
              </div>
              <div>
                <Text style={{ color: '#9aa3b5', fontSize: 11 }}>{t('roninProWorkflowFeather')}</Text>
                <InputNumber
                  min={0}
                  max={40}
                  size="small"
                  style={INPUT_FULL}
                  value={Math.round(p.feather ?? 5)}
                  onChange={(v) => updateNodeParam(id, 'feather', wfClampInt(v, 0, 40, 5))}
                />
              </div>
            </Space>
          )
        case 'matteDoubleBackground':
          return (
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <Text style={{ color: '#8b93a5', fontSize: 11 }}>{t('roninProWorkflowDoubleBgPortsHint')}</Text>
              <div>
                <Text style={{ color: '#9aa3b5', fontSize: 11 }}>{t('roninProWorkflowDoubleBgTolerance')}</Text>
                <InputNumber
                  min={0}
                  max={100}
                  size="small"
                  style={INPUT_FULL}
                  value={Math.round(p.tolerance ?? 70)}
                  onChange={(v) => updateNodeParam(id, 'tolerance', wfClampInt(v, 0, 100, 70))}
                />
              </div>
              <div>
                <Text style={{ color: '#9aa3b5', fontSize: 11 }}>{t('roninProWorkflowDoubleBgEdgeContrast')}</Text>
                <InputNumber
                  min={0}
                  max={100}
                  size="small"
                  style={INPUT_FULL}
                  value={Math.round(p.edgeContrast ?? 53)}
                  onChange={(v) => updateNodeParam(id, 'edgeContrast', wfClampInt(v, 0, 100, 53))}
                />
              </div>
            </Space>
          )
        case 'mattePostRepair':
          return (
            <Text style={{ color: '#8b93a5', fontSize: 11 }}>{t('roninProWorkflowMattePostRepairHint')}</Text>
          )
        case 'alphaFrontierErode':
          return (
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <Text style={{ color: '#8b93a5', fontSize: 11 }}>{t('roninProWorkflowAlphaFrontierErodeHint')}</Text>
              <div>
                <Text style={{ color: '#9aa3b5', fontSize: 11 }}>{t('roninProWorkflowAlphaFrontierErodeStrength')}</Text>
                <Slider
                  min={0}
                  max={100}
                  value={Math.round(p.erosion ?? 0)}
                  onChange={(v) => updateNodeParam(id, 'erosion', Math.round(v))}
                />
              </div>
            </Space>
          )
        case 'padExpand':
          return (
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              {(
                [
                  ['padTop', 'roninProWorkflowPadTop'],
                  ['padRight', 'roninProWorkflowPadRight'],
                  ['padBottom', 'roninProWorkflowPadBottom'],
                  ['padLeft', 'roninProWorkflowPadLeft'],
                ] as const
              ).map(([key, tk]) => (
                <div key={key}>
                  <Text style={{ color: '#9aa3b5', fontSize: 11 }}>{t(tk)}</Text>
                  <InputNumber
                    min={0}
                    max={512}
                    size="small"
                    style={INPUT_FULL}
                    value={Math.round(p[key] ?? 0)}
                    onChange={(v) => updateNodeParam(id, key, wfClampInt(v, 0, 512, 0))}
                  />
                </div>
              ))}
            </Space>
          )
        case 'evenSplitStrip':
          return (
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <div>
                <Text style={{ color: '#9aa3b5', fontSize: 11 }}>{t('roninProWorkflowEvenCols')}</Text>
                <InputNumber
                  min={1}
                  max={32}
                  size="small"
                  style={INPUT_FULL}
                  value={Math.round(p.evenCols ?? 4)}
                  onChange={(v) => updateNodeParam(id, 'evenCols', wfClampInt(v, 1, 32, 4))}
                />
              </div>
              <div>
                <Text style={{ color: '#9aa3b5', fontSize: 11 }}>{t('roninProWorkflowEvenRows')}</Text>
                <InputNumber
                  min={1}
                  max={32}
                  size="small"
                  style={INPUT_FULL}
                  value={Math.round(p.evenRows ?? 4)}
                  onChange={(v) => updateNodeParam(id, 'evenRows', wfClampInt(v, 1, 32, 4))}
                />
              </div>
            </Space>
          )
        case 'evenSplitPerCellEdge':
          return (
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <Text style={{ color: '#8b93a5', fontSize: 11 }}>{t('roninProWorkflowEvenSplitPerCellEdgeHint')}</Text>
              <div>
                <Text style={{ color: '#9aa3b5', fontSize: 11 }}>{t('roninProWorkflowEvenCols')}</Text>
                <InputNumber
                  min={1}
                  max={32}
                  size="small"
                  style={INPUT_FULL}
                  value={Math.round(p.evenCols ?? 4)}
                  onChange={(v) => updateNodeParam(id, 'evenCols', wfClampInt(v, 1, 32, 4))}
                />
              </div>
              <div>
                <Text style={{ color: '#9aa3b5', fontSize: 11 }}>{t('roninProWorkflowEvenRows')}</Text>
                <InputNumber
                  min={1}
                  max={32}
                  size="small"
                  style={INPUT_FULL}
                  value={Math.round(p.evenRows ?? 4)}
                  onChange={(v) => updateNodeParam(id, 'evenRows', wfClampInt(v, 1, 32, 4))}
                />
              </div>
              <div>
                <Text style={{ color: '#9aa3b5', fontSize: 11 }}>{t('roninProWorkflowCellEdgeMode')}</Text>
                <Select
                  size="small"
                  style={INPUT_FULL}
                  value={(p.cellEdgeMode ?? 0) !== 0 ? 1 : 0}
                  options={[
                    { value: 0, label: t('roninProWorkflowCellEdgeModePad') },
                    { value: 1, label: t('roninProWorkflowCellEdgeModeCrop') },
                  ]}
                  onChange={(v) => updateNodeParam(id, 'cellEdgeMode', v === 1 ? 1 : 0)}
                />
              </div>
              {(
                [
                  ['edgeL', 'roninProWorkflowCellEdgeL'],
                  ['edgeT', 'roninProWorkflowCellEdgeT'],
                  ['edgeR', 'roninProWorkflowCellEdgeR'],
                  ['edgeB', 'roninProWorkflowCellEdgeB'],
                ] as const
              ).map(([key, tk]) => (
                <div key={key}>
                  <Text style={{ color: '#9aa3b5', fontSize: 11 }}>{t(tk)}</Text>
                  <InputNumber
                    min={0}
                    max={512}
                    size="small"
                    style={INPUT_FULL}
                    value={Math.round(p[key] ?? 0)}
                    onChange={(v) => updateNodeParam(id, key, wfClampInt(v, 0, 512, 0))}
                  />
                </div>
              ))}
            </Space>
          )
        case 'mergeStrip':
          return (
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <div>
                <Text style={{ color: '#9aa3b5', fontSize: 11 }}>{t('roninProWorkflowMergeCols')}</Text>
                <InputNumber
                  min={1}
                  max={32}
                  size="small"
                  style={INPUT_FULL}
                  value={Math.round(p.mergeCols ?? 4)}
                  onChange={(v) => updateNodeParam(id, 'mergeCols', wfClampInt(v, 1, 32, 4))}
                />
              </div>
              <div>
                <Text style={{ color: '#9aa3b5', fontSize: 11 }}>{t('roninProWorkflowFrameCount')}</Text>
                <InputNumber
                  min={1}
                  max={4096}
                  size="small"
                  style={INPUT_FULL}
                  value={Math.round(p.frameCount ?? 16)}
                  onChange={(v) => updateNodeParam(id, 'frameCount', wfClampInt(v, 1, 4096, 16))}
                />
              </div>
            </Space>
          )
        case 'simpleStitchVertical': {
          const slots = getStitchInputSlotCount(n)
          return (
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <div>
                <Text style={{ color: '#9aa3b5', fontSize: 11 }}>{t('roninProWorkflowStitchMode')}</Text>
                <Select
                  size="small"
                  style={{ ...INPUT_FULL, marginTop: 4 }}
                  value={Math.max(0, Math.min(2, Math.round(p.stitchMode ?? 0)))}
                  options={[
                    { value: 0, label: t('roninProWorkflowStitchModeVertical') },
                    { value: 1, label: t('roninProWorkflowStitchModeHorizontal') },
                    { value: 2, label: t('roninProWorkflowStitchModeOverlay') },
                  ]}
                  onChange={(v) => updateNodeParam(id, 'stitchMode', typeof v === 'number' ? v : 0)}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text style={{ color: '#9aa3b5', fontSize: 11 }}>{t('roninProWorkflowStitchInputSlots', { n: slots })}</Text>
                <Button
                  type="dashed"
                  size="small"
                  icon={<PlusOutlined />}
                  disabled={slots >= 16}
                  onClick={() => adjustStitchSlotCount(id, 1)}
                />
                <Button
                  type="default"
                  size="small"
                  disabled={slots <= 2}
                  onClick={() => adjustStitchSlotCount(id, -1)}
                >
                  −
                </Button>
              </div>
              <Text style={{ color: '#7a8499', fontSize: 10 }}>{t('roninProWorkflowSimpleStitchVerticalHint')}</Text>
            </Space>
          )
        }
        case 'gridDeleteRow':
        case 'gridDeleteCol':
        case 'gridExpandRow':
        case 'gridExpandCol':
        case 'gridFlipRow':
        case 'gridFlipCol':
        case 'gridCopyRow':
        case 'gridCopyCol': {
          const gc = Math.max(1, Math.round(p.gCols ?? 4))
          const gr = Math.max(1, Math.round(p.gRows ?? 4))
          const gridCommon = (
            <>
              <div>
                <Text style={{ color: '#9aa3b5', fontSize: 11 }}>{t('roninProWorkflowGridCols')}</Text>
                <InputNumber
                  min={1}
                  max={32}
                  size="small"
                  style={INPUT_FULL}
                  value={gc}
                  onChange={(v) => updateNodeParam(id, 'gCols', wfClampInt(v, 1, 32, 4))}
                />
              </div>
              <div>
                <Text style={{ color: '#9aa3b5', fontSize: 11 }}>{t('roninProWorkflowGridRows')}</Text>
                <InputNumber
                  min={1}
                  max={32}
                  size="small"
                  style={INPUT_FULL}
                  value={gr}
                  onChange={(v) => updateNodeParam(id, 'gRows', wfClampInt(v, 1, 32, 4))}
                />
              </div>
              <Text style={{ color: '#7a8499', fontSize: 10 }}>{t('roninProWorkflowGridCellHint')}</Text>
            </>
          )
          if (n.type === 'gridDeleteRow') {
            return (
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                {gridCommon}
                <div>
                  <Text style={{ color: '#9aa3b5', fontSize: 11 }}>{t('roninProWorkflowRowIndex')}</Text>
                  <InputNumber
                    min={1}
                    max={gr}
                    size="small"
                    style={INPUT_FULL}
                    value={Math.round(p.rowIndex ?? 1)}
                    onChange={(v) => updateNodeParam(id, 'rowIndex', wfClampInt(v, 1, gr, 1))}
                  />
                </div>
              </Space>
            )
          }
          if (n.type === 'gridDeleteCol' || n.type === 'gridFlipCol') {
            return (
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                {gridCommon}
                <div>
                  <Text style={{ color: '#9aa3b5', fontSize: 11 }}>{t('roninProWorkflowColIndex')}</Text>
                  <InputNumber
                    min={1}
                    max={gc}
                    size="small"
                    style={INPUT_FULL}
                    value={Math.round(p.colIndex ?? 1)}
                    onChange={(v) => updateNodeParam(id, 'colIndex', wfClampInt(v, 1, gc, 1))}
                  />
                </div>
              </Space>
            )
          }
          if (n.type === 'gridCopyCol') {
            return (
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                {gridCommon}
                <div>
                  <Text style={{ color: '#9aa3b5', fontSize: 11 }}>{t('roninProWorkflowCopySourceCol')}</Text>
                  <InputNumber
                    min={1}
                    max={gc}
                    size="small"
                    style={INPUT_FULL}
                    value={Math.round(p.colIndex ?? 1)}
                    onChange={(v) => updateNodeParam(id, 'colIndex', wfClampInt(v, 1, gc, 1))}
                  />
                </div>
                <div>
                  <Text style={{ color: '#9aa3b5', fontSize: 11 }}>{t('roninProWorkflowCopyInsertBeforeCol')}</Text>
                  <InputNumber
                    min={1}
                    max={gc + 1}
                    size="small"
                    style={INPUT_FULL}
                    value={Math.round(p.atCol ?? 2)}
                    onChange={(v) => updateNodeParam(id, 'atCol', wfClampInt(v, 1, gc + 1, 2))}
                  />
                </div>
                <Text style={{ color: '#7a8499', fontSize: 10 }}>{t('roninProWorkflowGridCopyColHint')}</Text>
              </Space>
            )
          }
          if (n.type === 'gridExpandRow') {
            return (
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                {gridCommon}
                <div>
                  <Text style={{ color: '#9aa3b5', fontSize: 11 }}>{t('roninProWorkflowAtRow')}</Text>
                  <InputNumber
                    min={1}
                    max={gr + 1}
                    size="small"
                    style={INPUT_FULL}
                    value={Math.round(p.atRow ?? 1)}
                    onChange={(v) => updateNodeParam(id, 'atRow', wfClampInt(v, 1, gr + 1, 1))}
                  />
                </div>
                <Text style={{ color: '#7a8499', fontSize: 10 }}>{t('roninProWorkflowExpandBandAuto')}</Text>
              </Space>
            )
          }
          if (n.type === 'gridExpandCol') {
            return (
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                {gridCommon}
                <div>
                  <Text style={{ color: '#9aa3b5', fontSize: 11 }}>{t('roninProWorkflowAtCol')}</Text>
                  <InputNumber
                    min={1}
                    max={gc + 1}
                    size="small"
                    style={INPUT_FULL}
                    value={Math.round(p.atCol ?? 1)}
                    onChange={(v) => updateNodeParam(id, 'atCol', wfClampInt(v, 1, gc + 1, 1))}
                  />
                </div>
                <Text style={{ color: '#7a8499', fontSize: 10 }}>{t('roninProWorkflowExpandBandAuto')}</Text>
              </Space>
            )
          }
          if (n.type === 'gridFlipRow') {
            return (
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                {gridCommon}
                <div>
                  <Text style={{ color: '#9aa3b5', fontSize: 11 }}>{t('roninProWorkflowRowIndex')}</Text>
                  <InputNumber
                    min={1}
                    max={gr}
                    size="small"
                    style={INPUT_FULL}
                    value={Math.round(p.rowIndex ?? 1)}
                    onChange={(v) => updateNodeParam(id, 'rowIndex', wfClampInt(v, 1, gr, 1))}
                  />
                </div>
              </Space>
            )
          }
          if (n.type === 'gridCopyRow') {
            return (
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                {gridCommon}
                <div>
                  <Text style={{ color: '#9aa3b5', fontSize: 11 }}>{t('roninProWorkflowCopySourceRow')}</Text>
                  <InputNumber
                    min={1}
                    max={gr}
                    size="small"
                    style={INPUT_FULL}
                    value={Math.round(p.rowIndex ?? 1)}
                    onChange={(v) => updateNodeParam(id, 'rowIndex', wfClampInt(v, 1, gr, 1))}
                  />
                </div>
                <div>
                  <Text style={{ color: '#9aa3b5', fontSize: 11 }}>{t('roninProWorkflowCopyInsertBeforeRow')}</Text>
                  <InputNumber
                    min={1}
                    max={gr + 1}
                    size="small"
                    style={INPUT_FULL}
                    value={Math.round(p.atRow ?? 2)}
                    onChange={(v) => updateNodeParam(id, 'atRow', wfClampInt(v, 1, gr + 1, 2))}
                  />
                </div>
                <Text style={{ color: '#7a8499', fontSize: 10 }}>{t('roninProWorkflowGridCopyRowHint')}</Text>
              </Space>
            )
          }
          return null
        }
        case 'customGridRearrange': {
          const sc = Math.max(1, Math.round(p.splitCols ?? 2))
          const sr = Math.max(1, Math.round(p.splitRows ?? 2))
          const or = Math.max(1, Math.round(p.outRows ?? 2))
          const oc = Math.max(1, Math.round(p.outCols ?? 2))
          const maxIdx = sc * sr
          const cellInputW = getCustomRearrangeInputWidth(n)
          const grid =
            n.rearrangeGrid ?? buildDefaultRearrangeGrid(or, oc, sc, sr)
          return (
            <Space direction="vertical" style={{ width: '100%', minWidth: 0 }} size="small">
              <div>
                <Text style={{ color: '#9aa3b5', fontSize: 11 }}>
                  {t('roninProWorkflowRearrangeSplitCols')}
                </Text>
                <InputNumber
                  min={1}
                  max={32}
                  size="small"
                  style={INPUT_FULL}
                  value={sc}
                  onChange={(v) =>
                    updateCustomRearrangeDimension(id, 'splitCols', wfClampInt(v, 1, 32, 2))
                  }
                />
              </div>
              <div>
                <Text style={{ color: '#9aa3b5', fontSize: 11 }}>
                  {t('roninProWorkflowRearrangeSplitRows')}
                </Text>
                <InputNumber
                  min={1}
                  max={32}
                  size="small"
                  style={INPUT_FULL}
                  value={sr}
                  onChange={(v) =>
                    updateCustomRearrangeDimension(id, 'splitRows', wfClampInt(v, 1, 32, 2))
                  }
                />
              </div>
              <div>
                <Text style={{ color: '#9aa3b5', fontSize: 11 }}>
                  {t('roninProWorkflowRearrangeOutRows')}
                </Text>
                <InputNumber
                  min={1}
                  max={64}
                  size="small"
                  style={INPUT_FULL}
                  value={or}
                  onChange={(v) =>
                    updateCustomRearrangeDimension(id, 'outRows', wfClampInt(v, 1, 64, 2))
                  }
                />
              </div>
              <div>
                <Text style={{ color: '#9aa3b5', fontSize: 11 }}>
                  {t('roninProWorkflowRearrangeOutCols')}
                </Text>
                <InputNumber
                  min={1}
                  max={64}
                  size="small"
                  style={INPUT_FULL}
                  value={oc}
                  onChange={(v) =>
                    updateCustomRearrangeDimension(id, 'outCols', wfClampInt(v, 1, 64, 2))
                  }
                />
              </div>
              <Text style={{ color: '#7a8499', fontSize: 10 }}>{t('roninProWorkflowRearrangeGridHint')}</Text>
              <Button
                type="default"
                size="small"
                block
                icon={<OrderedListOutlined />}
                onClick={() => fillRearrangeGridAutoSequence(id)}
                style={{ marginTop: 2 }}
              >
                {t('roninProWorkflowRearrangeAutoFill')}
              </Button>
              <div style={{ width: '100%', minWidth: 0 }}>
                <table
                  style={{
                    borderCollapse: 'collapse',
                    fontSize: 11,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    width: '100%',
                    tableLayout: 'fixed',
                  }}
                >
                  <colgroup>
                    {Array.from({ length: oc }, (_, col) => (
                      <col key={col} style={{ width: `${100 / oc}%` }} />
                    ))}
                  </colgroup>
                  <tbody>
                    {grid.map((rowData, row) => (
                      <tr key={row}>
                        {rowData.map((val, col) => (
                          <td
                            key={col}
                            style={{
                              border: '1px solid rgba(255,255,255,0.12)',
                              padding: 3,
                              verticalAlign: 'middle',
                              boxSizing: 'border-box',
                            }}
                          >
                            <InputNumber
                              size="small"
                              controls={false}
                              min={-maxIdx}
                              max={maxIdx}
                              value={val}
                              onChange={(v) => updateCustomRearrangeCell(id, row, col, v ?? 0)}
                              style={{
                                width: '100%',
                                minWidth: cellInputW,
                                maxWidth: '100%',
                              }}
                              className="ronin-blueprint-rearrange-cell"
                              placeholder="0"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Space>
          )
        }
        default:
          return null
      }
    },
    [t, updateNodeParam, adjustStitchSlotCount, updateCustomRearrangeDimension, updateCustomRearrangeCell, fillRearrangeGridAutoSequence, fileItems]
  )

  return (
    <Fragment>
    <Space direction="vertical" size="large" style={{ width: '100%', maxWidth: '100%', marginRight: 'min(336px, calc(100vw - 32px))' }}>
      <Text type="secondary">{t('roninProCustomWorkflowHint')}</Text>

      <WorkflowBlueprintCanvas
        nodes={graphNodes}
        edges={graphEdges}
        setNodes={setGraphNodes}
        setEdges={setGraphEdges}
        getNodeTitle={(n) => t(NODE_LABEL_I18N[n.type])}
        renderNodeBody={renderNodeBody}
        tHint={t}
        onPaletteDrop={(type, x, y) => addNodeAt(type, x, y)}
        onInputImageDrop={(imageIndex1, x, y) => addInputImageAt(imageIndex1, x, y)}
        onToolPlaceAt={onBlueprintToolPlaceAt}
      />

      <div>
        <Text strong>{t('roninProWorkflowIoTitle')}</Text>
        <div style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 12, color: '#9aa3b5' }}>{t('roninProWorkflowPresetName')}</Text>
          <Input
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder={t('roninProWorkflowPresetNamePlaceholder')}
            maxLength={120}
            allowClear
            style={{ marginTop: 4, maxWidth: 400 }}
          />
        </div>
        <Space wrap style={{ marginTop: 8 }}>
          <Button onClick={saveJsonToFile}>{t('roninProWorkflowSaveJson')}</Button>
          <Button
            onClick={() => document.getElementById('ronin-workflow-json-input')?.click()}
          >
            {t('roninProWorkflowLoadJson')}
          </Button>
          <input
            id="ronin-workflow-json-input"
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={onPickJsonFile}
          />
          <Button onClick={loadJsonFromStorage}>{t('roninProWorkflowLoadLast')}</Button>
          <Button
            type={finishedPresetsOpen ? 'primary' : 'default'}
            onClick={() => setFinishedPresetsOpen((o) => !o)}
          >
            {t('roninProWorkflowLoadFinishedPresets')}
          </Button>
        </Space>
        {finishedPresetsOpen && (
          <Space wrap style={{ marginTop: 8 }}>
            {WORKFLOW_BPSET_PRESETS.map((p) => (
              <Button
                key={p.id}
                loading={bpsetLoadingId === p.id}
                onClick={() => void loadBpsetPreset(p.id, p.url)}
              >
                {t(p.labelKey)}
              </Button>
            ))}
          </Space>
        )}
      </div>

      <div>
        <Text strong>{t('roninProWorkflowImages')}</Text>
        <StashDropZone
          onStashDrop={(file) => {
            setFileItems((prev) => [...prev, createWorkflowInputFile(file)])
          }}
          maxSizeMB={20}
          onSizeError={() => message.error(t('imageSizeError'))}
        >
          <Dragger
            multiple
            accept={IMAGE_ACCEPT.join(',')}
            showUploadList={false}
            beforeUpload={(file) => {
              setFileItems((prev) => [...prev, createWorkflowInputFile(file)])
              return false
            }}
          >
            <p className="ant-upload-drag-icon">
              <ExpandOutlined />
            </p>
            <p className="ant-upload-text">{t('roninProWorkflowUploadHint')}</p>
          </Dragger>
          {fileItems.length > 0 && (
            <div
              className="ronin-workflow-input-thumbs"
              style={{
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 14,
                marginTop: 14,
                alignItems: 'flex-start',
              }}
            >
              {fileItems.map((item, idx) => (
                <div
                  key={item.id}
                  style={{
                    position: 'relative',
                    width: 104,
                    flexShrink: 0,
                    textAlign: 'center',
                  }}
                >
                  <div
                    draggable
                    title={t('roninProWorkflowDragThumbToBlueprint')}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(WORKFLOW_DRAG_INPUT_IMAGE_INDEX, String(idx + 1))
                      e.dataTransfer.effectAllowed = 'copy'
                    }}
                    style={{
                      position: 'relative',
                      width: 104,
                      height: 104,
                      borderRadius: 8,
                      overflow: 'hidden',
                      border: '1px solid var(--ant-color-border-secondary)',
                      background: 'var(--ant-color-fill-quaternary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'grab',
                    }}
                  >
                    <img
                      src={item.thumbUrl}
                      alt=""
                      draggable={false}
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        width: 'auto',
                        height: 'auto',
                        objectFit: 'contain',
                        display: 'block',
                      }}
                    />
                    <Button
                      type="primary"
                      size="small"
                      icon={<PlusOutlined />}
                      aria-label={t('roninProWorkflowAddThumbToBlueprint')}
                      title={t('roninProWorkflowAddThumbToBlueprint')}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation()
                        addInputImageAt(idx + 1)
                      }}
                      style={{
                        position: 'absolute',
                        left: 2,
                        bottom: 2,
                        minWidth: 26,
                        width: 26,
                        height: 26,
                        padding: 0,
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                      }}
                    />
                  </div>
                  <Text type="secondary" style={{ fontSize: 13, display: 'block', marginTop: 6 }}>
                    {idx + 1}
                  </Text>
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<CloseOutlined />}
                    aria-label={t('stashRemove')}
                    onClick={() => removeWorkflowInputFile(item.id)}
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      minWidth: 28,
                      width: 28,
                      height: 28,
                      padding: 0,
                      borderRadius: '50%',
                      background: 'var(--ant-color-bg-container)',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </StashDropZone>
      </div>

      <Button type="primary" loading={running} onClick={handleRunAll} block>
        {t(
          graphNodes.some((n) => n.type === 'workflowInputImage')
            ? 'roninProWorkflowRunTargeted'
            : 'roninProWorkflowRunAll'
        )}
      </Button>

      {results.length > 0 && (
        <div>
          <Text strong>{t('roninProWorkflowResults')}</Text>
          <Row gutter={[16, 16]} style={{ marginTop: 12 }}>
            {results.map((r) => (
              <Col xs={24} sm={12} key={r.url}>
                <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 8 }}>
                  {onSendToFineProcess ? (
                    <Dropdown
                      menu={{
                        items: [
                          {
                            key: 'fine',
                            label: t('roninProWorkflowSendToFine'),
                            onClick: () => {
                              void (async () => {
                                try {
                                  const res = await fetch(r.url)
                                  const blob = await res.blob()
                                  const base = r.name.replace(/\.[^.]+$/, '') || `workflow_${Date.now()}`
                                  const name = /\.(png|jpe?g|webp)$/i.test(r.name) ? r.name : `${base}.png`
                                  onSendToFineProcess(blob, name)
                                  message.success(t('imgSendToFineProcessDone'))
                                } catch {
                                  message.error(t('roninProWorkflowFailed'))
                                }
                              })()
                            },
                          },
                        ],
                      }}
                      trigger={['contextMenu']}
                    >
                      <img
                        src={r.url}
                        alt=""
                        style={{
                          maxWidth: '100%',
                          maxHeight: 200,
                          objectFit: 'contain',
                          display: 'block',
                          margin: '0 auto',
                          cursor: 'context-menu',
                        }}
                      />
                    </Dropdown>
                  ) : (
                    <img
                      src={r.url}
                      alt=""
                      style={{
                        maxWidth: '100%',
                        maxHeight: 200,
                        objectFit: 'contain',
                        display: 'block',
                        margin: '0 auto',
                      }}
                    />
                  )}
                  <Button
                    type="link"
                    block
                    style={{ marginTop: 8 }}
                    onClick={() => {
                      const a = document.createElement('a')
                      a.href = r.url
                      a.download = r.name
                      a.click()
                    }}
                  >
                    {t('roninProWorkflowDownload')}
                  </Button>
                </div>
              </Col>
            ))}
          </Row>
        </div>
      )}
    </Space>

    <aside style={PALETTE_FLOAT_OUTER} aria-label={t('roninProWorkflowPalette')}>
      <Text strong style={{ fontSize: 13, display: 'block', flexShrink: 0 }}>
        {t('roninProWorkflowPalette')}
      </Text>
      <div style={PALETTE_FLOAT_SCROLL}>
        {WORKFLOW_PALETTE.map((item) => (
          <Button
            key={item.type}
            size="small"
            block
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/workflow-node-type', item.type)
              e.dataTransfer.effectAllowed = 'copy'
            }}
            onClick={() => addNodeAt(item.type)}
            style={{
              textAlign: 'left',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minWidth: 0,
              maxWidth: '100%',
            }}
          >
            {t(NODE_LABEL_I18N[item.type])}
          </Button>
        ))}
      </div>
    </aside>
    </Fragment>
  )
}
