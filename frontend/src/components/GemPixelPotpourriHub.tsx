import { Button, Card, Typography } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useLanguage } from '../i18n/context'
import { GEM_PIXEL_POTPOURRI_HUB_SLOTS } from '../lib/gemPixelUrls'

const { Text, Title } = Typography

const base =
  import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`

function publicAssetUrl(relativePath: string): string {
  const segments = relativePath.split('/').filter(Boolean).map(encodeURIComponent)
  return `${base}${segments.join('/')}`
}

interface GemPixelPotpourriHubProps {
  onBack: () => void
}

export default function GemPixelPotpourriHub({ onBack }: GemPixelPotpourriHubProps) {
  const { t } = useLanguage()

  return (
    <Card>
      <div style={{ marginBottom: 16 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>
          {t('backToHome')}
        </Button>
      </div>
      <Title level={4} style={{ marginTop: 0 }}>
        {t('moduleGemPixelPotpourri')}
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 20, maxWidth: 560 }}>
        {t('gemPixelPotpourriPageHint')}
      </Text>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 12,
          maxWidth: 520,
        }}
      >
        {GEM_PIXEL_POTPOURRI_HUB_SLOTS.map((preset, i) => {
          const n = i + 1
          if (preset) {
            return (
              <div key={n} style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                <Button
                  type="primary"
                  block
                  href={preset.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ minHeight: 40, whiteSpace: 'normal', height: 'auto', lineHeight: 1.25, padding: '8px 12px' }}
                >
                  {t(preset.labelKey)}
                </Button>
                {preset.previewPublicPath ? (
                  <img
                    src={publicAssetUrl(preset.previewPublicPath)}
                    alt=""
                    style={{
                      width: '100%',
                      maxHeight: 128,
                      objectFit: 'contain',
                      imageRendering: 'pixelated',
                      background: 'rgba(0,0,0,0.04)',
                      borderRadius: 4,
                    }}
                  />
                ) : null}
              </div>
            )
          }
          return (
            <Button key={n} type="dashed" disabled block style={{ minHeight: 40, alignSelf: 'start' }}>
              {t('gemPixelPotpourriSlot', { n })}
            </Button>
          )
        })}
      </div>
    </Card>
  )
}
