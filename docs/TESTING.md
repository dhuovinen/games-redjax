# Testing

## Strategy

- `src/core/` + `src/shared/` are unit-tested with Vitest — no browser, no WebGL context required
- `src/world/`, `src/entities/`, `src/ui/`, `src/audio/` are validated by running the dev server and playing

## Run tests

```bash
npm test         # watch mode
npm run test:run # single run (CI)
```

## Current suite — 48 tests across 7 files

| File | Covers |
|---|---|
| `tests/shared/EventBus.test.ts` | subscribe/emit/off, unsubscribe, fan-out, clear |
| `tests/core/DeadEyeSystem.test.ts` | activate/toggle, lock cap + dedupe, the deactivate-keeps-targets regression |
| `tests/core/HonorSystem.test.ts` | bus-driven kills, help/rob, ±1 clamp, tier mapping |
| `tests/core/DayNightCycle.test.ts` | minute/hour/day rollover, sun elevation, `setTime` day-wrap |
| `tests/core/EncounterManager.test.ts` | interval gating, proximity trigger, type weighting, resolve + cooldown |
| `tests/core/WeatherSystem.test.ts` | transition timing, state machine, rain intensity |
| `tests/core/HorseBondingSystem.test.ts` | per-minute award, tier thresholds, max-bond clamp |

`Math.random` is stubbed with `vi.spyOn` for deterministic spawn/transition tests.

## Coverage target

- `core/` layer: ≥ 80% line coverage — met (all six core systems + the bus)
- `world/` + `entities/` + `audio/`: manual smoke testing via dev server

## Writing tests

Tests live under the top-level `tests/` directory (mirroring `src/`), kept out
of the production `tsc` build (`tsconfig` only includes `src`). Vitest resolves
the `@core` / `@shared` path aliases from `vite.config.ts` automatically.

The shared `EventBus` is a singleton, so call `bus.clear()` in `beforeEach` and
construct the system under test afterward — systems that subscribe in their
constructor (e.g. `HonorSystem`) then re-register against a clean bus.

## Manual smoke test checklist (dev server)

- [ ] Terrain visible on load, no console errors
- [ ] Player moves with WASD, camera follows
- [ ] Mount horse with E key, unmount with E
- [ ] Q activates Dead Eye (world visually slows via game delta)
- [ ] Wait 90 seconds → encounter notification appears
- [ ] Time display in HUD advances
- [ ] Weather transitions visible over time
