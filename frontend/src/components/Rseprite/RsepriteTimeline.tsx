import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Space, Typography } from 'antd'
import { useEffect, useRef } from 'react'
import { useLanguage } from '../../i18n/context'
import { composeFrameToImageData } from './composeFrame'
import type { Document } from './types'

const THUMB = 44

function FrameThumbnail({
  doc,
  frameIndex,
}: {
  doc: Document
  frameIndex: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const comp = composeFrameToImageData(doc, frameIndex)
    const w = doc.width
    const h = doc.height
    c.width = THUMB
    c.height = THUMB
    const ctx = c.getContext('2d')
    if (!ctx) return
    const tmp = document.createElement('canvas')
    tmp.width = w
    tmp.height = h
    const tctx = tmp.getContext('2d')
    if (!tctx) return
    tctx.putImageData(comp, 0, 0)
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, THUMB, THUMB)
    ctx.fillStyle = '#2a2a2e'
    ctx.fillRect(0, 0, THUMB, THUMB)
    ctx.drawImage(tmp, 0, 0, w, h, 0, 0, THUMB, THUMB)
  }, [doc, frameIndex])

  return (
    <canvas
      ref={ref}
      width={THUMB}
      height={THUMB}
      style={{
        display: 'block',
        imageRendering: 'pixelated',
        borderRadius: 4,
        border: '1px solid rgba(0,0,0,0.15)',
      }}
    />
  )
}

export interface RsepriteTimelineProps {
  doc: Document
  activeFrameIndex: number
  onSelectFrame: (index: number) => void
  onAddFrame: () => void
  onDeleteFrame: (frameIndex: number) => void
}

/**
 * 第 7 步：帧条 — 缩略图、当前帧高亮、增删帧（至少 1 帧）
 */
export default function RsepriteTimeline({
  doc,
  activeFrameIndex,
  onSelectFrame,
  onAddFrame,
  onDeleteFrame,
}: RsepriteTimelineProps) {
  const { t } = useLanguage()
  const n = doc.frames.length
  const canDelete = n > 1

  return (
    <div
      style={{
        padding: '10px 12px',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        background: 'rgba(0,0,0,0.02)',
      }}
    >
      <Typography.Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
        {t('roninProRsepriteTimelineTitle')}
      </Typography.Text>
      <Space wrap align="start" size={8}>
        {doc.frames.map((fr, i) => {
          const active = i === activeFrameIndex
          return (
            <button
              key={fr.id}
              type="button"
              onClick={() => onSelectFrame(i)}
              style={{
                padding: 4,
                borderRadius: 8,
                border: active ? '2px solid #1677ff' : '1px solid rgba(0,0,0,0.12)',
                background: active ? 'rgba(22,119,255,0.08)' : 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
              }}
            >
              <FrameThumbnail doc={doc} frameIndex={i} />
              <Typography.Text
                style={{
                  display: 'block',
                  textAlign: 'center',
                  fontSize: 11,
                  marginTop: 2,
                  fontWeight: active ? 600 : 400,
                }}
              >
                {i + 1}
              </Typography.Text>
            </button>
          )
        })}
        <Space direction="vertical" size={4} style={{ marginLeft: 4 }}>
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={onAddFrame}>
            {t('roninProRsepriteTimelineAdd')}
          </Button>
          <Button
            danger
            size="small"
            icon={<DeleteOutlined />}
            disabled={!canDelete}
            onClick={() => onDeleteFrame(activeFrameIndex)}
          >
            {t('roninProRsepriteTimelineDelete')}
          </Button>
        </Space>
      </Space>
    </div>
  )
}
