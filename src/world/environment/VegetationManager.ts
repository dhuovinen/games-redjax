import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  TransformNode,
  Mesh,
} from "@babylonjs/core";
import { CHUNK_SIZE, CHUNK_COUNT, WORLD_SIZE_METERS } from "@shared/constants";
import type { TerrainManager } from "@world/terrain/TerrainManager";

// Per-chunk vegetation state
interface VegChunk {
  col: number;
  row: number;
  node: TransformNode | null;
  loaded: boolean;
}

const LOAD_RADIUS = 3; // mirror TerrainManager

// Template meshes (cloned per instance)
interface VegTemplates {
  treeTrunk: Mesh;
  treeFoliage: Mesh;
  cactusBody: Mesh;
  cactusArm: Mesh;
  rock: Mesh;
  shrub: Mesh;
}

export class VegetationManager {
  private chunks: VegChunk[][] = [];
  private templates: VegTemplates;

  constructor(private scene: Scene, private terrain: TerrainManager) {
    this.templates = this.buildTemplates();

    for (let row = 0; row < CHUNK_COUNT; row++) {
      this.chunks[row] = [];
      for (let col = 0; col < CHUNK_COUNT; col++) {
        this.chunks[row][col] = { col, row, node: null, loaded: false };
      }
    }

  }

  private buildTemplates(): VegTemplates {
    const mat = (name: string, r: number, g: number, b: number, emissive = 0.18) => {
      const m = new StandardMaterial(`veg_${name}`, this.scene);
      const c = new Color3(r, g, b);
      m.diffuseColor  = c;
      m.emissiveColor = c.scale(emissive);
      m.specularColor = new Color3(0.04, 0.04, 0.04);
      m.specularPower = 6;
      return m;
    };

    const treeTrunkM   = mat("treeTrunk",   0.28, 0.18, 0.10, 0.15);
    const treeFoliageM = mat("treeFoliage", 0.20, 0.42, 0.16, 0.22); // foliage pops green
    const cactusM      = mat("cactus",      0.22, 0.48, 0.20, 0.28); // vivid cactus green
    const rockM        = mat("rock",        0.44, 0.40, 0.36, 0.12);
    const shrubM       = mat("shrub",       0.38, 0.32, 0.18, 0.18);

    // Cylinder trunk — low tessellation for low-poly western feel
    const treeTrunk = MeshBuilder.CreateCylinder("t_trunk", { diameter: 0.32, height: 1.0, tessellation: 6 }, this.scene);
    treeTrunk.material = treeTrunkM;
    treeTrunk.isVisible = false;
    treeTrunk.isPickable = false;

    // Sphere foliage — organic silhouette
    const treeFoliage = MeshBuilder.CreateSphere("t_foliage", { diameter: 1.75, segments: 5 }, this.scene);
    treeFoliage.material = treeFoliageM;
    treeFoliage.isVisible = false;
    treeFoliage.isPickable = false;

    // Cylinder cactus body
    const cactusBody = MeshBuilder.CreateCylinder("t_cactus", { diameter: 0.26, height: 1.8, tessellation: 6 }, this.scene);
    cactusBody.material = cactusM;
    cactusBody.isVisible = false;
    cactusBody.isPickable = false;

    const cactusArm = MeshBuilder.CreateBox("t_cactusArm", { width: 0.40, height: 0.22, depth: 0.22 }, this.scene);
    cactusArm.material = cactusM;
    cactusArm.isVisible = false;
    cactusArm.isPickable = false;

    const rock = MeshBuilder.CreateBox("t_rock", { width: 0.9, height: 0.55, depth: 0.75 }, this.scene);
    rock.material = rockM;
    rock.isVisible = false;
    rock.isPickable = false;

    const shrub = MeshBuilder.CreateBox("t_shrub", { width: 0.7, height: 0.35, depth: 0.7 }, this.scene);
    shrub.material = shrubM;
    shrub.isVisible = false;
    shrub.isPickable = false;

    return { treeTrunk, treeFoliage, cactusBody, cactusArm, rock, shrub };
  }

  update(playerPos: Vector3): void {
    const playerCol = Math.floor((playerPos.x + WORLD_SIZE_METERS / 2) / CHUNK_SIZE);
    const playerRow = Math.floor((playerPos.z + WORLD_SIZE_METERS / 2) / CHUNK_SIZE);

    for (let row = 0; row < CHUNK_COUNT; row++) {
      for (let col = 0; col < CHUNK_COUNT; col++) {
        const dist = Math.abs(col - playerCol) + Math.abs(row - playerRow);
        const chunk = this.chunks[row][col];

        if (dist <= LOAD_RADIUS && !chunk.loaded) {
          this.loadChunk(chunk);
        } else if (dist > LOAD_RADIUS + 1 && chunk.loaded) {
          this.unloadChunk(chunk);
        }
      }
    }
  }

