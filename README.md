# Droi-game-tool

[中文](README.md) | [English](README.en.md) | [日本語](README.ja.md)

Droi-game-tool 是一个独立的游戏美术生产工具，面向小型游戏、RPG、像素角色和地图资产制作流程。它把地图拼接、阻挡物编辑、AI 去背、人物动作分析与动作候选图生成放在同一个工作台里，默认界面语言为英文，并在首页右上角提供语言切换。

## 核心功能

- **Map Studio**：上传地图切片或地图图片，进行地图拼接、画布预览、阻挡物放置与碰撞格编辑。
- **Obstacle Editor**：支持上传单张图片或整个文件夹，把障碍物素材加入侧边栏；可删除素材，并同步清理已放置实例和碰撞数据。
- **AI Matte**：默认调用 Gemini 做自动抠图去背；处理前会检测图片是否已经带透明背景，已透明的图片会直接沿用原图。
- **Character Action Studio**：分析人物动作，生成 `idle / walk / run / attack / skill / hurt / death` 的基础动作候选图。
- **Progressive Generation**：动作图默认按每批 3 张推进，成功 1 张就写入任务结果并固定显示在底部候选栏，用户可以边生成边拖拽已完成图片。
- **Provider Fallback**：AI 能力默认优先 Gemini，失败时可回退到 Qwen，两个 provider 都使用环境变量读取 API Key。

## 技术栈

- Frontend：React 19、Vite、TypeScript、Ant Design
- Backend：FastAPI、Pillow、rembg、Gemini API、Qwen/DashScope API
- Runtime：Python 3.11+、Node.js 18+

## 本地开发

### 1. 安装依赖

```powershell
# 后端
py -m pip install -r backend/requirements.txt

# 前端
cd frontend
npm install
```

### 2. 配置 AI Key

在本地根目录创建 `.env.local`，或者在终端里设置环境变量。不要把真实 Key 提交到 GitHub。

推荐变量名：

- `GEMINI_API_KEY`：Gemini
- `DASHSCOPE_API_KEY`：Qwen / DashScope

兼容变量名：

- `GOOGLE_API_KEY`：Gemini
- `QWEN_API_KEY`：Qwen

### 3. 启动后端

```powershell
$env:PYTHONPATH = (Get-Location).Path
py -m uvicorn backend.app.main:app --reload --port 8000
```

### 4. 启动前端

```powershell
cd frontend
npm run dev
```

访问 `http://127.0.0.1:5173/`。

## 主要接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/health` | 后端健康检查 |
| `POST` | `/matte` | AI 去背，优先 Gemini，失败时可回退本地 rembg |
| `POST` | `/character-action/analyze` | 创建人物动作分析与候选图生成任务 |
| `GET` | `/character-action/analyze/{job_id}` | 查询任务状态；处理中也返回 partial candidates |
| `GET` | `/character-action/analyze/{job_id}/result` | 获取完成后的动作生成结果 |
| `GET` | `/character-action/analyze/{job_id}/assets/{filename}` | 读取生成的候选图资源 |

仓库里仍保留部分历史视频任务接口，当前 Droi-game-tool 的主流程以上面的地图、去背和人物动作能力为准。

## 安全与提交规则

- `.env.local` 只用于本地 API Key，不要提交。
- `backend/outputs/` 是生成结果目录，不要提交。
- `.codex-runlogs/` 和本地日志文件不属于产品代码，不要提交。
- 提交前建议执行密钥扫描，确保没有 Gemini Key、Qwen Key 或 Bearer Token 泄露。

## 验证

```powershell
cd frontend
npm run build

cd ..
py -m py_compile backend\app\main.py backend\app\gemini_provider.py backend\app\qwen_provider.py
```

## 目录说明

| 路径 | 说明 |
| --- | --- |
| `frontend/` | React 前端应用 |
| `backend/app/main.py` | FastAPI 入口与任务接口 |
| `backend/app/gemini_provider.py` | Gemini 图像与动作生成能力 |
| `backend/app/qwen_provider.py` | Qwen fallback 能力 |
| `backend/outputs/` | 本地生成结果，已忽略提交 |
