import type { Cel, Document, Frame, Layer } from './types'

function newId(prefix: string): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/** 深拷贝一帧所有 Cel（第 7 步「复制当前帧」增帧） */
export function duplicateFrameDeep(doc: Document, sourceFrameIndex: number): Frame | null {
  const src = doc.frames[sourceFrameIndex]
  if (!src) return null
  const w = doc.width
  const h = doc.height
  const cels: Cel[] = src.cels.map((cel) => ({
    layerId: cel.layerId,
    imageData: new ImageData(new Uint8ClampedArray(cel.imageData.data), w, h),
  }))
  const durationMs = src.durationMs ?? 100
  return { id: newId('frame'), cels, durationMs }
}

/** 全透明 RGBA 画布 */
export function createTransparentImageData(width: number, height: number): ImageData {
  return new ImageData(width, height)
}

export function createInitialLayer(name = 'Layer 1'): Layer {
  return {
    id: newId('layer'),
    name,
    visible: true,
    locked: false,
  }
}

export function createCelForLayer(layerId: string, width: number, height: number): Cel {
  return {
    layerId,
    imageData: createTransparentImageData(width, height),
  }
}

/**
 * 新建文档：1 帧 × 2 层（自下而上），每层 1 个透明 Cel（第 6 步多图层）。
 */
export function createInitialDocument(width: number, height: number): Document {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new Error(`createInitialDocument: invalid size ${width}x${height}`)
  }
  if (width > 8192 || height > 8192) {
    throw new Error('createInitialDocument: width/height too large for step 1')
  }

  const layer0 = createInitialLayer('Layer 1')
  const layer1 = createInitialLayer('Layer 2')
  const cel0 = createCelForLayer(layer0.id, width, height)
  const cel1 = createCelForLayer(layer1.id, width, height)
  const frame: Frame = {
    id: newId('frame'),
    cels: [cel0, cel1],
    durationMs: 100,
  }

  return {
    width,
    height,
    layers: [layer0, layer1],
    frames: [frame],
  }
}
