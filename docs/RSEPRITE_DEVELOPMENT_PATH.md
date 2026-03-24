# Rseprite 分步开发路径

按下面顺序做，**每步完成并自测后再进入下一步**。前序未完成时，不要跳步（否则返工多）。

> 当前入口：`RoninPro` → **Rseprite** → `RoninProRseprite.tsx`  
> 建议：从 **第 1 步** 起把代码拆到 `frontend/src/components/Rseprite/`，`RoninProRseprite.tsx` 只保留壳与组装。

---

## 使用方式

- 每步末尾有 **验收标准**，打勾即算完成。
- **Git**：每完成 1～2 步可单独 commit，方便回滚。
- **分支策略**（可选）：`feature/rseprite-step-N`。

---

## 阶段 A — 画布与单帧绘制

### 第 1 步：文档类型与最小状态 ✅（已实现）

**目标**：用 TypeScript 描述「一张固定尺寸的图」，能在内存里创建，尚不画 UI。

**任务**

- 新建 `Rseprite/types.ts`：`Document`, `Frame`, `Layer`, `Cel`（可先只要 `width`, `height`, `frames[0]`, `layers[0]`, `cel: ImageData | null`）。
- 新建 `Rseprite/useRsepriteState.ts`：`createInitialDocument(w,h)` + `useReducer` 或 `useImmer`，暴露 `doc` 与 `dispatch`。
- `RoninProRseprite.tsx` 里 `useRsepriteState(64, 64)`，开发时在控制台 `console.log(doc)` 验证。

**已实现文件**

- `frontend/src/components/Rseprite/types.ts`
- `frontend/src/components/Rseprite/documentFactory.ts`（`createInitialDocument` 等）
- `frontend/src/components/Rseprite/useRsepriteState.ts`
- `frontend/src/components/Rseprite/index.ts`
- `RoninProRseprite.tsx` 内嵌 **第 1 步验收卡片** + 控制台 `[Rseprite Step1]` 日志 + `RESET` 按钮

**验收**

- [ ] 刷新进入 Rseprite 无报错；`doc` 宽高与初始帧/层数量正确。

---

### 第 2 步：画布视口（缩放 + 平移）✅（已实现）

**目标**：主画布区域能看清像素格，可缩放、拖动画布。

**任务**

- `EditorCanvas.tsx`：`canvas` + `ctx.imageSmoothingEnabled = false`。
- 状态：`scale`（如 8～32）、`offsetX/Y`；鼠标/触摸拖拽改 offset；滚轮改 scale（可选加「以光标为中心」）。
- 画 **棋盘格背景** + 将「合成后的像素缓冲」`drawImage` 或 `putImageData` 到正确世界坐标（注意 `devicePixelRatio`）。

**已实现文件**

- `frontend/src/components/Rseprite/EditorCanvas.tsx`（滚轮以光标为锚缩放、中键 / Alt+左键平移、`ResizeObserver`、DPR）
- `RoninProRseprite.tsx` 接入首帧首 Cel 的 `ImageData` + 第 2 步说明文案（i18n）

**验收**

- [x] 小图放大后边缘清晰（像素风）；拖动画布跟手；窗口 resize 不乱位。

---

### 第 3 步：单帧单层 — 铅笔工具 ✅（已实现）

**目标**：在画布上按下拖动可画单色像素。

**任务**

- 合成规则：当前层 cel 的 `ImageData` 上写像素（主色，如 `#000000`）。
- 将 **屏幕坐标 → 文档像素坐标**（考虑 scale/offset/dpr）。
- `pointerdown / pointermove / pointerup`（`setPointerCapture` 避免丢事件）。

**已实现文件**

- `frontend/src/components/Rseprite/bresenham.ts`（Bresenham 补线）
- `frontend/src/components/Rseprite/paintDocument.ts`（不可变 `PAINT_PIXELS`）
- `useRsepriteState.ts`：`PAINT_PIXELS` action
- `EditorCanvas.tsx`：左键铅笔、与 Alt+左键/中键平移互斥；`clientX/Y` → 文档格点
- `RoninProRseprite.tsx`：首帧首层 `dispatch` 写入

**验收**

- [x] 只在整数格点画；松手后图案不丢；快速拖动不断线（可 Bresenham 或插值）。

---

### 第 4 步：橡皮 + 调色板 UI ✅（已实现）

**目标**：能换色；橡皮恢复透明或背景色（先统一用 **透明** 或固定底色二选一，写进文档）。

**任务**

- 状态：`primaryColor`, `secondaryColor`（RGBA）；UI：一排色块 + 当前色指示。
- 工具枚举：`pencil` | `eraser`；橡皮把 alpha 置 0（若用透明）。

**约定（本项目）**

- **橡皮** = 将像素写为 **RGBA(0,0,0,0)**（全透明），与棋盘格背景一致。

