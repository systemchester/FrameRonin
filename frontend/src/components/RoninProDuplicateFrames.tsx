import { useEffect, useState } from 'react'
import { Button, InputNumber, message, Space, Typography, Upload } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import { useLanguage } from '../i18n/context'
import { findDuplicateFrameIndexGroups, splitSpriteSheetGrid } from '../lib/spriteGridDuplicate'
import StashableImage from './StashableImage'
import StashDropZone from './StashDropZone'

const { Dragger } = Upload
const { Text } = Typography

const IMAGE_ACCEPT = ['.png', '.jpg', '.jpeg', '.webp']

export default function RoninProDuplicateFrames() {
  const { t } = useLanguage()
  const [spriteFile, setSpriteFile] = useState<File | null>(null)
  const [spritePreviewUrl, setSpritePreviewUrl] = useState<string | null>(null)
  const [columns, setColumns] = useState(8)
  const [rows, setRows] = useState(4)
  const [loading, setLoading] = useState(false)
  const [thumbUrls, setThumbUrls] = useState<string[]>([])
  const [duplicateGroups, setDuplicateGroups] = useState<number[][]>([])

  useEffect(() => {
    if (!spriteFile) {
      setSpritePreviewUrl(null)
      return
    }
    const u = URL.createObjectURL(spriteFile)
    setSpritePreviewUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [spriteFile])

  useEffect(() => {
    return () => {
      thumbUrls.forEach(URL.revokeObjectURL)
    }
  }, [thumbUrls])

  const runAnalyze = async () => {
    if (!spriteFile || !spritePreviewUrl) {
      message.warning(t('roninProDupFramesNeedImage'))
      return
    }
    setLoading(true)
    thumbUrls.forEach(URL.revokeObjectURL)
    setThumbUrls([])
    setDuplicateGroups([])
    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image()
        i.onload = () => res(i)
        i.onerror = () => rej(new Error('load'))
        i.src = spritePreviewUrl
      })

      const c = Math.max(1, Math.min(64, Math.floor(columns)))
      const r = Math.max(1, Math.min(64, Math.floor(rows)))
      const cells = splitSpriteSheetGrid(img, c, r)
      const groups = findDuplicateFrameIndexGroups(cells)

      const urls: string[] = []
      for (const canvas of cells) {
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('blob'))), 'image/png')
        })
        urls.push(URL.createObjectURL(blob))
      }
      setThumbUrls(urls)
      setDuplicateGroups(groups)

      if (groups.length === 0) {
        message.info(t('roninProDupFramesNoDup'))
      } else {
        message.success(
          t('roninProDupFramesFound', { groups: groups.length, frames: cells.length })
        )
      }
    } catch (e) {
      message.error(t('roninProDupFramesFailed') + ': ' + String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Text type="secondary">{t('roninProDupFramesHint')}</Text>

      <StashDropZone onStashDrop={(f) => setSpriteFile(f)}>
        <Dragger
          accept={IMAGE_ACCEPT.join(',')}
          maxCount={1}
          fileList={
            spriteFile
              ? ([{ uid: '1', name: spriteFile.name }] as UploadFile[])
              : []
          }
          beforeUpload={(f) => {
            setSpriteFile(f)
            return false
          }}
          onRemove={() => {
            thumbUrls.forEach(URL.revokeObjectURL)
            setSpriteFile(null)
            setThumbUrls([])
            setDuplicateGroups([])
          }}
        >
          <p className="ant-upload-text">{t('roninProDupFramesUploadHint')}</p>
        </Dragger>
      </StashDropZone>

      {spriteFile && spritePreviewUrl && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
            <span>
              <Text type="secondary">{t('roninProDupFramesCols')}:</Text>
              <InputNumber
                min={1}
                max={64}
                value={columns}
                onChange={(v) => setColumns(v ?? 8)}
                style={{ width: 72, marginLeft: 8 }}
              />
            </span>
            <span>
              <Text type="secondary">{t('roninProDupFramesRows')}:</Text>
              <InputNumber
                min={1}
                max={64}
                value={rows}
                onChange={(v) => setRows(v ?? 4)}
                style={{ width: 72, marginLeft: 8 }}
              />
            </span>
            <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={runAnalyze}>
              {t('roninProDupFramesRun')}
            </Button>
          </div>

          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('roninProDupFramesLogicHint')}
          </Text>

          <div
            style={{
              padding: 12,
              background: 'repeating-conic-gradient(#c9bfb0 0% 25%, #e4dbcf 0% 50%) 50% / 16px 16px',
              borderRadius: 8,
              border: '1px solid #9a8b78',
              display: 'inline-block',
            }}
          >
            <StashableImage
              src={spritePreviewUrl}
              alt=""
              style={{
                maxWidth: 'min(100%, 480px)',
                maxHeight: 280,
                display: 'block',
                imageRendering: 'pixelated',
              }}
            />
          </div>

          {thumbUrls.length > 0 && (
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                {t('roninProDupFramesAllFrames')}
              </Text>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  maxHeight: 220,
                  overflow: 'auto',
                  padding: 8,
                  background: 'repeating-conic-gradient(#c9bfb0 0% 25%, #e4dbcf 0% 50%) 50% / 16px 16px',
                  borderRadius: 8,
                  border: '1px solid #9a8b78',
                }}
              >
                {thumbUrls.map((url, i) => (
                  <div key={i} style={{ position: 'relative', display: 'inline-block' }}>
                    <StashableImage
                      src={url}
                      alt={`${i + 1}`}
                      style={{
                        width: 56,
                        height: 56,
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
          )}

          {duplicateGroups.length > 0 && (
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                {t('roninProDupFramesResultTitle')}
              </Text>
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {duplicateGroups.map((g, gi) => (
                  <div
                    key={gi}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      border: '1px solid var(--ant-color-border-secondary)',
                      background: 'var(--ant-color-fill-quaternary)',
                    }}
                  >
                    <Text style={{ display: 'block', marginBottom: 8 }}>
                      {t('roninProDupFramesGroupLine', {
                        list: g.map((idx) => String(idx + 1)).join(', '),
                      })}
                    </Text>
                    <Space wrap size="small">
                      {g.map((idx) => (
                        <div key={idx} style={{ position: 'relative', display: 'inline-block' }}>
                          {thumbUrls[idx] && (
                            <StashableImage
                              src={thumbUrls[idx]!}
                              alt=""
                              style={{
                                width: 64,
                                height: 64,
                                objectFit: 'contain',
                                imageRendering: 'pixelated',
                                border: '1px solid rgba(0,0,0,0.15)',
                              }}
                            />
                          )}
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
                            {idx + 1}
                          </span>
                        </div>
                      ))}
                    </Space>
                  </div>
                ))}
              </Space>
            </div>
          )}
        </>
      )}
    </Space>
  )
}
