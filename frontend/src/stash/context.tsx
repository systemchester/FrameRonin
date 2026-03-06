import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
} from 'react'
import { useAuth } from '../auth/context'

export interface StashItem {
  id: string
  url: string
  name?: string
}

const STORAGE_KEY = 'frameronin_stash'

async function urlToDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url
  if (!url.startsWith('blob:')) return url
  const res = await fetch(url)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

function loadFromSession(): StashItem[] {
  try {
    const s = sessionStorage.getItem(STORAGE_KEY)
    if (!s) return []
    const parsed = JSON.parse(s) as StashItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveToSession(items: StashItem[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    /* ignore */
  }
}

interface ImageStashContextValue {
  items: StashItem[]
  addImage: (url: string, name?: string) => void
  removeImage: (id: string) => void
  clearAll: () => void
}

const ImageStashContext = createContext<ImageStashContextValue | null>(null)

export function ImageStashProvider({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAuth()
  const [items, setItems] = useState<StashItem[]>(() =>
    isConnected ? loadFromSession() : []
  )
  const idSeed = useId()

  useEffect(() => {
    if (isConnected) {
      setItems(loadFromSession())
    } else {
      setItems([])
    }
  }, [isConnected])

  useEffect(() => {
    if (isConnected && items.length > 0) {
      saveToSession(items)
    } else if (isConnected && items.length === 0) {
      try {
        sessionStorage.removeItem(STORAGE_KEY)
      } catch {
        /* ignore */
      }
    }
  }, [isConnected, items])

  const addImage = useCallback(
    async (url: string, name?: string) => {
      const id = `${idSeed}-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const persistUrl =
        isConnected && url.startsWith('blob:')
          ? await urlToDataUrl(url).catch(() => url)
          : url
      setItems((prev) => [...prev, { id, url: persistUrl, name }])
    },
    [idSeed, isConnected]
  )

  const removeImage = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setItems([])
  }, [])

  return (
    <ImageStashContext.Provider value={{ items, addImage, removeImage, clearAll }}>
      {children}
    </ImageStashContext.Provider>
  )
}

export function useImageStash() {
  const ctx = useContext(ImageStashContext)
  if (!ctx) throw new Error('useImageStash must be used within ImageStashProvider')
  return ctx
}
