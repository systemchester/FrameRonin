# Droi-game-tool

[中文](README.md) | [English](README.en.md) | [日本語](README.ja.md)

Droi-game-tool は、ゲーム用アート素材を作るための独立した制作ツールです。マップ合成、障害物編集、AI 背景除去、キャラクター動作分析と候補画像生成を 1 つのワークスペースにまとめています。UI の初期表示は英語で、ホーム画面右上から言語を切り替えられます。

## 主な機能

- **Map Studio**：マップ画像やタイルをアップロードし、合成、プレビュー、障害物配置、衝突セル編集を行えます。
- **Obstacle Editor**：単体画像またはフォルダ単位で障害物素材をサイドバーへ追加できます。素材を削除すると、配置済みインスタンスと衝突セルも整理されます。
- **AI Matte**：Gemini を優先して自動背景除去を行います。処理前に透明背景の有無を判定し、すでに透明な画像は原本をそのまま使います。
- **Character Action Studio**：キャラクター画像を分析し、`idle / walk / run / attack / skill / hurt / death` の基本アクション候補を作成します。
- **Progressive Generation**：アクション候補は 3 枚ずつ進行し、1 枚成功するたびに結果へ保存して下部候補バーに表示します。
- **Provider Fallback**：AI provider は Gemini を標準とし、失敗時は Qwen/DashScope にフォールバックできます。API Key は環境変数からのみ読み込みます。

## 技術構成

- Frontend：React 19、Vite、TypeScript、Ant Design
- Backend：FastAPI、Pillow、rembg、Gemini API、Qwen/DashScope API
- Runtime：Python 3.11+、Node.js 18+

## ローカル開発

### 1. 依存関係のインストール

```powershell
py -m pip install -r backend/requirements.txt

cd frontend
npm install
```

### 2. AI Key の設定

リポジトリ直下に `.env.local` を作成するか、ターミナルで環境変数を設定します。実際の API Key は GitHub にコミットしないでください。

推奨変数：

- `GEMINI_API_KEY`：Gemini 用
- `DASHSCOPE_API_KEY`：Qwen / DashScope 用

互換変数：

- `GOOGLE_API_KEY`：Gemini 用
- `QWEN_API_KEY`：Qwen 用

### 3. Backend の起動

```powershell
$env:PYTHONPATH = (Get-Location).Path
py -m uvicorn backend.app.main:app --reload --port 8000
```

### 4. Frontend の起動

```powershell
cd frontend
npm run dev
```

`http://127.0.0.1:5173/` を開きます。

## 主要 API

| Method | Path | 内容 |
| --- | --- | --- |
| `GET` | `/health` | Backend ヘルスチェック |
| `POST` | `/matte` | AI 背景除去。Gemini 優先、ローカル rembg fallback |
| `POST` | `/character-action/analyze` | キャラクター動作分析と生成ジョブの作成 |
| `GET` | `/character-action/analyze/{job_id}` | ジョブ状態の取得。処理中でも partial candidates を返します |
| `GET` | `/character-action/analyze/{job_id}/result` | 完了済み結果の取得 |
| `GET` | `/character-action/analyze/{job_id}/assets/{filename}` | 生成された候補画像の取得 |

Backend には一部の旧 video job API が残っていますが、現在の Droi-game-tool の中心機能は上記のマップ、背景除去、キャラクターアクション制作です。

## セキュリティ

- `.env.local` はローカル API Key 専用で、コミットしません。
- `backend/outputs/` は生成結果ディレクトリで、コミットしません。
- `.codex-runlogs/` とローカルログは製品コードではありません。
- push 前に Gemini Key、Qwen Key、Bearer Token が混入していないか確認してください。

## 検証

```powershell
cd frontend
npm run build

cd ..
py -m py_compile backend\app\main.py backend\app\gemini_provider.py backend\app\qwen_provider.py
```
