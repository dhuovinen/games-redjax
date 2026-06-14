/**
 * Pause overlay. Toggled with Escape. Presentational only — it reports its
 * paused state and settings changes through callbacks; the menu itself knows
 * nothing about the engine, audio, or camera it ultimately drives.
 */
export interface PauseSettings {
  initialVolume: number;       // 0..1
  initialSensitivity: number;  // 0..1
  onVolume: (level: number) => void;
  onSensitivity: (level: number) => void;
}

export class PauseMenu {
  private root: HTMLElement;
  private paused = false;

  constructor(
    container: HTMLElement,
    private onToggle: (paused: boolean) => void,
    private settings: PauseSettings
  ) {
    this.root = document.createElement("div");
    Object.assign(this.root.style, {
      position: "absolute",
      inset: "0",
      display: "none",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "22px",
      background: "rgba(12,8,4,0.72)",
      backdropFilter: "blur(3px)",
      pointerEvents: "auto",
      fontFamily: "serif",
      color: "#e8dcc0",
    } as Partial<CSSStyleDeclaration>);
    this.root.innerHTML = this.template();
    container.appendChild(this.root);

    this.root.querySelector("#pause-resume")!.addEventListener("click", () => this.toggle());

    const vol = this.root.querySelector<HTMLInputElement>("#set-volume")!;
    const sens = this.root.querySelector<HTMLInputElement>("#set-sensitivity")!;
    vol.value  = String(Math.round(this.settings.initialVolume * 100));
    sens.value = String(Math.round(this.settings.initialSensitivity * 100));
    vol.addEventListener("input",  () => this.settings.onVolume(Number(vol.value) / 100));
    sens.addEventListener("input", () => this.settings.onSensitivity(Number(sens.value) / 100));

    window.addEventListener("keydown", (e) => {
      if (e.code === "Escape") {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  private template(): string {
    const row = (key: string, action: string) =>
      `<div style="display:flex;gap:14px;justify-content:space-between;width:240px;">
         <span style="color:#d9c79a;letter-spacing:1px;">${key}</span>
         <span style="color:#9b8d6e;">${action}</span>
       </div>`;
    const slider = (id: string, label: string) =>
      `<div style="display:flex;align-items:center;gap:12px;width:260px;justify-content:space-between;">
         <span style="color:#d9c79a;letter-spacing:1px;font-size:13px;">${label}</span>
         <input id="${id}" type="range" min="0" max="100" style="width:150px;accent-color:#c9a23a;cursor:pointer;" />
       </div>`;
    return `
      <div style="font-size:30px;letter-spacing:8px;text-transform:uppercase;text-shadow:0 0 12px rgba(212,160,23,0.5);">Paused</div>
      <div style="display:flex;flex-direction:column;gap:8px;font-size:13px;">
        ${row("WASD", "Move")}
        ${row("Shift", "Sprint")}
        ${row("E", "Mount / Dismount")}
        ${row("Q", "Dead Eye")}
        ${row("Left Click", "Shoot / Lock target")}
        ${row("R", "Rest at campfire")}
        ${row("F", "Talk to traveler")}
        ${row("M", "Mute audio")}
        ${row("Esc", "Pause / Resume")}
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;padding-top:6px;border-top:1px solid rgba(180,150,90,0.25);">
        <div style="font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#9b8d6e;text-align:center;">Settings</div>
        ${slider("set-volume", "Volume")}
        ${slider("set-sensitivity", "Look Speed")}
      </div>
      <button id="pause-resume" style="margin-top:4px;padding:10px 28px;font-family:serif;font-size:14px;letter-spacing:3px;text-transform:uppercase;color:#1a120a;background:linear-gradient(180deg,#d9b65a,#b8923a);border:none;border-radius:4px;cursor:pointer;">Resume</button>
    `;
  }

  toggle(): void {
    this.paused = !this.paused;
    this.root.style.display = this.paused ? "flex" : "none";
    this.onToggle(this.paused);
  }

  isPaused(): boolean {
    return this.paused;
  }
}
