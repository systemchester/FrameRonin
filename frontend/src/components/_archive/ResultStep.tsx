/**
 * 归档：服务端任务结果展示（依赖后端 API /jobs/{id}/result）。
 * 当前应用采用纯前端处理，此组件暂未使用。
 * 若需启用服务端模式，可移回 components/ 并接入 App。
 */
import { Button, Image, Space, Typography } from 'antd'
import { DownloadOutlined, FileZipOutlined } from '@ant-design/icons'
import { getResultUrl, getIndexUrl } from '../../api'

const { Title, Paragraph } = Typography

interface Props {
  jobId: string
  onReset: () => void
}

export default function ResultStep({ jobId, onReset }: Props) {
  const pngUrl = getResultUrl(jobId, 'png')
  const zipUrl = getResultUrl(jobId, 'zip')
  const indexUrl = getIndexUrl(jobId)

  return (
    <Space direction="vertical" size="large" style={{ width: '100%', paddingTop: 8 }}>
      <Title level={5}>生成完成</Title>
      <div
        style={{
          maxWidth: '100%',
          overflow: 'auto',
          border: '1px solid #9a8b78',
          borderRadius: 8,
          padding: 8,
          background: '#e4dbcf',
        }}
      >
        <Image src={pngUrl} alt="Sprite Sheet" style={{ maxHeight: 400 }} />
      </div>
      <Space>
        <Button type="primary" icon={<DownloadOutlined />} href={pngUrl} download="sprite.png">
          下载 PNG
        </Button>
        <Button icon={<FileZipOutlined />} href={zipUrl} download="sprite_sheet.zip">
          下载 ZIP (PNG + JSON)
        </Button>
        <Button href={indexUrl} download="index.json">
          下载索引 JSON
        </Button>
      </Space>
      <Paragraph type="secondary">
        索引 JSON 可用于游戏/前端动画，每帧包含 i, x, y, w, h, t 等坐标与时间戳信息。
      </Paragraph>
      <Button onClick={onReset}>重新开始</Button>
    </Space>
  )
}
