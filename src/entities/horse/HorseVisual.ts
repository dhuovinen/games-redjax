import {
  Scene,
  TransformNode,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Mesh,
} from "@babylonjs/core";

// Chestnut horse palette — brighter and more vibrant
const BODY    = new Color3(0.72, 0.40, 0.18);  // bright chestnut
const DARK    = new Color3(0.22, 0.11, 0.04);  // rich dark mane / tail / hooves
const SNOUT   = new Color3(0.82, 0.62, 0.42);  // lighter pinkish snout
const LEG     = new Color3(0.64, 0.34, 0.14);  // slightly lighter legs
const BLANKET = new Color3(0.75, 0.18, 0.14);  // red saddle blanket
const SADDLE  = new Color3(0.50, 0.30, 0.12);  // tan leather saddle
const BLAZE   = new Color3(0.96, 0.93, 0.88);  // white nose blaze

export class HorseVisual {
  readonly root: TransformNode;

  // Leg pivot nodes for trot animation
  private flPivot: TransformNode; // front-left
  private frPivot: TransformNode; // front-right
  private blPivot: TransformNode; // back-left
  private brPivot: TransformNode; // back-right

  private elapsedTime = 0;
  private _meshes: Mesh[] = [];

  constructor(scene: Scene) {
    this.root = new TransformNode("horseVis", scene);

    const mat = (
      name: string, color: Color3,
      emissive = 0.22, specPow = 18, specStr = 0.10
    ) => {
      const m = new StandardMaterial(`horse_${name}`, scene);
      m.diffuseColor  = color.clone();
      m.emissiveColor = color.scale(emissive);
      m.specularColor = new Color3(specStr, specStr, specStr);
      m.specularPower = specPow;
      return m;
    };

    const bodyM    = mat("body",    BODY,    0.22, 32, 0.16); // coat — slight animal sheen
    const darkM    = mat("dark",    DARK,    0.18,  8, 0.04); // mane/tail — matte hair
    const snoutM   = mat("snout",   SNOUT,   0.28, 18, 0.10); // soft skin
    const legM     = mat("leg",     LEG,     0.22, 28, 0.14);
    const blanketM = mat("blanket", BLANKET, 0.42,  6, 0.04); // vivid red fabric
    const saddleM  = mat("saddle",  SADDLE,  0.20, 60, 0.28); // polished leather
    const blazeM   = mat("blaze",   BLAZE,   0.45, 10, 0.08); // white pops bright

    const box = (
      name: string, w: number, h: number, d: number,
      parent: TransformNode, px: number, py: number, pz: number,
      material: StandardMaterial
    ): Mesh => {
      const m = MeshBuilder.CreateBox(`horse_${name}`, { width: w, height: h, depth: d }, scene);
      m.parent = parent;
      m.position.set(px, py, pz);
      m.material = material;
      m.receiveShadows = true;
      this._meshes.push(m);
      return m;
    };

    // ── Body ──────────────────────────────────────────────────────────────
    box("body", 0.88, 0.80, 1.88, this.root, 0, 1.10, 0, bodyM);

    // ── Neck (angled forward/up from body front) ───────────────────────────
    box("neck", 0.36, 0.65, 0.36, this.root, 0, 1.50, 0.84, bodyM);

    // ── Head ──────────────────────────────────────────────────────────────
    box("head",  0.40, 0.52, 0.62, this.root, 0, 1.82, 1.18, bodyM);
    box("snout", 0.30, 0.26, 0.36, this.root, 0, 1.64, 1.38, snoutM);

    // Ears
    box("earL", 0.08, 0.18, 0.08, this.root, -0.14, 2.08, 1.14, bodyM);
    box("earR", 0.08, 0.18, 0.08, this.root,  0.14, 2.08, 1.14, bodyM);

    // ── Mane (runs along top of neck/back) ───────────────────────────────
    box("mane", 0.10, 0.44, 0.88, this.root, 0, 1.80, 0.58, darkM);

    // ── Tail ──────────────────────────────────────────────────────────────
    box("tail", 0.16, 0.52, 0.16, this.root, 0, 1.38, -0.98, darkM);

    // ── White nose blaze ─────────────────────────────────────────────────
    box("blaze", 0.10, 0.30, 0.02, this.root, 0, 1.80, 1.50, blazeM);

    // ── Saddle blanket (bright red, slightly wider than body) ─────────────
    box("blanket", 0.92, 0.08, 1.05, this.root, 0, 1.54, 0, blanketM);

    // ── Saddle ────────────────────────────────────────────────────────────
    box("saddle",  0.78, 0.15, 0.66, this.root, 0,  1.65, 0,     saddleM);
    box("pommel",  0.14, 0.16, 0.14, this.root, 0,  1.76, 0.28,  saddleM);  // front horn
    box("cantle",  0.22, 0.14, 0.12, this.root, 0,  1.76, -0.28, saddleM);  // rear rise

    // ── Legs (4 pivots at hip/shoulder height y=0.70) ─────────────────────
    // Each pivot is at hoof level so the whole leg rotates naturally
    // pivot at hip (y=0.70), mesh hangs down with center at y=-0.35

    const legPivotY = 0.70;
    const hipFZ =  0.70; // front legs z
    const hipBZ = -0.70; // back legs z
    const hipX  =  0.27; // lateral offset

    this.flPivot = new TransformNode("horse_fl", scene);
    this.flPivot.parent = this.root;
    this.flPivot.position.set(-hipX, legPivotY, hipFZ);
    box("fl", 0.22, 0.70, 0.22, this.flPivot, 0, -0.35, 0, legM);
    box("flH", 0.24, 0.10, 0.24, this.flPivot, 0, -0.72, 0, darkM); // hoof

    this.frPivot = new TransformNode("horse_fr", scene);
    this.frPivot.parent = this.root;
    this.frPivot.position.set(hipX, legPivotY, hipFZ);
    box("fr", 0.22, 0.70, 0.22, this.frPivot, 0, -0.35, 0, legM);
    box("frH", 0.24, 0.10, 0.24, this.frPivot, 0, -0.72, 0, darkM);

    this.blPivot = new TransformNode("horse_bl", scene);
    this.blPivot.parent = this.root;
    this.blPivot.position.set(-hipX, legPivotY, hipBZ);
    box("bl", 0.22, 0.70, 0.22, this.blPivot, 0, -0.35, 0, legM);
    box("blH", 0.24, 0.10, 0.24, this.blPivot, 0, -0.72, 0, darkM);

    this.brPivot = new TransformNode("horse_br", scene);
    this.brPivot.parent = this.root;
    this.brPivot.position.set(hipX, legPivotY, hipBZ);
    box("br", 0.22, 0.70, 0.22, this.brPivot, 0, -0.35, 0, legM);
    box("brH", 0.24, 0.10, 0.24, this.brPivot, 0, -0.72, 0, darkM);
  }

  /** groundY = actual terrain height under horse */
  sync(physX: number, groundY: number, physZ: number, rotY: number): void {
    this.root.position.set(physX, groundY, physZ);
    this.root.rotation.y = rotY;
  }

  animate(isMoving: boolean, isGalloping: boolean, deltaSeconds: number): void {
    this.elapsedTime += deltaSeconds;

    const amp  = isMoving ? (isGalloping ? 0.75 : 0.40) : 0;
    const freq = this.elapsedTime * (isGalloping ? 10 : 6);

    // Trot: diagonal pairs swing together (FL+BR, FR+BL)
    this.flPivot.rotation.x =  Math.sin(freq) * amp;
    this.brPivot.rotation.x =  Math.sin(freq) * amp;
    this.frPivot.rotation.x = -Math.sin(freq) * amp;
    this.blPivot.rotation.x = -Math.sin(freq) * amp;
  }

  getMeshes(): Mesh[] {
    return this._meshes;
  }

  dispose(): void {
    this._meshes.forEach((m) => m.dispose());
    this.root.dispose();
  }
}
