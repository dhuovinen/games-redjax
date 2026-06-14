import { bus } from "@shared/EventBus";

/**
 * Procedural audio — everything is synthesized with the Web Audio API, so the
 * build ships zero audio assets. Output layer: subscribes to the EventBus and
 * is ticked once per frame for locomotion-driven sounds (hoofbeats). It never
 * reaches into game logic.
 *
 * Browsers block audio until a user gesture, so the AudioContext is created
 * lazily and resumed on the first pointer/key interaction.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private windGain!: GainNode;
  private windFilter!: BiquadFilterNode;
  private noiseBuffer!: AudioBuffer;

  private muted = false;
  private masterLevel = 0.8;

  // Hoofbeat scheduler state
  private nextHoofTime = 0;
  private hoofActive = false;

  constructor() {
    const unlock = () => this.ensureContext();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", (e) => {
      if (e.code === "KeyM") this.toggleMute();
      unlock();
    });

    bus.on("weapon:fired", () => this.gunshot());
    bus.on("npc:attackedPlayer", () => this.impact());
    bus.on("deadeye:activated",   () => this.duckWind(true));
    bus.on("deadeye:deactivated", () => this.duckWind(false));
  }

  /** Build the context + persistent ambient graph on first gesture. */
  private ensureContext(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.masterLevel;
    this.master.connect(ctx.destination);

    // 2s of white noise, reused for wind and gunshots
    const len = ctx.sampleRate * 2;
    this.noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    // ── Wind: looping noise → lowpass → gain, with a slow LFO on the cutoff
    const wind = ctx.createBufferSource();
    wind.buffer = this.noiseBuffer;
    wind.loop = true;

    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = "lowpass";
    this.windFilter.frequency.value = 480;
    this.windFilter.Q.value = 0.7;

    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.05;

    wind.connect(this.windFilter).connect(this.windGain).connect(this.master);
    wind.start();

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 220;
    lfo.connect(lfoGain).connect(this.windFilter.frequency);
    lfo.start();

    this.nextHoofTime = ctx.currentTime;
  }

  /** Per-frame tick from the game loop drives the hoofbeat rhythm. */
  update(horseMoving: boolean, galloping: boolean): void {
    this.hoofActive = horseMoving;
    if (!this.ctx) return;
    const ctx = this.ctx;

    if (!this.hoofActive) {
      this.nextHoofTime = ctx.currentTime; // resync so first step is immediate
      return;
    }

    const interval = galloping ? 0.26 : 0.46;
    // Schedule slightly ahead of the audio clock for glitch-free timing
    while (this.nextHoofTime < ctx.currentTime + 0.12) {
      this.hoofbeat(this.nextHoofTime, galloping);
      this.nextHoofTime += interval;
    }
  }

  // ── One-shot synths ────────────────────────────────────────────────────────

  private gunshot(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2400, t);
    filter.frequency.exponentialRampToValueAtTime(220, t + 0.18);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.7, t + 0.005); // sharp crack
    gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.22); // decay tail

    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
    src.stop(t + 0.25);
  }

  private impact(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    // Dull thud for a melee hit on the player
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.12);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.5, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.16);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  private hoofbeat(t: number, galloping: boolean): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(galloping ? 90 : 75, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.09);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(galloping ? 0.34 : 0.24, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0006, t + 0.12);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.14);
  }

  /** Dead Eye: muffle the wind so the slow-motion feels hushed. */
  private duckWind(active: boolean): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.windFilter.frequency.cancelScheduledValues(t);
    this.windFilter.frequency.linearRampToValueAtTime(active ? 160 : 480, t + 0.3);
  }

  toggleMute(): void {
    this.muted = !this.muted;
    if (this.ctx) {
      this.master.gain.linearRampToValueAtTime(
        this.muted ? 0 : this.masterLevel,
        this.ctx.currentTime + 0.1
      );
    }
  }
}
