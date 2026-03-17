import { Button, Divider, Space, Typography } from 'antd'
import { GithubOutlined, CloudDownloadOutlined, RocketOutlined } from '@ant-design/icons'
import { useLanguage } from '../i18n/context'

const { Text } = Typography

const GITHUB_REPO_URL = 'https://github.com/systemchester/FrameRonin'
const ASSETS_URL = 'https://github.com/systemchester/Spritesheetweapon/tree/master/01-%E7%BE%8E%E6%9C%AF'
const GITHUB_RELEASES_URL = 'https://github.com/systemchester/FrameRonin/releases'
const GODOT_CODE_URL = 'https://github.com/systemchester/Spritesheetweapon/tree/master/02-%E7%A8%8B%E5%BA%8F/godot%E8%84%9A%E6%9C%AC'
// TODO: 替换为成品项目链接
const FINISHED_PROJECT_URL = 'https://github.com/systemchester/Spritesheetweapon'
const AI_PIXEL_SHOP_URL = 'https://github.com/systemchester/Spritesheetweapon/tree/master/05-%E6%88%90%E5%93%81%E9%A1%B9%E7%9B%AE/AI%E5%83%8F%E7%B4%A0%E5%95%86K'

export default function AssetsAndSourceShare() {
  const { t } = useLanguage()

  return (
    <>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        {t('assetsAndSourceHint')}
      </Text>

      <div style={{ marginBottom: 24 }}>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>{t('assetsAndSourceCode')}</Text>
        <Button
          type="primary"
          icon={<GithubOutlined />}
          onClick={() => window.open(GITHUB_REPO_URL, '_blank')}
        >
          {t('assetsAndSourceRepo')}
        </Button>
        <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
          {t('assetsAndSourceRepoDesc')}
        </Text>
      </div>

      <Divider />

      <div style={{ marginBottom: 24 }}>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>{t('assetsAndSourceDownloads')}</Text>
        <Button
          icon={<CloudDownloadOutlined />}
          onClick={() => window.open(ASSETS_URL, '_blank')}
        >
          {t('assetsAndSourceReleases')}
        </Button>
        <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
          {t('assetsAndSourceReleasesDesc')}
        </Text>
      </div>

      <Divider />

      <div style={{ marginBottom: 24 }}>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>{t('assetsAndSourceFinishedProject')}</Text>
        <Space wrap>
          <Button
            icon={<RocketOutlined />}
            onClick={() => window.open(FINISHED_PROJECT_URL, '_blank')}
          >
            {t('assetsAndSourceFinishedProjectBtn')}
          </Button>
          <Button onClick={() => window.open(AI_PIXEL_SHOP_URL, '_blank')}>
            {t('assetsAndSourceAiPixelShop')}
          </Button>
        </Space>
        <div style={{ marginTop: 12 }}>
          <img
            src={`${import.meta.env.BASE_URL}K.png`}
            alt="AI像素商K"
            style={{
              display: 'block',
              maxWidth: '100%',
              width: 360,
              borderRadius: 8,
              border: '1px solid rgba(154, 139, 120, 0.5)',
              imageRendering: 'pixelated',
            }}
          />
        </div>
      </div>

      <Divider />

      <div>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>{t('assetsAndSourceBilibili')}</Text>
        <Button onClick={() => window.open(GODOT_CODE_URL, '_blank')}>
          {t('assetsAndSourceGodotBtn')}
        </Button>
      </div>
    </>
  )
}
