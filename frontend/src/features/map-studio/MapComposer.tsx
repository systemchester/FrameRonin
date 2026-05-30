import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  ArrowUpOutlined,
  DownloadOutlined,
  MergeCellsOutlined,
  MinusOutlined,
  PlusOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { App, Button, Segmented, Slider, Space, Switch, Typography } from 'antd'
import { useLanguage } from '../../i18n/context'
import { drawBlendedTile, type BlendRect } from './mapBlend'
import { canvasToBlob, downloadBlob, loadImageFile } from './obstacleExport'
import type { LoadedImage } from './obstacleModel'

const { Text, Title } = Typography

type ExpandSplit = 4 | 8 | 12
type Side = 'top' | 'right' | 'bottom' | 'left'

type Tile = {
  key: string
  side: Side
  x: number
  y: number
  w: number
  h: number
}

const CENTER_TILE = { x: 0, y: 0, w: 1, h: 1 }
const MAX_IMAGE_MB = 30
const MIN_VIEW_ZOOM = 0.08
const MAX_VIEW_ZOOM = 4
const VIEW_ZOOM_STEP = 1.2

const mapComposerCopy = {
  en: {
    sideTop: 'Top',
    sideRight: 'Right',
    sideBottom: 'Bottom',
    sideLeft: 'Left',
    chooseMap: 'Please choose a map image.',
    tooLarge: 'Image must be under {size}MB.',
    chooseTile: 'Please choose an expansion tile image.',
    uploadCenterFirst: 'Upload a center map first.',
    stitchedReady: 'Stitched map generated. You can continue editing obstacles.',
    mapStitch: 'Map Stitch',
    title: 'Stitch Base Map',
    description: 'Upload the center map, add expansion tiles for each side, then generate a larger map for obstacle editing.',
    uploadCenter: 'Upload Center Map',
    replaceCenter: 'Replace Center Map',
    split: 'Split',
    expansionSettings: 'Expansion Settings',
    parts4: '4 parts',
    parts8: '8 parts',
    parts12: '12 parts',
    horizontalOverlap: 'Horizontal overlap {value}%',
    verticalOverlap: 'Vertical overlap {value}%',
    seamMask: 'Seam Mask',
    seamBlending: 'Seam Blending',
    autoBlend: 'Auto blend seams',
    blendStrength: 'Blend strength {value}%',
    next: 'Next',
    generateContinue: 'Generate and Continue',
    uploadedTiles: 'Uploaded {count} / {total} expansion tiles',
    generateAndEdit: 'Generate and Edit Obstacles',
    exportOnly: 'Export Stitched PNG Only',
    zoomOut: 'Zoom stitch preview out',
    zoomIn: 'Zoom stitch preview in',
    fit: 'Fit',
    emptyTitle: 'Upload a center map to start stitching',
    emptyHint: 'This creates the cross-shaped expansion layout used by Droi-game-tool map stitching.',
    preview: 'Stitch preview',
    replaceSide: 'Replace {side}',
    uploadSide: 'Upload {side} Tile',
    shortcut: 'Ctrl + / Ctrl - to zoom, Ctrl 0 to fit the canvas',
    fitRatio: 'Fit ratio {value}%',
  },
  zh: {
    sideTop: '上方',
    sideRight: '右侧',
    sideBottom: '下方',
    sideLeft: '左侧',
    chooseMap: '请选择地图图片。',
    tooLarge: '图片不能超过 {size}MB。',
    chooseTile: '请选择扩展块图片。',
    uploadCenterFirst: '请先上传中心地图。',
    stitchedReady: '已生成拼接底图，可以继续编辑阻挡物。',
    mapStitch: '拼接底图',
    title: '拼接底图',
    description: '先上传中心地图，再按上方、右侧、下方、左侧补充扩展块，生成一张大地图后进入阻挡物编辑。',
    uploadCenter: '上传中心地图',
    replaceCenter: '重新导入中心地图',
    split: '分割',
    expansionSettings: '扩图设置',
    parts4: '4 分',
    parts8: '8 分',
    parts12: '12 分',
    horizontalOverlap: '左右重叠 {value}%',
    verticalOverlap: '上下重叠 {value}%',
    seamMask: '接缝遮罩',
    seamBlending: '接缝柔化',
    autoBlend: '自动柔化接缝',
    blendStrength: '柔化强度 {value}%',
    next: '下一步',
    generateContinue: '生成与继续',
    uploadedTiles: '已上传 {count} / {total} 个扩展块',
    generateAndEdit: '生成拼接并编辑阻挡物',
    exportOnly: '只导出拼接 PNG',
    zoomOut: '缩小拼接预览',
    zoomIn: '放大拼接预览',
    fit: '适应',
    emptyTitle: '上传中心地图后开始拼接',
    emptyHint: '这里会生成和 Droi-game-tool 地图拼接一样的十字扩图布局。',
    preview: '拼接预览',
    replaceSide: '{side} 重新上传',
    uploadSide: '{side} 上传扩展块',
    shortcut: 'Ctrl + / Ctrl - 缩放，Ctrl 0 适应画布',
    fitRatio: '适应比例 {value}%',
  },
  ja: {
    sideTop: '上',
    sideRight: '右',
    sideBottom: '下',
    sideLeft: '左',
    chooseMap: 'マップ画像を選択してください。',
    tooLarge: '画像は {size}MB 以下にしてください。',
    chooseTile: '拡張タイル画像を選択してください。',
    uploadCenterFirst: '先に中央マップを読み込んでください。',
    stitchedReady: '結合マップを生成しました。障害物編集へ進めます。',
    mapStitch: 'マップ結合',
    title: 'ベースマップ結合',
    description: '中央マップを読み込み、各方向の拡張タイルを追加して、障害物編集用の大きなマップを生成します。',
    uploadCenter: '中央マップを読み込む',
    replaceCenter: '中央マップを差し替え',
    split: '分割',
    expansionSettings: '拡張設定',
    parts4: '4 分割',
    parts8: '8 分割',
    parts12: '12 分割',
    horizontalOverlap: '左右の重なり {value}%',
    verticalOverlap: '上下の重なり {value}%',
    seamMask: '継ぎ目マスク',
    seamBlending: '継ぎ目ブレンド',
    autoBlend: '継ぎ目を自動ブレンド',
    blendStrength: 'ブレンド強度 {value}%',
    next: '次へ',
    generateContinue: '生成して続行',
    uploadedTiles: '{count} / {total} 個の拡張タイルを読み込み済み',
    generateAndEdit: '生成して障害物を編集',
    exportOnly: '結合 PNG のみ書き出し',
    zoomOut: '結合プレビューを縮小',
    zoomIn: '結合プレビューを拡大',
    fit: 'フィット',
    emptyTitle: '中央マップを読み込んで結合開始',
    emptyHint: 'Droi-game-tool のマップ結合と同じ十字型拡張レイアウトを生成します。',
    preview: '結合プレビュー',
    replaceSide: '{side} を差し替え',
    uploadSide: '{side} タイルを読み込む',
    shortcut: 'Ctrl + / Ctrl - でズーム、Ctrl 0 でキャンバスに合わせる',
    fitRatio: 'フィット倍率 {value}%',
  },
}

