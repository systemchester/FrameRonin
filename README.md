# Droi-game-tool - 视频转序列帧 · 抠图 · Sprite Sheet **V3**

[中文](README.md) | [English](README.en.md) | [日本語](README.ja.md)

像素图片与序列帧处理工具集，支持视频拆帧、GIF 处理、图片抠图、Sprite Sheet 合成等。

![AI像素商K 项目预览](frontend/public/K.png)

## V3 更新摘要

- **全局快捷键（首页 / 功能内）**：首页 **C** 进入 GIF↔序列帧、**V** 像素图片处理、**G** Gemini 水印去除、**R** RoninPro 并直达「自定义缩放」、**N** RoninPro 并直达「单图调整 Pro」；任意功能内 **B** 返回首页（输入框聚焦或 Ctrl/⌘/Alt 组合键时不触发）。详见下文「Web 界面快捷键」。
- **RoninPro**：自定义缩放、自定义切片、统一尺寸等效率工具；NFT 门槛由 `frontend/src/config/features.ts` 中 `RONIN_PRO_REQUIRE_NFT` 控制（当前默认可无需 NFT）；支持从快捷键 **R** 深链打开「自定义缩放」、**N** 深链打开「单图调整 Pro」。
- **单图调整 Pro**（RoninPro，快捷键 **N**）：**整图均分**时 **N×M** 只决定如何从原图切块（修改后会按新网格重新分割）；分割预览里的 **列数** 只决定每行摆几帧以及合成 / 导出布局，**不会**因此重新切图。另支持单图网格拆分、透明间隙拆分、拆分前预处理、逐帧平移与四边裁边、合并及 ZIP / GIF 导出。
- **首页布局**：RoninPro 整行置于 **Seedance 去水印** 与 **素材/源码分享** 之上，便于优先访问。
- **GIF ↔ 序列帧**：默认打开 **「多图合成单图」** 标签；**输入方式** 默认 **「拆分单图」**（按行列分割一张图为多格再合成）。
- **Sprite Sheet 调整**：动帧预览支持 **方向键 / 上一帧·下一帧按钮**，键盘 **A / D** 在已选帧间切换（非输入框聚焦时）；支持按偏移重排后 **重组合** 导出序列帧表。
- **控制测试场景**：**Top-down** 与 **街机** 两套演示场景（角色移动与交互试验），入口在首页首行。

## 功能模块

### 视频与序列帧
- **视频转序列帧**：上传视频，提取帧、rembg 抠图、生成 Sprite Sheet
- **GIF ↔ 序列帧**：GIF 拆帧、序列帧转 GIF、多图合成单图（默认 Tab）、单图按行列拆分再合成、单图拆分、简易拼接（上下/左右）
- **Sprite Sheet**：拆分序列帧图 / 合成 GIF
- **Sprite Sheet 调整**：分割预览、勾选帧、动画预览（需 Ronin 登录）、预览帧切换（按钮与 **A/D**）、按偏移重组合导出

### 图片处理
- **像素图片处理**：双入口
  - **常规处理**：缩放、内描边、裁切、抠图（绿幕/蓝幕）
    - **RPGMAKER 一键处理**：去 Gemini 水印 → 左上角**连通域**抠图(容差 80/羽化 5) → 144×144 硬缩放 → RPGMAKER 生成
    - **RPGMAKER V2 一键处理到5行**：去水印 → 256×256 硬缩放 → 首像素**连通域**抠图 → 裁右 64px、下扩透明 64px → 第 3/4 行下移 64px、第 3 行填入第 2 行镜像 → 5×3 格每格四边裁 8px 再合并 → 144×240
    - **RPGMAKER V2 一键处理四行**：与上一键相同，最后再裁掉下方 48px → 144×192
    - **一图全动作处理**：去 Gemini 水印 → 256×256 硬缩放 → 左上角去背(容差 80) → 右/下各裁 4px → 252×252
    - **RPGMAKER 生成**：3 行切分、第 2 行翻转复制、第 3 行下移 48px
  - **精细处理**：画笔、橡皮、超级橡皮（连通域+容差）、可开关背景色、后撤一步(Ctrl+Z)、滚轮缩放、右键平移
- **色度键抠图**：绿幕/蓝幕去背、抑色、边缘平滑
- **图片像素化**：转换为像素块风格
- **扩图与缩图**：按 N×M 格子裁切后合并
- **Gemini 水印去除**：去除 Gemini 生成图片的可见水印

### nanobanana 系列（需 Ronin 登录）
- **nanobanana RPG Maker 角色素材生成**：链接 Gemini 生成 RPG Maker 角色素材
- **nanobanana 像素场景生成**、**立绘生成**：链接 Gemini
- **nanob 全人物动作生成测试**：连生动作 V4Tx3 等

### 开发者与效率（RoninPro）
- **RoninPro**（登录 Ronin）：**自定义缩放**、**自定义切片**、**统一尺寸**、**单图调整 Pro** 等；NFT 是否必填见 `frontend/src/config/features.ts`。**单图调整 Pro** 中「切块网格」与「预览 / 合成排列」已分离：改 N、M 重切原图，改预览列数仅重排。

