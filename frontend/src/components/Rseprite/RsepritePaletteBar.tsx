import type { CSSProperties, MouseEvent } from 'react'
import { Segmented, Typography } from 'antd'
import { useLanguage } from '../../i18n/context'
import { PRESET_PALETTE, rgbaEqual, rgbaToCss } from './palettePresets'
import type { Rgba } from './paintDocument'
import type { RsepriteTool } from './types'

const CHECKER_BG: CSSProperties = {
  backgroundColor: '#6a6a72',
  backgroundImage: `
    linear-gradient(45deg, #909098 25%, transparent 25%),
    linear-gradient(-45deg, #909098 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #909098 75%),
    linear-gradient(-45deg, transparent 75%, #909098 75%)
  `,
  backgroundSize: '8px 8px',
  backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0',
}

export interface RsepritePaletteBarProps {
  tool: RsepriteTool
  onToolChange: (t: RsepriteTool) => void
  primaryColor: Rgba
  secondaryColor: Rgba
  onPrimaryChange: (rgba: Rgba) => void
  onSecondaryChange: (rgba: Rgba) => void
  /** 覆盖默认预设 */
  presets?: readonly Rgba[]
}

function ColorIndicator({
  label,
  rgba,
  active,
}: {
  label: string
  rgba: Rgba
  active?: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
        {label}
      </Typography.Text>
      <div
        style={{
          ...CHECKER_BG,
          width: 36,
          height: 36,
          borderRadius: 6,
          padding: 2,
          boxSizing: 'border-box',
          outline: active ? '2px solid #1677ff' : '1px solid rgba(0,0,0,0.25)',
          outlineOffset: 0,
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 4,
            backgroundColor: rgbaToCss(rgba),
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.12)',
          }}
        />
      </div>
    </div>
  )
}

/**
 * 第 4 步：铅笔/橡皮切换、前色/后色指示、预设色条（Shift+点击预设 = 后色）
 */
export default function RsepritePaletteBar({
  tool,
  onToolChange,
  primaryColor,
  secondaryColor,
  onPrimaryChange,
  onSecondaryChange,
  presets = PRESET_PALETTE,
}: RsepritePaletteBarProps) {
  const { t } = useLanguage()

  const onPresetClick = (e: MouseEvent, rgba: Rgba) => {
    if (e.shiftKey) {
      onSecondaryChange(rgba)
      return
    }
    onPrimaryChange(rgba)
    onToolChange('pencil')
  }

  return (
    <div
      style={{
        padding: '12px 12px 10px',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        background: 'rgba(0,0,0,0.02)',
      }}
    >
      <div style={{ marginBottom: 10 }}>
        <Segmented<RsepriteTool>
          block
          value={tool}
          onChange={(v) => onToolChange(v)}
          options={[
            { label: t('roninProRsepriteToolPencil'), value: 'pencil' },
            { label: t('roninProRsepriteToolEraser'), value: 'eraser' },
          ]}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, marginBottom: 10 }}>
        <ColorIndicator
          label={t('roninProRsepriteColorPrimary')}
          rgba={primaryColor}
          active={tool === 'pencil'}
        />
        <ColorIndicator label={t('roninProRsepriteColorSecondary')} rgba={secondaryColor} />
      </div>

      <Typography.Text type="secondary" style={{ display: 'block', fontSize: 11, marginBottom: 8 }}>
        {t('roninProRsepritePalettePresets')}
      </Typography.Text>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {presets.map((rgba, i) => {
          const isPrimary = rgbaEqual(rgba, primaryColor)
          return (
            <button
              key={i}
              type="button"
              title={t('roninProRsepriteSwatchTitle')}
              onClick={(e) => onPresetClick(e, rgba)}
              style={{
                width: 26,
                height: 26,
                padding: 0,
                border: isPrimary ? '2px solid #1677ff' : '1px solid rgba(0,0,0,0.2)',
                borderRadius: 4,
                cursor: 'pointer',
                background: CHECKER_BG.backgroundColor,
                backgroundImage: CHECKER_BG.backgroundImage,
                backgroundSize: CHECKER_BG.backgroundSize,
                backgroundPosition: CHECKER_BG.backgroundPosition,
                boxSizing: 'border-box',
              }}
            >
              <span
                style={{
                  display: 'block',
                  width: '100%',
                  height: '100%',
                  borderRadius: 2,
                  backgroundColor: rgbaToCss(rgba),
                }}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
