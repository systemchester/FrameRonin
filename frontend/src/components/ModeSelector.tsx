import type { CSSProperties } from 'react'
import { Card, Row, Col, Typography, Space, Button } from 'antd'
import { ArrowsAltOutlined, AppstoreOutlined, BlockOutlined, BugOutlined, FileImageOutlined, PictureOutlined, VideoCameraOutlined, ThunderboltOutlined, BorderOuterOutlined, ScissorOutlined, SafetyOutlined, ShareAltOutlined, ControlOutlined, RocketOutlined } from '@ant-design/icons'
import { useAuth } from '../auth/context'
import { RONIN_PRO_REQUIRE_NFT } from '../config/features'
import { useNftOwnership } from '../hooks/useNftOwnership'
import { useLanguage } from '../i18n/context'
import {
  GEM_CHAR_V23OT_URL,
  GEM_ILLUST_URL,
  GEM_MONSTER_ZOMBIE_B1,
  GEM_MONSTER_ZOMBIE_B2,
  GEM_RPGMAKER_URL_V1,
  GEM_RPGMAKER_URL_V1_1,
  GEM_RPGMAKER_URL_V3,
  GEM_SCENE_URL,
  GEM_SCENE_URL_2,
  GEM_SCENE_URL_3,
  GEM_SCENE_URL_4,
  GEM_V2_URL,
  GEM_V2_URL_2,
  GEM_V3_URL,
} from '../lib/gemPixelUrls'

const { Text } = Typography

/** 首页功能卡 body：统一图标与标题横向居中；说明文 stretch 后 textAlign 居中以正常换行 */
const HOME_CARD_BODY_LARGE = {
  padding: '16px 24px',
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center' as const,
}
const HOME_CARD_BODY_LARGE_GROW = {
  ...HOME_CARD_BODY_LARGE,
  flex: 1,
}
const HOME_CARD_BODY_SMALL = {
  padding: '12px 16px',
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center' as const,
}
const HOME_DESC_TEXT: CSSProperties = {
  alignSelf: 'stretch',
  textAlign: 'center',
}

/** 游戏手柄图标 */
function GamepadIcon({ style }: { style?: CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block', fontSize: 54, color: '#b55233', marginBottom: 12, marginLeft: 'auto', marginRight: 'auto', ...style }}
    >
      <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z" />
      <path d="M8 10v4M6 12h4" />
      <circle cx="16" cy="10" r="1.2" />
      <circle cx="18" cy="12" r="1.2" />
      <circle cx="16" cy="14" r="1.2" />
    </svg>
  )
}

