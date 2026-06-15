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
    return `
      <div style="position:absolute;bottom:24px;left:24px;display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="color:#c0392b;font-size:11px;font-family:serif;text-transform:uppercase;letter-spacing:2px;">Health</span>
          <div style="width:120px;height:6px;background:#1a0a0a;border:1px solid #5a1a1a;border-radius:3px;">
            <div id="health-fill" style="height:100%;width:100%;background:linear-gradient(90deg,#c0392b,#e74c3c);border-radius:3px;transition:width 0.3s;"></div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="color:#d4a017;font-size:11px;font-family:serif;text-transform:uppercase;letter-spacing:2px;">Dead Eye</span>
          <div style="width:80px;height:6px;background:#1a1000;border:1px solid #5a4000;border-radius:3px;">
            <div id="deadeye-fill" style="height:100%;width:100%;background:linear-gradient(90deg,#d4a017,#f39c12);border-radius:3px;transition:width 0.3s;"></div>
          </div>
        </div>
      </div>

      <div style="position:absolute;bottom:24px;right:24px;display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="color:#bbb;font-size:11px;font-family:serif;letter-spacing:1px;">Honor</span>
          <div id="honor-dot" style="width:12px;height:12px;border-radius:50%;background:#95a5a6;box-shadow:0 0 6px #95a5a6;transition:background 0.5s,box-shadow 0.5s;"></div>
        </div>
        <div id="time-display" style="color:#bbb;font-size:11px;font-family:serif;letter-spacing:2px;">8:00</div>
      </div>

      <div id="notification" style="position:absolute;top:80px;left:50%;transform:translateX(-50%);color:#d4a017;font-size:13px;font-family:serif;letter-spacing:3px;text-transform:uppercase;opacity:0;transition:opacity 0.4s;text-shadow:0 0 8px rgba(212,160,23,0.6);pointer-events:none;text-align:center;white-space:pre-line;line-height:1.8;"></div>

      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:4px;height:4px;background:#fff;border-radius:50%;opacity:0.7;pointer-events:none;"></div>

      <div id="damage-flash" style="position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity 0.45s;background:radial-gradient(ellipse at center, rgba(140,0,0,0) 45%, rgba(150,0,0,0.55) 100%);"></div>

      <div style="position:absolute;bottom:16px;left:50%;transform:translateX(-50%);display:flex;gap:18px;pointer-events:none;white-space:nowrap;">
        <span style="color:rgba(200,180,140,0.55);font-size:10px;font-family:serif;letter-spacing:1px;"><span style="color:rgba(220,200,160,0.85);">WASD</span> Move</span>
        <span style="color:rgba(200,180,140,0.55);font-size:10px;font-family:serif;letter-spacing:1px;"><span style="color:rgba(220,200,160,0.85);">Shift</span> Sprint</span>
        <span style="color:rgba(200,180,140,0.55);font-size:10px;font-family:serif;letter-spacing:1px;"><span style="color:rgba(220,200,160,0.85);">E</span> Mount</span>
        <span style="color:rgba(200,180,140,0.55);font-size:10px;font-family:serif;letter-spacing:1px;"><span style="color:rgba(220,200,160,0.85);">Q</span> Dead Eye</span>
        <span style="color:rgba(200,180,140,0.55);font-size:10px;font-family:serif;letter-spacing:1px;"><span style="color:rgba(220,200,160,0.85);">🖱 Left-Click</span> Shoot</span>
        <span style="color:rgba(200,180,140,0.55);font-size:10px;font-family:serif;letter-spacing:1px;"><span style="color:rgba(220,200,160,0.85);">M</span> Mute</span>
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
