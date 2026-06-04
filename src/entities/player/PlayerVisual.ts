import {
  Scene,
  TransformNode,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Mesh,
} from "@babylonjs/core";

// Western protagonist palette
const C = {
  skin:    new Color3(0.90, 0.70, 0.52),  // warm tan skin
  shirt:   new Color3(0.88, 0.76, 0.54),  // cream/tan cowboy shirt
  pants:   new Color3(0.22, 0.38, 0.62),  // blue denim jeans
  boot:    new Color3(0.46, 0.28, 0.13),  // medium brown leather boots
  hat:     new Color3(0.48, 0.32, 0.16),  // warm medium-brown hat
  belt:    new Color3(0.26, 0.14, 0.06),  // dark belt
};

interface CharacterColors {
  skin: Color3;
  shirt: Color3;
  pants: Color3;
  boot: Color3;
  hat: Color3;
  belt: Color3;
}

export class PlayerVisual {
  readonly root: TransformNode;

  private leftLegPivot: TransformNode;
  private rightLegPivot: TransformNode;
  private leftArmPivot: TransformNode;
  private rightArmPivot: TransformNode;

  private elapsedTime = 0;
  private _isRiding = false;
  private _meshes: Mesh[] = [];

  constructor(scene: Scene, suffix = "player", colors: CharacterColors = C, npcMeta?: object) {
    this.root = new TransformNode(`vis_${suffix}`, scene);

    // emissive: fraction of diffuse color kept in shadow (prevents objects going black)
    // specPow:  tightness of highlight — 4=matte fabric, 32=skin, 64=leather
    // specStr:  white highlight brightness
    const mat = (
      name: string, color: Color3,
      emissive = 0.25, specPow = 12, specStr = 0.06
    ) => {
      const m = new StandardMaterial(`${suffix}_${name}`, scene);
      m.diffuseColor  = color.clone();
      m.emissiveColor = color.scale(emissive);
      m.specularColor = new Color3(specStr, specStr, specStr);
      m.specularPower = specPow;
      return m;
    };

    const skinM    = mat("skin",    colors.skin,               0.28, 24, 0.14); // slight skin sheen
    const shirtM   = mat("shirt",   colors.shirt,              0.32,  6, 0.04); // matte fabric
    const pantsM   = mat("pants",   colors.pants,              0.38,  6, 0.04); // vivid blue jeans
    const bootM    = mat("boot",    colors.boot,               0.20, 55, 0.22); // polished leather
    const hatM     = mat("hat",     colors.hat,                0.26,  8, 0.05); // felt hat
    const beltM    = mat("belt",    colors.belt,               0.20, 55, 0.22); // leather belt
    const bandanaM = mat("bandana", new Color3(0.78, 0.12, 0.10), 0.40, 6, 0.04); // vivid red

    const box = (
      name: string, w: number, h: number, d: number,
      parent: TransformNode, px: number, py: number, pz: number,
      material: StandardMaterial
    ): Mesh => {
      const m = MeshBuilder.CreateBox(`${suffix}_${name}`, { width: w, height: h, depth: d }, scene);
      m.parent = parent;
      m.position.set(px, py, pz);
      m.material = material;
      m.receiveShadows = true;
      if (npcMeta) m.metadata = npcMeta;
      this._meshes.push(m);
      return m;
    };

    // ── Legs (pivot at hip, mesh hangs down) ──────────────────────────────
    this.leftLegPivot = new TransformNode(`${suffix}_llp`, scene);
    this.leftLegPivot.parent = this.root;
    this.leftLegPivot.position.set(-0.11, 0.64, 0);
    box("ll", 0.22, 0.64, 0.22, this.leftLegPivot, 0, -0.32, 0, pantsM);
    box("lb", 0.24, 0.10, 0.28, this.leftLegPivot, 0, -0.67, 0.03, bootM);

    this.rightLegPivot = new TransformNode(`${suffix}_rlp`, scene);
    this.rightLegPivot.parent = this.root;
    this.rightLegPivot.position.set(0.11, 0.64, 0);
    box("rl", 0.22, 0.64, 0.22, this.rightLegPivot, 0, -0.32, 0, pantsM);
    box("rb", 0.24, 0.10, 0.28, this.rightLegPivot, 0, -0.67, 0.03, bootM);

    // ── Torso ──────────────────────────────────────────────────────────────
    box("torso",   0.44, 0.58, 0.22, this.root, 0, 0.93, 0,    shirtM);
    box("belt",    0.44, 0.07, 0.23, this.root, 0, 0.67, 0,    beltM);
    box("bandana", 0.34, 0.10, 0.14, this.root, 0, 1.23, -0.04, bandanaM);

    // ── Arms (pivot at shoulder) ───────────────────────────────────────────
    this.leftArmPivot = new TransformNode(`${suffix}_lap`, scene);
    this.leftArmPivot.parent = this.root;
    this.leftArmPivot.position.set(-0.33, 1.22, 0);
    box("la", 0.22, 0.58, 0.22, this.leftArmPivot, 0, -0.29, 0, shirtM);

    this.rightArmPivot = new TransformNode(`${suffix}_rap`, scene);
    this.rightArmPivot.parent = this.root;
    this.rightArmPivot.position.set(0.33, 1.22, 0);
    box("ra", 0.22, 0.58, 0.22, this.rightArmPivot, 0, -0.29, 0, shirtM);

    // ── Head ──────────────────────────────────────────────────────────────
    box("head", 0.44, 0.44, 0.44, this.root, 0, 1.44, 0, skinM);

    // ── Cowboy hat: brim + crown ───────────────────────────────────────────
    box("hatBrim",  0.66, 0.06, 0.66, this.root, 0, 1.67, 0,    hatM);
    box("hatCrown", 0.44, 0.30, 0.44, this.root, 0, 1.85, 0,    hatM);
  }

