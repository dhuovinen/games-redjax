import { bus } from "@shared/EventBus";
import { DEADEYE_SLOW_FACTOR, DEADEYE_MAX_TARGETS } from "@shared/constants";

export class DeadEyeSystem {
  private active = false;
  private lockedTargets: string[] = [];

  activate(): void {
    if (this.active) return;
    this.active = true;
    this.lockedTargets = [];
    bus.emit("deadeye:activated");
  }

  deactivate(): void {
    if (!this.active) return;
    this.active = false;
    // Intentionally do NOT clear lockedTargets here.
    // The deadeye:deactivated listener calls executeTargets() to consume them.
    bus.emit("deadeye:deactivated");
  }

  toggle(): void {
    this.active ? this.deactivate() : this.activate();
  }

  lockTarget(targetId: string): boolean {
    if (!this.active) return false;
    if (this.lockedTargets.includes(targetId)) return false;
    if (this.lockedTargets.length >= DEADEYE_MAX_TARGETS) return false;

    this.lockedTargets.push(targetId);
    bus.emit("deadeye:targetLocked", { targetId });
    return true;
  }

  /** Consume all locked targets and return them. Clears the list. */
  executeTargets(): string[] {
    const targets = [...this.lockedTargets];
    this.lockedTargets = [];
    return targets;
  }

  isActive(): boolean {
    return this.active;
  }

  getTimeScale(): number {
    return this.active ? DEADEYE_SLOW_FACTOR : 1.0;
  }

  getLockedTargets(): readonly string[] {
    return this.lockedTargets;
  }
}
