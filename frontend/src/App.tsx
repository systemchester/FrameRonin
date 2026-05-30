import { useEffect, useState } from 'react'
import { App as AntdApp, ConfigProvider, Layout } from 'antd'
import enUS from 'antd/locale/en_US'
import jaJP from 'antd/locale/ja_JP'
import zhCN from 'antd/locale/zh_CN'
import type { ThemeConfig } from 'antd'
import DroiAiHome from './components/DroiAiHome'
import DroiArtMatte from './components/DroiArtMatte'
import MapStudio, { type MapStudioMode } from './features/map-studio/MapStudio'
import CharacterActionComposer from './features/character-action/CharacterActionComposer'
import { useLanguage } from './i18n/context'
import './App.css'

type DroiMode = null | 'mapStudio' | 'matte' | 'characterAction'

const { Content } = Layout
const antdLocales = { en: enUS, zh: zhCN, ja: jaJP }

const droiTheme: ThemeConfig = {
  token: {
    colorPrimary: '#5fc7e8',
    colorPrimaryHover: '#82d7ef',
    colorPrimaryActive: '#36a9cf',
    colorBgBase: '#060b18',
    colorBgLayout: '#060b18',
    colorBgContainer: '#10162f',
    colorBgElevated: '#111a36',
    colorText: '#ffffff',
    colorTextSecondary: '#aeb4cf',
    colorBorder: 'rgba(116, 229, 255, 0.22)',
    colorBorderSecondary: 'rgba(116, 229, 255, 0.14)',
    colorFillSecondary: 'rgba(116, 229, 255, 0.08)',
    borderRadius: 8,
  },
  components: {
    Button: {
      primaryShadow: '0 14px 34px rgba(95, 199, 232, 0.2)',
    },
    Card: {
      colorBgContainer: 'rgba(16, 22, 47, 0.86)',
      colorBorderSecondary: 'rgba(116, 229, 255, 0.18)',
    },
  },
}

function App() {
  const { lang } = useLanguage()
  const [mode, setMode] = useState<DroiMode>(null)
  const [mapStudioInitialMode, setMapStudioInitialMode] = useState<MapStudioMode>('stitch')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (mode === null) return
      if (event.code !== 'Escape' && event.code !== 'KeyB') return
      if (event.ctrlKey || event.metaKey || event.altKey) return

      const activeElement = document.activeElement
      const tag = activeElement?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return
      if (activeElement instanceof HTMLElement && activeElement.isContentEditable) return

      event.preventDefault()
      setMode(null)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mode])

  return (
    <ConfigProvider locale={antdLocales[lang]} theme={droiTheme}>
      <AntdApp>
        <Layout className="app-layout app-layout-droi">
          <Content className="app-content app-content-droi">
            {mode === null ? (
              <DroiAiHome
                onOpenMapStitch={() => {
                  setMapStudioInitialMode('stitch')
                  setMode('mapStudio')
                }}
                onOpenObstacleEditor={() => {
                  setMapStudioInitialMode('obstacles')
                  setMode('mapStudio')
                }}
                onOpenMatte={() => setMode('matte')}
                onOpenCharacterMotion={() => setMode('characterAction')}
              />
            ) : mode === 'mapStudio' ? (
              <MapStudio initialMode={mapStudioInitialMode} onBack={() => setMode(null)} showBack />
            ) : mode === 'matte' ? (
              <DroiArtMatte onBack={() => setMode(null)} />
            ) : (
              <CharacterActionComposer onBack={() => setMode(null)} />
            )}
          </Content>
        </Layout>
      </AntdApp>
    </ConfigProvider>
  )
}

export default App
