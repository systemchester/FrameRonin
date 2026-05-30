import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import {
  ArrowLeftOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ThunderboltOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { Button, ConfigProvider, Empty, Input, InputNumber, Progress, Select, Slider, Switch, Tag, Typography, message } from 'antd'
import type { ThemeConfig } from 'antd'
import {
  createCharacterActionAnalysisJob,
  getCharacterActionAnalysisJob,
  getCharacterActionAnalysisResult,
  type CharacterActionAnalysisCandidate,
  type CharacterActionFramePlanItem,
  type CharacterActionAnalysisJob,
} from '../../api'
import {
  AI_ACTION_FRAME_COUNTS,
  ACTION_NAMES,
  DEFAULT_ACTION_CONFIGS,
  DEFAULT_CANVAS_SIZE,
  type ActionConfig,
  type AttachPoint,
  type AiActionAnalysisJob,
  type BaseCharacterModel,
  type CharacterScaleMode,
  type CharacterActionName,
  type CharacterFrameAsset,
  type GeneratedActionCandidate,
  type LayerTarget,
  type WeaponVariant,
  createWeaponVariant,
} from './characterActionModel'
import { exportCharacterActionZip } from './characterActionExport'
import {
  compareFileNamesByActionAndNumber,
  createCharacterFrameFromBlob,
  inferActionFromName,
  loadLayerAsset,
  normalizeCharacterFrame,
  revokeFrameAsset,
  revokeLayerAsset,
} from './characterImageTools'
import { useLanguage } from '../../i18n/context'
import './CharacterActionComposer.css'

const { Text, Title } = Typography

const characterActionTheme: ThemeConfig = {
  token: {
    colorPrimary: '#74e5ff',
    colorPrimaryHover: '#9af0ff',
    colorPrimaryActive: '#42c7e8',
    colorBgContainer: '#10162f',
    colorBgElevated: '#111a36',
    colorText: '#ffffff',
    colorTextSecondary: '#aeb4cf',
    colorBorder: 'rgba(116, 229, 255, 0.22)',
    colorFillSecondary: 'rgba(116, 229, 255, 0.08)',
    borderRadius: 14,
  },
}

type CharacterActionComposerProps = {
  onBack: () => void
}

type DragState = {
  target: LayerTarget
}

const AI_ANALYSIS_PROCESSING = 'Analyzing character actions'
const PROCESSING_BASE = 'Processing base character'
const PROCESSING_FRAMES = 'Processing character frames'
const PROCESSING_WEAPON = 'Processing weapon art'
const PROCESSING_EFFECT = 'Processing attack effect'
const PROCESSING_EXPORT = 'Packaging action assets'
const DEFAULT_STAGE_ZOOM = 1.08
const ANALYSIS_POLL_INTERVAL_MS = 1000
const ANALYSIS_MAX_POLLS = 1800

const characterCopy = {
  en: {
    back: 'Back Home',
    kicker: 'Droi-game-tool Character Action',
    title: 'Character Action Pack Studio',
    subtitle: 'Build game-ready action packs from uploaded or AI-generated frames, with Godot SpriteFrames-style organization.',
    autoMatte: 'Auto background removal',
    exportActionPack: 'Export Action Pack',
    workflow: 'Workflow',
    nextStep: 'Next Step',
    done: 'Done',
    baseCharacter: 'Base Character',
    baseCharacterHint: 'Upload one base character image. It will be matted and normalized before AI generates action candidates.',
    uploadBaseModel: 'Upload Base Model',
    analyzeActions: 'Analyze Character Actions',
    analysisFailed: 'Analysis Failed',
    analysisComplete: 'Analysis Complete',
    analyzing: 'Analyzing',
    analysisDefaultHint: 'Generates 21 lightweight standard action candidates.',
    characterFrames: 'Character Frames',
    characterFramesHint: 'Upload one or more frames. Filenames containing attack, walk, and similar keywords are categorized automatically.',
    uploadCharacterImages: 'Upload Character Images',
    pixelArtMode: 'Pixel Art Mode',
    scaleMode: 'Scale Mode',
    weaponLevel: 'Weapon Level',
    weaponTiers: 'Weapon Tiers',
    add: 'Add',
    delete: 'Delete',
    weaponSet: 'Weapon set',
    waitingWeapon: 'Waiting for weapon',
    effectSet: 'Effect set',
    waitingEffect: 'Waiting for effect',
    tierName: 'Tier name',
    uploadWeapon: 'Upload Weapon',
    uploadEffect: 'Upload Effect',
    weaponAssets: 'Weapon Assets',
    noWeapon: 'No weapon uploaded yet',
    effectAssets: 'Effect Assets',
    noEffect: 'No attack effect uploaded yet',
    library: 'Library',
    frameLibrary: 'Frame Library',
    noFrames: 'No character frames yet',
    zoomOut: 'Zoom canvas out',
    zoomIn: 'Zoom canvas in',
    fit: 'Fit',
    waitingFrames: 'Waiting for character frames',
    frameUnit: 'frames',
    view: 'View',
    emptyStageTitle: 'Upload character images to preview',
    emptyStageHint: 'The system will remove backgrounds and normalize frames to a 512 x 512 transparent canvas.',
    properties: 'Properties',
    weaponLayer: 'Weapon Layer',
    effectLayer: 'Effect Layer',
    scale: 'Scale',
    rotation: 'Rotation',
    opacity: 'Opacity',
    layer: 'Layer',
    attachPoint: 'Attach Point',
    actionConfig: 'Action Config',
    loop: 'Loop',
    hitFrame: 'Hit Frame',
    effectStartFrame: 'Effect Start Frame',
    effectEndFrame: 'Effect End Frame',
    showAiResults: 'Show AI Results',
    aiActionCandidates: 'AI Action Candidates',
    aiResults: 'AI Generated Results',
    aiResultsHint: 'Hover to inspect a larger preview. Drag candidates into matching action slots to add them as production frames.',
    hide: 'Hide',
    added: 'Added',
    inheritWeapon: 'Inherit Previous Weapon',
    matteProcessed: 'Background removed',
    matteFailedOriginal: 'Matte failed, using original',
    matteFailed: 'Matte failed',
    original: 'Original',
    uploadBaseFirst: 'Upload a base character first.',
    baseNormalized: 'Base character normalized.',
    baseFailed: 'Base character processing failed.',
    candidateLoadFailed: '{name} failed to load.',
    analysisFailedMessage: 'AI action analysis failed.',
    analysisStillRunning: 'AI analysis is still running. Please keep this page open.',
    providerPlaceholder: 'AI provider is not configured. Placeholder candidates are shown so you can test drag and export.',
    candidatesGenerated: 'AI action candidates generated.',
    framesAdded: 'Added {count} character frame(s).',
    frameProcessFailed: 'Character frame processing failed.',
    layerAdded: '{target} added to the current tier.',
    assetProcessFailed: 'Asset processing failed.',
    keepOneTier: 'Keep at least one weapon tier.',
    wrongSlot: 'Drop this candidate into the {action} slot.',
    candidateAdded: '{action} candidate added to the action slot.',
    candidateAddFailed: 'Failed to add candidate frame.',
    uploadFrameFirst: 'Upload at least one character action frame first.',
    exportSuccess: 'Action asset pack exported.',
    exportFailed: 'Action asset pack export failed.',
    weapon: 'Weapon',
    attackEffect: 'Attack effect',
    scaleModes: { fitHeight: 'Fit height', original: 'Keep original size', integer: 'Integer scale' },
    actions: { idle: 'Idle', walk: 'Walk', run: 'Run', attack: 'Attack', skill: 'Skill', hurt: 'Hurt', death: 'Death' },
    attach: { rightHand: 'Right Hand', leftHand: 'Left Hand', body: 'Body', weapon: 'Weapon', frontEffect: 'Front Effect' },
    steps: [
      ['Upload base character', 'Upload one base character image. It will be matted and normalized to 512 x 512.'],
      ['Analyze actions with AI', 'Generate idle, walk, run, attack, skill, hurt, and death candidate frames.'],
      ['Assign action types', 'Drag AI candidates into the matching action slots, or upload frames manually.'],
      ['Configure weapon tiers', 'Upload or choose weapon and attack-effect art for each tier.'],
      ['Align and preview', 'Drag weapon and effect layers on the canvas, then fine tune scale, rotation, and timing.'],
      ['Export action pack', 'Export PNG frames, sprite sheets, action JSON, and manifest snippets.'],
    ],
  },
  zh: {
    back: '返回首页',
    kicker: 'Droi-game-tool 人物动作',
    title: '人物动作包制作',
    subtitle: '从上传帧或 AI 生成帧制作游戏可用动作包，并按 Godot SpriteFrames 思路组织动作。',
    autoMatte: '自动抠图去背',
    exportActionPack: '导出动作包',
    workflow: '工作流',
    nextStep: '下一步',
    done: '完成',
    baseCharacter: '基础人物模型',
    baseCharacterHint: '上传一张基础人物图，系统会先去背并标准化，再用于 AI 分析动作候选。',
    uploadBaseModel: '上传基础模型',
    analyzeActions: 'AI 分析人物动作',
    analysisFailed: '分析失败',
    analysisComplete: '分析完成',
    analyzing: '正在分析',
    analysisDefaultHint: '将生成 21 张标准轻量动作候选图。',
    characterFrames: '人物动作帧',
    characterFramesHint: '支持单张或多张上传，文件名包含 attack / walk 等关键词会自动归类。',
    uploadCharacterImages: '上传人物图片',
    pixelArtMode: '像素风模式',
    scaleMode: '缩放策略',
    weaponLevel: '武器等级',
    weaponTiers: '武器等级',
    add: '新增',
    delete: '删除',
    weaponSet: '武器已配置',
    waitingWeapon: '等待武器',
    effectSet: '特效已配置',
    waitingEffect: '等待特效',
    tierName: '等级名称',
    uploadWeapon: '上传武器',
    uploadEffect: '上传特效',
    weaponAssets: '武器素材',
    noWeapon: '还没有上传武器',
    effectAssets: '特效素材',
    noEffect: '还没有上传攻击特效',
    library: '素材库',
    frameLibrary: '帧素材库',
    noFrames: '还没有人物帧',
    zoomOut: '缩小画布',
    zoomIn: '放大画布',
    fit: '适配',
    waitingFrames: '等待人物帧',
    frameUnit: '帧',
    view: '视图',
    emptyStageTitle: '上传人物图片后开始预览',
    emptyStageHint: '系统会自动去背并标准化到 512 x 512 透明画布。',
    properties: '属性面板',
    weaponLayer: '武器层',
    effectLayer: '特效层',
    scale: '缩放',
    rotation: '旋转',
    opacity: '透明度',
    layer: '层级',
    attachPoint: '挂点',
    actionConfig: '动作配置',
    loop: '循环',
    hitFrame: '命中帧',
    effectStartFrame: '特效开始帧',
    effectEndFrame: '特效结束帧',
    showAiResults: '展开 AI 结果',
    aiActionCandidates: 'AI 动作候选',
    aiResults: 'AI 生成结果区',
    aiResultsHint: '悬停查看大图，拖到下方对应动作槽位后才会加入正式动作帧。',
    hide: '隐藏',
    added: '已加入',
    inheritWeapon: '继承上一级武器',
    matteProcessed: '已去背',
    matteFailedOriginal: '去背失败，使用原图',
    matteFailed: '去背失败',
    original: '原图',
    uploadBaseFirst: '请先上传基础人物模型。',
    baseNormalized: '基础人物模型已标准化。',
    baseFailed: '基础人物模型处理失败。',
    candidateLoadFailed: '{name} 读取失败。',
    analysisFailedMessage: 'AI 分析人物动作失败。',
    analysisStillRunning: 'AI 仍在分析中，请保持当前页面打开。',
    providerPlaceholder: 'AI provider 未配置，当前展示占位候选图，可先验证拖拽和导出流程。',
    candidatesGenerated: 'AI 动作候选图已生成。',
    framesAdded: '已加入 {count} 张人物动作帧。',
    frameProcessFailed: '人物动作帧处理失败。',
    layerAdded: '{target}已加入当前等级。',
    assetProcessFailed: '素材处理失败。',
    keepOneTier: '至少保留一个武器等级。',
    wrongSlot: '请拖入对应动作槽位：{action}。',
    candidateAdded: '{action}候选帧已加入动作槽。',
    candidateAddFailed: '候选帧加入失败。',
    uploadFrameFirst: '请先上传至少一张人物动作帧。',
    exportSuccess: '动作资源包已导出。',
    exportFailed: '动作资源包导出失败。',
    weapon: '武器',
    attackEffect: '攻击特效',
    scaleModes: { fitHeight: '自动适配高度', original: '保持原始大小', integer: '整数倍放大' },
    actions: { idle: '待机', walk: '行走', run: '奔跑', attack: '攻击', skill: '技能', hurt: '受击', death: '死亡' },
    attach: { rightHand: '右手', leftHand: '左手', body: '身体', weapon: '武器', frontEffect: '前景特效' },
    steps: [
      ['上传基础人物模型', '上传一张基础人物图，系统会去背并标准化为 512 x 512。'],
      ['AI 分析人物动作', '生成待机、行走、奔跑、攻击、技能、受击、死亡候选动作图。'],
      ['分配动作类型', '把 AI 候选图拖入下方对应动作槽，或手动上传动作帧。'],
      ['配置武器等级', '每个等级上传或选择武器实体图和攻击特效图。'],
      ['拖动对位并预览', '在中间画布拖动武器/特效，右侧精调缩放、旋转和特效帧。'],
      ['导出动作包', '导出 PNG 帧、sprite sheet、动作 JSON 和 manifest 片段。'],
    ],
  },
  ja: {
    back: 'ホームへ戻る',
    kicker: 'Droi-game-tool キャラクター動作',
    title: 'キャラクター動作パック制作',
    subtitle: 'アップロードまたは AI 生成フレームから、Godot SpriteFrames 形式に近いゲーム用動作パックを作成します。',
    autoMatte: '自動背景除去',
    exportActionPack: '動作パックを書き出す',
    workflow: 'ワークフロー',
    nextStep: '次のステップ',
    done: '完了',
    baseCharacter: 'ベースキャラクター',
    baseCharacterHint: 'ベース画像を 1 枚アップロードします。背景除去と標準化後、AI の動作候補生成に使います。',
    uploadBaseModel: 'ベースをアップロード',
    analyzeActions: 'キャラクター動作を分析',
    analysisFailed: '分析失敗',
    analysisComplete: '分析完了',
    analyzing: '分析中',
    analysisDefaultHint: '標準の軽量動作候補を 21 枚生成します。',
    characterFrames: 'キャラクターフレーム',
    characterFramesHint: '1 枚または複数枚をアップロードできます。attack / walk などを含むファイル名は自動分類されます。',
    uploadCharacterImages: 'キャラクター画像をアップロード',
    pixelArtMode: 'ピクセルアートモード',
    scaleMode: 'スケール方式',
    weaponLevel: '武器レベル',
    weaponTiers: '武器レベル',
    add: '追加',
    delete: '削除',
    weaponSet: '武器設定済み',
    waitingWeapon: '武器待ち',
    effectSet: 'エフェクト設定済み',
    waitingEffect: 'エフェクト待ち',
    tierName: 'レベル名',
    uploadWeapon: '武器をアップロード',
    uploadEffect: 'エフェクトをアップロード',
    weaponAssets: '武器素材',
    noWeapon: '武器はまだありません',
    effectAssets: 'エフェクト素材',
    noEffect: '攻撃エフェクトはまだありません',
    library: 'ライブラリ',
    frameLibrary: 'フレームライブラリ',
    noFrames: 'キャラクターフレームはまだありません',
    zoomOut: 'キャンバスを縮小',
    zoomIn: 'キャンバスを拡大',
    fit: 'フィット',
    waitingFrames: 'キャラクターフレーム待ち',
    frameUnit: 'フレーム',
    view: '表示',
    emptyStageTitle: 'キャラクター画像をアップロードしてプレビュー',
    emptyStageHint: '背景を除去し、512 x 512 の透明キャンバスへ標準化します。',
    properties: 'プロパティ',
    weaponLayer: '武器レイヤー',
    effectLayer: 'エフェクトレイヤー',
    scale: 'スケール',
    rotation: '回転',
    opacity: '不透明度',
    layer: 'レイヤー',
    attachPoint: 'アタッチ先',
    actionConfig: '動作設定',
    loop: 'ループ',
    hitFrame: 'ヒットフレーム',
    effectStartFrame: 'エフェクト開始',
    effectEndFrame: 'エフェクト終了',
    showAiResults: 'AI 結果を表示',
    aiActionCandidates: 'AI 動作候補',
    aiResults: 'AI 生成結果',
    aiResultsHint: 'ホバーで拡大表示します。対応する動作スロットへドラッグすると正式フレームに追加されます。',
    hide: '隠す',
    added: '追加済み',
    inheritWeapon: '前レベルの武器を継承',
    matteProcessed: '背景除去済み',
    matteFailedOriginal: '除去失敗、元画像を使用',
    matteFailed: '除去失敗',
    original: '元画像',
    uploadBaseFirst: '先にベースキャラクターをアップロードしてください。',
    baseNormalized: 'ベースキャラクターを標準化しました。',
    baseFailed: 'ベースキャラクター処理に失敗しました。',
    candidateLoadFailed: '{name} の読み込みに失敗しました。',
    analysisFailedMessage: 'AI 動作分析に失敗しました。',
    analysisStillRunning: 'AI 分析はまだ実行中です。このページを開いたままお待ちください。',
    providerPlaceholder: 'AI provider が未設定です。ドラッグと書き出し確認用の候補を表示します。',
    candidatesGenerated: 'AI 動作候補を生成しました。',
    framesAdded: '{count} 枚のキャラクターフレームを追加しました。',
    frameProcessFailed: 'キャラクターフレーム処理に失敗しました。',
    layerAdded: '{target}を現在のレベルへ追加しました。',
    assetProcessFailed: '素材処理に失敗しました。',
    keepOneTier: '武器レベルは 1 つ以上必要です。',
    wrongSlot: '{action} スロットへドラッグしてください。',
    candidateAdded: '{action}候補を動作スロットへ追加しました。',
    candidateAddFailed: '候補フレームの追加に失敗しました。',
    uploadFrameFirst: '先にキャラクター動作フレームを 1 枚以上アップロードしてください。',
    exportSuccess: '動作素材パックを書き出しました。',
    exportFailed: '動作素材パックの書き出しに失敗しました。',
    weapon: '武器',
    attackEffect: '攻撃エフェクト',
    scaleModes: { fitHeight: '高さに合わせる', original: '元サイズを維持', integer: '整数倍スケール' },
    actions: { idle: '待機', walk: '歩行', run: '走行', attack: '攻撃', skill: 'スキル', hurt: '被弾', death: '死亡' },
    attach: { rightHand: '右手', leftHand: '左手', body: '身体', weapon: '武器', frontEffect: '前景エフェクト' },
    steps: [
      ['ベースキャラクターをアップロード', '1 枚のベース画像を背景除去し、512 x 512 に標準化します。'],
      ['AI で動作を分析', '待機、歩行、走行、攻撃、スキル、被弾、死亡の候補を生成します。'],
      ['動作タイプを割り当て', 'AI 候補を対応する動作スロットへドラッグ、または手動でフレームをアップロードします。'],
      ['武器レベルを設定', '各レベルで武器画像と攻撃エフェクトを選択します。'],
      ['位置合わせとプレビュー', 'キャンバス上で武器/エフェクトを動かし、右側でスケールやタイミングを調整します。'],
      ['動作パックを書き出し', 'PNG フレーム、sprite sheet、動作 JSON、manifest 断片を書き出します。'],
    ],
  },
}

function formatCopy(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ''))
}

