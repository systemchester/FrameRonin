# Rseprite（RoninPro 内嵌）— Aseprite 类功能开发说明

## 定位

- **入口**：RoninPro 首页卡片「Rseprite」，组件 `frontend/src/components/RoninProRseprite.tsx`。
- **目标**：在浏览器内提供接近 **Aseprite** 的常见工作流（多帧动画、图层、调色板、基础绘制与导出），**不**使用 Aseprite 商标作官方宣称。
- **与站点关系**：可与现有 **Sprite Sheet**、**GIF↔序列帧** 做导入/导出联动（后续迭代）。

## 技术约束

- 栈：React + Vite + Canvas/WebGL（推荐 Canvas2D + 可选 OffscreenCanvas/Worker）。
- 大画布注意内存：索引色 + 分层 `ImageData` 或 `Uint8ClampedArray`。
- 快捷键与 `App.tsx` 全局快捷键冲突时：**画布聚焦**优先编辑器快捷键。

## 分阶段（与界面文案里程碑一致）

| 阶段 | 内容 |
|------|------|
| **M0** | 文档模型定稿、本页占位与宽版外壳（`RoninPro` 已为 `rseprite` 放宽 `maxWidth`） |
| **M1** | 多帧、图层列表、调色板、铅笔/橡皮、撤销栈 |
| **M2** | 洋葱皮、时间轴 UI、PNG 序列 ZIP 导出 |
| **M3** | 选区、油漆桶、GIF/序列导入；可选 `.ase` 只读 |

## 目录规划（后续落地）

```
frontend/src/components/Rseprite/
  RoninProRseprite.tsx    # 壳（可逐步拆为子组件）
  EditorCanvas.tsx
  Timeline.tsx
  LayerPanel.tsx
  PalettePanel.tsx
  useEditorState.ts
  commands/
  io/
```

## 合规

- 产品名使用 **Rseprite** 或「像素动画台」，避免暗示 Aseprite 官方。
- 第三方库与 `.ase` 解析须单独核对许可证。

## 分步实现（推荐）

**按顺序执行的具体清单与验收标准**见：**[RSEPRITE_DEVELOPMENT_PATH.md](./RSEPRITE_DEVELOPMENT_PATH.md)**（第 1～20 步，可分阶段提交）。
