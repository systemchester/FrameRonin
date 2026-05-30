import { removeBackground } from '../../api'
import {
  DEFAULT_CANVAS_SIZE,
  ACTION_NAMES,
  DEFAULT_BODY_ANCHOR,
  DEFAULT_CENTER_ANCHOR,
  DEFAULT_COLLISION_RADIUS,
  DEFAULT_FEET_ANCHOR,
  type AssetRole,
  type CharacterActionName,
  type CharacterFrameAsset,
  type CharacterScaleMode,
  type ImageBounds,
  type LayerImageAsset,
  type MatteStatus,
  makeId,
} from './characterActionModel'

type LoadedBitmap = {
  image: HTMLImageElement
  url: string
  blob: Blob
  matteStatus: MatteStatus
}

type NormalizeCharacterOptions = {
  pixelArtMode?: boolean
  scaleMode?: CharacterScaleMode
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG export failed'))), 'image/png')
  })
}

export function imageFileBaseName(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_') || 'asset'
}

export function inferActionFromName(name: string): CharacterActionName {
  const lower = name.toLowerCase()
  if (/(death|die|dead|死亡)/.test(lower)) return 'death'
  if (/(hurt|hit|damage|受击)/.test(lower)) return 'hurt'
  if (/(skill|spell|cast|技能)/.test(lower)) return 'skill'
  if (/(attack|atk|slash|攻击)/.test(lower)) return 'attack'
  if (/(run|dash|奔跑)/.test(lower)) return 'run'
  if (/(walk|move|行走)/.test(lower)) return 'walk'
  return 'idle'
}

export function compareFileNamesByActionAndNumber(a: File, b: File): number {
  const actionDelta = ACTION_NAMES.indexOf(inferActionFromName(a.name)) - ACTION_NAMES.indexOf(inferActionFromName(b.name))
  if (actionDelta !== 0) return actionDelta
  return compareNamesByNaturalNumber(a.name, b.name)
}

export function compareNamesByNaturalNumber(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

export async function loadImageFromBlob(blob: Blob, name = 'image.png'): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob)
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error(`${name} image failed to load`))
      image.src = url
    })
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

export async function loadImageWithUrl(blob: Blob, name: string): Promise<{ image: HTMLImageElement; url: string }> {
  const url = URL.createObjectURL(blob)
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ image, url })
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`${name} image failed to load`))
    }
    image.src = url
  })
}

export async function hasUsefulAlpha(blob: Blob): Promise<boolean> {
  const image = await loadImageFromBlob(blob)
  const sample = document.createElement('canvas')
  const maxSide = 128
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
  sample.width = Math.max(1, Math.round(image.naturalWidth * scale))
  sample.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const ctx = sample.getContext('2d', { willReadFrequently: true })
  if (!ctx) return false
  ctx.drawImage(image, 0, 0, sample.width, sample.height)
  const data = ctx.getImageData(0, 0, sample.width, sample.height).data
  let transparentPixels = 0
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 245) transparentPixels += 1
  }
  return transparentPixels / (data.length / 4) > 0.01
}

async function maybeMatteFile(file: File, autoMatte: boolean): Promise<LoadedBitmap> {
  let blob: Blob = file
  let matteStatus: MatteStatus = 'original'
  if (autoMatte) {
    try {
      const alreadyTransparent = await hasUsefulAlpha(file)
      if (!alreadyTransparent) {
        blob = await removeBackground(file)
        matteStatus = 'processed'
      }
    } catch {
      blob = file
      matteStatus = 'failed'
    }
  }
  const { image, url } = await loadImageWithUrl(blob, file.name)
  return { image, url, blob, matteStatus }
}

export function findVisibleBounds(image: HTMLImageElement): ImageBounds {
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight }
  ctx.drawImage(image, 0, 0)
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  let minX = canvas.width
  let minY = canvas.height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const alpha = data[(y * canvas.width + x) * 4 + 3]
      if (alpha > 12) {
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }
  }
  if (maxX < minX || maxY < minY) {
    return { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight }
  }
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

function calculateCharacterScale(bounds: ImageBounds, scaleMode: CharacterScaleMode, pixelArtMode: boolean): number {
  const maxDrawWidth = DEFAULT_CANVAS_SIZE * 0.68
  const maxDrawHeight = DEFAULT_CANVAS_SIZE * 0.74
  const fitScale = Math.min(maxDrawWidth / bounds.width, maxDrawHeight / bounds.height)
  if (scaleMode === 'original') {
    return Math.min(fitScale, 1)
  }
  if (scaleMode === 'integer') {
    const floored = Math.floor(fitScale)
    return Math.max(1, floored)
  }
  if (pixelArtMode && fitScale > 1) {
    return Math.max(1, Math.floor(fitScale))
  }
  return fitScale
}

