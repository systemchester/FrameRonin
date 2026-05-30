import JSZip from 'jszip'
import {
  ACTION_LABELS,
  ACTION_NAMES,
  DEFAULT_BODY_ANCHOR,
  DEFAULT_CENTER_ANCHOR,
  DEFAULT_COLLISION_RADIUS,
  DEFAULT_FEET_ANCHOR,
  type ActionConfig,
  type CharacterActionName,
  type CharacterFrameAsset,
  type LayerTransform,
  type LayerImageAsset,
  type WeaponVariant,
} from './characterActionModel'
import { canvasToBlob, downloadBlob } from './characterImageTools'

type ExportProject = {
  frames: CharacterFrameAsset[]
  weaponAssets: LayerImageAsset[]
  effectAssets: LayerImageAsset[]
  variants: WeaponVariant[]
  actionConfigs: Record<CharacterActionName, ActionConfig>
  canvasSize: number
}

function safeName(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_') || 'asset'
}

function frameFileName(frame: CharacterFrameAsset, index: number): string {
  return `${frame.action}_${String(index + 1).padStart(3, '0')}.png`
}

function assetFileName(prefix: string, variantLevel: string, asset?: LayerImageAsset): string {
  return `${variantLevel}_${prefix}_${safeName(asset?.name || prefix)}.png`
}

function orderedFramesByAction(frames: CharacterFrameAsset[], action: CharacterActionName): CharacterFrameAsset[] {
  return frames.filter((frame) => frame.action === action).sort((a, b) => a.frameIndex - b.frameIndex)
}

function effectVisibleAt(config: ActionConfig, frameIndex: number): boolean {
  return frameIndex >= config.effectStartFrame && frameIndex <= config.effectEndFrame
}

function buildFramePathLookup(frames: CharacterFrameAsset[]): Map<string, string> {
  const lookup = new Map<string, string>()
  for (const action of ACTION_NAMES) {
    orderedFramesByAction(frames, action).forEach((frame, index) => {
      lookup.set(frame.id, `character/${frameFileName(frame, index)}`)
    })
  }
  return lookup
}

async function drawFrameImage(ctx: CanvasRenderingContext2D, frame: CharacterFrameAsset, x: number, y: number, size: number) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`${frame.name} 读取失败`))
    img.src = frame.normalizedUrl
  })
  ctx.drawImage(image, x, y, size, size)
}

function drawLayerAsset(
  ctx: CanvasRenderingContext2D,
  asset: LayerImageAsset,
  transform: LayerTransform,
) {
  const width = asset.width * transform.scale
  const height = asset.height * transform.scale
  ctx.save()
  ctx.globalAlpha = transform.opacity
  ctx.translate(transform.x, transform.y)
  ctx.rotate((transform.rotation * Math.PI) / 180)
  ctx.drawImage(asset.image, -width / 2, -height / 2, width, height)
  ctx.restore()
}

async function createComposedFrame(
  frame: CharacterFrameAsset,
  variant: WeaponVariant,
  weapon?: LayerImageAsset,
  effect?: LayerImageAsset,
  canvasSize = 512,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = canvasSize
  canvas.height = canvasSize
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('合成帧创建失败')
  ctx.imageSmoothingEnabled = false
  await drawFrameImage(ctx, frame, 0, 0, canvasSize)
  const layers = [
    weapon ? { asset: weapon, transform: variant.weaponTransform } : null,
    effect ? { asset: effect, transform: variant.effectTransform } : null,
  ]
    .filter((item): item is { asset: LayerImageAsset; transform: LayerTransform } => Boolean(item))
    .sort((a, b) => a.transform.zIndex - b.transform.zIndex)
  for (const layer of layers) {
    drawLayerAsset(ctx, layer.asset, layer.transform)
  }
  return canvasToBlob(canvas)
}

