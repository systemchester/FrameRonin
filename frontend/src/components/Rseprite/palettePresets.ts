import type { Rgba } from './paintDocument'

/**
 * 橡皮：整格写为透明（alpha = 0）。
 * 与棋盘格背景一致，视觉上为「擦掉」。
 */
export const ERASER_RGBA: Rgba = [0, 0, 0, 0]

/** 常用预设色（RGBA，不透明） */
export const PRESET_PALETTE: readonly Rgba[] = [
  [0, 0, 0, 255],
  [255, 255, 255, 255],
  [128, 128, 128, 255],
  [200, 200, 200, 255],
  [255, 0, 0, 255],
  [255, 140, 0, 255],
  [255, 220, 0, 255],
  [0, 200, 80, 255],
  [0, 180, 200, 255],
  [64, 128, 255, 255],
  [0, 64, 220, 255],
  [120, 64, 220, 255],
  [220, 64, 180, 255],
  [101, 67, 33, 255],
  [255, 200, 210, 255],
]

export function rgbaEqual(a: Rgba, b: Rgba): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]
}

export function rgbaToCss(rgba: Rgba): string {
  const a = rgba[3] / 255
  return `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${a})`
}
