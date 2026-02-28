import { useEffect, useRef, useState } from 'react'
import { Button, InputNumber, message, Slider, Space, Tabs, Typography, Upload } from 'antd'
import { DownloadOutlined, ExportOutlined, ScissorOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
// @ts-expect-error gifenc has no types
import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import JSZip from 'jszip'
import { useLanguage } from '../i18n/context'

const { Dragger } = Upload
const { Text } = Typography

const IMAGE_ACCEPT = ['.png', '.jpg', '.jpeg', '.webp']

function splitSpriteSheet(
  img: HTMLImageElement,
  cols: number,
  rows: number
): { canvas: HTMLCanvasElement; count: number }[] {
  const fullW = img.naturalWidth
  const fullH = img.naturalHeight
  const colsNum = Math.max(1, Math.floor(cols))
  const rowsNum = Math.max(1, Math.floor(rows))
  const results: { canvas: HTMLCanvasElement; count: number }[] = []

  let idx = 0
  for (let row = 0; row < rowsNum; row++) {
    for (let col = 0; col < colsNum; col++) {
      const sx = Math.floor((col * fullW) / colsNum)
      const ex = Math.floor(((col + 1) * fullW) / colsNum)
      const sy = Math.floor((row * fullH) / rowsNum)
      const ey = Math.floor(((row + 1) * fullH) / rowsNum)
      const w = Math.max(1, ex - sx)
      const h = Math.max(1, ey - sy)
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      c.getContext('2d')!.drawImage(img, sx, sy, w, h, 0, 0, w, h)
      results.push({ canvas: c, count: idx })
      idx++
    }
  }
  return results
}

export default function SpriteSheetTool() {
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState<'split' | 'togif'>('split')
  const [spriteFile, setSpriteFile] = useState<File | null>(null)
  const [spritePreviewUrl, setSpritePreviewUrl] = useState<string | null>(null)
  const [columns, setColumns] = useState(8)
  const [rows, setRows] = useState(4)
  const [frameDelay, setFrameDelay] = useState(100)
  const [loading, setLoading] = useState(false)
  const [zipUrl, setZipUrl] = useState<string | null>(null)
  const [framePreviewUrls, setFramePreviewUrls] = useState<string[]>([])
  const [gifUrls, setGifUrls] = useState<{ url: string; rowIndex: number }[]>([])
  const [gifZipUrl, setGifZipUrl] = useState<string | null>(null)
  const gifUrlsRef = useRef<{ url: string; rowIndex: number }[]>([])
  const gifZipUrlRef = useRef<string | null>(null)

  useEffect(() => {
    gifUrlsRef.current = gifUrls
    gifZipUrlRef.current = gifZipUrl
  }, [gifUrls, gifZipUrl])

  const revokePreviews = () => {
    setFramePreviewUrls((urls) => {
      urls.forEach(URL.revokeObjectURL)
      return []
    })
  }

  useEffect(() => {
    if (spriteFile) {
      const url = URL.createObjectURL(spriteFile)
      setSpritePreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    setSpritePreviewUrl(null)
  }, [spriteFile])

  useEffect(() => () => revokePreviews(), [])

  useEffect(
    () => () => {
      gifUrlsRef.current.forEach((g) => URL.revokeObjectURL(g.url))
      if (gifZipUrlRef.current) URL.revokeObjectURL(gifZipUrlRef.current)
    },
    [],
  )

  const runSplit = async () => {
    if (!spriteFile) return
    setLoading(true)
    revokePreviews()
    setZipUrl((old) => {
      if (old) URL.revokeObjectURL(old)
      return null
    })
    try {
      const buf = await spriteFile.arrayBuffer()
      const url = URL.createObjectURL(new Blob([buf]))
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image()
        i.onload = () => res(i)
        i.onerror = () => rej(new Error('load'))
        i.src = url
      })
      URL.revokeObjectURL(url)

      const frames = splitSpriteSheet(img, columns, rows)
      const zip = new JSZip()
      const previewUrls: string[] = []
      const maxPreview = 24
      for (let i = 0; i < frames.length; i++) {
        const blob = await new Promise<Blob>((resolve, reject) => {
          frames[i].canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('blob'))), 'image/png')
        })
        zip.file(`frame_${String(i).padStart(3, '0')}.png`, blob)
        if (previewUrls.length < maxPreview) {
          previewUrls.push(URL.createObjectURL(blob))
        }
      }
      setFramePreviewUrls(previewUrls)
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      setZipUrl(URL.createObjectURL(zipBlob))
      message.success(t('spriteSplitSuccess', { n: frames.length }))
    } catch (e) {
      message.error(t('spriteSplitFailed') + ': ' + String(e))
    } finally {
      setLoading(false)
    }
  }

  const runToGif = async () => {
    if (!spriteFile) return
    setLoading(true)
    setGifUrls((prev) => {
      prev.forEach((g) => URL.revokeObjectURL(g.url))
      return []
    })
    setGifZipUrl((old) => {
      if (old) URL.revokeObjectURL(old)
      return null
    })
    try {
      const buf = await spriteFile.arrayBuffer()
      const url = URL.createObjectURL(new Blob([buf]))
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image()
        i.onload = () => res(i)
        i.onerror = () => rej(new Error('load'))
        i.src = url
      })
      URL.revokeObjectURL(url)

      const frames = splitSpriteSheet(img, columns, rows)
      const colsNum = Math.max(1, Math.floor(columns))
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      const allImgs: ImageData[] = []
      for (const { canvas: c } of frames) {
        canvas.width = c.width
        canvas.height = c.height
        ctx.drawImage(c, 0, 0)
        allImgs.push(ctx.getImageData(0, 0, c.width, c.height))
      }

      const rowCount = Math.ceil(allImgs.length / colsNum)
      const newGifUrls: { url: string; rowIndex: number }[] = []
      const gifBlobs: Blob[] = []

      for (let rowIdx = 0; rowIdx < rowCount; rowIdx++) {
        const start = rowIdx * colsNum
        const rowImgs = allImgs.slice(start, start + colsNum)
        if (rowImgs.length === 0) continue

        const maxW = Math.max(...rowImgs.map((m) => m.width))
        const maxH = Math.max(...rowImgs.map((m) => m.height))
        const normalizeToMax = (im: ImageData): ImageData => {
          if (im.width === maxW && im.height === maxH) return im
          const out = new ImageData(maxW, maxH)
          out.data.fill(0)
          for (let y = 0; y < im.height; y++) {
            for (let x = 0; x < im.width; x++) {
              const src = (y * im.width + x) * 4
              const dst = (y * maxW + x) * 4
              out.data[dst] = im.data[src]!
              out.data[dst + 1] = im.data[src + 1]!
              out.data[dst + 2] = im.data[src + 2]!
              out.data[dst + 3] = im.data[src + 3]!
            }
          }
          return out
        }

        const gif = GIFEncoder()
        for (let i = 0; i < rowImgs.length; i++) {
          const { data } = normalizeToMax(rowImgs[i]!)
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
              if (data[j + 3]! < 128) {
                finalIndex[j / 4] = 0
              } else {
                finalIndex[j / 4] = index[j / 4]! + 1
              }
            }
            transparentIndex = 0
          }
          gif.writeFrame(finalIndex, maxW, maxH, {
            palette: finalPalette,
            delay: frameDelay,
            transparent: true,
            transparentIndex,
          })
        }
        gif.finish()
        const blob = new Blob([gif.bytes()], { type: 'image/gif' })
        gifBlobs.push(blob)
        newGifUrls.push({ url: URL.createObjectURL(blob), rowIndex: rowIdx + 1 })
      }

      setGifUrls(newGifUrls)

      const zip = new JSZip()
      for (let i = 0; i < gifBlobs.length; i++) {
        zip.file(`row_${String(i + 1).padStart(2, '0')}.gif`, gifBlobs[i]!)
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      setGifZipUrl(URL.createObjectURL(zipBlob))
      message.success(t('spriteToGifSuccess'))
    } catch (e) {
      message.error(t('spriteToGifFailed') + ': ' + String(e))
    } finally {
      setLoading(false)
    }
  }

  const downloadZip = () => {
    if (!zipUrl) return
    const a = document.createElement('a')
    a.href = zipUrl
    a.download = (spriteFile?.name?.replace(/\.[^.]+$/, '') || 'frames') + '_frames.zip'
    a.click()
  }

  const downloadGif = (url: string, rowIndex: number) => {
    const a = document.createElement('a')
    a.href = url
    a.download = (spriteFile?.name?.replace(/\.[^.]+$/, '') || 'sprite') + `_row${rowIndex}.gif`
    a.click()
  }

  const downloadAllGifs = () => {
    if (!gifZipUrl) return
    const a = document.createElement('a')
    a.href = gifZipUrl
    a.download = (spriteFile?.name?.replace(/\.[^.]+$/, '') || 'sprite') + '_rows.zip'
    a.click()
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%', paddingTop: 8 }}>
      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as 'split' | 'togif')}
        items={[
          {
            key: 'split',
            label: (
              <span>
                <ScissorOutlined /> {t('spriteSplit')}
              </span>
            ),
            children: (
              <>
                <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>{t('spriteSplitHint')}</Text>
                <Space wrap style={{ marginBottom: 8 }}>
                  <span>
                    <Text type="secondary">{t('spriteColumns')}:</Text>
                    <InputNumber min={1} max={64} value={columns} onChange={(v) => setColumns(v ?? 8)} style={{ width: 80, marginLeft: 8 }} />
                  </span>
                  <span>
                    <Text type="secondary">{t('spriteRows')}:</Text>
                    <InputNumber min={1} max={64} value={rows} onChange={(v) => setRows(v ?? 4)} style={{ width: 80, marginLeft: 8 }} />
                  </span>
                </Space>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>{t('spriteColumnsHint')} / {t('spriteRowsHint')}</Text>
                <Dragger
                  accept={IMAGE_ACCEPT.join(',')}
                  maxCount={1}
                  fileList={spriteFile ? [{ uid: '1', name: spriteFile.name } as UploadFile] : []}
                  beforeUpload={(f) => {
                    setSpriteFile(f)
                    revokePreviews()
                    setZipUrl((old) => {
                      if (old) URL.revokeObjectURL(old)
                      return null
                    })
                    return false
                  }}
                  onRemove={() => setSpriteFile(null)}
                >
                  <p className="ant-upload-text">{t('spriteUploadHint')}</p>
                </Dragger>
                {spriteFile && spritePreviewUrl && (
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
                      <img src={spritePreviewUrl} alt="" style={{ maxWidth: 320, maxHeight: 240, display: 'block', imageRendering: 'pixelated' }} />
                    </div>
                  </>
                )}
                <Space style={{ marginTop: 16 }}>
                  <Button type="primary" loading={loading} onClick={runSplit} disabled={!spriteFile}>
                    {t('spriteSplit')}
                  </Button>
                  {zipUrl && (
                    <Button icon={<DownloadOutlined />} onClick={downloadZip}>
                      {t('gifDownloadFrames')}
                    </Button>
                  )}
                </Space>
                {framePreviewUrls.length > 0 && (
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
                        {framePreviewUrls.map((url, i) => (
                          <img key={i} src={url} alt={`${t('frame')} ${i + 1}`} style={{ maxWidth: 80, maxHeight: 80, imageRendering: 'pixelated', border: '1px solid rgba(0,0,0,0.1)' }} />
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            ),
          },
          {
            key: 'togif',
            label: (
              <span>
                <ExportOutlined /> {t('spriteToGif')}
              </span>
            ),
            children: (
              <>
                <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>{t('spriteToGifHint')}</Text>
                <Space wrap style={{ marginBottom: 8 }}>
                  <span>
                    <Text type="secondary">{t('spriteColumns')}:</Text>
                    <InputNumber min={1} max={64} value={columns} onChange={(v) => setColumns(v ?? 8)} style={{ width: 80, marginLeft: 8 }} />
                  </span>
                  <span>
                    <Text type="secondary">{t('spriteRows')}:</Text>
                    <InputNumber min={1} max={64} value={rows} onChange={(v) => setRows(v ?? 4)} style={{ width: 80, marginLeft: 8 }} />
                  </span>
                </Space>
                <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>{t('gifFrameDelay')}:</Text>
                <Slider min={20} max={500} value={frameDelay} onChange={setFrameDelay} style={{ maxWidth: 200, marginBottom: 16 }} />
                <Text type="secondary" style={{ fontSize: 12 }}>{frameDelay} ms</Text>
                <Dragger
                  accept={IMAGE_ACCEPT.join(',')}
                  maxCount={1}
                  fileList={spriteFile ? [{ uid: '1', name: spriteFile.name } as UploadFile] : []}
                  beforeUpload={(f) => {
                    setSpriteFile(f)
                    setGifUrls((prev) => {
                      prev.forEach((g) => URL.revokeObjectURL(g.url))
                      return []
                    })
                    setGifZipUrl((old) => {
                      if (old) URL.revokeObjectURL(old)
                      return null
                    })
                    return false
                  }}
                  onRemove={() => setSpriteFile(null)}
                  style={{ marginTop: 16 }}
                >
                  <p className="ant-upload-text">{t('spriteUploadHint')}</p>
                </Dragger>
                {spriteFile && spritePreviewUrl && (
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
                      <img src={spritePreviewUrl} alt="" style={{ maxWidth: 320, maxHeight: 240, display: 'block', imageRendering: 'pixelated' }} />
                    </div>
                  </>
                )}
                <Space style={{ marginTop: 16 }} wrap>
                  <Button type="primary" loading={loading} onClick={runToGif} disabled={!spriteFile}>
                    {t('spriteToGif')}
                  </Button>
                  {gifZipUrl && (
                    <Button icon={<DownloadOutlined />} onClick={downloadAllGifs}>
                      {t('spriteDownloadAllGif')}
                    </Button>
                  )}
                </Space>
                {gifUrls.length > 0 && (
                  <>
                    <Text strong style={{ display: 'block', marginTop: 24, marginBottom: 8 }}>{t('imgPreview')}</Text>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {gifUrls.map(({ url, rowIndex }) => (
                        <div
                          key={rowIndex}
                          style={{
                            padding: 16,
                            background: 'repeating-conic-gradient(#c9bfb0 0% 25%, #e4dbcf 0% 50%) 50% / 16px 16px',
                            borderRadius: 8,
                            border: '1px solid #9a8b78',
                            display: 'inline-block',
                            alignSelf: 'flex-start',
                          }}
                        >
                          <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>{t('spriteRowN', { n: rowIndex })}</Text>
                          <img src={url} alt="" style={{ maxWidth: '100%', maxHeight: 200, display: 'block', imageRendering: 'auto' }} />
                          <Button
                            size="small"
                            icon={<DownloadOutlined />}
                            onClick={() => downloadGif(url, rowIndex)}
                            style={{ marginTop: 8 }}
                          >
                            {t('gifDownloadGif')}
                          </Button>
                        </div>
                      ))}
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
