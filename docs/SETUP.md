# Setup

## Prerequisites

- Node.js 20+ and npm 10+
- A modern browser with WebGL 2 support (Chrome 80+, Firefox 79+, Edge 80+)

## Install

```bash
npm install
```

## Dev server

```bash
npm run dev
```

Opens at `http://localhost:5173`. Hot-reloading is enabled.

## Build

```bash
npm run build
```

Output in `dist/`. Deploy the `dist/` folder to any static host (Netlify, Vercel, GitHub Pages).

## Preview production build

```bash
npm run preview
```

## Controls

| Key | Action |
|---|---|
| WASD / Arrow keys | Move |
| Shift | Sprint / Gallop |
| Mouse drag | Rotate camera |
| Scroll | Zoom |
| E | Mount / Dismount horse |
| Q | Toggle Dead Eye |
| Left click (Dead Eye active) | Lock target |

## Notes

- The Havok physics WASM binary is served separately — `vite.config.ts` excludes it from optimization to avoid bundling issues.
- Textures currently use placeholder colors. Drop KTX2 texture files into `assets/terrain/` and update `TerrainManager.buildMaterial()` to enable them.