export async function createSpriteSheet(frames: CharacterFrameAsset[], canvasSize: number): Promise<{ blob: Blob; meta: unknown }> {
  const orderedFrames = ACTION_NAMES.flatMap((action) => orderedFramesByAction(frames, action))
  const localIndexes = new Map<string, number>()
  const count = Math.max(1, orderedFrames.length)
  const columns = Math.min(6, Math.ceil(Math.sqrt(count)))
  const rows = Math.ceil(count / columns)
  const canvas = document.createElement('canvas')
  canvas.width = columns * canvasSize
  canvas.height = rows * canvasSize
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Sprite Sheet 创建失败')
  ctx.imageSmoothingEnabled = false
  const sheetFrames = []
  for (let i = 0; i < orderedFrames.length; i += 1) {
    const frame = orderedFrames[i]
    const x = (i % columns) * canvasSize
    const y = Math.floor(i / columns) * canvasSize
    const frameIndex = localIndexes.get(frame.action) || 0
    localIndexes.set(frame.action, frameIndex + 1)
    await drawFrameImage(ctx, frame, x, y, canvasSize)
    sheetFrames.push({
      id: frame.id,
      action: frame.action,
      name: frameFileName(frame, frameIndex),
      x,
      y,
      width: canvasSize,
      height: canvasSize,
    })
  }
  return {
    blob: await canvasToBlob(canvas),
    meta: {
      version: 1,
      image: 'sprite_sheet.png',
      frameWidth: canvasSize,
      frameHeight: canvasSize,
      columns,
      rows,
      frames: sheetFrames,
    },
  }
}

