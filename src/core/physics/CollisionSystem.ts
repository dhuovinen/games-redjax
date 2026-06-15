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

  /**
   * Reactive obstacle avoidance. Given a desired unit heading, look ahead along
   * it for the nearest *static* prop that blocks the path and return a heading
   * that steers tangentially around it. Returns the input heading unchanged
   * when the way is clear. Dynamic agents are ignored here (depenetration in
   * resolve() handles agent-vs-agent bumping).
   */
  steer(
    x: number,
    z: number,
    dirX: number,
    dirZ: number,
    agentR: number,
    lookAhead: number,
    ignoreId?: string
  ): { x: number; z: number } {
    let bestProj = Infinity;
    let awayX = 0;
    let awayZ = 0;
    let found = false;

    for (const [id, c] of this.statics) {
      if (id === ignoreId) continue;
      const ox = c.x - x;
      const oz = c.z - z;
      const proj = ox * dirX + oz * dirZ; // distance along the heading
      if (proj <= 0 || proj > lookAhead) continue; // behind us or too far

      const perpX = ox - dirX * proj;
      const perpZ = oz - dirZ * proj;
      const perpDist = Math.hypot(perpX, perpZ);
      const clearance = agentR + c.r + 0.3; // margin
      if (perpDist >= clearance || proj >= bestProj) continue;

      bestProj = proj;
      found = true;
      if (perpDist > 1e-4) {
        awayX = -perpX / perpDist; // steer away from the obstacle's side
        awayZ = -perpZ / perpDist;
      } else {
        awayX = -dirZ; // head-on: pick an arbitrary perpendicular
        awayZ = dirX;
      }
    }

    if (!found) return { x: dirX, z: dirZ };

    const strength = 1 - bestProj / lookAhead; // closer ⇒ steer harder
    let nx = dirX + awayX * (0.6 + strength);
    let nz = dirZ + awayZ * (0.6 + strength);
    const len = Math.hypot(nx, nz) || 1;
    return { x: nx / len, z: nz / len };
  }
}
