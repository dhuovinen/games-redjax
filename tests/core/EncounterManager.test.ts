import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { bus } from "@shared/EventBus";
import { EncounterManager } from "@core/encounter/EncounterManager";
import {
  ENCOUNTER_SPAWN_INTERVAL_SECONDS as INTERVAL,
} from "@shared/constants";

const ORIGIN = { x: 0, y: 0, z: 0 };

describe("EncounterManager", () => {
  let mgr: EncounterManager;

  beforeEach(() => {
    bus.clear();
    mgr = new EncounterManager();
  });

  afterEach(() => vi.restoreAllMocks());

  it("does not spawn before the interval elapses", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const onTrig = vi.fn();
    bus.on("encounter:triggered", onTrig);
    mgr.update(INTERVAL - 1, ORIGIN);
    expect(onTrig).not.toHaveBeenCalled();
  });

  it("spawns and triggers a nearby encounter after the interval", () => {
    // random=0 → distance 48m (within the 60m trigger radius), bandit type
    vi.spyOn(Math, "random").mockReturnValue(0);
    const onTrig = vi.fn();
    bus.on("encounter:triggered", onTrig);
    mgr.update(INTERVAL, ORIGIN);
    expect(onTrig).toHaveBeenCalledOnce();
    expect(onTrig.mock.calls[0][0]).toMatchObject({ id: "enc_1", type: "bandit_ambush" });
  });

  it("selects encounter type by weight", () => {
    // angle=0, distance(0)→48m in range, type roll=0.9 → injured_traveler
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.9);
    const onTrig = vi.fn();
    bus.on("encounter:triggered", onTrig);
    mgr.update(INTERVAL, ORIGIN);
    expect(onTrig.mock.calls[0][0].type).toBe("injured_traveler");
  });

  it("increments encounter ids across spawns", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const ids: string[] = [];
    bus.on("encounter:triggered", ({ id }) => ids.push(id));
    mgr.update(INTERVAL, ORIGIN); // enc_1
    mgr.update(INTERVAL, ORIGIN); // enc_2 (no cooldown set yet)
    expect(ids).toEqual(["enc_1", "enc_2"]);
  });

  it("resolve() emits, deactivates, and starts a cooldown blocking respawn", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const onTrig = vi.fn();
    const onResolved = vi.fn();
    bus.on("encounter:triggered", onTrig);
    bus.on("encounter:resolved", onResolved);

    mgr.update(INTERVAL, ORIGIN);
    expect(mgr.getActive()).toHaveLength(1);

    mgr.resolve("enc_1");
    expect(onResolved).toHaveBeenCalledWith({ id: "enc_1" });
    expect(mgr.getActive()).toHaveLength(0);

    // Within cooldown: another interval must not spawn a new encounter
    mgr.update(INTERVAL, ORIGIN);
    expect(onTrig).toHaveBeenCalledOnce();
  });

  it("resolve() on an unknown id is a no-op", () => {
    expect(() => mgr.resolve("nope")).not.toThrow();
  });
});
