/**
 * Campfire rest UI. Shows a "Press R to Rest" prompt when the player is near a
 * fire, and a time-skip panel when opened. Presentational only — it reports the
 * chosen rest hour and its open/closed state through callbacks.
 */
interface RestOption {
  label: string;
  hour: number;
}

const OPTIONS: RestOption[] = [
  { label: "Until Dawn  ·  6:00",  hour: 6 },
  { label: "Until Noon  ·  12:00", hour: 12 },
  { label: "Until Dusk  ·  18:00", hour: 18 },
  { label: "Until Night ·  22:00", hour: 22 },
];

export class RestMenu {
  private prompt: HTMLElement;
  private panel: HTMLElement;
  private nearby = false;
  private open = false;

  constructor(
    container: HTMLElement,
    private onRest: (hour: number) => void,
    private onToggle: (open: boolean) => void
  ) {
    // Proximity prompt
    this.prompt = document.createElement("div");
    Object.assign(this.prompt.style, {
      position: "absolute",
      bottom: "84px",
      left: "50%",
      transform: "translateX(-50%)",
      display: "none",
      padding: "6px 16px",
      background: "rgba(20,12,4,0.7)",
      border: "1px solid rgba(180,150,90,0.5)",
      borderRadius: "4px",
      color: "#e8dcc0",
      fontFamily: "serif",
      fontSize: "13px",
      letterSpacing: "2px",
      pointerEvents: "none",
    } as Partial<CSSStyleDeclaration>);
    this.prompt.innerHTML = `<span style="color:#d9b65a;">R</span>&nbsp; Rest at campfire`;
    container.appendChild(this.prompt);

    // Rest options panel
    this.panel = document.createElement("div");
    Object.assign(this.panel.style, {
      position: "absolute",
      inset: "0",
      display: "none",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "16px",
      background: "rgba(12,8,4,0.7)",
      backdropFilter: "blur(3px)",
      pointerEvents: "auto",
      fontFamily: "serif",
      color: "#e8dcc0",
    } as Partial<CSSStyleDeclaration>);
    container.appendChild(this.panel);
    this.renderPanel();

    window.addEventListener("keydown", (e) => {
      if (e.code === "KeyR" && this.nearby && !this.open) {
        e.preventDefault();
        this.setOpen(true);
      } else if (e.code === "Escape" && this.open) {
        e.preventDefault();
        this.setOpen(false);
      }
    });
  }

  private renderPanel(): void {
    this.panel.innerHTML = `
      <div style="font-size:24px;letter-spacing:6px;text-transform:uppercase;text-shadow:0 0 12px rgba(212,160,23,0.5);">Make Camp</div>
      <div style="font-size:12px;color:#9b8d6e;letter-spacing:1px;margin-bottom:6px;">Rest restores your health and passes the time</div>
      <div id="rest-options" style="display:flex;flex-direction:column;gap:10px;"></div>
      <button data-cancel="1" style="margin-top:6px;padding:8px 22px;font-family:serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#cbbf9e;background:transparent;border:1px solid rgba(180,150,90,0.4);border-radius:4px;cursor:pointer;">Cancel</button>
    `;
    const list = this.panel.querySelector("#rest-options")!;
    for (const opt of OPTIONS) {
      const btn = document.createElement("button");
      btn.textContent = opt.label;
      Object.assign(btn.style, {
        width: "260px",
        padding: "11px 0",
        fontFamily: "serif",
        fontSize: "14px",
        letterSpacing: "2px",
        color: "#1a120a",
        background: "linear-gradient(180deg,#d9b65a,#b8923a)",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
      } as Partial<CSSStyleDeclaration>);
      btn.addEventListener("click", () => {
        this.onRest(opt.hour);
        this.setOpen(false);
      });
      list.appendChild(btn);
    }
    this.panel.querySelector("[data-cancel]")!.addEventListener("click", () => this.setOpen(false));
  }

  /** Called each frame by the game loop. */
  setNearby(near: boolean): void {
    this.nearby = near;
    if (!this.open) {
      this.prompt.style.display = near ? "block" : "none";
    }
  }

  private setOpen(open: boolean): void {
    this.open = open;
    this.panel.style.display = open ? "flex" : "none";
    if (open) this.prompt.style.display = "none";
    this.onToggle(open);
  }

  isOpen(): boolean {
    return this.open;
  }
}
