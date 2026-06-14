import { describe, it, expect, beforeEach, vi } from "vitest";
import { bus } from "@shared/EventBus";
import { HorseBondingSystem } from "@core/horse/HorseBondingSystem";
import { HORSE_BOND_PER_RIDE_MINUTE } from "@shared/constants";

describe("HorseBondingSystem", () => {
  let bonding: HorseBondingSystem;

  // Ride n whole minutes (one award is granted per accumulated minute).
  const rideMinutes = (n: number) => {
    for (let i = 0; i < n; i++) bonding.onRideUpdate(60);
  };

  beforeEach(() => {
    bus.clear();
    bonding = new HorseBondingSystem();
  });

  it("starts at level 0, tier 1", () => {
    expect(bonding.getLevel()).toBe(0);
    expect(bonding.getTier()).toBe(1);
  });

  it("awards no bond before a full minute of riding", () => {
    const onBond = vi.fn();
    bus.on("horse:bondingIncreased", onBond);
    bonding.onRideUpdate(59);
    expect(bonding.getLevel()).toBe(0);
    expect(onBond).not.toHaveBeenCalled();
  });

  it("accumulates partial updates into a minute", () => {
    const onBond = vi.fn();
    bus.on("horse:bondingIncreased", onBond);
    bonding.onRideUpdate(30);
    bonding.onRideUpdate(30); // 60s total → one award
    expect(bonding.getLevel()).toBeCloseTo(HORSE_BOND_PER_RIDE_MINUTE);
    expect(onBond).toHaveBeenCalledOnce();
    expect(onBond.mock.calls[0][0].level).toBeCloseTo(HORSE_BOND_PER_RIDE_MINUTE);
  });

  it("climbs through the star tiers", () => {
    expect(bonding.getTier()).toBe(1);
    rideMinutes(60);  // 0.30 → tier 2 (<0.5)
    expect(bonding.getTier()).toBe(2);
    rideMinutes(60);  // 0.60 → tier 3 (<0.75)
    expect(bonding.getTier()).toBe(3);
    rideMinutes(60);  // 0.90 → tier 4
    expect(bonding.getTier()).toBe(4);
  });

  it("clamps at the maximum bond of 1.0", () => {
    rideMinutes(400); // would be 2.0 unclamped
    expect(bonding.getLevel()).toBe(1);
    expect(bonding.getTier()).toBe(4);
  });
});
