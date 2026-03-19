import { lazy, Suspense, useState, useEffect } from 'react'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { App as AntdApp, Button, Card, ConfigProvider, Layout, message, Spin, Steps } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import enUS from 'antd/locale/en_US'
import jaJP from 'antd/locale/ja_JP'
import type { ThemeConfig } from 'antd'
import { AuthProvider, useAuth } from './auth/context'
import { ImageStashProvider } from './stash/context'
import { useLanguage } from './i18n/context'
import ImageStashPanel from './components/ImageStashPanel'
import GifFrameConverter from './components/GifFrameConverter'
import RoninLoginButton from './components/RoninLoginButton'
import ImageExpandShrink from './components/ImageExpandShrink'
import ImagePixelate from './components/ImagePixelate'
import ImageResizeStroke from './components/ImageResizeStroke'
import ImageModuleEntry, { type ImageSubMode } from './components/ImageResizeStroke/ImageModuleEntry'
import ImageFineProcess from './components/ImageResizeStroke/ImageFineProcess'
import ModeSelector, { type AppMode } from './components/ModeSelector'
import SpriteSheetTool from './components/SpriteSheetTool'
import SpriteSheetAdjust from './components/SpriteSheetAdjust'
import ImageGeminiWatermark from './components/ImageGeminiWatermark'
import NanobananaFullChar from './components/NanobananaFullChar'
import SeedanceWatermarkRemover from './components/SeedanceWatermarkRemover'
import AssetsAndSourceShare from './components/AssetsAndSourceShare'
import ControlTest from './components/ControlTest'
import RoninPro from './components/RoninPro'

const ImageMatte = lazy(() => import('./components/ImageMatte'))
import ParamsStep from './components/ParamsStep'
import UploadStep from './components/UploadStep'
import type { JobParams } from './api'
import type { Lang } from './i18n/locales'
import './App.css'

const { Header, Content, Footer } = Layout

const antdLocales: Record<Lang, typeof zhCN> = { zh: zhCN, en: enUS, ja: jaJP }

function getGemToken(): number {
  const now = new Date()
  const D = now.getUTCDate()
  const H = now.getUTCHours()
  return (D * 7) + (H * 13) + 520
}

export type Step = 'upload' | 'params'

const STEP_KEYS: Step[] = ['upload', 'params']

