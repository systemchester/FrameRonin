import { useCallback, useEffect, useRef, useState } from 'react'
import { CloseOutlined } from '@ant-design/icons'
import type { GraphNode, WorkflowEdge, WorkflowNodeType } from '../lib/roninProWorkflow'

const WORLD_W = 8192
const WORLD_H = 6144
export const BLUEPRINT_NODE_WIDTH = 252
const HEADER_H = 40
export const BLUEPRINT_PIN_Y = HEADER_H / 2
const PIN_HIT = 28

/** 自定义均分重组：按列数与切块编号位数估算节点宽度，避免表格局部横向滚动条 */
function customRearrangeMetrics(n: GraphNode) {
  const oc = Math.max(1, Math.round(n.params.outCols ?? 2))
  const sc = Math.max(1, Math.round(n.params.splitCols ?? 2))
  const sr = Math.max(1, Math.round(n.params.splitRows ?? 2))
  const maxIdx = Math.max(1, sc * sr)
  const maxStrLen = String(maxIdx).length + 1
  const inputW = Math.min(76, Math.max(38, 18 + maxStrLen * 10))
  return { oc, inputW, maxIdx }
}

export function getBlueprintNodeWidth(n: GraphNode): number {
  if (n.type !== 'customGridRearrange') return BLUEPRINT_NODE_WIDTH
  const { oc, inputW } = customRearrangeMetrics(n)
  const perCell = inputW + 10
  const inner = oc * perCell
  const w = 24 + inner + 12
  return Math.min(980, Math.max(BLUEPRINT_NODE_WIDTH, Math.ceil(w)))
}

/** 格子内 InputNumber 宽度（与 getBlueprintNodeWidth 一致） */
export function getCustomRearrangeInputWidth(n: GraphNode): number {
  if (n.type !== 'customGridRearrange') return 48
  return customRearrangeMetrics(n).inputW
}

type ConnectingState = { sourceId: string } | null

export interface WorkflowBlueprintCanvasProps {
  nodes: GraphNode[]
  edges: WorkflowEdge[]
  setNodes: React.Dispatch<React.SetStateAction<GraphNode[]>>
  setEdges: React.Dispatch<React.SetStateAction<WorkflowEdge[]>>
  getNodeTitle: (n: GraphNode) => string
  renderNodeBody: (n: GraphNode) => React.ReactNode
  tHint: (key: string) => string
  onPaletteDrop: (type: WorkflowNodeType, x: number, y: number) => void
}

function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.max(64, Math.abs(x2 - x1) * 0.45)
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
}

