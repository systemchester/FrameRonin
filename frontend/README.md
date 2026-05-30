# Droi-game-tool Frontend

React + Vite + TypeScript + Ant Design frontend for Droi-game-tool. Product-level setup and API notes live in the root [README.md](../README.md).

## Screens

- `src/App.tsx`：top-level app state, module routing, language state, and shared layout.
- `src/components/ModeSelector.tsx`：home screen module cards and the home-page language switcher.
- `src/components/MapStudio.tsx`：map stitching, obstacle asset upload, folder upload, placement, and collision editing.
- `src/components/MatteStudio.tsx`：AI background removal workflow.
- `src/components/CharacterActionComposer.tsx`：character analysis, progressive action candidate generation, bottom candidate tray, preview, and drag/drop into action slots.
- `src/i18n/`：English default copy plus Chinese/Japanese translations.

## Local Development

```powershell
npm install
npm run dev
```

The Vite dev server defaults to `http://127.0.0.1:5173/`. Start the backend from the repository root on port `8000` when testing AI matte or character action generation.

## Validation

```powershell
npm run build
```

## Notes

- Keep user-facing text in `src/i18n/locales.ts` so the four main pages stay localized.
- The language switcher belongs on the home page only; secondary and tertiary pages inherit the selected language.
- Do not commit generated assets, logs, or API keys.