const aiGenerationCopy = {
  queued: 'Queued',
  generatingFrame: 'Generating',
  failedFrame: 'Failed',
  generationQueued: 'Queued {total} frames',
  generationStatus: 'Generating {done}/{total} - Batch {batch}',
  generationComplete: 'Generated {done}/{total} frames',
  generationPartialFailed: 'Stopped after {done}/{total} frames',
  continueGeneration: 'Continue Generation',
}

function matteLabel(status: CharacterFrameAsset['matteStatus'], copy: typeof characterCopy.en) {
  if (status === 'processed') return copy.matteProcessed
  if (status === 'failed') return copy.matteFailedOriginal
  return copy.original
}

function layerMatteLabel(status: Awaited<ReturnType<typeof loadLayerAsset>>['matteStatus'], copy: typeof characterCopy.en) {
  if (status === 'processed') return copy.matteProcessed
  if (status === 'failed') return copy.matteFailed
  return copy.original
}

function clampCanvasPoint(value: number) {
  return Math.max(0, Math.min(DEFAULT_CANVAS_SIZE, Math.round(value)))
}

function clampStageZoom(value: number) {
  return Math.max(0.42, Math.min(1.8, Number(value.toFixed(2))))
}

function makeActionConfigs(): Record<CharacterActionName, ActionConfig> {
  return Object.fromEntries(
    ACTION_NAMES.map((action) => [action, { ...DEFAULT_ACTION_CONFIGS[action] }]),
  ) as Record<CharacterActionName, ActionConfig>
}