**已实现文件**

- `frontend/src/components/Rseprite/palettePresets.ts`（`ERASER_RGBA`、`PRESET_PALETTE`）
- `frontend/src/components/Rseprite/RsepritePaletteBar.tsx`（工具切换、前/后色指示、预设条）
- `frontend/src/components/Rseprite/types.ts`：`RsepriteTool`
- `RoninProRseprite.tsx`：`paintRgba` 按工具在 `primaryColor` 与 `ERASER_RGBA` 间切换

**验收**

- [x] 切换颜色后新笔触颜色正确；橡皮擦净指定像素。

---

### 第 5 步：撤销 / 重做 ✅（已实现）

**目标**：至少撤销铅笔/橡皮操作。

**任务**

- `commands/`：`PaintCmd` 存受影响矩形 + 旧像素快照 + 新像素；`undo/redo` 应用快照。
- 限制栈深度（如 50）防内存爆。

**已实现文件**

- `frontend/src/components/Rseprite/commands/paintCmd.ts`（`PaintCmd`、`copyRegion`、`applyRegionToDocument`、栈深上限）
- `useRsepriteState.ts`：`RsepriteRootState`（`document` + `undoStack` + `redoStack`）、`PAINT_PIXELS` 入栈、`UNDO`/`REDO`
- `RoninProRseprite.tsx`：撤销/重做按钮；`Ctrl/Cmd+Z`、`Ctrl+Y`、`Ctrl/Cmd+Shift+Z`（在输入框外）
- `EditorCanvas.tsx`：**一笔（按下→松开）只 `dispatch` 一次**；接收 `doc` + `frameIndex` + `activeLayerIndex`，笔划预览走 `composeFrameWithStrokePreview` 与下层正确叠色

**验收**

- [x] Ctrl+Z / Ctrl+Y（或按钮）可来回至少 10 步；不破坏画布坐标。

> **阶段 A 完成** = 单帧单层「能画、能擦、能换色、能撤销」。

---

## 阶段 B — 图层与多帧

### 第 6 步：多图层合成 ✅（已实现）

**目标**：≥2 层，列表可切换「当前层」；预览为自下而上合成。

**任务**

- `LayerPanel.tsx`：列表、选中高亮、可选「显示/锁定」。
- 绘制循环：按顺序把各层 cel 画到临时 canvas，再进主视图（或每层单独 ImageData 最后合成）。

**已实现文件**

- `frontend/src/components/Rseprite/composeFrame.ts`：`composeFrameToImageData`、`composeFrameWithStrokePreview`（仅合成可见层；预览时临时合并当前层笔划）
- `frontend/src/components/Rseprite/RsepriteLayerPanel.tsx`
- `documentFactory.ts`：默认 2 层 × 各 1 Cel
- `useRsepriteState.ts`：`activeLayerIndex`、`SET_LAYER_VISIBLE` / `SET_LAYER_LOCKED`；`PAINT_PIXELS` 遇锁定层直接忽略
- `RoninProRseprite.tsx`：合成图进 `EditorCanvas`；当前层绘制

**验收**

- [x] 上层盖住下层；锁定层不可编辑；隐藏层不参与合成。

---

### 第 7 步：多帧 + 帧条 ✅（已实现）

**目标**：时间轴上有 N 帧，可切换「当前帧」；每层在每帧有独立 cel（可先「复制上一帧」新建帧）。

**任务**

- `RsepriteTimeline.tsx`：缩略条、当前帧高亮、`+` 增帧、删帧（至少留一帧）。
- 状态：`activeFrameIndex`；切换帧时 cel 数据切换。

**已实现文件**

- `documentFactory.ts`：`duplicateFrameDeep`
- `useRsepriteState.ts`：`SET_ACTIVE_FRAME`、`ADD_FRAME`、`DELETE_FRAME`
- `RsepriteTimeline.tsx`、`RoninProRseprite.tsx` 接入

**验收**

- [x] 帧 A 与帧 B 内容互不影响；增删帧后当前帧合法。

---

### 第 8 步：帧操作细化 ✅（已实现）

**目标**：复制帧、排序（拖放可放到 Phase C 后）。

**任务**

- 「复制当前帧」：深拷贝所有层 cel。
- （可选）帧延时字段 `durationMs` 占位，UI 默认 100ms，可编辑当前帧。

**已实现**

- `types.ts`：`Frame.durationMs`
- `documentFactory.ts`：`duplicateFrameDeep` 拷贝延时；初始帧 `durationMs: 100`
- `useRsepriteState.ts`：`SET_FRAME_DURATION`、`setFrameDuration`
- `RsepriteTimeline.tsx`：「复制当前帧」按钮、缩略图下显示延时、当前帧延时 `InputNumber`

**验收**

