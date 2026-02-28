import { useEffect, useRef, useState } from 'react'
import { Button, InputNumber, message, Slider, Space, Typography, Upload } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import { useLanguage } from '../i18n/context'

const { Dragger } = Upload
const { Text } = Typography

const IMAGE_ACCEPT = ['.png', '.jpg', '.jpeg', '.webp']
const IMAGE_MAX_MB = 20

function pixelateImage(img: HTMLImageElement, pixelSize: number): Promise<Blob> {
  const w = img.naturalWidth
  const h = img.naturalHeight
  const block = Math.max(1, Math.floor(pixelSize))
  const scaledW = Math.max(1, Math.floor(w / block))
  const scaledH = Math.max(1, Math.floor(h / block))

  const small = document.createElement('canvas')
  small.width = scaledW
  small.height = scaledH
  small.getContext('2d')!.drawImage(img, 0, 0, w, h, 0, 0, scaledW, scaledH)

  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(small, 0, 0, scaledW, scaledH, 0, 0, w, h)
  return new Promise<Blob>((resolve, reject) => {
    out.toBlob((b) => (b ? resolve(b) : reject(new Error('blob'))), 'image/png')
  })
}

export default function ImagePixelate() {
  const { t } = useLanguage()
  const [file, setFile] = useState<File | null>(null)
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const [pixelSize, setPixelSize] = useState(8)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultBlob, setResultBlob] = useState<Blob | null>(null)
  const [loading, setLoading] = useState(false)
  const urlsRef = useRef({ originalUrl: null as string | null, resultUrl: null as string | null })
  urlsRef.current = { originalUrl, resultUrl }

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file)
      setOriginalUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    setOriginalUrl(null)
  }, [file])

  useEffect(
    () => () => {
      if (urlsRef.current.originalUrl) URL.revokeObjectURL(urlsRef.current.originalUrl)
      if (urlsRef.current.resultUrl) URL.revokeObjectURL(urlsRef.current.resultUrl)
    },
    [],
  )

  const runPixelate = async () => {
    if (!file) return
    setLoading(true)
    setResultUrl((old) => {
      if (old) URL.revokeObjectURL(old)
      return null
    })
    setResultBlob(null)
    try {
      const url = URL.createObjectURL(file)
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image()
        i.onload = () => res(i)
        i.onerror = () => rej(new Error('load'))
        i.src = url
      })
      URL.revokeObjectURL(url)
      const blob = await pixelateImage(img, pixelSize)
      setResultBlob(blob)
      setResultUrl(URL.createObjectURL(blob))
      message.success(t('pixelateSuccess'))
    } catch (e) {
      message.error(t('pixelateFailed') + ': ' + String(e))
    } finally {
      setLoading(false)
    }
  }

  const download = () => {
    if (!resultBlob) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(resultBlob)
    a.download = (file?.name?.replace(/\.[^.]+$/, '') || 'pixelated') + '.png'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Text type="secondary" style={{ display: 'block' }}>{t('pixelateHint')}</Text>
      <div>
        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>{t('pixelateSize')}</Text>
        <Space wrap>
          <Slider
            min={2}
            max={64}
            value={pixelSize}
            onChange={setPixelSize}
            style={{ width: 200, marginRight: 16 }}
          />
          <InputNumber min={2} max={128} value={pixelSize} onChange={(v) => setPixelSize(v ?? 8)} style={{ width: 90 }} />
        </Space>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>{t('pixelateSizeHint')}</Text>
      </div>
      <Dragger
        accept={IMAGE_ACCEPT.join(',')}
        maxCount={1}
        fileList={file ? [{ uid: '1', name: file.name } as UploadFile] : []}
        beforeUpload={(f) => {
          if (f.size > IMAGE_MAX_MB * 1024 * 1024) {
            message.error(t('imageSizeError'))
            return false
          }
          setFile(f)
          setResultUrl((old) => {
            if (old) URL.revokeObjectURL(old)
            return null
          })
          setResultBlob(null)
          return false
        }}
        onRemove={() => setFile(null)}
      >
        <p className="ant-upload-text">{t('imageUploadHint')}</p>
        <p className="ant-upload-hint">{t('imageFormats')}</p>
      </Dragger>
      {file && originalUrl && (
        <>
          <Text strong style={{ display: 'block' }}>{t('imgOriginalPreview')}</Text>
          <div
            style={{
              padding: 16,
              background: 'repeating-conic-gradient(#c9bfb0 0% 25%, #e4dbcf 0% 50%) 50% / 16px 16px',
              borderRadius: 8,
              border: '1px solid #9a8b78',
              display: 'inline-block',
            }}
          >
            <img src={originalUrl} alt="" style={{ maxWidth: 320, maxHeight: 240, display: 'block', imageRendering: 'auto' }} />
          </div>
        </>
      )}
      <Space wrap>
        <Button type="primary" loading={loading} onClick={runPixelate} disabled={!file}>
          {t('pixelateApply')}
        </Button>
        {resultUrl && (
          <Button icon={<DownloadOutlined />} onClick={download}>
            {t('imgDownload')}
          </Button>
        )}
      </Space>
      {resultUrl && (
        <>
          <Text strong style={{ display: 'block' }}>{t('imgPreview')}</Text>
          <div
            style={{
              padding: 16,
              background: 'repeating-conic-gradient(#c9bfb0 0% 25%, #e4dbcf 0% 50%) 50% / 16px 16px',
              borderRadius: 8,
              border: '1px solid #9a8b78',
              display: 'inline-block',
            }}
          >
            <img src={resultUrl} alt="" style={{ maxWidth: '100%', maxHeight: 400, display: 'block', imageRendering: 'pixelated' }} />
          </div>
        </>
      )}
    </Space>
  )
}