function normalizeFrameIndexes(frameList: CharacterFrameAsset[]): CharacterFrameAsset[] {
  const actionCounters = new Map<CharacterActionName, number>()
  return frameList.map((frame) => {
    const nextIndex = actionCounters.get(frame.action) || 0
    actionCounters.set(frame.action, nextIndex + 1)
    return frame.frameIndex === nextIndex ? frame : { ...frame, frameIndex: nextIndex }
  })
}

function sortFramesByActionAndIndex(frameList: CharacterFrameAsset[]): CharacterFrameAsset[] {
  return [...frameList].sort(
    (a, b) =>
      ACTION_NAMES.indexOf(a.action) - ACTION_NAMES.indexOf(b.action)
      || a.frameIndex - b.frameIndex
      || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
  )
}

function sortCandidatesByActionAndIndex(candidateList: GeneratedActionCandidate[]): GeneratedActionCandidate[] {
  return [...candidateList].sort(
    (a, b) =>
      ACTION_NAMES.indexOf(a.action) - ACTION_NAMES.indexOf(b.action)
      || a.frameIndex - b.frameIndex
      || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
  )
}

function candidateFileName(candidate: CharacterActionAnalysisCandidate): string {
  return candidate.filename || `${candidate.action}_${String(candidate.frame_index + 1).padStart(3, '0')}.png`
}

function candidateSourceKey(jobId: string, candidate: CharacterActionAnalysisCandidate): string {
  return `${jobId}:${candidate.id || candidateFileName(candidate)}`
}

function aiJobFromResponse(job: CharacterActionAnalysisJob): AiActionAnalysisJob {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    generatedCount: job.result?.generated_count ?? job.result?.candidates?.length ?? 0,
    totalCount: job.result?.total_count,
    batchSize: job.result?.batch_size,
    currentBatchIndex: job.result?.current_batch_index,
    fixedFrameCounts: job.result?.fixed_frame_counts,
    error: job.error,
    warning: job.warning,
  }
}

function actionFrameOffset(action: CharacterActionName, counts: Record<CharacterActionName, number>): number {
  const actionIndex = ACTION_NAMES.indexOf(action)
  return ACTION_NAMES.slice(0, Math.max(0, actionIndex)).reduce((sum, name) => sum + (counts[name] || 0), 0)
}

function buildMissingFramePlan(
  candidates: GeneratedActionCandidate[],
  counts: Record<CharacterActionName, number>,
): CharacterActionFramePlanItem[] {
  const readySlots = new Set(candidates.map((candidate) => `${candidate.action}:${candidate.frameIndex}`))
  return ACTION_NAMES.flatMap((action) => {
    const frameCount = Math.max(0, counts[action] || 0)
    return Array.from({ length: frameCount }, (_, frameIndex) => ({ action, frameIndex }))
      .filter(({ action: slotAction, frameIndex }) => !readySlots.has(`${slotAction}:${frameIndex}`))
      .map(({ action: slotAction, frameIndex }) => ({
        action: slotAction,
        frame_index: frameIndex,
        frame_count: frameCount,
      }))
  })
}

