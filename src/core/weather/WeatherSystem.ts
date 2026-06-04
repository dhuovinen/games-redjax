import { bus } from "@shared/EventBus";
import type { WeatherState } from "@shared/types";

interface WeatherTransition {
  to: WeatherState;
  minDurationSeconds: number;
  maxDurationSeconds: number;
  probability: number;
}

const TRANSITIONS: Record<WeatherState, WeatherTransition[]> = {
  clear: [
    { to: "cloudy", minDurationSeconds: 60, maxDurationSeconds: 180, probability: 0.6 },
    { to: "clear", minDurationSeconds: 120, maxDurationSeconds: 300, probability: 0.4 },
  ],
  cloudy: [
    { to: "rain", minDurationSeconds: 30, maxDurationSeconds: 90, probability: 0.5 },
    { to: "clear", minDurationSeconds: 60, maxDurationSeconds: 180, probability: 0.3 },
    { to: "cloudy", minDurationSeconds: 60, maxDurationSeconds: 120, probability: 0.2 },
  ],
  rain: [
    { to: "storm", minDurationSeconds: 20, maxDurationSeconds: 60, probability: 0.3 },
    { to: "cloudy", minDurationSeconds: 40, maxDurationSeconds: 120, probability: 0.5 },
    { to: "rain", minDurationSeconds: 30, maxDurationSeconds: 90, probability: 0.2 },
  ],
  storm: [
    { to: "rain", minDurationSeconds: 30, maxDurationSeconds: 90, probability: 0.7 },
    { to: "storm", minDurationSeconds: 20, maxDurationSeconds: 60, probability: 0.3 },
  ],
};

export class WeatherSystem {
  private current: WeatherState = "clear";
  private nextTransitionIn = 120; // seconds until next weather change
  private elapsed = 0;

  update(deltaSeconds: number): void {
    this.elapsed += deltaSeconds;

    if (this.elapsed >= this.nextTransitionIn) {
      this.elapsed = 0;
      this.transition();
    }
  }

  private transition(): void {
    const options = TRANSITIONS[this.current];
    const roll = Math.random();
    let cumulative = 0;

    for (const option of options) {
      cumulative += option.probability;
      if (roll <= cumulative) {
        const prev = this.current;
        this.current = option.to;
        this.nextTransitionIn =
          option.minDurationSeconds +
          Math.random() * (option.maxDurationSeconds - option.minDurationSeconds);

        if (prev !== this.current) {
          bus.emit("weather:changed", { state: this.current });
        }
        return;
      }
    }
  }

  getState(): WeatherState {
    return this.current;
  }

  /** 0–1 intensity for rain VFX */
  getRainIntensity(): number {
    if (this.current === "rain") return 0.6;
    if (this.current === "storm") return 1.0;
    return 0;
  }
}