function formatCopy(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ''))
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function tileKey(x: number, y: number): string {
  const fmt = (value: number) => {
    const fixed = value.toFixed(4).replace(/\.?0+$/, '')
    return fixed === '-0' ? '0' : fixed
  }
  return `${fmt(x)},${fmt(y)}`
}

function sideForTile(tile: Omit<Tile, 'key' | 'side'>): Side {
  if (tile.y + tile.h <= 0) return 'top'
  if (tile.x >= 1) return 'right'
  if (tile.y >= 1) return 'bottom'
  if (tile.x + tile.w <= 0) return 'left'
  const centerX = tile.x + tile.w / 2 - 0.5
  const centerY = tile.y + tile.h / 2 - 0.5
  if (Math.abs(centerX) > Math.abs(centerY)) return centerX > 0 ? 'right' : 'left'
  return centerY > 0 ? 'bottom' : 'top'
}

function splitSegments(start: number, size: number, count: number, overlapRatio: number): Array<{ start: number; size: number }> {
  if (count <= 1) return [{ start, size }]
  const clampedOverlap = Math.max(0, Math.min(0.95, overlapRatio))
  const segmentSize = size / (count - (count - 1) * clampedOverlap)
  const segmentStep = segmentSize * (1 - clampedOverlap)
  return Array.from({ length: count }, (_, index) => ({
    start: index === count - 1 ? start + size - segmentSize : start + index * segmentStep,
    size: segmentSize,
  }))
}

