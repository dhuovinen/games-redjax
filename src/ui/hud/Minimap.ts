import { bus } from "@shared/EventBus";
import type { Vec3, EncounterType } from "@shared/types";

interface Blip {
  type: EncounterType;
  x: number;
  z: number;
}

/**
 * Top-down minimap. Presentational only — it pulls terrain height through an
 * injected sampler and player state through getters, so it never imports the
 * world/ or entities/ layers directly.
 */
export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private blips = new Map<string, Blip>();
  private rafId = 0;

  private readonly SIZE = 160;       // px
  private readonly CELLS = 40;       // sample grid resolution
  private readonly RANGE = 140;      // world metres shown across the map

  constructor(
    container: HTMLElement,
    private sampleHeight: (x: number, z: number) => number,
    private getPlayerPos: () => Vec3,
    private getFacing: () => number,
    private maxTerrainHeight: number
  ) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.SIZE;
    this.canvas.height = this.SIZE;
    Object.assign(this.canvas.style, {
      position: "absolute",
      top: "24px",
      right: "24px",
      borderRadius: "50%",
      border: "2px solid rgba(180,150,90,0.55)",
      boxShadow: "0 0 16px rgba(0,0,0,0.6)",
      pointerEvents: "none",
    } as Partial<CSSStyleDeclaration>);
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d")!;

    bus.on("encounter:triggered", ({ id, type, position }) => {
      this.blips.set(id, { type, x: position.x, z: position.z });
    });
    bus.on("encounter:resolved", ({ id }) => this.blips.delete(id));
    bus.on("player:died", () => this.blips.clear());

    this.loop();
  }

  private loop = (): void => {
    this.draw();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private draw(): void {
    const { ctx, SIZE, CELLS, RANGE } = this;
    const player = this.getPlayerPos();
    const cellPx = SIZE / CELLS;
    const cellM  = RANGE / CELLS;

    // Terrain backdrop — height-shaded cells centered on the player
    for (let gy = 0; gy < CELLS; gy++) {
      for (let gx = 0; gx < CELLS; gx++) {
        const wx = player.x + (gx - CELLS / 2) * cellM;
        const wz = player.z - (gy - CELLS / 2) * cellM; // north (−z) is up
        const hN = Math.min(1, Math.max(0, this.sampleHeight(wx, wz) / this.maxTerrainHeight));
        ctx.fillStyle = this.heightColor(hN);
        ctx.fillRect(gx * cellPx, gy * cellPx, cellPx + 1, cellPx + 1);
      }
    }

    // Encounter blips
    for (const blip of this.blips.values()) {
      const dx = blip.x - player.x;
      const dz = blip.z - player.z;
      const px = SIZE / 2 + (dx / RANGE) * SIZE;
      const py = SIZE / 2 - (dz / RANGE) * SIZE;
      if (px < 0 || px > SIZE || py < 0 || py > SIZE) continue;
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fillStyle = blip.type === "bandit_ambush" ? "#e23b2e" : "#3ba0e2";
      ctx.fill();
    }

    // Player arrow at center, pointing in facing direction
    ctx.save();
    ctx.translate(SIZE / 2, SIZE / 2);
    ctx.rotate(this.getFacing()); // facing = atan2(x, z): 0 = north (up)
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fillStyle = "#f5f0e0";
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private heightColor(hN: number): string {
    // Sand → clay → rock, matching the terrain palette
    let r: number, g: number, b: number;
    if (hN < 0.3) {
      const t = hN / 0.3;
      r = 0.60 + (0.54 - 0.60) * t; g = 0.48 + (0.33 - 0.48) * t; b = 0.30 + (0.18 - 0.30) * t;
    } else if (hN < 0.6) {
      const t = (hN - 0.3) / 0.3;
      r = 0.54 + (0.46 - 0.54) * t; g = 0.33 + (0.41 - 0.33) * t; b = 0.18 + (0.34 - 0.18) * t;
    } else {
      r = 0.46; g = 0.41; b = 0.34;
    }
    return `rgb(${(r * 255) | 0},${(g * 255) | 0},${(b * 255) | 0})`;
  }

  dispose(): void {
    cancelAnimationFrame(this.rafId);
    this.canvas.remove();
  }
}
