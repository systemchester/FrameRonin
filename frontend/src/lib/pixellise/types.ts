/** 垂直线 x、水平线 y（与「量化图缩放后」画布同坐标系，半开区间 [lines[i], lines[i+1])） */
export type Lines = number[]
export type Mesh = [Lines, Lines]

export interface WorkerInput {
  imageBuffer: ArrayBuffer
  width: number
  height: number
  mesh: Mesh
  scaledWidth: number
  scaledHeight: number
  numColors: number | null
  /** 逻辑分辨率输出后整体最近邻放大倍数（proper-pixel-art 的 scale_result） */
  scaleResult: number
  transparentBackground: boolean
}

export type WorkerOutput =
  | { type: 'progress'; message: string; percent?: number }
  | { type: 'result'; imageBuffer: ArrayBuffer; width: number; height: number }
  | { type: 'error'; message: string }

export interface AdvancedPixelateOptions {
  upscale: number
  numColors: number
  /** 每个逻辑像素在输出中的边长（最近邻），类似 `-s` */
  scaleResult: number
  transparentBackground: boolean
}
