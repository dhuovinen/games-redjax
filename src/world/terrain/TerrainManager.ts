import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Color4,
  VertexBuffer,
  Mesh,
} from "@babylonjs/core";
import {
  WORLD_SIZE_METERS,
  TERRAIN_HEIGHTMAP_RESOLUTION,
  MAX_TERRAIN_HEIGHT,
  CHUNK_COUNT,
  CHUNK_SIZE,
} from "@shared/constants";

interface Chunk {
  col: number;
  row: number;
  mesh: Mesh | null;
  loaded: boolean;
}

// Terrain zone colors blended per-vertex by height & slope
const SAND = new Color3(0.60, 0.48, 0.30); // warm dusty lowland sand
const CLAY = new Color3(0.54, 0.33, 0.18); // reddish midland clay
const ROCK = new Color3(0.46, 0.41, 0.34); // grey-brown highland rock
const SLOPE_ROCK = new Color3(0.38, 0.34, 0.30); // exposed cliff rock on steep faces

export class TerrainManager {
  private chunks: Chunk[][] = [];
  private material: StandardMaterial;

  private readonly LOAD_RADIUS = 3;

  constructor(private scene: Scene) {
    this.material = this.buildMaterial();

    for (let row = 0; row < CHUNK_COUNT; row++) {
      this.chunks[row] = [];
      for (let col = 0; col < CHUNK_COUNT; col++) {
        this.chunks[row][col] = { col, row, mesh: null, loaded: false };
      }
    }
  }

  // Single material — surface variety comes from per-vertex colors
  private buildMaterial(): StandardMaterial {
    const m = new StandardMaterial("terrain", this.scene);
    m.diffuseColor  = new Color3(1, 1, 1); // multiplied by vertex color
    m.emissiveColor = new Color3(0.05, 0.045, 0.035); // reads in shadow, not pitch-black
    m.specularColor = new Color3(0.02, 0.02, 0.02);
    m.specularPower = 4;
    return m;
  }

  /** Per-vertex terrain color: zone by height, rock on steep slopes, plus noise. */
  private vertexColor(height: number, slope: number, wx: number, wz: number): Color4 {
    const hN = Math.min(1, Math.max(0, height / MAX_TERRAIN_HEIGHT));

    // Height zones: sand → clay → rock
    let c: Color3;
    if (hN < 0.30) {
      c = Color3.Lerp(SAND, CLAY, hN / 0.30);
    } else if (hN < 0.60) {
      c = Color3.Lerp(CLAY, ROCK, (hN - 0.30) / 0.30);
    } else {
      c = ROCK;
    }

    // Steep faces expose darker rock regardless of height
    const steep = Math.min(1, Math.max(0, (slope - 0.35) / 0.45));
    c = Color3.Lerp(c, SLOPE_ROCK, steep);

    // Deterministic hash noise breaks up flat banding (±6%)
    const n = this.hashNoise(wx, wz) * 0.12 - 0.06;
    return new Color4(
      Math.min(1, c.r + n),
      Math.min(1, c.g + n),
      Math.min(1, c.b + n),
      1
    );
  }

  private hashNoise(x: number, z: number): number {
    const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
    return s - Math.floor(s);
  }

  update(playerPosition: { x: number; y: number; z: number }): void {
    const playerCol = Math.floor((playerPosition.x + WORLD_SIZE_METERS / 2) / CHUNK_SIZE);
    const playerRow = Math.floor((playerPosition.z + WORLD_SIZE_METERS / 2) / CHUNK_SIZE);

    for (let row = 0; row < CHUNK_COUNT; row++) {
      for (let col = 0; col < CHUNK_COUNT; col++) {
        const dist  = Math.abs(col - playerCol) + Math.abs(row - playerRow);
        const chunk = this.chunks[row][col];

        if (dist <= this.LOAD_RADIUS && !chunk.loaded) {
          this.loadChunk(chunk);
        } else if (dist > this.LOAD_RADIUS + 1 && chunk.loaded) {
          this.unloadChunk(chunk);
        }
      }
    }
  }