function AppHeaderRight({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const { t } = useLanguage()
  const { isConnected } = useAuth()
  return (
    <>
      <div className="app-header-lang">
        {(['zh', 'en', 'ja'] as const).map((l) => (
          <button
            key={l}
            type="button"
            className={`app-header-lang-btn ${lang === l ? 'active' : ''}`}
            onClick={() => setLang(l)}
          >
            {l === 'zh' ? '中' : l === 'en' ? 'EN' : '日'}
          </button>
        ))}
      </div>
      {!isConnected && <span className="app-header-ronin-hint">{t('roninLoginHint')}</span>}
      <RoninLoginButton />
    </>
  )
}

function App() {
  const { lang, setLang, t } = useLanguage()
  const [gemToken, setGemToken] = useState(() => getGemToken())
  const [mode, setMode] = useState<AppMode>(null)
  const [imageSubMode, setImageSubMode] = useState<ImageSubMode | 'select'>('select')

  useEffect(() => {
    const id = setInterval(() => setGemToken(getGemToken()), 60_000)
    return () => clearInterval(id)
  }, [])
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [params, setParams] = useState<JobParams>({
    fps: 12,
    frame_range: { start_sec: 0, end_sec: 5 },
    max_frames: 300,
    target_size: { w: 256, h: 256 },
    transparent: true,
    padding: 4,
    spacing: 4,
    layout_mode: 'fixed_columns',
    columns: 12,
    matte_strength: 0.6,
    crop_mode: 'tight_bbox',
  })
  const currentStep = STEP_KEYS.indexOf(step)

  const wastelandTheme: ThemeConfig = {
    token: {
      colorPrimary: '#b55233',
      colorPrimaryHover: '#c45c3e',
      colorPrimaryActive: '#9a4529',
      colorBorder: '#9a8b78',
      colorBorderSecondary: '#b8a898',
      colorBgContainer: '#ede6dc',
      colorBgLayout: '#c9bfb0',
      colorText: '#3d3428',
      colorTextSecondary: '#6b5d4d',
    },
    components: {
      Card: {
        headerBg: 'transparent',
      },
      Steps: {
        colorPrimary: '#b55233',
        colorText: '#3d3428',
        colorTextDescription: '#6b5d4d',
      },
    },
  }

  return (
    <ConfigProvider locale={antdLocales[lang]} theme={wastelandTheme}>
      <AuthProvider>
      <ImageStashProvider>
      <AntdApp>
      <ImageStashPanel />
      <Layout className="app-layout">
        <Header className="app-header">
          <div className="app-header-bg" aria-hidden="true" />
          <div className="app-header-content">
            <div className="app-header-left">
              <img src={`${import.meta.env.BASE_URL}logopix.png`} alt="FrameRonin" className="app-header-logo" />
              <div className="app-header-text">
                <div className="app-header-row">
                  <h1 className="app-header-brand">FrameRonin</h1>
                  <span className="app-header-ver">v2.1</span>
                </div>
                <p className="app-header-subtitle">{t('subtitle')}</p>
              </div>
            </div>
            <div className="app-header-right">
              <AppHeaderRight lang={lang} setLang={setLang} />
            </div>
          </div>
        </Header>
        <Content
          className="app-content"
          style={mode === 'spriteadjust' ? { maxWidth: 1120, width: '100%' } : undefined}
        >
          {mode === null ? (
            <Card>
              <ModeSelector onSelect={(m) => { setMode(m); if (m === 'image') setImageSubMode('select') }} />
            </Card>
          ) : mode === 'image' ? (
            <Card>
              <div style={{ marginBottom: 16 }}>
                <Button
                  type="text"
                  icon={<ArrowLeftOutlined />}
                  onClick={() => imageSubMode === 'select' ? setMode(null) : setImageSubMode('select')}
                >
                  {imageSubMode === 'select' ? t('backToHome') : t('back')}
                </Button>
              </div>
              {imageSubMode === 'select' ? (
                <ImageModuleEntry onSelect={setImageSubMode} />
              ) : imageSubMode === 'normal' ? (
                <ImageResizeStroke />
              ) : (
                <ImageFineProcess />
              )}
            </Card>
          ) : mode === 'gif' ? (
            <Card>
              <div style={{ marginBottom: 16 }}>
                <Button
                  type="text"
                  icon={<ArrowLeftOutlined />}
                  onClick={() => setMode(null)}
                >
                  {t('backToHome')}
                </Button>
              </div>
              <GifFrameConverter />
            </Card>
          ) : mode === 'spritesheet' ? (
            <Card>
              <div style={{ marginBottom: 16 }}>
                <Button
                  type="text"
                  icon={<ArrowLeftOutlined />}
                  onClick={() => setMode(null)}
                >
                  {t('backToHome')}
                </Button>
              </div>
              <SpriteSheetTool />
            </Card>
          ) : mode === 'pixelate' ? (
            <Card>
              <div style={{ marginBottom: 16 }}>
                <Button
                  type="text"
                  icon={<ArrowLeftOutlined />}
                  onClick={() => setMode(null)}
                >
                  {t('backToHome')}
                </Button>
              </div>
              <ImagePixelate />
            </Card>
          ) : mode === 'expandshrink' ? (
            <Card>
              <div style={{ marginBottom: 16 }}>
                <Button
                  type="text"
                  icon={<ArrowLeftOutlined />}
                  onClick={() => setMode(null)}
                >
                  {t('backToHome')}
                </Button>
              </div>
              <ImageExpandShrink />
            </Card>
          ) : mode === 'matte' ? (
            <Card>
              <div style={{ marginBottom: 16 }}>
                <Button
                  type="text"
                  icon={<ArrowLeftOutlined />}
                  onClick={() => setMode(null)}
                >
                  {t('backToHome')}
                </Button>
              </div>
              <Suspense fallback={<div style={{ padding: 48, textAlign: 'center' }}><Spin size="large" /></div>}>
                <ImageMatte />
              </Suspense>
            </Card>
          ) : mode === 'spriteadjust' ? (
            <Card>
              <div style={{ marginBottom: 16 }}>
                <Button
                  type="text"
                  icon={<ArrowLeftOutlined />}
                  onClick={() => setMode(null)}
                >
                  {t('backToHome')}
                </Button>
              </div>
              <SpriteSheetAdjust />
            </Card>
          ) : mode === 'geminiwatermark' ? (
            <Card>
              <div style={{ marginBottom: 16 }}>
                <Button
                  type="text"
                  icon={<ArrowLeftOutlined />}
                  onClick={() => setMode(null)}
                >
                  {t('backToHome')}
                </Button>
              </div>
              <ImageGeminiWatermark />
            </Card>
          ) : mode === 'nanobananaFullChar' ? (
            <Card>
              <div style={{ marginBottom: 16 }}>
                <Button
                  type="text"
                  icon={<ArrowLeftOutlined />}
                  onClick={() => setMode(null)}
                >
                  {t('backToHome')}
                </Button>
              </div>
              <NanobananaFullChar />
            </Card>
          ) : mode === 'seedanceWatermark' ? (
            <Card>
              <div style={{ marginBottom: 16 }}>
                <Button
                  type="text"
                  icon={<ArrowLeftOutlined />}
                  onClick={() => setMode(null)}
                >
                  {t('backToHome')}
                </Button>
              </div>
              <SeedanceWatermarkRemover />
            </Card>
          ) : mode === 'assetsAndSource' ? (
            <Card>
              <div style={{ marginBottom: 16 }}>
                <Button
                  type="text"
                  icon={<ArrowLeftOutlined />}
                  onClick={() => setMode(null)}
                >
                  {t('backToHome')}
                </Button>
              </div>
              <AssetsAndSourceShare />
            </Card>
          ) : mode === 'controlTest' ? (
            <ControlTest onBack={() => setMode(null)} variant="topdown" />
          ) : mode === 'controlTestArcade' ? (
            <ControlTest onBack={() => setMode(null)} variant="arcade" />
          ) : mode === 'roninPro' ? (
            <Card>
              <RoninPro onBack={() => setMode(null)} />
            </Card>
          ) : (
            <>
              <Steps
                current={currentStep}
                onChange={(idx) => setStep(STEP_KEYS[idx])}
                items={[
                  { title: t('stepUpload') },
                  { title: t('stepParams') },
                ]}
                style={{ marginBottom: 32 }}
              />
              <Card>
                <div style={{ marginBottom: 16 }}>
                  <Button
                    type="text"
                    icon={<ArrowLeftOutlined />}
                    onClick={() => { setMode(null); setStep('upload'); setFile(null) }}
                  >
                    {t('backToHome')}
                  </Button>
                </div>
                {step === 'upload' && (
                  <UploadStep
                    file={file}
                    onFileChange={setFile}
                    onNext={() => setStep('params')}
                  />
                )}
                {step === 'params' && (
                  <ParamsStep
                    file={file}
                    params={params}
                    onParamsChange={setParams}
                  />
                )}
              </Card>
            </>
          )}
        </Content>
        <Footer className="app-footer">
          <div className="app-footer-inner">
            <div className="app-footer-copyright">
              <span>© {new Date().getFullYear()} FrameRonin</span>
              <span className="app-footer-sep">·</span>
              <span className="app-footer-powered">
                {t('poweredBy')}{' '}
                <img src={`${import.meta.env.BASE_URL}ronincat.png`} alt="RoninCat" className="app-footer-avatar" />
                <strong>RoninCat</strong>
              </span>
              <span className="app-footer-sep">·</span>
              <a href="https://github.com/systemchester/FrameRonin" target="_blank" rel="noopener noreferrer" className="app-footer-source">
                {t('footerSourceCode')}
              </a>
              <span className="app-footer-sep">·</span>
              <span className="app-footer-gem-token" title={t('footerGemTokenTitle')}>
                {t('footerGemToken')}: {gemToken}
              </span>
            </div>
            <div className="app-footer-ronin-support">
              {t('footerRoninSupport')}:{' '}
              <span
                role="button"
                tabIndex={0}
                className="app-footer-source app-footer-ronin-address app-footer-ronin-copy"
                onClick={() => {
                  navigator.clipboard.writeText('0xFe15f8251949E3Ce6A311b49a180588b65c8e80C')
                  message.success(t('footerRoninCopySuccess'))
                }}
                onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLSpanElement).click()}
              >
                0xFe15f8251949E3Ce6A311b49a180588b65c8e80C
              </span>
            </div>
          </div>
        </Footer>
      </Layout>
      </AntdApp>
      </ImageStashProvider>
      </AuthProvider>
    </ConfigProvider>
  )
}

export default App
