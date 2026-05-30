import type { CollisionCell, LoadedImage, ObstacleAsset, ObstacleExportJson, ObstacleGridSize, ObstacleInstance } from './obstacleModel'

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
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Export failed'))), 'image/png')
  })
}

export function loadImageFile(file: File): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => resolve({ file, url, image, width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Image failed to load'))
    }
    image.src = url
  })
}

export function buildObstacleJson(
  mapImage: LoadedImage,
  gridSize: ObstacleGridSize,
  instances: ObstacleInstance[],
  collisionCells: CollisionCell[],
): ObstacleExportJson {
  return {
    version: 1,
    gridSize,
    mapWidth: mapImage.width,
    mapHeight: mapImage.height,
    obstacles: instances.map((item) => ({
      ...item,
      collision: {
        type: 'solid',
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
      },
    })),
    collisionCells,
  }
}

export async function renderMapWithObstacles(
  mapImage: LoadedImage,
  assets: ObstacleAsset[],
  instances: ObstacleInstance[],
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  canvas.width = mapImage.width
  canvas.height = mapImage.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas creation failed')
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(mapImage.image, 0, 0)
  for (const instance of instances) {
    const asset = assets.find((item) => item.id === instance.assetId)
    if (!asset) continue
    ctx.globalAlpha = instance.opacity
    ctx.drawImage(asset.image, instance.x, instance.y, instance.width, instance.height)
  }
  ctx.globalAlpha = 1
  return canvas
}
