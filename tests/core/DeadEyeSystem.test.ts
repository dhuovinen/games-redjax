import { describe, it, expect, beforeEach, vi } from "vitest";
import { bus } from "@shared/EventBus";
import { DeadEyeSystem } from "@core/combat/DeadEyeSystem";
import { DEADEYE_SLOW_FACTOR, DEADEYE_MAX_TARGETS } from "@shared/constants";

describe("DeadEyeSystem", () => {
  let de: DeadEyeSystem;

  beforeEach(() => {
    bus.clear();
    de = new DeadEyeSystem();
  });

  it("starts inactive at normal time scale", () => {
    expect(de.isActive()).toBe(false);
    expect(de.getTimeScale()).toBe(1.0);
  });

  it("activates: sets time scale and emits once", () => {
    const onActivate = vi.fn();
    bus.on("deadeye:activated", onActivate);
    de.activate();
    expect(de.isActive()).toBe(true);
    expect(de.getTimeScale()).toBe(DEADEYE_SLOW_FACTOR);
    expect(onActivate).toHaveBeenCalledOnce();
  });

  it("activate() is idempotent (no double emit)", () => {
    const onActivate = vi.fn();
    bus.on("deadeye:activated", onActivate);
    de.activate();
    de.activate();
    expect(onActivate).toHaveBeenCalledOnce();
  });

  it("toggle() flips active state", () => {
    de.toggle();
    expect(de.isActive()).toBe(true);
    de.toggle();
    expect(de.isActive()).toBe(false);
  });

  it("locks targets only while active, and emits per lock", () => {
    expect(de.lockTarget("a")).toBe(false); // inactive
    de.activate();
    const onLock = vi.fn();
    bus.on("deadeye:targetLocked", onLock);
    expect(de.lockTarget("a")).toBe(true);
    expect(onLock).toHaveBeenCalledWith({ targetId: "a" });
  });

  it("rejects duplicate targets", () => {
    de.activate();
    expect(de.lockTarget("a")).toBe(true);
    expect(de.lockTarget("a")).toBe(false);
    expect(de.getLockedTargets()).toEqual(["a"]);
  });

  it("caps locks at DEADEYE_MAX_TARGETS", () => {
    de.activate();
    for (let i = 0; i < DEADEYE_MAX_TARGETS; i++) {
      expect(de.lockTarget(`t${i}`)).toBe(true);
    }
    expect(de.lockTarget("overflow")).toBe(false);
    expect(de.getLockedTargets()).toHaveLength(DEADEYE_MAX_TARGETS);
  });

  // Guards the regression: deactivate() must NOT clear targets, so the
  // deadeye:deactivated listener can still consume them via executeTargets().
  it("deactivate() keeps targets; executeTargets() consumes them", () => {
    de.activate();
    de.lockTarget("a");
    de.lockTarget("b");
    de.deactivate();
    expect(de.getLockedTargets()).toEqual(["a", "b"]); // still present
    const fired = de.executeTargets();
    expect(fired).toEqual(["a", "b"]);
    expect(de.getLockedTargets()).toEqual([]); // now cleared
  });

  it("re-activating clears the previous target list", () => {
    de.activate();
    de.lockTarget("a");
    de.deactivate();
    de.activate();
    expect(de.getLockedTargets()).toEqual([]);
  });
});