function expansionTilesFrom(
  origin: Omit<Tile, 'key' | 'side'>,
  split: ExpandSplit,
  horizontalOverlap: number,
  verticalOverlap: number,
): Tile[] {
  const count = split / 4
  const horizontalSegments = splitSegments(origin.x, origin.w, count, horizontalOverlap)
  const verticalSegments = splitSegments(origin.y, origin.h, count, verticalOverlap)
  const tiles: Tile[] = []

  horizontalSegments.forEach((segment) => {
    const tileSize = segment.size
    const top = {
      x: segment.start,
      y: origin.y - tileSize * (1 - verticalOverlap),
      w: tileSize,
      h: tileSize,
    }
    const bottom = {
      x: segment.start,
      y: origin.y + origin.h - tileSize * verticalOverlap,
      w: tileSize,
      h: tileSize,
    }
    tiles.push({ ...top, key: tileKey(top.x, top.y), side: sideForTile(top) })
    tiles.push({ ...bottom, key: tileKey(bottom.x, bottom.y), side: sideForTile(bottom) })
  })

  verticalSegments.forEach((segment) => {
    const tileSize = segment.size
    const right = {
      x: origin.x + origin.w - tileSize * horizontalOverlap,
      y: segment.start,
      w: tileSize,
      h: tileSize,
    }
    const left = {
      x: origin.x - tileSize * (1 - horizontalOverlap),
      y: segment.start,
      w: tileSize,
      h: tileSize,
    }
    tiles.push({ ...right, key: tileKey(right.x, right.y), side: sideForTile(right) })
    tiles.push({ ...left, key: tileKey(left.x, left.y), side: sideForTile(left) })
  })

  return tiles
}

function isOutwardExpansionTile(origin: Omit<Tile, 'key' | 'side'>, target: Tile): boolean {
  if (origin.x === 0 && origin.y === 0) return true
  if (origin.x > 0 && target.x < origin.x) return false
  if (origin.x < 0 && target.x > origin.x) return false
  if (origin.y > 0 && target.y < origin.y) return false
  if (origin.y < 0 && target.y > origin.y) return false
  return true
}

function sideLabel(side: Side, copy: typeof mapComposerCopy.en): string {
  if (side === 'top') return copy.sideTop
  if (side === 'right') return copy.sideRight
  if (side === 'bottom') return copy.sideBottom
  return copy.sideLeft
}

function sideIcon(side: Side) {
  if (side === 'top') return <ArrowUpOutlined />
  if (side === 'right') return <ArrowRightOutlined />
  if (side === 'bottom') return <ArrowDownOutlined />
  return <ArrowLeftOutlined />
}

async function canvasToFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  const blob = await canvasToBlob(canvas)
  return new File([blob], name, { type: 'image/png' })
}

