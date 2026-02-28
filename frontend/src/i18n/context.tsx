import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { Lang } from './locales'
import { t as tFn } from './locales'

const STORAGE_KEY = 'frameronin_lang'

const HTML_LANG: Record<Lang, string> = { zh: 'zh-CN', en: 'en', ja: 'ja' }

const LanguageContext = createContext<{
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string, params?: Record<string, string | number>) => string
} | null>(null)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY)
      if (s === 'zh' || s === 'en' || s === 'ja') return s
    } catch { /* ignore */ }
    return 'zh'
  })

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try {
      localStorage.setItem(STORAGE_KEY, l)
    } catch { /* ignore */ }
  }, [])

  const t = useCallback((key: string, params?: Record<string, string | number>) => tFn(lang, key, params), [lang])

  useEffect(() => {
    document.documentElement.lang = HTML_LANG[lang]
    document.title = tFn(lang, 'pageTitle')
    let meta = document.querySelector('meta[name="description"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'description')
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', tFn(lang, 'pageDescription'))
  }, [lang])

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
