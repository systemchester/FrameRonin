import { Card, Row, Col, Typography } from 'antd'
import { BlockOutlined, FileImageOutlined, PictureOutlined, VideoCameraOutlined, ThunderboltOutlined, BorderOuterOutlined } from '@ant-design/icons'
import { useLanguage } from '../i18n/context'

const { Text } = Typography

const GEM_URL = 'https://gemini.google.com/gem/1hAu-pMGYI34Bp_ttYHrRIGljhjbmoFjZ?usp=sharing'

export type AppMode = 'video' | 'image' | 'gif' | 'spritesheet' | 'pixelate' | null

interface Props {
  onSelect: (mode: AppMode) => void
}

export default function ModeSelector({ onSelect }: Props) {
  const { t } = useLanguage()
  return (
    <>
      <Row gutter={24} style={{ marginTop: 8, marginBottom: 24 }}>
        <Col xs={24}>
          <Card
            hoverable
            onClick={() => onSelect('video')}
            bodyStyle={{ padding: '16px 24px' }}
            style={{
              textAlign: 'center',
              cursor: 'pointer',
              borderColor: '#9a8b78',
              background: 'linear-gradient(135deg, #ede6dc 0%, #e8dfd4 100%)',
              borderWidth: 2,
            }}
          >
            <VideoCameraOutlined style={{ fontSize: 36, color: '#b55233', marginBottom: 12 }} />
            <div style={{ lineHeight: 1.4 }}>
              <Text strong style={{ fontSize: 15 }}>{t('moduleVideo')}</Text>
            </div>
            <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12, lineHeight: 1.4 }}>
              {t('moduleVideoDesc')}
            </Text>
          </Card>
        </Col>
      </Row>
      <Row gutter={24} style={{ marginTop: 8 }}>
      <Col xs={24} sm={{ flex: '1 1 0' }} style={{ display: 'flex', minWidth: 0 }}>
        <a
          href={GEM_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: 'none', color: 'inherit', flex: 1, minWidth: 0 }}
          title={t('moduleGem')}
        >
          <Card
            hoverable
            bodyStyle={{ padding: '12px 16px' }}
            style={{
              textAlign: 'center',
              cursor: 'pointer',
              borderColor: '#9a8b78',
              flex: 1,
              minHeight: 140,
            }}
          >
            <ThunderboltOutlined style={{ fontSize: 32, color: '#b55233', marginBottom: 8 }} />
            <div style={{ lineHeight: 1.4 }}>
              <Text strong style={{ fontSize: 13 }}>{t('moduleGem')}</Text>
            </div>
          </Card>
        </a>
      </Col>
      <Col xs={24} sm={{ flex: '1 1 0' }} style={{ display: 'flex', minWidth: 0 }}>
        <Card
          hoverable
          onClick={() => onSelect('gif')}
          bodyStyle={{ padding: '12px 16px' }}
          style={{
            textAlign: 'center',
            cursor: 'pointer',
            borderColor: '#9a8b78',
            flex: 1,
            minHeight: 140,
          }}
        >
          <FileImageOutlined style={{ fontSize: 32, color: '#b55233', marginBottom: 8 }} />
          <div style={{ lineHeight: 1.4 }}>
            <Text strong style={{ fontSize: 13 }}>{t('moduleGif')}</Text>
          </div>
          <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 11, lineHeight: 1.35 }}>
            {t('moduleGifDesc')}
          </Text>
        </Card>
      </Col>
      <Col xs={24} sm={{ flex: '1 1 0' }} style={{ display: 'flex', minWidth: 0 }}>
        <Card
          hoverable
          onClick={() => onSelect('spritesheet')}
          bodyStyle={{ padding: '12px 16px' }}
          style={{
            textAlign: 'center',
            cursor: 'pointer',
            borderColor: '#9a8b78',
            flex: 1,
            minHeight: 140,
          }}
        >
          <BorderOuterOutlined style={{ fontSize: 32, color: '#b55233', marginBottom: 8 }} />
          <div style={{ lineHeight: 1.4 }}>
            <Text strong style={{ fontSize: 13 }}>{t('moduleSpriteSheet')}</Text>
          </div>
          <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 11, lineHeight: 1.35 }}>
            {t('moduleSpriteSheetDesc')}
          </Text>
        </Card>
      </Col>
      <Col xs={24} sm={{ flex: '1 1 0' }} style={{ display: 'flex', minWidth: 0 }}>
        <Card
          hoverable
          onClick={() => onSelect('image')}
          bodyStyle={{ padding: '12px 16px' }}
          style={{
            textAlign: 'center',
            cursor: 'pointer',
            borderColor: '#9a8b78',
            flex: 1,
            minHeight: 140,
          }}
        >
          <PictureOutlined style={{ fontSize: 32, color: '#b55233', marginBottom: 8 }} />
          <div style={{ lineHeight: 1.4 }}>
            <Text strong style={{ fontSize: 13 }}>{t('moduleImage')}</Text>
          </div>
          <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 11, lineHeight: 1.35 }}>
            {t('moduleImageDesc')}
          </Text>
        </Card>
      </Col>
      <Col xs={24} sm={{ flex: '1 1 0' }} style={{ display: 'flex', minWidth: 0 }}>
        <Card
          hoverable
          onClick={() => onSelect('pixelate')}
          bodyStyle={{ padding: '12px 16px' }}
          style={{
            textAlign: 'center',
            cursor: 'pointer',
            borderColor: '#9a8b78',
            flex: 1,
            minHeight: 140,
          }}
        >
          <BlockOutlined style={{ fontSize: 32, color: '#b55233', marginBottom: 8 }} />
          <div style={{ lineHeight: 1.4 }}>
            <Text strong style={{ fontSize: 13 }}>{t('modulePixelate')}</Text>
          </div>
          <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 11, lineHeight: 1.35 }}>
            {t('modulePixelateDesc')}
          </Text>
        </Card>
      </Col>
    </Row>
    </>
  )
}
