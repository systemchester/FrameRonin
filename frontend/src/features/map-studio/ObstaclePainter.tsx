import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent, type MouseEvent as ReactMouseEvent, type WheelEvent as ReactWheelEvent } from 'react'
import {
  BgColorsOutlined,
  BorderOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  DragOutlined,
  EnvironmentOutlined,
  MinusOutlined,
  PlusOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { App, Button, Segmented, Select, Slider, Space, Switch, Typography } from 'antd'
import { removeBackground } from '../../api'
import { useLanguage } from '../../i18n/context'
import {
  cellKey,
  cellsFromRect,
  makeCollisionCell,
  makeId,
  OBSTACLE_GRID_SIZES,
  removeCell,
  replaceCellsForInstance,
  snapCellFromPixel,
  upsertManualCell,
  type CollisionCell,
  type CollisionTool,
  type LoadedImage,
  type ObstacleAsset,
  type ObstacleGridSize,
  type ObstacleInstance,
} from './obstacleModel'
import {
  buildObstacleJson,
  canvasToBlob,
  downloadBlob,
  loadImageFile,
  renderMapWithObstacles,
} from './obstacleExport'

const { Text, Title } = Typography
const MAX_IMAGE_MB = 30
const MIN_ZOOM = 0.08
const MAX_ZOOM = 6
const MIN_OBSTACLE_SIZE = 4
const MAX_OBSTACLE_SCALE_PERCENT = 400

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

const obstacleCopy = {
  en: {
    statusProcessed: 'Background removed',
    statusFailed: 'Matte failed, using original',
    statusOriginal: 'Original',
    chooseMap: 'Please choose a map image.',
    tooLarge: 'Image must be under {size}MB.',
    skippedLarge: '{name} is over {size}MB and was skipped.',
    matteFailedUseOriginal: '{name} matte failed, using original: {error}',
    assetsAdded: 'Obstacle assets added.',
    originalsAdded: 'Original images added.',
    processFailed: 'Obstacle processing failed: {error}',
    importMapFirst: 'Import a map first.',
    importMapAndAssetFirst: 'Import a map and choose an obstacle asset first.',
    baseMap: 'Base Map',
    mapTitle: 'Map Image',
    mapCopy: 'Upload an already generated or stitched PNG, JPG, or WebP map.',
    uploadMap: 'Upload Map Image',
    replaceMap: 'Replace Map Image',
    assetsLabel: 'Obstacle Assets',
    assetsTitle: 'Obstacle Art',
    autoMatte: 'Auto background removal',
    uploadObstacle: 'Upload Obstacle Images',
    addToCenter: 'Add to Map Center',
    gridLabel: 'Collision Grid',
    gridTitle: 'Collision Grid',
    showGrid: 'Show collision grid',
    select: 'Select',
    paint: 'Paint',
    erase: 'Erase',
    gridCount: '{count} collision cells / {cols} x {rows}',
    exportLabel: 'Export',
    exportTitle: 'Export',
    exportJson: 'Export Collision JSON',
    exportPng: 'Export Map PNG',
    exportHint: 'PNG saves the visual map. JSON stores gridSize, map dimensions, obstacle transforms, and collisionCells for AI or runtime collision.',
    emptyTitle: 'Upload a map to start editing',
    emptyHint: 'Obstacle images are automatically matted and shown in the left asset library.',
    obstacleAria: 'Obstacle {name}',
    smaller: 'Smaller',
    larger: 'Larger',
    duplicate: 'Duplicate',
    delete: 'Delete',
  },
  zh: {
    statusProcessed: '已去背',
    statusFailed: '去背失败，使用原图',
    statusOriginal: '原图',
    chooseMap: '请选择地图图片。',
    tooLarge: '图片不能超过 {size}MB。',
    skippedLarge: '{name} 超过 {size}MB，已跳过。',
    matteFailedUseOriginal: '{name} 自动去背失败，已使用原图：{error}',
    assetsAdded: '阻挡物已加入素材组。',
    originalsAdded: '原图已加入素材组。',
    processFailed: '阻挡物处理失败：{error}',
    importMapFirst: '请先导入地图。',
    importMapAndAssetFirst: '请先导入地图并选择阻挡物素材。',
    baseMap: 'Base Map',
    mapTitle: '地图底图',
    mapCopy: '上传已经生成或拼接好的地图 PNG / JPG / WebP。',
    uploadMap: '上传地图底图',
    replaceMap: '重新导入底图',
    assetsLabel: 'Obstacle Assets',
    assetsTitle: '阻挡物素材',
    autoMatte: '自动抠图去背',
    uploadObstacle: '上传阻挡物图片',
    addToCenter: '添加到地图中央',
    gridLabel: 'Collision Grid',
    gridTitle: '碰撞网格',
    showGrid: '显示碰撞格',
    select: '选择',
    paint: '画碰撞',
    erase: '擦除',
    gridCount: '{count} 个碰撞格 / {cols} x {rows}',
    exportLabel: 'Export',
    exportTitle: '导出',
    exportJson: '导出碰撞 JSON',
    exportPng: '导出含阻挡物 PNG',
    exportHint: 'PNG 只保存画面；JSON 会记录 gridSize、地图尺寸、阻挡物坐标与 collisionCells，供 AI 或 runtime 读取。',
    emptyTitle: '上传地图后开始编辑',
    emptyHint: '阻挡物上传后默认自动去背，并展示在左侧素材组里。',
    obstacleAria: '阻挡物 {name}',
    smaller: '缩小',
    larger: '放大',
    duplicate: '复制',
    delete: '删除',
  },
  ja: {
    statusProcessed: '背景除去済み',
    statusFailed: '除去失敗、元画像を使用',
    statusOriginal: '元画像',
    chooseMap: 'マップ画像を選択してください。',
    tooLarge: '画像は {size}MB 以下にしてください。',
    skippedLarge: '{name} は {size}MB を超えたためスキップしました。',
    matteFailedUseOriginal: '{name} の背景除去に失敗したため元画像を使用します: {error}',
    assetsAdded: '障害物素材を追加しました。',
    originalsAdded: '元画像を追加しました。',
    processFailed: '障害物処理に失敗しました: {error}',
    importMapFirst: '先にマップを読み込んでください。',
    importMapAndAssetFirst: 'マップを読み込み、障害物素材を選択してください。',
    baseMap: 'Base Map',
    mapTitle: 'マップ画像',
    mapCopy: '生成済みまたは結合済みの PNG / JPG / WebP マップを読み込みます。',
    uploadMap: 'マップ画像を読み込む',
    replaceMap: 'マップ画像を差し替え',
    assetsLabel: 'Obstacle Assets',
    assetsTitle: '障害物素材',
    autoMatte: '自動背景除去',
    uploadObstacle: '障害物画像を読み込む',
    addToCenter: 'マップ中央へ追加',
    gridLabel: 'Collision Grid',
    gridTitle: '当たり判定グリッド',
    showGrid: 'グリッドを表示',
    select: '選択',
    paint: '描画',
    erase: '消去',
    gridCount: '{count} 個 / {cols} x {rows}',
    exportLabel: 'Export',
    exportTitle: '出力',
    exportJson: '当たり判定 JSON',
    exportPng: '障害物入り PNG',
    exportHint: 'PNG は見た目のみ保存します。JSON は gridSize、マップ寸法、障害物座標、collisionCells を保存します。',
    emptyTitle: 'マップを読み込んで編集開始',
    emptyHint: '障害物は自動で背景除去され、左側の素材一覧に表示されます。',
    obstacleAria: '障害物 {name}',
    smaller: '縮小',
    larger: '拡大',
    duplicate: '複製',
    delete: '削除',
  },
}

function formatCopy(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ''))
}

