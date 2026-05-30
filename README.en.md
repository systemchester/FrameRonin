# Droi-game-tool

[中文](README.md) | [English](README.en.md) | [日本語](README.ja.md)

Droi-game-tool is an independent game art production tool for small games, RPG assets, pixel characters, map composition, and action-frame prototyping. The app defaults to English and exposes a language switcher on the home page.

## Core Features

- **Map Studio**: upload map tiles or full map images, stitch maps, preview the canvas, place obstacles, and edit collision cells.
- **Obstacle Editor**: upload single images or an entire folder of obstacle assets into the sidebar; remove assets and automatically clear their placed instances and collision cells.
- **AI Matte**: uses Gemini by default for automatic background removal. Before matting, the app checks whether the image already has transparency and reuses the original image when it does.
- **Character Action Studio**: analyzes a character image and builds a starter action set for `idle / walk / run / attack / skill / hurt / death`.
- **Progressive Generation**: action candidates are generated in batches of 3. Every successful frame is persisted immediately and shown in the bottom candidate tray while the remaining frames continue generating.
- **Provider Fallback**: Gemini is the default AI provider, with Qwen/DashScope available as fallback. Keys are read only from environment variables.

## Stack

- Frontend: React 19, Vite, TypeScript, Ant Design
- Backend: FastAPI, Pillow, rembg, Gemini API, Qwen/DashScope API
- Runtime: Python 3.11+, Node.js 18+

## Local Development

### 1. Install Dependencies

```powershell
# Backend
py -m pip install -r backend/requirements.txt

# Frontend
cd frontend
npm install
```

### 2. Configure AI Keys

Create `.env.local` in the repository root, or set the variables in your terminal. Never commit real API keys.

Recommended variable names:

- `GEMINI_API_KEY` for Gemini
- `DASHSCOPE_API_KEY` for Qwen / DashScope

Compatible aliases:

- `GOOGLE_API_KEY` for Gemini
- `QWEN_API_KEY` for Qwen

### 3. Start the Backend

```powershell
$env:PYTHONPATH = (Get-Location).Path
py -m uvicorn backend.app.main:app --reload --port 8000
```

### 4. Start the Frontend

```powershell
cd frontend
npm run dev
```

Open `http://127.0.0.1:5173/`.

## Main API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Backend health check |
| `POST` | `/matte` | AI background removal, preferring Gemini with local rembg fallback |
| `POST` | `/character-action/analyze` | Create a character action analysis and generation job |
| `GET` | `/character-action/analyze/{job_id}` | Poll job status; processing jobs include partial candidates |
| `GET` | `/character-action/analyze/{job_id}/result` | Read the completed action result |
| `GET` | `/character-action/analyze/{job_id}/assets/{filename}` | Read generated candidate image assets |

Some legacy video-job endpoints remain in the backend, but the current Droi-game-tool product surface is the map, matte, and character-action workflow above.

## Security

- `.env.local` is for local API keys only and must not be committed.
- `backend/outputs/` contains generated assets and must not be committed.
- `.codex-runlogs/` and local log files are not product code.
- Before pushing, scan for Gemini keys, Qwen keys, and Bearer tokens.

## Validation

```powershell
cd frontend
npm run build

cd ..
py -m py_compile backend\app\main.py backend\app\gemini_provider.py backend\app\qwen_provider.py
```

## Project Layout

| Path | Description |
| --- | --- |
| `frontend/` | React frontend app |
| `backend/app/main.py` | FastAPI app and job endpoints |
| `backend/app/gemini_provider.py` | Gemini image and action generation |
| `backend/app/qwen_provider.py` | Qwen fallback provider |
| `backend/outputs/` | Local generated outputs, ignored by Git |
