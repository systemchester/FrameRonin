import {
  EyeInvisibleOutlined,
  EyeOutlined,
  LockOutlined,
  UnlockOutlined,
} from '@ant-design/icons'
import { Button, Typography } from 'antd'
import { useLanguage } from '../../i18n/context'
import type { Layer } from './types'

export interface RsepriteLayerPanelProps {
  layers: readonly Layer[]
  activeLayerIndex: number
  onSelectLayer: (index: number) => void
  onToggleVisible: (index: number, visible: boolean) => void
  onToggleLocked: (index: number, locked: boolean) => void
}

/**
 * 第 6 步：图层列表（自上而下展示 = 上层在前），选中 / 显示 / 锁定
 */
export default function RsepriteLayerPanel({
  layers,
  activeLayerIndex,
  onSelectLayer,
  onToggleVisible,
  onToggleLocked,
}: RsepriteLayerPanelProps) {
  const { t } = useLanguage()
  const indices = [...layers.keys()].reverse()

  return (
    <div
      style={{
        padding: '10px 12px',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        background: 'rgba(0,0,0,0.02)',
      }}
    >
      <Typography.Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
        {t('roninProRsepriteLayerPanelTitle')}
      </Typography.Text>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {indices.map((layerIndex) => {
          const layer = layers[layerIndex]!
          const selected = activeLayerIndex === layerIndex
          return (
            <div
              key={layer.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectLayer(layerIndex)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelectLayer(layerIndex)
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                borderRadius: 6,
                cursor: 'pointer',
                outline: selected ? '2px solid #1677ff' : '1px solid rgba(0,0,0,0.08)',
                background: selected ? 'rgba(22,119,255,0.08)' : 'rgba(255,255,255,0.5)',
              }}
            >
              <Button
                type="text"
                size="small"
                icon={layer.visible ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                aria-label={t('roninProRsepriteLayerVisibility')}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleVisible(layerIndex, !layer.visible)
                }}
              />
              <Button
                type="text"
                size="small"
                icon={layer.locked ? <LockOutlined /> : <UnlockOutlined />}
                aria-label={t('roninProRsepriteLayerLock')}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleLocked(layerIndex, !layer.locked)
                }}
              />
              <Typography.Text
                ellipsis
                style={{
                  flex: 1,
                  margin: 0,
                  fontWeight: selected ? 600 : 400,
                  opacity: layer.visible ? 1 : 0.55,
                }}
              >
                {layer.name}
              </Typography.Text>
            </div>
          )
        })}
      </div>
    </div>
  )
}
