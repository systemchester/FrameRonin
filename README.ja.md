# Droi-game-tool - 動画→フレーム · マット · スプライトシート **V3**

[中文](README.md) | [English](README.en.md) | [日本語](README.ja.md)

ピクセル画像・フレームシーケンスツール集。動画フレーム抽出、GIF処理、画像マット、スプライトシート合成などに対応。

AIピクセルショップK プレビュー

## V3 の主な更新

- **全体ショートカット（ホーム／機能内）**：ホームで **C**＝GIF↔フレーム、**V**＝ピクセル画像処理、**G**＝Gemini透かし除去、**R**＝RoninPro→**カスタム縮尺**、**N**＝RoninPro→**シート調整 Pro**；メイン機能内 **B**＝ホームへ（入力欄フォーカスや Ctrl/⌘/Alt 同時は無効）。詳細は下記「Web ショートカット」。
- **RoninPro**：カスタム縮尺・カスタムスライス・サイズ統一など。NFT 要件は `frontend/src/config/features.ts` の `RONIN_PRO_REQUIRE_NFT`（現デフォルトは NFT 不要）。**R** でカスタム縮尺、**N** でシート調整 Pro にディープリンク。
- **シート調整 Pro**（RoninPro、ショートカット **N**）：**整図均等**では **N×M** が原図の分割グリッドのみ（変更で再分割）。プレビューの**列数**は 1 行あたりのコマ数と結合・書き出しレイアウトのみで、**再分割は行わない**。グリッド分割・透明隙間分割・分割前プリプロセス・コマごとの移動・四辺裁ち・結合・ZIP / GIF 出力にも対応。
- **ホームレイアウト**：RoninPro 行を **Seedance 透かし除去** と **素材・ソース共有** より上に配置。
- **GIF ↔ フレーム**：初期タブは **複数画像→1枚**；入力はデフォルト **1枚を分割**（グリッド分割後に合成）。
- **Sprite Sheet 調整**：アニメプレビューに方向ボタン、**A/D** で選択フレーム切替（入力中を除く）；フレームごとのオフセット後に **再結合** でシート出力。
- **テストシーン**：ホーム先頭行に **Top-down** と **アーケード** のデモ。

## 機能モジュール

### 動画とフレーム

- **動画→フレーム**：動画アップロード、フレーム抽出、rembgマット、スプライトシート生成
- **GIF ↔ フレーム**：GIF からフレーム抽出、フレーム→GIF、複数画像→1枚（デフォルトタブ）、1枚をグリッド分割して再合成、分割、簡易ステッチ（上下/左右）
- **Sprite Sheet**：フレーム画像分割 / GIF合成
- **Sprite Sheet 調整**：分割プレビュー、フレーム選択、アニメプレビュー（Roninログイン要）、**A/D** 等でフレーム移動、オフセット後の再結合出力

### 画像処理

- **ピクセル画像処理**：2つの入口
  - **通常処理**：スケール、内側ストローク、トリム、マット（グリーン/ブルーバック）
    - **RPGMAKER ワンクリック**：Gemini透かし除去 → 左上から連結領域マット(容差80/羽化5) → 144×144 → RPGMAKER出力
    - **RPGMAKER V2 ワンクリック（5行）**：透かし除去→256×256→先頭ピクセル連結領域マット→右64px・下透明64px→3/4行目64px下・3行目に2行目鏡像→5×3分割・各セル四辺8px裁断結合→144×240
    - **RPGMAKER V2 ワンクリック（4行）**：5行版と同じ後、下48px裁断→144×192
    - **1枚全アクション**：Gemini透かし除去 → 256×256 → 左上マット(容差80) → 右/下4px裁断 → 252×252
    - **RPGMAKER 生成**：3行分割、2行目反転複製、3行目48px下移動
  - **精密編集**：ブラシ、消しゴム、スーパー消しゴム（連結領域+容差）、背景色切替、アンドゥ(Ctrl+Z)、ズーム、パン
- **クロマキー**：グリーン/ブルーバック除去、抑色、エッジ平滑
- **ピクセル化**：ピクセルブロックスタイルに変換
- **拡大・縮小**：N×Mグリッド裁断・結合
- **Gemini 透かし除去**：Gemini生成画像の透かしを除去

### nanobanana シリーズ（Roninログイン要）

- **nanobanana RPG Maker キャラ素材生成**：GeminiでRPG Makerキャラ素材生成
- **nanobanana ピクセルシーン**・**立ち絵生成**：Geminiリンク
- **nanob 全キャラアクション**：連生アクション V4Tx3 等

### RoninPro（効率ツール）

- **RoninPro**（Roninログイン）：**カスタム縮尺**・**カスタムスライス**・**サイズ統一**・**シート調整 Pro** など。NFT 要否は `frontend/src/config/features.ts` を参照。**シート調整 Pro** では分割グリッド（N×M）とプレビュー／合成の並びを分離：N・M は再分割、列数変更は並べ替えのみ。

