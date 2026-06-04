# Architecture

## Stack

| Layer | Technology |
|---|---|
| Language | TypeScript 5.x |
| Bundler | Vite 5.x |
| 3D Engine | Babylon.js 7.x (WebGL 2) |
| Physics | Babylon Havok plugin (WASM) |
| Audio | Babylon.js built-in (Web Audio API) |

## Layer Map

```
src/
  core/          Pure game logic. Zero Babylon.js imports.
                 Testable with Vitest, no WebGL context required.

  world/         Scene and environment. Babylon.js is allowed here.
                 Subscribes to core/ events via EventBus.

  entities/      Player, horse, NPC game objects.
                 Owns Babylon.js Mesh references.

  ui/            HUD and menus. Pure HTML/CSS/DOM.
                 Subscribes to EventBus; never calls core/ directly.

  shared/        EventBus, types, constants.
                 No framework imports. No game logic.
```

## Communication Pattern

`core/` systems emit typed events via `EventBus`. `world/`, `entities/`, and `ui/` subscribe to those events and update Babylon.js state accordingly. This means all game logic is decoupled from the renderer.

```
DayNightCycle → EventBus["time:tick"] → SkyController (Babylon)
HonorSystem → EventBus["honor:changed"] → HudController (DOM)
DeadEyeSystem → EventBus["deadeye:activated"] → scene.getEngine().setTimeStep()
```

## World Structure

- 1024 × 1024 m world area
- Divided into 8 × 8 = 64 chunks (128 m per chunk)
- TerrainManager loads/unloads chunks by player proximity (radius = 2 chunks)
- Each chunk: 64-subdivision `CreateGround` mesh with procedural height
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
| `src/world/terrain/TerrainManager.ts` | LOD chunk streaming |
| `src/world/environment/SkyController.ts` | Babylon sky dome + dynamic lighting |
| `src/entities/player/PlayerController.ts` | WASD movement, third-person camera |
| `src/entities/horse/HorseController.ts` | Mount/dismount, gallop, following AI |
| `src/ui/hud/HudController.ts` | Health, Dead Eye, honor, time display |
| `src/main.ts` | Engine init, system wiring, render loop |

## Performance Constraints

- Chrome memory limit ~2 GB — chunk streaming is mandatory, not optional
- Target 60 fps on a mid-range laptop GPU (discrete or integrated)
- Textures: KTX2/Basis compressed when art assets are added
- LOD `LOAD_RADIUS = 2` keeps at most ~25 chunks in memory at once
