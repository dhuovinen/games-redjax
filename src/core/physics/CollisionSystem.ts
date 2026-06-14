/**
 * Lightweight 2D (XZ-plane) circle collision. Pure logic, zero Babylon imports
 * — obstacles and agents are circles; movement is resolved by pushing a desired
 * target position out of any overlapping colliders (depenetration).
 *
 * `static` colliders are world props (trees, cacti, rocks, the campfire) added
 * and removed as terrain chunks stream. `dynamic` colliders are moving agents
 * (the player, the horse) updated every frame.
 */
export interface Circle {
  x: number;
  z: number;
  r: number;
}

export class CollisionSystem {
  private statics = new Map<string, Circle>();
  private dynamics = new Map<string, Circle>();

  addStatic(id: string, x: number, z: number, r: number): void {
    this.statics.set(id, { x, z, r });
  }

  removeStatic(id: string): void {
    this.statics.delete(id);
  }

  setDynamic(id: string, x: number, z: number, r: number): void {
    this.dynamics.set(id, { x, z, r });
  }

  removeDynamic(id: string): void {
    this.dynamics.delete(id);
  }

  clear(): void {
    this.statics.clear();
    this.dynamics.clear();
  }

  get staticCount(): number {
    return this.statics.size;
  }

  /**
   * Push a desired target position out of any overlapping colliders.
   * `ignoreId` skips one collider — typically the moving agent's own dynamic
   * entry so it doesn't collide with itself.
   */
  resolve(
    _fromX: number,
    _fromZ: number,
    toX: number,
    toZ: number,
    agentR: number,
    ignoreId?: string
  ): { x: number; z: number } {
    let x = toX;
    let z = toZ;

    const push = (c: Circle): void => {
      const minD = agentR + c.r;
      const dx = x - c.x;
      const dz = z - c.z;
      const d2 = dx * dx + dz * dz;
      if (d2 >= minD * minD) return; // not overlapping
      if (d2 < 1e-8) {
        // Exactly on the collider's center — push out along +x arbitrarily
        x = c.x + minD;
        z = c.z;
        return;
      }
      const d = Math.sqrt(d2);
      const f = (minD - d) / d;
      x += dx * f;
      z += dz * f;
    };

    for (const [id, c] of this.statics) if (id !== ignoreId) push(c);
    for (const [id, c] of this.dynamics) if (id !== ignoreId) push(c);

    return { x, z };
  }
}
