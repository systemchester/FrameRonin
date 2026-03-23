import { useState, useCallback, useEffect } from 'react'
import { CloseOutlined, DownloadOutlined, FolderAddOutlined, FolderOpenOutlined, InboxOutlined, LeftOutlined, PlusOutlined, ReloadOutlined, RightOutlined } from '@ant-design/icons'
import { message, Spin } from 'antd'
import { useAuth } from '../auth/context'
import { canUseLocalWorkspace, useLocalWorkspace } from '../localWorkspace/context'
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
  const {
    folderName,
    handle,
    selectFolder,
    useLocalFolderMode,
    setUseLocalFolderMode,
    localFolderItems,
    loadLocalFolderImages,
    loadingLocalFolder,
    saveFileToFolder,
    removeFileFromFolder,
  } = useLocalWorkspace()
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

  const handleSelectWorkspace = useCallback(async () => {
    if (!canUseLocalWorkspace) {
      message.warning(t('stashLocalWorkspaceUnsupported'))
      return
    }
    const ok = await selectFolder()
    if (ok) message.success(t('stashLocalWorkspaceSet'))
  }, [selectFolder, t])

  const showClear = !useLocalFolderMode
  const displayItems = useLocalFolderMode ? localFolderItems : items
  const isStashMode = !useLocalFolderMode

  const handleDropToLocal = useCallback(
    async (e: React.DragEvent, setState: (v: boolean) => void) => {
      e.preventDefault()
      e.stopPropagation()
      setState(false)
      setDragOver(false)
      setDragOverExtra(false)
      let saved = 0
      const stashUrl = e.dataTransfer.getData(STASH_DRAG_TYPE)
      if (stashUrl) {
        try {
          const res = await fetch(stashUrl)
          const blob = await res.blob()
          const name =
            e.dataTransfer.getData('application/x-frameronin-stash-name') || `image_${Date.now()}.png`
          const file = new File([blob], name, { type: blob.type })
          const ok = await saveFileToFolder(file)
          if (ok) saved++
        } catch {
          /* ignore */
        }
      }
      const files = e.dataTransfer.files
      if (files?.length) {
        for (let i = 0; i < files.length; i++) {
          const f = files[i]
          if (f.type.startsWith('image/')) {
            const ok = await saveFileToFolder(f)
            if (ok) saved++
          }
        }
      }
      if (saved > 0) {
        await loadLocalFolderImages()
        message.success(t('stashLocalFolderSaved', { count: saved }))
      }
    },
    [saveFileToFolder, loadLocalFolderImages, t]
  )

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
      onDrop={
        collapsed
          ? undefined
          : (e) => (isStashMode ? handleDrop(e, setDragOver) : handleDropToLocal(e, setDragOver))
      }
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
            {isConnected && <span className="image-stash-session-badge" title={t('stashSessionPersist')}>●</span>}
            {canUseLocalWorkspace && (
              <div className="image-stash-mode-toggle" role="group" aria-label={t('stashModeToggle')}>
                <button
                  type="button"
                  className={`image-stash-mode-btn ${!useLocalFolderMode ? 'active' : ''}`}
                  onClick={() => setUseLocalFolderMode(false)}
                  title={t('stashModeStash')}
                >
                  {t('stashModeStash')}
                </button>
                <button
                  type="button"
                  className={`image-stash-mode-btn ${useLocalFolderMode ? 'active' : ''}`}
                  onClick={() => setUseLocalFolderMode(true)}
                  title={t('stashModeLocalFolder')}
                >
                  {t('stashModeLocalFolder')}
                </button>
              </div>
            )}
            {useLocalFolderMode && canUseLocalWorkspace && (
              <button
                type="button"
                className="image-stash-local-workspace"
                onClick={handleSelectWorkspace}
                title={folderName ? `${t('stashLocalWorkspace')}: ${folderName}` : t('stashLocalWorkspace')}
                aria-label={t('stashLocalWorkspace')}
              >
                <FolderOpenOutlined />
                <span>{folderName ?? t('stashLocalWorkspace')}</span>
              </button>
            )}
            <span className="image-stash-header-spacer" />
            {showClear && (
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
        {!(useLocalFolderMode && folderName) && (
          <p className="image-stash-hint">
            {useLocalFolderMode ? t('stashLocalFolderPickHint') : t('stashHint')}
          </p>
        )}
        {useLocalFolderMode && folderName && (
          <div className="image-stash-local-actions">
            <button
              type="button"
              className="image-stash-refresh-btn"
              onClick={() => loadLocalFolderImages()}
              disabled={loadingLocalFolder}
              title={t('stashLocalFolderRefresh')}
            >
              <ReloadOutlined spin={loadingLocalFolder} />
              <span>{t('stashLocalFolderRefresh')}</span>
            </button>
          </div>
        )}
        {loadingLocalFolder ? (
          <div className="image-stash-loading">
            <Spin size="small" />
          </div>
        ) : (
          <div className="image-stash-list">
            {displayItems.map((item) => (
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
                  e.dataTransfer.setData('application/x-frameronin-stash-name', item.name ?? '')
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
                  {isStashMode && canUseLocalWorkspace && (
                    <button
                      type="button"
                      className="image-stash-item-btn"
                      onClick={async () => {
                        if (!handle) {
                          message.warning(t('stashSendToLocalNoFolder'))
                          return
                        }
                        try {
                          const res = await fetch(item.url)
                          const blob = await res.blob()
                          const name = (item.name || `stash_${Date.now()}.png`).replace(/[^\w.-]+/g, '_')
                          const file = new File([blob], name, { type: blob.type || 'image/png' })
                          const ok = await saveFileToFolder(file)
                          if (ok) {
                            await loadLocalFolderImages()
                            message.success(t('stashSendToLocalSuccess'))
                          } else message.error(t('stashSendToLocalFailed'))
                        } catch {
                          message.error(t('stashSendToLocalFailed'))
                        }
                      }}
                      title={t('stashSendToLocal')}
                      aria-label={t('stashSendToLocal')}
                    >
                      <FolderAddOutlined />
                    </button>
                  )}
                  {(isStashMode ? (
                    <button
                      type="button"
                      className="image-stash-item-btn"
                      onClick={() => removeImage(item.id)}
                      title={t('stashRemove')}
                      aria-label={t('stashRemove')}
                    >
                      <CloseOutlined />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="image-stash-item-btn"
                      onClick={async () => {
                        const ok = await removeFileFromFolder(item.name ?? '')
                        if (ok) await loadLocalFolderImages()
                      }}
                      title={t('stashRemove')}
                      aria-label={t('stashRemove')}
                    >
                      <CloseOutlined />
                    </button>
                  ))}
                </div>
                {previewId === item.id && (
                  <div className="image-stash-preview-popover">
                    <img src={item.url} alt="" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {(isStashMode ? items.length > 0 : useLocalFolderMode && folderName) && (
          <div
            className="image-stash-drop-more"
            onDragOver={(e) => {
              e.preventDefault()
              handleDragOverExtra(e)
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverExtra(false)
            }}
            onDrop={(e) =>
              isStashMode
                ? handleDrop(e, () => setDragOverExtra(false))
                : handleDropToLocal(e, () => setDragOverExtra(false))
            }
            data-drag-over={dragOverExtra}
          >
            <PlusOutlined />
            <span>{isStashMode ? t('stashDropMore') : t('stashLocalFolderDropMore')}</span>
          </div>
        )}
      </div>
        </>
      )}
    </div>
  )
}
