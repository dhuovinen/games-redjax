import { describe, it, expect, beforeEach, vi } from "vitest";
import { bus } from "@shared/EventBus";
import { DayNightCycle } from "@core/time/DayNightCycle";

// GAME_MINUTES_PER_REAL_SECOND = 1, so update(seconds) advances that many minutes.
describe("DayNightCycle", () => {
  let clock: DayNightCycle;

  beforeEach(() => {
    bus.clear();
    clock = new DayNightCycle();
  });

  it("starts at 08:00 on day 0", () => {
    expect(clock.getTime()).toMatchObject({ hour: 8, minute: 0, day: 0 });
  });

  it("advances minutes and rolls into the next hour", () => {
    const onHour = vi.fn();
    bus.on("time:hourChanged", onHour);
    clock.update(60); // 60 game-minutes
    expect(clock.getTime()).toMatchObject({ hour: 9, minute: 0 });
    expect(onHour).toHaveBeenCalledWith({ hour: 9 });
  });

  it("rolls hour 23 → 00 into the next day", () => {
    clock.update(16 * 60); // 08:00 + 16h = 24:00 → 00:00 day 1
    expect(clock.getTime()).toMatchObject({ hour: 0, minute: 0, day: 1 });
  });

  it("emits time:tick on every minute", () => {
    const onTick = vi.fn();
    bus.on("time:tick", onTick);
    clock.update(5);
    expect(onTick).toHaveBeenCalledTimes(5);
  });

  it("day progress is 0.5 at noon and sun elevation peaks", () => {
    clock.update(4 * 60); // 08:00 → 12:00
    expect(clock.getDayProgress()).toBeCloseTo(0.5);
    expect(clock.getSunElevation()).toBeCloseTo(1, 5);
  });

  it("sun is below the horizon at midnight", () => {
    clock.setTime(0);
    expect(clock.getSunElevation()).toBeCloseTo(-1, 5);
  });

  it("isNight() reflects the 20:00–06:00 window", () => {
    clock.setTime(12);
    expect(clock.isNight()).toBe(false);
    clock.setTime(22);
    expect(clock.isNight()).toBe(true);
    clock.setTime(5);
    expect(clock.isNight()).toBe(true);
  });

  it("setTime() wraps to the next day when the target is not ahead", () => {
    // 08:00 → setTime(6) jumps backward in the clock, so it's the next morning
    clock.setTime(6);
    expect(clock.getTime()).toMatchObject({ hour: 6, minute: 0, day: 1 });
  });

  it("setTime() emits tick + hour change", () => {
    const onTick = vi.fn();
    const onHour = vi.fn();
    bus.on("time:tick", onTick);
    bus.on("time:hourChanged", onHour);
    clock.setTime(18);
    expect(onHour).toHaveBeenCalledWith({ hour: 18 });
    expect(onTick).toHaveBeenCalledOnce();
  });
});