export default function CharacterActionComposer({ onBack }: CharacterActionComposerProps) {
  const { lang } = useLanguage()
  const copy = characterCopy[lang]
  const actionLabels = copy.actions
  const attachOptions = useMemo(
    () => Object.entries(copy.attach).map(([value, label]) => ({ value: value as AttachPoint, label })),
    [copy],
  )
  const scaleModeOptions = useMemo<{ value: CharacterScaleMode; label: string }[]>(() => [
    { value: 'fitHeight', label: copy.scaleModes.fitHeight },
    { value: 'original', label: copy.scaleModes.original },
    { value: 'integer', label: copy.scaleModes.integer },
  ], [copy])
  const [frames, setFrames] = useState<CharacterFrameAsset[]>([])
  const [weaponAssets, setWeaponAssets] = useState<Awaited<ReturnType<typeof loadLayerAsset>>[]>([])
  const [effectAssets, setEffectAssets] = useState<Awaited<ReturnType<typeof loadLayerAsset>>[]>([])
  const [variants, setVariants] = useState<WeaponVariant[]>(() => [createWeaponVariant(1)])
  const [activeVariantId, setActiveVariantId] = useState(() => variants[0].id)
  const [selectedLayer, setSelectedLayer] = useState<LayerTarget>('weapon')
  const [currentAction, setCurrentAction] = useState<CharacterActionName>('idle')
  const [frameCursor, setFrameCursor] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [autoMatte, setAutoMatte] = useState(true)
  const [pixelArtMode, setPixelArtMode] = useState(true)
  const [scaleMode, setScaleMode] = useState<CharacterScaleMode>('fitHeight')
  const [baseModel, setBaseModel] = useState<BaseCharacterModel | null>(null)
  const [aiJob, setAiJob] = useState<AiActionAnalysisJob | null>(null)
  const [generatedCandidates, setGeneratedCandidates] = useState<GeneratedActionCandidate[]>([])
  const [previewCandidate, setPreviewCandidate] = useState<GeneratedActionCandidate | null>(null)
  const [aiTrayHidden, setAiTrayHidden] = useState(false)
  const [processing, setProcessing] = useState<string | null>(null)
  const [actionConfigs, setActionConfigs] = useState<Record<CharacterActionName, ActionConfig>>(() => makeActionConfigs())
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [stageZoom, setStageZoom] = useState(DEFAULT_STAGE_ZOOM)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const baseModelInputRef = useRef<HTMLInputElement | null>(null)
  const characterInputRef = useRef<HTMLInputElement | null>(null)
  const weaponInputRef = useRef<HTMLInputElement | null>(null)
  const effectInputRef = useRef<HTMLInputElement | null>(null)
  const framesRef = useRef<CharacterFrameAsset[]>([])
  const weaponAssetsRef = useRef<Awaited<ReturnType<typeof loadLayerAsset>>[]>([])
  const effectAssetsRef = useRef<Awaited<ReturnType<typeof loadLayerAsset>>[]>([])
  const baseModelRef = useRef<BaseCharacterModel | null>(null)
  const generatedCandidatesRef = useRef<GeneratedActionCandidate[]>([])

  const actionFrames = useMemo(
    () => frames.filter((frame) => frame.action === currentAction).sort((a, b) => a.frameIndex - b.frameIndex),
    [frames, currentAction],
  )
  const currentFrame = actionFrames.length > 0 ? actionFrames[Math.max(0, frameCursor) % actionFrames.length] : null
  const activeVariant = variants.find((variant) => variant.id === activeVariantId) || variants[0]
  const activeWeapon = activeVariant?.weaponAssetId
    ? weaponAssets.find((asset) => asset.id === activeVariant.weaponAssetId)
    : undefined
  const activeEffect = activeVariant?.effectAssetId
    ? effectAssets.find((asset) => asset.id === activeVariant.effectAssetId)
    : undefined
  const showEffectLayer = currentAction === 'attack' || currentAction === 'skill'
    ? frameCursor >= actionConfigs[currentAction].effectStartFrame && frameCursor <= actionConfigs[currentAction].effectEndFrame
    : false
  const selectedTransform = activeVariant?.[`${selectedLayer}Transform`]
  const workflowSteps = useMemo(() => {
    const hasFrames = frames.length > 0
    const hasBaseModel = Boolean(baseModel)
    const hasAiCandidates = generatedCandidates.length > 0
    const hasVariantAsset = variants.some((variant) => variant.weaponAssetId || variant.effectAssetId)
    const hasPositionedLayer = hasVariantAsset && variants.some((variant) => variant.weaponTransform || variant.effectTransform)
    const [baseStep, aiStep, assignStep, weaponStep, previewStep, exportStep] = copy.steps
    return [
      {
        title: baseStep[0],
        detail: baseStep[1],
        done: hasBaseModel,
      },
      {
        title: aiStep[0],
        detail: aiStep[1],
        done: hasAiCandidates,
      },
      {
        title: assignStep[0],
        detail: assignStep[1],
        done: hasFrames,
      },
      {
        title: weaponStep[0],
        detail: weaponStep[1],
        done: hasVariantAsset,
      },
      {
        title: previewStep[0],
        detail: previewStep[1],
        done: hasPositionedLayer,
      },
      {
        title: exportStep[0],
        detail: exportStep[1],
        done: false,
      },
    ]
  }, [baseModel, copy, frames.length, generatedCandidates.length, variants])
  const nextWorkflowStep = workflowSteps.find((step) => !step.done) || workflowSteps[workflowSteps.length - 1]
  const aiFixedFrameCounts = aiJob?.fixedFrameCounts || AI_ACTION_FRAME_COUNTS
  const aiTotalCount = aiJob?.totalCount || ACTION_NAMES.reduce((sum, action) => sum + (aiFixedFrameCounts[action] || 0), 0)
  const aiGeneratedCount = aiJob?.generatedCount ?? generatedCandidates.length
  const aiBatchSize = aiJob?.batchSize || 3
  const aiCurrentBatchIndex = aiJob?.status === 'processing'
    ? Math.max(1, aiJob.currentBatchIndex || Math.floor(aiGeneratedCount / aiBatchSize) + 1)
    : aiJob?.currentBatchIndex || (aiGeneratedCount > 0 ? Math.floor((aiGeneratedCount - 1) / aiBatchSize) + 1 : 0)
  const aiCurrentBatchStart = aiJob?.status === 'processing' ? Math.max(0, (aiCurrentBatchIndex - 1) * aiBatchSize) : aiGeneratedCount
  const aiCurrentBatchEnd = aiJob?.status === 'processing' ? Math.min(aiTotalCount, aiCurrentBatchStart + aiBatchSize) : aiGeneratedCount
  const showAiTray = Boolean(aiJob) || generatedCandidates.length > 0
  const aiProgressText = aiJob?.status === 'completed'
    ? formatCopy(aiGenerationCopy.generationComplete, { done: aiGeneratedCount, total: aiTotalCount })
    : aiJob?.status === 'failed'
      ? formatCopy(aiGenerationCopy.generationPartialFailed, { done: aiGeneratedCount, total: aiTotalCount })
      : aiJob?.status === 'queued'
        ? formatCopy(aiGenerationCopy.generationQueued, { total: aiTotalCount })
        : formatCopy(aiGenerationCopy.generationStatus, { done: aiGeneratedCount, total: aiTotalCount, batch: Math.max(1, aiCurrentBatchIndex) })
  const aiMissingFramePlan = useMemo(
    () => buildMissingFramePlan(generatedCandidates, aiFixedFrameCounts),
    [aiFixedFrameCounts, generatedCandidates],
  )
  const canContinueGeneration = Boolean(baseModel)
    && aiMissingFramePlan.length > 0
    && aiJob?.status !== 'queued'
    && aiJob?.status !== 'processing'
  const continueGenerationLabel = lang === 'en' ? aiGenerationCopy.continueGeneration : '继续生成'

  useEffect(() => {
    setFrameCursor(0)
  }, [currentAction])

  useEffect(() => {
    framesRef.current = frames
  }, [frames])

  useEffect(() => {
    weaponAssetsRef.current = weaponAssets
  }, [weaponAssets])

  useEffect(() => {
    effectAssetsRef.current = effectAssets
  }, [effectAssets])

  useEffect(() => {
    baseModelRef.current = baseModel
  }, [baseModel])

  useEffect(() => {
    generatedCandidatesRef.current = generatedCandidates
  }, [generatedCandidates])

  useEffect(() => () => {
    framesRef.current.forEach(revokeFrameAsset)
    weaponAssetsRef.current.forEach(revokeLayerAsset)
    effectAssetsRef.current.forEach(revokeLayerAsset)
    if (baseModelRef.current) revokeFrameAsset(baseModelRef.current.preview)
    generatedCandidatesRef.current.forEach((candidate) => URL.revokeObjectURL(candidate.url))
  }, [])

  useEffect(() => {
    if (!playing || actionFrames.length <= 1) return undefined
    const fps = Math.max(1, actionConfigs[currentAction].fps)
    const id = window.setInterval(() => {
      setFrameCursor((value) => {
        const next = value + 1
        if (next < actionFrames.length) return next
        return actionConfigs[currentAction].loop ? 0 : value
      })
    }, 1000 / fps)
    return () => window.clearInterval(id)
  }, [actionConfigs, actionFrames.length, currentAction, playing])

  useEffect(() => {
    if (!previewCandidate) return undefined
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewCandidate(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [previewCandidate])

  function updateActiveVariant(updater: (variant: WeaponVariant) => WeaponVariant) {
    setVariants((prev) => prev.map((variant) => (variant.id === activeVariantId ? updater(variant) : variant)))
  }

  function updateTransform(target: LayerTarget, patch: Partial<WeaponVariant[`${LayerTarget}Transform`]>) {
    updateActiveVariant((variant) => ({
      ...variant,
      [`${target}Transform`]: {
        ...variant[`${target}Transform`],
        ...patch,
      },
    }))
  }

  function pointerToCanvasPoint(event: React.PointerEvent) {
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return { x: DEFAULT_CANVAS_SIZE / 2, y: DEFAULT_CANVAS_SIZE / 2 }
    return {
      x: clampCanvasPoint(((event.clientX - rect.left) / rect.width) * DEFAULT_CANVAS_SIZE),
      y: clampCanvasPoint(((event.clientY - rect.top) / rect.height) * DEFAULT_CANVAS_SIZE),
    }
  }

  function clearGeneratedCandidates() {
    setPreviewCandidate(null)
    setGeneratedCandidates((prev) => {
      prev.forEach((candidate) => URL.revokeObjectURL(candidate.url))
      generatedCandidatesRef.current = []
      return []
    })
  }

  async function handleBaseModelUpload(files: FileList | null) {
    if (!files?.length) return
    const file = Array.from(files).find((item) => item.type.startsWith('image/'))
    if (!file) return
    setProcessing(PROCESSING_BASE)
    try {
      const preview = await normalizeCharacterFrame(file, 'idle', 0, autoMatte, { pixelArtMode, scaleMode })
      setBaseModel((prev) => {
        if (prev) revokeFrameAsset(prev.preview)
        return {
          id: preview.id,
          name: file.name,
          sourceFile: file,
          preview,
        }
      })
      setAiJob(null)
      clearGeneratedCandidates()
      setAiTrayHidden(false)
      message.success(copy.baseNormalized)
    } catch (error) {
      message.error(error instanceof Error ? error.message : copy.baseFailed)
    } finally {
      setProcessing(null)
      if (baseModelInputRef.current) baseModelInputRef.current.value = ''
    }
  }

  async function mergeGeneratedCandidates(jobId: string, candidates: CharacterActionAnalysisCandidate[]) {
    const loaded: GeneratedActionCandidate[] = []
    const existingKeys = new Set(generatedCandidatesRef.current.map((candidate) => candidate.sourceKey))
    const existingSlots = new Set(generatedCandidatesRef.current.map((candidate) => `${candidate.action}:${candidate.frameIndex}`))
    for (const candidate of candidates) {
      const sourceKey = candidateSourceKey(jobId, candidate)
      const slotKey = `${candidate.action}:${candidate.frame_index}`
      if (existingKeys.has(sourceKey) || existingSlots.has(slotKey)) continue
      const response = await fetch(candidate.url)
      if (!response.ok) throw new Error(formatCopy(copy.candidateLoadFailed, { name: candidate.filename }))
      const blob = await response.blob()
      loaded.push({
        id: sourceKey,
        sourceKey,
        action: candidate.action,
        frameIndex: candidate.frame_index,
        name: candidateFileName(candidate),
        url: URL.createObjectURL(blob),
        blob,
        status: 'ready',
      })
      existingKeys.add(sourceKey)
      existingSlots.add(slotKey)
    }
    if (loaded.length > 0) {
      setGeneratedCandidates((prev) => {
        const next = sortCandidatesByActionAndIndex([...prev, ...loaded])
        generatedCandidatesRef.current = next
        return next
      })
      setAiTrayHidden(false)
    }
  }

  async function runBaseModelAnalysis({ continueExisting = false }: { continueExisting?: boolean } = {}) {
    if (!baseModel) {
      message.warning(copy.uploadBaseFirst)
      return
    }
    const framePlan = continueExisting ? buildMissingFramePlan(generatedCandidatesRef.current, AI_ACTION_FRAME_COUNTS) : undefined
    if (continueExisting && framePlan && framePlan.length === 0) {
      message.success(copy.candidatesGenerated)
      return
    }
    setProcessing(AI_ANALYSIS_PROCESSING)
    if (!continueExisting) {
      clearGeneratedCandidates()
    }
    setAiJob({
      id: '',
      status: 'queued',
      progress: 0,
      generatedCount: continueExisting ? generatedCandidatesRef.current.length : 0,
      totalCount: Object.values(AI_ACTION_FRAME_COUNTS).reduce((sum, count) => sum + count, 0),
      batchSize: 3,
      currentBatchIndex: 0,
      fixedFrameCounts: AI_ACTION_FRAME_COUNTS,
    })
    setAiTrayHidden(false)
    try {
      const analysisFile = new File([baseModel.preview.blob], 'base_character_model.png', { type: 'image/png' })
      const created = await createCharacterActionAnalysisJob(analysisFile, {
        pixelArtMode,
        canvasSize: DEFAULT_CANVAS_SIZE,
        fixedFrameCounts: AI_ACTION_FRAME_COUNTS,
        framePlan,
      })
      let latest = await getCharacterActionAnalysisJob(created.job_id)
      setAiJob({
        ...aiJobFromResponse(latest),
        generatedCount: generatedCandidatesRef.current.length + (latest.result?.candidates?.length || 0),
        totalCount: Object.values(AI_ACTION_FRAME_COUNTS).reduce((sum, count) => sum + count, 0),
        fixedFrameCounts: AI_ACTION_FRAME_COUNTS,
      })
      await mergeGeneratedCandidates(created.job_id, latest.result?.candidates || [])
      let attempt = 0
      for (; attempt < ANALYSIS_MAX_POLLS && latest.status !== 'completed' && latest.status !== 'failed'; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, ANALYSIS_POLL_INTERVAL_MS))
        latest = await getCharacterActionAnalysisJob(created.job_id)
        await mergeGeneratedCandidates(created.job_id, latest.result?.candidates || [])
        setAiJob({
          ...aiJobFromResponse(latest),
          generatedCount: generatedCandidatesRef.current.length,
          totalCount: Object.values(AI_ACTION_FRAME_COUNTS).reduce((sum, count) => sum + count, 0),
          fixedFrameCounts: AI_ACTION_FRAME_COUNTS,
        })
      }
      if (latest.status === 'failed') {
        await mergeGeneratedCandidates(created.job_id, latest.result?.candidates || [])
        if ((latest.result?.candidates?.length || 0) > 0) {
          message.warning(latest.error?.message || copy.analysisFailedMessage)
          return
        }
        throw new Error(latest.error?.message || copy.analysisFailedMessage)
      }
      if (latest.status !== 'completed') {
        setAiJob({
          ...aiJobFromResponse(latest),
          status: latest.status,
          generatedCount: generatedCandidatesRef.current.length,
          totalCount: Object.values(AI_ACTION_FRAME_COUNTS).reduce((sum, count) => sum + count, 0),
          fixedFrameCounts: AI_ACTION_FRAME_COUNTS,
          error: null,
          warning: latest.warning || { code: 'ANALYSIS_STILL_RUNNING', message: copy.analysisStillRunning },
        })
        message.info(copy.analysisStillRunning)
        return
      }
      const result = latest.result || await getCharacterActionAnalysisResult(created.job_id)
      await mergeGeneratedCandidates(created.job_id, result.candidates || [])
      setAiJob({
        ...aiJobFromResponse(latest),
        generatedCount: generatedCandidatesRef.current.length,
        totalCount: Object.values(AI_ACTION_FRAME_COUNTS).reduce((sum, count) => sum + count, 0),
        fixedFrameCounts: AI_ACTION_FRAME_COUNTS,
      })
      if (latest.warning?.code === 'AI_PROVIDER_NOT_CONFIGURED') {
        message.warning(copy.providerPlaceholder)
      } else {
        message.success(copy.candidatesGenerated)
      }
    } catch (error) {
      setAiJob((prev) => ({
        id: prev?.id || '',
        status: 'failed',
        progress: 100,
        error: {
          code: 'ANALYSIS_FAILED',
          message: error instanceof Error ? error.message : copy.analysisFailedMessage,
        },
      }))
      message.error(error instanceof Error ? error.message : copy.analysisFailedMessage)
    } finally {
      setProcessing(null)
    }
  }

  async function handleAnalyzeBaseModel() {
    await runBaseModelAnalysis()
  }

  async function handleContinueGeneration() {
    await runBaseModelAnalysis({ continueExisting: true })
  }

  async function handleCharacterUpload(files: FileList | null) {
    if (!files?.length) return
    const nextFiles = Array.from(files)
      .filter((file) => file.type.startsWith('image/'))
      .sort(compareFileNamesByActionAndNumber)
    if (!nextFiles.length) return
    setProcessing(PROCESSING_FRAMES)
    const nextFrames: CharacterFrameAsset[] = []
    try {
      for (const file of nextFiles) {
        const action = inferActionFromName(file.name)
        const frameIndex = frames.filter((frame) => frame.action === action).length
          + nextFrames.filter((frame) => frame.action === action).length
        nextFrames.push(await normalizeCharacterFrame(file, action, frameIndex, autoMatte, { pixelArtMode, scaleMode }))
      }
      setFrames((prev) => normalizeFrameIndexes(sortFramesByActionAndIndex([...prev, ...nextFrames])))
      setCurrentAction(nextFrames[0]?.action || currentAction)
      message.success(formatCopy(copy.framesAdded, { count: nextFrames.length }))
    } catch (error) {
      message.error(error instanceof Error ? error.message : copy.frameProcessFailed)
    } finally {
      setProcessing(null)
      if (characterInputRef.current) characterInputRef.current.value = ''
    }
  }

  async function handleLayerUpload(files: FileList | null, target: LayerTarget) {
    if (!files?.length) return
    const file = Array.from(files).find((item) => item.type.startsWith('image/'))
    if (!file) return
    setProcessing(target === 'weapon' ? PROCESSING_WEAPON : PROCESSING_EFFECT)
    try {
      const loaded = await loadLayerAsset(file, target, autoMatte)
      if (target === 'weapon') {
        setWeaponAssets((prev) => [...prev, loaded])
        updateActiveVariant((variant) => ({ ...variant, weaponAssetId: loaded.id }))
      } else {
        setEffectAssets((prev) => [...prev, loaded])
        updateActiveVariant((variant) => ({ ...variant, effectAssetId: loaded.id }))
      }
      setSelectedLayer(target)
      message.success(formatCopy(copy.layerAdded, { target: target === 'weapon' ? copy.weapon : copy.attackEffect }))
    } catch (error) {
      message.error(error instanceof Error ? error.message : copy.assetProcessFailed)
    } finally {
      setProcessing(null)
      if (weaponInputRef.current) weaponInputRef.current.value = ''
      if (effectInputRef.current) effectInputRef.current.value = ''
    }
  }

  function addVariant(inherit = true) {
    setVariants((prev) => {
      const previous = inherit ? prev[prev.length - 1] : undefined
      const next = createWeaponVariant(prev.length + 1, previous)
      setActiveVariantId(next.id)
      return [...prev, next]
    })
  }

  function removeActiveVariant() {
    setVariants((prev) => {
      if (prev.length <= 1) {
        message.info(copy.keepOneTier)
        return prev
      }
      const index = Math.max(0, prev.findIndex((variant) => variant.id === activeVariantId))
      const next = prev.filter((variant) => variant.id !== activeVariantId)
      setActiveVariantId(next[Math.max(0, index - 1)]?.id || next[0].id)
      return next
    })
  }

  function removeFrame(frameId: string) {
    setFrames((prev) => {
      const target = prev.find((frame) => frame.id === frameId)
      if (target) revokeFrameAsset(target)
      return normalizeFrameIndexes(sortFramesByActionAndIndex(prev.filter((frame) => frame.id !== frameId)))
    })
  }

  function updateFrameAction(frameId: string, action: CharacterActionName) {
    setFrames((prev) => {
      const actionCount = prev.filter((frame) => frame.action === action && frame.id !== frameId).length
      const target = prev.find((frame) => frame.id === frameId)
      if (!target) return prev
      const nextTarget = { ...target, action, frameIndex: actionCount }
      return normalizeFrameIndexes(sortFramesByActionAndIndex([...prev.filter((frame) => frame.id !== frameId), nextTarget]))
    })
    setCurrentAction(action)
  }

  function removeLayerAsset(target: LayerTarget, assetId: string) {
    if (target === 'weapon') {
      setWeaponAssets((prev) => {
        const asset = prev.find((item) => item.id === assetId)
        if (asset) revokeLayerAsset(asset)
        return prev.filter((item) => item.id !== assetId)
      })
      setVariants((prev) => prev.map((variant) => (variant.weaponAssetId === assetId ? { ...variant, weaponAssetId: undefined } : variant)))
    } else {
      setEffectAssets((prev) => {
        const asset = prev.find((item) => item.id === assetId)
        if (asset) revokeLayerAsset(asset)
        return prev.filter((item) => item.id !== assetId)
      })
      setVariants((prev) => prev.map((variant) => (variant.effectAssetId === assetId ? { ...variant, effectAssetId: undefined } : variant)))
    }
  }

  function moveFrame(frameId: string, direction: -1 | 1) {
    setFrames((prev) => {
      const target = prev.find((frame) => frame.id === frameId)
      if (!target) return prev
      const sameAction = prev
        .filter((frame) => frame.action === target.action)
        .sort((a, b) => a.frameIndex - b.frameIndex)
      const currentIndex = sameAction.findIndex((frame) => frame.id === frameId)
      const nextIndex = currentIndex + direction
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= sameAction.length) return prev
      const indexById = new Map(sameAction.map((frame, index) => [frame.id, index]))
      indexById.set(sameAction[currentIndex].id, nextIndex)
      indexById.set(sameAction[nextIndex].id, currentIndex)
      return normalizeFrameIndexes(
        sortFramesByActionAndIndex(
          prev.map((frame) => (frame.action === target.action ? { ...frame, frameIndex: indexById.get(frame.id) ?? frame.frameIndex } : frame)),
        ),
      )
    })
    if (currentFrame?.id === frameId) {
      setFrameCursor((value) => Math.max(0, value + direction))
    }
  }

  function handleCandidateDragStart(event: DragEvent<HTMLElement>, candidate: GeneratedActionCandidate) {
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData('application/droi-action-candidate', JSON.stringify({ id: candidate.id, action: candidate.action }))
    event.dataTransfer.setData('text/plain', candidate.id)
  }

  function handleActionDragOver(event: DragEvent<HTMLElement>) {
    if (generatedCandidates.length === 0) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  async function handleCandidateDrop(event: DragEvent<HTMLElement>, action: CharacterActionName) {
    event.preventDefault()
    const data = event.dataTransfer.getData('application/droi-action-candidate')
    const fallbackId = event.dataTransfer.getData('text/plain')
    let candidateId = fallbackId
    let candidateAction: CharacterActionName | null = null
    if (data) {
      try {
        const parsed = JSON.parse(data) as { id?: string; action?: CharacterActionName }
        candidateId = parsed.id || fallbackId
        candidateAction = parsed.action || null
      } catch {
        candidateAction = null
      }
    }
    const candidate = generatedCandidates.find((item) => item.id === candidateId)
    if (!candidate || candidate.status === 'added') return
    if ((candidateAction || candidate.action) !== action) {
      message.warning(formatCopy(copy.wrongSlot, { action: actionLabels[candidate.action] }))
      return
    }
    const frameIndex = frames.filter((frame) => frame.action === action).length
    try {
      const frame = await createCharacterFrameFromBlob(candidate.blob, candidate.name, action, frameIndex, 'processed')
      setFrames((prev) => normalizeFrameIndexes(sortFramesByActionAndIndex([...prev, frame])))
      setGeneratedCandidates((prev) => prev.map((item) => (item.id === candidate.id ? { ...item, status: 'added' } : item)))
      setCurrentAction(action)
      setFrameCursor(frameIndex)
      message.success(formatCopy(copy.candidateAdded, { action: actionLabels[action] }))
    } catch (error) {
      message.error(error instanceof Error ? error.message : copy.candidateAddFailed)
    }
  }

  function updateActionConfig(action: CharacterActionName, patch: Partial<ActionConfig>) {
    setActionConfigs((prev) => ({
      ...prev,
      [action]: {
        ...prev[action],
        ...patch,
      },
    }))
  }

  function handleStagePointerMove(event: React.PointerEvent) {
    if (!dragState) return
    const point = pointerToCanvasPoint(event)
    updateTransform(dragState.target, point)
  }

  function zoomStage(delta: number) {
    setStageZoom((value) => clampStageZoom(value + delta))
  }

  function handleStageWheel(event: React.WheelEvent) {
    event.preventDefault()
    zoomStage(event.deltaY > 0 ? -0.06 : 0.06)
  }

  function handleLayerWheel(event: React.WheelEvent, target: LayerTarget) {
    event.preventDefault()
    event.stopPropagation()
    const transform = activeVariant?.[`${target}Transform`]
    if (!transform) return
    const delta = event.deltaY > 0 ? -0.04 : 0.04
    updateTransform(target, { scale: Math.max(0.08, Math.min(4, Number((transform.scale + delta).toFixed(2)))) })
    setSelectedLayer(target)
  }

  async function handleExport() {
    if (!frames.length) {
      message.warning(copy.uploadFrameFirst)
      return
    }
    setProcessing(PROCESSING_EXPORT)
    try {
      await exportCharacterActionZip({
        frames,
        weaponAssets,
        effectAssets,
        variants,
        actionConfigs,
        canvasSize: DEFAULT_CANVAS_SIZE,
      })
      message.success(copy.exportSuccess)
    } catch (error) {
      message.error(error instanceof Error ? error.message : copy.exportFailed)
    } finally {
      setProcessing(null)
    }
  }

  return (
    <ConfigProvider theme={characterActionTheme}>
    <section className="character-action-page">
      <div className="character-action-bg character-action-bg-a" />
      <div className="character-action-bg character-action-bg-b" />
      <div className="character-action-scanline" />

      <header className="character-action-header">
        <Button className="character-action-back" icon={<ArrowLeftOutlined />} onClick={onBack}>
          {copy.back}
        </Button>
        <div className="character-action-heading">
          <Text className="character-action-kicker">{copy.kicker}</Text>
          <Title level={2}>{copy.title}</Title>
          <Text className="character-action-subtitle">
            {copy.subtitle}
          </Text>
        </div>
        <div className="character-action-header-actions">
          <span className="character-action-switch">
            <Text>{copy.autoMatte}</Text>
            <Switch checked={autoMatte} onChange={setAutoMatte} />
          </span>
          <Button
            className="character-action-primary"
            icon={<DownloadOutlined />}
            loading={processing === PROCESSING_EXPORT}
            onClick={handleExport}
          >
            {copy.exportActionPack}
          </Button>
        </div>
      </header>

      <main className="character-action-workspace">
        <aside className="character-action-panel character-action-assets">
          <section className="character-action-block character-action-workflow">
            <Text className="character-action-section-label">{copy.workflow}</Text>
            <h3>{copy.workflow}</h3>
            <div className="character-action-next-step">
              <span>{copy.nextStep}</span>
              <strong>{nextWorkflowStep.title}</strong>
              <small>{nextWorkflowStep.detail}</small>
            </div>
            <ol>
              {workflowSteps.map((step, index) => (
                <li key={step.title} className={step.done ? 'is-done' : step.title === nextWorkflowStep.title ? 'is-current' : ''}>
                  <span>{step.done ? copy.done : String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <strong>{step.title}</strong>
                    <small>{step.detail}</small>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="character-action-block character-action-base-model">
            <Text className="character-action-section-label">{copy.baseCharacter}</Text>
            <h3>{copy.baseCharacter}</h3>
            <p>{copy.baseCharacterHint}</p>
            <input
              ref={baseModelInputRef}
              hidden
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => void handleBaseModelUpload(event.target.files)}
            />
            {baseModel ? (
              <div className="character-action-base-preview">
                <img src={baseModel.preview.normalizedUrl} alt={baseModel.name} />
                <div>
                  <strong>{baseModel.name}</strong>
                  <small>{matteLabel(baseModel.preview.matteStatus, copy)} · 512×512</small>
                </div>
              </div>
            ) : null}
            <div className="character-action-base-actions">
              <Button icon={<UploadOutlined />} onClick={() => baseModelInputRef.current?.click()} loading={processing === PROCESSING_BASE}>
                {copy.uploadBaseModel}
              </Button>
              <Button
                className="character-action-primary character-action-ai-button"
                icon={<ThunderboltOutlined />}
                disabled={!baseModel}
                loading={processing === AI_ANALYSIS_PROCESSING}
                onClick={() => void handleAnalyzeBaseModel()}
              >
                {copy.analyzeActions}
              </Button>
            </div>
            {aiJob ? (
              <div className={`character-action-ai-status ${aiJob.status === 'failed' ? 'is-error' : ''}`}>
                <div>
                  <strong>{aiJob.status === 'failed' ? copy.analysisFailed : aiJob.status === 'completed' ? copy.analysisComplete : copy.analyzing}</strong>
                  <small>{aiJob.status === 'failed' && aiGeneratedCount === 0 ? aiJob.error?.message || copy.analysisFailedMessage : aiJob.warning?.message || aiProgressText || copy.analysisDefaultHint}</small>
                </div>
                <Progress percent={Math.round(aiJob.progress)} size="small" status={aiJob.status === 'failed' ? 'exception' : undefined} />
              </div>
            ) : null}
          </section>

          <section className="character-action-block">
            <Text className="character-action-section-label">{copy.characterFrames}</Text>
            <h3>{copy.characterFrames}</h3>
            <p>{copy.characterFramesHint}</p>
            <input
              ref={characterInputRef}
              hidden
              multiple
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => void handleCharacterUpload(event.target.files)}
            />
            <Button block icon={<UploadOutlined />} onClick={() => characterInputRef.current?.click()} loading={processing === PROCESSING_FRAMES}>
              {copy.uploadCharacterImages}
            </Button>
            <div className="character-action-normalize-options">
              <span>
                <Text>{copy.pixelArtMode}</Text>
                <Switch size="small" checked={pixelArtMode} onChange={setPixelArtMode} />
              </span>
              <label>
                {copy.scaleMode}
                <Select
                  size="small"
                  popupClassName="character-action-select-popup"
                  value={scaleMode}
                  options={scaleModeOptions}
                  onChange={setScaleMode}
                />
              </label>
            </div>
          </section>

          <section className="character-action-block">
            <Text className="character-action-section-label">{copy.weaponLevel}</Text>
            <div className="character-action-row">
              <h3>{copy.weaponTiers}</h3>
              <div className="character-action-inline-actions">
                <Button size="small" icon={<PlusOutlined />} onClick={() => addVariant(true)}>
                  {copy.add}
                </Button>
                <Button className="character-action-danger" size="small" icon={<DeleteOutlined />} onClick={removeActiveVariant}>
                  {copy.delete}
                </Button>
              </div>
            </div>
            <div className="character-action-variant-list">
              {variants.map((variant) => (
                <button
                  key={variant.id}
                  type="button"
                  className={`character-action-variant ${variant.id === activeVariantId ? 'is-active' : ''}`}
                  onClick={() => setActiveVariantId(variant.id)}
                >
                  <strong>{variant.level}</strong>
                  <small>{variant.weaponAssetId ? copy.weaponSet : copy.waitingWeapon} · {variant.effectAssetId ? copy.effectSet : copy.waitingEffect}</small>
                </button>
              ))}
            </div>
            <Input
              value={activeVariant?.level}
              onChange={(event) => updateActiveVariant((variant) => ({ ...variant, level: event.target.value || variant.level }))}
              placeholder={copy.tierName}
            />
            <div className="character-action-upload-pair">
              <input
                ref={weaponInputRef}
                hidden
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => void handleLayerUpload(event.target.files, 'weapon')}
              />
              <input
                ref={effectInputRef}
                hidden
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => void handleLayerUpload(event.target.files, 'effect')}
              />
              <Button icon={<UploadOutlined />} onClick={() => weaponInputRef.current?.click()} loading={processing === PROCESSING_WEAPON}>
                {copy.uploadWeapon}
              </Button>
              <Button icon={<UploadOutlined />} onClick={() => effectInputRef.current?.click()} loading={processing === PROCESSING_EFFECT}>
                {copy.uploadEffect}
              </Button>
            </div>
            <div className="character-action-layer-library">
              <Text>{copy.weaponAssets}</Text>
              {weaponAssets.length === 0 ? (
                <small>{copy.noWeapon}</small>
              ) : (
                <div className="character-action-layer-assets">
                  {weaponAssets.map((asset) => (
                    <div
                      key={asset.id}
                      role="button"
                      tabIndex={0}
                      className={`character-action-layer-asset-card ${activeVariant?.weaponAssetId === asset.id ? 'is-active' : ''}`}
                      onClick={() => {
                        updateActiveVariant((variant) => ({ ...variant, weaponAssetId: asset.id }))
                        setSelectedLayer('weapon')
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return
                        event.preventDefault()
                        updateActiveVariant((variant) => ({ ...variant, weaponAssetId: asset.id }))
                        setSelectedLayer('weapon')
                      }}
                    >
                      <img src={asset.url} alt={asset.name} />
                      <span>{layerMatteLabel(asset.matteStatus, copy)}</span>
                      <Button
                        className="character-action-layer-delete character-action-danger"
                        size="small"
                        type="text"
                        icon={<DeleteOutlined />}
                        onClick={(event) => {
                          event.stopPropagation()
                          removeLayerAsset('weapon', asset.id)
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
              <Text>{copy.effectAssets}</Text>
              {effectAssets.length === 0 ? (
                <small>{copy.noEffect}</small>
              ) : (
                <div className="character-action-layer-assets">
                  {effectAssets.map((asset) => (
                    <div
                      key={asset.id}
                      role="button"
                      tabIndex={0}
                      className={`character-action-layer-asset-card ${activeVariant?.effectAssetId === asset.id ? 'is-active' : ''}`}
                      onClick={() => {
                        updateActiveVariant((variant) => ({ ...variant, effectAssetId: asset.id }))
                        setSelectedLayer('effect')
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return
                        event.preventDefault()
                        updateActiveVariant((variant) => ({ ...variant, effectAssetId: asset.id }))
                        setSelectedLayer('effect')
                      }}
                    >
                      <img src={asset.url} alt={asset.name} />
                      <span>{layerMatteLabel(asset.matteStatus, copy)}</span>
                      <Button
                        className="character-action-layer-delete character-action-danger"
                        size="small"
                        type="text"
                        icon={<DeleteOutlined />}
                        onClick={(event) => {
                          event.stopPropagation()
                          removeLayerAsset('effect', asset.id)
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="character-action-block character-action-frame-list">
            <Text className="character-action-section-label">{copy.library}</Text>
            <h3>{copy.frameLibrary}</h3>
            {frames.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={copy.noFrames} />
            ) : (
              <div className="character-action-frame-grid">
                {frames.map((frame) => (
                  <div key={frame.id} className={`character-action-frame-card ${currentFrame?.id === frame.id ? 'is-active' : ''}`}>
                    <button
                      type="button"
                      onClick={() => {
                        const nextFrames = frames.filter((item) => item.action === frame.action).sort((a, b) => a.frameIndex - b.frameIndex)
                        setCurrentAction(frame.action)
                        setFrameCursor(Math.max(0, nextFrames.findIndex((item) => item.id === frame.id)))
                      }}
                    >
                      <img src={frame.normalizedUrl} alt={frame.name} />
                    </button>
                    <Select
                      size="small"
                      popupClassName="character-action-select-popup"
                      value={frame.action}
                      options={ACTION_NAMES.map((action) => ({ value: action, label: actionLabels[action] }))}
                      onChange={(value) => updateFrameAction(frame.id, value)}
                    />
                    <div className="character-action-frame-meta">
                      <Tag>{matteLabel(frame.matteStatus, copy)}</Tag>
                      <div className="character-action-frame-tools">
                        <Button size="small" type="text" icon={<ArrowUpOutlined />} onClick={() => moveFrame(frame.id, -1)} />
                        <Button size="small" type="text" icon={<ArrowDownOutlined />} onClick={() => moveFrame(frame.id, 1)} />
                        <Button className="character-action-danger" size="small" type="text" icon={<DeleteOutlined />} onClick={() => removeFrame(frame.id)} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>

        <section className="character-action-stage-panel">
          <div className="character-action-stage-zoom-tools">
            <button type="button" onClick={() => zoomStage(-0.1)} aria-label={copy.zoomOut}>
              -
            </button>
            <strong>{Math.round(stageZoom * 100)}%</strong>
            <button type="button" onClick={() => zoomStage(0.1)} aria-label={copy.zoomIn}>
              +
            </button>
            <button type="button" onClick={() => setStageZoom(DEFAULT_STAGE_ZOOM)}>
              {copy.fit}
            </button>
          </div>
          <div
            ref={stageRef}
            className="character-action-stage"
            style={{ transform: `scale(${stageZoom})` }}
            onPointerMove={handleStagePointerMove}
            onPointerUp={() => setDragState(null)}
            onPointerLeave={() => setDragState(null)}
            onWheel={handleStageWheel}
          >
            <div className="character-action-stage-hud">
              <strong>{actionLabels[currentAction]}</strong>
              <span>{currentFrame ? `${frameCursor + 1}/${actionFrames.length} ${copy.frameUnit}` : copy.waitingFrames}</span>
              <span>{activeVariant?.level || 'level_01'}</span>
              <span>{copy.view} {Math.round(stageZoom * 100)}%</span>
            </div>
            <div className="character-action-guide character-action-guide-x" />
            <div className="character-action-guide character-action-guide-y" />
            <div className="character-action-feet-line" />
            <div className="character-action-collision-ring" />
            {currentFrame ? (
              <img className="character-action-character-img" src={currentFrame.normalizedUrl} alt={currentFrame.name} draggable={false} />
            ) : (
              <div className="character-action-empty-stage">
                <strong>{copy.emptyStageTitle}</strong>
                <span>{copy.emptyStageHint}</span>
              </div>
            )}
            {activeWeapon && activeVariant && (
              <button
                type="button"
                className={`character-action-layer character-action-layer-weapon ${selectedLayer === 'weapon' ? 'is-selected' : ''}`}
                style={{
                  left: `${(activeVariant.weaponTransform.x / DEFAULT_CANVAS_SIZE) * 100}%`,
                  top: `${(activeVariant.weaponTransform.y / DEFAULT_CANVAS_SIZE) * 100}%`,
                  width: `${((activeWeapon.width * activeVariant.weaponTransform.scale) / DEFAULT_CANVAS_SIZE) * 100}%`,
                  opacity: activeVariant.weaponTransform.opacity,
                  zIndex: activeVariant.weaponTransform.zIndex,
                  transform: `translate(-50%, -50%) rotate(${activeVariant.weaponTransform.rotation}deg)`,
                }}
                onPointerDown={(event) => {
                  event.preventDefault()
                  setSelectedLayer('weapon')
                  setDragState({ target: 'weapon' })
                }}
                onWheel={(event) => handleLayerWheel(event, 'weapon')}
              >
                <img src={activeWeapon.url} alt={activeWeapon.name} draggable={false} />
              </button>
            )}
            {activeEffect && activeVariant && showEffectLayer && (
              <button
                type="button"
                className={`character-action-layer character-action-layer-effect ${selectedLayer === 'effect' ? 'is-selected' : ''}`}
                style={{
                  left: `${(activeVariant.effectTransform.x / DEFAULT_CANVAS_SIZE) * 100}%`,
                  top: `${(activeVariant.effectTransform.y / DEFAULT_CANVAS_SIZE) * 100}%`,
                  width: `${((activeEffect.width * activeVariant.effectTransform.scale) / DEFAULT_CANVAS_SIZE) * 100}%`,
                  opacity: activeVariant.effectTransform.opacity,
                  zIndex: activeVariant.effectTransform.zIndex,
                  transform: `translate(-50%, -50%) rotate(${activeVariant.effectTransform.rotation}deg)`,
                }}
                onPointerDown={(event) => {
                  event.preventDefault()
                  setSelectedLayer('effect')
                  setDragState({ target: 'effect' })
                }}
                onWheel={(event) => handleLayerWheel(event, 'effect')}
              >
                <img src={activeEffect.url} alt={activeEffect.name} draggable={false} />
              </button>
            )}
          </div>
        </section>

        <aside className="character-action-panel character-action-props">
          <Text className="character-action-section-label">{copy.properties}</Text>
          <h3>{copy.properties}</h3>
          <div className="character-action-layer-tabs">
            <button type="button" className={selectedLayer === 'weapon' ? 'is-active' : ''} onClick={() => setSelectedLayer('weapon')}>
              {copy.weaponLayer}
            </button>
            <button type="button" className={selectedLayer === 'effect' ? 'is-active' : ''} onClick={() => setSelectedLayer('effect')}>
              {copy.effectLayer}
            </button>
          </div>
          {selectedTransform ? (
            <div className="character-action-prop-grid">
              <label>
                X
                <InputNumber min={0} max={512} value={selectedTransform.x} onChange={(value) => updateTransform(selectedLayer, { x: Number(value || 0) })} />
              </label>
              <label>
                Y
                <InputNumber min={0} max={512} value={selectedTransform.y} onChange={(value) => updateTransform(selectedLayer, { y: Number(value || 0) })} />
              </label>
              <label className="is-wide">
                {copy.scale}
                <Slider min={0.08} max={4} step={0.02} value={selectedTransform.scale} onChange={(value) => updateTransform(selectedLayer, { scale: value })} />
              </label>
              <label className="is-wide">
                {copy.rotation}
                <Slider min={-180} max={180} step={1} value={selectedTransform.rotation} onChange={(value) => updateTransform(selectedLayer, { rotation: value })} />
              </label>
              <label className="is-wide">
                {copy.opacity}
                <Slider min={0.1} max={1} step={0.05} value={selectedTransform.opacity} onChange={(value) => updateTransform(selectedLayer, { opacity: value })} />
              </label>
              <label>
                {copy.layer}
                <InputNumber min={0} max={9} value={selectedTransform.zIndex} onChange={(value) => updateTransform(selectedLayer, { zIndex: Number(value || 0) })} />
              </label>
              <label>
                {copy.attachPoint}
                <Select
                  popupClassName="character-action-select-popup"
                  value={selectedTransform.attachTo}
                  options={attachOptions}
                  onChange={(value) => updateTransform(selectedLayer, { attachTo: value })}
                />
              </label>
            </div>
          ) : null}

          <section className="character-action-block">
            <Text className="character-action-section-label">{copy.actionConfig}</Text>
            <h3>{actionLabels[currentAction]}</h3>
            <div className="character-action-prop-grid">
              <label>
                FPS
                <InputNumber min={1} max={30} value={actionConfigs[currentAction].fps} onChange={(value) => updateActionConfig(currentAction, { fps: Number(value || 1) })} />
              </label>
              <label>
                {copy.loop}
                <Switch checked={actionConfigs[currentAction].loop} onChange={(loop) => updateActionConfig(currentAction, { loop })} />
              </label>
              <label>
                {copy.hitFrame}
                <InputNumber min={0} max={99} value={actionConfigs[currentAction].hitFrame} onChange={(value) => updateActionConfig(currentAction, { hitFrame: Number(value || 0) })} />
              </label>
              <label>
                {copy.effectStartFrame}
                <InputNumber min={0} max={99} value={actionConfigs[currentAction].effectStartFrame} onChange={(value) => updateActionConfig(currentAction, { effectStartFrame: Number(value || 0) })} />
              </label>
              <label>
                {copy.effectEndFrame}
                <InputNumber min={0} max={99} value={actionConfigs[currentAction].effectEndFrame} onChange={(value) => updateActionConfig(currentAction, { effectEndFrame: Number(value || 0) })} />
              </label>
            </div>
          </section>
        </aside>
      </main>

      {showAiTray ? (
        aiTrayHidden ? (
          <div className="character-action-ai-expand">
            <Button icon={<EyeOutlined />} onClick={() => setAiTrayHidden(false)}>
              {copy.showAiResults}
            </Button>
          </div>
        ) : (
          <section className="character-action-ai-tray">
            <div className="character-action-ai-tray-head">
              <div>
                <Text className="character-action-section-label">{copy.aiActionCandidates}</Text>
                <h3>{copy.aiResults}</h3>
                <p>{copy.aiResultsHint}</p>
                <div className="character-action-ai-progress-line">
                  <span>{aiProgressText}</span>
                  <Progress percent={Math.round(aiJob?.progress || 0)} size="small" showInfo={false} status={aiJob?.status === 'failed' ? 'exception' : undefined} />
                </div>
              </div>
              <div className="character-action-ai-tray-actions">
                {canContinueGeneration ? (
                  <Button
                    className="character-action-primary"
                    icon={<ThunderboltOutlined />}
                    loading={processing === AI_ANALYSIS_PROCESSING}
                    onClick={() => void handleContinueGeneration()}
                  >
                    {continueGenerationLabel}
                  </Button>
                ) : null}
                <Button icon={<EyeInvisibleOutlined />} onClick={() => setAiTrayHidden(true)}>
                  {copy.hide}
                </Button>
              </div>
            </div>
            {aiJob?.warning ? (
              <div className="character-action-ai-warning">
                {aiJob.warning.message}
              </div>
            ) : null}
            <div className="character-action-candidate-groups">
              {ACTION_NAMES.map((action) => {
                const actionCandidates = generatedCandidates
                  .filter((candidate) => candidate.action === action)
                  .sort((a, b) => a.frameIndex - b.frameIndex)
                const frameCount = Math.max(0, aiFixedFrameCounts[action] || 0)
                const frameOffset = actionFrameOffset(action, aiFixedFrameCounts)
                return (
                  <div key={action} className="character-action-candidate-group">
                    <strong>{actionLabels[action]}</strong>
                    <div className="character-action-candidate-list">
                      {Array.from({ length: frameCount }, (_, frameIndex) => {
                        const candidate = actionCandidates.find((item) => item.frameIndex === frameIndex)
                        const globalFrameIndex = frameOffset + frameIndex
                        const isGenerating = aiJob?.status === 'processing'
                          && globalFrameIndex >= aiCurrentBatchStart
                          && globalFrameIndex < aiCurrentBatchEnd
                          && !candidate
                        const slotStatus = candidate ? 'ready' : aiJob?.status === 'failed' ? 'failed' : isGenerating ? 'generating' : 'queued'
                        if (!candidate) {
                          return (
                            <div key={`${action}_${frameIndex}`} className={`character-action-candidate-card is-placeholder is-${slotStatus}`}>
                              <span>{String(frameIndex + 1).padStart(2, '0')}</span>
                              <strong>
                                {slotStatus === 'failed'
                                  ? aiGenerationCopy.failedFrame
                                  : slotStatus === 'generating'
                                    ? aiGenerationCopy.generatingFrame
                                    : aiGenerationCopy.queued}
                              </strong>
                            </div>
                          )
                        }
                        return (
                          <div
                            key={candidate.id}
                            className={`character-action-candidate-card ${candidate.status === 'added' ? 'is-added' : ''}`}
                            draggable={candidate.status !== 'added'}
                            role="button"
                            tabIndex={0}
                            onClick={() => setPreviewCandidate(candidate)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                setPreviewCandidate(candidate)
                              }
                            }}
                            onDragStart={(event) => handleCandidateDragStart(event, candidate)}
                          >
                            <img src={candidate.url} alt={candidate.name} />
                            <span>{String(candidate.frameIndex + 1).padStart(2, '0')}</span>
                            {candidate.status === 'added' ? <em>{copy.added}</em> : null}
                            <div className="character-action-candidate-popover">
                              <img src={candidate.url} alt="" />
                              <small>{actionLabels[candidate.action]} #{candidate.frameIndex + 1}</small>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      ) : null}

      {previewCandidate ? (
        <div className="character-action-preview-modal" role="dialog" aria-modal="true" onClick={() => setPreviewCandidate(null)}>
          <div className="character-action-preview-panel" onClick={(event) => event.stopPropagation()}>
            <div className="character-action-preview-head">
              <div>
                <Text className="character-action-section-label">{actionLabels[previewCandidate.action]}</Text>
                <h3>{previewCandidate.name}</h3>
              </div>
              <Button icon={<EyeInvisibleOutlined />} onClick={() => setPreviewCandidate(null)}>
                {copy.hide}
              </Button>
            </div>
            <div className="character-action-preview-canvas">
              <img src={previewCandidate.url} alt={previewCandidate.name} />
            </div>
            <small>{actionLabels[previewCandidate.action]} #{previewCandidate.frameIndex + 1}</small>
          </div>
        </div>
      ) : null}

      <footer className="character-action-timeline">
        <div className="character-action-actions">
          {ACTION_NAMES.map((action) => (
            <button
              key={action}
              type="button"
              className={action === currentAction ? 'is-active' : ''}
              onClick={() => setCurrentAction(action)}
              onDragOver={handleActionDragOver}
              onDrop={(event) => void handleCandidateDrop(event, action)}
            >
              <strong>{actionLabels[action]}</strong>
              <span>{frames.filter((frame) => frame.action === action).length} {copy.frameUnit}</span>
            </button>
          ))}
        </div>
        <div className="character-action-playbar">
          <Button
            className="character-action-icon-btn"
            icon={playing ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            onClick={() => setPlaying((value) => !value)}
            disabled={actionFrames.length === 0}
          />
          <Text>{currentFrame ? `${actionLabels[currentAction]} ${frameCursor + 1}/${actionFrames.length}` : copy.waitingFrames}</Text>
          <div className="character-action-mini-frames">
            {actionFrames.map((frame, index) => (
              <button
                key={frame.id}
                type="button"
                className={index === frameCursor ? 'is-active' : ''}
                onClick={() => setFrameCursor(index)}
              >
                <img src={frame.normalizedUrl} alt={frame.name} />
              </button>
            ))}
          </div>
          <Button icon={<CopyOutlined />} onClick={() => addVariant(true)}>
            {copy.inheritWeapon}
          </Button>
        </div>
      </footer>
    </section>
    </ConfigProvider>
  )
}
