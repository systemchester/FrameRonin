import { useEffect, useState } from 'react'
import { Button, InputNumber, message, Radio, Slider, Space, Tabs, Tooltip, Typography, Upload } from 'antd'
import { CaretLeftOutlined, CaretRightOutlined, DeleteOutlined, DownloadOutlined, DragOutlined, FileImageOutlined, LayoutOutlined, PictureOutlined, MergeCellsOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import { parseGIF, decompressFrames } from 'gifuct-js'
// @ts-expect-error gifenc has no types
import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import JSZip from 'jszip'
import { useLanguage } from '../i18n/context'
import CropPreview from './CropPreview'
import StashableImage from './StashableImage'
import StashDropZone from './StashDropZone'

const { Dragger } = Upload
const { Text } = Typography

const GIF_ACCEPT = '.gif'
const IMAGE_ACCEPT = ['.png', '.jpg', '.jpeg', '.webp']

/** 找出完全透明的行索引 */
function findTransparentRows(imageData: ImageData): number[] {
  const { data, width, height } = imageData
  const rows: number[] = []
  for (let y = 0; y < height; y++) {
    let allTransparent = true
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] !== 0) {
        allTransparent = false
        break
      }
    }
    if (allTransparent) rows.push(y)
  }
  return rows
}

/** 找出完全透明的列索引 */
function findTransparentCols(imageData: ImageData, y0: number, y1: number): number[] {
  const { data, width } = imageData
  const cols: number[] = []
  for (let x = 0; x < width; x++) {
    let allTransparent = true
    for (let y = y0; y < y1; y++) {
      if (data[(y * width + x) * 4 + 3] !== 0) {
        allTransparent = false
        break
      }
    }
    if (allTransparent) cols.push(x)
  }
  return cols
}

/** 将透明行/列的连续区间转换为内容区间 */
function gapsFromRuns(runs: [number, number][], total: number): [number, number][] {
  if (runs.length === 0) return [[0, total - 1]]
  const regions: [number, number][] = []
  regions.push([0, runs[0]![0] - 1])
  for (let i = 0; i < runs.length - 1; i++) {
    regions.push([runs[i]![1] + 1, runs[i + 1]![0] - 1])
  }
  regions.push([runs[runs.length - 1]![1] + 1, total - 1])
  return regions.filter(([a, b]) => a <= b)
}

/** 从连续透明索引数组得到区间 */
function getRuns(arr: number[]): [number, number][] {
  if (arr.length === 0) return []
  const runs: [number, number][] = []
  let runStart = arr[0]!
  let runEnd = runStart
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] === runEnd + 1) {
      runEnd = arr[i]!
    } else {
      runs.push([runStart, runEnd])
      runStart = arr[i]!
      runEnd = runStart
    }
  }
  runs.push([runStart, runEnd])
  return runs
}

/** 超级单图拆分：按透明行列切割，提取帧并统一尺寸。使用 getImageData/putImageData 保证像素级精确，避免 drawImage 插值导致模糊。 */
async function superSplitByTransparent(
  img: HTMLImageElement,
  baseName: string
): Promise<File[]> {
  const w = img.naturalWidth
  const h = img.naturalHeight
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  const srcData = ctx.getImageData(0, 0, w, h)

  const transparentRows = findTransparentRows(srcData)
  const rowRuns = getRuns(transparentRows)
  const rowRegions = gapsFromRuns(rowRuns, h)

  const frames: { x: number; y: number; w: number; h: number }[] = []
  for (const [y0, y1] of rowRegions) {
    const rowHeight = y1 - y0 + 1
    if (rowHeight <= 0) continue
    const transparentCols = findTransparentCols(srcData, y0, y1 + 1)
    const colRuns = getRuns(transparentCols)
    const colRegions = gapsFromRuns(colRuns, w)
    for (const [x0, x1] of colRegions) {
      const colWidth = x1 - x0 + 1
      if (colWidth <= 0) continue
      frames.push({ x: x0, y: y0, w: colWidth, h: rowHeight })
    }
  }

  if (frames.length === 0) throw new Error('未找到可拆分区域')

  let maxW = 0
  let maxH = 0
  for (const f of frames) {
    maxW = Math.max(maxW, f.w)
    maxH = Math.max(maxH, f.h)
  }

  const outCanvas = document.createElement('canvas')
  outCanvas.width = maxW
  outCanvas.height = maxH
  const outCtx = outCanvas.getContext('2d')!
  const outData = outCtx.createImageData(maxW, maxH)
  outData.data.fill(0)
  const files: File[] = []
  let idx = 0
  for (const f of frames) {
    outData.data.fill(0)
    const padTop = maxH - f.h
    const padLeft = Math.floor((maxW - f.w) / 2)
    for (let dy = 0; dy < f.h; dy++) {
      for (let dx = 0; dx < f.w; dx++) {
        const srcIdx = ((f.y + dy) * w + (f.x + dx)) * 4
        const dstIdx = ((padTop + dy) * maxW + (padLeft + dx)) * 4
        outData.data[dstIdx] = srcData.data[srcIdx]
        outData.data[dstIdx + 1] = srcData.data[srcIdx + 1]
        outData.data[dstIdx + 2] = srcData.data[srcIdx + 2]
        outData.data[dstIdx + 3] = srcData.data[srcIdx + 3]
      }
    }
    outCtx.putImageData(outData, 0, 0)
    const blob = await new Promise<Blob>((resolve, reject) => {
      outCanvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas'))), 'image/png')
    })
    files.push(new File([blob], `${baseName}_super_${idx}.png`, { type: 'image/png' }))
    idx++
  }
  return files
}

function compositeFrame(
  prevBuf: Uint8ClampedArray,
  frame: { patch: Uint8ClampedArray; dims: { top: number; left: number; width: number; height: number }; disposalType?: number },
  width: number,
  height: number
): Uint8ClampedArray {
  const buf = new Uint8ClampedArray(prevBuf)
  const { patch, dims, disposalType = 1 } = frame
  const { top, left, width: pw, height: ph } = dims

  if (disposalType === 2) {
    for (let i = 0; i < buf.length; i += 4) {
      buf[i] = 0
      buf[i + 1] = 0
      buf[i + 2] = 0
      buf[i + 3] = 0
    }
  }

  for (let py = 0; py < ph; py++) {
    for (let px = 0; px < pw; px++) {
      const idx = (py * pw + px) * 4
      const a = patch[idx + 3]
      const outY = top + py
      const outX = left + px
      if (outY >= 0 && outY < height && outX >= 0 && outX < width) {
        const outIdx = (outY * width + outX) * 4
        if (a === 0) {
          buf[outIdx] = 0
          buf[outIdx + 1] = 0
          buf[outIdx + 2] = 0
          buf[outIdx + 3] = 0
        } else {
          buf[outIdx] = patch[idx]
          buf[outIdx + 1] = patch[idx + 1]
          buf[outIdx + 2] = patch[idx + 2]
          buf[outIdx + 3] = a
        }
      }
    }
  }
  return buf
}

