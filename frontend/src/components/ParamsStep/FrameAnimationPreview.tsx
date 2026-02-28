import { useEffect, useRef, useState } from 'react'
import { CaretLeftOutlined, CaretRightOutlined, PauseOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { Button, Checkbox, InputNumber, Slider, Space, Typography } from 'antd'
import { useLanguage } from '../../i18n/context'

const { Text } = Typography

interface Props {
  frames: { dataUrl: string }[]
  selected: boolean[]
  fps: number
  onRemoveFirstSelected?: () => void
  onAddPrevBeforeFirst?: () => void
  onRemoveLastSelected?: () => void
  onAddNextAfterLast?: () => void
  onRangeSample?: (start: number, end: number, step: number) => void
}

export default function FrameAnimationPreview({
  frames,
  selected,
  fps,
  onRemoveFirstSelected,
  onAddPrevBeforeFirst,
  onRemoveLastSelected,
  onAddNextAfterLast,
  onRangeSample,
}: Props) {
  const { t } = useLanguage()
  const selectedIndices = frames.map((_, i) => i).filter((i) => selected[i])
  const firstSelectedFrameIndex = selectedIndices.length > 0 ? selectedIndices[0]! : -1
  const lastSelectedFrameIndex = selectedIndices.length > 0 ? selectedIndices[selectedIndices.length - 1]! : -1
  const canAddPrev = firstSelectedFrameIndex > 0
  const canAddNext = lastSelectedFrameIndex >= 0 && lastSelectedFrameIndex < frames.length - 1
  const [rangeStart, setRangeStart] = useState(1)
  const [rangeEnd, setRangeEnd] = useState(1)
  const [rangeStep, setRangeStep] = useState(2)
  const [playing, setPlaying] = useState(false)
  const [loop, setLoop] = useState(true)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [speedScale, setSpeedScale] = useState(1)
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  const safeIdx = selectedIndices.length > 0 ? currentIdx % selectedIndices.length : 0
  const displayIndex = selectedIndices[safeIdx] ?? 0
  const currentFrame = frames[displayIndex]
  const baseSpeed = fps <= 12 ? 1000 / fps : 1000 / 12
  const speed = Math.max(50, baseSpeed / speedScale)

  useEffect(() => {
    setCurrentIdx((i) => {
      const max = selectedIndices.length - 1
      return max >= 0 ? Math.min(i, max) : 0
    })
    const n = selectedIndices.length
    setRangeStart(1)
    setRangeEnd(Math.max(1, n))
  }, [selectedIndices.length])

  useEffect(() => {
    if (!playing || selectedIndices.length === 0) return
    const id = setInterval(() => {
      setCurrentIdx((i) => {
        const next = i + 1
        if (next >= selectedIndices.length) {
          if (!loop) setPlaying(false)
          return loop ? 0 : i
        }
        return next
      })
    }, speed)
    intervalRef.current = id
    return () => clearInterval(id)
  }, [playing, selectedIndices.length, loop, speed])

  if (frames.length === 0 || selectedIndices.length === 0) return null

  return (
    <div style={{ marginTop: 16, marginBottom: 16 }}>
      <Text strong style={{ display: 'block', marginBottom: 8 }}>{t('frameAnimPreview')}</Text>
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
        {t('frameAnimPreviewHint', { n: selectedIndices.length, idx: currentIdx + 1 })}
      </Text>
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>{t('previewSpeed')}</Text>
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
      </div>
      <div
        style={{
          background: '#d4c8b8',
          borderRadius: 8,
          padding: 16,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            maxWidth: 480,
            maxHeight: 360,
            margin: '0 auto 12px',
            background: '#ede6dc',
            borderRadius: 4,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {currentFrame && (
            <img
              src={currentFrame.dataUrl}
              alt={`${t('frame')} ${displayIndex + 1}`}
              style={{ maxWidth: '100%', maxHeight: 360, width: 'auto', height: 'auto', objectFit: 'contain', display: 'block' }}
            />
          )}
        </div>
        <div style={{ marginBottom: 4 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('frameNofM', { current: currentIdx + 1, total: selectedIndices.length })}
          </Text>
        </div>
        <Slider
          min={0}
          max={Math.max(0, selectedIndices.length - 1)}
          value={currentIdx}
          onChange={(v) => {
            setCurrentIdx(v)
            setPlaying(false)
          }}
          marks={selectedIndices.length <= 12 ? { 0: '1', [selectedIndices.length - 1]: selectedIndices.length } : undefined}
        />
        <Space style={{ marginTop: 8 }} wrap>
          <Button size="small" onClick={() => { setCurrentIdx(0); setPlaying(false) }}>
            {t('firstFrame')}
          </Button>
          <Button
            size="small"
            icon={<CaretLeftOutlined />}
            onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
          >
            {t('prevFrame')}
          </Button>
          <Button
            size="small"
            icon={<CaretRightOutlined />}
            onClick={() => setCurrentIdx((i) => Math.min(selectedIndices.length - 1, i + 1))}
          >
            {t('nextFrame')}
          </Button>
          <Button size="small" onClick={() => { setCurrentIdx(selectedIndices.length - 1); setPlaying(false) }}>
            {t('lastFrame')}
          </Button>
          <Button
            size="small"
            type="primary"
            icon={playing ? <PauseOutlined /> : <PlayCircleOutlined />}
            onClick={() => setPlaying((v) => !v)}
          >
            {playing ? t('pause') : t('play')}
          </Button>
          <Checkbox checked={loop} onChange={(e) => setLoop(e.target.checked)}>
            {t('loop')}
          </Checkbox>
          {onRemoveFirstSelected && (
            <Button size="small" onClick={onRemoveFirstSelected} disabled={selectedIndices.length === 0}>
              {t('removeFirst')}
            </Button>
          )}
          {onAddPrevBeforeFirst && (
            <Button size="small" onClick={onAddPrevBeforeFirst} disabled={!canAddPrev}>
              {t('addFirst')}
            </Button>
          )}
          {onRemoveLastSelected && (
            <Button size="small" onClick={onRemoveLastSelected} disabled={selectedIndices.length === 0}>
              {t('removeLast')}
            </Button>
          )}
          {onAddNextAfterLast && (
            <Button size="small" onClick={onAddNextAfterLast} disabled={!canAddNext}>
              {t('addNext')}
            </Button>
          )}
        </Space>
        {onRangeSample && selectedIndices.length > 0 && (
          <div style={{ marginTop: 16, padding: 12, background: '#e4dbcf', borderRadius: 8, border: '1px solid #b8a898' }}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>{t('rangeSample')}</Text>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 8 }}>
              {t('rangeSampleHint', { n: selectedIndices.length })}
            </Text>
            <Space wrap align="center">
              <InputNumber
                min={1}
                max={selectedIndices.length}
                value={rangeStart}
                onChange={(v) => setRangeStart(v ?? 1)}
                style={{ width: 80 }}
                addonBefore={t('rangeStart')}
              />
              <InputNumber
                min={1}
                max={selectedIndices.length}
                value={rangeEnd}
                onChange={(v) => setRangeEnd(v ?? selectedIndices.length)}
                style={{ width: 80 }}
                addonBefore={t('rangeEnd')}
              />
              <InputNumber
                min={1}
                max={selectedIndices.length}
                value={rangeStep}
                onChange={(v) => setRangeStep(v ?? 1)}
                style={{ width: 80 }}
                addonBefore={t('rangeEvery')}
                addonAfter={t('rangeStepUnit')}
              />
              <Button
                size="small"
                type="primary"
                onClick={() => {
                  const s = Math.min(rangeStart, rangeEnd)
                  const e = Math.max(rangeStart, rangeEnd)
                  onRangeSample(s, e, Math.max(1, rangeStep))
                }}
              >
                {t('rangeApply')}
              </Button>
            </Space>
          </div>
        )}
      </div>
    </div>
  )
}
