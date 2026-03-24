/**
 * Rseprite 文档模型（单帧多图层，每层每帧一 Cel / ImageData）
 */

/** 单层在一帧上的像素缓冲（与文档 width×height 一致） */
export interface Cel {
  /** 与 Layer.id 对应；第 1 步每层每帧一个 Cel */
  layerId: string
  /** RGBA，尺寸 = 文档 width × height */
  imageData: ImageData
}

export interface Layer {
  id: string
  name: string
  visible: boolean
  locked: boolean
}

export interface Frame {
  id: string
  /** 该帧上各图层的 cel，顺序与 document.layers 一致 */
  cels: Cel[]
  /**
   * 帧延时（毫秒），第 8 步占位；后续播放/导出用。
   * 缺省按 100ms 显示与复制。
   */
  durationMs?: number
}

export interface Document {
  width: number
  height: number
  layers: Layer[]
  frames: Frame[]
}

export function celKey(frameId: string, layerId: string): string {
  return `${frameId}::${layerId}`
}

/** 文档像素格坐标（整数） */
export type PixelPoint = { x: number; y: number }

/** 第 4 步：编辑工具 */
export type RsepriteTool = 'pencil' | 'eraser'