export async function normalizeCharacterFrame(
  file: File,
  action: CharacterActionName,
  frameIndex: number,
  autoMatte = true,
  options: NormalizeCharacterOptions = {},
): Promise<CharacterFrameAsset> {
  const loaded = await maybeMatteFile(file, autoMatte)
  const bounds = findVisibleBounds(loaded.image)
  const canvas = document.createElement('canvas')
  canvas.width = DEFAULT_CANVAS_SIZE
  canvas.height = DEFAULT_CANVAS_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Normalization canvas creation failed')
  const pixelArtMode = Boolean(options.pixelArtMode)
  const scaleMode = options.scaleMode || 'fitHeight'
  ctx.imageSmoothingEnabled = !pixelArtMode
  if (!pixelArtMode) ctx.imageSmoothingQuality = 'high'
  const scale = calculateCharacterScale(bounds, scaleMode, pixelArtMode)
  const drawWidth = Math.max(1, Math.round(bounds.width * scale))
  const drawHeight = Math.max(1, Math.round(bounds.height * scale))
  const targetCenterX = DEFAULT_CANVAS_SIZE * 0.5
  const targetFeetY = DEFAULT_CANVAS_SIZE * DEFAULT_FEET_ANCHOR[1]
  const drawX = Math.round(targetCenterX - drawWidth / 2)
  const drawY = Math.round(targetFeetY - drawHeight)
  ctx.drawImage(
    loaded.image,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    drawX,
    drawY,
    drawWidth,
    drawHeight,
  )
  const blob = await canvasToBlob(canvas)
  const normalizedUrl = URL.createObjectURL(blob)
  const safeFrame = { x: drawX, y: drawY, width: drawWidth, height: drawHeight }
  return {
    id: makeId('frame'),
    name: file.name,
    action,
    frameIndex,
    sourceUrl: loaded.url,
    normalizedUrl,
    matteStatus: loaded.matteStatus,
    canvasSize: [DEFAULT_CANVAS_SIZE, DEFAULT_CANVAS_SIZE],
    sourceSize: [loaded.image.naturalWidth, loaded.image.naturalHeight],
    visibleBounds: bounds,
    safeFrame,
    drawSize: [drawWidth, drawHeight],
    anchor: DEFAULT_FEET_ANCHOR,
    feetAnchor: DEFAULT_FEET_ANCHOR,
    bodyAnchor: DEFAULT_BODY_ANCHOR,
    centerAnchor: DEFAULT_CENTER_ANCHOR,
    collisionRadius: DEFAULT_COLLISION_RADIUS,
    blob,
  }
}

export async function createCharacterFrameFromBlob(
  blob: Blob,
  name: string,
  action: CharacterActionName,
  frameIndex: number,
  matteStatus: MatteStatus = 'original',
): Promise<CharacterFrameAsset> {
  const { image, url: sourceUrl } = await loadImageWithUrl(blob, name)
  const normalizedUrl = URL.createObjectURL(blob)
  const bounds = findVisibleBounds(image)
  return {
    id: makeId('frame'),
    name,
    action,
    frameIndex,
    sourceUrl,
    normalizedUrl,
    matteStatus,
    canvasSize: [DEFAULT_CANVAS_SIZE, DEFAULT_CANVAS_SIZE],
    sourceSize: [image.naturalWidth, image.naturalHeight],
    visibleBounds: bounds,
    safeFrame: bounds,
    drawSize: [bounds.width, bounds.height],
    anchor: DEFAULT_FEET_ANCHOR,
    feetAnchor: DEFAULT_FEET_ANCHOR,
    bodyAnchor: DEFAULT_BODY_ANCHOR,
    centerAnchor: DEFAULT_CENTER_ANCHOR,
    collisionRadius: DEFAULT_COLLISION_RADIUS,
    blob,
  }
}

export async function loadLayerAsset(file: File, role: AssetRole, autoMatte = true): Promise<LayerImageAsset> {
  const loaded = await maybeMatteFile(file, autoMatte)
  const bounds = findVisibleBounds(loaded.image)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, bounds.width)
  canvas.height = Math.max(1, bounds.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Layer asset canvas creation failed')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(
    loaded.image,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    0,
    0,
    bounds.width,
    bounds.height,
  )
  const blob = await canvasToBlob(canvas)
  const { image, url } = await loadImageWithUrl(blob, file.name)
  URL.revokeObjectURL(loaded.url)
  return {
    id: makeId(role),
    name: file.name,
    url,
    image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    sourceSize: [loaded.image.naturalWidth, loaded.image.naturalHeight],
    visibleBounds: bounds,
    safeFrame: { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight },
    drawSize: [image.naturalWidth, image.naturalHeight],
    anchor: [0.5, 0.5],
    matteStatus: loaded.matteStatus,
    blob,
  }
}

export function revokeFrameAsset(asset: CharacterFrameAsset) {
  URL.revokeObjectURL(asset.sourceUrl)
  URL.revokeObjectURL(asset.normalizedUrl)
}

export function revokeLayerAsset(asset: LayerImageAsset) {
  URL.revokeObjectURL(asset.url)
}
