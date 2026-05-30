import { useEffect, useRef, useState, type DragEvent } from 'react'
import {
  ArrowLeftOutlined,
  BgColorsOutlined,
  DownloadOutlined,
  ReloadOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { App, Button, Spin, Typography } from 'antd'
import { removeBackground } from '../api'
import { useLanguage } from '../i18n/context'
import './DroiArtMatte.css'

const { Text, Title } = Typography
const MAX_IMAGE_MB = 30

const matteCopy = {
  en: {
    back: 'Back Home',
    title: 'AI Matte',
    subtitle: 'Upload game art and generate a transparent PNG for obstacles, characters, props, or UI assets.',
    section: 'Auto Background Remove',
    heading: 'Background removal',
    copy: 'This uses the same Gemini-first matte pipeline as the obstacle editor. Upload an image and it will process automatically.',
    invalidType: 'Please choose a PNG, JPG, or WebP image.',
    tooLarge: 'Image must be under {size}MB.',
    success: 'Background removed.',
    failed: 'Background removal failed. Please retry or upload another image.',
    reuploadImage: 'Upload another image',
    uploadStart: 'Upload an image to start',
    uploadHint: 'Supports PNG, JPG, and WebP. The result is a transparent PNG.',
    upload: 'Upload Image',
    retry: 'Retry Matte',
    download: 'Download PNG',
    currentFile: 'Current file',
    source: 'Source',
    sourcePreview: 'Source preview',
    waiting: 'Waiting for an image',
    result: 'Matte Result',
    resultPreview: 'Matte result preview',
    processing: 'Removing background',
    resultWaiting: 'The result will appear here',
  },
  zh: {
    back: '返回首页',
    title: 'AI 去背',
    subtitle: '上传游戏美术素材，生成可用于阻挡物、角色、道具或 UI 的透明 PNG。',
    section: '自动去背',
    heading: '背景移除',
    copy: '这里使用和阻挡物编辑一致的 Gemini 优先去背流程。上传图片后会自动处理。',
    invalidType: '请选择 PNG、JPG 或 WebP 图片。',
    tooLarge: '图片不能超过 {size}MB。',
    success: '自动去背完成。',
    failed: '自动去背失败，请重试或上传另一张图片。',
    reuploadImage: '重新上传图片',
    uploadStart: '上传图片开始去背',
    uploadHint: '支持 PNG、JPG 和 WebP，结果会生成透明 PNG。',
    upload: '上传图片',
    retry: '重新去背',
    download: '下载 PNG',
    currentFile: '当前文件',
    source: '原图',
    sourcePreview: '原图预览',
    waiting: '等待上传图片',
    result: '去背结果',
    resultPreview: '去背结果预览',
    processing: '自动去背中',
    resultWaiting: '结果会显示在这里',
  },
  ja: {
    back: 'ホームへ戻る',
    title: 'AI マット',
    subtitle: 'ゲームアートを読み込み、障害物、キャラ、道具、UI に使える透明 PNG を生成します。',
    section: '自動背景除去',
    heading: '背景除去',
    copy: '障害物編集と同じ Gemini 優先のマット処理です。画像を読み込むと自動で処理します。',
    invalidType: 'PNG、JPG、WebP 画像を選択してください。',
    tooLarge: '画像は {size}MB 以下にしてください。',
    success: '背景除去が完了しました。',
    failed: '背景除去に失敗しました。再試行するか別の画像を読み込んでください。',
    reuploadImage: '別の画像を読み込む',
    uploadStart: '画像を読み込んで開始',
    uploadHint: 'PNG、JPG、WebP に対応。結果は透明 PNG です。',
    upload: '画像を読み込む',
    retry: '再実行',
    download: 'PNG を保存',
    currentFile: '現在のファイル',
    source: '元画像',
    sourcePreview: '元画像プレビュー',
    waiting: '画像待ち',
    result: 'マット結果',
    resultPreview: 'マット結果プレビュー',
    processing: '背景除去中',
    resultWaiting: '結果はここに表示されます',
  },
}

function format(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ''))
}

