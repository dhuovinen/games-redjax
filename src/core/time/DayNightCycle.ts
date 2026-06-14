import { bus } from "@shared/EventBus";
import { GAME_MINUTES_PER_REAL_SECOND } from "@shared/constants";
import type { GameTime } from "@shared/types";

export class DayNightCycle {
  private time: GameTime = { hour: 8, minute: 0, day: 0 };
  private accumulatedSeconds = 0;

  update(deltaSeconds: number): void {
    this.accumulatedSeconds += deltaSeconds * GAME_MINUTES_PER_REAL_SECOND;

    while (this.accumulatedSeconds >= 1) {
      this.accumulatedSeconds -= 1;
      this.advanceMinute();
    }
  }

  private advanceMinute(): void {
    const prevHour = this.time.hour;
    this.time.minute += 1;

    if (this.time.minute >= 60) {
      this.time.minute = 0;
      this.time.hour += 1;

      if (this.time.hour >= 24) {
        this.time.hour = 0;
        this.time.day += 1;
      }

      if (this.time.hour !== prevHour) {
        bus.emit("time:hourChanged", { hour: this.time.hour });
      }
    }

    bus.emit("time:tick", { time: { ...this.time } });
  }

  /** Jump forward to the next occurrence of the given hour (used by camp rest). */
  setTime(hour: number, minute = 0): void {
    const current = this.time.hour + this.time.minute / 60;
    const target  = hour + minute / 60;
    if (target <= current) this.time.day += 1; // wrapped into the next day
    this.time.hour = hour;
    this.time.minute = minute;
    this.accumulatedSeconds = 0;
    bus.emit("time:hourChanged", { hour });
    bus.emit("time:tick", { time: { ...this.time } });
  }

  getTime(): Readonly<GameTime> {
    return this.time;
  }

  /** 0 at midnight, 1 at noon — smooth sinusoidal day progress */
  getDayProgress(): number {
    return (this.time.hour + this.time.minute / 60) / 24;
  }

  /** Sun elevation angle in radians (-π/2 midnight, π/2 noon) */
  getSunElevation(): number {
    return Math.sin(this.getDayProgress() * Math.PI * 2 - Math.PI / 2);
  }

  isNight(): boolean {
    return this.time.hour < 6 || this.time.hour >= 20;
  }
}
