import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, readdirSync } from 'fs'
import { join, normalize } from 'path'

/** OpenCV.js UMD 在 ESM 下 this 为 undefined，需改为 globalThis（见 PORTING_GUIDE） */
function opencvUmdGlobalThisFix(): Plugin {
  return {
    name: 'opencv-umd-globalthis',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('opencv.js') || !id.includes('opencv-js')) return null
      if (!code.includes('}(this,')) return null
      return code.replace(/\}\(this,\s*function\s*\(\)\s*\{/g, '}(globalThis, function () {')
    },
  }
}

// 构建后复制 index.html 为 404.html，供 EdgeOne 等平台 SPA 回退
function copy404Plugin() {
  return {
    name: 'copy-404',
    closeBundle() {
      const outDir = join(process.cwd(), 'dist')
      copyFileSync(join(outDir, 'index.html'), join(outDir, '404.html'))
    },
  }
}

const VIRTUAL_MONSTER_LIST = 'virtual:infinite-map-monster-files'
const RESOLVED_VIRTUAL_MONSTER_LIST = '\0' + VIRTUAL_MONSTER_LIST

/** 扫描 public/map/monster 下所有 .png，放入怪物列表（无需手写清单） */
function infiniteMapMonsterScanPlugin(): Plugin {
  const scan = (): string[] => {
    const dir = join(process.cwd(), 'public', 'map', 'monster')
    try {
      return readdirSync(dir)
        .filter((name) => /\.png$/i.test(name) && !name.startsWith('.'))
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    } catch {
      return []
    }
  }
  const isUnderMonsterDir = (filePath: string) =>
    normalize(filePath).replace(/\\/g, '/').includes('/public/map/monster/')

  return {
    name: 'infinite-map-monster-scan',
    resolveId(id) {
      if (id === VIRTUAL_MONSTER_LIST) return RESOLVED_VIRTUAL_MONSTER_LIST
    },
    load(id) {
      if (id !== RESOLVED_VIRTUAL_MONSTER_LIST) return null
      const names = scan()
      return `export const MONSTER_PUBLIC_FILENAMES = ${JSON.stringify(names)}`
    },
    configureServer(server) {
      const monsterDir = join(process.cwd(), 'public', 'map', 'monster')
      const invalidate = () => {
        const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MONSTER_LIST)
        if (mod) server.moduleGraph.invalidateModule(mod)
      }
      server.watcher.add(monsterDir)
      for (const ev of ['add', 'unlink'] as const) {
        server.watcher.on(ev, (filePath) => {
          if (isUnderMonsterDir(filePath)) invalidate()
        })
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [opencvUmdGlobalThisFix(), infiniteMapMonsterScanPlugin(), react(), copy404Plugin()],
  optimizeDeps: {
    include: ['@techstark/opencv-js'],
  },
  worker: {
    format: 'es',
  },
  base: '/',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        timeout: 300000, // 5 分钟，支持大文件下载
        proxyTimeout: 300000
      }
    }
  }
})
