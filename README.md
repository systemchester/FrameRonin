# FrameRonin - 视频转序列帧图片生成器 v1.6

上传视频后自动提取帧、抠图处理，生成完整的序列帧表（Sprite Sheet）图片。

## 功能

- **上传视频**：支持 MP4 / MOV / WebM / AVI / MKV（≤200MB）
- **帧提取**：按 FPS、起止时间、最大帧数采样
- **抠图分割**：rembg(U2Net) 主体分割，透明背景
- **后处理**：统一尺寸、裁剪、边距、间距
- **序列帧合成**：固定列数或自适应布局
- **预览与下载**：PNG、ZIP（含索引 JSON）

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
cd frontend && npm install antd @ant-design/icons axios
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

### 4. rembg 首次运行

首次抠图时会下载 U2Net 模型（约 176MB），请保持网络畅通。

## GitHub Pages 预览（分享给朋友）

项目已配置 GitHub Actions，推送 `main` 分支后自动构建并部署到 GitHub Pages。

**首次使用需在仓库开启 Pages：**

1. 打开 https://github.com/systemchester/FrameRonin/settings/pages
2. 在 **Build and deployment** 下，**Source** 选择 **GitHub Actions**
3. 保存后，下次推送到 `main` 会自动部署

**访问地址：** https://systemchester.github.io/FrameRonin/

> 说明：当前部署的是纯前端。「视频转序列帧」依赖后端 API，在 Pages 上无法使用；「像素图片处理」可完全在浏览器内使用。

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

## 文档

详见 [DEV_DOC_video2timesheet.md](./DEV_DOC_video2timesheet.md)
