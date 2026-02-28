import { useEffect, useState } from 'react'
import { Button, message, Slider, Space, Tabs, Typography, Upload } from 'antd'
import { DownloadOutlined, FileImageOutlined, PictureOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import { parseGIF, decompressFrames } from 'gifuct-js'
// @ts-expect-error gifenc has no types
import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import JSZip from 'jszip'
import { useLanguage } from '../i18n/context'

const { Dragger } = Upload
const { Text } = Typography

const GIF_ACCEPT = '.gif'
const IMAGE_ACCEPT = ['.png', '.jpg', '.jpeg', '.webp']

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
  const [activeTab, setActiveTab] = useState<'gif2frames' | 'frames2gif'>('gif2frames')
  const [gifFile, setGifFile] = useState<File | null>(null)
  const [gifPreviewUrl, setGifPreviewUrl] = useState<string | null>(null)
  const [frameFiles, setFrameFiles] = useState<File[]>([])
  const [frameInputUrls, setFrameInputUrls] = useState<string[]>([])
  const [frameDelay, setFrameDelay] = useState(100)
  const [loading, setLoading] = useState(false)
  const [framesZipUrl, setFramesZipUrl] = useState<string | null>(null)
  const [extractedFrameUrls, setExtractedFrameUrls] = useState<string[]>([])
  const [gifUrl, setGifUrl] = useState<string | null>(null)

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

  const runGifToFrames = async () => {
    if (!gifFile) return
    setLoading(true)
    revokeExtractedPreviews()
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
      const maxPreview = 24
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
        zip.file(`frame_${String(i).padStart(3, '0')}.png`, blob)
        if (previewUrls.length < maxPreview) {
          previewUrls.push(URL.createObjectURL(blob))
        }
      }

      setExtractedFrameUrls(previewUrls)
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

  const downloadGif = () => {
    if (!gifUrl) return
    const a = document.createElement('a')
    a.href = gifUrl
    a.download = 'output.gif'
    a.click()
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%', paddingTop: 8 }}>
      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as 'gif2frames' | 'frames2gif')}
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
                <Dragger
                  accept={GIF_ACCEPT}
                  maxCount={1}
                  fileList={gifFile ? [{ uid: '1', name: gifFile.name } as UploadFile] : []}
                  beforeUpload={(f) => {
                    setGifFile(f)
                    revokeExtractedPreviews()
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
                      <img
                        src={gifPreviewUrl}
                        alt=""
                        style={{ maxWidth: 320, maxHeight: 240, display: 'block' }}
                      />
                    </div>
                  </>
                )}
                <Space style={{ marginTop: 16 }}>
                  <Button type="primary" loading={loading} onClick={runGifToFrames} disabled={!gifFile}>
                    {t('gifToFrames')}
                  </Button>
                  {framesZipUrl && (
                    <Button icon={<DownloadOutlined />} onClick={downloadZip}>
                      {t('gifDownloadFrames')}
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
                          <img
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
                {frameInputUrls.length > 0 && (
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
                        {frameInputUrls.map((url, i) => (
                          <img
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
                      <img
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
        ]}
      />
    </Space>
  )
}
