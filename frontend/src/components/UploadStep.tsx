import { InboxOutlined } from '@ant-design/icons'
import { Button, Upload, Space, Typography, message } from 'antd'
import type { UploadFile } from 'antd'
import { useLanguage } from '../i18n/context'

const { Dragger } = Upload
const { Text } = Typography

const ALLOWED = ['.mp4', '.mov', '.webm', '.avi', '.mkv']

interface Props {
  file: File | null
  onFileChange: (f: File | null) => void
  onNext: () => void
}

export default function UploadStep({ file, onFileChange, onNext }: Props) {
  const { t } = useLanguage()
  return (
    <Space direction="vertical" size="large" style={{ width: '100%', paddingTop: 8 }}>
      <Dragger
        name="file"
        multiple={false}
        accept={ALLOWED.join(',')}
        maxCount={1}
        fileList={
          file ? [{ uid: '1', name: file.name, size: file.size } as UploadFile] : []
        }
        beforeUpload={(f) => {
          const ext = '.' + (f.name.split('.').pop() || '').toLowerCase()
          if (!ALLOWED.includes(ext)) {
            message.error(t('formatError', { formats: ALLOWED.join(' ') }))
            return Upload.LIST_IGNORE
          }
          if (f.size > 200 * 1024 * 1024) {
            message.error(t('sizeError'))
            return Upload.LIST_IGNORE
          }
          onFileChange(f)
          return false
        }}
        onRemove={() => onFileChange(null)}
        style={{ padding: 48 }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined style={{ fontSize: 64, color: '#b55233' }} />
        </p>
        <p className="ant-upload-text">{t('uploadHint')}</p>
        <p className="ant-upload-hint">{t('uploadFormats')}</p>
      </Dragger>
      {file && (
        <Text type="secondary">
          {t('selected')}: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
        </Text>
      )}
      <Button type="primary" size="large" onClick={onNext} disabled={!file}>
        {t('nextStep')}
      </Button>
    </Space>
  )
}
