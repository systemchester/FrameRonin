export type BlendRect = {
  x: number
  y: number
  width: number
  height: number
}

export type TileOverlap = {
  rect: BlendRect
  edge: 'top' | 'right' | 'bottom' | 'left'
}

export type SeamBlendOptions = {
  enabled: boolean
  strength: number
}

const MIN_OVERLAP_PX = 2

function intersectRect(a: BlendRect, b: BlendRect): BlendRect | null {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  const right = Math.min(a.x + a.width, b.x + b.width)
  const bottom = Math.min(a.y + a.height, b.y + b.height)
  const width = right - x
  const height = bottom - y
  if (width < MIN_OVERLAP_PX || height < MIN_OVERLAP_PX) return null
  return { x, y, width, height }
}

function overlapEdge(tile: BlendRect, painted: BlendRect, intersection: BlendRect): TileOverlap['edge'] {
  const tileCenterX = tile.x + tile.width / 2
  const tileCenterY = tile.y + tile.height / 2
  const paintedCenterX = painted.x + painted.width / 2
  const paintedCenterY = painted.y + painted.height / 2
  const deltaX = tileCenterX - paintedCenterX
  const deltaY = tileCenterY - paintedCenterY

  if (Math.abs(deltaX) > Math.abs(deltaY)) return deltaX > 0 ? 'left' : 'right'
  if (Math.abs(deltaY) > 0) return deltaY > 0 ? 'top' : 'bottom'
  return intersection.width < intersection.height ? 'left' : 'top'
}

function smoothStep(value: number): number {
  const t = Math.max(0, Math.min(1, value))
  return t * t * (3 - 2 * t)
}

export function detectTileOverlaps(tile: BlendRect, paintedTiles: BlendRect[]): TileOverlap[] {
  return paintedTiles.flatMap((painted) => {
    const rect = intersectRect(tile, painted)
    if (!rect) return []
    return [{ rect, edge: overlapEdge(tile, painted, rect) }]
  })
}

export function createBlendedTileCanvas(
  image: HTMLImageElement,
  drawWidth: number,
  drawHeight: number,
  tileRect: BlendRect,
  overlaps: TileOverlap[],
  options: SeamBlendOptions,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(drawWidth))
  canvas.height = Math.max(1, Math.round(drawHeight))
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.imageSmoothingEnabled = false
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  if (!options.enabled || options.strength <= 0 || overlaps.length === 0) return canvas

  const strength = Math.max(0, Math.min(1, options.strength))
  for (const overlap of overlaps) {
    const localX = Math.max(0, Math.floor(overlap.rect.x - tileRect.x))
    const localY = Math.max(0, Math.floor(overlap.rect.y - tileRect.y))
    const localRight = Math.min(canvas.width, Math.ceil(overlap.rect.x + overlap.rect.width - tileRect.x))
    const localBottom = Math.min(canvas.height, Math.ceil(overlap.rect.y + overlap.rect.height - tileRect.y))
    const width = localRight - localX
    const height = localBottom - localY
    if (width <= 0 || height <= 0) continue

    const imageData = ctx.getImageData(localX, localY, width, height)
    const data = imageData.data
    const xDenom = Math.max(1, width - 1)
    const yDenom = Math.max(1, height - 1)

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let ramp = 1
        if (overlap.edge === 'left') ramp = x / xDenom
        else if (overlap.edge === 'right') ramp = (width - 1 - x) / xDenom
        else if (overlap.edge === 'top') ramp = y / yDenom
        else ramp = (height - 1 - y) / yDenom

        const factor = (1 - strength) + strength * smoothStep(ramp)
        const alphaIndex = (y * width + x) * 4 + 3
        data[alphaIndex] = Math.round((data[alphaIndex] ?? 0) * factor)
      }
    }
    ctx.putImageData(imageData, localX, localY)
  }

  return canvas
}

export function drawBlendedTile(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  tileRect: BlendRect,
  paintedTiles: BlendRect[],
  options: SeamBlendOptions,
) {
  const overlaps = detectTileOverlaps(tileRect, paintedTiles)
  const drawable = createBlendedTileCanvas(image, tileRect.width, tileRect.height, tileRect, overlaps, options)
  ctx.drawImage(drawable, tileRect.x, tileRect.y, tileRect.width, tileRect.height)
}
