import * as opencvStar from '@techstark/opencv-js'

const cvModule = (opencvStar as { default?: unknown }).default ?? opencvStar

type CvModule = typeof opencvStar & {
  Mat?: unknown
  onRuntimeInitialized?: () => void
  then?: unknown
}

async function waitUntilMatUsable(cv: CvModule, timeoutMs: number): Promise<void> {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const m = new (cv as any).Mat(1, 1, (cv as any).CV_8UC1)
      m.delete()
      return
    } catch {
      await new Promise((r) => setTimeout(r, 40))
    }
  }
  throw new Error('OpenCV Mat not usable (timeout)')
}

export async function loadOpenCv(): Promise<CvModule> {
  let cv: CvModule

  if (cvModule instanceof Promise) {
    cv = (await cvModule) as CvModule
  } else if ((cvModule as CvModule).Mat) {
    cv = cvModule as CvModule
  } else {
    const mod = cvModule as CvModule
    try {
      await Promise.race([
        new Promise<void>((resolve) => {
          const prev = mod.onRuntimeInitialized
          mod.onRuntimeInitialized = () => {
            prev?.()
            resolve()
          }
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('opencv init timeout')), 15_000),
        ),
      ])
    } catch {
      await waitUntilMatUsable(mod, 15_000)
    }
    cv = mod
  }

  if (typeof cv?.then === 'function') {
    delete cv.then
  }

  return cv
}