async function imageHasTransparentBackground(file: File): Promise<boolean> {
  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Image decode failed'))
      img.src = url
    })
    const sampleMaxSize = 360
    const scale = Math.min(1, sampleMaxSize / Math.max(image.width, image.height, 1))
    const width = Math.max(1, Math.round(image.width * scale))
    const height = Math.max(1, Math.round(image.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return false
    ctx.drawImage(image, 0, 0, width, height)
    const data = ctx.getImageData(0, 0, width, height).data
    let transparentPixels = 0
    for (let i = 3; i < data.length; i += 4) {
      if ((data[i] ?? 255) < 245) transparentPixels += 1
    }
    return transparentPixels / Math.max(1, data.length / 4) > 0.005
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function collisionCellsFromVisibleAlpha(
  asset: ObstacleAsset,
  instance: ObstacleInstance,
  gridSize: ObstacleGridSize,
  mapWidth: number,
  mapHeight: number,
): Promise<CollisionCell[]> {
  const rectCells = cellsFromRect(instance, gridSize, mapWidth, mapHeight, instance.id)
  if (!rectCells.length) return []

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(instance.width))
  canvas.height = Math.max(1, Math.round(instance.height))
  const ctx = canvas.getContext('2d')
  if (!ctx) return rectCells
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(asset.image, 0, 0, canvas.width, canvas.height)

  const visibleCells: CollisionCell[] = []
  for (const cell of rectCells) {
    const localX = Math.max(0, Math.floor(cell.x - instance.x))
    const localY = Math.max(0, Math.floor(cell.y - instance.y))
    const localRight = Math.min(canvas.width, Math.ceil(cell.x + cell.width - instance.x))
    const localBottom = Math.min(canvas.height, Math.ceil(cell.y + cell.height - instance.y))
    const w = localRight - localX
    const h = localBottom - localY
    if (w <= 0 || h <= 0) continue
    const data = ctx.getImageData(localX, localY, w, h).data
    let visible = false
    for (let i = 3; i < data.length; i += 4) {
      if ((data[i] ?? 0) > 16) {
        visible = true
        break
      }
    }
    if (visible) visibleCells.push(cell)
  }
  return visibleCells.length ? visibleCells : rectCells
}

export default function ObstaclePainter({ initialMapFile = null }: { initialMapFile?: File | null }) {
  const { lang } = useLanguage()
  const copy = obstacleCopy[lang]
  const uploadFolderLabel = lang === 'en' ? 'Upload Folder' : '上传文件夹'
  const statusLabel = useCallback((status: ObstacleAsset['matteStatus']) => {
    if (status === 'processed') return copy.statusProcessed
    if (status === 'failed') return copy.statusFailed
    return copy.statusOriginal
  }, [copy])

  const { message } = App.useApp()
  const [mapImage, setMapImage] = useState<LoadedImage | null>(null)
  const [assets, setAssets] = useState<ObstacleAsset[]>([])
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [instances, setInstances] = useState<ObstacleInstance[]>([])
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null)
  const [collisionCells, setCollisionCells] = useState<CollisionCell[]>([])
  const [gridSize, setGridSize] = useState<ObstacleGridSize>(32)
  const [gridVisible, setGridVisible] = useState(true)
  const [tool, setTool] = useState<CollisionTool>('select')
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [spaceDown, setSpaceDown] = useState(false)
  const [autoMatteEnabled, setAutoMatteEnabled] = useState(true)
  const [isProcessingMatte, setIsProcessingMatte] = useState(false)
  const [draggedAssetId, setDraggedAssetId] = useState<string | null>(null)
  const [dragState, setDragState] = useState<{
    type: 'instance' | 'pan'
    instanceId?: string
    startMapX?: number
    startMapY?: number
    startClientX: number
    startClientY: number
    startX?: number
    startY?: number
    startPan?: { x: number; y: number }
  } | null>(null)
  const workspaceRef = useRef<HTMLDivElement | null>(null)
  const mapInputRef = useRef<HTMLInputElement | null>(null)
  const obstacleInputRef = useRef<HTMLInputElement | null>(null)
  const obstacleFolderInputRef = useRef<HTMLInputElement | null>(null)
  const initialMapKeyRef = useRef<string | null>(null)
  const cleanupRef = useRef({ mapImage, assets })
  cleanupRef.current = { mapImage, assets }

  const selectedAsset = useMemo(() => assets.find((asset) => asset.id === selectedAssetId) ?? null, [assets, selectedAssetId])
  const selectedInstance = useMemo(() => instances.find((instance) => instance.id === selectedInstanceId) ?? null, [instances, selectedInstanceId])
  const selectedInstanceAsset = useMemo(
    () => selectedInstance ? assets.find((asset) => asset.id === selectedInstance.assetId) ?? null : null,
    [assets, selectedInstance],
  )
  const selectedInstanceScalePercent = selectedInstance && selectedInstanceAsset
    ? Math.round((selectedInstance.width / Math.max(1, selectedInstanceAsset.width)) * 100)
    : 100

  const deleteSelectedInstance = useCallback(() => {
    if (!selectedInstanceId) return
    setInstances((prev) => prev.filter((item) => item.id !== selectedInstanceId))
    setCollisionCells((prev) => prev.filter((cell) => cell.sourceInstanceId !== selectedInstanceId))
    setSelectedInstanceId(null)
  }, [selectedInstanceId])

  const deleteAsset = useCallback((assetId: string) => {
    const asset = assets.find((item) => item.id === assetId)
    if (!asset) return
    const removedInstanceIds = new Set(instances.filter((item) => item.assetId === assetId).map((item) => item.id))
    const nextAssets = assets.filter((item) => item.id !== assetId)
    URL.revokeObjectURL(asset.url)
    setAssets(nextAssets)
    setInstances((prev) => prev.filter((item) => item.assetId !== assetId))
    setCollisionCells((prev) => prev.filter((cell) => !cell.sourceInstanceId || !removedInstanceIds.has(cell.sourceInstanceId)))
    if (selectedAssetId === assetId) setSelectedAssetId(nextAssets[0]?.id ?? null)
    if (selectedInstanceId && removedInstanceIds.has(selectedInstanceId)) setSelectedInstanceId(null)
  }, [assets, instances, selectedAssetId, selectedInstanceId])

  useEffect(() => {
    return () => {
      const current = cleanupRef.current
      if (current.mapImage) URL.revokeObjectURL(current.mapImage.url)
      current.assets.forEach((asset) => URL.revokeObjectURL(asset.url))
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault()
        setSpaceDown(true)
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedInstanceId) {
        event.preventDefault()
        deleteSelectedInstance()
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') setSpaceDown(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [deleteSelectedInstance, selectedInstanceId])

  const pointerToMap = useCallback((clientX: number, clientY: number) => {
    if (!workspaceRef.current || !mapImage) return null
    const rect = workspaceRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2 + pan.x
    const centerY = rect.top + rect.height / 2 + pan.y
    return {
      x: (clientX - centerX) / zoom + mapImage.width / 2,
      y: (clientY - centerY) / zoom + mapImage.height / 2,
    }
  }, [mapImage, pan.x, pan.y, zoom])

  const recomputeInstanceCells = useCallback(async (instance: ObstacleInstance, nextGridSize = gridSize) => {
    if (!mapImage) return []
    const asset = assets.find((item) => item.id === instance.assetId)
    if (!asset) return cellsFromRect(instance, nextGridSize, mapImage.width, mapImage.height, instance.id)
    return collisionCellsFromVisibleAlpha(asset, instance, nextGridSize, mapImage.width, mapImage.height)
  }, [assets, gridSize, mapImage])

  const rebuildAllCollisionCells = useCallback(async (nextGridSize: ObstacleGridSize, nextInstances = instances) => {
    if (!mapImage) {
      setCollisionCells([])
      return
    }
    const chunks = await Promise.all(nextInstances.map((instance) => recomputeInstanceCells(instance, nextGridSize)))
    setCollisionCells(chunks.flat())
  }, [instances, mapImage, recomputeInstanceCells])

  const selectMap = useCallback(async (file: File | null) => {
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
      setMapImage((prev) => {
        if (prev) URL.revokeObjectURL(prev.url)
        return loaded
      })
      setInstances([])
      setCollisionCells([])
      setSelectedInstanceId(null)
      setZoom(1)
      setPan({ x: 0, y: 0 })
    } catch (error) {
      message.error(String(error))
    }
  }, [copy, message])

  useEffect(() => {
    if (!initialMapFile) return
    const key = `${initialMapFile.name}:${initialMapFile.size}:${initialMapFile.lastModified}`
    if (initialMapKeyRef.current === key) return
    initialMapKeyRef.current = key
    void selectMap(initialMapFile)
  }, [initialMapFile, selectMap])

  const selectObstacleFiles = useCallback(async (files: FileList | File[]) => {
    const imageFiles = Array.from(files)
      .filter((file) => file.type.startsWith('image/'))
      .sort((a, b) => {
        const left = ('webkitRelativePath' in a && a.webkitRelativePath) ? a.webkitRelativePath : a.name
        const right = ('webkitRelativePath' in b && b.webkitRelativePath) ? b.webkitRelativePath : b.name
        return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
      })
    if (!imageFiles.length) return
    setIsProcessingMatte(autoMatteEnabled)
    const loadedAssets: ObstacleAsset[] = []
    try {
      for (const file of imageFiles) {
        if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
          message.warning(formatCopy(copy.skippedLarge, { name: file.name, size: MAX_IMAGE_MB }))
          continue
        }
        let nextFile = file
        let matteStatus: ObstacleAsset['matteStatus'] = 'original'
        if (autoMatteEnabled) {
          try {
            if (await imageHasTransparentBackground(file)) {
              matteStatus = 'original'
            } else {
              const blob = await removeBackground(file)
              nextFile = new File([blob], file.name.replace(/\.[^.]+$/, '') + '_matte.png', { type: 'image/png' })
              matteStatus = 'processed'
            }
          } catch (error) {
            matteStatus = 'failed'
            message.warning(formatCopy(copy.matteFailedUseOriginal, { name: file.name, error: String(error) }))
          }
        }
        const loaded = await loadImageFile(nextFile)
        loadedAssets.push({ ...loaded, id: makeId('asset'), name: nextFile.name, matteStatus })
      }
      setAssets((prev) => [...prev, ...loadedAssets])
      setSelectedAssetId((prev) => prev ?? loadedAssets[0]?.id ?? null)
      if (loadedAssets.length) message.success(autoMatteEnabled ? copy.assetsAdded : copy.originalsAdded)
    } catch (error) {
      message.error(formatCopy(copy.processFailed, { error: String(error) }))
    } finally {
      setIsProcessingMatte(false)
    }
  }, [autoMatteEnabled, copy, message])

  const placeAssetAt = useCallback(async (asset: ObstacleAsset, centerX: number, centerY: number) => {
    if (!mapImage) {
      message.warning(copy.importMapFirst)
      return
    }
    const width = Math.max(MIN_OBSTACLE_SIZE, Math.round(asset.width))
    const height = Math.max(MIN_OBSTACLE_SIZE, Math.round(asset.height))
    const instance: ObstacleInstance = {
      id: makeId('obs'),
      assetId: asset.id,
      assetName: asset.name,
      x: Math.round(clamp(centerX - width / 2, 0, Math.max(0, mapImage.width - width))),
      y: Math.round(clamp(centerY - height / 2, 0, Math.max(0, mapImage.height - height))),
      width,
      height,
      rotation: 0,
      opacity: 1,
      collisionMode: 'solid',
    }
    setInstances((prev) => [...prev, instance])
    setSelectedInstanceId(instance.id)
    const cells = await collisionCellsFromVisibleAlpha(asset, instance, gridSize, mapImage.width, mapImage.height)
    setCollisionCells((prev) => replaceCellsForInstance(prev, instance.id, cells))
  }, [copy, gridSize, mapImage, message])

  const placeSelectedAsset = useCallback(async () => {
    if (!selectedAsset || !mapImage) {
      message.warning(copy.importMapAndAssetFirst)
      return
    }
    await placeAssetAt(selectedAsset, mapImage.width / 2, mapImage.height / 2)
  }, [copy, mapImage, message, placeAssetAt, selectedAsset])

  const updateInstance = useCallback(async (instanceId: string, updater: (instance: ObstacleInstance) => ObstacleInstance, recompute = false) => {
    let nextInstance: ObstacleInstance | null = null
    setInstances((prev) => prev.map((item) => {
      if (item.id !== instanceId) return item
      nextInstance = updater(item)
      return nextInstance
    }))
    if (recompute && nextInstance) {
      const cells = await recomputeInstanceCells(nextInstance)
      setCollisionCells((prev) => replaceCellsForInstance(prev, instanceId, cells))
    }
  }, [recomputeInstanceCells])

  const duplicateSelectedInstance = useCallback(async () => {
    if (!selectedInstance || !mapImage) return
    const next: ObstacleInstance = {
      ...selectedInstance,
      id: makeId('obs'),
      x: clamp(selectedInstance.x + gridSize, 0, Math.max(0, mapImage.width - selectedInstance.width)),
      y: clamp(selectedInstance.y + gridSize, 0, Math.max(0, mapImage.height - selectedInstance.height)),
    }
    setInstances((prev) => [...prev, next])
    setSelectedInstanceId(next.id)
    const cells = await recomputeInstanceCells(next)
    setCollisionCells((prev) => replaceCellsForInstance(prev, next.id, cells))
  }, [gridSize, mapImage, recomputeInstanceCells, selectedInstance])

  const resizeSelectedInstance = useCallback(async (ratio: number) => {
    if (!selectedInstanceId || !mapImage) return
    await updateInstance(selectedInstanceId, (item) => {
      const width = clamp(Math.round(item.width * ratio), 8, mapImage.width)
      const height = clamp(Math.round(item.height * ratio), 8, mapImage.height)
      return {
        ...item,
        width,
        height,
        x: clamp(item.x, 0, Math.max(0, mapImage.width - width)),
        y: clamp(item.y, 0, Math.max(0, mapImage.height - height)),
      }
    }, true)
  }, [mapImage, selectedInstanceId, updateInstance])

  const resizeSelectedInstanceToScale = useCallback(async (scalePercent: number) => {
    if (!selectedInstanceId || !mapImage) return
    const instance = instances.find((item) => item.id === selectedInstanceId)
    if (!instance) return
    const asset = assets.find((item) => item.id === instance.assetId)
    if (!asset) return
    const scale = clamp(scalePercent, 1, MAX_OBSTACLE_SCALE_PERCENT) / 100
    await updateInstance(selectedInstanceId, (item) => {
      const width = clamp(Math.round(asset.width * scale), MIN_OBSTACLE_SIZE, mapImage.width)
      const height = clamp(Math.round(asset.height * scale), MIN_OBSTACLE_SIZE, mapImage.height)
      return {
        ...item,
        width,
        height,
        x: clamp(item.x, 0, Math.max(0, mapImage.width - width)),
        y: clamp(item.y, 0, Math.max(0, mapImage.height - height)),
      }
    }, true)
  }, [assets, instances, mapImage, selectedInstanceId, updateInstance])

  const resizeSelectedInstanceByWheel = useCallback(async (deltaY: number) => {
    await resizeSelectedInstance(Math.exp(-deltaY * 0.0015))
  }, [resizeSelectedInstance])

  const onInstanceMouseDown = (event: ReactMouseEvent, instance: ObstacleInstance) => {
    if (tool !== 'select') return
    event.preventDefault()
    event.stopPropagation()
    const mapPoint = pointerToMap(event.clientX, event.clientY)
    if (!mapPoint) return
    setSelectedInstanceId(instance.id)
    setDragState({
      type: 'instance',
      instanceId: instance.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startMapX: mapPoint.x,
      startMapY: mapPoint.y,
      startX: instance.x,
      startY: instance.y,
    })
  }

  const onInstanceWheel = (event: ReactWheelEvent, instance: ObstacleInstance) => {
    if (tool !== 'select') return
    event.preventDefault()
    event.stopPropagation()
    setSelectedInstanceId(instance.id)
    void resizeSelectedInstanceByWheel(event.deltaY)
  }

  const applyCollisionTool = useCallback((clientX: number, clientY: number) => {
    if (!mapImage) return
    const point = pointerToMap(clientX, clientY)
    if (!point) return
    if (point.x < 0 || point.y < 0 || point.x >= mapImage.width || point.y >= mapImage.height) return
    const { gridX, gridY } = snapCellFromPixel(point.x, point.y, gridSize)
    if (tool === 'paint') {
      setCollisionCells((prev) => upsertManualCell(prev, makeCollisionCell(gridX, gridY, gridSize)))
    } else if (tool === 'erase') {
      setCollisionCells((prev) => removeCell(prev, gridX, gridY))
    }
  }, [gridSize, mapImage, pointerToMap, tool])

  const onWorkspaceMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!mapImage) return
    if (event.button === 2 || spaceDown) {
      event.preventDefault()
      setDragState({
        type: 'pan',
        startClientX: event.clientX,
        startClientY: event.clientY,
        startPan: { ...pan },
      })
      return
    }
    if (tool === 'paint' || tool === 'erase') {
      event.preventDefault()
      applyCollisionTool(event.clientX, event.clientY)
      return
    }
    setSelectedInstanceId(null)
  }

  const onWorkspaceMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (tool !== 'select' && event.buttons === 1) applyCollisionTool(event.clientX, event.clientY)
    if (!dragState || !mapImage) return
    if (dragState.type === 'pan') {
      setPan({
        x: (dragState.startPan?.x ?? 0) + event.clientX - dragState.startClientX,
        y: (dragState.startPan?.y ?? 0) + event.clientY - dragState.startClientY,
      })
      return
    }
    if (dragState.type === 'instance' && dragState.instanceId) {
      const point = pointerToMap(event.clientX, event.clientY)
      const startMapX = dragState.startMapX
      const startMapY = dragState.startMapY
      if (!point || startMapX === undefined || startMapY === undefined) return
      setInstances((prev) => prev.map((item) => {
        if (item.id !== dragState.instanceId) return item
        return {
          ...item,
          x: Math.round(clamp((dragState.startX ?? item.x) + point.x - startMapX, 0, Math.max(0, mapImage.width - item.width))),
          y: Math.round(clamp((dragState.startY ?? item.y) + point.y - startMapY, 0, Math.max(0, mapImage.height - item.height))),
        }
      }))
    }
  }

  const stopDrag = useCallback(async () => {
    if (dragState?.type === 'instance' && dragState.instanceId) {
      const instance = instances.find((item) => item.id === dragState.instanceId)
      if (instance) {
        const cells = await recomputeInstanceCells(instance)
        setCollisionCells((prev) => replaceCellsForInstance(prev, instance.id, cells))
      }
    }
    setDragState(null)
  }, [dragState, instances, recomputeInstanceCells])

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!workspaceRef.current || !mapImage) return
    event.preventDefault()
    const rect = workspaceRef.current.getBoundingClientRect()
    const oldZoom = zoom
    const nextZoom = clamp(oldZoom * Math.exp(-event.deltaY * 0.0015), MIN_ZOOM, MAX_ZOOM)
    const mapX = (event.clientX - (rect.left + rect.width / 2 + pan.x)) / oldZoom + mapImage.width / 2
    const mapY = (event.clientY - (rect.top + rect.height / 2 + pan.y)) / oldZoom + mapImage.height / 2
    setZoom(nextZoom)
    setPan({
      x: event.clientX - rect.left - rect.width / 2 - (mapX - mapImage.width / 2) * nextZoom,
      y: event.clientY - rect.top - rect.height / 2 - (mapY - mapImage.height / 2) * nextZoom,
    })
  }

  const onAssetDragStart = (event: ReactDragEvent<HTMLElement>, assetId: string) => {
    setDraggedAssetId(assetId)
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData('text/plain', assetId)
  }

  const onAssetDragEnd = () => {
    setDraggedAssetId(null)
  }

  const onWorkspaceDragOver = (event: ReactDragEvent<HTMLElement>) => {
    if (!mapImage) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  const onWorkspaceDrop = async (event: ReactDragEvent<HTMLElement>) => {
    event.preventDefault()
    if (!mapImage) return
    const assetId = event.dataTransfer.getData('text/plain') || draggedAssetId
    const asset = assets.find((item) => item.id === assetId)
    const point = pointerToMap(event.clientX, event.clientY)
    if (!asset || !point) return
    await placeAssetAt(asset, point.x, point.y)
    setSelectedAssetId(asset.id)
    setDraggedAssetId(null)
  }

  const exportObstacleJson = useCallback(() => {
    if (!mapImage) return
    const payload = buildObstacleJson(mapImage, gridSize, instances, collisionCells)
    downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), 'map_collision.json')
  }, [collisionCells, gridSize, instances, mapImage])

  const exportPng = useCallback(async () => {
    if (!mapImage) return
    try {
      const canvas = await renderMapWithObstacles(mapImage, assets, instances)
      downloadBlob(await canvasToBlob(canvas), 'map_with_obstacles.png')
    } catch (error) {
      message.error(String(error))
    }
  }, [assets, instances, mapImage, message])

  const changeGridSize = async (next: ObstacleGridSize) => {
    setGridSize(next)
    await rebuildAllCollisionCells(next)
  }

  const gridColumns = mapImage ? Math.ceil(mapImage.width / gridSize) : 0
  const gridRows = mapImage ? Math.ceil(mapImage.height / gridSize) : 0

  return (
    <div className="map-studio-shell">
      <aside className="map-studio-sidebar">
        <section className="map-studio-panel-section">
          <Text className="map-studio-section-label">{copy.baseMap}</Text>
          <Text className="map-studio-section-title">{copy.mapTitle}</Text>
          <Text className="map-studio-section-copy">{copy.mapCopy}</Text>
          <input ref={mapInputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void selectMap(event.target.files?.[0] ?? null)} />
          <Button className="map-studio-primary-btn" block icon={<EnvironmentOutlined />} onClick={() => mapInputRef.current?.click()}>
            {mapImage ? copy.replaceMap : copy.uploadMap}
          </Button>
          {mapImage && <Text className="map-studio-meta">{mapImage.width} × {mapImage.height}px</Text>}
        </section>

        <section className="map-studio-panel-section">
          <Text className="map-studio-section-label">{copy.assetsLabel}</Text>
          <Text className="map-studio-section-title">{copy.assetsTitle}</Text>
          <label className="map-studio-inline-toggle">
            <Switch checked={autoMatteEnabled} onChange={setAutoMatteEnabled} />
            <span>{copy.autoMatte}</span>
          </label>
          <input
            ref={obstacleInputRef}
            hidden
            multiple
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              void selectObstacleFiles(event.target.files ?? [])
              event.currentTarget.value = ''
            }}
          />
          <input
            ref={obstacleFolderInputRef}
            hidden
            multiple
            type="file"
            accept="image/png,image/jpeg,image/webp"
            {...{ webkitdirectory: '', directory: '' }}
            onChange={(event) => {
              void selectObstacleFiles(event.target.files ?? [])
              event.currentTarget.value = ''
            }}
          />
          <Button className="map-studio-primary-btn" block icon={autoMatteEnabled ? <BgColorsOutlined /> : <UploadOutlined />} loading={isProcessingMatte} onClick={() => obstacleInputRef.current?.click()}>
            {copy.uploadObstacle}
          </Button>
          <Button className="map-studio-primary-btn" block icon={<UploadOutlined />} loading={isProcessingMatte} onClick={() => obstacleFolderInputRef.current?.click()}>
            {uploadFolderLabel}
          </Button>
          <div className="map-studio-asset-grid">
            {assets.map((asset) => (
              <div
                key={asset.id}
                role="button"
                tabIndex={0}
                draggable
                className={`map-studio-asset-card ${selectedAssetId === asset.id ? 'selected' : ''}`}
                onClick={() => setSelectedAssetId(asset.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setSelectedAssetId(asset.id)
                  }
                }}
                onDragStart={(event) => onAssetDragStart(event, asset.id)}
                onDragEnd={onAssetDragEnd}
              >
                <button
                  type="button"
                  className="map-studio-asset-delete"
                  aria-label={`${copy.delete} ${asset.name}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    deleteAsset(asset.id)
                  }}
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <DeleteOutlined />
                </button>
                <img src={asset.url} alt={asset.name} draggable={false} />
                <span>{asset.name}</span>
                <em>{asset.width} × {asset.height}px</em>
                <small data-status={asset.matteStatus}>{statusLabel(asset.matteStatus)}</small>
              </div>
            ))}
          </div>
          <Button className="map-studio-primary-btn" block icon={<DragOutlined />} disabled={!selectedAsset || !mapImage} onClick={() => void placeSelectedAsset()}>
            {copy.addToCenter}
          </Button>
        </section>

        <section className="map-studio-panel-section">
          <Text className="map-studio-section-label">{copy.gridLabel}</Text>
          <Text className="map-studio-section-title">{copy.gridTitle}</Text>
          <Space orientation="vertical" style={{ width: '100%' }}>
            <Select<ObstacleGridSize>
              value={gridSize}
              onChange={(value) => void changeGridSize(value)}
              options={OBSTACLE_GRID_SIZES.map((value) => ({ value, label: `${value}px` }))}
            />
            <label className="map-studio-inline-toggle">
              <Switch checked={gridVisible} onChange={setGridVisible} />
              <span>{copy.showGrid}</span>
            </label>
            <Segmented<CollisionTool>
              block
              value={tool}
              onChange={setTool}
              options={[
                { label: copy.select, value: 'select' },
                { label: copy.paint, value: 'paint' },
                { label: copy.erase, value: 'erase' },
              ]}
            />
            <Text className="map-studio-meta">{formatCopy(copy.gridCount, { count: collisionCells.length, cols: gridColumns, rows: gridRows })}</Text>
          </Space>
        </section>

        <section className="map-studio-panel-section">
          <Text className="map-studio-section-label">{copy.exportLabel}</Text>
          <Text className="map-studio-section-title">{copy.exportTitle}</Text>
          <Space orientation="vertical" style={{ width: '100%' }}>
            <Button block icon={<DownloadOutlined />} disabled={!mapImage} onClick={exportObstacleJson}>{copy.exportJson}</Button>
            <Button block icon={<DownloadOutlined />} disabled={!mapImage} onClick={() => void exportPng()}>{copy.exportPng}</Button>
            <Text className="map-studio-meta">{copy.exportHint}</Text>
          </Space>
        </section>
      </aside>

      <main
        ref={workspaceRef}
        className={`map-studio-obstacle-workspace ${spaceDown || dragState?.type === 'pan' ? 'is-panning' : ''}`}
        onContextMenu={(event) => event.preventDefault()}
        onMouseDown={onWorkspaceMouseDown}
        onMouseMove={onWorkspaceMouseMove}
        onMouseUp={() => void stopDrag()}
        onMouseLeave={() => void stopDrag()}
        onWheel={onWheel}
        onDragOver={onWorkspaceDragOver}
        onDrop={(event) => void onWorkspaceDrop(event)}
      >
        {!mapImage ? (
          <div className="map-studio-empty-state">
            <EnvironmentOutlined />
            <Title level={3}>{copy.emptyTitle}</Title>
            <Text>{copy.emptyHint}</Text>
          </div>
        ) : (
          <div
            className="map-studio-obstacle-stage"
            style={{
              width: mapImage.width,
              height: mapImage.height,
              transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
            }}
          >
            <img className="map-studio-map-image" src={mapImage.url} alt={copy.mapTitle} draggable={false} />
            {instances.map((instance) => {
              const asset = assets.find((item) => item.id === instance.assetId)
              if (!asset) return null
              return (
                <button
                  key={instance.id}
                  type="button"
                  className={`map-studio-obstacle-instance ${selectedInstanceId === instance.id ? 'selected' : ''}`}
                  style={{ left: instance.x, top: instance.y, width: instance.width, height: instance.height, opacity: instance.opacity }}
                  onMouseDown={(event) => onInstanceMouseDown(event, instance)}
                  onWheel={(event) => onInstanceWheel(event, instance)}
                  onClick={(event) => {
                    event.stopPropagation()
                    if (tool === 'select') setSelectedInstanceId(instance.id)
                  }}
                  aria-label={formatCopy(copy.obstacleAria, { name: instance.assetName })}
                >
                  <img src={asset.url} alt="" draggable={false} />
                </button>
              )
            })}
            {selectedInstance && (
              <div className="map-studio-floating-tools">
                <Text>{selectedInstance.assetName}</Text>
                <Button size="small" icon={<MinusOutlined />} onClick={() => void resizeSelectedInstance(0.9)}>{copy.smaller}</Button>
                <Button size="small" icon={<PlusOutlined />} onClick={() => void resizeSelectedInstance(1.1)}>{copy.larger}</Button>
                <Button size="small" icon={<CopyOutlined />} onClick={() => void duplicateSelectedInstance()}>{copy.duplicate}</Button>
                <Button size="small" danger icon={<DeleteOutlined />} onClick={deleteSelectedInstance}>{copy.delete}</Button>
              </div>
            )}
            {selectedInstance && selectedInstanceAsset && (
              <div
                className="map-studio-instance-size-control"
                style={{
                  left: selectedInstance.x + selectedInstance.width + 12,
                  top: selectedInstance.y,
                  height: Math.max(150, selectedInstance.height),
                }}
              >
                <Text>{selectedInstance.width} × {selectedInstance.height}px</Text>
                <Slider
                  vertical
                  min={1}
                  max={MAX_OBSTACLE_SCALE_PERCENT}
                  value={clamp(selectedInstanceScalePercent, 1, MAX_OBSTACLE_SCALE_PERCENT)}
                  onChange={(value) => void resizeSelectedInstanceToScale(value)}
                />
                <Text>{selectedInstanceScalePercent}%</Text>
              </div>
            )}
            {gridVisible && (
              <div className="map-studio-collision-layer" style={{ backgroundSize: `${gridSize}px ${gridSize}px` }}>
                {collisionCells.map((cell) => (
                  <span key={cellKey(cell.gridX, cell.gridY)} className="map-studio-collision-cell" style={{ left: cell.x, top: cell.y, width: cell.width, height: cell.height }} />
                ))}
              </div>
            )}
            <BorderOutlined className="map-studio-stage-corner" />
          </div>
        )}
      </main>
    </div>
  )
}
