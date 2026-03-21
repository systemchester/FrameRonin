import { Card, Row, Col, Typography, Space, Button } from 'antd'
import { ArrowsAltOutlined, BlockOutlined, FileImageOutlined, PictureOutlined, VideoCameraOutlined, ThunderboltOutlined, BorderOuterOutlined, ScissorOutlined, SafetyOutlined, ShareAltOutlined, ControlOutlined, RocketOutlined } from '@ant-design/icons'
import { useAuth } from '../auth/context'
import { RONIN_PRO_REQUIRE_NFT } from '../config/features'
import { useNftOwnership } from '../hooks/useNftOwnership'
import { useLanguage } from '../i18n/context'

const { Text } = Typography

/** 游戏手柄图标 */
function GamepadIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ fontSize: 54, color: '#b55233', marginBottom: 12, ...style }}>
      <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z" />
      <path d="M8 10v4M6 12h4" />
      <circle cx="16" cy="10" r="1.2" />
      <circle cx="18" cy="12" r="1.2" />
      <circle cx="16" cy="14" r="1.2" />
    </svg>
  )
}

const GEM_V2_URL = 'https://gemini.google.com/gem/1ex8XOSNJzjAND6Ujz9aKFKbIyqzcvTCv?usp=sharing'
const GEM_V2_URL_2 = 'https://gemini.google.com/gem/1kEnaydh5Ssne-XxSUQFgVxie93u-kR4P?usp=sharing'
const GEM_V3_URL = 'https://gemini.google.com/gem/1hAu-pMGYI34Bp_ttYHrRIGljhjbmoFjZ?usp=sharing'
const GEM_MONSTER_ZOMBIE_B1 = 'https://gemini.google.com/gem/1AIhSwGHFN1K2wPZwrgnTr7xxM5IwDb3i?usp=sharing'
const GEM_MONSTER_ZOMBIE_B2 = 'https://gemini.google.com/gem/1qnjyOOhjMk8k5sW4IXaRDbaxk5yZ63y1?usp=sharing'
const GEM_CHAR_V23OT_URL = 'https://gemini.google.com/gem/1mRxvjPRe_jWUxHNB9R7S3aiLiHOTQIU5?usp=sharing'
const GEM_SCENE_URL = 'https://gemini.google.com/gem/1a83JP082OIliUQZN5SsBguMOrYm4g6P2?usp=sharing'
const GEM_SCENE_URL_2 = 'https://gemini.google.com/gem/1u2qo4OVCxniX5swJttIS2GuqPjswycmb?usp=sharing'
const GEM_SCENE_URL_3 = 'https://gemini.google.com/gem/1nrZ7I6KFoPdoF-Ej2kte2edB0Ct-Sb10?usp=sharing'
const GEM_SCENE_URL_4 = 'https://gemini.google.com/gem/1VuZIChmmyZtWBRdlLnTQREY1gODT4sEJ?usp=sharing' // 街机场景
const GEM_ILLUST_URL = 'https://gemini.google.com/gem/1IUuJXgHTTbMEgv5D_G0HXSHXxYdcfTZg?usp=sharing'
const GEM_RPGMAKER_URL_V1 = 'https://gemini.google.com/gem/1zkDfsN972fczP66xwCiQ6H0jP7HLtGz5?usp=sharing'
const GEM_RPGMAKER_URL_V1_1 = 'https://gemini.google.com/gem/1kUViEEO8ehmIHGNHThI77xpzSXx2KHFb?usp=sharing'

export type AppMode = 'video' | 'image' | 'gif' | 'spritesheet' | 'spriteadjust' | 'pixelate' | 'expandshrink' | 'matte' | 'geminiwatermark' | 'nanobananaFullChar' | 'seedanceWatermark' | 'assetsAndSource' | 'controlTest' | 'controlTestArcade' | 'roninPro' | null

interface Props {
  onSelect: (mode: AppMode) => void
}