  /** Sync position from the invisible physics mesh. groundY = actual ground height. */
  sync(physX: number, groundY: number, physZ: number, rotY: number): void {
    this.root.position.set(physX, groundY, physZ);
    this.root.rotation.y = rotY;
  }

  animate(isMoving: boolean, normalizedSpeed: number, deltaSeconds: number): void {
    if (this._isRiding) return; // pose locked while on horse
    this.elapsedTime += deltaSeconds;
    const target = isMoving ? normalizedSpeed * 0.70 : 0;
    const freq = this.elapsedTime * 8;

    this.leftLegPivot.rotation.x   =  Math.sin(freq) * target;
    this.rightLegPivot.rotation.x  = -Math.sin(freq) * target;
    this.leftArmPivot.rotation.x   = -Math.sin(freq) * target * 0.5;
    this.rightArmPivot.rotation.x  =  Math.sin(freq) * target * 0.5;
  }

  /**
   * Switch between walking pose (isRiding=false) and saddle pose (isRiding=true).
   * Riding pose spreads legs to straddle and brings arms forward for reins.
   */
  setRidingPose(isRiding: boolean): void {
    this._isRiding = isRiding;
    if (isRiding) {
      // Legs spread wide to each side of the horse
      this.leftLegPivot.rotation.set(0.10, 0,  0.90);
      this.rightLegPivot.rotation.set(0.10, 0, -0.90);
      // Arms slightly forward and inward — holding reins
      this.leftArmPivot.rotation.set(0.50, 0,  0.18);
      this.rightArmPivot.rotation.set(0.50, 0, -0.18);
    } else {
      // Reset to neutral standing pose
      this.leftLegPivot.rotation.set(0, 0, 0);
      this.rightLegPivot.rotation.set(0, 0, 0);
      this.leftArmPivot.rotation.set(0, 0, 0);
      this.rightArmPivot.rotation.set(0, 0, 0);
    }
  }

  setVisible(v: boolean): void {
    this.root.setEnabled(v);
  }

  getMeshes(): Mesh[] {
    return this._meshes;
  }

  dispose(): void {
    this._meshes.forEach((m) => m.dispose());
    this.root.dispose();
  }
}

// Bandit colors — dark vest, red bandana already applied via bandanaM fixed color
export const BANDIT_COLORS: CharacterColors = {
  skin:  new Color3(0.68, 0.48, 0.34),
  shirt: new Color3(0.24, 0.20, 0.16),  // dark charcoal vest
  pants: new Color3(0.36, 0.22, 0.12),  // worn brown trousers
  boot:  new Color3(0.20, 0.11, 0.04),
  hat:   new Color3(0.16, 0.10, 0.05),  // near-black outlaw hat
  belt:  new Color3(0.62, 0.12, 0.10),  // vivid red sash/belt
};

// Traveler colors — civilian, lighter look
export const TRAVELER_COLORS: CharacterColors = {
  skin:  new Color3(0.84, 0.64, 0.48),
  shirt: new Color3(0.82, 0.74, 0.58),  // warm off-white shirt
  pants: new Color3(0.44, 0.34, 0.22),  // tan trousers
  boot:  new Color3(0.36, 0.22, 0.10),
  hat:   new Color3(0.62, 0.50, 0.32),  // light tan hat
  belt:  new Color3(0.34, 0.22, 0.10),
};
