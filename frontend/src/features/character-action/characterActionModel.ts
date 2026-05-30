export type CharacterActionName = 'idle' | 'walk' | 'run' | 'attack' | 'skill' | 'hurt' | 'death'

export type MatteStatus = 'processed' | 'original' | 'failed'

export type AttachPoint = 'rightHand' | 'leftHand' | 'body' | 'weapon' | 'frontEffect'

export type AssetRole = 'character' | 'weapon' | 'effect'

export type LayerTarget = 'weapon' | 'effect'

export type LayerTransform = {
  x: number
  y: number
  scale: number
  rotation: number
  opacity: number
  zIndex: number
  attachTo: AttachPoint
}

export type ImageBounds = {
  x: number
  y: number
  width: number
  height: number
}

export type CharacterScaleMode = 'fitHeight' | 'original' | 'integer'

export type CharacterFrameAsset = {
  id: string
  name: string
  action: CharacterActionName
  frameIndex: number
  sourceUrl: string
  normalizedUrl: string
  matteStatus: MatteStatus
  canvasSize: [number, number]
  sourceSize: [number, number]
  visibleBounds: ImageBounds
  safeFrame: ImageBounds
  drawSize: [number, number]
  anchor: [number, number]
  feetAnchor: [number, number]
  bodyAnchor: [number, number]
  centerAnchor: [number, number]
  collisionRadius: number
  blob: Blob
}

export type BaseCharacterModel = {
  id: string
  name: string
  sourceFile: File
  preview: CharacterFrameAsset
}

export type GeneratedActionCandidate = {
  id: string
  sourceKey: string
  action: CharacterActionName
  frameIndex: number
  name: string
  url: string
  blob: Blob
  status: 'ready' | 'added'
}

export type AiActionAnalysisJob = {
  id: string
  status: 'idle' | 'queued' | 'processing' | 'completed' | 'failed'
  progress: number
  generatedCount?: number
  totalCount?: number
  batchSize?: number
  currentBatchIndex?: number
  fixedFrameCounts?: Record<CharacterActionName, number>
  error?: { code: string; message: string } | null
  warning?: { code: string; message: string } | null
}

export type LayerImageAsset = {
  id: string
  name: string
  url: string
  image: HTMLImageElement
  width: number
  height: number
  sourceSize: [number, number]
  visibleBounds: ImageBounds
  safeFrame: ImageBounds
  drawSize: [number, number]
  anchor: [number, number]
  matteStatus: MatteStatus
  blob: Blob
}

export type WeaponVariant = {
  id: string
  level: string
  weaponAssetId?: string
  effectAssetId?: string
  weaponTransform: LayerTransform
  effectTransform: LayerTransform
}

export type ActionConfig = {
  fps: number
  loop: boolean
  hitFrame: number
  effectStartFrame: number
  effectEndFrame: number
}

export type CharacterActionProject = {
  version: 1
  canvasSize: [number, number]
  feetAnchor: [number, number]
  actions: Record<CharacterActionName, ActionConfig>
  currentAction: CharacterActionName
  activeVariantId: string
}

export const ACTION_NAMES: CharacterActionName[] = ['idle', 'walk', 'run', 'attack', 'skill', 'hurt', 'death']

export const AI_ACTION_FRAME_COUNTS: Record<CharacterActionName, number> = {
  idle: 2,
  walk: 4,
  run: 4,
  attack: 3,
  skill: 3,
  hurt: 2,
  death: 3,
}

export const ACTION_LABELS: Record<CharacterActionName, string> = {
  idle: 'Idle',
  walk: 'Walk',
  run: 'Run',
  attack: 'Attack',
  skill: 'Skill',
  hurt: 'Hurt',
  death: 'Death',
}

export const ATTACH_LABELS: Record<AttachPoint, string> = {
  rightHand: 'Right Hand',
  leftHand: 'Left Hand',
  body: 'Body',
  weapon: 'Weapon',
  frontEffect: 'Front Effect',
}

export const DEFAULT_CANVAS_SIZE = 512
export const DEFAULT_FEET_ANCHOR: [number, number] = [0.5, 0.84]
export const DEFAULT_BODY_ANCHOR: [number, number] = [0.5, 0.55]
export const DEFAULT_CENTER_ANCHOR: [number, number] = [0.5, 0.5]
export const DEFAULT_COLLISION_RADIUS = 22

export const DEFAULT_ACTION_CONFIGS: Record<CharacterActionName, ActionConfig> = {
  idle: { fps: 8, loop: true, hitFrame: 0, effectStartFrame: 0, effectEndFrame: 0 },
  walk: { fps: 10, loop: true, hitFrame: 0, effectStartFrame: 0, effectEndFrame: 0 },
  run: { fps: 12, loop: true, hitFrame: 0, effectStartFrame: 0, effectEndFrame: 0 },
  attack: { fps: 12, loop: false, hitFrame: 1, effectStartFrame: 1, effectEndFrame: 2 },
  skill: { fps: 12, loop: false, hitFrame: 1, effectStartFrame: 1, effectEndFrame: 3 },
  hurt: { fps: 10, loop: false, hitFrame: 0, effectStartFrame: 0, effectEndFrame: 0 },
  death: { fps: 8, loop: false, hitFrame: 0, effectStartFrame: 0, effectEndFrame: 0 },
}

export function makeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function createDefaultTransform(target: LayerTarget): LayerTransform {
  return target === 'weapon'
    ? { x: 322, y: 278, scale: 1, rotation: -18, opacity: 1, zIndex: 2, attachTo: 'rightHand' }
    : { x: 354, y: 238, scale: 1, rotation: -12, opacity: 1, zIndex: 3, attachTo: 'weapon' }
}

export function createWeaponVariant(index: number, previous?: WeaponVariant): WeaponVariant {
  return {
    id: makeId('variant'),
    level: `level_${String(index).padStart(2, '0')}`,
    weaponAssetId: previous?.weaponAssetId,
    effectAssetId: previous?.effectAssetId,
    weaponTransform: previous ? { ...previous.weaponTransform } : createDefaultTransform('weapon'),
    effectTransform: previous ? { ...previous.effectTransform } : createDefaultTransform('effect'),
  }
}
