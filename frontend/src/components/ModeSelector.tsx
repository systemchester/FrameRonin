import { Card, Row, Col, Typography } from 'antd'
import { PictureOutlined, VideoCameraOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useLanguage } from '../i18n/context'

const { Text } = Typography

const GEM_URL = 'https://gemini.google.com/gem/7dca9f93a7a9?usp=sharing'

export type AppMode = 'video' | 'image' | null

interface Props {
  onSelect: (mode: AppMode) => void
}

export default function ModeSelector({ onSelect }: Props) {
  const { t } = useLanguage()
  return (
    <>
      <Row gutter={24} style={{ marginTop: 8, marginBottom: 24 }}>
        <Col xs={24}>
          <a
            href={GEM_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'none', color: 'inherit' }}
            title={t('moduleGem')}
          >
            <Card
              hoverable
              style={{
                textAlign: 'center',
                cursor: 'pointer',
                borderColor: '#9a8b78',
                background: 'linear-gradient(135deg, #ede6dc 0%, #e8dfd4 100%)',
                borderWidth: 2,
              }}
            >
              <ThunderboltOutlined style={{ fontSize: 48, color: '#b55233', marginBottom: 16 }} />
              <div>
                <Text strong style={{ fontSize: 18 }}>{t('moduleGem')}</Text>
              </div>
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                {t('moduleGemDesc')}
              </Text>
            </Card>
          </a>
        </Col>
      </Row>
      <Row gutter={24} style={{ marginTop: 8 }}>
      <Col xs={24} md={12} style={{ display: 'flex' }}>
        <Card
          hoverable
          onClick={() => onSelect('video')}
          style={{
            textAlign: 'center',
            cursor: 'pointer',
            borderColor: '#9a8b78',
            flex: 1,
            minHeight: 180,
          }}
        >
          <VideoCameraOutlined style={{ fontSize: 48, color: '#b55233', marginBottom: 16 }} />
          <div>
            <Text strong style={{ fontSize: 18 }}>{t('moduleVideo')}</Text>
          </div>
          <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
            {t('moduleVideoDesc')}
          </Text>
        </Card>
      </Col>
      <Col xs={24} md={12} style={{ display: 'flex' }}>
        <Card
          hoverable
          onClick={() => onSelect('image')}
          style={{
            textAlign: 'center',
            cursor: 'pointer',
            borderColor: '#9a8b78',
            flex: 1,
            minHeight: 180,
          }}
        >
          <PictureOutlined style={{ fontSize: 48, color: '#b55233', marginBottom: 16 }} />
          <div>
            <Text strong style={{ fontSize: 18 }}>{t('moduleImage')}</Text>
          </div>
          <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
            {t('moduleImageDesc')}
          </Text>
        </Card>
      </Col>
    </Row>
    </>
  )
}
