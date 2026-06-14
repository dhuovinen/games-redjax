import { describe, it, expect, beforeEach, vi } from "vitest";
import { bus } from "@shared/EventBus";
import { HonorSystem } from "@core/reputation/HonorSystem";
import {
  HONOR_KILL_INNOCENT,
  HONOR_KILL_BANDIT,
  HONOR_HELP_TRAVELER,
  HONOR_ROB_TRAVELER,
} from "@shared/constants";

describe("HonorSystem", () => {
  let honor: HonorSystem;

  beforeEach(() => {
    bus.clear();
    honor = new HonorSystem();
  });

  it("starts neutral at 0", () => {
    expect(honor.getValue()).toBe(0);
    expect(honor.getTier()).toBe("neutral");
  });

  it("reacts to combat:npcKilled via the bus", () => {
    bus.emit("combat:npcKilled", { npcId: "b1", isInnocent: false });
    expect(honor.getValue()).toBeCloseTo(HONOR_KILL_BANDIT);

    bus.emit("combat:npcKilled", { npcId: "t1", isInnocent: true });
    expect(honor.getValue()).toBeCloseTo(HONOR_KILL_BANDIT + HONOR_KILL_INNOCENT);
  });

  it("helpTraveler and robTraveler move honor in opposite directions", () => {
    honor.helpTraveler();
    expect(honor.getValue()).toBeCloseTo(HONOR_HELP_TRAVELER);
    honor.robTraveler();
    expect(honor.getValue()).toBeCloseTo(HONOR_HELP_TRAVELER + HONOR_ROB_TRAVELER);
  });

  it("emits honor:changed with the current tier", () => {
    const onChange = vi.fn();
    bus.on("honor:changed", onChange);
    honor.helpTraveler();
    expect(onChange).toHaveBeenCalledOnce();
    // Any value in (0, 0.4] reads as honorable; neutral is (-0.4, 0].
    expect(onChange.mock.calls[0][0].tier).toBe("honorable");
  });

  it("clamps to the +1 / -1 range", () => {
    for (let i = 0; i < 30; i++) honor.helpTraveler();
    expect(honor.getValue()).toBe(1);
    for (let i = 0; i < 40; i++) {
      bus.emit("combat:npcKilled", { npcId: "x", isInnocent: true });
    }
    expect(honor.getValue()).toBe(-1);
  });

  it("maps values to tiers", () => {
    const kills = (n: number) => {
      for (let i = 0; i < n; i++) bus.emit("combat:npcKilled", { npcId: "x", isInnocent: true });
    };
    const helps = (n: number) => { for (let i = 0; i < n; i++) honor.helpTraveler(); };

    expect(honor.getTier()).toBe("neutral");
    helps(3);            // +0.30 → honorable (0 < v <= 0.4)
    expect(honor.getTier()).toBe("honorable");
    helps(3);            // +0.60 → legendary (> 0.4)
    expect(honor.getTier()).toBe("legendary");

    // reset and go negative
    bus.clear();
    honor = new HonorSystem();
    kills(4);            // -0.60 → dishonorable (<= -0.4)
    expect(honor.getTier()).toBe("dishonorable");
    kills(2);            // -0.90 (clamped path) → outlaw (<= -0.8)
    expect(honor.getTier()).toBe("outlaw");
  });
});
