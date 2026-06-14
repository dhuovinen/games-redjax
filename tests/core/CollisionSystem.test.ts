import { describe, it, expect, beforeEach } from "vitest";
import { CollisionSystem } from "@core/physics/CollisionSystem";

const dist = (ax: number, az: number, bx: number, bz: number) =>
  Math.hypot(ax - bx, az - bz);

describe("CollisionSystem", () => {
  let cs: CollisionSystem;

  beforeEach(() => {
    cs = new CollisionSystem();
  });

  it("leaves a target untouched when there are no colliders", () => {
    const r = cs.resolve(0, 0, 5, 3, 0.5);
    expect(r).toEqual({ x: 5, z: 3 });
  });

  it("leaves a target untouched when it does not overlap", () => {
    cs.addStatic("rock", 0, 0, 1);
    const r = cs.resolve(0, 0, 5, 0, 0.5); // 5m away, well clear
    expect(r).toEqual({ x: 5, z: 0 });
  });

  it("pushes an overlapping target out to exactly the contact distance", () => {
    cs.addStatic("rock", 0, 0, 1);
    const r = cs.resolve(0, 0, 0.2, 0, 0.5); // inside (needs >= 1.5m)
    expect(dist(r.x, r.z, 0, 0)).toBeCloseTo(1.5, 6);
    expect(r.z).toBeCloseTo(0, 6); // pushed straight out along x
  });

  it("pushes out along +x when the target sits exactly on the center", () => {
    cs.addStatic("rock", 2, 2, 1);
    const r = cs.resolve(0, 0, 2, 2, 0.5);
    expect(r).toEqual({ x: 2 + 1.5, z: 2 });
  });

  it("respects ignoreId (an agent does not collide with itself)", () => {
    cs.setDynamic("player", 0, 0, 0.5);
    const r = cs.resolve(0, 0, 0, 0, 0.5, "player");
    expect(r).toEqual({ x: 0, z: 0 });
  });

  it("considers dynamic colliders", () => {
    cs.setDynamic("horse", 0, 0, 0.9);
    const r = cs.resolve(0, 0, 0.5, 0, 0.45);
    expect(dist(r.x, r.z, 0, 0)).toBeCloseTo(0.9 + 0.45, 6);
  });

  it("removes static and dynamic colliders", () => {
    cs.addStatic("rock", 0, 0, 1);
    cs.setDynamic("horse", 5, 0, 1);
    expect(cs.staticCount).toBe(1);
    cs.removeStatic("rock");
    cs.removeDynamic("horse");
    expect(cs.staticCount).toBe(0);
    const r = cs.resolve(0, 0, 0.1, 0, 0.5);
    expect(r).toEqual({ x: 0.1, z: 0 }); // nothing left to push against
  });

  it("depenetrates against multiple overlapping colliders", () => {
    cs.addStatic("a", 0, 0, 1);
    cs.addStatic("b", 3, 0, 1);
    // Start between two rocks, overlapping the first
    const r = cs.resolve(0, 0, 0.6, 0, 0.5);
    // Must end clear of rock A (>= 1.5m); rock B is far enough not to re-trap it
    expect(dist(r.x, r.z, 0, 0)).toBeGreaterThanOrEqual(1.5 - 1e-6);
    expect(dist(r.x, r.z, 3, 0)).toBeGreaterThanOrEqual(1.5 - 1e-6);
  });
});
