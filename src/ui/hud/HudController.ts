import { bus } from "@shared/EventBus";
import type { HonorTier } from "@shared/types";

const HONOR_COLORS: Record<HonorTier, string> = {
  outlaw: "#c0392b",
  dishonorable: "#e67e22",
  neutral: "#95a5a6",
  honorable: "#27ae60",
  legendary: "#f1c40f",
};

export class HudController {
  private root: HTMLElement;
  private healthFill: HTMLElement;
  private deadEyeFill: HTMLElement;
  private honorDot: HTMLElement;
  private timeDisplay: HTMLElement;
  private notification: HTMLElement;
  private damageFlash: HTMLElement;
  private lastHealth = Infinity;
  private notifTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(container: HTMLElement) {
    this.root = container;
    this.root.innerHTML = this.buildTemplate();

    this.healthFill = this.root.querySelector("#health-fill")!;
    this.deadEyeFill = this.root.querySelector("#deadeye-fill")!;
    this.honorDot = this.root.querySelector("#honor-dot")!;
    this.timeDisplay = this.root.querySelector("#time-display")!;
    this.notification = this.root.querySelector("#notification")!;
    this.damageFlash = this.root.querySelector("#damage-flash")!;

    this.bindEvents();
  }

  private buildTemplate(): string {
    const ctrl = (key: string, action: string) =>
      `<span style="color:rgba(205,185,145,0.65);font-size:10px;letter-spacing:1px;white-space:nowrap;">` +
      `<span style="color:rgba(228,208,162,0.95);">${key}</span> ${action}</span>`;

    return `
      <!-- Center crosshair -->
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:4px;height:4px;background:#fff;border-radius:50%;opacity:0.7;pointer-events:none;"></div>

      <!-- Event notification -->
      <div id="notification" style="position:absolute;top:80px;left:50%;transform:translateX(-50%);color:#d4a017;font-size:13px;font-family:serif;letter-spacing:3px;text-transform:uppercase;opacity:0;transition:opacity 0.4s;text-shadow:0 0 8px rgba(212,160,23,0.6);pointer-events:none;text-align:center;white-space:pre-line;line-height:1.8;"></div>

      <!-- Damage vignette flash -->
      <div id="damage-flash" style="position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity 0.45s;background:radial-gradient(ellipse at center, rgba(140,0,0,0) 45%, rgba(150,0,0,0.55) 100%);"></div>

      <!-- Fixed footer bar — solid backdrop so the HUD stays legible over any scene -->
      <div style="position:absolute;left:0;right:0;bottom:0;display:flex;flex-direction:column;gap:7px;padding:9px 22px;font-family:serif;pointer-events:none;background:linear-gradient(180deg,rgba(30,21,12,0.80),rgba(15,10,5,0.94));border-top:1px solid rgba(150,120,70,0.55);box-shadow:0 -6px 18px rgba(0,0,0,0.45);">

        <!-- Row 1: status -->
        <div style="display:flex;align-items:center;justify-content:space-between;gap:24px;">
          <div style="display:flex;align-items:center;gap:22px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="color:#e0726a;font-size:11px;text-transform:uppercase;letter-spacing:2px;">Health</span>
              <div style="width:130px;height:7px;background:#1a0a0a;border:1px solid #5a1a1a;border-radius:3px;">
                <div id="health-fill" style="height:100%;width:100%;background:linear-gradient(90deg,#c0392b,#e74c3c);border-radius:3px;transition:width 0.3s;"></div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="color:#e6b53f;font-size:11px;text-transform:uppercase;letter-spacing:2px;">Dead Eye</span>
              <div style="width:90px;height:7px;background:#1a1000;border:1px solid #5a4000;border-radius:3px;">
                <div id="deadeye-fill" style="height:100%;width:100%;background:linear-gradient(90deg,#d4a017,#f39c12);border-radius:3px;transition:width 0.3s;"></div>
              </div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:16px;">
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="color:#cbbf9e;font-size:11px;letter-spacing:1px;">Honor</span>
              <div id="honor-dot" style="width:12px;height:12px;border-radius:50%;background:#95a5a6;box-shadow:0 0 6px #95a5a6;transition:background 0.5s,box-shadow 0.5s;"></div>
            </div>
            <span id="time-display" style="color:#e3d2a6;font-size:12px;letter-spacing:2px;">8:00</span>
          </div>
        </div>

        <!-- Row 2: controls -->
        <div style="display:flex;flex-wrap:wrap;gap:14px;border-top:1px solid rgba(150,120,70,0.18);padding-top:6px;">
          ${ctrl("WASD", "Move")}
          ${ctrl("Shift", "Sprint")}
          ${ctrl("E", "Mount")}
          ${ctrl("Q", "Dead Eye")}
          ${ctrl("🖱 Left-Click", "Shoot")}
          ${ctrl("R", "Rest")}
          ${ctrl("F", "Talk")}
          ${ctrl("M", "Mute")}
          ${ctrl("Esc", "Pause")}
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    bus.on("player:healthChanged", ({ current, max }) => {
      this.healthFill.style.width = `${(current / max) * 100}%`;
      if (current < this.lastHealth) this.flashDamage();
      this.lastHealth = current;
    });

    bus.on("honor:changed", ({ tier }) => {
      const color = HONOR_COLORS[tier];
      this.honorDot.style.background = color;
      this.honorDot.style.boxShadow = `0 0 6px ${color}`;
    });

    bus.on("time:tick", ({ time }) => {
      const h = time.hour.toString().padStart(2, "0");
      const m = time.minute.toString().padStart(2, "0");
      this.timeDisplay.textContent = `${h}:${m}`;
    });

    bus.on("deadeye:activated", () => {
      this.deadEyeFill.style.background = "linear-gradient(90deg,#c0392b,#e74c3c)";
      this.showNotification("Dead Eye");
    });

    bus.on("deadeye:deactivated", () => {
      this.deadEyeFill.style.background = "linear-gradient(90deg,#d4a017,#f39c12)";
    });

    bus.on("encounter:triggered", ({ type }) => {
      const msg = type === "bandit_ambush"
        ? "Ambush!\nLeft click to shoot  ·  Q for Dead Eye"
        : "Someone needs help";
      this.showNotification(msg);
    });

    bus.on("player:mounted", () => {
      this.showNotification("Riding");
    });

    bus.on("encounter:resolved", () => {
      this.showNotification("The area is clear");
    });

    bus.on("player:died", () => {
      this.showNotification("You were killed");
    });
  }

  private flashDamage(): void {
    this.damageFlash.style.opacity = "1";
    setTimeout(() => { this.damageFlash.style.opacity = "0"; }, 120);
  }

  private showNotification(text: string): void {
    if (this.notifTimeout) clearTimeout(this.notifTimeout);
    this.notification.textContent = text;
    this.notification.style.opacity = "1";
    this.notifTimeout = setTimeout(() => {
      this.notification.style.opacity = "0";
    }, 2500);
  }
}