- [x] 复制后两帧视觉一致；改后帧不影响前帧副本（`ImageData` 深拷贝）。

> **阶段 B 完成** = 多帧多层的非动画导出前「编辑闭环」。

---

## 阶段 C — 动画体验与导出

### 第 9 步：洋葱皮 ✅（已实现）

**目标**：编辑当前帧时，前后帧半透明显示（只预览，不写像素）。

**任务**

- 在合成阶段先以低 alpha 画 `frameIndex±1` 的合成图，再画当前帧。
- UI：开关 + 透明度滑条。

**已实现**

- `EditorCanvas.tsx`：`onionSkinEnabled` / `onionSkinOpacity`；离屏 scratch + `drawImage` 应用 alpha；先邻帧后当前帧（含笔划预览路径）。
- `RoninProRseprite.tsx`：撤销行内 Checkbox + Slider（5～100%）；单帧时自动禁用。

**验收**

- [x] 首末帧不越界；关洋葱皮后只剩当前帧。

---

### 第 10 步：预览播放

**目标**：在时间轴范围内循环播放（用 `requestAnimationFrame` 或 `setInterval`）。

**任务**

- 播放/暂停按钮；`currentPreviewFrame` 与编辑用 `activeFrameIndex` 区分或播放时禁止编辑（先简单禁止编辑即可）。

**验收**

- [ ] 帧率大致稳定；暂停停在当前预览帧。

---

### 第 11 步：导出 PNG 序列（ZIP）

**目标**：一键下载 `frame_000.png` …（每层合成后的结果）。

**任务**

- 依赖：`fflate` 或 `jszip`（注意打包体积）。
- 每帧：离屏 canvas 合成 → `toBlob('image/png')` → 打进 zip。

**验收**

- [ ] 解压后张数 = 帧数；顺序与编辑器一致。

---

### 第 12 步：导入

**目标**：用户选多张 PNG 或单张，生成等尺寸多帧（可先要求尺寸一致，不一致则提示或缩放）。

**任务**

- `<input type="file" multiple accept="image/png">`；`createImageBitmap` / `Image` 解码。
- 写入各帧合成层或「扁平一层」。

**验收**

- [ ] 导入后时间轴帧数正确；与导出再导入可闭环（允许有损缩放则写进说明）。

> **阶段 C 完成** = 可做简单像素动画并导出给现有 Sprite/GIF 管线用。

---

## 阶段 D — 工具增强与站内联动

### 第 13 步：矩形选区 + 移动

**目标**：框选矩形区域，拖动剪切式移动（先剪贴板式：清空原区 + 贴到新位）。

**任务**

- 选区状态机：`idle` → `selecting` → `selected` → `dragging`。
- 与撤销栈集成（一次拖动一条命令）。

**验收**

- [ ] 不越界或按你定义的越界策略（裁切）；可 Esc 取消选区。

---

### 第 14 步：油漆桶（填充）

**目标**：当前层、当前闭合区域（四连通）填充前景色。

**任务**

- 泛洪算法；大画布考虑 `Uint32Array` 视图优化。
- 与撤销：整次填充一条命令。

**验收**

- [ ] 有边界时不会漏到全屏；透明度边界行为符合预期。

---

### 第 15 步：与 FrameRonin 其它模块联动

**目标**：减少用户复制文件次数。

**任务**（任选其一开始）

- 导出后提供「去 Sprite Sheet」跳转：`setMode('spritesheet')` 并写入 `sessionStorage` / 暂存区（与现有 `ImageStash` 对齐若可）。
- 或：从 GIF 模块「发送到 Rseprite」拆帧（若已有帧数据 API）。

**验收**

- [ ] 至少一条链路可走通；失败时有 `message` 提示。

> **阶段 D 完成** = 工具与站内工作流打通。

---

## 阶段 E — 可选与长期

| 步 | 内容 | 说明 |
|----|------|------|
| **16** | 键盘快捷键 | 画布 `tabIndex` + `focus`；与 `App.tsx` 全局键冲突时优先 `stopPropagation` |
| **17** | 性能 | Web Worker 合成大图；分块 ImageData |
| **18** | `.ase` / `.aseprite` 只读 | 调研格式与许可；先做子集 |
| **19** | 调色板文件 `.gpl` 导入 | 简单文本解析 |
| **20** | 对称笔刷 / 图案填充 | 按需求排期 |

---

## 建议时间感（仅供参考）

| 阶段 | 粗略人天（单人熟练） |
|------|----------------------|
| A | 3～7 |
| B | 3～6 |
| C | 4～8 |
| D | 4～10 |
| E | 视范围 |

---

## 相关文档

- 总览：`docs/DEV_RSEPRITE_MODULE.md`

完成某一步后，可把该文档对应 **验收** 勾选同步到 PR 描述或本文件，便于回顾。
