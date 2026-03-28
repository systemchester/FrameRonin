import { Button, Card, Space, Typography } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useLanguage } from '../i18n/context'
import {
  GEM_PIXEL_BIRD_MONSTER_URL,
  GEM_PIXEL_DOG_URL,
  GEM_PIXEL_JIKUN_URL,
} from '../lib/gemPixelUrls'

const { Text, Title } = Typography

const base =
  import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`

const DOG_PREVIEW_GIFS = [
  `${base}animals/dog1.gif`,
  `${base}animals/dog2.gif`,
  `${base}animals/dog3.gif`,
  `${base}animals/dog4.gif`,
]
const BIRD_PREVIEW_GIFS = [
  `${base}animals/bird1.gif`,
  `${base}animals/bird2.gif`,
  `${base}animals/bird3.gif`,
  `${base}animals/bird4.gif`,
]
const JIKUN_PREVIEW_GIFS = [
  new URL('../../只因 (1).gif', import.meta.url).href,
  new URL('../../只因 (2).gif', import.meta.url).href,
  new URL('../../只因 (3).gif', import.meta.url).href,
  new URL('../../只因 (4).gif', import.meta.url).href,
  new URL('../../只因 (5).gif', import.meta.url).href,
  new URL('../../只因 (6).gif', import.meta.url).href,
]

const PLACEHOLDER_COUNT = 2

interface AiPixelAnimalsHubProps {
  onBack: () => void
}

export default function AiPixelAnimalsHub({ onBack }: AiPixelAnimalsHubProps) {
  const { t } = useLanguage()

  return (
    <Card>
      <div style={{ marginBottom: 16 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>
          {t('backToHome')}
        </Button>
      </div>
      <Title level={4} style={{ marginTop: 0 }}>
        {t('moduleAiPixelAnimals')}
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 20, maxWidth: 560 }}>
        {t('aiPixelAnimalsPageHint')}
      </Text>
      <Space wrap size="middle">
        <div>
          <Button
            type="primary"
            href={GEM_PIXEL_DOG_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ minWidth: 128 }}
          >
            {t('aiPixelAnimalsGemDog')}
          </Button>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {DOG_PREVIEW_GIFS.map((src, i) => (
              <img
                key={i}
                src={src}
                alt={`dog ${i + 1}`}
                style={{ width: 48, height: 48, objectFit: 'contain', imageRendering: 'pixelated' }}
              />
            ))}
          </div>
        </div>
        <div>
          <Button
            type="primary"
            href={GEM_PIXEL_BIRD_MONSTER_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ minWidth: 128 }}
          >
            {t('aiPixelAnimalsGemBirdMonster')}
          </Button>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {BIRD_PREVIEW_GIFS.map((src, i) => (
              <img
                key={i}
                src={src}
                alt={`bird ${i + 1}`}
                style={{ width: 48, height: 48, objectFit: 'contain', imageRendering: 'pixelated' }}
              />
            ))}
          </div>
        </div>
        <div>
          <Button
            type="primary"
            href={GEM_PIXEL_JIKUN_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ minWidth: 128 }}
          >
            {t('aiPixelAnimalsGemJikun')}
          </Button>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {JIKUN_PREVIEW_GIFS.map((src, i) => (
              <img
                key={i}
                src={src}
                alt={`jikun ${i + 1}`}
                style={{ width: 48, height: 48, objectFit: 'contain', imageRendering: 'pixelated' }}
              />
            ))}
          </div>
        </div>
        {Array.from({ length: PLACEHOLDER_COUNT }, (_, i) => i + 4).map((n) => (
          <Button key={n} type="dashed" disabled style={{ minWidth: 128 }}>
            {t('aiPixelAnimalsSlot', { n })}
          </Button>
        ))}
      </Space>
    </Card>
  )
}
