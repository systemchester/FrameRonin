import { ArrowLeftOutlined } from '@ant-design/icons'
import { Button, Segmented, Typography } from 'antd'
import { useState } from 'react'
import { useLanguage } from '../../i18n/context'
import MapComposer from './MapComposer'
import ObstaclePainter from './ObstaclePainter'
import './MapStudio.css'

const { Text, Title } = Typography
export type MapStudioMode = 'stitch' | 'obstacles'

const mapStudioCopy = {
  en: {
    back: 'Back Home',
    kicker: 'Droi-game-tool Map Tool',
    stitchTitle: 'Map Stitch',
    stitchSubtitle: 'Upload a center map and extend it in four directions with softened seams.',
    obstaclesTitle: 'Obstacle Editor',
    obstaclesSubtitle: 'Upload obstacle images, remove backgrounds automatically, place them, and export collision PNG / JSON.',
    stitchTab: 'Map Stitch',
    obstaclesTab: 'Obstacle Editor',
  },
  zh: {
    back: '返回首页',
    kicker: 'Droi-game-tool 地图工具',
    stitchTitle: '拼接底图',
    stitchSubtitle: '上传中心地图，按四方向拼接底图并自动柔化接缝。',
    obstaclesTitle: '阻挡物编辑',
    obstaclesSubtitle: '上传阻挡物图片自动去背，拖动摆放并导出碰撞 PNG / JSON。',
    stitchTab: '拼接底图',
    obstaclesTab: '阻挡物编辑',
  },
  ja: {
    back: 'ホームへ戻る',
    kicker: 'Droi-game-tool マップツール',
    stitchTitle: 'マップ結合',
    stitchSubtitle: '中央マップを読み込み、四方向に拡張して継ぎ目をなじませます。',
    obstaclesTitle: '障害物編集',
    obstaclesSubtitle: '障害物画像を自動背景除去し、配置して当たり判定 PNG / JSON を出力します。',
    stitchTab: 'マップ結合',
    obstaclesTab: '障害物編集',
  },
}

export default function MapStudio({
  initialMode = 'stitch',
  onBack,
  showBack = true,
}: {
  initialMode?: MapStudioMode
  onBack?: () => void
  showBack?: boolean
}) {
  const { lang } = useLanguage()
  const copy = mapStudioCopy[lang]
  const [mode, setMode] = useState<MapStudioMode>(initialMode)
  const [stitchedMapFile, setStitchedMapFile] = useState<File | null>(null)
  const pageCopy = mode === 'stitch'
    ? { title: copy.stitchTitle, subtitle: copy.stitchSubtitle }
    : { title: copy.obstaclesTitle, subtitle: copy.obstaclesSubtitle }

  return (
    <div className="map-studio-page">
      <div className="map-studio-bg map-studio-bg-far" />
      <div className="map-studio-bg map-studio-bg-mid" />
      <div className="map-studio-bg map-studio-bg-near" />
      <div className="map-studio-scanline" />

      <header className={`map-studio-header ${showBack ? '' : 'map-studio-header-direct'}`}>
        {showBack && (
          <Button className="map-studio-back" icon={<ArrowLeftOutlined />} onClick={onBack}>
            {copy.back}
          </Button>
        )}
        <div className="map-studio-heading">
          <Text className="map-studio-kicker">{copy.kicker}</Text>
          <Title level={2}>{pageCopy.title}</Title>
          <Text className="map-studio-subtitle">{pageCopy.subtitle}</Text>
        </div>
        <Segmented<MapStudioMode>
          className="map-studio-mode-switch"
          value={mode}
          onChange={setMode}
          options={[
            { label: copy.stitchTab, value: 'stitch' },
            { label: copy.obstaclesTab, value: 'obstacles' },
          ]}
        />
      </header>

      <div className={`map-studio-mode-panel ${mode === 'stitch' ? 'is-active' : ''}`} aria-hidden={mode !== 'stitch'}>
        <MapComposer
          active={mode === 'stitch'}
          onUseStitchedMap={(file) => {
            setStitchedMapFile(file)
            setMode('obstacles')
          }}
        />
      </div>
      <div className={`map-studio-mode-panel ${mode === 'obstacles' ? 'is-active' : ''}`} aria-hidden={mode !== 'obstacles'}>
        <ObstaclePainter initialMapFile={stitchedMapFile} />
      </div>
    </div>
  )
}