### デモ・試験

- **Top-down テスト**、**アーケード テスト**：操作・レイヤー描画の試験用（本番パイプライン以外）。

### その他

- **Seedance 2.0 動画透かし除去**：ローカルバックエンド要。Seedance/即梦動画の「AI生成」を除去
- **素材・ゲームソース共有**：01-美術素材、Godotスクリプト、完成プロジェクト（AIピクセルショップK含む）

### Web ショートカット

- **V**：**ホーム**画面で **ピクセル画像処理** を開く（入口選択。フォーカス等は下記と同じ）。
- **R**：**ホーム**画面で **RoninPro → カスタム縮尺** を開く（Roninログイン要、NFT 条件が有効なら該当。フォーカス等は下記と同じ）。
- **N**：**ホーム**画面で **RoninPro → シート調整 Pro** を開く（ログイン・NFT 条件は **R** と同じ）。
- **G**：**ホーム**画面で **Gemini 透かし除去** を開く（フォーカス等は下記と同じ）。
- **C**：**ホーム**画面で **GIF ↔ フレーム** モジュールを開く（カードと同じ。フォーカス・修飾キーについては下記と同じ）。
- **B**：メイン機能のいずれかを開いているときにホームへ戻る。入力欄・テキストエリア・contenteditable フォーカス時は無効。Ctrl / ⌘ / Alt と同時押しでも無効（ブラウザショートと干渉しにくくするため）。動画フローはアップロード手順をリセット、画像モジュールは入口選択に戻る。

## 環境要件

- Python 3.11+
- Node.js 18+
- Redis
- FFmpeg（PATHに配置）
- （任意）Docker + Docker Compose

## ローカル開発

### 1. 依存関係インストール

```bash
# バックエンド
pip install -r backend/requirements.txt

# フロントエンド
cd frontend && npm install
```

### 2. Redis 起動

```bash
# Windows: RedisダウンロードまたはDocker
docker run -d -p 6379:6379 redis:7-alpine

# またはローカルにRedisをインストール・起動
```

### 3. サービス起動

```bash
# ターミナル1: API
cd pixelwork
set PYTHONPATH=%CD%
python -m uvicorn backend.app.main:app --reload --port 8000

# ターミナル2: Worker
set PYTHONPATH=%CD%
rq worker pixelwork --url redis://localhost:6379/0

# ターミナル3: フロントエンド
cd frontend && npm run dev
```

[http://localhost:5173](http://localhost:5173) を開く

### 4. rembg / U2Net（バックエンドのみ）

「動画→フレーム」フロントはクロマキー使用のためモデル不要。バックエンド+Workerでサーバー側マットを行う場合、初回にU2Net（約176MB）をダウンロード。

## GitHub Pages プレビュー

GitHub Actionsで`main`へのプッシュ時に自動ビルド・デプロイ。

**初回：Pages有効化**

1. [https://github.com/systemchester/FrameRonin/settings/pages](https://github.com/systemchester/FrameRonin/settings/pages) を開く
2. **Build and deployment**で**Source**を**GitHub Actions**に
3. 保存。以降`main`プッシュで自動デプロイ

**URL:** [https://systemchester.github.io/FrameRonin/](https://systemchester.github.io/FrameRonin/)

> 現在はフロントエンドのみデプロイ。GIF のフレーム抽出・合成、ピクセル画像処理（精密編集含む）、クロマキー、簡易ステッチ、Sprite Sheet、RPGMAKER ワンクリック、動画→フレームが利用可能。

## Docker

```bash
docker-compose up -d
```

- フロント: [http://localhost:5173](http://localhost:5173)
- API: [http://localhost:8000](http://localhost:8000)
- Redis: localhost:6379

## API


| メソッド   | パス                               | 説明              |
| ------ | -------------------------------- | --------------- |
| POST   | /jobs                            | タスク作成（動画アップロード） |
| GET    | /jobs/{id}                       | タスク状態取得         |
| GET    | /jobs/{id}/result?format=png|zip | 結果ダウンロード        |
| GET    | /jobs/{id}/index                 | インデックスJSON取得    |
| DELETE | /jobs/{id}                       | タスク削除           |


## インデックスJSON例

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

## リンク

- **Bilibili**: [https://space.bilibili.com/285760](https://space.bilibili.com/285760)

## ドキュメント


| 文書                                                         | 内容                       |
| ---------------------------------------------------------- | ------------------------ |
| [DEV_DOC_video2timesheet.md](./DEV_DOC_video2timesheet.md) | 動画→フレーム / スプライトシート設計・API |
| [DEV_PLAN_extensions.md](./DEV_PLAN_extensions.md)         | 拡張計画と V3 実装済み一覧          |
| [DEPLOY.md](./DEPLOY.md)                                   | プッシュ・CNB/EdgeOne・デプロイ注意  |
| [frontend/README.md](./frontend/README.md)                 | フロントエンド README           |
