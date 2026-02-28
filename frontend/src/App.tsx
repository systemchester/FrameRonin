import { useState } from 'react'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { Button, Card, ConfigProvider, Layout, Steps } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import enUS from 'antd/locale/en_US'
import jaJP from 'antd/locale/ja_JP'
import type { ThemeConfig } from 'antd'
import { useLanguage } from './i18n/context'
import ImageResizeStroke from './components/ImageResizeStroke'
import ModeSelector, { type AppMode } from './components/ModeSelector'
import ParamsStep from './components/ParamsStep'
import UploadStep from './components/UploadStep'
import type { JobParams } from './api'
import type { Lang } from './i18n/locales'
import './App.css'

const { Header, Content, Footer } = Layout

const antdLocales: Record<Lang, typeof zhCN> = { zh: zhCN, en: enUS, ja: jaJP }

export type Step = 'upload' | 'params'

const STEP_KEYS: Step[] = ['upload', 'params']

function App() {
  const { lang, setLang, t } = useLanguage()
  const [mode, setMode] = useState<AppMode>(null)
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
      <div className="app-contact-float">
        <span className="app-contact-float-label">{t('contactLabel')}</span>
        <a href="https://space.bilibili.com/285760" target="_blank" rel="noopener noreferrer">Bilibili</a>
        <span className="app-contact-float-sep">·</span>
        <a href="https://wpa.qq.com/msgrd?v=3&uin=719937402&site=qq&menu=yes" target="_blank" rel="noopener noreferrer">QQ 719937402</a>
      </div>
      <Layout className="app-layout">
        <Header className="app-header">
          <div className="app-header-bg" aria-hidden="true" />
          <div className="app-header-content">
            <div className="app-header-left">
              <img src={`${import.meta.env.BASE_URL}logopix.png`} alt="FrameRonin" className="app-header-logo" />
              <div className="app-header-text">
                <div className="app-header-row">
                  <h1 className="app-header-brand">FrameRonin</h1>
                  <span className="app-header-ver">v1.6</span>
                </div>
                <p className="app-header-subtitle">{t('subtitle')}</p>
              </div>
            </div>
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
          </div>
        </Header>
        <Content className="app-content">
          {mode === null ? (
            <Card>
              <ModeSelector onSelect={setMode} />
            </Card>
          ) : mode === 'image' ? (
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
              <ImageResizeStroke />
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
            </div>
          </div>
        </Footer>
      </Layout>
    </ConfigProvider>
  )
}

export default App