  private loadChunk(chunk: VegChunk): void {
    const originX = chunk.col * CHUNK_SIZE - WORLD_SIZE_METERS / 2;
    const originZ = chunk.row * CHUNK_SIZE - WORLD_SIZE_METERS / 2;

    const node = new TransformNode(`veg_${chunk.col}_${chunk.row}`, this.scene);
    chunk.node = node;
    chunk.loaded = true;

    // Re-seed rng per chunk for deterministic placement
    const chunkSeed = chunk.col * 1000 + chunk.row;
    const r = this.makeChunkRng(chunkSeed);

    // Cacti (8–12 per chunk) — the dominant western flora
    const cactusCount = 8 + Math.floor(r() * 5);
    for (let i = 0; i < cactusCount; i++) {
      const wx = originX + r() * CHUNK_SIZE;
      const wz = originZ + r() * CHUNK_SIZE;
      const gy = this.terrain.sampleHeight(wx, wz);
      this.placeCactus(node, wx, gy, wz, r);
    }

    // Trees (2–5 per chunk) — sparse
    const treeCount = 2 + Math.floor(r() * 4);
    for (let i = 0; i < treeCount; i++) {
      const wx = originX + r() * CHUNK_SIZE;
      const wz = originZ + r() * CHUNK_SIZE;
      const gy = this.terrain.sampleHeight(wx, wz);
      this.placeTree(node, wx, gy, wz, r);
    }

    // Rocks (6–10 per chunk)
    const rockCount = 6 + Math.floor(r() * 5);
    for (let i = 0; i < rockCount; i++) {
      const wx = originX + r() * CHUNK_SIZE;
      const wz = originZ + r() * CHUNK_SIZE;
      const gy = this.terrain.sampleHeight(wx, wz);
      this.placeRock(node, wx, gy, wz, r);
    }

    // Shrubs (10–16 per chunk)
    const shrubCount = 10 + Math.floor(r() * 7);
    for (let i = 0; i < shrubCount; i++) {
      const wx = originX + r() * CHUNK_SIZE;
      const wz = originZ + r() * CHUNK_SIZE;
      const gy = this.terrain.sampleHeight(wx, wz);
      this.placeShrub(node, wx, gy, wz, r);
    }
  }

  private placeCactus(parent: TransformNode, wx: number, gy: number, wz: number, r: () => number): void {
    const scale = 0.7 + r() * 0.8;
    const rotY  = r() * Math.PI * 2;

    const body = this.templates.cactusBody.createInstance(`ci_${wx.toFixed(0)}_${wz.toFixed(0)}`);
    body.parent = parent;
    body.position.set(wx, gy + 0.9 * scale, wz);
    body.scaling.setAll(scale);
    body.rotation.y = rotY;
    body.isPickable = false;

    // Arms (50% chance each side)
    if (r() > 0.5) {
      const arm = this.templates.cactusArm.createInstance(`ca_l_${wx.toFixed(0)}`);
      arm.parent = parent;
      arm.position.set(wx - 0.35 * scale, gy + 0.9 * scale, wz);
      arm.scaling.setAll(scale);
      arm.isPickable = false;
    }
    if (r() > 0.5) {
      const arm = this.templates.cactusArm.createInstance(`ca_r_${wx.toFixed(0)}`);
      arm.parent = parent;
      arm.position.set(wx + 0.35 * scale, gy + 0.9 * scale, wz);
      arm.scaling.setAll(scale);
      arm.isPickable = false;
    }
  }

  private placeTree(parent: TransformNode, wx: number, gy: number, wz: number, r: () => number): void {
    const scale = 0.8 + r() * 1.2;
    const rotY  = r() * Math.PI * 2;

    const trunk = this.templates.treeTrunk.createInstance(`tt_${wx.toFixed(0)}_${wz.toFixed(0)}`);
    trunk.parent = parent;
    trunk.position.set(wx, gy + 0.5 * scale, wz);
    trunk.scaling.setAll(scale);
    trunk.rotation.y = rotY;
    trunk.isPickable = false;

    const foliage = this.templates.treeFoliage.createInstance(`tf_${wx.toFixed(0)}_${wz.toFixed(0)}`);
    foliage.parent = parent;
    foliage.position.set(wx, gy + (1.0 + 0.7) * scale, wz);
    foliage.scaling.setAll(scale);
    foliage.isPickable = false;
  }

  private placeRock(parent: TransformNode, wx: number, gy: number, wz: number, r: () => number): void {
    const scaleX = 0.5 + r() * 1.2;
    const scaleY = 0.4 + r() * 0.6;
    const scaleZ = 0.5 + r() * 1.0;

    const rock = this.templates.rock.createInstance(`rk_${wx.toFixed(0)}_${wz.toFixed(0)}`);
    rock.parent = parent;
    rock.position.set(wx, gy + 0.28 * scaleY, wz);
    rock.scaling.set(scaleX, scaleY, scaleZ);
    rock.rotation.y = r() * Math.PI * 2;
    rock.isPickable = false;
  }

  private placeShrub(parent: TransformNode, wx: number, gy: number, wz: number, r: () => number): void {
    const scale = 0.4 + r() * 0.7;

    const shrub = this.templates.shrub.createInstance(`sh_${wx.toFixed(0)}_${wz.toFixed(0)}`);
    shrub.parent = parent;
    shrub.position.set(wx, gy + 0.18 * scale, wz);
    shrub.scaling.setAll(scale);
    shrub.rotation.y = r() * Math.PI * 2;
    shrub.isPickable = false;
  }

  private unloadChunk(chunk: VegChunk): void {
    chunk.node?.dispose();
    chunk.node = null;
    chunk.loaded = false;
  }

  /** Deterministic per-chunk PRNG based on chunk seed */
  private makeChunkRng(seed: number): () => number {
    let s = seed * 1664525 + 1013904223;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) | 0;
      return (s >>> 0) / 4294967296;
    };
  }

  dispose(): void {
    for (const row of this.chunks) {
      for (const chunk of row) this.unloadChunk(chunk);
    }
    Object.values(this.templates).forEach((t) => (t as Mesh).dispose());
  }
}
