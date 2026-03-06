import { useState, useCallback, useEffect } from 'react'
import { CloseOutlined, DownloadOutlined, InboxOutlined, LeftOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons'
import { useAuth } from '../auth/context'
import { useImageStash } from '../stash/context'
import { useLanguage } from '../i18n/context'

const STASH_DRAG_TYPE = 'application/x-frameronin-stash-url'
const STASH_COLLAPSED_KEY = 'frameronin-stash-collapsed'

function downloadImage(url: string, name?: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = name?.replace(/[^\w.-]+/g, '_') || `stash_${Date.now()}.png`
  a.click()
}

export default function ImageStashPanel() {
  const { t } = useLanguage()
  const { isConnected } = useAuth()
  const { items, addImage, removeImage, clearAll } = useImageStash()
  const [dragOver, setDragOver] = useState(false)
  const [dragOverExtra, setDragOverExtra] = useState(false)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STASH_COLLAPSED_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STASH_COLLAPSED_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [collapsed])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const hasFile = e.dataTransfer.types.includes('Files')
    const hasStash = e.dataTransfer.types.includes(STASH_DRAG_TYPE)
    if (hasFile || hasStash) {
      e.dataTransfer.dropEffect = 'copy'
      setDragOver(true)
    }
  }, [])

  const handleDragOverExtra = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const hasFile = e.dataTransfer.types.includes('Files')
    const hasStash = e.dataTransfer.types.includes(STASH_DRAG_TYPE)
    if (hasFile || hasStash) {
      e.dataTransfer.dropEffect = 'copy'
      setDragOverExtra(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOver(false)
      setDragOverExtra(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent, setState: (v: boolean) => void) => {
      e.preventDefault()
      e.stopPropagation()
      setState(false)
      setDragOver(false)
      setDragOverExtra(false)

      const stashUrl = e.dataTransfer.getData(STASH_DRAG_TYPE)
      if (stashUrl) {
        const stashName = e.dataTransfer.getData('application/x-frameronin-stash-name') || undefined
        void addImage(stashUrl, stashName)
        return
      }

      const files = e.dataTransfer.files
      if (!files?.length) return
      for (let i = 0; i < files.length; i++) {
        const f = files[i]
        if (f.type.startsWith('image/')) {
          void addImage(URL.createObjectURL(f), f.name)
        }
      }
    },
    [addImage]
  )

  return (
    <div
      className="image-stash-panel"
      onDragOver={collapsed ? undefined : handleDragOver}
      onDragLeave={collapsed ? undefined : handleDragLeave}
      onDrop={collapsed ? undefined : (e) => handleDrop(e, setDragOver)}
      data-drag-over={dragOver}
      data-collapsed={collapsed}
    >
      {collapsed ? (
        <button
          type="button"
          className="image-stash-expand-btn"
          onClick={() => setCollapsed(false)}
          title={t('stashExpand')}
          aria-label={t('stashExpand')}
        >
          <RightOutlined />
        </button>
      ) : (
        <>
          <div className="image-stash-contact">
            <div className="image-stash-contact-row">
              <span className="image-stash-contact-label">{t('contactLabel')}</span>
              <a href="https://space.bilibili.com/285760" target="_blank" rel="noopener noreferrer">Bilibili</a>
            </div>
            <a href="https://wpa.qq.com/msgrd?v=3&uin=719937402&site=qq&menu=yes" target="_blank" rel="noopener noreferrer">QQ 719937402</a>
            <a href="mailto:systemchester@gmail.com">{t('contactEmail')}</a>
          </div>
          <div className="image-stash-header">
            <InboxOutlined />
            <span>{t('stashTitle')}</span>
            {isConnected && <span className="image-stash-session-badge" title={t('stashSessionPersist')}>●</span>}
            {items.length > 0 && (
              <button
                type="button"
                className="image-stash-clear"
                onClick={clearAll}
                title={t('stashClear')}
                aria-label={t('stashClear')}
              >
                {t('stashClear')}
              </button>
            )}
            <button
              type="button"
              className="image-stash-collapse-btn"
              onClick={() => setCollapsed(true)}
              title={t('stashCollapse')}
              aria-label={t('stashCollapse')}
            >
              <LeftOutlined />
            </button>
          </div>
          <div className="image-stash-drop-zone">
        <p className="image-stash-hint">{t('stashHint')}</p>
        <div className="image-stash-list">
          {items.map((item) => (
            <div
              key={item.id}
              className="image-stash-item image-stash-item-draggable"
              draggable
              onDragStart={(e) => {
                if ((e.target as HTMLElement).closest('button')) {
                  e.preventDefault()
                  return
                }
                e.dataTransfer.setData(STASH_DRAG_TYPE, item.url)
                if (item.name) e.dataTransfer.setData('application/x-frameronin-stash-name', item.name)
                e.dataTransfer.effectAllowed = 'copy'
              }}
              onMouseEnter={() => setPreviewId(item.id)}
              onMouseLeave={() => setPreviewId(null)}
            >
              <img src={item.url} alt="" draggable={false} style={{ pointerEvents: 'none' }} />
              <div className="image-stash-item-actions">
                <button
                  type="button"
                  className="image-stash-item-btn"
                  onClick={() => downloadImage(item.url, item.name)}
                  title={t('stashDownload')}
                  aria-label={t('stashDownload')}
                >
                  <DownloadOutlined />
                </button>
                <button
                  type="button"
                  className="image-stash-item-btn"
                  onClick={() => removeImage(item.id)}
                  title={t('stashRemove')}
                  aria-label={t('stashRemove')}
                >
                  <CloseOutlined />
                </button>
              </div>
              {previewId === item.id && (
                <div className="image-stash-preview-popover">
                  <img src={item.url} alt="" />
                </div>
              )}
            </div>
          ))}
        </div>
        {items.length > 0 && (
          <div
            className="image-stash-drop-more"
            onDragOver={(e) => {
              e.preventDefault()
              handleDragOverExtra(e)
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverExtra(false)
            }}
            onDrop={(e) => handleDrop(e, () => setDragOverExtra(false))}
            data-drag-over={dragOverExtra}
          >
            <PlusOutlined />
            <span>{t('stashDropMore')}</span>
          </div>
        )}
      </div>
        </>
      )}
    </div>
  )
}
