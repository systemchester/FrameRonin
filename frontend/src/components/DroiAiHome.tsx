import {
  BgColorsOutlined,
  BorderOuterOutlined,
  EnvironmentOutlined,
  GlobalOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { Segmented, Tooltip } from 'antd'
import type { CSSProperties, ReactNode } from 'react'
import { useLanguage } from '../i18n/context'
import type { Lang } from '../i18n/locales'
import './DroiAiHome.css'

type HomeEntry = {
  key: string
  title: string
  label: string
  description: string
  icon: ReactNode
  onClick: () => void
}

const homeCopy = {
  en: {
    eyebrow: 'Droi-game-tool',
    title: 'Choose a production tool',
    subtitle: 'Map stitching, obstacle collision editing, AI background removal, and character action-pack creation live here.',
    stitchTitle: 'Map Stitch',
    stitchDesc: 'Upload a center map tile, extend it in four directions, and blend the seams into a larger base map.',
    obstaclesTitle: 'Obstacle Editor',
    obstaclesDesc: 'Upload obstacle art, remove the background automatically, place it on the map, and export collision JSON.',
    matteTitle: 'AI Matte',
    matteDesc: 'Upload PNG, JPG, or WebP art and generate a transparent PNG asset.',
    motionTitle: 'Action Pack Maker',
    motionDesc: 'Upload a base character, generate action candidates, align weapons and effects, then export a game-ready pack.',
  },
  zh: {
    eyebrow: 'Droi-game-tool',
    title: '选择一个生产工具',
    subtitle: '地图拼接、阻挡物碰撞、AI 去背和人物动作包制作都集中在这里。',
    stitchTitle: '拼接底图',
    stitchDesc: '上传中心地图，按四方向扩展并柔化接缝，生成更大的底图。',
    obstaclesTitle: '阻挡物编辑',
    obstaclesDesc: '上传阻挡物素材，自动去背后拖动摆放并导出碰撞 JSON。',
    matteTitle: 'AI 去背',
    matteDesc: '上传 PNG、JPG 或 WebP 素材，生成透明 PNG。',
    motionTitle: '动作包制作',
    motionDesc: '上传基础人物，生成动作候选，配置武器与特效后导出游戏可用动作包。',
  },
  ja: {
    eyebrow: 'Droi-game-tool',
    title: '制作ツールを選択',
    subtitle: 'マップ結合、障害物編集、AI 背景除去、キャラクター動作パック制作をここに集約しています。',
    stitchTitle: 'マップ結合',
    stitchDesc: '中央マップを読み込み、四方向に拡張して継ぎ目をなじませます。',
    obstaclesTitle: '障害物編集',
    obstaclesDesc: '障害物素材を自動背景除去し、配置して当たり判定 JSON を出力します。',
    matteTitle: 'AI マット',
    matteDesc: 'PNG、JPG、WebP を読み込み、透明 PNG 素材を生成します。',
    motionTitle: '動作パック制作',
    motionDesc: 'ベースキャラクターから動作候補を生成し、武器とエフェクトを調整して書き出します。',
  },
}

export default function DroiAiHome({
  onOpenMapStitch,
  onOpenObstacleEditor,
  onOpenMatte,
  onOpenCharacterMotion,
}: {
  onOpenMapStitch: () => void
  onOpenObstacleEditor: () => void
  onOpenMatte: () => void
  onOpenCharacterMotion: () => void
}) {
  const { lang, setLang } = useLanguage()
  const copy = homeCopy[lang]
  const entries: HomeEntry[] = [
    {
      key: 'stitch',
      title: copy.stitchTitle,
      label: 'Map Stitch',
      description: copy.stitchDesc,
      icon: <BorderOuterOutlined />,
      onClick: onOpenMapStitch,
    },
    {
      key: 'obstacles',
      title: copy.obstaclesTitle,
      label: 'Collision Edit',
      description: copy.obstaclesDesc,
      icon: <EnvironmentOutlined />,
      onClick: onOpenObstacleEditor,
    },
    {
      key: 'matte',
      title: copy.matteTitle,
      label: 'Art Matte',
      description: copy.matteDesc,
      icon: <BgColorsOutlined />,
      onClick: onOpenMatte,
    },
    {
      key: 'motion',
      title: copy.motionTitle,
      label: 'Action Pack',
      description: copy.motionDesc,
      icon: <ThunderboltOutlined />,
      onClick: onOpenCharacterMotion,
    },
  ]

  return (
    <section className="droi-home">
      <div className="droi-home-bg droi-home-bg-a" />
      <div className="droi-home-bg droi-home-bg-b" />
      <div className="droi-home-scanline" />

      <div className="droi-home-inner">
        <div className="droi-home-language">
          <Tooltip title="Language">
            <GlobalOutlined />
          </Tooltip>
          <Segmented<Lang>
            size="small"
            value={lang}
            onChange={setLang}
            options={[
              { label: 'EN', value: 'en' },
              { label: '中文', value: 'zh' },
              { label: '日本語', value: 'ja' },
            ]}
          />
        </div>

        <div className="droi-home-heading">
          <span>{copy.eyebrow}</span>
          <h2>{copy.title}</h2>
          <p>{copy.subtitle}</p>
        </div>

        <div className="droi-home-grid">
          {entries.map((entry, index) => (
            <button
              key={entry.key}
              type="button"
              className="droi-home-card"
              style={{ '--entry-index': index } as CSSProperties}
              onClick={entry.onClick}
            >
              <span className="droi-home-card-label">{entry.label}</span>
              <span className="droi-home-card-icon">{entry.icon}</span>
              <strong>{entry.title}</strong>
              <small>{entry.description}</small>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
