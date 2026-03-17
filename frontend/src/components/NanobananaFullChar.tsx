import { Button, Space, Typography } from 'antd'
import { useLanguage } from '../i18n/context'

const { Text } = Typography

const GEM_V4TX3_URL = 'https://gemini.google.com/gem/1zerS4eXHUGNj2tj-63omHyFRo_4K5S7p?usp=sharing'
const GEM_HORIZONTAL_CHAR_URL = 'https://gemini.google.com/gem/10LatqlJGxea-I-JCyoNo1rERgZwtKpBi?usp=sharing'
const GEM_8DIR_TOPDOWN_URL = 'https://gemini.google.com/gem/1Xr3TdyAOLugE19v5poA4LpJSfVT4Drox?usp=sharing'
const GEM_HORSE_RIDING_URL = 'https://gemini.google.com/gem/1n--WxKek4kEZO_gqQeab-u5b3mO-qyl1?usp=sharing'
const GEM_ONE_IMAGE_ALL_ACTIONS_URL = 'https://gemini.google.com/gem/1XmXCenVbvcXFRy70C-9W9bI49RNMgRTj?usp=sharing'

const HORIZONTAL_CHAR_GIFS = ['h2s1 (1).gif', 'h2s1 (2).gif', 'h2s1 (3).gif', 'h2s1 (4).gif', 'h2s1 (5).gif']
const D8S_TOPDOWN_GIFS = ['d8s (1).gif', 'd8s (2).gif', 'd8s (3).gif', 'd8s (4).gif', 'd8s (5).gif']

const V4TX3_GIFS = ['A2M_row1.gif', 'A2M_row3.gif', 'row_01.gif', 'row_02.gif', 'row_03.gif', 'row_04.gif', 'row_05.gif', 'jump.gif', 'attack.gif', 'spr.gif']

const OTF_ALL_ACTIONS_GIFS = ['otf (1).gif', 'otf (2).gif', 'otf (3).gif', 'otf (4).gif', 'otf (5).gif', 'otf (6).gif']

export default function NanobananaFullChar() {
  const { t } = useLanguage()

  return (
    <>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        {t('nanobananaFullCharHint')}
      </Text>
      <div>
        <Button
          type="primary"
          onClick={() => window.open(GEM_V4TX3_URL, '_blank')}
        >
          {t('nanobananaFullCharBtn1')}
        </Button>
        <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
          {t('nanobananaFullCharBtn1Note')}
        </Text>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${V4TX3_GIFS.length}, 1fr)`, gap: 8, marginTop: 8, width: '100%' }}>
          {V4TX3_GIFS.map((name) => (
            <img
              key={name}
              src={`${import.meta.env.BASE_URL}${name}`}
              alt={name}
              style={{ width: '100%', aspectRatio: 1, objectFit: 'contain', imageRendering: 'pixelated', border: '1px solid rgba(0,0,0,0.1)' }}
            />
          ))}
        </div>
      </div>
      <div style={{ marginTop: 24 }}>
        <Button type="primary" onClick={() => window.open(GEM_HORIZONTAL_CHAR_URL, '_blank')}>
          {t('nanobananaFullCharBtn2')}
        </Button>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${HORIZONTAL_CHAR_GIFS.length}, 1fr)`, gap: 8, marginTop: 8, width: '100%' }}>
          {HORIZONTAL_CHAR_GIFS.map((name) => (
            <img
              key={name}
              src={`${import.meta.env.BASE_URL}${encodeURI(name)}`}
              alt={name}
              style={{ width: '100%', aspectRatio: 1, objectFit: 'contain', imageRendering: 'pixelated', border: '1px solid rgba(0,0,0,0.1)' }}
            />
          ))}
        </div>
      </div>
      <div style={{ marginTop: 24 }}>
        <Button type="primary" onClick={() => window.open(GEM_8DIR_TOPDOWN_URL, '_blank')}>
          {t('nanobananaFullCharBtn3')}
        </Button>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${D8S_TOPDOWN_GIFS.length}, 1fr)`, gap: 8, marginTop: 8, width: '100%' }}>
          {D8S_TOPDOWN_GIFS.map((name) => (
            <img
              key={name}
              src={`${import.meta.env.BASE_URL}${encodeURI(name)}`}
              alt={name}
              style={{ width: '100%', aspectRatio: 1, objectFit: 'contain', imageRendering: 'pixelated', border: '1px solid rgba(0,0,0,0.1)' }}
            />
          ))}
        </div>
      </div>
      <div style={{ marginTop: 24 }}>
        <Button type="primary" onClick={() => window.open(GEM_HORSE_RIDING_URL, '_blank')}>
          {t('nanobananaFullCharBtn4')}
        </Button>
        <div style={{ marginTop: 8, width: '100%', maxWidth: 200 }}>
          <img
            src={`${import.meta.env.BASE_URL}ride.gif`}
            alt="ride"
            style={{ width: '100%', objectFit: 'contain', imageRendering: 'pixelated', border: '1px solid rgba(0,0,0,0.1)' }}
          />
        </div>
      </div>
      <div style={{ marginTop: 24 }}>
        <Button
          type="primary"
          onClick={() => window.open(GEM_ONE_IMAGE_ALL_ACTIONS_URL, '_blank')}
        >
          {t('nanobananaFullCharBtn5')}
        </Button>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${OTF_ALL_ACTIONS_GIFS.length}, 1fr)`, gap: 8, marginTop: 8, width: '100%' }}>
          {OTF_ALL_ACTIONS_GIFS.map((name) => (
            <img
              key={name}
              src={`${import.meta.env.BASE_URL}${encodeURI(name)}`}
              alt={name}
              style={{ width: '100%', aspectRatio: 1, objectFit: 'contain', imageRendering: 'pixelated', border: '1px solid rgba(0,0,0,0.1)' }}
            />
          ))}
        </div>
      </div>
    </>
  )
}