export async function exportCharacterActionZip(project: ExportProject) {
  const zip = new JSZip()
  const framesByAction: Record<string, string[]> = {}
  const framePathLookup = buildFramePathLookup(project.frames)

  for (const action of ACTION_NAMES) {
    const actionFrames = orderedFramesByAction(project.frames, action)
    framesByAction[action] = []
    actionFrames.forEach((frame, index) => {
      const path = framePathLookup.get(frame.id) || `character/${frameFileName(frame, index)}`
      zip.file(path, frame.blob)
      framesByAction[action].push(path)
    })
  }

  const weaponAssetMap = new Map(project.weaponAssets.map((asset) => [asset.id, asset]))
  const effectAssetMap = new Map(project.effectAssets.map((asset) => [asset.id, asset]))
  const exportedWeapons = new Set<string>()
  const exportedEffects = new Set<string>()

  const weaponVariants = project.variants.map((variant) => {
    const weapon = variant.weaponAssetId ? weaponAssetMap.get(variant.weaponAssetId) : undefined
    const effect = variant.effectAssetId ? effectAssetMap.get(variant.effectAssetId) : undefined
    const weaponPath = weapon ? `weapons/${assetFileName('weapon', variant.level, weapon)}` : undefined
    const effectPath = effect ? `effects/${assetFileName('effect', variant.level, effect)}` : undefined
    if (weapon && weaponPath && !exportedWeapons.has(`${variant.id}:${weapon.id}`)) {
      zip.file(weaponPath, weapon.blob)
      exportedWeapons.add(`${variant.id}:${weapon.id}`)
    }
    if (effect && effectPath && !exportedEffects.has(`${variant.id}:${effect.id}`)) {
      zip.file(effectPath, effect.blob)
      exportedEffects.add(`${variant.id}:${effect.id}`)
    }
    return {
      id: variant.id,
      level: variant.level,
      weapon: weaponPath,
      attackEffect: effectPath,
      weaponMetadata: weapon ? {
        sourceSize: weapon.sourceSize,
        drawSize: weapon.drawSize,
        safeFrame: weapon.safeFrame,
        visibleBounds: weapon.visibleBounds,
        anchor: weapon.anchor,
      } : undefined,
      attackEffectMetadata: effect ? {
        sourceSize: effect.sourceSize,
        drawSize: effect.drawSize,
        safeFrame: effect.safeFrame,
        visibleBounds: effect.visibleBounds,
        anchor: effect.anchor,
      } : undefined,
      weaponTransform: variant.weaponTransform,
      effectTransform: variant.effectTransform,
    }
  })

  for (const variant of project.variants) {
    const weapon = variant.weaponAssetId ? weaponAssetMap.get(variant.weaponAssetId) : undefined
    const effect = variant.effectAssetId ? effectAssetMap.get(variant.effectAssetId) : undefined
    if (!weapon && !effect) continue
    for (const action of ['attack', 'skill'] as const) {
      const previewFrames = orderedFramesByAction(project.frames, action)
      for (let i = 0; i < previewFrames.length; i += 1) {
        const frame = previewFrames[i]
        const effectVisible = effectVisibleAt(project.actionConfigs[action], i)
        const blob = await createComposedFrame(frame, variant, weapon, effectVisible ? effect : undefined, project.canvasSize)
        zip.file(`composed_preview/${variant.level}_${action}_${String(i + 1).padStart(3, '0')}.png`, blob)
      }
    }
  }

  const actionJson = {
    version: 1,
    format: 'droi-ai-character-action',
    canvasSize: [project.canvasSize, project.canvasSize],
    center: [project.canvasSize / 2, project.canvasSize / 2],
    feetAnchor: DEFAULT_FEET_ANCHOR,
    bodyAnchor: DEFAULT_BODY_ANCHOR,
    centerAnchor: DEFAULT_CENTER_ANCHOR,
    collisionRadius: DEFAULT_COLLISION_RADIUS,
    actions: Object.fromEntries(
      ACTION_NAMES.map((action) => [
        action,
        {
          label: ACTION_LABELS[action],
          ...project.actionConfigs[action],
          frames: framesByAction[action],
        },
      ]),
    ),
    weaponVariants,
  }

  const manifestPatch = {
    version: 1,
    images: {
      ...Object.fromEntries(
        ACTION_NAMES.flatMap((action) => orderedFramesByAction(project.frames, action).map((frame, index) => [
          `character.custom.${frame.action}.${String(index + 1).padStart(3, '0')}`,
          {
            src: framePathLookup.get(frame.id),
            sourceSize: [project.canvasSize, project.canvasSize],
            drawSize: [project.canvasSize, project.canvasSize],
            anchor: frame.anchor,
            feetAnchor: frame.feetAnchor,
            bodyAnchor: frame.bodyAnchor,
            centerAnchor: frame.centerAnchor,
            collisionRadius: frame.collisionRadius,
            safeFrame: frame.safeFrame,
            sourceVisibleBounds: frame.visibleBounds,
            originalSourceSize: frame.sourceSize,
            action: frame.action,
            frameIndex: index,
            assetRole: 'playerFrame',
          },
        ])),
      ),
      ...Object.fromEntries(
        weaponVariants.flatMap((variant) => {
          const entries: [string, unknown][] = []
          const sourceVariant = project.variants.find((item) => item.id === variant.id)
          const weapon = sourceVariant?.weaponAssetId ? weaponAssetMap.get(sourceVariant.weaponAssetId) : undefined
          const effect = sourceVariant?.effectAssetId ? effectAssetMap.get(sourceVariant.effectAssetId) : undefined
          if (variant.weapon) {
            entries.push([
              `weapon.custom.${variant.level}`,
              {
                src: variant.weapon,
                sourceSize: weapon?.sourceSize,
                drawSize: weapon?.drawSize,
                safeFrame: weapon?.safeFrame,
                sourceVisibleBounds: weapon?.visibleBounds,
                anchor: weapon?.anchor || [0.5, 0.5],
                assetRole: 'weaponEntity',
                transform: variant.weaponTransform,
              },
            ])
          }
          if (variant.attackEffect) {
            entries.push([
              `effect.custom.${variant.level}`,
              {
                src: variant.attackEffect,
                sourceSize: effect?.sourceSize,
                drawSize: effect?.drawSize,
                safeFrame: effect?.safeFrame,
                sourceVisibleBounds: effect?.visibleBounds,
                anchor: effect?.anchor || [0.5, 0.5],
                assetRole: 'weaponAttack',
                sortLayer: 'weaponEffect',
                transform: variant.effectTransform,
              },
            ])
          }
          return entries
        }),
      ),
    },
  }

  if (project.frames.length > 0) {
    const spriteSheet = await createSpriteSheet(project.frames, project.canvasSize)
    zip.file('sprite_sheet.png', spriteSheet.blob)
    zip.file('sprite_sheet.json', JSON.stringify(spriteSheet.meta, null, 2))
  }

  zip.file('character_action.json', JSON.stringify(actionJson, null, 2))
  zip.file('assets_manifest_patch.json', JSON.stringify(manifestPatch, null, 2))
  const blob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(blob, 'character_action_package.zip')
}
