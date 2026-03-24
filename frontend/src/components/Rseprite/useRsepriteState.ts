import { useCallback, useReducer, type Dispatch } from 'react'
import {
  applyRegionToDocument,
  boundsFromPixels,
  copyRegion,
  pushPaintCommand,
  type PaintCmd,
} from './commands/paintCmd'
import { createInitialDocument, duplicateFrameDeep } from './documentFactory'
import { dedupePixels, paintPixelsOnDocument, type Rgba } from './paintDocument'
import type { Document, Layer, PixelPoint } from './types'

export interface RsepriteRootState {
  document: Document
  /** 当前编辑帧 */
  activeFrameIndex: number
  /** 当前编辑目标：与 frame.cels[activeLayerIndex]、layers[activeLayerIndex] 对齐 */
  activeLayerIndex: number
  undoStack: PaintCmd[]
  redoStack: PaintCmd[]
}

/** 第 1 步 RESET；第 3 步 PAINT_PIXELS；第 5 步 UNDO/REDO；第 6 步图层；第 7 步多帧 */
export type RsepriteAction =
  | { type: 'RESET'; width: number; height: number }
  | {
      type: 'PAINT_PIXELS'
      frameIndex: number
      celIndex: number
      pixels: readonly PixelPoint[]
      rgba: Rgba
    }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SET_ACTIVE_LAYER'; index: number }
  | { type: 'SET_ACTIVE_FRAME'; index: number }
  | { type: 'ADD_FRAME' }
  | { type: 'DELETE_FRAME'; frameIndex: number }
  | { type: 'SET_LAYER_VISIBLE'; layerIndex: number; visible: boolean }
  | { type: 'SET_LAYER_LOCKED'; layerIndex: number; locked: boolean }
  | { type: 'SET_FRAME_DURATION'; frameIndex: number; durationMs: number }
  | { type: 'NOOP' }

function updateLayerInDoc(
  doc: Document,
  index: number,
  patch: Partial<Layer>,
): Document {
  if (index < 0 || index >= doc.layers.length) return doc
  const layers = doc.layers.map((l, i) =>
    i === index ? { ...l, ...patch } : l,
  )
  return { ...doc, layers }
}

function clampLayerIndex(doc: Document, index: number): number {
  if (doc.layers.length === 0) return 0
  return Math.max(0, Math.min(index, doc.layers.length - 1))
}

function clampFrameIndex(doc: Document, index: number): number {
  if (doc.frames.length === 0) return 0
  return Math.max(0, Math.min(index, doc.frames.length - 1))
}

function createInitialState(width: number, height: number): RsepriteRootState {
  const document = createInitialDocument(width, height)
  return {
    document,
    activeFrameIndex: 0,
    activeLayerIndex: 0,
    undoStack: [],
    redoStack: [],
  }
}

function rsepriteReducer(
  state: RsepriteRootState,
  action: RsepriteAction,
): RsepriteRootState {
  switch (action.type) {
    case 'RESET': {
      const next = createInitialState(action.width, action.height)
      return next
    }
    case 'SET_ACTIVE_LAYER': {
      const idx = clampLayerIndex(state.document, action.index)
      if (idx === state.activeLayerIndex) return state
      return { ...state, activeLayerIndex: idx }
    }
    case 'SET_ACTIVE_FRAME': {
      const idx = clampFrameIndex(state.document, action.index)
      if (idx === state.activeFrameIndex) return state
      return { ...state, activeFrameIndex: idx }
    }
    case 'ADD_FRAME': {
      const doc = state.document
      const copyIdx = clampFrameIndex(doc, state.activeFrameIndex)
      const newFrame = duplicateFrameDeep(doc, copyIdx)
      if (!newFrame) return state
      const frames = [
        ...doc.frames.slice(0, copyIdx + 1),
        newFrame,
        ...doc.frames.slice(copyIdx + 1),
      ]
      return {
        ...state,
        document: { ...doc, frames },
        activeFrameIndex: copyIdx + 1,
        undoStack: [],
        redoStack: [],
      }
    }
    case 'DELETE_FRAME': {
      const { frameIndex } = action
      if (state.document.frames.length <= 1) return state
      if (frameIndex < 0 || frameIndex >= state.document.frames.length) return state
      const frames = state.document.frames.filter((_, i) => i !== frameIndex)
      let activeFrameIndex = state.activeFrameIndex
      if (frameIndex < activeFrameIndex) activeFrameIndex -= 1
      else if (frameIndex === activeFrameIndex)
        activeFrameIndex = Math.min(activeFrameIndex, frames.length - 1)
      return {
        ...state,
        document: { ...state.document, frames },
        activeFrameIndex: Math.max(0, activeFrameIndex),
        undoStack: [],
        redoStack: [],
      }
    }
    case 'SET_LAYER_VISIBLE': {
      const doc = updateLayerInDoc(state.document, action.layerIndex, {
        visible: action.visible,
      })
      if (doc === state.document) return state
      return { ...state, document: doc }
    }
    case 'SET_LAYER_LOCKED': {
      const doc = updateLayerInDoc(state.document, action.layerIndex, {
        locked: action.locked,
      })
      if (doc === state.document) return state
      return { ...state, document: doc }
    }
    case 'SET_FRAME_DURATION': {
      const { frameIndex, durationMs } = action
      const doc = state.document
      if (frameIndex < 0 || frameIndex >= doc.frames.length) return state
      const ms = Math.max(1, Math.min(60_000, Math.round(durationMs)))
      const frames = doc.frames.map((f, i) =>
        i === frameIndex ? { ...f, durationMs: ms } : f,
      )
      return { ...state, document: { ...doc, frames } }
    }
    case 'PAINT_PIXELS': {
      const doc = state.document
      const { frameIndex, celIndex, pixels, rgba } = action

      const layer = doc.layers[celIndex]
      if (!layer || layer.locked) return state

      const unique = dedupePixels(pixels)
      if (unique.length === 0) return state

      const b = boundsFromPixels(unique, doc.width, doc.height)
      if (!b) return state

      const frame = doc.frames[frameIndex]
      const cel = frame?.cels[celIndex]
      if (!cel) return state

      const before = copyRegion(cel.imageData, b.x, b.y, b.width, b.height)
      const nextDoc = paintPixelsOnDocument(
        doc,
        frameIndex,
        celIndex,
        unique,
        rgba,
      )
      const nextCel = nextDoc.frames[frameIndex]?.cels[celIndex]
      if (!nextCel) return state
      const after = copyRegion(nextCel.imageData, b.x, b.y, b.width, b.height)

      const cmd: PaintCmd = {
        frameIndex,
        celIndex,
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
        before,
        after,
      }

      return {
        ...state,
        document: nextDoc,
        undoStack: pushPaintCommand(state.undoStack, cmd),
        redoStack: [],
      }
    }
    case 'UNDO': {
      if (state.undoStack.length === 0) return state
      const cmd = state.undoStack[state.undoStack.length - 1]!
      const undoStack = state.undoStack.slice(0, -1)
      const document = applyRegionToDocument(
        state.document,
        cmd.frameIndex,
        cmd.celIndex,
        cmd.x,
        cmd.y,
        cmd.width,
        cmd.height,
        cmd.before,
      )
      return {
        ...state,
        document,
        undoStack,
        redoStack: [...state.redoStack, cmd],
      }
    }
    case 'REDO': {
      if (state.redoStack.length === 0) return state
      const cmd = state.redoStack[state.redoStack.length - 1]!
      const redoStack = state.redoStack.slice(0, -1)
      const document = applyRegionToDocument(
        state.document,
        cmd.frameIndex,
        cmd.celIndex,
        cmd.x,
        cmd.y,
        cmd.width,
        cmd.height,
        cmd.after,
      )
      return {
        ...state,
        document,
        undoStack: [...state.undoStack, cmd],
        redoStack,
      }
    }
    case 'NOOP':
    default:
      return state
  }
}

