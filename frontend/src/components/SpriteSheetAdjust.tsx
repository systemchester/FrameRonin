import { useEffect, useRef, useState } from 'react'
import { Checkbox, ColorPicker, InputNumber, Segmented, Slider, Space, Typography, Upload } from 'antd'
import { ArrowDownOutlined, ArrowLeftOutlined, ArrowRightOutlined, ArrowUpOutlined, MinusOutlined, PlusOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import { useLanguage } from '../i18n/context'
import StashDropZone from './StashDropZone'

const { Dragger } = Upload
const { Text } = Typography

const IMAGE_ACCEPT = ['.png', '.jpg', '.jpeg', '.webp']
const IMAGE_MAX_MB = 20

type FrameOffset = { dx: number; dy: number }

function ShiftedFrameCanvas({
  src,
  dx,
  dy,
  displayWidth,
  displayHeight,
  onSize,
  style,
}: {
  src: string
  dx: number
  dy: number
  displayWidth?: number
  displayHeight?: number
  onSize?: (w: number, h: number) => void
  style?: React.CSSProperties
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      const canvas = canvasRef.current
      if (!canvas || !img.naturalWidth || !img.naturalHeight) return
      const w = img.naturalWidth
      const h = img.naturalHeight
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h, dx, dy, w, h)
      onSize?.(w, h)
    }
    img.src = src
    return () => {
      img.src = ''
    }
  }, [src, dx, dy, onSize])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: displayWidth ? `${displayWidth}px` : '100%',
        height: displayHeight ? `${displayHeight}px` : '100%',
        maxWidth: '100%',
        maxHeight: '100%',
        minWidth: 0,
        minHeight: 0,
        objectFit: 'contain',
        imageRendering: 'pixelated',
        display: 'block',
        ...style,
      }}
    />
  )
}

function splitSpriteSheet(
  img: HTMLImageElement,
  cols: number,
  rows: number
): HTMLCanvasElement[] {
  const fullW = img.naturalWidth
  const fullH = img.naturalHeight
  const colsNum = Math.max(1, Math.floor(cols))
  const rowsNum = Math.max(1, Math.floor(rows))
  const results: HTMLCanvasElement[] = []

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
      results.push(c)
    }
  }
  return results
}

async function recombineFrames(
  frameUrls: string[],
  frameOffsets: FrameOffset[],
  cols: number,
  rows: number
): Promise<string> {
  if (frameUrls.length === 0) throw new Error('No frames')
  const firstImg = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load frame'))
    img.src = frameUrls[0]!
  })
  const cellW = firstImg.naturalWidth
  const cellH = firstImg.naturalHeight
  const outW = cellW * cols
  const outH = cellH * rows
  const out = document.createElement('canvas')
  out.width = outW
  out.height = outH
  const ctx = out.getContext('2d')!
  for (let i = 0; i < frameUrls.length; i++) {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image()
      im.onload = () => resolve(im)
      im.onerror = () => reject(new Error('Failed to load frame'))
      im.src = frameUrls[i]!
    })
    const r = Math.floor(i / cols)
    const c = i % cols
    const dx = frameOffsets[i]?.dx ?? 0
    const dy = frameOffsets[i]?.dy ?? 0
    const tmp = document.createElement('canvas')
    tmp.width = cellW
    tmp.height = cellH
    const tctx = tmp.getContext('2d')!
    tctx.drawImage(img, 0, 0, cellW, cellH, dx, dy, cellW, cellH)
    ctx.drawImage(tmp, 0, 0, cellW, cellH, c * cellW, r * cellH, cellW, cellH)
  }
  return new Promise((resolve, reject) => {
    out.toBlob((b) => {
      if (b) resolve(URL.createObjectURL(b))
      else reject(new Error('toBlob failed'))
    }, 'image/png')
  })
}

