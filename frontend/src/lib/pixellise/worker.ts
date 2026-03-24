import type { WorkerInput, WorkerOutput } from './types'
import { processWithMesh } from './pixelate'

type WorkerSelf = { postMessage(message: unknown, transfer?: Transferable[]): void }
const wk = self as unknown as WorkerSelf

function post(o: WorkerOutput, transfer?: Transferable[]) {
  if (transfer?.length) wk.postMessage(o, transfer)
  else wk.postMessage(o)
}

self.onmessage = (e: MessageEvent<WorkerInput>) => {
  try {
    const input = e.data
    post({ type: 'progress', message: 'quantize', percent: 10 })

    const arr = new Uint8ClampedArray(input.imageBuffer)
    const imageData = new ImageData(arr, input.width, input.height)

    const result = processWithMesh(imageData, {
      mesh: input.mesh,
      scaledWidth: input.scaledWidth,
      scaledHeight: input.scaledHeight,
      numColors: input.numColors,
      scaleResult: input.scaleResult,
      transparentBackground: input.transparentBackground,
    })

    post({ type: 'progress', message: 'done', percent: 100 })

    const len = result.width * result.height * 4
    const buf = new ArrayBuffer(len)
    new Uint8Array(buf).set(new Uint8Array(result.data.buffer, result.data.byteOffset, len))
    post({ type: 'result', imageBuffer: buf, width: result.width, height: result.height }, [buf])
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
