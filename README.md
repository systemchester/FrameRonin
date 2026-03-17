# FrameRonin - 视频转序列帧 · 抠图 · Sprite Sheet v2.1

像素图片与序列帧处理工具集，支持视频拆帧、GIF 处理、图片抠图、Sprite Sheet 合成等。

## 功能模块

### 视频与序列帧
- **视频转序列帧**：上传视频，提取帧、rembg 抠图、生成 Sprite Sheet
- **GIF ↔ 序列帧**：GIF 拆帧、序列帧转 GIF、多图合成单图、单图拆分、简易拼接（上下/左右）
- **Sprite Sheet**：拆分序列帧图 / 合成 GIF
- **Sprite Sheet 调整**：分割预览、勾选帧、动画预览（需 Ronin 登录）

### 图片处理
- **像素图片处理**：双入口
  - **常规处理**：缩放、内描边、裁切、抠图（绿幕/蓝幕）
    - **RPGMAKER 一键处理**：去 Gemini 水印 → 左上角抠图(容差 80/羽化 5) → 144×144 硬缩放 → RPGMAKER 生成
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

详见 [DEV_DOC_video2timesheet.md](./DEV_DOC_video2timesheet.md)