export default function GifFrameConverter() {
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState<'gif2frames' | 'frames2gif' | 'images2single' | 'simpleStitch'>('gif2frames')
  const [gifFile, setGifFile] = useState<File | null>(null)
  const [gifPreviewUrl, setGifPreviewUrl] = useState<string | null>(null)
  const [frameFiles, setFrameFiles] = useState<File[]>([])
  const [frameInputUrls, setFrameInputUrls] = useState<string[]>([])
  const [frameDelay, setFrameDelay] = useState(100)
  const [frameDragReorderIdx, setFrameDragReorderIdx] = useState<number | null>(null)
  const [frameCols, setFrameCols] = useState(6)
  const [loading, setLoading] = useState(false)
  const [framesZipUrl, setFramesZipUrl] = useState<string | null>(null)
  const [extractedFrameUrls, setExtractedFrameUrls] = useState<string[]>([])
  const [extractedFrameFiles, setExtractedFrameFiles] = useState<File[]>([])
  const [gifUrl, setGifUrl] = useState<string | null>(null)

  const [combineFiles, setCombineFiles] = useState<File[]>([])
  const [combineInputUrls, setCombineInputUrls] = useState<string[]>([])
  const [dragReorderIdx, setDragReorderIdx] = useState<number | null>(null)
  const [combineCols, setCombineCols] = useState(4)
  const [imagesToSingleInputMode, setImagesToSingleInputMode] = useState<'multi' | 'split'>('multi')
  const [splitFile, setSplitFile] = useState<File | null>(null)
  const [splitFileUrl, setSplitFileUrl] = useState<string | null>(null)
  const [splitRows, setSplitRows] = useState(2)
  const [splitCols, setSplitCols] = useState(2)
  const [combinedUrl, setCombinedUrl] = useState<string | null>(null)
  const [combinedParams, setCombinedParams] = useState<{
    cols: number
    rows: number
    outW: number
    outH: number
    cropTop: number
    cropBottom: number
    cropLeft: number
    cropRight: number
  } | null>(null)
  const [cropTop, setCropTop] = useState(0)
  const [cropBottom, setCropBottom] = useState(0)
  const [cropLeft, setCropLeft] = useState(0)
  const [cropRight, setCropRight] = useState(0)
  const [cropPreviewIndex, setCropPreviewIndex] = useState(0)
  const [firstImageSize, setFirstImageSize] = useState<{ w: number; h: number } | null>(null)

  const [stitchFiles, setStitchFiles] = useState<File[]>([])
  const [stitchInputUrls, setStitchInputUrls] = useState<string[]>([])
  const [stitchDirection, setStitchDirection] = useState<'vertical' | 'horizontal' | 'overlay'>('vertical')
  const [stitchResultUrl, setStitchResultUrl] = useState<string | null>(null)

  const revokeExtractedPreviews = () => {
    setExtractedFrameUrls((urls) => {
      urls.forEach(URL.revokeObjectURL)
      return []
    })
  }

  useEffect(() => {
    if (gifFile) {
      const url = URL.createObjectURL(gifFile)
      setGifPreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    setGifPreviewUrl(null)
  }, [gifFile])

  useEffect(() => () => revokeExtractedPreviews(), [])

  useEffect(() => {
    const urls = frameFiles.map((f) => URL.createObjectURL(f))
    setFrameInputUrls(urls)
    return () => urls.forEach(URL.revokeObjectURL)
  }, [frameFiles])

  useEffect(() => {
    const urls = combineFiles.map((f) => URL.createObjectURL(f))
    setCombineInputUrls(urls)
    return () => urls.forEach(URL.revokeObjectURL)
  }, [combineFiles])

  useEffect(() => {
    if (combineFiles.length === 0) {
      setFirstImageSize(null)
      setCropPreviewIndex(0)
    } else {
      setCropPreviewIndex((i) => Math.min(i, combineFiles.length - 1))
    }
  }, [combineFiles.length])

  useEffect(() => {
    if (splitFile) {
      const url = URL.createObjectURL(splitFile)
      setSplitFileUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    setSplitFileUrl(null)
  }, [splitFile])

  useEffect(() => {
    const urls = stitchFiles.map((f) => URL.createObjectURL(f))
    setStitchInputUrls(urls)
    return () => urls.forEach(URL.revokeObjectURL)
  }, [stitchFiles])

  const runSplitSingleImage = async () => {
    if (!splitFile) return
    setLoading(true)
    setCombinedUrl((old) => {
      if (old) URL.revokeObjectURL(old)
      return null
    })
    try {
      const url = URL.createObjectURL(splitFile)
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image()
        i.onload = () => res(i)
        i.onerror = () => rej(new Error('load'))
        i.src = url
      })
      URL.revokeObjectURL(url)
      const w = img.naturalWidth
      const h = img.naturalHeight
      const rows = Math.max(1, Math.floor(splitRows))
      const cols = Math.max(1, Math.floor(splitCols))
      const cellW = Math.floor(w / cols)
      const cellH = Math.floor(h / rows)
      if (cellW <= 0 || cellH <= 0) throw new Error('Split too small')
      const canvas = document.createElement('canvas')
      canvas.width = cellW
      canvas.height = cellH
      const ctx = canvas.getContext('2d')!
      const baseName = splitFile.name.replace(/\.[^.]+$/, '')
      const files: File[] = []
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.clearRect(0, 0, cellW, cellH)
          ctx.drawImage(img, c * cellW, r * cellH, cellW, cellH, 0, 0, cellW, cellH)
          const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas'))), 'image/png')
          })
          files.push(new File([blob], `${baseName}_${r}_${c}.png`, { type: 'image/png' }))
        }
      }
      setCombineFiles(files)
      message.success(t('imagesToSingleSplitSuccess', { n: files.length }))
    } catch (e) {
      message.error(t('imagesToSingleSplitFailed') + ': ' + String(e))
    } finally {
      setLoading(false)
    }
  }

  const runSuperSplitSingleImage = async () => {
    if (!splitFile) return
    setLoading(true)
    setCombinedUrl((old) => {
      if (old) URL.revokeObjectURL(old)
      return null
    })
    try {
      const url = URL.createObjectURL(splitFile)
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image()
        i.onload = () => res(i)
        i.onerror = () => rej(new Error('load'))
        i.src = url
      })
      URL.revokeObjectURL(url)
      const baseName = splitFile.name.replace(/\.[^.]+$/, '')
      const files = await superSplitByTransparent(img, baseName)
      setCombineFiles(files)
      setImagesToSingleInputMode('multi')
      message.success(t('imagesToSingleSuperSplitSuccess', { n: files.length }))
    } catch (e) {
      message.error(t('imagesToSingleSuperSplitFailed') + ': ' + String(e))
    } finally {
      setLoading(false)
    }
  }

  const runImagesToSingle = async () => {
    if (combineFiles.length === 0) return
    setLoading(true)
    setCombinedUrl((old) => {
      if (old) URL.revokeObjectURL(old)
      return null
    })
    setCombinedParams(null)
    try {
      const imgs: HTMLImageElement[] = []
      const top = cropTop
      const bottom = cropBottom
      const left = cropLeft
      const right = cropRight
      let maxW = 0
      let maxH = 0
      for (const f of combineFiles) {
        const url = URL.createObjectURL(f)
        const img = await new Promise<HTMLImageElement>((res, rej) => {
          const i = new Image()
          i.onload = () => res(i)
          i.onerror = () => rej(new Error('load'))
          i.src = url
        })
        URL.revokeObjectURL(url)
        // 正数=裁切，负数=扩边（增加透明像素）
        const sw = Math.max(1, img.naturalWidth - left - right)
        const sh = Math.max(1, img.naturalHeight - top - bottom)
        maxW = Math.max(maxW, sw)
        maxH = Math.max(maxH, sh)
        imgs.push(img)
      }
      const cols = Math.max(1, Math.floor(combineCols))
      const rows = Math.ceil(imgs.length / cols)
      const outW = cols * maxW
      const outH = rows * maxH
      const canvas = document.createElement('canvas')
      canvas.width = outW
      canvas.height = outH
      const ctx = canvas.getContext('2d')!
      // 不填充背景，保持透明
      for (let i = 0; i < imgs.length; i++) {
        const img = imgs[i]!
        const sw = Math.max(1, img.naturalWidth - left - right)
        const sh = Math.max(1, img.naturalHeight - top - bottom)
        const r = Math.floor(i / cols)
        const c = i % cols
        const dx = c * maxW + (maxW - sw) / 2
        const dy = r * maxH + (maxH - sh) / 2
        // 正数=从边缘裁切，负数=扩边时源区从 (0,0) 开始，目标偏移
        const sx = Math.max(0, left)
        const sy = Math.max(0, top)
        const srcW = Math.max(1, img.naturalWidth - Math.max(0, left) - Math.max(0, right))
        const srcH = Math.max(1, img.naturalHeight - Math.max(0, top) - Math.max(0, bottom))
        const offsetX = Math.max(0, -left)
        const offsetY = Math.max(0, -top)
        // 始终按 1:1 绘制，避免拉伸变形。sw/sh 为格子尺寸（含扩边），实际绘制用 srcW/srcH
        ctx.drawImage(img, sx, sy, srcW, srcH, dx + offsetX, dy + offsetY, srcW, srcH)
      }
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas'))), 'image/png')
      })
      setCombinedUrl(URL.createObjectURL(blob))
      setCombinedParams({
        cols,
        rows,
        outW,
        outH,
        cropTop: top,
        cropBottom: bottom,
        cropLeft: left,
        cropRight: right,
      })
      message.success(t('imagesToSingleSuccess'))
    } catch (e) {
      message.error(t('imagesToSingleFailed') + ': ' + String(e))
    } finally {
      setLoading(false)
    }
  }

  const downloadCombined = () => {
    if (!combinedUrl) return
    const a = document.createElement('a')
    a.href = combinedUrl
    const p = combinedParams
    const name = p
      ? `combined_${p.cols}x${p.rows}_${p.outW}x${p.outH}_T${p.cropTop}B${p.cropBottom}L${p.cropLeft}R${p.cropRight}.png`
      : 'combined.png'
    a.download = name
    a.click()
  }

  const runGifToFrames = async () => {
    if (!gifFile) return
    setLoading(true)
    revokeExtractedPreviews()
    setExtractedFrameFiles([])
    setFramesZipUrl((old) => {
      if (old) URL.revokeObjectURL(old)
      return null
    })
    try {
      const buf = await gifFile.arrayBuffer()
      const gif = parseGIF(buf)
      const frames = decompressFrames(gif, true)
      const w = gif.lsd.width
      const h = gif.lsd.height

      let prevBuf = new Uint8ClampedArray(w * h * 4)
      prevBuf.fill(0)

      const zip = new JSZip()
      const previewUrls: string[] = []
      const frameFiles: File[] = []
      const maxPreview = 24
      const baseName = gifFile.name.replace(/\.gif$/i, '') || 'frames'
      for (let i = 0; i < frames.length; i++) {
        const f = frames[i] as { patch: Uint8ClampedArray; dims: { top: number; left: number; width: number; height: number }; disposalType?: number }
        prevBuf = compositeFrame(prevBuf, f, w, h) as typeof prevBuf
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')!
        const imgData = ctx.createImageData(w, h)
        imgData.data.set(prevBuf)
        ctx.putImageData(imgData, 0, 0)
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas'))), 'image/png')
        })
        const file = new File([blob], `${baseName}_frame_${String(i).padStart(3, '0')}.png`, { type: 'image/png' })
        zip.file(`frame_${String(i).padStart(3, '0')}.png`, blob)
        frameFiles.push(file)
        if (previewUrls.length < maxPreview) {
          previewUrls.push(URL.createObjectURL(blob))
        }
      }

      setExtractedFrameUrls(previewUrls)
      setExtractedFrameFiles(frameFiles)
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      setFramesZipUrl(URL.createObjectURL(zipBlob))
      message.success(t('gifExtractSuccess', { n: frames.length }))
    } catch (e) {
      message.error(t('gifExtractFailed') + ': ' + String(e))
    } finally {
      setLoading(false)
    }
  }

  const runFramesToGif = async () => {
    if (frameFiles.length === 0) return
    setLoading(true)
    setGifUrl((old) => {
      if (old) URL.revokeObjectURL(old)
      return null
    })
    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      const imgs: ImageData[] = []
      let w = 0
      let h = 0
      for (const f of frameFiles) {
        const blob = await f.arrayBuffer()
        const url = URL.createObjectURL(new Blob([blob]))
        const img = await new Promise<HTMLImageElement>((res, rej) => {
          const i = new Image()
          i.onload = () => res(i)
          i.onerror = () => rej(new Error('load'))
          i.src = url
        })
        URL.revokeObjectURL(url)
        if (imgs.length === 0) {
          w = img.width
          h = img.height
        }
        canvas.width = w
        canvas.height = h
        ctx.clearRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        imgs.push(ctx.getImageData(0, 0, w, h))
      }

      const gif = GIFEncoder()
      for (let i = 0; i < imgs.length; i++) {
        const { data, width, height } = imgs[i]
        const palette = quantize(data, 255, {
          format: 'rgba4444',
          oneBitAlpha: 128,
          clearAlpha: true,
          clearAlphaThreshold: 128,
        })
        const index = applyPalette(data, palette, 'rgba4444')
        const transIdx = palette.findIndex((c: number[]) => c[3] === 0)
        let finalPalette: number[][]
        let finalIndex: Uint8Array
        let transparentIndex: number
        if (transIdx >= 0) {
          finalPalette = [...palette]
          finalIndex = index
          transparentIndex = transIdx
        } else {
          finalPalette = [[0, 0, 0, 0], ...palette]
          finalIndex = new Uint8Array(index.length)
          for (let j = 0; j < data.length; j += 4) {
            if (data[j + 3] < 128) {
              finalIndex[j / 4] = 0
            } else {
              finalIndex[j / 4] = index[j / 4]! + 1
            }
          }
          transparentIndex = 0
        }
        gif.writeFrame(finalIndex, width, height, {
          palette: finalPalette,
          delay: frameDelay,
          transparent: true,
          transparentIndex,
        })
      }
      gif.finish()
      const bytes = gif.bytes()
      const blob = new Blob([bytes], { type: 'image/gif' })
      setGifUrl(URL.createObjectURL(blob))
      message.success(t('gifEncodeSuccess'))
    } catch (e) {
      message.error(t('gifEncodeFailed') + ': ' + String(e))
    } finally {
      setLoading(false)
    }
  }

  const downloadZip = () => {
    if (!framesZipUrl) return
    const a = document.createElement('a')
    a.href = framesZipUrl
    a.download = (gifFile?.name?.replace(/\.gif$/i, '') || 'frames') + '_frames.zip'
    a.click()
  }

  const importFramesToCombine = () => {
    if (extractedFrameFiles.length === 0) return
    setCombineFiles(extractedFrameFiles)
    setImagesToSingleInputMode('multi')
    setCombinedUrl((old) => {
      if (old) URL.revokeObjectURL(old)
      return null
    })
    setCropTop(0)
    setCropBottom(0)
    setCropLeft(0)
    setCropRight(0)
    setActiveTab('images2single')
    message.success(t('gifFramesToCombineSuccess', { n: extractedFrameFiles.length }))
  }

  const downloadGif = () => {
    if (!gifUrl) return
    const a = document.createElement('a')
    a.href = gifUrl
    a.download = 'output.gif'
    a.click()
  }

  const runSimpleStitch = async () => {
    if (stitchFiles.length === 0) return
    setLoading(true)
    setStitchResultUrl((old) => {
      if (old) URL.revokeObjectURL(old)
      return null
    })
    try {
      const imgs: HTMLImageElement[] = []
      for (const f of stitchFiles) {
        const url = URL.createObjectURL(f)
        const img = await new Promise<HTMLImageElement>((res, rej) => {
          const i = new Image()
          i.onload = () => res(i)
          i.onerror = () => rej(new Error('load'))
          i.src = url
        })
        URL.revokeObjectURL(url)
        imgs.push(img)
      }
      const isVertical = stitchDirection === 'vertical'
      const isOverlay = stitchDirection === 'overlay'
      let outW: number
      let outH: number
      if (isOverlay) {
        outW = Math.max(...imgs.map((i) => i.naturalWidth))
        outH = Math.max(...imgs.map((i) => i.naturalHeight))
      } else if (isVertical) {
        outW = Math.max(...imgs.map((i) => i.naturalWidth))
        outH = imgs.reduce((s, i) => s + i.naturalHeight, 0)
      } else {
        outW = imgs.reduce((s, i) => s + i.naturalWidth, 0)
        outH = Math.max(...imgs.map((i) => i.naturalHeight))
      }
      const canvas = document.createElement('canvas')
      canvas.width = outW
      canvas.height = outH
      const ctx = canvas.getContext('2d')!
      let dx = 0
      let dy = 0
      for (let i = 0; i < imgs.length; i++) {
        const img = imgs[i]!
        const w = img.naturalWidth
        const h = img.naturalHeight
        if (isOverlay) {
          dx = (outW - w) / 2
          dy = (outH - h) / 2
          ctx.drawImage(img, 0, 0, w, h, dx, dy, w, h)
        } else if (isVertical) {
          dx = (outW - w) / 2
          ctx.drawImage(img, 0, 0, w, h, dx, dy, w, h)
          dy += h
        } else {
          dy = (outH - h) / 2
          ctx.drawImage(img, 0, 0, w, h, dx, dy, w, h)
          dx += w
        }
      }
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas'))), 'image/png')
      })
      setStitchResultUrl(URL.createObjectURL(blob))
      message.success(t('simpleStitchSuccess'))
    } catch (e) {
      message.error(t('simpleStitchFailed') + ': ' + String(e))
    } finally {
      setLoading(false)
    }
  }

  const downloadStitch = () => {
    if (!stitchResultUrl) return
    const a = document.createElement('a')
    a.href = stitchResultUrl
    a.download = 'stitched.png'
    a.click()
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%', paddingTop: 8 }}>
      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as 'gif2frames' | 'frames2gif' | 'images2single' | 'simpleStitch')}
        items={[
          {
            key: 'gif2frames',
            label: (
              <span>
                <FileImageOutlined /> {t('gifToFrames')}
              </span>
            ),
            children: (
              <>
                <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>{t('gifToFramesHint')}</Text>
                <StashDropZone
                  onStashDrop={(f) => {
                    setGifFile(f)
                    revokeExtractedPreviews()
                    setExtractedFrameFiles([])
                    setFramesZipUrl((old) => {
                      if (old) URL.revokeObjectURL(old)
                      return null
                    })
                  }}
                >
                  <Dragger
                    accept={GIF_ACCEPT}
                    maxCount={1}
                    fileList={gifFile ? [{ uid: '1', name: gifFile.name } as UploadFile] : []}
                    beforeUpload={(f) => {
                      setGifFile(f)
                      revokeExtractedPreviews()
                      setExtractedFrameFiles([])
                      setFramesZipUrl((old) => {
                        if (old) URL.revokeObjectURL(old)
                        return null
                      })
                      return false
                    }}
                    onRemove={() => setGifFile(null)}
                  >
                    <p className="ant-upload-text">{t('gifUploadHint')}</p>
                  </Dragger>
                </StashDropZone>
                {gifFile && gifPreviewUrl && (
                  <>
                    <Text strong style={{ display: 'block', marginTop: 16, marginBottom: 8 }}>{t('imgOriginalPreview')}</Text>
                    <div
                      style={{
                        padding: 16,
                        background: 'repeating-conic-gradient(#c9bfb0 0% 25%, #e4dbcf 0% 50%) 50% / 16px 16px',
                        borderRadius: 8,
                        border: '1px solid #9a8b78',
                        display: 'inline-block',
                      }}
                    >
                      <StashableImage
                        src={gifPreviewUrl}
                        alt=""
                        style={{ maxWidth: 320, maxHeight: 240, display: 'block' }}
                      />
                    </div>
                  </>
                )}
                <Space style={{ marginTop: 16 }} wrap>
                  <Button type="primary" loading={loading} onClick={runGifToFrames} disabled={!gifFile}>
                    {t('gifToFrames')}
                  </Button>
                  {framesZipUrl && (
                    <Button icon={<DownloadOutlined />} onClick={downloadZip}>
                      {t('gifDownloadFrames')}
                    </Button>
                  )}
                  {extractedFrameFiles.length > 0 && (
                    <Button icon={<MergeCellsOutlined />} onClick={importFramesToCombine}>
                      {t('gifFramesToCombine')}
                    </Button>
                  )}
                </Space>
                {extractedFrameUrls.length > 0 && (
                  <>
                    <Text strong style={{ display: 'block', marginTop: 24, marginBottom: 8 }}>{t('imgPreview')}</Text>
                    <div
                      style={{
                        padding: 16,
                        background: 'repeating-conic-gradient(#c9bfb0 0% 25%, #e4dbcf 0% 50%) 50% / 16px 16px',
                        borderRadius: 8,
                        border: '1px solid #9a8b78',
                        display: 'inline-block',
                        maxWidth: '100%',
                      }}
                    >
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 320, overflow: 'auto' }}>
                        {extractedFrameUrls.map((url, i) => (
                          <StashableImage
                            key={i}
                            src={url}
                            alt={`${t('frame')} ${i + 1}`}
                            style={{ maxWidth: 120, maxHeight: 120, imageRendering: 'pixelated', border: '1px solid rgba(0,0,0,0.1)' }}
                          />
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            ),
          },
          {
            key: 'frames2gif',
            label: (
              <span>
                <PictureOutlined /> {t('framesToGif')}
              </span>
            ),
            children: (
              <>
                <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>{t('framesToGifHint')}</Text>
                <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>{t('gifFrameDelay')}:</Text>
                <Slider min={20} max={500} value={frameDelay} onChange={setFrameDelay} style={{ maxWidth: 200, marginBottom: 16 }} />
                <Text type="secondary" style={{ fontSize: 12 }}>{frameDelay} ms</Text>
                {frameFiles.length > 0 && (
                  <Space wrap align="center" style={{ marginBottom: 12 }}>
                    <Text type="secondary">{t('gifFrameCols')}:</Text>
                    <InputNumber min={1} max={16} value={frameCols} onChange={(v) => setFrameCols(v ?? 6)} style={{ width: 64 }} />
                  </Space>
                )}
                <StashDropZone
                  onStashDrop={(f) => setFrameFiles((prev) => [...prev, f])}
                >
                  <Dragger
                    accept={IMAGE_ACCEPT.join(',')}
                    multiple
                    fileList={frameFiles.map((f, i) => ({ uid: String(i), name: f.name } as UploadFile))}
                    beforeUpload={(f) => {
                      setFrameFiles((prev) => [...prev, f])
                      return false
                    }}
                    onRemove={(file) => {
                      const idx = frameFiles.findIndex((_, i) => String(i) === file.uid)
                      if (idx >= 0) setFrameFiles((prev) => prev.filter((_, i) => i !== idx))
                    }}
                    style={{ marginTop: 16 }}
                  >
                    <p className="ant-upload-text">{t('framesUploadHint')}</p>
                  </Dragger>
                </StashDropZone>
                {frameInputUrls.length > 0 && (
                  <>
                    <Text strong style={{ display: 'block', marginTop: 16, marginBottom: 8 }}>{t('imgOriginalPreview')}</Text>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>{t('gifFrameReorderHint')}</Text>
                    <div
                      style={{
                        padding: 16,
                        background: 'repeating-conic-gradient(#c9bfb0 0% 25%, #e4dbcf 0% 50%) 50% / 16px 16px',
                        borderRadius: 8,
                        border: '1px solid #9a8b78',
                        width: '100%',
                        maxWidth: 720,
                      }}
                    >
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: `repeat(${Math.max(1, frameCols)}, 1fr)`,
                          gap: 12,
                          maxHeight: 400,
                          overflow: 'auto',
                        }}
                      >
                        {frameInputUrls.map((url, i) => (
                          <div
                            key={i}
                            style={{
                              position: 'relative',
                              display: 'inline-block',
                              opacity: frameDragReorderIdx === i ? 0.6 : 1,
                              border: frameDragReorderIdx === i ? '2px dashed #b55233' : 'none',
                              borderRadius: 4,
                            }}
                            onDragOver={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              e.dataTransfer.dropEffect = 'move'
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              const from = frameDragReorderIdx
                              if (from === null || from === i) return
                              setFrameFiles((prev) => {
                                const next = [...prev]
                                const [item] = next.splice(from, 1)
                                next.splice(i, 0, item!)
                                return next
                              })
                              setFrameDragReorderIdx(null)
                            }}
                            onDragLeave={() => {}}
                          >
                            <StashableImage
                              src={url}
                              alt={`${t('frame')} ${i + 1}`}
                              draggable={false}
                              style={{ maxWidth: 120, maxHeight: 120, width: '100%', objectFit: 'contain', imageRendering: 'pixelated', border: '1px solid rgba(0,0,0,0.1)', display: 'block' }}
                            />
                            <span
                              draggable
                              onDragStart={(e) => {
                                e.stopPropagation()
                                e.dataTransfer.effectAllowed = 'move'
                                e.dataTransfer.setData('text/plain', String(i))
                                setFrameDragReorderIdx(i)
                              }}
                              onDragEnd={() => setFrameDragReorderIdx(null)}
                              style={{
                                position: 'absolute',
                                top: 2,
                                left: 2,
                                width: 18,
                                height: 18,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'rgba(0,0,0,0.5)',
                                cursor: 'grab',
                                background: 'rgba(255,255,255,0.8)',
                                borderRadius: 2,
                                zIndex: 1,
                              }}
                            >
                              <DragOutlined style={{ fontSize: 12 }} />
                            </span>
                            <Button
                              type="primary"
                              danger
                              size="small"
                              icon={<DeleteOutlined />}
                              onClick={(e) => {
                                e.stopPropagation()
                                setFrameFiles((prev) => prev.filter((_, idx) => idx !== i))
                              }}
                              style={{
                                position: 'absolute',
                                top: 2,
                                right: 2,
                                width: 18,
                                height: 18,
                                minWidth: 18,
                                padding: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: 0.9,
                                fontSize: 10,
                              }}
                            />
                            {i % frameCols === 0 && (
                              <Tooltip title={t('gifFrameDeleteRow')}>
                                <Button
                                  type="primary"
                                  danger
                                  size="small"
                                  icon={<DeleteOutlined />}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    const rowStart = Math.floor(i / frameCols) * frameCols
                                    const rowEnd = Math.min(rowStart + frameCols, frameFiles.length)
                                    setFrameFiles((prev) => prev.filter((_, idx) => idx < rowStart || idx >= rowEnd))
                                  }}
                                  style={{
                                    position: 'absolute',
                                    bottom: 2,
                                    left: 2,
                                    width: 18,
                                    height: 18,
                                    minWidth: 18,
                                    padding: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: 0.9,
                                    fontSize: 10,
                                  }}
                                />
                              </Tooltip>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                <Space style={{ marginTop: 16 }}>
                  <Button type="primary" loading={loading} onClick={runFramesToGif} disabled={frameFiles.length === 0}>
                    {t('framesToGif')}
                  </Button>
                  {gifUrl && (
                    <Button icon={<DownloadOutlined />} onClick={downloadGif}>
                      {t('gifDownloadGif')}
                    </Button>
                  )}
                </Space>
                {gifUrl && (
                  <>
                    <Text strong style={{ display: 'block', marginTop: 24, marginBottom: 8 }}>{t('imgPreview')}</Text>
                    <div
                      style={{
                        padding: 16,
                        background: 'repeating-conic-gradient(#c9bfb0 0% 25%, #e4dbcf 0% 50%) 50% / 16px 16px',
                        borderRadius: 8,
                        border: '1px solid #9a8b78',
                        display: 'inline-block',
                      }}
                    >
                      <StashableImage
                        src={gifUrl}
                        alt={t('imgPreview')}
                        style={{ maxWidth: '100%', maxHeight: 320, display: 'block', imageRendering: 'auto' }}
                      />
                    </div>
                  </>
                )}
              </>
            ),
          },
          {
            key: 'images2single',
            label: (
              <span>
                <MergeCellsOutlined /> {t('imagesToSingle')}
              </span>
            ),
            children: (
              <>
                <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>{t('imagesToSingleHint')}</Text>
                <Space wrap align="center" style={{ marginBottom: 12 }}>
                  <Text type="secondary">{t('imagesToSingleCols')}:</Text>
                  <InputNumber min={1} max={64} value={combineCols} onChange={(v) => setCombineCols(v ?? 4)} style={{ width: 72 }} />
                </Space>
                <Space wrap align="center" style={{ marginBottom: 12 }}>
                  <Text type="secondary">{t('imagesToSingleInputMode')}:</Text>
                  <Radio.Group
                    value={imagesToSingleInputMode}
                    onChange={(e) => setImagesToSingleInputMode(e.target.value)}
                    optionType="button"
                    size="small"
                  >
                    <Radio.Button value="multi">{t('imagesToSingleInputMulti')}</Radio.Button>
                    <Radio.Button value="split">{t('imagesToSingleInputSplit')}</Radio.Button>
                  </Radio.Group>
                </Space>
                {imagesToSingleInputMode === 'split' && (
                  <div style={{ marginBottom: 16 }}>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>{t('imagesToSingleSplitHint')}</Text>
                    <Space wrap align="center" style={{ marginBottom: 8 }}>
                      <InputNumber min={1} max={32} value={splitRows} onChange={(v) => setSplitRows(v ?? 2)} style={{ width: 64 }} addonBefore={t('imagesToSingleSplitRows')} />
                      <InputNumber min={1} max={32} value={splitCols} onChange={(v) => setSplitCols(v ?? 2)} style={{ width: 64 }} addonBefore={t('imagesToSingleSplitCols')} />
                    </Space>
                    <StashDropZone onStashDrop={(f) => setSplitFile(f)}>
                      <Dragger
                        accept={IMAGE_ACCEPT.join(',')}
                        maxCount={1}
                        fileList={splitFile ? [{ uid: 'split-1', name: splitFile.name } as UploadFile] : []}
                        beforeUpload={(f) => {
                          setSplitFile(f)
                          return false
                        }}
                        onRemove={() => setSplitFile(null)}
                      >
                        <p className="ant-upload-text">{t('imagesToSingleSplitUploadHint')}</p>
                      </Dragger>
                    </StashDropZone>
                    {splitFileUrl && (
                      <div style={{ marginTop: 8 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>{t('imgOriginalPreview')}:</Text>
                        <div style={{ marginTop: 4, display: 'inline-block', padding: 8, background: 'repeating-conic-gradient(#c9bfb0 0% 25%, #e4dbcf 0% 50%) 50% / 16px 16px', borderRadius: 4, border: '1px solid #9a8b78' }}>
                          <StashableImage src={splitFileUrl} alt="" style={{ maxWidth: 200, maxHeight: 120, display: 'block' }} />
                        </div>
                      </div>
                    )}
                    <Space style={{ marginTop: 8 }}>
                      <Button
                        type="primary"
                        loading={loading}
                        onClick={runSplitSingleImage}
                        disabled={!splitFile}
                      >
                        {loading ? t('imagesToSingleSplitBtnLoading') : t('imagesToSingleSplitBtn')}
                      </Button>
                      <Button
                        loading={loading}
                        disabled={!splitFile}
                        onClick={runSuperSplitSingleImage}
                      >
                        {t('imagesToSingleSuperSplitBtn')}
                      </Button>
                    </Space>
                  </div>
                )}
                {imagesToSingleInputMode === 'multi' && (
                  <StashDropZone onStashDrop={(f) => setCombineFiles((prev) => [...prev, f])}>
                    <Dragger
                      accept={IMAGE_ACCEPT.join(',')}
                      multiple
                      fileList={combineFiles.map((f, i) => ({ uid: `c-${i}`, name: f.name } as UploadFile))}
                      beforeUpload={(f) => {
                        setCombineFiles((prev) => [...prev, f])
                        return false
                      }}
                      onRemove={(file) => {
                        const idx = combineFiles.findIndex((_, i) => `c-${i}` === file.uid)
                        if (idx >= 0) setCombineFiles((prev) => prev.filter((_, i) => i !== idx))
                      }}
                    >
                      <p className="ant-upload-text">{t('framesUploadHint')}</p>
                    </Dragger>
                  </StashDropZone>
                )}
                {combineFiles.length > 0 && combineInputUrls.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>{t('imagesToSingleCropHint')}</Text>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Button
                            type="text"
                            size="small"
                            icon={<CaretLeftOutlined />}
                            disabled={combineFiles.length <= 1 || cropPreviewIndex <= 0}
                            onClick={() => setCropPreviewIndex((i) => Math.max(0, i - 1))}
                          />
                          <CropPreview
                            key={cropPreviewIndex}
                            imageUrl={combineInputUrls[cropPreviewIndex]!}
                            cropTop={cropTop}
                            cropBottom={cropBottom}
                            cropLeft={cropLeft}
                            cropRight={cropRight}
                            onChange={({ top, bottom, left, right }) => {
                              setCropTop(top)
                              setCropBottom(bottom)
                              setCropLeft(left)
                              setCropRight(right)
                            }}
                            onImageSize={cropPreviewIndex === 0 ? (w, h) => setFirstImageSize({ w, h }) : undefined}
                            loadingText={t('cropPreviewLoading')}
                            allowNegative
                          />
                          <Button
                            type="text"
                            size="small"
                            icon={<CaretRightOutlined />}
                            disabled={combineFiles.length <= 1 || cropPreviewIndex >= combineFiles.length - 1}
                            onClick={() => setCropPreviewIndex((i) => Math.min(combineFiles.length - 1, i + 1))}
                          />
                        </div>
                        {combineFiles.length > 1 && (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {t('imagesToSingleCropPreviewN', { current: cropPreviewIndex + 1, total: combineFiles.length })}
                          </Text>
                        )}
                        {(cropTop < 0 || cropBottom < 0 || cropLeft < 0 || cropRight < 0) && (
                          <Text type="secondary" style={{ fontSize: 12 }}>{t('imagesToSingleCropNegativeHint')}</Text>
                        )}
                      </div>
                      <div style={{ alignSelf: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <Space wrap align="center">
                          <InputNumber min={-999} value={cropTop} onChange={(v) => setCropTop(v ?? 0)} style={{ width: 64 }} addonBefore={t('batchCropTop')} />
                          <InputNumber min={-999} value={cropBottom} onChange={(v) => setCropBottom(v ?? 0)} style={{ width: 64 }} addonBefore={t('batchCropBottom')} />
                          <InputNumber min={-999} value={cropLeft} onChange={(v) => setCropLeft(v ?? 0)} style={{ width: 64 }} addonBefore={t('batchCropLeft')} />
                          <InputNumber min={-999} value={cropRight} onChange={(v) => setCropRight(v ?? 0)} style={{ width: 64 }} addonBefore={t('batchCropRight')} />
                        </Space>
                        {firstImageSize && (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {t('imagesToSingleCropRemaining', {
                              w: Math.max(1, firstImageSize.w - cropLeft - cropRight),
                              h: Math.max(1, firstImageSize.h - cropTop - cropBottom),
                            })}
                          </Text>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {combineInputUrls.length > 0 && (
                  <>
                    <Text strong style={{ display: 'block', marginTop: 16, marginBottom: 8 }}>{t('imgOriginalPreview')}</Text>
                    <div
                      style={{
                        padding: 16,
                        background: 'repeating-conic-gradient(#c9bfb0 0% 25%, #e4dbcf 0% 50%) 50% / 16px 16px',
                        borderRadius: 8,
                        border: '1px solid #9a8b78',
                        width: '100%',
                        maxWidth: 720,
                      }}
                    >
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: `repeat(${Math.max(1, combineCols)}, 1fr)`,
                          gap: 12,
                          maxHeight: 600,
                          overflow: 'auto',
                        }}
                      >
                        {combineInputUrls.map((url, i) => (
                          <div
                            key={i}
                            style={{
                              position: 'relative',
                              display: 'inline-block',
                              opacity: dragReorderIdx === i ? 0.6 : 1,
                              border: dragReorderIdx === i ? '2px dashed #b55233' : 'none',
                              borderRadius: 4,
                            }}
                            onDragOver={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              e.dataTransfer.dropEffect = 'move'
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              const from = dragReorderIdx
                              if (from === null || from === i) return
                              setCombineFiles((prev) => {
                                const next = [...prev]
                                const [item] = next.splice(from, 1)
                                next.splice(i, 0, item!)
                                return next
                              })
                              setDragReorderIdx(null)
                            }}
                            onDragLeave={() => {}}
                          >
                            <StashableImage
                              src={url}
                              alt={`${t('frame')} ${i + 1}`}
                              draggable={false}
                              style={{ maxWidth: 120, maxHeight: 120, width: '100%', objectFit: 'contain', imageRendering: 'pixelated', border: '1px solid rgba(0,0,0,0.1)', display: 'block' }}
                            />
                            <span
                              draggable
                              onDragStart={(e) => {
                                e.stopPropagation()
                                e.dataTransfer.effectAllowed = 'move'
                                e.dataTransfer.setData('text/plain', String(i))
                                setDragReorderIdx(i)
                              }}
                              onDragEnd={() => setDragReorderIdx(null)}
                              style={{
                                position: 'absolute',
                                top: 2,
                                left: 2,
                                width: 18,
                                height: 18,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'rgba(0,0,0,0.5)',
                                cursor: 'grab',
                                background: 'rgba(255,255,255,0.8)',
                                borderRadius: 2,
                                zIndex: 1,
                              }}
                            >
                              <DragOutlined style={{ fontSize: 12 }} />
                            </span>
                            <Button
                              type="primary"
                              danger
                              size="small"
                              icon={<DeleteOutlined />}
                              onClick={(e) => {
                                e.stopPropagation()
                                setCombineFiles((prev) => prev.filter((_, idx) => idx !== i))
                              }}
                              style={{
                                position: 'absolute',
                                top: 2,
                                right: 2,
                                width: 18,
                                height: 18,
                                minWidth: 18,
                                padding: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: 0.9,
                                fontSize: 10,
                              }}
                            />
                            {i % combineCols === 0 && (
                              <Tooltip title={t('imagesToSingleDeleteRow')}>
                                <Button
                                  type="primary"
                                  danger
                                  size="small"
                                  icon={<DeleteOutlined />}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    const rowStart = Math.floor(i / combineCols) * combineCols
                                    const rowEnd = Math.min(rowStart + combineCols, combineFiles.length)
                                    setCombineFiles((prev) => prev.filter((_, idx) => idx < rowStart || idx >= rowEnd))
                                  }}
                                  style={{
                                    position: 'absolute',
                                    bottom: 2,
                                    left: 2,
                                    width: 18,
                                    height: 18,
                                    minWidth: 18,
                                    padding: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: 0.9,
                                    fontSize: 10,
                                  }}
                                />
                              </Tooltip>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                <Space wrap style={{ marginTop: 16 }} align="center">
                  <Button type="primary" loading={loading} onClick={runImagesToSingle} disabled={combineFiles.length === 0}>
                    {loading ? t('imagesToSingleCombining') : t('imagesToSingleCombine')}
                  </Button>
                  {combinedUrl && (
                    <>
                      <Button icon={<DownloadOutlined />} onClick={downloadCombined}>
                        {t('imagesToSingleDownload')}
                      </Button>
                      {combinedParams && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {t('imagesToSingleParams', {
                            cols: combinedParams.cols,
                            rows: combinedParams.rows,
                            w: combinedParams.outW,
                            h: combinedParams.outH,
                            t: combinedParams.cropTop,
                            b: combinedParams.cropBottom,
                            l: combinedParams.cropLeft,
                            r: combinedParams.cropRight,
                          })}
                        </Text>
                      )}
                    </>
                  )}
                </Space>
                {combinedUrl && (
                  <>
                    <Text strong style={{ display: 'block', marginTop: 24, marginBottom: 8 }}>{t('imgPreview')}</Text>
                    <div
                      style={{
                        padding: 16,
                        background: 'repeating-conic-gradient(#c9bfb0 0% 25%, #e4dbcf 0% 50%) 50% / 16px 16px',
                        borderRadius: 8,
                        border: '1px solid #9a8b78',
                        display: 'inline-block',
                      }}
                    >
                      <StashableImage
                        src={combinedUrl}
                        alt={t('imgPreview')}
                        style={{ maxWidth: '100%', maxHeight: 400, display: 'block', imageRendering: 'pixelated' }}
                      />
                    </div>
                  </>
                )}
              </>
            ),
          },
          {
            key: 'simpleStitch',
            label: (
              <span>
                <LayoutOutlined /> {t('simpleStitch')}
              </span>
            ),
            children: (
              <>
                <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>{t('simpleStitchHint')}</Text>
                <Space wrap align="center" style={{ marginBottom: 12 }}>
                  <Text type="secondary">{t('simpleStitchDirection')}:</Text>
                  <Radio.Group
                    value={stitchDirection}
                    onChange={(e) => setStitchDirection(e.target.value)}
                    optionType="button"
                    size="small"
                  >
                    <Radio.Button value="vertical">{t('simpleStitchVertical')}</Radio.Button>
                    <Radio.Button value="horizontal">{t('simpleStitchHorizontal')}</Radio.Button>
                    <Radio.Button value="overlay">{t('simpleStitchOverlay')}</Radio.Button>
                  </Radio.Group>
                </Space>
                <StashDropZone onStashDrop={(f) => setStitchFiles((prev) => [...prev, f])}>
                  <Dragger
                    accept={IMAGE_ACCEPT.join(',')}
                    multiple
                    fileList={stitchFiles.map((f, i) => ({ uid: `s-${i}`, name: f.name } as UploadFile))}
                    beforeUpload={(f) => {
                      setStitchFiles((prev) => [...prev, f])
                      return false
                    }}
                    onRemove={(file) => {
                      const idx = stitchFiles.findIndex((_, i) => `s-${i}` === file.uid)
                      if (idx >= 0) setStitchFiles((prev) => prev.filter((_, i) => i !== idx))
                    }}
                  >
                    <p className="ant-upload-text">{t('simpleStitchUploadHint')}</p>
                  </Dragger>
                </StashDropZone>
                {stitchInputUrls.length > 0 && (
                  <>
                    <Text strong style={{ display: 'block', marginTop: 16, marginBottom: 8 }}>{t('imgOriginalPreview')}</Text>
                    <div
                      style={{
                        padding: 16,
                        background: 'repeating-conic-gradient(#c9bfb0 0% 25%, #e4dbcf 0% 50%) 50% / 16px 16px',
                        borderRadius: 8,
                        border: '1px solid #9a8b78',
                        display: 'inline-block',
                      }}
                    >
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 200, overflow: 'auto' }}>
                        {stitchInputUrls.map((url, i) => (
                          <StashableImage
                            key={i}
                            src={url}
                            alt={`${t('frame')} ${i + 1}`}
                            style={{ maxWidth: 80, maxHeight: 80, objectFit: 'contain', border: '1px solid rgba(0,0,0,0.1)' }}
                          />
                        ))}
                      </div>
                    </div>
                  </>
                )}
                <Space style={{ marginTop: 16 }}>
                  <Button type="primary" loading={loading} onClick={runSimpleStitch} disabled={stitchFiles.length === 0}>
                    {t('simpleStitchRun')}
                  </Button>
                  {stitchResultUrl && (
                    <Button icon={<DownloadOutlined />} onClick={downloadStitch}>
                      {t('simpleStitchDownload')}
                    </Button>
                  )}
                </Space>
                {stitchResultUrl && (
                  <>
                    <Text strong style={{ display: 'block', marginTop: 24, marginBottom: 8 }}>{t('imgPreview')}</Text>
                    <div
                      style={{
                        padding: 16,
                        background: 'repeating-conic-gradient(#c9bfb0 0% 25%, #e4dbcf 0% 50%) 50% / 16px 16px',
                        borderRadius: 8,
                        border: '1px solid #9a8b78',
                        display: 'inline-block',
                      }}
                    >
                      <StashableImage
                        src={stitchResultUrl}
                        alt={t('imgPreview')}
                        style={{ maxWidth: '100%', maxHeight: 400, display: 'block', imageRendering: 'pixelated' }}
                      />
                    </div>
                  </>
                )}
              </>
            ),
          },
        ]}
      />
    </Space>
  )
}
