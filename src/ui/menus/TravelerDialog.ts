/**
 * Injured-traveler dialogue. Shows a "Press F to Talk" prompt when the player
 * is near a traveler, then a choice panel: help (honor up), rob (honor down),
 * or leave. Presentational only — the chosen action and the affected encounter
 * id are reported through a callback.
 */
export type TravelerChoice = "help" | "rob" | "leave";

export class TravelerDialog {
  private prompt: HTMLElement;
  private panel: HTMLElement;
  private encounterId: string | null = null;
  private open = false;

  constructor(
    container: HTMLElement,
    private onChoice: (choice: TravelerChoice, encounterId: string) => void,
    private onToggle: (open: boolean) => void
  ) {
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
    this.prompt.innerHTML = `<span style="color:#d9b65a;">F</span>&nbsp; Talk to traveler`;
    container.appendChild(this.prompt);

    this.panel = document.createElement("div");
    Object.assign(this.panel.style, {
      position: "absolute",
      inset: "0",
      display: "none",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "14px",
      background: "rgba(12,8,4,0.7)",
      backdropFilter: "blur(3px)",
      pointerEvents: "auto",
      fontFamily: "serif",
      color: "#e8dcc0",
    } as Partial<CSSStyleDeclaration>);
    container.appendChild(this.panel);
    this.renderPanel();

    window.addEventListener("keydown", (e) => {
      if (e.code === "KeyF" && this.encounterId && !this.open) {
        e.preventDefault();
        this.setOpen(true);
      } else if (e.code === "Escape" && this.open) {
        e.preventDefault();
        this.choose("leave");
      }
    });
  }

  private renderPanel(): void {
    this.panel.innerHTML = `
      <div style="font-size:22px;letter-spacing:5px;text-transform:uppercase;text-shadow:0 0 12px rgba(212,160,23,0.5);">A Traveler in Need</div>
      <div style="max-width:420px;text-align:center;font-size:13px;color:#bcae8c;line-height:1.7;letter-spacing:0.5px;">
        "Thank the heavens — my horse threw me and bolted. I've coin if you'll
        see me back to the road... though you look like you could just take it."
      </div>
      <div id="traveler-choices" style="display:flex;flex-direction:column;gap:10px;margin-top:6px;"></div>
    `;
    const choices: { label: string; choice: TravelerChoice; tint: string }[] = [
      { label: "Offer to help  ·  Honor +", choice: "help", tint: "linear-gradient(180deg,#7bbf6a,#4e9b3e)" },
      { label: "Rob them  ·  Honor −",       choice: "rob",  tint: "linear-gradient(180deg,#c9603b,#9b3a2a)" },
      { label: "Leave them be",              choice: "leave", tint: "transparent" },
    ];
    const list = this.panel.querySelector("#traveler-choices")!;
    for (const c of choices) {
      const btn = document.createElement("button");
      btn.textContent = c.label;
      Object.assign(btn.style, {
        width: "300px",
        padding: "11px 0",
        fontFamily: "serif",
        fontSize: "14px",
        letterSpacing: "1.5px",
        color: c.choice === "leave" ? "#cbbf9e" : "#10160a",
        background: c.tint,
        border: c.choice === "leave" ? "1px solid rgba(180,150,90,0.4)" : "none",
        borderRadius: "4px",
        cursor: "pointer",
      } as Partial<CSSStyleDeclaration>);
      btn.addEventListener("click", () => this.choose(c.choice));
      list.appendChild(btn);
    }
  }

  private choose(choice: TravelerChoice): void {
    const id = this.encounterId;
    this.setOpen(false);
    if (id) this.onChoice(choice, id);
  }

  /** Called each frame: the nearby traveler's encounter id, or null. */
  setNearby(encounterId: string | null): void {
    this.encounterId = encounterId;
    if (!this.open) {
      this.prompt.style.display = encounterId ? "block" : "none";
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