export default function WorkflowBlueprintCanvas({
  nodes,
  edges,
  setNodes,
  setEdges,
  getNodeTitle,
  renderNodeBody,
  tHint,
  onPaletteDrop,
}: WorkflowBlueprintCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const [pan, setPan] = useState({ x: 40, y: 40 })
  const [scale, setScale] = useState(0.85)
  const [connecting, setConnecting] = useState<ConnectingState>(null)
  const [wireEnd, setWireEnd] = useState<{ x: number; y: number } | null>(null)
  const connectRef = useRef<ConnectingState>(null)
  const wireEndRef = useRef<{ x: number; y: number } | null>(null)
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const panDrag = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null)
  const nodeDrag = useRef<{
    id: string
    sx: number
    sy: number
    nx: number
    ny: number
  } | null>(null)

  const clientToWorld = useCallback((clientX: number, clientY: number) => {
    const wr = worldRef.current?.getBoundingClientRect()
    if (!wr || wr.width < 1 || wr.height < 1) return { x: 0, y: 0 }
    return {
      x: ((clientX - wr.left) / wr.width) * WORLD_W,
      y: ((clientY - wr.top) / wr.height) * WORLD_H,
    }
  }, [])

  const outputPin = useCallback((n: GraphNode) => {
    return { x: n.x + getBlueprintNodeWidth(n), y: n.y + BLUEPRINT_PIN_Y }
  }, [])

  const inputPin = useCallback((n: GraphNode) => {
    return { x: n.x, y: n.y + BLUEPRINT_PIN_Y }
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (panDrag.current) {
        const d = panDrag.current
        setPan({
          x: d.px + (e.clientX - d.sx),
          y: d.py + (e.clientY - d.sy),
        })
        return
      }
      if (nodeDrag.current) {
        const d = nodeDrag.current
        const dx = (e.clientX - d.sx) / scale
        const dy = (e.clientY - d.sy) / scale
        setNodes((list) =>
          list.map((n) => (n.id === d.id ? { ...n, x: d.nx + dx, y: d.ny + dy } : n))
        )
        return
      }
      if (connectRef.current) {
        const w = clientToWorld(e.clientX, e.clientY)
        wireEndRef.current = w
        setWireEnd(w)
      }
    }
    const onUp = () => {
      if (panDrag.current) {
        panDrag.current = null
        return
      }
      if (nodeDrag.current) {
        nodeDrag.current = null
        return
      }
      const c = connectRef.current
      const we = wireEndRef.current
      if (c && we) {
        const list = nodesRef.current
        const target = list.find((n) => {
          if (n.id === c.sourceId) return false
          const p = { x: n.x, y: n.y + BLUEPRINT_PIN_Y }
          const dx = we.x - p.x
          const dy = we.y - p.y
          return dx * dx + dy * dy < PIN_HIT * PIN_HIT
        })
        if (target) {
          const sid = c.sourceId
          const tid = target.id
          setEdges((prev) => {
            const next = prev.filter((ed) => ed.source !== sid && ed.target !== tid)
            next.push({
              id: `e-${sid}-${tid}-${Date.now()}`,
              source: sid,
              target: tid,
            })
            return next
          })
        }
        connectRef.current = null
        wireEndRef.current = null
        setConnecting(null)
        setWireEnd(null)
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [setNodes, setEdges, scale, clientToWorld])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedEdgeId) {
          setEdges((prev) => prev.filter((x) => x.id !== selectedEdgeId))
          setSelectedEdgeId(null)
          return
        }
        if (selectedId) {
          setNodes((prev) => prev.filter((n) => n.id !== selectedId))
          setEdges((prev) => prev.filter((ed) => ed.source !== selectedId && ed.target !== selectedId))
          setSelectedId(null)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, selectedEdgeId, setNodes, setEdges])

  const onViewportWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.92 : 1.09
    setScale((s) => Math.min(2.2, Math.max(0.35, s * factor)))
  }

  const startPan = (e: React.MouseEvent) => {
    if (e.button !== 1 && e.button !== 2) return
    e.preventDefault()
    panDrag.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y }
  }

  const onWorldBackgroundMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || e.button === 2) {
      e.stopPropagation()
      startPan(e)
    }
  }

  const onOutputMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    e.preventDefault()
    if (e.button !== 0) return
    const state: ConnectingState = { sourceId: nodeId }
    connectRef.current = state
    setConnecting(state)
    const n = nodesRef.current.find((x) => x.id === nodeId)
    if (n) {
      const p = outputPin(n)
      wireEndRef.current = p
      setWireEnd(p)
    }
  }

  const onHeaderMouseDown = (e: React.MouseEvent, n: GraphNode) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    setSelectedId(n.id)
    nodeDrag.current = {
      id: n.id,
      sx: e.clientX,
      sy: e.clientY,
      nx: n.x,
      ny: n.y,
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const type = e.dataTransfer.getData('application/workflow-node-type') as WorkflowNodeType
    if (!type) return
    const w = clientToWorld(e.clientX, e.clientY)
    const x = Math.max(0, Math.min(WORLD_W - BLUEPRINT_NODE_WIDTH, w.x - BLUEPRINT_NODE_WIDTH / 2))
    const y = Math.max(0, Math.min(WORLD_H - 120, w.y - HEADER_H))
    onPaletteDrop(type, x, y)
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        style={{
          fontSize: 12,
          color: '#8b8b9a',
          lineHeight: 1.5,
        }}
      >
        {tHint('roninProWorkflowBlueprintHint')}
      </div>
      <div
        ref={viewportRef}
        onWheel={onViewportWheel}
        onContextMenu={(e) => e.preventDefault()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onMouseDown={(e) => {
          if (e.button === 0) {
            setSelectedId(null)
            setSelectedEdgeId(null)
            return
          }
          if (e.button === 1 || e.button === 2) {
            startPan(e)
          }
        }}
        style={{
          height: 520,
          borderRadius: 8,
          overflow: 'hidden',
          background: '#12141a',
          border: '1px solid #2a2e3a',
          position: 'relative',
        }}
      >
        {/* 视口级无限网格：不随 world 尺寸截断，平移/缩放时与画布内容对齐 */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            pointerEvents: 'none',
            backgroundColor: '#16181f',
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)
            `,
            backgroundSize: `${24 * scale}px ${24 * scale}px`,
            backgroundPosition: `${pan.x - 1}px ${pan.y - 1}px`,
            backgroundRepeat: 'repeat',
            borderRadius: 8,
          }}
        />
        <div
          ref={worldRef}
          style={{
            width: WORLD_W,
            height: WORLD_H,
            position: 'absolute',
            left: 0,
            top: 0,
            zIndex: 1,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            backgroundColor: 'transparent',
          }}
        >
          {/* 空白网格：平移 / 取消选中 */}
          <div
            onMouseDown={onWorldBackgroundMouseDown}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 0,
            }}
          />

          <svg
            width={WORLD_W}
            height={WORLD_H}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              zIndex: 1,
              pointerEvents: 'none',
              overflow: 'visible',
            }}
          >
            {edges.map((ed) => {
              const sn = nodes.find((n) => n.id === ed.source)
              const tn = nodes.find((n) => n.id === ed.target)
              if (!sn || !tn) return null
              const p0 = outputPin(sn)
              const p1 = inputPin(tn)
              const d = bezierPath(p0.x, p0.y, p1.x, p1.y)
              return (
                <path
                  key={ed.id}
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={16}
                  style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedEdgeId(ed.id)
                    setSelectedId(null)
                  }}
                />
              )
            })}
            {edges.map((ed) => {
              const sn = nodes.find((n) => n.id === ed.source)
              const tn = nodes.find((n) => n.id === ed.target)
              if (!sn || !tn) return null
              const p0 = outputPin(sn)
              const p1 = inputPin(tn)
              const d = bezierPath(p0.x, p0.y, p1.x, p1.y)
              const sel = selectedEdgeId === ed.id
              return (
                <path
                  key={`${ed.id}-vis`}
                  d={d}
                  fill="none"
                  stroke={sel ? '#6eb5ff' : '#7a8fa8'}
                  strokeWidth={sel ? 3.5 : 2.5}
                  style={{ pointerEvents: 'none' }}
                />
              )
            })}
            {connecting && wireEnd && (() => {
              const sn = nodes.find((n) => n.id === connecting.sourceId)
              if (!sn) return null
              const p0 = outputPin(sn)
              return (
                <path
                  d={bezierPath(p0.x, p0.y, wireEnd.x, wireEnd.y)}
                  fill="none"
                  stroke="#4fc3f7"
                  strokeWidth={2}
                  strokeDasharray="8 6"
                  pointerEvents="none"
                />
              )
            })()}
          </svg>

          {nodes.map((n) => {
            const sel = selectedId === n.id
            const nodeW = getBlueprintNodeWidth(n)
            return (
              <div
                key={n.id}
                style={{
                  position: 'absolute',
                  left: n.x,
                  top: n.y,
                  width: nodeW,
                  minHeight: 72,
                  borderRadius: 6,
                  border: sel ? '2px solid #4fc3f7' : '1px solid #3d4555',
                  background: 'linear-gradient(180deg, #252830 0%, #1e2128 100%)',
                  boxShadow: sel ? '0 0 0 1px rgba(79,195,247,0.35)' : '0 4px 14px rgba(0,0,0,0.45)',
                  zIndex: sel ? 4 : 2,
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div
                  title={tHint('roninProWorkflowPinIn')}
                  style={{
                    position: 'absolute',
                    left: -10,
                    top: BLUEPRINT_PIN_Y - 8,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: '#1a1d24',
                    border: '2px solid #c5d4e8',
                    boxShadow: '0 0 6px rgba(197,212,232,0.4)',
                    zIndex: 5,
                    pointerEvents: 'none',
                  }}
                />
                <div
                  title={tHint('roninProWorkflowPinOut')}
                  onMouseDown={(e) => onOutputMouseDown(e, n.id)}
                  style={{
                    position: 'absolute',
                    right: -10,
                    top: BLUEPRINT_PIN_Y - 8,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: '#1a1d24',
                    border: '2px solid #e8dcc5',
                    boxShadow: '0 0 6px rgba(232,220,197,0.35)',
                    cursor: 'crosshair',
                    zIndex: 5,
                  }}
                />
                <div
                  onMouseDown={(e) => onHeaderMouseDown(e, n)}
                  style={{
                    height: HEADER_H,
                    padding: '0 28px 0 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'linear-gradient(90deg, #2a3140 0%, #232733 100%)',
                    borderRadius: '5px 5px 0 0',
                    borderBottom: '1px solid #3d4555',
                    cursor: 'grab',
                    userSelect: 'none',
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#e6eaf2',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {getNodeTitle(n)}
                  </span>
                  <CloseOutlined
                    style={{ fontSize: 12, color: '#8b93a5', cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setNodes((prev) => prev.filter((x) => x.id !== n.id))
                      setEdges((prev) => prev.filter((ed) => ed.source !== n.id && ed.target !== n.id))
                      if (selectedId === n.id) setSelectedId(null)
                    }}
                  />
                </div>
                <div
                  style={{
                    padding: '10px 12px 12px',
                    maxHeight: n.type === 'customGridRearrange' ? 560 : 440,
                    overflowX: 'hidden',
                    overflowY: 'auto',
                  }}
                  className="ronin-blueprint-node-body"
                >
                  {renderNodeBody(n)}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div style={{ fontSize: 11, color: '#888' }}>
        {tHint('roninProWorkflowBlueprintControls')}
      </div>
    </div>
  )
}
