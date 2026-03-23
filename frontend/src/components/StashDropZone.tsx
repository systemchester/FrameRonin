import { useCallback } from 'react'

const STASH_DRAG_TYPE = 'application/x-frameronin-stash-url'

interface StashDropZoneProps {
  children: React.ReactNode
  onStashDrop: (file: File) => void
  maxSizeMB?: number
  onSizeError?: () => void
}

/** 包装上传区域，使暂存中的图片拖入时能转换为 File 并触发 onStashDrop */
export default function StashDropZone({
  children,
  onStashDrop,
  maxSizeMB = 20,
  onSizeError,
}: StashDropZoneProps) {
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      const url = e.dataTransfer.getData(STASH_DRAG_TYPE)
      if (url) {
        e.preventDefault()
        e.stopPropagation()
        try {
          const res = await fetch(url)
          const blob = await res.blob()
          if (maxSizeMB > 0 && blob.size > maxSizeMB * 1024 * 1024) {
            onSizeError?.()
            return
          }
          const ext = blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : blob.type === 'image/gif' ? 'gif' : 'png'
          const file = new File([blob], `stash_${Date.now()}.${ext}`, { type: blob.type })
          onStashDrop(file)
        } catch {
          /* ignore */
        }
        return
      }
      const files = e.dataTransfer.files
      if (files?.length) {
        e.preventDefault()
        e.stopPropagation()
        for (let i = 0; i < files.length; i++) {
          const f = files[i]
          if (!f || !f.type.startsWith('image/')) continue
          if (maxSizeMB > 0 && f.size > maxSizeMB * 1024 * 1024) {
            onSizeError?.()
            continue
          }
          onStashDrop(f)
        }
      }
    },
    [onStashDrop, maxSizeMB, onSizeError]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    const hasStash = e.dataTransfer.types.includes(STASH_DRAG_TYPE)
    const hasFiles = e.dataTransfer.types.includes('Files')
    if (hasStash || hasFiles) {
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'copy'
    }
  }, [])

  return (
    <div onDrop={handleDrop} onDragOver={handleDragOver} style={{ display: 'inline-block', width: '100%' }}>
      {children}
    </div>
  )
}
