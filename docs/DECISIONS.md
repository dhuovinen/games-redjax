# Architecture Decision Records

## ADR-001 — Web-based over native

**Date:** 2026-06-03  
**Status:** Accepted

**Context:** Initial consideration was a native Swift/macOS app. The goal is an immersive western game that's accessible without installation.

**Decision:** Build as a browser game (Babylon.js + TypeScript + Vite).

**Consequences:**
- Zero install friction — shareable via URL
- Memory ceiling (~2 GB Chrome heap) requires aggressive LOD and streaming from day one
- Asset quality must be compressed (KTX2/Basis textures, GLTF Draco meshes)
- No file-system access — saves require IndexedDB or server side

---

## ADR-002 — Babylon.js over Three.js

**Date:** 2026-06-03  
**Status:** Accepted

**Context:** Both Three.js and Babylon.js are viable. Babylon.js includes physics (Havok WASM), an audio engine, particle systems, animation groups, and a collision system out of the box. Three.js requires assembling these as separate packages.

**Decision:** Use Babylon.js 7.x for all 3D rendering and engine features.

**Consequences:**
- Larger initial bundle (mitigated by code splitting in Vite config)
- Havok physics WASM must be excluded from Vite `optimizeDeps`
- Access to Dynamic Terrain extension for LOD without custom implementation

---

## ADR-003 — core/ has zero Babylon.js imports

**Date:** 2026-06-03  
**Status:** Accepted

**Context:** Game logic (Dead Eye, honor, encounters, day/night) must be independently testable without a WebGL context. CI environments have no GPU.

**Decision:** All files under `src/core/` are forbidden from importing `@babylonjs/*`. They communicate only via `EventBus`.

**Consequences:**
- All game logic is unit-testable with Vitest (no browser needed)
- Swapping Babylon.js for a different renderer requires no changes to `core/`
- Slightly more boilerplate — world/ controllers must subscribe to core/ events explicitly

---

## ADR-004 — Procedural terrain as Phase 1 placeholder

**Date:** 2026-06-03  
**Status:** Accepted

**Context:** Real heightmap art is not available at project start. Building the LOD/streaming scaffold requires a height function to test with.

**Decision:** Use a multi-octave sine-wave approximation in `TerrainManager.sampleHeight()` until a real 512×512 heightmap PNG is available.

**Consequences:**
- World looks wave-like, not geologically natural — acceptable for architecture validation
- The sampling interface (`sampleHeight(wx, wz): number`) is stable; swap requires changing only `applyProceduralHeight()`

---

## ADR-005 — Vertical slice scopes 6 of 10 systems

**Date:** 2026-06-03  
**Status:** Accepted

**Context:** All 10 ranked elements were requested. Camp/social hub, story missions, and hunting/fishing require significant authored content and complex AI that cannot be prototyped without art assets.

**Decision:** Phase 1 delivers: open world, character, horse, Dead Eye, encounters, honor. Camp, story, hunting deferred to Phase 3+.

**Consequences:**
- Demo is completable in 6 weeks vs. 6 months
- Architecture is designed to accommodate deferred systems without refactoring

---

## ADR-006 — Procedural Web Audio instead of audio assets

**Date:** 2026-06-14  
**Status:** Accepted

**Context:** The project ships no binary assets — terrain, vegetation, and
characters are all procedural. Audio risked being the first thing to require
committed asset files (and their licensing/size cost).

**Decision:** Synthesize all sound at runtime with the raw Web Audio API in a
dedicated `src/audio/` output layer. Wind is filtered looping noise; gunshots
are a noise burst with a lowpass sweep; hoofbeats and thuds are enveloped
oscillators. The layer subscribes to `EventBus` and is ticked once per frame
only for hoofbeat scheduling.

**Consequences:**
- Zero audio assets; the deployable bundle stays JS-only
- `AudioContext` must be created lazily and resumed on first user gesture
  (browser autoplay policy)
- Sound quality is "stylized", not realistic — acceptable for the slice
- A new top-level layer (`audio/`) sits alongside `world/` and `entities/` as
  a renderer/output concern, not game logic

---

## ADR-007 — Babylon core kept as a single vendor chunk

**Date:** 2026-06-14  
**Status:** Accepted

**Context:** `@babylonjs/core` minifies to ~5 MB, tripping Vite's chunk-size
warning. Splitting it internally (by submodule) would enable parallel loading
but risks runtime "cannot access before initialization" errors from Babylon's
internal circular dependencies — failures that don't appear at build time and
can't be browser-verified in this environment before auto-deploy.

**Decision:** Route `@babylonjs/core` to one `babylon` chunk, materials and
loaders to their own chunks, everything else to `vendor`. Raise
`chunkSizeWarningLimit` to 6000. App code already splits out separately
(~17 KB gzip).

**Consequences:**
- One large but stable vendor chunk that the browser caches across deploys
- No risk of split-induced runtime breakage
- First load transfers ~1.1 MB gzip of Babylon; subsequent loads are cached

---

## ADR-008 — Phase 3 performance pass: static freezing over LOD cuts

**Date:** 2026-06-14  
**Status:** Accepted

**Context:** The slice targets 60 fps on mid-range hardware. The cheapest wins
were sought before touching gameplay-visible draw distance.

**Decision:** Cap render resolution at 1.5× DPI, disable pointer-move picking,
freeze world matrices + materials on static terrain/vegetation, and enable
`blockMaterialDirtyMechanism` after load. `LOAD_RADIUS` stays at 3 — fog hides
the streaming boundary, so cutting it would be visible.

**Consequences:**
- Largest GPU saving (DPI cap) costs nothing visually at 1.5×
- Freezing is safe only because these meshes never move; dynamic entities
  (player, horse, NPCs, campfire flame, sky) are deliberately left unfrozen
- New runtime materials (NPCs spawned mid-game) still compile correctly under
  `blockMaterialDirtyMechanism`, which only blocks per-frame dirty scanning
