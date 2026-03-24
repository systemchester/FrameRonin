import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'fs'
import { join } from 'path'

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

// https://vite.dev/config/
export default defineConfig({
  plugins: [opencvUmdGlobalThisFix(), react(), copy404Plugin()],
  optimizeDeps: {
    include: ['@techstark/opencv-js'],
  },
  worker: {
    format: 'es',
  },
  base: process.env.GITHUB_ACTIONS ? '/FrameRonin/' : '/',
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
