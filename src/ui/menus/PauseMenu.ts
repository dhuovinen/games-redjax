/**
 * Pause overlay. Toggled with Escape. Presentational only — it reports its
 * paused state through a callback so main.ts can gate the simulation; the menu
 * itself knows nothing about the engine or game systems.
 */
export class PauseMenu {
  private root: HTMLElement;
  private paused = false;

  constructor(
    container: HTMLElement,
    private onToggle: (paused: boolean) => void
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
    return `
      <div style="font-size:30px;letter-spacing:8px;text-transform:uppercase;text-shadow:0 0 12px rgba(212,160,23,0.5);">Paused</div>
      <div style="display:flex;flex-direction:column;gap:8px;font-size:13px;">
        ${row("WASD", "Move")}
        ${row("Shift", "Sprint")}
        ${row("E", "Mount / Dismount")}
        ${row("Q", "Dead Eye")}
        ${row("Left Click", "Shoot / Lock target")}
        ${row("R", "Rest at campfire")}
        ${row("M", "Mute audio")}
        ${row("Esc", "Pause / Resume")}
      </div>
      <button id="pause-resume" style="margin-top:8px;padding:10px 28px;font-family:serif;font-size:14px;letter-spacing:3px;text-transform:uppercase;color:#1a120a;background:linear-gradient(180deg,#d9b65a,#b8923a);border:none;border-radius:4px;cursor:pointer;">Resume</button>
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
