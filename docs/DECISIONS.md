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

---

## ADR-009 — No CI test gate yet (accepted risk)

**Date:** 2026-06-14  
**Status:** Accepted

**Context:** A 48-test Vitest suite covers `core/` + the EventBus. Pushes to
`main` auto-deploy to Vercel. A GitHub Actions workflow could run the suite on
every push/PR and block deploys on failure.

**Decision:** Do **not** add a CI test gate at this stage. The suite is run
locally with `npm run test:run` before pushing.

**Risk (explicitly accepted):**
- Nothing enforces the suite on push. A regression in `core/` can land on
  `main` and **auto-deploy to production without the tests ever running** —
  the failure would only surface if someone runs tests locally or plays the
  build. The green suite can also silently rot as code changes.
- Mitigation for now: solo developer; run `npm run test:run` (and
  `npm run build`) before every push. This relies on discipline, not tooling.

**Revisit when:** a second contributor joins, PRs become the norm, or a
test-passing regression reaches production. At that point add a GitHub Actions
workflow (`npm ci && npm run test:run && npm run build`) gating `main`.

---

## ADR-010 — Weather rendering: single fog owner + procedural rain

**Date:** 2026-06-14  
**Status:** Accepted

**Context:** `WeatherController` existed but was effectively broken: (1)
`SkyController` rewrote `scene.fog*` every frame, clobbering the weather fog
set only on state-change events; (2) rain loaded a cross-origin texture from
`assets.babylonjs.com`, which breaks the project's zero-asset/offline property
and is liable to be blocked by our own `Cross-Origin-Embedder-Policy:
require-corp` header (ADR for Havok headers) on the deployed site.

**Decision:**
- **Single fog owner per frame.** Sky writes a time-of-day base; weather runs
  later in the loop and combines on top (additive density, colour blend),
  becoming the sole final writer of `scene.fog*`.
- **Procedural raindrop** via a `DynamicTexture` radial gradient — no network,
  COEP-safe.
- **Storm lightning** via a dedicated scene `HemisphericLight` flashed on a
  random timer, emitting `weather:lightning` so `AudioManager` answers with a
  delayed thunder rumble (sound lags light).

**Consequences:**
- Weather is now visible, self-contained, and works offline / under COEP
- Adds a 4th scene light — exactly the `StandardMaterial` default ceiling;
  documented in ARCHITECTURE as a constraint to watch
- Fog is additive, so storms thicken the existing time-of-day haze rather than
  replacing it — coupling weather and sky intentionally, in one direction only
- `WeatherController` is world-layer and remains unit-untested (needs WebGL);
  the underlying `WeatherSystem` state machine stays covered by Vitest

---

## ADR-011 — Custom 2D circle collision instead of Havok

**Date:** 2026-06-14  
**Status:** Accepted

**Context:** The player and horse could walk through trees, cacti, rocks, the
campfire, and each other — a visible immersion gap. Havok (WASM) is scaffolded
and the COOP/COEP headers are in place, but activating full rigid-body physics
is a large change that can't be browser-verified here before auto-deploy.

**Decision:** Add a lightweight `CollisionSystem` in `core/physics/` — pure 2D
(XZ-plane) circle depenetration, zero Babylon imports. World props register as
static circles as chunks stream; the player and horse are dynamic circles
resolved each frame. NPCs are intentionally left non-colliding for now.

**Consequences:**
- Fits YAGNI: solves the actual gap without a physics engine or new infra
- The logic is pure, so it's unit-tested (8 tests) — unlike a Havok integration
- Approximation, not simulation: collisions are circles, depenetration is
  single-pass, and very high speeds could tunnel thin obstacles (mitigated by
  step sizes << collider radii). No slopes/verticality — terrain height is
  still a separate sampler.
- Havok stays scaffolded for if/when true physics (ragdolls, projectiles,
  stacking) is actually needed; this does not preclude it.
- **Known gap:** NPCs ignore obstacles and can clip vegetation — acceptable for
  the slice; revisit if NPC pathing becomes prominent.

**Update (2026-06-14):** the NPC gap above is now closed. NPCs register as
dynamic colliders (radius `NPC_COLLISION_RADIUS`) and resolve their own chase
movement against the world, so the player/horse/other NPCs avoid them and they
no longer clip vegetation. Colliders are removed on death and dispose. NPC↔NPC
and NPC↔world use the same single-pass depenetration, so the approximation
caveats above still apply.