export interface UseRsepriteStateResult {
  doc: Document
  activeFrameIndex: number
  activeLayerIndex: number
  dispatch: Dispatch<RsepriteAction>
  resetDocument: (width: number, height: number) => void
  setActiveLayer: (index: number) => void
  setActiveFrame: (index: number) => void
  addFrame: () => void
  deleteFrame: (frameIndex: number) => void
  setFrameDuration: (frameIndex: number, durationMs: number) => void
  setLayerVisible: (layerIndex: number, visible: boolean) => void
  setLayerLocked: (layerIndex: number, locked: boolean) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

/**
 * Rseprite 文档 + 当前帧/层 + 撤销/重做（第 5～7 步）
 */
export function useRsepriteState(
  initialW: number,
  initialH: number,
): UseRsepriteStateResult {
  const [state, dispatch] = useReducer(
    rsepriteReducer,
    { width: initialW, height: initialH },
    ({ width, height }: { width: number; height: number }) =>
      createInitialState(width, height),
  )

  const resetDocument = useCallback((width: number, height: number) => {
    dispatch({ type: 'RESET', width, height })
  }, [])

  const setActiveLayer = useCallback((index: number) => {
    dispatch({ type: 'SET_ACTIVE_LAYER', index })
  }, [])

  const setActiveFrame = useCallback((index: number) => {
    dispatch({ type: 'SET_ACTIVE_FRAME', index })
  }, [])

  const addFrame = useCallback(() => {
    dispatch({ type: 'ADD_FRAME' })
  }, [])

  const deleteFrame = useCallback((frameIndex: number) => {
    dispatch({ type: 'DELETE_FRAME', frameIndex })
  }, [])

  const setFrameDuration = useCallback((frameIndex: number, durationMs: number) => {
    dispatch({ type: 'SET_FRAME_DURATION', frameIndex, durationMs })
  }, [])

  const setLayerVisible = useCallback(
    (layerIndex: number, visible: boolean) => {
      dispatch({ type: 'SET_LAYER_VISIBLE', layerIndex, visible })
    },
    [],
  )

  const setLayerLocked = useCallback(
    (layerIndex: number, locked: boolean) => {
      dispatch({ type: 'SET_LAYER_LOCKED', layerIndex, locked })
    },
    [],
  )

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' })
  }, [])

  const redo = useCallback(() => {
    dispatch({ type: 'REDO' })
  }, [])

  return {
    doc: state.document,
    activeFrameIndex: state.activeFrameIndex,
    activeLayerIndex: state.activeLayerIndex,
    dispatch,
    resetDocument,
    setActiveLayer,
    setActiveFrame,
    addFrame,
    deleteFrame,
    setFrameDuration,
    setLayerVisible,
    setLayerLocked,
    undo,
    redo,
    canUndo: state.undoStack.length > 0,
    canRedo: state.redoStack.length > 0,
  }
}
