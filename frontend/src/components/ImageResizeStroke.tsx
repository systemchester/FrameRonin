import { useEffect, useRef, useState } from 'react'
import { Button, Col, ColorPicker, Divider, InputNumber, message, Row, Slider, Space, Typography } from 'antd'
import { DownloadOutlined, InboxOutlined } from '@ant-design/icons'
import { Checkbox } from 'antd'
import { Upload } from 'antd'
import type { UploadFile } from 'antd'
import { useLanguage } from '../i18n/context'
import { formatError } from '../i18n/locales'
import {
  applyChromaKey,
  applyInnerStroke,
  cropImageBlob,
  resizeImageToBlob,
} from './ParamsStep/utils'
import ImageCropEditor from './ImageResizeStroke/ImageCropEditor'

const { Dragger } = Upload
const { Text } = Typography

const IMAGE_ALLOWED = ['.png', '.jpg', '.jpeg', '.webp']
const IMAGE_MAX_MB = 20

export default function ImageResizeStroke() {
  const { t } = useLanguage()
  const [file, setFile] = useState<File | null>(null)
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const [originalSize, setOriginalSize] = useState<{ w: number; h: number } | null>(null)
  const [cropRegion, setCropRegion] = useState({ left: 0, top: 0, right: 0, bottom: 0 })
  const [bgColor, setBgColor] = useState('#ffffff')
  const [matteTolerance, setMatteTolerance] = useState(40)
  const [matteFeather, setMatteFeather] = useState(5)
  const [enableMatte, setEnableMatte] = useState(false)
  const [pickingColor, setPickingColor] = useState(false)
  const [mattePreviewUrl, setMattePreviewUrl] = useState<string | null>(null)
  const [matteLoading, setMatteLoading] = useState(false)
  const [targetW, setTargetW] = useState(256)
  const [targetH, setTargetH] = useState(256)
  const [keepAspect, setKeepAspect] = useState(true)
  const [pixelated, setPixelated] = useState(true)
  const [strokeWidth, setStrokeWidth] = useState(0)
  const [strokeColor, setStrokeColor] = useState('#000000')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)
  const [loading, setLoading] = useState(false)

  const croppedW = originalSize ? Math.max(1, originalSize.w - cropRegion.left - cropRegion.right) : 0
  const croppedH = originalSize ? Math.max(1, originalSize.h - cropRegion.top - cropRegion.bottom) : 0
  const aspectRatio = croppedW > 0 && croppedH > 0 ? croppedH / croppedW : 1

  useEffect(() => {
    if (croppedW > 0 && croppedH > 0) {
      setTargetW(croppedW)
      setTargetH(croppedH)
    }
  }, [croppedW, croppedH])

  const handleFile = (f: File | null) => {
    if (originalUrl) URL.revokeObjectURL(originalUrl)
    setFile(f)
    setOriginalUrl(null)
    setOriginalSize(null)
    setMattePreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old)
      return null
    })
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old)
      return null
    })
    setPreviewBlob(null)
    setCropRegion({ left: 0, top: 0, right: 0, bottom: 0 })
    if (f) {
      const url = URL.createObjectURL(f)
      setOriginalUrl(url)
      const img = new Image()
      img.onload = () => {
        setOriginalSize({ w: img.width, h: img.height })
      }
      img.src = url
    }
  }

  const urlsRef = useRef({ originalUrl: null as string | null, previewUrl: null as string | null, mattePreviewUrl: null as string | null })
  urlsRef.current = { originalUrl, previewUrl, mattePreviewUrl }
  useEffect(
    () => () => {
      if (urlsRef.current.originalUrl) URL.revokeObjectURL(urlsRef.current.originalUrl)
      if (urlsRef.current.previewUrl) URL.revokeObjectURL(urlsRef.current.previewUrl)
      if (urlsRef.current.mattePreviewUrl) URL.revokeObjectURL(urlsRef.current.mattePreviewUrl)
    },
    []
  )

  const handlePickColor = (r: number, g: number, b: number) => {
    setBgColor(`#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`)
    setEnableMatte(true)
    setPickingColor(false)
    message.success(t('pickedBgColor', { color: [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('') }))
  }

  const runMattePreview = async () => {
    if (!file || !bgColor) return
    const m = bgColor.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
    if (!m) return
    setMatteLoading(true)
    try {
      let blob = await file.arrayBuffer().then((b) => new Blob([b]))
      blob = await cropImageBlob(blob, cropRegion)
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(r.result as string)
        r.onerror = () => reject(new Error('ERR_IMAGE_LOAD'))
        r.readAsDataURL(blob)
      })
      const bgR = parseInt(m[1], 16)
      const bgG = parseInt(m[2], 16)
      const bgB = parseInt(m[3], 16)
      const { dataUrl: matteDataUrl } = await applyChromaKey(dataUrl, bgR, bgG, bgB, matteTolerance, matteFeather)
      const matteBlob = await fetch(matteDataUrl).then((r) => r.blob())
      setMattePreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old)
        return URL.createObjectURL(matteBlob)
      })
      message.success(t('matteSuccess', { n: 1 }))
    } catch (e) {
      message.error(t('matteFailed') + ': ' + formatError(e, t))
    } finally {
      setMatteLoading(false)
    }
  }

  const handleTargetWChange = (w: number) => {
    setTargetW(w)
    if (keepAspect && aspectRatio > 0) {
      setTargetH(Math.round(w * aspectRatio))
    }
  }

  const handleTargetHChange = (h: number) => {
    setTargetH(h)
    if (keepAspect && aspectRatio > 0) {
      setTargetW(Math.round(h / aspectRatio))
    }
  }

  const applyPreview = async () => {
    if (!file) return
    setLoading(true)
    try {
      let blob = await file.arrayBuffer().then((b) => new Blob([b]))
      blob = await cropImageBlob(blob, cropRegion)
      if (enableMatte && bgColor) {
        const m = bgColor.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
        if (m) {
          const bgR = parseInt(m[1], 16)
          const bgG = parseInt(m[2], 16)
          const bgB = parseInt(m[3], 16)
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const r = new FileReader()
            r.onload = () => resolve(r.result as string)
            r.onerror = () => reject(new Error('ERR_IMAGE_LOAD'))
            r.readAsDataURL(blob)
          })
          const { dataUrl: matteDataUrl } = await applyChromaKey(
            dataUrl,
            bgR,
            bgG,
            bgB,
            matteTolerance,
            matteFeather
          )
          blob = await fetch(matteDataUrl).then((r) => r.blob())
        }
      }
      blob = await resizeImageToBlob(blob, targetW, targetH, keepAspect, pixelated)
      if (strokeWidth > 0) {
        blob = await applyInnerStroke(blob, strokeWidth, strokeColor)
      }
      setPreviewBlob(blob)
      setPreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old)
        return URL.createObjectURL(blob)
      })
      message.success(strokeWidth > 0 ? t('applyStrokeSuccess') : t('imgResizeSuccess'))
    } catch (e) {
      message.error(t('exportFailed') + ': ' + formatError(e, t))
    } finally {
      setLoading(false)
    }
  }

  const download = () => {
    if (!previewBlob) return
    const url = URL.createObjectURL(previewBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = (file?.name?.replace(/\.[^.]+$/, '') || 'output') + '_resized.png'
    a.click()
    URL.revokeObjectURL(url)
    message.success(t('downloadStarted'))
  }

  const hasCrop = cropRegion.left > 0 || cropRegion.top > 0 || cropRegion.right > 0 || cropRegion.bottom > 0

  return (
    <Space direction="vertical" size="large" style={{ width: '100%', paddingTop: 8 }}>
      <Dragger
        name="file"
        multiple={false}
        accept={IMAGE_ALLOWED.join(',')}
        maxCount={1}
        fileList={file ? [{ uid: '1', name: file.name, size: file.size } as UploadFile] : []}
        beforeUpload={(f) => {
          const ext = '.' + (f.name.split('.').pop() || '').toLowerCase()
          if (!IMAGE_ALLOWED.includes(ext)) {
            message.error(t('imageFormatError'))
            return Upload.LIST_IGNORE
          }
          if (f.size > IMAGE_MAX_MB * 1024 * 1024) {
            message.error(t('imageSizeError'))
            return Upload.LIST_IGNORE
          }
          handleFile(f)
          return false
        }}
        onRemove={() => handleFile(null)}
        style={{ padding: 48 }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined style={{ fontSize: 64, color: '#b55233' }} />
        </p>
        <p className="ant-upload-text">{t('imageUploadHint')}</p>
        <p className="ant-upload-hint">{t('imageFormats')}</p>
      </Dragger>

      {file && originalUrl && originalSize && (
        <>
          <Divider style={{ margin: '16px 0' }} />
          <Text strong style={{ display: 'block', marginBottom: 8 }}>{t('imgOriginalPreview')}</Text>
          <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            {t('imgOriginalSize')}: {originalSize.w} × {originalSize.h}
          </Text>
          <Row gutter={24} align="flex-start">
            <Col xs={24} md={14}>
              <ImageCropEditor
                imageUrl={originalUrl}
                imageSize={originalSize}
                cropRegion={cropRegion}
                onChange={setCropRegion}
                onPickColor={handlePickColor}
                pickingColor={pickingColor}
              />
              <Space style={{ marginTop: 8 }} wrap>
                <Button size="small" type={pickingColor ? 'primary' : 'default'} onClick={() => setPickingColor(!pickingColor)}>
                  {t('imgPickColorHint')}
                </Button>
                {hasCrop && (
                  <Button size="small" onClick={() => setCropRegion({ left: 0, top: 0, right: 0, bottom: 0 })}>
                    {t('resetCrop')}
                  </Button>
                )}
              </Space>
            </Col>
            <Col xs={24} md={10}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>{t('imgCropSection')}</Text>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                {t('imgCropHint')}
              </Text>
              <Row gutter={8}>
                <Col span={12}>
                  <InputNumber
                    min={0}
                    max={originalSize.w - 1}
                    value={cropRegion.left}
                    onChange={(v) => setCropRegion((r) => ({ ...r, left: v ?? 0 }))}
                    addonBefore={t('left')}
                    style={{ width: '100%', marginBottom: 8 }}
                  />
                </Col>
                <Col span={12}>
                  <InputNumber
                    min={0}
                    max={originalSize.w - cropRegion.left - 1}
                    value={cropRegion.right}
                    onChange={(v) => setCropRegion((r) => ({ ...r, right: v ?? 0 }))}
                    addonBefore={t('right')}
                    style={{ width: '100%', marginBottom: 8 }}
                  />
                </Col>
                <Col span={12}>
                  <InputNumber
                    min={0}
                    max={originalSize.h - 1}
                    value={cropRegion.top}
                    onChange={(v) => setCropRegion((r) => ({ ...r, top: v ?? 0 }))}
                    addonBefore={t('top')}
                    style={{ width: '100%', marginBottom: 8 }}
                  />
                </Col>
                <Col span={12}>
                  <InputNumber
                    min={0}
                    max={originalSize.h - cropRegion.top - 1}
                    value={cropRegion.bottom}
                    onChange={(v) => setCropRegion((r) => ({ ...r, bottom: v ?? 0 }))}
                    addonBefore={t('bottom')}
                    style={{ width: '100%', marginBottom: 8 }}
                  />
                </Col>
              </Row>
              {hasCrop && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('cropResultSize')}: {croppedW} × {croppedH}
                </Text>
              )}
            </Col>
          </Row>

          <Divider style={{ margin: '20px 0 16px' }} />
          <Text strong style={{ display: 'block', marginBottom: 8 }}>{t('imgMatteSection')}</Text>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            {t('imgMatteHint')}
          </Text>
          <Space wrap align="center">
            <Checkbox checked={enableMatte} onChange={(e) => setEnableMatte(e.target.checked)}>
              {t('imgEnableMatte')}
            </Checkbox>
            <ColorPicker
              value={bgColor}
              onChange={(_: unknown, hex: string) => setBgColor(hex || '#ffffff')}
              showText
            />
            <Text type="secondary">{t('tolerance')}:</Text>
            <Slider min={1} max={100} value={matteTolerance} onChange={setMatteTolerance} style={{ width: 100 }} />
            <Text type="secondary">{t('featherEdge')}:</Text>
            <Slider min={0} max={30} value={matteFeather} onChange={setMatteFeather} style={{ width: 100 }} />
            <Button type="primary" loading={matteLoading} onClick={runMattePreview} disabled={!enableMatte}>
              {t('imgRunMatte')}
            </Button>
          </Space>
          {mattePreviewUrl && (
            <>
              <Text strong style={{ display: 'block', marginTop: 16, marginBottom: 8 }}>{t('imgMattePreview')}</Text>
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
                  src={mattePreviewUrl}
                  alt={t('imgMattePreview')}
                  style={{ maxWidth: '100%', maxHeight: 300, display: 'block', imageRendering: 'pixelated' }}
                />
              </div>
            </>
          )}

          <Divider style={{ margin: '20px 0 16px' }} />
          <Text strong style={{ display: 'block', marginBottom: 12 }}>{t('customSize')}</Text>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            {t('aspectHint')}
          </Text>
          <Space wrap>
            <InputNumber
              min={16}
              max={4096}
              value={targetW}
              onChange={(v) => handleTargetWChange(v ?? 256)}
              addonBefore={t('width')}
              style={{ width: 120 }}
            />
            <InputNumber
              min={16}
              max={4096}
              value={targetH}
              onChange={(v) => handleTargetHChange(v ?? 256)}
              addonBefore={t('height')}
              style={{ width: 120 }}
            />
          </Space>
          <Space style={{ marginTop: 8 }} wrap>
            <Button size="small" type={keepAspect ? 'primary' : 'default'} onClick={() => setKeepAspect(true)}>
              {t('imgKeepAspect')}
            </Button>
            <Button size="small" type={!keepAspect ? 'primary' : 'default'} onClick={() => setKeepAspect(false)}>
              {t('imgStretch')}
            </Button>
            <Checkbox checked={pixelated} onChange={(e) => setPixelated(e.target.checked)}>
              {t('imgPixelated')}
            </Checkbox>
          </Space>

          <Divider style={{ margin: '20px 0 16px' }} />
          <Text strong style={{ display: 'block', marginBottom: 8 }}>{t('imgStrokeSection')}</Text>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            {t('imgStrokeHint')}
          </Text>
          <Space wrap align="center">
            <Text type="secondary">{t('strokeWidth')}:</Text>
            <Slider min={0} max={20} value={strokeWidth} onChange={setStrokeWidth} style={{ width: 120 }} />
            <Text type="secondary">{strokeWidth}</Text>
            <ColorPicker
              value={strokeColor}
              onChange={(_: unknown, hex: string) => setStrokeColor(hex || '#000000')}
              showText
            />
          </Space>

          <Button type="primary" icon={<DownloadOutlined />} onClick={applyPreview} loading={loading}>
            {t('imgApplyPreview')}
          </Button>

          {previewUrl && (
            <>
              <Divider style={{ margin: '24px 0 16px' }} />
              <Text strong style={{ display: 'block', marginBottom: 12 }}>{t('imgPreview')}</Text>
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
                  src={previewUrl}
                  alt={t('imgPreview')}
                  style={{ maxWidth: '100%', maxHeight: 400, display: 'block', imageRendering: 'pixelated' }}
                />
              </div>
              <div style={{ marginTop: 12 }}>
                <Button type="primary" icon={<DownloadOutlined />} onClick={download}>
                  {t('imgDownload')}
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </Space>
  )
}