function matteFileName(file: File): string {
  return `${file.name.replace(/\.[^.]+$/, '')}_matte.png`
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function DroiArtMatte({ onBack }: { onBack: () => void }) {
  const { message } = App.useApp()
  const { lang } = useLanguage()
  const copy = matteCopy[lang]
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultBlob, setResultBlob] = useState<Blob | null>(null)
  const [processing, setProcessing] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cleanupRef = useRef({ sourceUrl, resultUrl })
  cleanupRef.current = { sourceUrl, resultUrl }

  useEffect(() => {
    return () => {
      const current = cleanupRef.current
      if (current.sourceUrl) URL.revokeObjectURL(current.sourceUrl)
      if (current.resultUrl) URL.revokeObjectURL(current.resultUrl)
    }
  }, [])

  const resetResult = () => {
    setResultBlob(null)
    setError(null)
    setResultUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }

  const runMatte = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      message.error(copy.invalidType)
      return
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      message.error(format(copy.tooLarge, { size: MAX_IMAGE_MB }))
      return
    }

    setSourceFile(file)
    setSourceUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
    resetResult()
    setProcessing(true)

    try {
      const blob = await removeBackground(file)
      const url = URL.createObjectURL(blob)
      setResultBlob(blob)
      setResultUrl(url)
      message.success(copy.success)
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      setError(detail || copy.failed)
      message.error(copy.failed)
    } finally {
      setProcessing(false)
    }
  }

  const selectFile = (file: File | null | undefined) => {
    if (!file) return
    void runMatte(file)
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragActive(false)
    selectFile(event.dataTransfer.files?.[0])
  }

  return (
    <div className="droi-matte-page">
      <div className="droi-matte-bg droi-matte-bg-a" />
      <div className="droi-matte-bg droi-matte-bg-b" />
      <div className="droi-matte-scanline" />

      <header className="droi-matte-header">
        <Button className="droi-matte-back" icon={<ArrowLeftOutlined />} onClick={onBack}>
          {copy.back}
        </Button>
        <div className="droi-matte-heading">
          <Text className="droi-matte-kicker">Droi-game-tool Matte</Text>
          <Title level={2}>{copy.title}</Title>
          <Text className="droi-matte-subtitle">{copy.subtitle}</Text>
        </div>
      </header>

      <main className="droi-matte-workspace">
        <section className="droi-matte-control-panel">
          <Text className="droi-matte-section-label">{copy.section}</Text>
          <Title level={3}>{copy.heading}</Title>
          <Text className="droi-matte-copy">{copy.copy}</Text>

          <input
            ref={inputRef}
            hidden
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => selectFile(event.target.files?.[0])}
          />

          <div
            className={`droi-matte-dropzone ${dragActive ? 'is-active' : ''}`}
            onDragEnter={(event) => {
              event.preventDefault()
              setDragActive(true)
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click()
            }}
          >
            <UploadOutlined />
            <strong>{sourceFile ? copy.reuploadImage : copy.uploadStart}</strong>
            <span>{copy.uploadHint}</span>
          </div>

          <div className="droi-matte-actions">
            <Button className="droi-matte-primary-btn" icon={<BgColorsOutlined />} loading={processing} onClick={() => inputRef.current?.click()}>
              {sourceFile ? copy.reuploadImage : copy.upload}
            </Button>
            <Button icon={<ReloadOutlined />} disabled={!sourceFile || processing} onClick={() => sourceFile && void runMatte(sourceFile)}>
              {copy.retry}
            </Button>
            <Button
              icon={<DownloadOutlined />}
              disabled={!resultBlob || !sourceFile}
              onClick={() => resultBlob && sourceFile && downloadBlob(resultBlob, matteFileName(sourceFile))}
            >
              {copy.download}
            </Button>
          </div>

          {sourceFile && (
            <Text className="droi-matte-meta">
              {copy.currentFile}: {sourceFile.name} / {(sourceFile.size / 1024 / 1024).toFixed(2)}MB
            </Text>
          )}
          {error && <Text className="droi-matte-error">{copy.failed}: {error}</Text>}
        </section>

        <section className="droi-matte-preview-grid">
          <article className="droi-matte-preview-card">
            <Text className="droi-matte-section-label">Source</Text>
            <Title level={3}>{copy.source}</Title>
            <div className="droi-matte-preview-frame">
              {sourceUrl ? <img src={sourceUrl} alt={copy.sourcePreview} /> : <span>{copy.waiting}</span>}
            </div>
          </article>

          <article className="droi-matte-preview-card">
            <Text className="droi-matte-section-label">Transparent PNG</Text>
            <Title level={3}>{copy.result}</Title>
            <div className="droi-matte-preview-frame is-transparent">
              {processing ? (
                <div className="droi-matte-processing">
                  <Spin />
                  <span>{copy.processing}</span>
                </div>
              ) : resultUrl ? (
                <img src={resultUrl} alt={copy.resultPreview} />
              ) : (
                <span>{copy.resultWaiting}</span>
              )}
            </div>
          </article>
        </section>
      </main>
    </div>
  )
}