export type AppMode =
  | 'video'
  | 'image'
  | 'gif'
  | 'spritesheet'
  | 'spriteadjust'
  | 'pixelate'
  | 'expandshrink'
  | 'matte'
  | 'geminiwatermark'
  | 'nanobananaFullChar'
  | 'seedanceWatermark'
  | 'assetsAndSource'
  | 'controlTest'
  | 'controlTestArcade'
  | 'roninPro'
  | 'aiPixelAnimals'
  | 'gemPixelPotpourri'
  | null

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
            styles={{ body: HOME_CARD_BODY_LARGE }}
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
            <ControlOutlined style={{ fontSize: 36, color: '#b55233', marginBottom: 12, display: 'block' }} />
            <div style={{ lineHeight: 1.4 }}>
              <Text strong style={{ fontSize: 15 }}>{t('moduleControlTestTopdown')}</Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6} style={{ display: 'flex' }}>
          <Card
            hoverable
            onClick={() => onSelect('controlTestArcade')}
            styles={{ body: HOME_CARD_BODY_LARGE }}
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
            styles={{ body: HOME_CARD_BODY_LARGE }}
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
            <VideoCameraOutlined style={{ fontSize: 36, color: '#b55233', marginBottom: 12, display: 'block' }} />
            <div style={{ lineHeight: 1.4 }}>
              <Text strong style={{ fontSize: 15 }}>{t('moduleVideo')}</Text>
            </div>
            <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12, lineHeight: 1.4, ...HOME_DESC_TEXT }}>
              {t('moduleVideoDesc')}
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6} style={{ display: 'flex' }}>
          <Card
            hoverable
            styles={{ body: HOME_CARD_BODY_LARGE }}
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
            <ThunderboltOutlined style={{ fontSize: 36, color: '#b55233', marginBottom: 12, display: 'block' }} />
            <div style={{ lineHeight: 1.4 }}>
              <Text strong style={{ fontSize: 15 }}>{t('moduleNanobananaRpgmaker')}</Text>
            </div>
            <Space size="small" style={{ marginTop: 12, justifyContent: 'center', width: '100%', alignSelf: 'stretch' }} wrap>
              <Button type="primary" size="small" onClick={() => window.open(GEM_RPGMAKER_URL_V1, '_blank')}>
                {t('moduleNanobananaRpgmakerGemV1')}
              </Button>
              <Button type="primary" size="small" onClick={() => window.open(GEM_RPGMAKER_URL_V1_1, '_blank')}>
                {t('moduleNanobananaRpgmakerGemV1_1')}
              </Button>
              <Button type="primary" size="small" onClick={() => window.open(GEM_RPGMAKER_URL_V3, '_blank')}>
                {t('moduleNanobananaRpgmakerGemV3')}
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>
      <Row gutter={24} style={{ marginTop: 8 }} justify="start">
        <Col xs={24} sm={12} md={6} style={{ display: 'flex' }}>
          <Card
            hoverable
            styles={{ body: HOME_CARD_BODY_SMALL }}
            style={{ textAlign: 'center', borderColor: '#9a8b78', flex: 1, minHeight: 140, width: '100%' }}
          >
            <ThunderboltOutlined style={{ fontSize: 32, color: '#b55233', marginBottom: 8, display: 'block' }} />
            <div style={{ lineHeight: 1.4 }}>
              <Text strong style={{ fontSize: 13 }}>{t('moduleGemV2')}</Text>
            </div>
            <Space size="small" style={{ marginTop: 12, justifyContent: 'center', width: '100%', alignSelf: 'stretch' }}>
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
            styles={{ body: HOME_CARD_BODY_SMALL }}
            style={{ textAlign: 'center', borderColor: '#9a8b78', flex: 1, minHeight: 140, width: '100%' }}
          >
            <ThunderboltOutlined style={{ fontSize: 32, color: '#b55233', marginBottom: 8, display: 'block' }} />
            <div style={{ lineHeight: 1.4 }}>
              <Text strong style={{ fontSize: 13 }}>{t('moduleGem')}</Text>
            </div>
            <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 11, lineHeight: 1.35, ...HOME_DESC_TEXT }}>
              {t('moduleGemV3Desc')}
            </Text>
            <Space size="small" style={{ marginTop: 12, justifyContent: 'center', width: '100%', alignSelf: 'stretch' }} wrap>
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
              styles={{ body: HOME_CARD_BODY_SMALL }}
              style={{ textAlign: 'center', cursor: 'pointer', borderColor: '#9a8b78', flex: 1, minHeight: 140, width: '100%' }}
            >
              <ThunderboltOutlined style={{ fontSize: 32, color: '#b55233', marginBottom: 8, display: 'block' }} />
              <div style={{ lineHeight: 1.4 }}>
                <Text strong style={{ fontSize: 13 }}>{t('moduleCharGenV23OT')}</Text>
              </div>
              <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 11, lineHeight: 1.35, ...HOME_DESC_TEXT }}>
                {t('moduleCharGenV23OTDesc')}
              </Text>
            </Card>
          </a>
        </Col>
        <Col xs={24} sm={12} md={6} style={{ display: 'flex' }}>
          <Card
            hoverable
            onClick={() => onSelect('matte')}
            styles={{ body: HOME_CARD_BODY_SMALL }}
            style={{ textAlign: 'center', cursor: 'pointer', borderColor: '#9a8b78', flex: 1, minHeight: 140, width: '100%' }}
          >
            <ScissorOutlined style={{ fontSize: 32, color: '#b55233', marginBottom: 8, display: 'block' }} />
            <div style={{ lineHeight: 1.4 }}>
              <Text strong style={{ fontSize: 13 }}>{t('moduleMatte')}</Text>
            </div>
            <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 11, lineHeight: 1.35, ...HOME_DESC_TEXT }}>
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
              styles={{ body: HOME_CARD_BODY_LARGE_GROW }}
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
              <ThunderboltOutlined style={{ fontSize: 36, color: '#b55233', marginBottom: 12, display: 'block' }} />
              <div style={{ lineHeight: 1.4 }}>
                <Text strong style={{ fontSize: 15 }}>{t('moduleNanobananaScene')}</Text>
              </div>
              <Space size="small" style={{ marginTop: 12, justifyContent: 'center', width: '100%', alignSelf: 'stretch' }} wrap>
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
                styles={{ body: HOME_CARD_BODY_LARGE_GROW }}
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
                <ThunderboltOutlined style={{ fontSize: 36, color: '#b55233', marginBottom: 12, display: 'block' }} />
                <div style={{ lineHeight: 1.4 }}>
                  <Text strong style={{ fontSize: 15 }}>{t('moduleIllust')}</Text>
                </div>
                <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12, lineHeight: 1.4, ...HOME_DESC_TEXT }}>
                  {t('moduleIllustDesc')}
                </Text>
              </Card>
            </a>
          </Col>
          <Col xs={24} md={6} style={{ display: 'flex' }}>
            <Card
              hoverable
              onClick={() => onSelect('nanobananaFullChar')}
              styles={{ body: HOME_CARD_BODY_LARGE_GROW }}
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
              <ThunderboltOutlined style={{ fontSize: 36, color: '#b55233', marginBottom: 12, display: 'block' }} />
              <div style={{ lineHeight: 1.4 }}>
                <Text strong style={{ fontSize: 15 }}>{t('moduleNanobananaFullChar')}</Text>
              </div>
            </Card>
          </Col>
          <Col xs={24} md={6} style={{ display: 'flex' }}>
            <Card
              hoverable
              onClick={() => onSelect('spriteadjust')}
              styles={{ body: HOME_CARD_BODY_LARGE_GROW }}
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
              <BorderOuterOutlined style={{ fontSize: 36, color: '#b55233', marginBottom: 12, display: 'block' }} />
              <div style={{ lineHeight: 1.4 }}>
                <Text strong style={{ fontSize: 15 }}>{t('moduleSpriteAdjust')}</Text>
              </div>
              <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12, lineHeight: 1.4, ...HOME_DESC_TEXT }}>
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
          styles={{ body: HOME_CARD_BODY_SMALL }}
          style={{
            textAlign: 'center',
            cursor: 'pointer',
            borderColor: '#9a8b78',
            flex: 1,
            minHeight: 140,
            width: '100%',
          }}
        >
          <FileImageOutlined style={{ fontSize: 32, color: '#b55233', marginBottom: 8, display: 'block' }} />
          <div style={{ lineHeight: 1.4 }}>
            <Text strong style={{ fontSize: 13 }}>{t('moduleGif')}</Text>
          </div>
          <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 11, lineHeight: 1.35, ...HOME_DESC_TEXT }}>
            {t('moduleGifDesc')}
          </Text>
        </Card>
      </Col>
      <Col xs={24} sm={{ flex: '1 1 0' }} style={{ display: 'flex', minWidth: 0 }}>
        <Card
          hoverable
          onClick={() => onSelect('spritesheet')}
          styles={{ body: HOME_CARD_BODY_SMALL }}
          style={{
            textAlign: 'center',
            cursor: 'pointer',
            borderColor: '#9a8b78',
            flex: 1,
            minHeight: 140,
            width: '100%',
          }}
        >
          <BorderOuterOutlined style={{ fontSize: 32, color: '#b55233', marginBottom: 8, display: 'block' }} />
          <div style={{ lineHeight: 1.4 }}>
            <Text strong style={{ fontSize: 13 }}>{t('moduleSpriteSheet')}</Text>
          </div>
          <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 11, lineHeight: 1.35, ...HOME_DESC_TEXT }}>
            {t('moduleSpriteSheetDesc')}
          </Text>
        </Card>
      </Col>
      <Col xs={24} sm={{ flex: '1 1 0' }} style={{ display: 'flex', minWidth: 0 }}>
        <Card
          hoverable
          onClick={() => onSelect('image')}
          styles={{ body: HOME_CARD_BODY_SMALL }}
          style={{
            textAlign: 'center',
            cursor: 'pointer',
            borderColor: '#9a8b78',
            flex: 1,
            minHeight: 140,
            width: '100%',
          }}
        >
          <PictureOutlined style={{ fontSize: 32, color: '#b55233', marginBottom: 8, display: 'block' }} />
          <div style={{ lineHeight: 1.4 }}>
            <Text strong style={{ fontSize: 13 }}>{t('moduleImage')}</Text>
          </div>
          <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 11, lineHeight: 1.35, ...HOME_DESC_TEXT }}>
            {t('moduleImageDesc')}
          </Text>
        </Card>
      </Col>
      <Col xs={24} sm={{ flex: '1 1 0' }} style={{ display: 'flex', minWidth: 0 }}>
        <Card
          hoverable
          onClick={() => onSelect('pixelate')}
          styles={{ body: HOME_CARD_BODY_SMALL }}
          style={{
            textAlign: 'center',
            cursor: 'pointer',
            borderColor: '#9a8b78',
            flex: 1,
            minHeight: 140,
            width: '100%',
          }}
        >
          <BlockOutlined style={{ fontSize: 32, color: '#b55233', marginBottom: 8, display: 'block' }} />
          <div style={{ lineHeight: 1.4 }}>
            <Text strong style={{ fontSize: 13 }}>{t('modulePixelate')}</Text>
          </div>
          <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 11, lineHeight: 1.35, ...HOME_DESC_TEXT }}>
            {t('modulePixelateDesc')}
          </Text>
        </Card>
      </Col>
      <Col xs={24} sm={{ flex: '1 1 0' }} style={{ display: 'flex', minWidth: 0 }}>
        <Card
          hoverable
          onClick={() => onSelect('geminiwatermark')}
          styles={{ body: HOME_CARD_BODY_SMALL }}
          style={{
            textAlign: 'center',
            cursor: 'pointer',
            borderColor: '#9a8b78',
            flex: 1,
            minHeight: 140,
            width: '100%',
          }}
        >
          <SafetyOutlined style={{ fontSize: 32, color: '#b55233', marginBottom: 8, display: 'block' }} />
          <div style={{ lineHeight: 1.4 }}>
            <Text strong style={{ fontSize: 13 }}>{t('moduleGeminiWatermark')}</Text>
          </div>
        </Card>
      </Col>
      <Col xs={24} sm={{ flex: '1 1 0' }} style={{ display: 'flex', minWidth: 0 }}>
        <Card
          hoverable
          onClick={() => onSelect('expandshrink')}
          styles={{ body: HOME_CARD_BODY_SMALL }}
          style={{
            textAlign: 'center',
            cursor: 'pointer',
            borderColor: '#9a8b78',
            flex: 1,
            minHeight: 140,
            width: '100%',
          }}
        >
          <ArrowsAltOutlined style={{ fontSize: 32, color: '#b55233', marginBottom: 8, display: 'block' }} />
          <div style={{ lineHeight: 1.4 }}>
            <Text strong style={{ fontSize: 13 }}>{t('moduleExpandShrink')}</Text>
          </div>
          <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 11, lineHeight: 1.35, ...HOME_DESC_TEXT }}>
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
              styles={{ body: HOME_CARD_BODY_LARGE }}
              style={{
                textAlign: 'center',
                cursor: 'pointer',
                borderColor: '#9a8b78',
                background: 'linear-gradient(135deg, #ede6dc 0%, #e8dfd4 100%)',
                borderWidth: 2,
              }}
            >
              <RocketOutlined style={{ fontSize: 36, color: '#b55233', marginBottom: 12, display: 'block' }} />
              <div style={{ lineHeight: 1.4 }}>
                <Text strong style={{ fontSize: 15 }}>{t('moduleRoninPro')}</Text>
              </div>
              <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12, lineHeight: 1.4, ...HOME_DESC_TEXT }}>
                {t('moduleRoninProDesc')}
              </Text>
            </Card>
          </Col>
        </Row>
      )}
      <Row gutter={24} style={{ marginTop: 8, marginBottom: 24 }} align="stretch">
        <Col xs={24} md={12} style={{ display: 'flex' }}>
          <Card
            hoverable
            onClick={() => onSelect('aiPixelAnimals')}
            styles={{ body: HOME_CARD_BODY_LARGE_GROW }}
            style={{
              textAlign: 'center',
              cursor: 'pointer',
              borderColor: '#9a8b78',
              background: 'linear-gradient(135deg, #ede6dc 0%, #e8dfd4 100%)',
              borderWidth: 2,
              flex: 1,
              width: '100%',
            }}
          >
            <BugOutlined style={{ fontSize: 36, color: '#b55233', marginBottom: 12, display: 'block' }} />
            <div style={{ lineHeight: 1.4 }}>
              <Text strong style={{ fontSize: 15 }}>{t('moduleAiPixelAnimals')}</Text>
            </div>
            <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12, lineHeight: 1.4, ...HOME_DESC_TEXT }}>
              {t('moduleAiPixelAnimalsDesc')}
            </Text>
          </Card>
        </Col>
        <Col xs={24} md={12} style={{ display: 'flex' }}>
          <Card
            hoverable
            onClick={() => onSelect('gemPixelPotpourri')}
            styles={{ body: HOME_CARD_BODY_LARGE_GROW }}
            style={{
              textAlign: 'center',
              cursor: 'pointer',
              borderColor: '#9a8b78',
              background: 'linear-gradient(135deg, #ede6dc 0%, #e8dfd4 100%)',
              borderWidth: 2,
              flex: 1,
              width: '100%',
            }}
          >
            <AppstoreOutlined style={{ fontSize: 36, color: '#b55233', marginBottom: 12, display: 'block' }} />
            <div style={{ lineHeight: 1.4 }}>
              <Text strong style={{ fontSize: 15 }}>{t('moduleGemPixelPotpourri')}</Text>
            </div>
            <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12, lineHeight: 1.4, ...HOME_DESC_TEXT }}>
              {t('moduleGemPixelPotpourriDesc')}
            </Text>
          </Card>
        </Col>
      </Row>
      <Row gutter={24} style={{ marginTop: 8, marginBottom: 24 }}>
        <Col xs={24} md={12}>
          <Card
            hoverable
            onClick={() => onSelect('seedanceWatermark')}
            styles={{ body: HOME_CARD_BODY_LARGE }}
            style={{
              textAlign: 'center',
              cursor: 'pointer',
              borderColor: '#9a8b78',
              background: 'linear-gradient(135deg, #ede6dc 0%, #e8dfd4 100%)',
              borderWidth: 2,
              height: '100%',
            }}
          >
            <VideoCameraOutlined style={{ fontSize: 36, color: '#b55233', marginBottom: 12, display: 'block' }} />
            <div style={{ lineHeight: 1.4 }}>
              <Text strong style={{ fontSize: 15 }}>{t('moduleSeedanceWatermarkRemover')}</Text>
            </div>
            <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12, lineHeight: 1.4, ...HOME_DESC_TEXT }}>
              {t('moduleSeedanceWatermarkRemoverDesc')}
            </Text>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card
            hoverable
            onClick={() => onSelect('assetsAndSource')}
            styles={{ body: HOME_CARD_BODY_LARGE }}
            style={{
              textAlign: 'center',
              cursor: 'pointer',
              borderColor: '#9a8b78',
              background: 'linear-gradient(135deg, #ede6dc 0%, #e8dfd4 100%)',
              borderWidth: 2,
              height: '100%',
            }}
          >
            <ShareAltOutlined style={{ fontSize: 36, color: '#b55233', marginBottom: 12, display: 'block' }} />
            <div style={{ lineHeight: 1.4 }}>
              <Text strong style={{ fontSize: 15 }}>{t('moduleAssetsAndSource')}</Text>
            </div>
            <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12, lineHeight: 1.4, ...HOME_DESC_TEXT }}>
              {t('moduleAssetsAndSourceDesc')}
            </Text>
          </Card>
        </Col>
      </Row>
    </>
  )
}
