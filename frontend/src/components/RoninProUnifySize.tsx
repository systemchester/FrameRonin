import { useEffect, useState } from 'react'
import { Button, InputNumber, message, Select, Space, Typography, Upload } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import type { UploadFile, UploadProps } from 'antd'
import { useLanguage } from '../i18n/context'
import StashableImage from './StashableImage'
import StashDropZone from './StashDropZone'

const { Dragger } = Upload
const { Text } = Typography

const IMAGE_ACCEPT = ['.png', '.jpg', '.jpeg', '.webp']

type UnifyPadH = 'left' | 'center' | 'right'
type UnifyPadV = 'top' | 'center' | 'bottom'

function cellInnerOffset(max: number, img: number, align: 'start' | 'center' | 'end'): number {
  if (align === 'start') return 0
  if (align === 'center') return Math.floor((max - img) / 2)
  return max - img
}

export default function RoninProUnifySize() {
  const { t } = useLanguage()
  const [files, setFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [cols, setCols] = useState(4)
  /** 水平：透明补在另一侧（靠左=右扩，靠右=左扩，居中=两侧） */
  const [padH, setPadH] = useState<UnifyPadH>('center')
  /** 垂直：靠下=默认往上扩透明，靠上=往下扩，居中=上下各半 */
  const [padV, setPadV] = useState<UnifyPadV>('bottom')
  const [dims, setDims] = useState<{ maxW: number; maxH: number } | null>(null)

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f))
    setPreviewUrls(urls)
    return () => urls.forEach(URL.revokeObjectURL)
  }, [files])

  useEffect(() => {
    if (files.length === 0) {
      setDims(null)
      return
    }
    let cancelled = false
    const load = async () => {
      const imgs: HTMLImageElement[] = []
      for (const f of files) {
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
      if (cancelled) return
      const maxW = Math.max(...imgs.map((i) => i.naturalWidth))
      const maxH = Math.max(...imgs.map((i) => i.naturalHeight))
      setDims({ maxW, maxH })
    }
    void load()
    return () => { cancelled = true }
  }, [files])

  useEffect(
    () => () =>
      setResultUrl((old) => {
        if (old) URL.revokeObjectURL(old)
        return null
      }),
    []
  )

  const runUnify = async () => {
    if (files.length === 0) return
    setLoading(true)
    setResultUrl((old) => {
      if (old) URL.revokeObjectURL(old)
      return null
    })
    try {
      const imgs: HTMLImageElement[] = []
      for (const f of files) {
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

      const maxW = Math.max(...imgs.map((i) => i.naturalWidth))
      const maxH = Math.max(...imgs.map((i) => i.naturalHeight))
      const c = Math.max(1, Math.min(64, cols))
      const rows = Math.ceil(imgs.length / c)
      const outW = c * maxW
      const outH = rows * maxH

      const canvas = document.createElement('canvas')
      canvas.width = outW
      canvas.height = outH
      const ctx = canvas.getContext('2d')!
      ctx.imageSmoothingEnabled = false
      ctx.clearRect(0, 0, outW, outH)

      const hAlign: 'start' | 'center' | 'end' =
        padH === 'left' ? 'start' : padH === 'right' ? 'end' : 'center'
      const vAlign: 'start' | 'center' | 'end' =
        padV === 'top' ? 'start' : padV === 'bottom' ? 'end' : 'center'

      for (let i = 0; i < imgs.length; i++) {
        const img = imgs[i]!
        const row = Math.floor(i / c)
        const col = i % c
        const dx = col * maxW + cellInnerOffset(maxW, img.naturalWidth, hAlign)
        const dy = row * maxH + cellInnerOffset(maxH, img.naturalHeight, vAlign)
        ctx.drawImage(
          img,
          0,
          0,
          img.naturalWidth,
          img.naturalHeight,
          dx,
          dy,
          img.naturalWidth,
          img.naturalHeight
        )
      }

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('blob'))), 'image/png', 0.95)
      })
      setResultUrl(URL.createObjectURL(blob))
      message.success(t('roninProUnifySizeSuccess'))
    } catch (e) {
      message.error(t('roninProUnifySizeFailed') + ': ' + String(e))
    } finally {
      setLoading(false)
    }
  }

  /** 用 onChange 的 fileList 顺序同步，避免多文件拖拽时 beforeUpload 逐文件追加导致顺序颠倒 */
  const handleUploadChange: UploadProps['onChange'] = ({ fileList }) => {
    const next: File[] = []
    for (const item of fileList) {
      const o = item.originFileObj
      if (o instanceof File) next.push(o)
    }
    setFiles(next)
  }

  const downloadResult = () => {
    if (!resultUrl) return
    const a = document.createElement('a')
    a.href = resultUrl
    a.download = `unify_${files.length}_images.png`
    a.click()
    message.success(t('downloadStarted'))
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Text type="secondary">{t('roninProUnifySizeHint')}</Text>

      <StashDropZone onStashDrop={(f) => setFiles((prev) => [...prev, f])}>
        <Dragger
          accept={IMAGE_ACCEPT.join(',')}
          multiple
          fileList={files.map(
            (f, i) =>
              ({
                uid: `${f.name}-${f.size}-${f.lastModified}-${i}`,
                name: f.name,
                status: 'done',
                originFileObj: f as UploadFile['originFileObj'],
              }) as UploadFile,
          )}
          beforeUpload={() => false}
          onChange={handleUploadChange}
        >
          <p className="ant-upload-text">{t('roninProUnifySizeUploadHint')}</p>
        </Dragger>
      </StashDropZone>

      {files.length > 0 && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
              <span>
                <Text type="secondary">{t('roninProUnifySizeCols')}:</Text>
                <InputNumber
                  min={1}
                  max={64}
                  value={cols}
                  onChange={(v) => setCols(v ?? 4)}
                  style={{ width: 64, marginLeft: 8 }}
                />
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Text type="secondary">{t('roninProUnifySizePadH')}:</Text>
                <Select<UnifyPadH>
                  value={padH}
                  onChange={setPadH}
                  style={{ width: 120 }}
                  options={[
                    { value: 'left', label: t('roninProUnifySizePadHLeft') },
                    { value: 'center', label: t('roninProUnifySizePadHCenter') },
                    { value: 'right', label: t('roninProUnifySizePadHRight') },
                  ]}
                />
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Text type="secondary">{t('roninProUnifySizePadV')}:</Text>
                <Select<UnifyPadV>
                  value={padV}
                  onChange={setPadV}
                  style={{ width: 120 }}
                  options={[
                    { value: 'top', label: t('roninProUnifySizePadVTop') },
                    { value: 'center', label: t('roninProUnifySizePadVCenter') },
                    { value: 'bottom', label: t('roninProUnifySizePadVBottom') },
                  ]}
                />
              </span>
            </div>
            <Text type="secondary" style={{ fontSize: 12, margin: 0 }}>
              {t('roninProUnifySizePadExplain')}
            </Text>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
            <Button type="primary" loading={loading} onClick={runUnify}>
              {t('roninProUnifySizeRun')}
            </Button>
            {resultUrl && (
              <Button icon={<DownloadOutlined />} onClick={downloadResult}>
                {t('roninProUnifySizeDownload')}
              </Button>
            )}
            </div>
          </div>
          {dims && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('roninProUnifySizeSizeHint', {
                cellW: dims.maxW,
                cellH: dims.maxH,
                outW: Math.max(1, Math.min(64, cols)) * dims.maxW,
                outH: Math.ceil(files.length / Math.max(1, Math.min(64, cols))) * dims.maxH,
              })}
            </Text>
          )}

          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>{t('imgPreview')}</Text>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                maxHeight: 200,
                overflow: 'auto',
                padding: 8,
                background: 'repeating-conic-gradient(#c9bfb0 0% 25%, #e4dbcf 0% 50%) 50% / 16px 16px',
                borderRadius: 8,
                border: '1px solid #9a8b78',
              }}
            >
              {previewUrls.map((url, i) => (
                <div key={i} style={{ position: 'relative', display: 'inline-block' }}>
                  <StashableImage
                    src={url}
                    alt={`${i + 1}`}
                    style={{
                      width: 48,
                      height: 48,
                      objectFit: 'contain',
                      imageRendering: 'pixelated',
                      border: '1px solid rgba(0,0,0,0.2)',
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      left: 2,
                      top: 2,
                      fontSize: 10,
                      fontWeight: 'bold',
                      color: '#fff',
                      textShadow: '0 0 2px #000',
                    }}
                  >
                    {i + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {resultUrl && (
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>{t('roninProUnifySizeResult')}</Text>
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
                  src={resultUrl}
                  alt={t('roninProUnifySizeResult')}
                  style={{ maxWidth: 400, maxHeight: 300, display: 'block', imageRendering: 'pixelated' }}
                />
              </div>
            </div>
          )}
        </>
      )}
    </Space>
  )
}
