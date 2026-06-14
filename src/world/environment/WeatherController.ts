import {
  Scene,
  ParticleSystem,
  DynamicTexture,
  Vector3,
  Color3,
  Color4,
  MeshBuilder,
  HemisphericLight,
} from "@babylonjs/core";
import { bus } from "@shared/EventBus";
import type { WeatherSystem } from "@core/weather/WeatherSystem";
import type { WeatherState } from "@shared/types";

interface WeatherParams {
  emitRate: number;   // rain particles/sec
  fogAdd: number;     // density added on top of the sky's base fog
  fogTint: Color3;    // weather fog colour
  fogBlend: number;   // 0..1 blend of sky colour → fogTint
}

const PARAMS: Record<WeatherState, WeatherParams> = {
  clear:  { emitRate: 0,    fogAdd: 0.0000, fogTint: new Color3(0.70, 0.70, 0.75), fogBlend: 0.00 },
  cloudy: { emitRate: 0,    fogAdd: 0.0016, fogTint: new Color3(0.70, 0.70, 0.75), fogBlend: 0.35 },
  rain:   { emitRate: 1500, fogAdd: 0.0060, fogTint: new Color3(0.55, 0.57, 0.62), fogBlend: 0.55 },
  storm:  { emitRate: 3500, fogAdd: 0.0140, fogTint: new Color3(0.32, 0.34, 0.42), fogBlend: 0.72 },
};

/**
 * Renders the weather state machine. Fog has a single owner per frame: the
 * SkyController writes a time-of-day base earlier in the loop, then this
 * controller (which runs after it) combines the weather layer on top. Rain
 * uses a procedurally-generated texture so it works offline and under the
 * COOP/COEP headers (a cross-origin texture would be blocked by require-corp).
 */
export class WeatherController {
  private rain: ParticleSystem;
  private flash: HemisphericLight;
  private target: WeatherParams = PARAMS.clear;

  // Smoothed current values (eased toward target on weather change)
  private curEmit = 0;
  private curFogAdd = 0;
  private curBlend = 0;

  // Lightning
  private isStorm = false;
  private nextStrikeIn = 0;
  private flashTime = 0;
  private readonly FLASH_DURATION = 0.18;

  constructor(private scene: Scene, weatherSystem: WeatherSystem) {
    this.rain = this.buildRainSystem();

    // Scene-wide flash light, dark until a strike fires
    this.flash = new HemisphericLight("lightning", new Vector3(0, 1, 0), scene);
    this.flash.diffuse     = new Color3(0.80, 0.85, 1.0);
    this.flash.groundColor = new Color3(0.60, 0.65, 0.80);
    this.flash.specular    = new Color3(0, 0, 0);
    this.flash.intensity   = 0;

    bus.on("weather:changed", ({ state }) => this.applyState(state));
    this.applyState(weatherSystem.getState());
  }

  private buildRainSystem(): ParticleSystem {
    const ps = new ParticleSystem("rain", 4000, this.scene);

    const emitter = MeshBuilder.CreateBox("rainEmitter", { size: 0.1 }, this.scene);
    emitter.isVisible = false;
    emitter.position.y = 30;
    ps.emitter = emitter;

    ps.particleTexture = this.makeRaindropTexture();
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD; // alpha, not additive glow

    ps.minSize = 0.05; ps.maxSize = 0.13;
    ps.minLifeTime = 0.7; ps.maxLifeTime = 1.2;
    ps.emitRate = 0;
    ps.minEmitPower = 9; ps.maxEmitPower = 15;
    ps.gravity = new Vector3(0, -55, 0);
    ps.direction1 = new Vector3(-0.4, -1, -0.4);
    ps.direction2 = new Vector3(0.4, -1, 0.4);
    ps.minEmitBox = new Vector3(-32, 0, -32);
    ps.maxEmitBox = new Vector3(32, 0, 32);
    ps.color1 = new Color4(0.78, 0.82, 0.95, 0.55);
    ps.color2 = new Color4(0.62, 0.66, 0.85, 0.35);
    ps.colorDead = new Color4(0, 0, 0, 0);

    ps.start();
    return ps;
  }

  /** Local procedural raindrop sprite — no external asset, COEP-safe. */
  private makeRaindropTexture(): DynamicTexture {
    const size = 32;
    const tex = new DynamicTexture("raindrop", size, this.scene, false);
    const ctx = tex.getContext();
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    tex.hasAlpha = true;
    tex.update();
    return tex;
  }

  private applyState(state: string): void {
    this.target = PARAMS[state as WeatherState] ?? PARAMS.clear;
    this.isStorm = state === "storm";
    if (this.isStorm && this.nextStrikeIn <= 0) {
      this.nextStrikeIn = 2 + Math.random() * 4;
    }
    if (!this.isStorm) {
      this.flashTime = 0;
      this.flash.intensity = 0;
    }
  }

  update(playerPosition: Vector3, deltaSeconds = 0): void {
    // Keep the rain volume centered on the player
    const emitter = this.rain.emitter as { position: Vector3 };
    emitter.position.x = playerPosition.x;
    emitter.position.z = playerPosition.z;

    // Ease toward the target weather so changes aren't instant
    const k = Math.min(1, deltaSeconds * 1.5);
    this.curEmit   += (this.target.emitRate - this.curEmit) * k;
    this.curFogAdd += (this.target.fogAdd   - this.curFogAdd) * k;
    this.curBlend  += (this.target.fogBlend - this.curBlend) * k;
    this.rain.emitRate = this.curEmit;

    // Combine weather fog ON TOP of the sky's base (sky already ran this frame).
    // This controller is the single final writer of scene.fog* each frame.
    const base = this.scene.fogColor;
    const tint = this.target.fogTint;
    this.scene.fogColor = new Color3(
      base.r + (tint.r - base.r) * this.curBlend,
      base.g + (tint.g - base.g) * this.curBlend,
      base.b + (tint.b - base.b) * this.curBlend
    );
    this.scene.fogDensity = this.scene.fogDensity + this.curFogAdd;

    // Lightning during storms
    if (this.isStorm) {
      this.nextStrikeIn -= deltaSeconds;
      if (this.nextStrikeIn <= 0) {
        this.flashTime = this.FLASH_DURATION;
        this.nextStrikeIn = 3 + Math.random() * 6;
        bus.emit("weather:lightning"); // AudioManager answers with thunder
      }
    }
    if (this.flashTime > 0) {
      this.flashTime -= deltaSeconds;
      const t = Math.max(0, this.flashTime / this.FLASH_DURATION);
      this.flash.intensity = t * 2.6 * (0.55 + Math.random() * 0.45); // flicker
    } else {
      this.flash.intensity = 0;
    }
  }

  dispose(): void {
    this.rain.dispose();
    this.flash.dispose();
  }
}