### 演示 / 实验
- **Top-down 测试场景**、**街机测试场景**：用于控制与层叠渲染等试验（非生产管线）。

### 其他
- **Seedance 2.0 视频水印去除**：需本地部署后端，去除 Seedance/即梦 视频的「AI生成」水印
- **素材和游戏源码分享**：01-美术素材、godot 代码、成品项目（含 AI像素商K）

### Web 界面快捷键

- **V**：在**首页**进入 **像素图片处理**（入口选择页；输入框等规则同下）。
- **R**：在**首页**进入 **RoninPro → 自定义缩放**（需 Ronin 登录；若开启 NFT 门槛则需持有 NFT；输入框等规则同下）。
- **N**：在**首页**进入 **RoninPro → 单图调整 Pro**（登录与 NFT 规则同 **R**）。
- **G**：在**首页**进入 **Gemini 水印去除**（输入框等规则同下）。
- **C**：在**首页**进入 **GIF ↔ 序列帧** 模块（与首页卡片一致；输入框聚焦等情况下的规则同下）。
- **B**：在任意大功能模块内返回首页。焦点在输入框、文本框或可编辑区域时不触发；配合 Ctrl / ⌘ / Alt 按下时也不触发（避免与浏览器快捷键冲突）。视频流程返回首页时会同时重置上传步骤；图片模块会回到入口选择页。

## 环境要求

- Python 3.11+
- Node.js 18+
- Redis
- FFmpeg（已加入 PATH）
- （可选）Docker + Docker Compose

## 本地开发

### 1. 安装依赖

```bash
# 后端
pip install -r backend/requirements.txt

# 前端
cd frontend && npm install
```

### 2. 启动 Redis

```bash
# Windows: 下载 Redis 或使用 Docker
docker run -d -p 6379:6379 redis:7-alpine

# 或本机安装 Redis 并启动
```

### 3. 启动服务

```bash
# 终端 1：API
cd pixelwork
set PYTHONPATH=%CD%
python -m uvicorn backend.app.main:app --reload --port 8000

# 终端 2：Worker
set PYTHONPATH=%CD%
rq worker pixelwork --url redis://localhost:6379/0

# 终端 3：前端
cd frontend && npm run dev
```

访问 http://localhost:5173

### 4. rembg / U2Net（仅后端）

当前「视频转序列帧」前端使用色度键抠图，无需下载模型。若部署后端 + Worker 并调用 `/jobs` 接口进行服务端抠图，首次运行时会下载 U2Net 模型（约 176MB），请保持网络畅通。

## GitHub Pages 预览（分享给朋友）

项目已配置 GitHub Actions，推送 `main` 分支后自动构建并部署到 GitHub Pages。

**首次使用需在仓库开启 Pages：**

1. 打开 https://github.com/systemchester/FrameRonin/settings/pages
2. 在 **Build and deployment** 下，**Source** 选择 **GitHub Actions**
3. 保存后，下次推送到 `main` 会自动部署

**访问地址：** https://systemchester.github.io/FrameRonin/

> 说明：当前部署的是纯前端。GIF 拆帧/合成、像素图片处理（含精细处理）、色度键抠图、简易拼接、Sprite Sheet、RPGMAKER 一键处理、视频转序列帧等均可使用。

## Docker 部署

```bash
docker-compose up -d
```

- 前端: http://localhost:5173
- API: http://localhost:8000
- Redis: localhost:6379

## 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /jobs | 上传视频创建任务 |
| GET | /jobs/{id} | 查询任务状态 |
| GET | /jobs/{id}/result?format=png\|zip | 下载结果 |
| GET | /jobs/{id}/index | 下载索引 JSON |
| DELETE | /jobs/{id} | 删除任务 |

## 索引 JSON 示例

```json
{
  "version": "1.0",
  "frame_size": {"w": 256, "h": 256},
  "sheet_size": {"w": 3072, "h": 2048},
  "frames": [
    {"i": 0, "x": 0, "y": 0, "w": 256, "h": 256, "t": 0.000},
    {"i": 1, "x": 256, "y": 0, "w": 256, "h": 256, "t": 0.083}
  ]
}
```

## 链接

- **Bilibili**：[https://space.bilibili.com/285760](https://space.bilibili.com/285760)

## 文档

| 文档 | 说明 |
|------|------|
| [DEV_DOC_video2timesheet.md](./DEV_DOC_video2timesheet.md) | 视频转序列帧 / Sprite Sheet 产品与接口设计 |
| [DEV_PLAN_extensions.md](./DEV_PLAN_extensions.md) | 功能扩展规划与 V3 已落地项对照 |
| [DEPLOY.md](./DEPLOY.md) | 推送、CNB/EdgeOne、部署注意事项 |
| [frontend/README.md](./frontend/README.md) | 前端工程说明 |
