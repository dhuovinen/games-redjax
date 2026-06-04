import { bus } from "@shared/EventBus";
import { HORSE_BOND_PER_RIDE_MINUTE, HORSE_MAX_BOND } from "@shared/constants";

export class HorseBondingSystem {
  private bondingLevel = 0;
  private ridingSeconds = 0;

  onRideUpdate(deltaSeconds: number): void {
    this.ridingSeconds += deltaSeconds;

    // Award bonding once per minute of riding
    if (this.ridingSeconds >= 60) {
      this.ridingSeconds -= 60;
      this.increase(HORSE_BOND_PER_RIDE_MINUTE);
    }
  }

  private increase(amount: number): void {
    const prev = this.bondingLevel;
    this.bondingLevel = Math.min(HORSE_MAX_BOND, this.bondingLevel + amount);
    if (this.bondingLevel !== prev) {
      bus.emit("horse:bondingIncreased", { level: this.bondingLevel });
    }
  }

  getLevel(): number {
    return this.bondingLevel;
  }

  /** Returns 1–4 star tier */
  getTier(): 1 | 2 | 3 | 4 {
    if (this.bondingLevel < 0.25) return 1;
    if (this.bondingLevel < 0.5) return 2;
    if (this.bondingLevel < 0.75) return 3;
    return 4;
  }
}
