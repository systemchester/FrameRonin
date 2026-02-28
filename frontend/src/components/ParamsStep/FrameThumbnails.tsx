import { Checkbox } from 'antd'
import { useLanguage } from '../../i18n/context'

interface Props {
  frames: { blob: Blob; dataUrl: string }[]
  selected: boolean[]
  onSelectionChange: (index: number, checked: boolean) => void
  duplicateMarkers?: Map<number, { groupId: number; totalInGroup: number }>
}

export default function FrameThumbnails({
  frames,
  selected,
  onSelectionChange,
  duplicateMarkers,
}: Props) {
  const { t } = useLanguage()
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        paddingBottom: 8,
        marginBottom: 16,
      }}
    >
      {frames.map((f, i) => {
        const dup = duplicateMarkers?.get(i)
        return (
          <div
            key={i}
            style={{
              width: 88,
              textAlign: 'center',
              border: dup ? '2px solid #a63d2e' : '1px solid #9a8b78',
              borderRadius: 6,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div style={{ position: 'absolute', top: 4, right: 4, zIndex: 1 }}>
              <Checkbox
                checked={selected[i]}
                onChange={(e) => onSelectionChange(i, e.target.checked)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            {dup && (
              <div
                style={{
                  position: 'absolute',
                  top: 4,
                  left: 4,
                  zIndex: 1,
                  background: '#a63d2e',
                  color: '#f0e6d4',
                  fontSize: 10,
                  padding: '1px 4px',
                  borderRadius: 4,
                }}
              >
                {t('duplicate', { n: dup.totalInGroup })}
              </div>
            )}
            <img
              src={f.dataUrl}
              alt={`${t('frame')} ${i + 1}`}
              loading="eager"
              style={{ width: '100%', height: 66, objectFit: 'contain', display: 'block', backgroundColor: '#e4dbcf' }}
            />
            <div style={{ background: dup ? '#a63d2e' : '#2c2520', color: '#e8dcc8', fontSize: 11, padding: '2px 0' }}>
              {t('frame')} {i + 1}
            </div>
          </div>
        )
      })}
    </div>
  )
}
