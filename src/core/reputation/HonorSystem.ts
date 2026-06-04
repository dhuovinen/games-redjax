import { bus } from "@shared/EventBus";
import {
  HONOR_KILL_INNOCENT,
  HONOR_KILL_BANDIT,
  HONOR_HELP_TRAVELER,
  HONOR_TIER_THRESHOLDS,
} from "@shared/constants";
import type { HonorTier } from "@shared/types";

export class HonorSystem {
  private value = 0; // −1 to +1

  constructor() {
    bus.on("combat:npcKilled", ({ isInnocent }) => {
      this.adjust(isInnocent ? HONOR_KILL_INNOCENT : HONOR_KILL_BANDIT);
    });
  }

  helpTraveler(): void {
    this.adjust(HONOR_HELP_TRAVELER);
  }

  private adjust(delta: number): void {
    this.value = Math.max(-1, Math.min(1, this.value + delta));
    bus.emit("honor:changed", { value: this.value, tier: this.getTier() });
  }

  getTier(): HonorTier {
    const thresholds = HONOR_TIER_THRESHOLDS;
    if (this.value <= thresholds.outlaw) return "outlaw";
    if (this.value <= thresholds.dishonorable) return "dishonorable";
    if (this.value <= thresholds.neutral) return "neutral";
    if (this.value <= thresholds.honorable) return "honorable";
    return "legendary";
  }

  getValue(): number {
    return this.value;
  }
}
