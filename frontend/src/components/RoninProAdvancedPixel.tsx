import { Empty, Typography } from 'antd'
import { useLanguage } from '../i18n/context'

/**
 * RoninPro — 高级像素处理算法（占位：具体能力后续接入）
 */
export default function RoninProAdvancedPixel() {
  const { t } = useLanguage()

  return (
    <div style={{ maxWidth: 720 }}>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 24 }}>
        {t('roninProAdvancedPixelHint')}
      </Typography.Paragraph>
      <Empty description={t('roninProAdvancedPixelEmpty')} />
    </div>
  )
}