export default function SpriteSheetAdjust() {
  const { t } = useLanguage()
  const [file, setFile] = useState<File | null>(null)
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const [cols, setCols] = useState(8)
  const [rows, setRows] = useState(4)
  const [frameUrls, setFrameUrls] = useState<string[]>([])
  const [selected, setSelected] = useState<boolean[]>([])
  const frameDelay = 100
  const [playing, setPlaying] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [speedScale, setSpeedScale] = useState(1)
  const [previewZoom, setPreviewZoom] = useState(4)
  const [previewImgSize, setPreviewImgSize] = useState<{ w: number; h: number } | null>(null)
  const [previewBg, setPreviewBg] = useState<'checkered' | string>('#e4dbcf')
  const [previewBgColor, setPreviewBgColor] = useState('#e4dbcf')
  const [frameOffsets, setFrameOffsets] = useState<FrameOffset[]>([])

  type PressCountKey = 'up' | 'down' | 'left' | 'right'
  const [framePressCounts, setFramePressCounts] = useState<Record<PressCountKey, number>[]>([])

  const setFrameOffsetAndCount = (idx: number, delta: Partial<FrameOffset>, countKey: PressCountKey) => {
    setFrameOffsets((prev) => {
      const next = [...prev]
      if (!next[idx]) next[idx] = { dx: 0, dy: 0 }
      next[idx] = {
        dx: (next[idx]!.dx ?? 0) + (delta.dx ?? 0),
        dy: (next[idx]!.dy ?? 0) + (delta.dy ?? 0),
      }
      return next
    })
    setFramePressCounts((prev) => {
      const next = [...prev]
      if (!next[idx]) next[idx] = { up: 0, down: 0, left: 0, right: 0 }
      next[idx] = { ...next[idx]!, [countKey]: (next[idx]![countKey] ?? 0) + 1 }
      return next
    })
  }

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file)
      setOriginalUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    setOriginalUrl(null)
    setFrameUrls([])
    setSelected([])
  }, [file])

  useEffect(() => {
    const urls = frameUrls
    return () => urls.forEach(URL.revokeObjectURL)
  }, [frameUrls])

  useEffect(() => {
    if (!originalUrl || !file) return
    const img = new Image()
    img.onload = async () => {
      const canvases = splitSpriteSheet(img, cols, rows)
      const urls = canvases.map((c) => {
        return new Promise<string>((resolve, reject) => {
          c.toBlob((b) => {
            if (b) resolve(URL.createObjectURL(b))
            else reject(new Error('blob'))
          }, 'image/png')
        })
      })
      const resolved = await Promise.all(urls)
      setFrameUrls(resolved)
      setSelected(resolved.map((_, i) => i < 6))
      setCurrentIdx(0)
    }
    img.src = originalUrl
  }, [originalUrl, file, cols, rows])

  useEffect(() => {
    setPreviewImgSize(null)
    setFrameOffsets([])
    setFramePressCounts([])
    setRecombinedUrl(null)
  }, [frameUrls])

  const [recombinedUrl, setRecombinedUrl] = useState<string | null>(null)
  const [recombining, setRecombining] = useState(false)

  const handleRecombine = async () => {
    if (frameUrls.length === 0) return
    setRecombining(true)
    setRecombinedUrl(null)
    try {
      const url = await recombineFrames(frameUrls, frameOffsets, cols, rows)
      setRecombinedUrl(url)
    } finally {
      setRecombining(false)
    }
  }

  const selectedIndices = frameUrls.map((_, i) => i).filter((i) => selected[i])
  const displayIdx = selectedIndices.length > 0 ? selectedIndices[currentIdx % selectedIndices.length] ?? 0 : 0
  const displayUrl = frameUrls[displayIdx]
  const speed = Math.max(50, frameDelay / speedScale)

  useEffect(() => {
    if (!playing || selectedIndices.length === 0) return
    const id = setInterval(() => {
      setCurrentIdx((i) => (i + 1) % selectedIndices.length)
    }, speed)
    return () => clearInterval(id)
  }, [playing, selectedIndices.length, speed])

  const toggleSelect = (idx: number) => {
    setSelected((prev) => {
      const next = [...prev]
      next[idx] = !next[idx]
      return next
    })
  }

  const isRowAllSelected = (r: number) => {
    for (let c = 0; c < cols; c++) {
      if (!selected[r * cols + c]) return false
    }
    return true
  }
  const isColAllSelected = (c: number) => {
    for (let r = 0; r < rows; r++) {
      if (!selected[r * cols + c]) return false
    }
    return true
  }

  const toggleRow = (rowIdx: number) => {
    const r = Math.max(0, Math.min(rowIdx, rows - 1))
    const allSel = isRowAllSelected(r)
    setSelected((prev) => {
      const next = [...prev]
      for (let c = 0; c < cols; c++) next[r * cols + c] = !allSel
      return next
    })
  }

  const shiftBtnStyle: React.CSSProperties = {
    padding: 2,
    minWidth: 20,
    border: '1px solid #9a8b78',
    borderRadius: 2,
    background: '#e4dbcf',
    color: '#3d3428',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
  }

  const toggleCol = (colIdx: number) => {
    const c = Math.max(0, Math.min(colIdx, cols - 1))
    const allSel = isColAllSelected(c)
    setSelected((prev) => {
      const next = [...prev]
      for (let r = 0; r < rows; r++) next[r * cols + c] = !allSel
      return next
    })
  }

  return (
    <div className="sprite-adjust-module">
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Text type="secondary">{t('spriteAdjustHint')}</Text>
      <StashDropZone
        onStashDrop={(f) => setFile(f)}
        maxSizeMB={IMAGE_MAX_MB}
      >
        <Dragger
          accept={IMAGE_ACCEPT.join(',')}
          maxCount={1}
          fileList={file ? [{ uid: '1', name: file.name } as UploadFile] : []}
          beforeUpload={(f) => {
            setFile(f)
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
          <Space wrap align="center">
            <Text type="secondary">{t('spriteColumns')} N:</Text>
            <InputNumber min={1} max={64} value={cols} onChange={(v) => setCols(v ?? 8)} style={{ width: 72 }} />
            <Text type="secondary">{t('spriteRows')} M:</Text>
            <InputNumber min={1} max={64} value={rows} onChange={(v) => setRows(v ?? 4)} style={{ width: 72 }} />
          </Space>
          {frameUrls.length > 0 && (
            <div className="sprite-adjust-recombine" style={{ marginBottom: 20, padding: '16px 20px', background: 'rgba(181,82,51,0.12)', borderRadius: 8, border: '2px solid rgba(181,82,51,0.4)' }}>
              <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 15 }}>{t('spriteAdjustRecombine')}</Text>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
                {t('spriteAdjustRecombineHint')}
              </Text>
              <Space wrap>
                <button
                  type="button"
                  onClick={handleRecombine}
                  disabled={recombining}
                  style={{
                    padding: '10px 24px',
                    border: '1px solid #9a8b78',
                    borderRadius: 4,
                    background: '#b55233',
                    color: '#fff',
                    cursor: recombining ? 'not-allowed' : 'pointer',
                    fontSize: 14,
                    fontWeight: 600,
                    opacity: recombining ? 0.7 : 1,
                  }}
                >
                  {recombining ? t('spriteAdjustRecombining') : t('spriteAdjustRecombineBtn')}
                </button>
                {recombinedUrl && (
                  <a
                    href={recombinedUrl}
                    download="recombined-sprite.png"
                    style={{
                      padding: '10px 24px',
                      border: '1px solid #9a8b78',
                      borderRadius: 4,
                      background: '#e4dbcf',
                      color: '#3d3428',
                      textDecoration: 'none',
                      fontSize: 14,
                      fontWeight: 500,
                    }}
                  >
                    {t('spriteAdjustDownloadRecombined')}
                  </a>
                )}
              </Space>
              {recombinedUrl && (
                <div style={{ marginTop: 12, maxWidth: 480 }}>
                  <img
                    src={recombinedUrl}
                    alt=""
                    style={{ maxWidth: '100%', display: 'block', borderRadius: 6, border: '1px solid #9a8b78', imageRendering: 'pixelated' }}
                  />
                </div>
              )}
            </div>
          )}
          {frameUrls.length > 0 && (
            <>
              <Text strong style={{ display: 'block' }}>{t('spriteAdjustPreview')}</Text>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>{t('spriteAdjustCheckHint')}</Text>
              <div
                className="sprite-adjust-grid sprite-adjust-grid-with-headers"
                style={{
                  display: 'grid',
                  gridTemplateColumns: `22px repeat(${cols}, 1fr)`,
                  gridTemplateRows: `22px repeat(${rows}, 1fr)`,
                  gap: 8,
                  overflow: 'auto',
                  alignItems: 'stretch',
                  justifyItems: 'stretch',
                }}
              >
                <div key="corner" className="sprite-adjust-corner" />
                {Array.from({ length: cols }, (_, c) => (
                  <div key={`col-wrap-${c}`} className="sprite-adjust-header-cell">
                    <Checkbox
                      checked={isColAllSelected(c)}
                      onChange={() => toggleCol(c)}
                      title={t('spriteAdjustSelectCol')}
                    />
                  </div>
                ))}
                {Array.from({ length: rows }, (_, r) => [
                  <div key={`row-wrap-${r}`} className="sprite-adjust-header-cell">
                    <Checkbox
                      checked={isRowAllSelected(r)}
                      onChange={() => toggleRow(r)}
                      title={t('spriteAdjustSelectRow')}
                    />
                  </div>,
                  ...Array.from({ length: cols }, (_, c) => {
                    const i = r * cols + c
                    return (
                      <div
                        key={i}
                        className="sprite-adjust-cell"
                        style={{
                          position: 'relative',
                          display: 'flex',
                          flexDirection: 'row',
                          width: '100%',
                          maxHeight: '100%',
                          minHeight: 0,
                          aspectRatio: '1',
                          border: selected[i] ? '2px solid #b55233' : '1px solid rgba(0,0,0,0.1)',
                          borderRadius: 6,
                          overflow: 'hidden',
                          background: '#e4dbcf',
                          boxSizing: 'border-box',
                        }}
                      >
                        <Checkbox
                          checked={selected[i]}
                          onChange={() => toggleSelect(i)}
                          style={{
                            position: 'absolute',
                            top: 2,
                            left: 2,
                            zIndex: 1,
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                          <ShiftedFrameCanvas
                            src={frameUrls[i]!}
                            dx={frameOffsets[i]?.dx ?? 0}
                            dy={frameOffsets[i]?.dy ?? 0}
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, padding: 2, flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setFrameOffsetAndCount(i, { dy: -1 }, 'up') }}
                              title={t('spriteAdjustShiftUp')}
                              style={shiftBtnStyle}
                            >
                              {(framePressCounts[i]?.up ?? 0) === 0 ? <ArrowUpOutlined style={{ fontSize: 10 }} /> : (framePressCounts[i]?.up ?? 0)}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setFrameOffsetAndCount(i, { dy: 1 }, 'down') }}
                              title={t('spriteAdjustShiftDown')}
                              style={shiftBtnStyle}
                            >
                              {(framePressCounts[i]?.down ?? 0) === 0 ? <ArrowDownOutlined style={{ fontSize: 10 }} /> : (framePressCounts[i]?.down ?? 0)}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setFrameOffsetAndCount(i, { dx: -1 }, 'left') }}
                              title={t('spriteAdjustShiftLeft')}
                              style={shiftBtnStyle}
                            >
                              {(framePressCounts[i]?.left ?? 0) === 0 ? <ArrowLeftOutlined style={{ fontSize: 10 }} /> : (framePressCounts[i]?.left ?? 0)}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setFrameOffsetAndCount(i, { dx: 1 }, 'right') }}
                              title={t('spriteAdjustShiftRight')}
                              style={shiftBtnStyle}
                            >
                              {(framePressCounts[i]?.right ?? 0) === 0 ? <ArrowRightOutlined style={{ fontSize: 10 }} /> : (framePressCounts[i]?.right ?? 0)}
                            </button>
                          </div>
                      </div>
                    )
                  }),
                ])}
              </div>
              <div className="sprite-adjust-recombine" style={{ marginTop: 24 }}>
                <Text strong style={{ display: 'block' }}>{t('spriteAdjustRecombine')}</Text>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
                  {t('spriteAdjustRecombineHint')}
                </Text>
                <Space wrap>
                  <button
                    type="button"
                    onClick={handleRecombine}
                    disabled={recombining}
                    style={{
                      padding: '8px 20px',
                      border: '1px solid #9a8b78',
                      borderRadius: 4,
                      background: '#b55233',
                      color: '#fff',
                      cursor: recombining ? 'not-allowed' : 'pointer',
                      fontSize: 14,
                      fontWeight: 500,
                      opacity: recombining ? 0.7 : 1,
                    }}
                  >
                    {recombining ? t('spriteAdjustRecombining') : t('spriteAdjustRecombineBtn')}
                  </button>
                  {recombinedUrl && (
                    <a
                      href={recombinedUrl}
                      download="recombined-sprite.png"
                      style={{
                        padding: '8px 20px',
                        border: '1px solid #9a8b78',
                        borderRadius: 4,
                        background: '#e4dbcf',
                        color: '#3d3428',
                        textDecoration: 'none',
                        fontSize: 14,
                        fontWeight: 500,
                      }}
                    >
                      {t('spriteAdjustDownloadRecombined')}
                    </a>
                  )}
                </Space>
                {recombinedUrl && (
                  <div style={{ marginTop: 12, maxWidth: 480 }}>
                    <img
                      src={recombinedUrl}
                      alt=""
                      style={{ maxWidth: '100%', display: 'block', borderRadius: 6, border: '1px solid #9a8b78', imageRendering: 'pixelated' }}
                    />
                  </div>
                )}
              </div>
              {selectedIndices.length > 0 && (
                <div className="sprite-adjust-anim" style={{ marginTop: 24 }}>
                  <Text strong style={{ display: 'block' }}>{t('spriteAdjustAnimPreview')}</Text>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
                    {t('frameAnimPreviewHint', { n: selectedIndices.length, idx: (currentIdx % selectedIndices.length) + 1 })}
                  </Text>
                  <Space style={{ marginBottom: 12 }} wrap>
                    <Slider
                      min={0.25}
                      max={4}
                      step={0.25}
                      value={speedScale}
                      onChange={setSpeedScale}
                      style={{ width: 120 }}
                      tooltip={{ formatter: (v) => `${v}×` }}
                    />
                    <Text type="secondary" style={{ fontSize: 12 }}>{speedScale}×</Text>
                    <button
                      type="button"
                      onClick={() => setPlaying((p) => !p)}
                      style={{
                        padding: '6px 16px',
                        border: '1px solid #9a8b78',
                        borderRadius: 4,
                        background: playing ? '#b55233' : '#e4dbcf',
                        color: playing ? '#fff' : '#3d3428',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                    >
                      {playing ? t('pause') : t('play')}
                    </button>
                    <span style={{ marginLeft: 16, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => setPreviewZoom((z) => Math.max(1, z - 1))}
                        disabled={previewZoom <= 1}
                        style={{
                          padding: '4px 8px',
                          border: '1px solid #9a8b78',
                          borderRadius: 4,
                          background: '#e4dbcf',
                          color: '#3d3428',
                          cursor: previewZoom <= 1 ? 'not-allowed' : 'pointer',
                          opacity: previewZoom <= 1 ? 0.5 : 1,
                        }}
                      >
                        <MinusOutlined />
                      </button>
                      <Text type="secondary" style={{ fontSize: 12, minWidth: 32, textAlign: 'center' }}>{previewZoom}×</Text>
                      <button
                        type="button"
                        onClick={() => setPreviewZoom((z) => Math.min(8, z + 1))}
                        disabled={previewZoom >= 8}
                        style={{
                          padding: '4px 8px',
                          border: '1px solid #9a8b78',
                          borderRadius: 4,
                          background: '#e4dbcf',
                          color: '#3d3428',
                          cursor: previewZoom >= 8 ? 'not-allowed' : 'pointer',
                          opacity: previewZoom >= 8 ? 0.5 : 1,
                        }}
                      >
                        <PlusOutlined />
                      </button>
                    </span>
                    <span style={{ marginLeft: 16, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>{t('spriteAdjustPreviewBg')}:</Text>
                      <Segmented
                        size="small"
                        value={previewBg === 'checkered' ? 'checkered' : 'solid'}
                        onChange={(v) => setPreviewBg(v === 'solid' ? previewBgColor : 'checkered')}
                        options={[
                          { label: t('spriteAdjustPreviewBgCheckered'), value: 'checkered' },
                          { label: t('spriteAdjustPreviewBgSolid'), value: 'solid' },
                        ]}
                      />
                      {previewBg === 'solid' && (
                        <ColorPicker
                          value={previewBgColor}
                          onChange={(_, hex) => setPreviewBgColor(hex ?? '#e4dbcf')}
                          showText
                          size="small"
                          presets={[
                            { label: '', colors: ['#ffffff', '#e4dbcf', '#c9bfb0', '#808080', '#404040', '#000000'] },
                          ]}
                        />
                      )}
                    </span>
                  </Space>
                  <div
                    className="sprite-adjust-anim-display"
                    style={{
                      padding: 16,
                      background: previewBg === 'checkered'
                        ? 'repeating-conic-gradient(#c9bfb0 0% 25%, #e4dbcf 0% 50%) 50% / 16px 16px'
                        : previewBgColor,
                      borderRadius: 8,
                      border: '1px solid #9a8b78',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                      maxWidth: 480,
                      minHeight: 240,
                      overflow: 'auto',
                    }}
                  >
                    {displayUrl && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '100%', minHeight: '100%' }}>
                        <ShiftedFrameCanvas
                          src={displayUrl}
                          dx={frameOffsets[displayIdx]?.dx ?? 0}
                          dy={frameOffsets[displayIdx]?.dy ?? 0}
                          displayWidth={previewImgSize ? previewImgSize.w * previewZoom : undefined}
                          displayHeight={previewImgSize ? previewImgSize.h * previewZoom : undefined}
                          onSize={(w, h) => setPreviewImgSize({ w, h })}
                          style={{ display: 'block' }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
              {frameUrls.length > 0 && (
                <div className="sprite-adjust-recombine" style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid rgba(154,139,120,0.5)' }}>
                  <Text strong style={{ display: 'block', marginBottom: 4 }}>{t('spriteAdjustRecombine')}</Text>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
                    {t('spriteAdjustRecombineHint')}
                  </Text>
                  <Space wrap>
                    <button
                      type="button"
                      onClick={handleRecombine}
                      disabled={recombining}
                      style={{
                        padding: '8px 20px',
                        border: '1px solid #9a8b78',
                        borderRadius: 4,
                        background: '#b55233',
                        color: '#fff',
                        cursor: recombining ? 'not-allowed' : 'pointer',
                        fontSize: 14,
                        fontWeight: 500,
                        opacity: recombining ? 0.7 : 1,
                      }}
                    >
                      {recombining ? t('spriteAdjustRecombining') : t('spriteAdjustRecombineBtn')}
                    </button>
                    {recombinedUrl && (
                      <a
                        href={recombinedUrl}
                        download="recombined-sprite.png"
                        style={{
                          padding: '8px 20px',
                          border: '1px solid #9a8b78',
                          borderRadius: 4,
                          background: '#e4dbcf',
                          color: '#3d3428',
                          textDecoration: 'none',
                          fontSize: 14,
                          fontWeight: 500,
                        }}
                      >
                        {t('spriteAdjustDownloadRecombined')}
                      </a>
                    )}
                  </Space>
                  {recombinedUrl && (
                    <div style={{ marginTop: 12, maxWidth: 480 }}>
                      <img
                        src={recombinedUrl}
                        alt=""
                        style={{ maxWidth: '100%', display: 'block', borderRadius: 6, border: '1px solid #9a8b78', imageRendering: 'pixelated' }}
                      />
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </Space>
    </div>
  )
}
