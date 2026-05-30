# Droi-game-tool 前端（V3）

React + Vite + TypeScript + Ant Design。业务入口与模块说明以仓库根目录 **[README.md](../README.md)** 为准（中 / en / ja）。

## 本地运行

```bash
npm install
npm run dev
```

默认开发服务器：<http://localhost:5173>（与根目录文档中的后端端口 8000 配合使用）。

## 工程结构（提要）

| 路径 | 说明 |
|------|------|
| `src/App.tsx` | 路由式模块切换、**全局快捷键**（B/C/V/G/R/N）、RoninPro 深链 |
| `src/components/ModeSelector.tsx` | 首页模块卡片与顺序 |
| `src/config/features.ts` | **功能开关**（如 `RONIN_PRO_REQUIRE_NFT`） |
| `src/i18n/` | 文案与语言上下文 |
| `src/components/*.tsx` | 各功能模块（GIF、Sprite Sheet、RoninPro 等） |
| `src/components/SpriteSheetAdjust.tsx` | 精灵表调整；RoninPro **单图调整 Pro**（切块 N×M 与预览排列分离，见根目录 README） |

## 开发与发布注意

- 新增面向用户的文案时，请同步 **zh / en / ja**（`src/i18n/locales.ts`）。
- GitHub Pages 多为**纯静态**部署：依赖浏览器与纯前端的模块可直接使用；需 Python Worker + Redis 的能力须在自有环境部署（见根目录 README）。

## 上游模板说明

本目录最初基于 Vite 官方 React-TS 模板生成；当前文档以 Droi-game-tool 业务为准，ESLint 进阶配置可参考 [Vite 文档](https://vite.dev/) 与 [typescript-eslint](https://typescript-eslint.io/)。