export default function ModeSelector({ onSelect }: Props) {
  const { t } = useLanguage()
  const { address, isConnected } = useAuth()
  const ownsNft = useNftOwnership(RONIN_PRO_REQUIRE_NFT ? address : null)
  const showRoninProCard = !RONIN_PRO_REQUIRE_NFT || ownsNft === true
  return (
    <>
      <Row gutter={24} style={{ marginTop: 8, marginBottom: 24 }} align="stretch">
        <Col xs={24} sm={12} md={6} style={{ display: 'flex' }}>
          <Card
            hoverable
            onClick={() => onSelect('controlTest')}
            styles={{ body: { padding: '16px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' } }}
            style={{
              textAlign: 'center',
              cursor: 'pointer',
              borderColor: '#9a8b78',
              background: 'linear-gradient(135deg, #ede6dc 0%, #e8dfd4 100%)',
              borderWidth: 2,
              flex: 1,
              minHeight: 0,
              width: '100%',
            }}
          >
            <ControlOutlined style={{ fontSize: 36, color: '#b55233', marginBottom: 12 }} />
            <div style={{ lineHeight: 1.4 }}>
              <Text strong style={{ fontSize: 15 }}>{t('moduleControlTestTopdown')}</Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6} style={{ display: 'flex' }}>
          <Card
            hoverable
            onClick={() => onSelect('controlTestArcade')}
            styles={{ body: { padding: '16px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' } }}
            style={{
              textAlign: 'center',
              cursor: 'pointer',
              borderColor: '#9a8b78',
              background: 'linear-gradient(135deg, #ede6dc 0%, #e8dfd4 100%)',
              borderWidth: 2,
              flex: 1,
              minHeight: 0,
              width: '100%',
            }}
          >
            <GamepadIcon />
            <div style={{ lineHeight: 1.4 }}>
              <Text strong style={{ fontSize: 15 }}>{t('moduleControlTestArcade')}</Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6} style={{ display: 'flex' }}>
          <Card
            hoverable
            onClick={() => onSelect('video')}
            styles={{ body: { padding: '16px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' } }}
            style={{
              textAlign: 'center',
              cursor: 'pointer',
              borderColor: '#9a8b78',
              background: 'linear-gradient(135deg, #ede6dc 0%, #e8dfd4 100%)',
              borderWidth: 2,
              flex: 1,
              minHeight: 0,
              width: '100%',
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
        <Col xs={24} sm={12} md={6} style={{ display: 'flex' }}>
          <Card
            hoverable
            styles={{ body: { padding: '16px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' } }}
            style={{
              textAlign: 'center',
              borderColor: '#9a8b78',
              background: 'linear-gradient(135deg, #ede6dc 0%, #e8dfd4 100%)',
              borderWidth: 2,
              flex: 1,
              minHeight: 0,
              width: '100%',
            }}
          >
            <ThunderboltOutlined style={{ fontSize: 36, color: '#b55233', marginBottom: 12 }} />
            <div style={{ lineHeight: 1.4 }}>
              <Text strong style={{ fontSize: 15 }}>{t('moduleNanobananaRpgmaker')}</Text>
            </div>
            <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12, lineHeight: 1.4 }}>
              {t('moduleNanobananaRpgmakerDesc')}
            </Text>
            <Space size="small" style={{ marginTop: 12, justifyContent: 'center', width: '100%' }} wrap>
              <Button type="primary" size="small" onClick={() => window.open(GEM_RPGMAKER_URL_V1, '_blank')}>
                {t('moduleNanobananaRpgmakerGemV1')}
              </Button>
              <Button type="primary" size="small" onClick={() => window.open(GEM_RPGMAKER_URL_V1_1, '_blank')}>
                {t('moduleNanobananaRpgmakerGemV1_1')}
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>
      <Row gutter={24} style={{ marginTop: 8 }} justify="center">
        <Col xs={24} sm={12} md={6} style={{ display: 'flex' }}>
          <Card
            hoverable
            styles={{ body: { padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' } }}
            style={{ textAlign: 'center', borderColor: '#9a8b78', flex: 1, minHeight: 140 }}
          >
            <ThunderboltOutlined style={{ fontSize: 32, color: '#b55233', marginBottom: 8 }} />
            <div style={{ lineHeight: 1.4 }}>
              <Text strong style={{ fontSize: 13 }}>{t('moduleGemV2')}</Text>
            </div>
            <Space size="small" style={{ marginTop: 12, justifyContent: 'center', width: '100%' }}>
              <Button type="primary" size="small" onClick={() => window.open(GEM_V2_URL, '_blank')}>
                {t('gemV2Link1')}
              </Button>
              <Button type="primary" size="small" onClick={() => window.open(GEM_V2_URL_2, '_blank')}>
                {t('gemV2Link2')}
              </Button>
              <Button type="primary" size="small" onClick={() => window.open(GEM_V3_URL, '_blank')}>
                {t('gemV2Link3')}
              </Button>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6} style={{ display: 'flex' }}>
          <Card
            hoverable
            styles={{ body: { padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' } }}
            style={{ textAlign: 'center', borderColor: '#9a8b78', flex: 1, minHeight: 140 }}
          >
            <ThunderboltOutlined style={{ fontSize: 32, color: '#b55233', marginBottom: 8 }} />
            <div style={{ lineHeight: 1.4 }}>
              <Text strong style={{ fontSize: 13 }}>{t('moduleGem')}</Text>
            </div>
            <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 11, lineHeight: 1.35 }}>
              {t('moduleGemV3Desc')}
            </Text>
            <Space size="small" style={{ marginTop: 12, justifyContent: 'center', width: '100%' }} wrap>
              <Button type="primary" size="small" onClick={() => window.open(GEM_MONSTER_ZOMBIE_B1, '_blank')}>
                {t('moduleGemMonsterZombieB1')}
              </Button>
              <Button type="primary" size="small" onClick={() => window.open(GEM_MONSTER_ZOMBIE_B2, '_blank')}>
                {t('moduleGemMonsterZombieB2')}
              </Button>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6} style={{ display: 'flex' }}>
          <a
            href={GEM_CHAR_V23OT_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'none', color: 'inherit', flex: 1, minWidth: 0 }}
            title={t('moduleCharGenV23OT')}
          >
            <Card
              hoverable
              styles={{ body: { padding: '12px 16px' } }}
              style={{ textAlign: 'center', cursor: 'pointer', borderColor: '#9a8b78', flex: 1, minHeight: 140 }}
            >
              <ThunderboltOutlined style={{ fontSize: 32, color: '#b55233', marginBottom: 8 }} />
              <div style={{ lineHeight: 1.4 }}>
                <Text strong style={{ fontSize: 13 }}>{t('moduleCharGenV23OT')}</Text>
              </div>
              <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 11, lineHeight: 1.35 }}>
                {t('moduleCharGenV23OTDesc')}
              </Text>
            </Card>
          </a>
        </Col>
        <Col xs={24} sm={12} md={6} style={{ display: 'flex' }}>
          <Card
            hoverable
            onClick={() => onSelect('matte')}
            styles={{ body: { padding: '12px 16px' } }}
            style={{ textAlign: 'center', cursor: 'pointer', borderColor: '#9a8b78', flex: 1, minHeight: 140 }}
          >
            <ScissorOutlined style={{ fontSize: 32, color: '#b55233', marginBottom: 8 }} />
            <div style={{ lineHeight: 1.4 }}>
              <Text strong style={{ fontSize: 13 }}>{t('moduleMatte')}</Text>
            </div>
            <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 11, lineHeight: 1.35 }}>
              {t('moduleMatteDesc')}
            </Text>
          </Card>
        </Col>
      </Row>
      {isConnected && (
        <Row gutter={24} style={{ marginTop: 8, marginBottom: 24 }} align="stretch">
          <Col xs={24} md={6} style={{ display: 'flex' }}>
            <Card
              hoverable
              styles={{ body: { padding: '16px 24px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' } }}
              style={{
                textAlign: 'center',
                borderColor: '#9a8b78',
                background: 'linear-gradient(135deg, #ede6dc 0%, #e8dfd4 100%)',
                borderWidth: 2,
                flex: 1,
                minHeight: 0,
                width: '100%',
              }}
            >
              <ThunderboltOutlined style={{ fontSize: 36, color: '#b55233', marginBottom: 12 }} />
              <div style={{ lineHeight: 1.4 }}>
                <Text strong style={{ fontSize: 15 }}>{t('moduleNanobananaScene')}</Text>
              </div>
              <Space size="small" style={{ marginTop: 12, justifyContent: 'center', width: '100%' }} wrap>
                <Button type="primary" size="small" onClick={() => window.open(GEM_SCENE_URL, '_blank')}>
                  {t('nanobananaSceneLink1')}
                </Button>
                <Button type="primary" size="small" onClick={() => window.open(GEM_SCENE_URL_2, '_blank')}>
                  {t('nanobananaSceneLink2')}
                </Button>
                <Button type="primary" size="small" onClick={() => window.open(GEM_SCENE_URL_3, '_blank')}>
                  {t('nanobananaSceneLink3')}
                </Button>
                <Button type="primary" size="small" onClick={() => window.open(GEM_SCENE_URL_4, '_blank')}>
                  {t('nanobananaSceneLink4')}
                </Button>
              </Space>
            </Card>
          </Col>
          <Col xs={24} md={6} style={{ display: 'flex' }}>
            <a
              href={GEM_ILLUST_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flex: 1, minWidth: 0 }}
              title={t('moduleIllust')}
            >
              <Card
                hoverable
                styles={{ body: { padding: '16px 24px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' } }}
                style={{
                  textAlign: 'center',
                  cursor: 'pointer',
                  borderColor: '#9a8b78',
                  background: 'linear-gradient(135deg, #ede6dc 0%, #e8dfd4 100%)',
                  borderWidth: 2,
                  flex: 1,
                  minHeight: 0,
                  width: '100%',
                }}
              >
                <ThunderboltOutlined style={{ fontSize: 36, color: '#b55233', marginBottom: 12 }} />
                <div style={{ lineHeight: 1.4 }}>
                  <Text strong style={{ fontSize: 15 }}>{t('moduleIllust')}</Text>
                </div>
                <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12, lineHeight: 1.4 }}>
                  {t('moduleIllustDesc')}
                </Text>
              </Card>
            </a>
          </Col>
          <Col xs={24} md={6} style={{ display: 'flex' }}>
            <Card
              hoverable
              onClick={() => onSelect('nanobananaFullChar')}
              styles={{ body: { padding: '16px 24px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' } }}
              style={{
                textAlign: 'center',
                cursor: 'pointer',
                borderColor: '#9a8b78',
                background: 'linear-gradient(135deg, #ede6dc 0%, #e8dfd4 100%)',
                borderWidth: 2,
                flex: 1,
                minHeight: 0,
                width: '100%',
              }}
            >
              <ThunderboltOutlined style={{ fontSize: 36, color: '#b55233', marginBottom: 12 }} />
              <div style={{ lineHeight: 1.4 }}>
                <Text strong style={{ fontSize: 15 }}>{t('moduleNanobananaFullChar')}</Text>
              </div>
            </Card>
          </Col>
          <Col xs={24} md={6} style={{ display: 'flex' }}>
            <Card
              hoverable
              onClick={() => onSelect('spriteadjust')}
              styles={{ body: { padding: '16px 24px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' } }}
              style={{
                textAlign: 'center',
                cursor: 'pointer',
                borderColor: '#9a8b78',
                background: 'linear-gradient(135deg, #ede6dc 0%, #e8dfd4 100%)',
                borderWidth: 2,
                flex: 1,
                minHeight: 0,
                width: '100%',
              }}
            >
              <BorderOuterOutlined style={{ fontSize: 36, color: '#b55233', marginBottom: 12 }} />
              <div style={{ lineHeight: 1.4 }}>
                <Text strong style={{ fontSize: 15 }}>{t('moduleSpriteAdjust')}</Text>
              </div>
              <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12, lineHeight: 1.4 }}>
                {t('moduleSpriteAdjustDesc')}
              </Text>
            </Card>
          </Col>
        </Row>
      )}
      <Row gutter={24} style={{ marginTop: 8 }}>
      <Col xs={24} sm={{ flex: '1 1 0' }} style={{ display: 'flex', minWidth: 0 }}>
        <Card
          hoverable
          onClick={() => onSelect('gif')}
          styles={{ body: { padding: '12px 16px' } }}
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
          styles={{ body: { padding: '12px 16px' } }}
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
          styles={{ body: { padding: '12px 16px' } }}
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
          styles={{ body: { padding: '12px 16px' } }}
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
      <Col xs={24} sm={{ flex: '1 1 0' }} style={{ display: 'flex', minWidth: 0 }}>
        <Card
          hoverable
          onClick={() => onSelect('geminiwatermark')}
          styles={{ body: { padding: '12px 16px' } }}
          style={{
            textAlign: 'center',
            cursor: 'pointer',
            borderColor: '#9a8b78',
            flex: 1,
            minHeight: 140,
          }}
        >
          <SafetyOutlined style={{ fontSize: 32, color: '#b55233', marginBottom: 8 }} />
          <div style={{ lineHeight: 1.4 }}>
            <Text strong style={{ fontSize: 13 }}>{t('moduleGeminiWatermark')}</Text>
          </div>
          <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 11, lineHeight: 1.35 }}>
            {t('moduleGeminiWatermarkDesc')}
          </Text>
        </Card>
      </Col>
      <Col xs={24} sm={{ flex: '1 1 0' }} style={{ display: 'flex', minWidth: 0 }}>
        <Card
          hoverable
          onClick={() => onSelect('expandshrink')}
          styles={{ body: { padding: '12px 16px' } }}
          style={{
            textAlign: 'center',
            cursor: 'pointer',
            borderColor: '#9a8b78',
            flex: 1,
            minHeight: 140,
          }}
        >
          <ArrowsAltOutlined style={{ fontSize: 32, color: '#b55233', marginBottom: 8 }} />
          <div style={{ lineHeight: 1.4 }}>
            <Text strong style={{ fontSize: 13 }}>{t('moduleExpandShrink')}</Text>
          </div>
          <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 11, lineHeight: 1.35 }}>
            {t('moduleExpandShrinkDesc')}
          </Text>
        </Card>
      </Col>
    </Row>
      {showRoninProCard && (
        <Row gutter={24} style={{ marginTop: 8, marginBottom: 24 }}>
          <Col xs={24}>
            <Card
              hoverable
              onClick={() => onSelect('roninPro')}
              styles={{ body: { padding: '16px 24px' } }}
              style={{
                textAlign: 'center',
                cursor: 'pointer',
                borderColor: '#9a8b78',
                background: 'linear-gradient(135deg, #ede6dc 0%, #e8dfd4 100%)',
                borderWidth: 2,
              }}
            >
              <RocketOutlined style={{ fontSize: 36, color: '#b55233', marginBottom: 12 }} />
              <div style={{ lineHeight: 1.4 }}>
                <Text strong style={{ fontSize: 15 }}>{t('moduleRoninPro')}</Text>
              </div>
              <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12, lineHeight: 1.4 }}>
                {t('moduleRoninProDesc')}
              </Text>
            </Card>
          </Col>
        </Row>
      )}
      <Row gutter={24} style={{ marginTop: 8, marginBottom: 24 }}>
        <Col xs={24} md={12}>
          <Card
            hoverable
            onClick={() => onSelect('seedanceWatermark')}
            styles={{ body: { padding: '16px 24px' } }}
            style={{
              textAlign: 'center',
              cursor: 'pointer',
              borderColor: '#9a8b78',
              background: 'linear-gradient(135deg, #ede6dc 0%, #e8dfd4 100%)',
              borderWidth: 2,
              height: '100%',
            }}
          >
            <VideoCameraOutlined style={{ fontSize: 36, color: '#b55233', marginBottom: 12 }} />
            <div style={{ lineHeight: 1.4 }}>
              <Text strong style={{ fontSize: 15 }}>{t('moduleSeedanceWatermarkRemover')}</Text>
            </div>
            <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12, lineHeight: 1.4 }}>
              {t('moduleSeedanceWatermarkRemoverDesc')}
            </Text>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card
            hoverable
            onClick={() => onSelect('assetsAndSource')}
            styles={{ body: { padding: '16px 24px' } }}
            style={{
              textAlign: 'center',
              cursor: 'pointer',
              borderColor: '#9a8b78',
              background: 'linear-gradient(135deg, #ede6dc 0%, #e8dfd4 100%)',
              borderWidth: 2,
              height: '100%',
            }}
          >
            <ShareAltOutlined style={{ fontSize: 36, color: '#b55233', marginBottom: 12 }} />
            <div style={{ lineHeight: 1.4 }}>
              <Text strong style={{ fontSize: 15 }}>{t('moduleAssetsAndSource')}</Text>
            </div>
            <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12, lineHeight: 1.4 }}>
              {t('moduleAssetsAndSourceDesc')}
            </Text>
          </Card>
        </Col>
      </Row>
    </>
  )
}
