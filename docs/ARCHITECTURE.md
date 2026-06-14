# Architecture

## Stack

| Layer | Technology |
|---|---|
| Language | TypeScript 5.x |
| Bundler | Vite 5.x |
| 3D Engine | Babylon.js 7.x (WebGL 2) |
| Physics | Babylon Havok plugin (WASM) — scaffolded, not yet active |
| Audio | Raw Web Audio API — procedural synthesis, zero audio assets |
| Hosting | Vercel (static, auto-deploy on push to `main`) |

## Layer Map

```
src/
  core/          Pure game logic. Zero Babylon.js imports.
                 Testable with Vitest, no WebGL context required.

  world/         Scene and environment. Babylon.js is allowed here.
                 Subscribes to core/ events via EventBus.

  entities/      Player, horse, NPC, campfire game objects.
                 Owns Babylon.js Mesh references.

  ui/            HUD and menus. Pure HTML/CSS/DOM.
                 Reads game state via EventBus or injected callbacks;
                 never imports world/ or entities/ directly.

  audio/         Procedural Web Audio output. Subscribes to EventBus;
                 ticked once per frame only for hoofbeat timing.

  shared/        EventBus, types, constants.
                 No framework imports. No game logic.
```

`ui/` menus that need live data (minimap terrain, rest/dialog proximity)
receive plain getter functions from `main.ts` rather than importing the
layers that own that data — this preserves the "swap the UI without
touching core/entities" rule while avoiding a global state singleton.

## Communication Pattern

`core/` systems emit typed events via `EventBus`. `world/`, `entities/`, and `ui/` subscribe to those events and update Babylon.js state accordingly. This means all game logic is decoupled from the renderer.

```
DayNightCycle → EventBus["time:tick"]        → SkyController (Babylon)
HonorSystem   → EventBus["honor:changed"]     → HudController (DOM)
NpcController → EventBus["npc:attackedPlayer"]→ PlayerController.takeDamage
main          → EventBus["weapon:fired"]      → AudioManager (gunshot synth)
```

## World Structure

- 1024 × 1024 m world area
- Divided into 8 × 8 = 64 chunks (128 m per chunk)
- TerrainManager loads/unloads chunks by player proximity (`LOAD_RADIUS = 3` chunks)
- Each chunk: 64-subdivision `CreateGround` mesh with procedural height and
  per-vertex colors (sand→clay→rock by height/slope) — single shared material
- Vegetation streams on the same chunk grid via deterministic per-chunk PRNG
- Sun-sine height function as placeholder — replace with heightmap PNG for final art

## Key Files

| File | Purpose |
|---|---|
| `src/shared/EventBus.ts` | Typed singleton event bus |
| `src/shared/types.ts` | Domain types (PlayerState, Encounter, etc.) |
| `src/shared/constants.ts` | World size, speeds, honor thresholds |
| `src/core/time/DayNightCycle.ts` | Pure time progression, emits `time:tick` |
| `src/core/combat/DeadEyeSystem.ts` | Dead Eye state machine |
| `src/core/encounter/EncounterManager.ts` | Proximity-based random encounters |
| `src/core/reputation/HonorSystem.ts` | Float honor value, listens to `combat:npcKilled` |
| `src/world/terrain/TerrainManager.ts` | LOD chunk streaming, vertex-colored terrain |
| `src/world/environment/SkyController.ts` | SkyMaterial scattering, sun/moon, PCF shadows, fog |
| `src/world/environment/PostProcessController.ts` | Bloom, ACES, vignette, grain, SSAO, MSAA |
| `src/world/environment/VegetationManager.ts` | Streamed cacti/trees/rocks/shrubs |
| `src/world/environment/WeatherController.ts` | Rain particles, weather fog, storm lightning |
| `src/entities/player/PlayerController.ts` | WASD movement, third-person camera, look sensitivity |
| `src/entities/horse/HorseController.ts` | Mount/dismount, gallop, following AI |
| `src/entities/npc/NpcController.ts` | Bandit chase/attack AI, traveler markers |
| `src/entities/camp/Campfire.ts` | Rest-point prop with animated flame + light |
| `src/ui/hud/HudController.ts` | Health, Dead Eye, honor, time, damage flash |
| `src/ui/hud/Minimap.ts` | Top-down terrain map + heading + encounter blips |
| `src/ui/menus/{PauseMenu,RestMenu,TravelerDialog}.ts` | Pause/settings, camp rest, traveler choice |
| `src/audio/AudioManager.ts` | Procedural wind/gunshot/hoofbeat/thud synthesis |
| `src/main.ts` | Engine init, system wiring, render loop |

## Performance Constraints

- Chrome memory limit ~2 GB — chunk streaming is mandatory, not optional
- Target 60 fps on a mid-range laptop GPU (discrete or integrated)
- Textures: KTX2/Basis compressed when art assets are added
- LOD `LOAD_RADIUS = 3` streams terrain + vegetation by player proximity

### Applied optimizations (Phase 3 perf pass)

- Render resolution capped at 1.5× device pixel ratio (`setHardwareScalingLevel`)
- `scene.skipPointerMovePicking` — picking only runs on explicit clicks
- Static terrain + vegetation: `freezeWorldMatrix()` and frozen materials
- `scene.blockMaterialDirtyMechanism` enabled after initial world load
- Babylon core ships as one cacheable vendor chunk (see ADR-007)

### Scene constraints to watch

- **Fog has one owner per frame:** `SkyController` writes a time-of-day base,
  then `WeatherController` (later in the loop) combines weather on top and is
  the final writer. Do not set `scene.fog*` from anywhere else.
- **Light budget:** 4 active lights (sun, ambient, campfire, lightning) ==
  `StandardMaterial` default `maxSimultaneousLights`. A 5th light requires
  raising `maxSimultaneousLights` on affected materials or it is dropped.