  private loadChunk(chunk: Chunk): void {
    const worldX = chunk.col * CHUNK_SIZE - WORLD_SIZE_METERS / 2 + CHUNK_SIZE / 2;
    const worldZ = chunk.row * CHUNK_SIZE - WORLD_SIZE_METERS / 2 + CHUNK_SIZE / 2;
    const subdivisions = Math.floor(TERRAIN_HEIGHTMAP_RESOLUTION / CHUNK_COUNT);

    const mesh = MeshBuilder.CreateGround(
      `chunk_${chunk.col}_${chunk.row}`,
      { width: CHUNK_SIZE, height: CHUNK_SIZE, subdivisions, updatable: true },
      this.scene
    );
    mesh.position.set(worldX, 0, worldZ);
    mesh.receiveShadows = true;
    mesh.isPickable = false;

    this.applyProceduralHeight(mesh, worldX, worldZ);
    mesh.material = this.material;

    chunk.mesh = mesh;
    chunk.loaded = true;
  }

  private unloadChunk(chunk: Chunk): void {
    chunk.mesh?.dispose();
    chunk.mesh  = null;
    chunk.loaded = false;
  }

  private applyProceduralHeight(mesh: Mesh, originX: number, originZ: number): void {
    const positions = mesh.getVerticesData("position");
    if (!positions) return;

    for (let i = 0; i < positions.length; i += 3) {
      const wx = positions[i]     + originX;
      const wz = positions[i + 2] + originZ;
      positions[i + 1] = this.sampleHeight(wx, wz);
    }

    mesh.updateVerticesData("position", positions);
    mesh.createNormals(true);

    // Per-vertex colors using freshly-computed normals for slope
    const normals = mesh.getVerticesData("normal");
    if (normals) {
      const colors = new Array<number>((positions.length / 3) * 4);
      for (let i = 0, c = 0; i < positions.length; i += 3, c += 4) {
        const wx = positions[i]     + originX;
        const wz = positions[i + 2] + originZ;
        const slope = 1 - normals[i + 1]; // normal.y: 1 flat, 0 vertical
        const col = this.vertexColor(positions[i + 1], slope, wx, wz);
        colors[c]     = col.r;
        colors[c + 1] = col.g;
        colors[c + 2] = col.b;
        colors[c + 3] = col.a;
      }
      mesh.setVerticesData(VertexBuffer.ColorKind, colors);
      mesh.hasVertexAlpha = false;
    }
  }

  /**
   * Multi-octave height function. The interface is stable — swap this
   * implementation with a heightmap lookup once art assets are ready.
   */
  sampleHeight(wx: number, wz: number): number {
    const s = 0.0028;
    // Octave 1 — rolling hills
    let h = Math.sin(wx * s) * Math.cos(wz * s) * MAX_TERRAIN_HEIGHT * 0.48;
    // Octave 2 — medium ridges
    h += Math.sin(wx * s * 3.1 + 1.3) * Math.cos(wz * s * 2.7 + 0.6) * MAX_TERRAIN_HEIGHT * 0.20;
    // Octave 3 — small bumps
    h += Math.sin(wx * s * 9.8 + 0.4) * Math.cos(wz * s * 8.3 + 2.1) * MAX_TERRAIN_HEIGHT * 0.07;
    // Octave 4 — micro-detail
    h += Math.sin(wx * s * 22  + 2.7) * Math.cos(wz * s * 19  + 1.5) * MAX_TERRAIN_HEIGHT * 0.02;
    return Math.max(0.5, h + MAX_TERRAIN_HEIGHT * 0.12);
  }

  dispose(): void {
    for (const row of this.chunks) {
      for (const chunk of row) this.unloadChunk(chunk);
    }
    this.material.dispose();
  }
}
