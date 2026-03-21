import { useEffect, useState } from 'react'
import { Button, Card, Col, Row, Typography } from 'antd'
import {
  ArrowLeftOutlined,
  ExperimentOutlined,
  ExpandOutlined,
  ForkOutlined,
  LockOutlined,
  MergeCellsOutlined,
  ScissorOutlined,
} from '@ant-design/icons'
import { useAuth } from '../auth/context'
import { RONIN_PRO_REQUIRE_NFT } from '../config/features'
import { useNftOwnership } from '../hooks/useNftOwnership'
import { useLanguage } from '../i18n/context'
import RoninProCustomScale from './RoninProCustomScale'
import RoninProCustomSlice from './RoninProCustomSlice'
import RoninProUnifySize from './RoninProUnifySize'
import RoninProAdvancedPixel from './RoninProAdvancedPixel'
import RoninProCustomWorkflow from './RoninProCustomWorkflow'

const ACCENT = '#b55233'
const ICON_BOX = 44

const RONIN_FEATURE_ENTRIES = [
  {
    id: 'customSlice' as const,
    Icon: ScissorOutlined,
    titleKey: 'roninProCustomSlice',
    descKey: 'roninProCustomSliceHint',
  },
  {
    id: 'customScale' as const,
    Icon: ExpandOutlined,
    titleKey: 'roninProCustomScale',
    descKey: 'roninProCustomScaleHint',
  },
  {
    id: 'unifySize' as const,
    Icon: MergeCellsOutlined,
    titleKey: 'roninProUnifySize',
    descKey: 'roninProUnifySizeHint',
  },
  {
    id: 'customWorkflow' as const,
    Icon: ForkOutlined,
    titleKey: 'roninProCustomWorkflow',
    descKey: 'roninProCustomWorkflowHint',
  },
  {
    id: 'advancedPixel' as const,
    Icon: ExperimentOutlined,
    titleKey: 'roninProAdvancedPixel',
    descKey: 'roninProAdvancedPixelCardDesc',
  },
]

interface RoninProProps {
  onBack?: () => void
  /** 外部一次性格子模块（如首页快捷键），进入后由 onDeepLinkConsumed 清空 */
  deepLinkFeature?: string | null
  onDeepLinkConsumed?: () => void
}

export default function RoninPro({ onBack, deepLinkFeature = null, onDeepLinkConsumed }: RoninProProps) {
  const { t } = useLanguage()
  const { address, isConnected } = useAuth()
  const ownsNft = useNftOwnership(RONIN_PRO_REQUIRE_NFT ? address : null)
  const [activeFeature, setActiveFeature] = useState<string | null>(null)

  useEffect(() => {
    if (!deepLinkFeature) return
    setActiveFeature(deepLinkFeature)
    onDeepLinkConsumed?.()
  }, [deepLinkFeature, onDeepLinkConsumed])

  if (!isConnected) {
    return (
      <div style={{ padding: 24 }}>
        {onBack && (
          <div style={{ marginBottom: 16 }}>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>
              {t('backToHome')}
            </Button>
          </div>
        )}
        <div style={{ textAlign: 'center', padding: 48 }}>
          <LockOutlined style={{ fontSize: 48, color: '#b55233', marginBottom: 16 }} />
          <Typography.Title level={4}>{t('roninProRequireLogin')}</Typography.Title>
          <Typography.Text type="secondary">{t('roninProRequireLoginDesc')}</Typography.Text>
        </div>
      </div>
    )
  }

  if (RONIN_PRO_REQUIRE_NFT && ownsNft === false) {
    return (
      <div style={{ padding: 24 }}>
        {onBack && (
          <div style={{ marginBottom: 16 }}>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>
              {t('backToHome')}
            </Button>
          </div>
        )}
        <div style={{ textAlign: 'center', padding: 48 }}>
          <LockOutlined style={{ fontSize: 48, color: '#b55233', marginBottom: 16 }} />
          <Typography.Title level={4}>{t('roninProRequireNft')}</Typography.Title>
          <Typography.Text type="secondary">{t('roninProRequireNftDesc')}</Typography.Text>
        </div>
      </div>
    )
  }

  if (RONIN_PRO_REQUIRE_NFT && ownsNft === null) {
    return (
      <div style={{ padding: 24 }}>
        {onBack && (
          <div style={{ marginBottom: 16 }}>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>
              {t('backToHome')}
            </Button>
          </div>
        )}
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Typography.Text type="secondary">{t('roninProChecking')}</Typography.Text>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px 24px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <div
        style={{
          marginBottom: activeFeature ? 16 : 20,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        {activeFeature ? (
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => setActiveFeature(null)}
          >
            {t('roninProBack')}
          </Button>
        ) : onBack ? (
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>
            {t('backToHome')}
          </Button>
        ) : null}
        <Typography.Title level={4} style={{ margin: 0 }}>
          RoninPro
        </Typography.Title>
      </div>

      {!activeFeature ? (
        <div>
          <Typography.Paragraph
            type="secondary"
            style={{
              marginBottom: 24,
              marginTop: 0,
              fontSize: 14,
              lineHeight: 1.65,
              maxWidth: 720,
            }}
          >
            {t('moduleRoninProDesc')}
          </Typography.Paragraph>
          <Row gutter={[20, 20]}>
            {RONIN_FEATURE_ENTRIES.map(({ id, Icon, titleKey, descKey }) => (
              <Col key={id} xs={24} sm={24} md={12} lg={12}>
                <Card
                  hoverable
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setActiveFeature(id)
                    }
                  }}
                  styles={{
                    body: {
                      padding: '18px 20px',
                      height: '100%',
                    },
                  }}
                  style={{
                    height: '100%',
                    minHeight: 112,
                    borderRadius: 10,
                    transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                  }}
                  onClick={() => setActiveFeature(id)}
                >
                  <div
                    style={{
                      display: 'flex',
                      gap: 16,
                      alignItems: 'flex-start',
                      height: '100%',
                    }}
                  >
                    <div
                      style={{
                        width: ICON_BOX,
                        height: ICON_BOX,
                        borderRadius: 10,
                        background: 'linear-gradient(145deg, rgba(181,82,51,0.14) 0%, rgba(181,82,51,0.06) 100%)',
                        border: '1px solid rgba(181,82,51,0.22)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon style={{ fontSize: 22, color: ACCENT }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Typography.Text
                        strong
                        style={{
                          fontSize: 15,
                          display: 'block',
                          marginBottom: 8,
                          color: 'var(--ant-color-text)',
                        }}
                      >
                        {t(titleKey)}
                      </Typography.Text>
                      <Typography.Text
                        type="secondary"
                        style={{
                          fontSize: 12,
                          lineHeight: 1.6,
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical' as const,
                          overflow: 'hidden',
                        }}
                      >
                        {t(descKey)}
                      </Typography.Text>
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      ) : activeFeature === 'customSlice' ? (
        <RoninProCustomSlice />
      ) : activeFeature === 'customScale' ? (
        <RoninProCustomScale />
      ) : activeFeature === 'unifySize' ? (
        <RoninProUnifySize />
      ) : activeFeature === 'customWorkflow' ? (
        <RoninProCustomWorkflow />
      ) : activeFeature === 'advancedPixel' ? (
        <RoninProAdvancedPixel />
      ) : null}
    </div>
  )
}
