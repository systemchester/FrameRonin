import type { AdvancedPixelateOptions } from './types'
import { fileToImageData, imageDataToPngBlob } from './imageDataOps'
import { loadOpenCv } from './opencv'
import { computeMeshWithScaling } from './mesh'
import { runWorkerProcessing } from './workerBridge'

function yieldToBrowser(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0))
}

export async function runPixelliseRestore(
  file: File,
  options: AdvancedPixelateOptions,
  onStatus: (messageKey: string) => void,
): Promise<Blob> {
  onStatus('pixelateAdvancedProgressLoadImage')
  await yieldToBrowser()
  const input = await fileToImageData(file)

  onStatus('pixelateAdvancedProgressOpenCv')
  await yieldToBrowser()
  const cv = await loadOpenCv()

  onStatus('pixelateAdvancedProgressMesh')
  await yieldToBrowser()
  const u = Math.max(2, Math.min(7, Math.floor(options.upscale)))
  const { mesh, scaledWidth, scaledHeight } = computeMeshWithScaling(cv, input, u)

  onStatus('pixelateAdvancedProgressWorker')
  await yieldToBrowser()
  const resultImage = await runWorkerProcessing(input, mesh, {
    scaledWidth,
    scaledHeight,
    numColors: options.numColors,
    scaleResult: Math.max(1, Math.min(5, Math.floor(options.scaleResult))),
    transparentBackground: options.transparentBackground,
  })

  onStatus('pixelateAdvancedProgressEncode')
  await yieldToBrowser()
  return imageDataToPngBlob(resultImage)
}