export default function MapComposer({
  active = true,
  onUseStitchedMap,
}: {
  active?: boolean
  onUseStitchedMap: (file: File, canvas: HTMLCanvasElement) => void
}) {
  const { lang } = useLanguage()
  const copy = mapComposerCopy[lang]
  const { message } = App.useApp()
  const [source, setSource] = useState<LoadedImage | null>(null)
  const [split, setSplit] = useState<ExpandSplit>(4)
  const [horizontalOverlapPercent, setHorizontalOverlapPercent] = useState(15)
  const [verticalOverlapPercent, setVerticalOverlapPercent] = useState(15)
  const [seamBlendEnabled, setSeamBlendEnabled] = useState(true)
  const [seamBlendStrength, setSeamBlendStrength] = useState(100)
  const [tileUploads, setTileUploads] = useState<Record<string, LoadedImage>>({})
  const sourceInputRef = useRef<HTMLInputElement | null>(null)
  const tileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const workspaceRef = useRef<HTMLElement | null>(null)
  const [fitZoom, setFitZoom] = useState(1)
  const [viewZoom, setViewZoom] = useState(1)
  const cleanupRef = useRef({ source, tileUploads })
  cleanupRef.current = { source, tileUploads }

  const horizontalOverlap = horizontalOverlapPercent / 100
  const verticalOverlap = verticalOverlapPercent / 100
  const tiles = useMemo(() => {
    const byKey = new Map<string, Tile>()
    const addCandidates = (origin: Omit<Tile, 'key' | 'side'>, candidateSplit: ExpandSplit) => {
      for (const tile of expansionTilesFrom(origin, candidateSplit, horizontalOverlap, verticalOverlap)) {
        if (!isOutwardExpansionTile(origin, tile)) continue
        if (!byKey.has(tile.key)) byKey.set(tile.key, tile)
      }
    }

    addCandidates(CENTER_TILE, split)

    let changed = true
    while (changed) {
      changed = false
      for (const uploadKey of Object.keys(tileUploads)) {
        const origin = byKey.get(uploadKey)
        if (!origin) continue
        for (const tile of expansionTilesFrom(origin, 4, horizontalOverlap, verticalOverlap)) {
          if (!isOutwardExpansionTile(origin, tile)) continue
          if (!byKey.has(tile.key)) {
            byKey.set(tile.key, tile)
            changed = true
          }
        }
      }
    }

    return Array.from(byKey.values()).sort((a, b) => a.y - b.y || a.x - b.x)
  }, [horizontalOverlap, split, tileUploads, verticalOverlap])

  const stage = useMemo(() => {
    if (!source) return null
    const all = [CENTER_TILE, ...tiles]
    const minX = Math.min(...all.map((tile) => tile.x))
    const maxX = Math.max(...all.map((tile) => tile.x + tile.w))
    const minY = Math.min(...all.map((tile) => tile.y))
    const maxY = Math.max(...all.map((tile) => tile.y + tile.h))
    return {
      minX,
      minY,
      width: Math.round((maxX - minX) * source.width),
      height: Math.round((maxY - minY) * source.height),
      unitW: source.width,
      unitH: source.height,
    }
  }, [source, tiles])

  const fitStageToWorkspace = useCallback(() => {
    if (!stage || !workspaceRef.current) return
    const rect = workspaceRef.current.getBoundingClientRect()
    const availableWidth = Math.max(160, rect.width - 112)
    const availableHeight = Math.max(160, rect.height - 112)
    const nextFitZoom = clamp(
      Math.min(availableWidth / Math.max(1, stage.width), availableHeight / Math.max(1, stage.height)),
      MIN_VIEW_ZOOM,
      1,
    )
    setFitZoom(nextFitZoom)
    setViewZoom(nextFitZoom)
  }, [stage])

  const zoomIn = useCallback(() => {
    setViewZoom((value) => clamp(value * VIEW_ZOOM_STEP, MIN_VIEW_ZOOM, MAX_VIEW_ZOOM))
  }, [])

  const zoomOut = useCallback(() => {
    setViewZoom((value) => clamp(value / VIEW_ZOOM_STEP, MIN_VIEW_ZOOM, MAX_VIEW_ZOOM))
  }, [])

  useEffect(() => {
    if (!active) return
    fitStageToWorkspace()
  }, [active, fitStageToWorkspace])

  useEffect(() => {
    return () => {
      const current = cleanupRef.current
      if (current.source) URL.revokeObjectURL(current.source.url)
      Object.values(current.tileUploads).forEach((item) => URL.revokeObjectURL(item.url))
    }
  }, [])

  useEffect(() => {
    if (!active) return
    if (!workspaceRef.current || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => fitStageToWorkspace())
    observer.observe(workspaceRef.current)
    return () => observer.disconnect()
  }, [active, fitStageToWorkspace])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!active) return
      if (!event.ctrlKey && !event.metaKey) return
      if (event.key === '+' || event.key === '=') {
        event.preventDefault()
        zoomIn()
      } else if (event.key === '-' || event.key === '_') {
        event.preventDefault()
        zoomOut()
      } else if (event.key === '0') {
        event.preventDefault()
        fitStageToWorkspace()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, fitStageToWorkspace, zoomIn, zoomOut])

  const selectSource = async (file: File | null) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      message.error(copy.chooseMap)
      return
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      message.error(formatCopy(copy.tooLarge, { size: MAX_IMAGE_MB }))
      return
    }
    try {
      const loaded = await loadImageFile(file)
      setSource((prev) => {
        if (prev) URL.revokeObjectURL(prev.url)
        return loaded
      })
      setTileUploads((prev) => {
        Object.values(prev).forEach((item) => URL.revokeObjectURL(item.url))
        return {}
      })
    } catch (error) {
      message.error(String(error))
    }
  }

  const selectTile = async (tile: Tile, file: File | null) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      message.error(copy.chooseTile)
      return
    }
    try {
      const loaded = await loadImageFile(file)
      setTileUploads((prev) => {
        if (prev[tile.key]) URL.revokeObjectURL(prev[tile.key].url)
        return { ...prev, [tile.key]: loaded }
      })
    } catch (error) {
      message.error(String(error))
    }
  }

  const createStitchedCanvas = (boundsMode: 'completed' | 'stage' = 'completed') => {
    if (!source || !stage) return null
    const completedTiles = tiles.filter((tile) => tileUploads[tile.key])
    const exportTiles = [CENTER_TILE, ...completedTiles]
    const minX = boundsMode === 'stage' ? stage.minX : Math.min(...exportTiles.map((tile) => tile.x))
    const minY = boundsMode === 'stage' ? stage.minY : Math.min(...exportTiles.map((tile) => tile.y))
    const canvasWidth = boundsMode === 'stage'
      ? stage.width
      : Math.max(1, Math.round((Math.max(...exportTiles.map((tile) => tile.x + tile.w)) - minX) * source.width))
    const canvasHeight = boundsMode === 'stage'
      ? stage.height
      : Math.max(1, Math.round((Math.max(...exportTiles.map((tile) => tile.y + tile.h)) - minY) * source.height))
    const canvas = document.createElement('canvas')
    canvas.width = canvasWidth
    canvas.height = canvasHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.imageSmoothingEnabled = false

    const rectFor = (tile: typeof CENTER_TILE): BlendRect => {
      return {
        x: Math.round((tile.x - minX) * source.width),
        y: Math.round((tile.y - minY) * source.height),
        width: Math.max(1, Math.round(tile.w * source.width)),
        height: Math.max(1, Math.round(tile.h * source.height)),
      }
    }

    const paintedTiles: BlendRect[] = []
    const centerRect = rectFor(CENTER_TILE)
    ctx.drawImage(source.image, centerRect.x, centerRect.y, centerRect.width, centerRect.height)
    paintedTiles.push(centerRect)

    for (const tile of completedTiles) {
      const upload = tileUploads[tile.key]
      if (!upload) continue
      const rect = rectFor(tile)
      drawBlendedTile(ctx, upload.image, rect, paintedTiles, {
        enabled: seamBlendEnabled,
        strength: seamBlendStrength / 100,
      })
      paintedTiles.push(rect)
    }
    return canvas
  }

  useEffect(() => {
    const previewCanvas = previewCanvasRef.current
    const stitchedCanvas = createStitchedCanvas('stage')
    if (!previewCanvas || !stitchedCanvas) return
    previewCanvas.width = stitchedCanvas.width
    previewCanvas.height = stitchedCanvas.height
    const previewCtx = previewCanvas.getContext('2d')
    if (!previewCtx) return
    previewCtx.imageSmoothingEnabled = false
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height)
    previewCtx.drawImage(stitchedCanvas, 0, 0)
  }, [source, tiles, tileUploads, seamBlendEnabled, seamBlendStrength])

  const useStitchedMap = async () => {
    const canvas = createStitchedCanvas()
    if (!canvas) {
      message.warning(copy.uploadCenterFirst)
      return
    }
    onUseStitchedMap(await canvasToFile(canvas, 'stitched_map.png'), canvas)
    message.success(copy.stitchedReady)
  }

  const exportStitchedPng = async () => {
    const canvas = createStitchedCanvas()
    if (!canvas) return
    downloadBlob(await canvasToBlob(canvas), 'stitched_map.png')
  }

  const uploadedCount = Object.keys(tileUploads).length

  return (
    <div className="map-composer-shell">
      <aside className="map-composer-sidebar">
        <section className="map-studio-panel-section">
          <Text className="map-studio-section-label">{copy.mapStitch}</Text>
          <Text className="map-studio-section-title">{copy.title}</Text>
          <Text className="map-studio-section-copy">
            {copy.description}
          </Text>
          <input ref={sourceInputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void selectSource(event.target.files?.[0] ?? null)} />
          <Button className="map-studio-primary-btn" block icon={<UploadOutlined />} onClick={() => sourceInputRef.current?.click()}>
            {source ? copy.replaceCenter : copy.uploadCenter}
          </Button>
          {source && <Text className="map-studio-meta">{source.width} × {source.height}px</Text>}
        </section>

        <section className="map-studio-panel-section">
          <Text className="map-studio-section-label">{copy.split}</Text>
          <Text className="map-studio-section-title">{copy.expansionSettings}</Text>
          <Segmented<ExpandSplit>
            block
            value={split}
            onChange={(value) => {
              setSplit(value)
              setTileUploads((prev) => {
                Object.values(prev).forEach((item) => URL.revokeObjectURL(item.url))
                return {}
              })
            }}
            options={[
              { value: 4, label: copy.parts4 },
              { value: 8, label: copy.parts8 },
              { value: 12, label: copy.parts12 },
            ]}
          />
          <Text className="map-studio-meta">{formatCopy(copy.horizontalOverlap, { value: horizontalOverlapPercent })}</Text>
          <Slider value={horizontalOverlapPercent} min={0} max={45} onChange={setHorizontalOverlapPercent} />
          <Text className="map-studio-meta">{formatCopy(copy.verticalOverlap, { value: verticalOverlapPercent })}</Text>
          <Slider value={verticalOverlapPercent} min={0} max={45} onChange={setVerticalOverlapPercent} />
        </section>

        <section className="map-studio-panel-section">
          <Text className="map-studio-section-label">{copy.seamMask}</Text>
          <Text className="map-studio-section-title">{copy.seamBlending}</Text>
          <label className="map-studio-inline-toggle">
            <Switch checked={seamBlendEnabled} onChange={setSeamBlendEnabled} />
            <span>{copy.autoBlend}</span>
          </label>
          <Text className="map-studio-meta">{formatCopy(copy.blendStrength, { value: seamBlendStrength })}</Text>
          <Slider disabled={!seamBlendEnabled} value={seamBlendStrength} min={0} max={100} onChange={setSeamBlendStrength} />
        </section>

        <section className="map-studio-panel-section">
          <Text className="map-studio-section-label">{copy.next}</Text>
          <Text className="map-studio-section-title">{copy.generateContinue}</Text>
          <Text className="map-studio-meta">{formatCopy(copy.uploadedTiles, { count: uploadedCount, total: tiles.length })}</Text>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button className="map-studio-primary-btn" block icon={<MergeCellsOutlined />} disabled={!source} onClick={() => void useStitchedMap()}>
              {copy.generateAndEdit}
            </Button>
            <Button block icon={<DownloadOutlined />} disabled={!source} onClick={() => void exportStitchedPng()}>
              {copy.exportOnly}
            </Button>
          </Space>
        </section>
      </aside>

      <main ref={workspaceRef} className="map-composer-workspace">
        <div className="map-composer-zoom-tools">
          <Button disabled={!stage} icon={<MinusOutlined />} aria-label={copy.zoomOut} onClick={zoomOut} />
          <Text>{Math.round(viewZoom * 100)}%</Text>
          <Button disabled={!stage} icon={<PlusOutlined />} aria-label={copy.zoomIn} onClick={zoomIn} />
          <Button disabled={!stage} onClick={fitStageToWorkspace}>{copy.fit}</Button>
        </div>
        {!source || !stage ? (
          <div className="map-studio-empty-state">
            <MergeCellsOutlined />
            <Title level={3}>{copy.emptyTitle}</Title>
            <Text>{copy.emptyHint}</Text>
          </div>
        ) : (
          <>
            <div
              className="map-composer-stage-wrap"
              style={{ transform: `translate(-50%, -50%) scale(${viewZoom})` }}
            >
              <div className="map-composer-stage" style={{ width: stage.width, height: stage.height }}>
                <canvas ref={previewCanvasRef} className="map-composer-preview-canvas" aria-label={copy.preview} />
                {tiles.map((tile) => {
                  const upload = tileUploads[tile.key]
                  return (
                    <div
                      key={tile.key}
                      className={`map-composer-tile map-composer-tile-${tile.side} ${upload ? 'has-image' : ''}`}
                      style={{
                        left: (tile.x - stage.minX) * stage.unitW,
                        top: (tile.y - stage.minY) * stage.unitH,
                        width: tile.w * stage.unitW,
                        height: tile.h * stage.unitH,
                      }}
                    >
                      <input
                        ref={(node) => {
                          tileInputRefs.current[tile.key] = node
                        }}
                        hidden
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(event) => void selectTile(tile, event.target.files?.[0] ?? null)}
                      />
                      <Button className="map-composer-tile-action" icon={sideIcon(tile.side)} onClick={() => tileInputRefs.current[tile.key]?.click()}>
                        {formatCopy(upload ? copy.replaceSide : copy.uploadSide, { side: sideLabel(tile.side, copy) })}
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
            <Text className="map-composer-shortcut-hint">
              {copy.shortcut}
              {fitZoom !== viewZoom ? ` · ${formatCopy(copy.fitRatio, { value: Math.round(fitZoom * 100) })}` : ''}
            </Text>
          </>
        )}
      </main>
    </div>
  )
}
