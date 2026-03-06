import { useEffect, useRef, useState } from 'react'
import { Button, InputNumber, message, Space, Typography, Upload } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import { useLanguage } from '../i18n/context'
import StashableImage from './StashableImage'
import StashDropZone from './StashDropZone'

const { Dragger } = Upload
const { Text } = Typography

const IMAGE_ACCEPT = ['.png', '.jpg', '.jpeg', '.webp']
const IMAGE_MAX_MB = 20

/**
 * 将图片按 N×M 格子裁切后合并。每个格子从中心裁出 cellW×cellH 像素（不做缩放）。
 * 若格子比目标小，则居中绘制并透明填充。
 */
async function expandShrinkImage(
  img: HTMLImageElement,
  cols: number,
  rows: number,
  cellW: number,
  cellH: number
): Promise<Blob> {
  const fullW = img.naturalWidth
  const fullH = img.naturalHeight
  const colsNum = Math.max(1, Math.floor(cols))
  const rowsNum = Math.max(1, Math.floor(rows))
  const cellSrcW = fullW / colsNum
  const cellSrcH = fullH / rowsNum
  const outW = colsNum * cellW
  const outH = rowsNum * cellH
  const out = document.createElement('canvas')
  out.width = outW
  out.height = outH
  const ctx = out.getContext('2d')!
  for (let row = 0; row < rowsNum; row++) {
    for (let col = 0; col < colsNum; col++) {
      const sx = (col * fullW) / colsNum
      const sy = (row * fullH) / rowsNum
      const cropW = Math.min(cellW, Math.floor(cellSrcW))
      const cropH = Math.min(cellH, Math.floor(cellSrcH))
      const srcX = sx + Math.max(0, (cellSrcW - cropW) / 2)
      const srcY = sy + Math.max(0, (cellSrcH - cropH) / 2)
      const dx = col * cellW + Math.max(0, (cellW - cropW) / 2)
      const dy = row * cellH + Math.max(0, (cellH - cropH) / 2)
      ctx.drawImage(img, srcX, srcY, cropW, cropH, dx, dy, cropW, cropH)
    }
  }
  return new Promise<Blob>((resolve, reject) => {
    out.toBlob((b) => (b ? resolve(b) : reject(new Error('blob'))), 'image/png', 0.95)
  })
}

export default function ImageExpandShrink() {
  const { t } = useLanguage()
  const [file, setFile] = useState<File | null>(null)
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const [cols, setCols] = useState(4)
  const [rows, setRows] = useState(4)
  const [cellW, setCellW] = useState(32)
  const [cellH, setCellH] = useState(32)
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

  const runProcess = async () => {
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
      const blob = await expandShrinkImage(img, cols, rows, cellW, cellH)
      setResultBlob(blob)
      setResultUrl(URL.createObjectURL(blob))
      message.success(t('expandShrinkSuccess'))
    } catch (e) {
      message.error(t('expandShrinkFailed') + ': ' + String(e))
    } finally {
      setLoading(false)
    }
  }

  const download = () => {
    if (!resultBlob) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(resultBlob)
    a.download = (file?.name?.replace(/\.[^.]+$/, '') || 'result') + '_expand_shrink.png'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Text type="secondary" style={{ display: 'block' }}>{t('expandShrinkHint')}</Text>
      <Space wrap>
        <span>
          <Text type="secondary">{t('spriteColumns')} N:</Text>
          <InputNumber min={1} max={64} value={cols} onChange={(v) => setCols(v ?? 4)} style={{ width: 72, marginLeft: 8 }} />
        </span>
        <span>
          <Text type="secondary">{t('spriteRows')} M:</Text>
          <InputNumber min={1} max={64} value={rows} onChange={(v) => setRows(v ?? 4)} style={{ width: 72, marginLeft: 8 }} />
        </span>
        <span>
          <Text type="secondary">{t('expandShrinkCellW')}:</Text>
          <InputNumber min={1} max={512} value={cellW} onChange={(v) => setCellW(v ?? 32)} style={{ width: 72, marginLeft: 8 }} />
        </span>
        <span>
          <Text type="secondary">{t('expandShrinkCellH')}:</Text>
          <InputNumber min={1} max={512} value={cellH} onChange={(v) => setCellH(v ?? 32)} style={{ width: 72, marginLeft: 8 }} />
        </span>
      </Space>
      <Text type="secondary" style={{ fontSize: 12 }}>{t('expandShrinkHintDetail')}</Text>
      <StashDropZone
        onStashDrop={(f) => {
          setFile(f)
          setResultUrl((old) => {
            if (old) URL.revokeObjectURL(old)
            return null
          })
          setResultBlob(null)
        }}
        maxSizeMB={IMAGE_MAX_MB}
        onSizeError={() => message.error(t('imageSizeError'))}
      >
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
      </StashDropZone>
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
        <Button type="primary" loading={loading} onClick={runProcess} disabled={!file}>
          {t('expandShrinkProcess')}
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
            <StashableImage src={resultUrl} alt="" style={{ maxWidth: '100%', maxHeight: 400, display: 'block', imageRendering: 'auto' }} />
          </div>
        </>
      )}
    </Space>
  )
}
