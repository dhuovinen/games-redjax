# Testing

## Strategy

- `src/core/` systems are unit-tested with Vitest — no browser, no WebGL context required
- `src/world/`, `src/entities/`, `src/ui/` are validated by running the dev server and playing

## Run tests

```bash
npm test
```

## Coverage target

- `core/` layer: ≥ 80% line coverage
- `world/` + `entities/`: manual smoke testing via dev server

## Writing tests

Tests live adjacent to source files: `src/core/time/DayNightCycle.test.ts`.

Example test scaffold:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { DayNightCycle } from "./DayNightCycle";
import { bus } from "@shared/EventBus";

describe("DayNightCycle", () => {
  let cycle: DayNightCycle;

  beforeEach(() => {
    bus.clear();
    cycle = new DayNightCycle();
  });

  it("advances time correctly", () => {
    // 60 real seconds at 1 min/sec = 60 game minutes = 1 game hour
    for (let i = 0; i < 60; i++) cycle.update(1);
    expect(cycle.getTime().hour).toBe(9); // started at 8
  });

  it("reports night correctly", () => {
    for (let i = 0; i < 14 * 60; i++) cycle.update(1); // advance 14 hours to 22:00
    expect(cycle.isNight()).toBe(true);
  });
});
```

## Manual smoke test checklist (dev server)

- [ ] Terrain visible on load, no console errors
- [ ] Player moves with WASD, camera follows
- [ ] Mount horse with E key, unmount with E
- [ ] Q activates Dead Eye (world visually slows via game delta)
- [ ] Wait 90 seconds → encounter notification appears
- [ ] Time display in HUD advances
- [ ] Weather transitions visible over time
