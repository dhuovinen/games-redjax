import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
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

export class TerrainManager {
  private chunks: Chunk[][] = [];
  private materials: StandardMaterial[];

  private readonly LOAD_RADIUS = 3;

  constructor(private scene: Scene) {
    this.materials = this.buildMaterials();

    for (let row = 0; row < CHUNK_COUNT; row++) {
      this.chunks[row] = [];
      for (let col = 0; col < CHUNK_COUNT; col++) {
        this.chunks[row][col] = { col, row, mesh: null, loaded: false };
      }
    }
  }

  // Three terrain zones for visual variety
  private buildMaterials(): StandardMaterial[] {
    const make = (name: string, r: number, g: number, b: number) => {
      const m = new StandardMaterial(name, this.scene);
      const c = new Color3(r, g, b);
      m.diffuseColor  = c;
      m.emissiveColor = c.scale(0.14); // ground reads in shadow, not pitch-black
      m.specularColor = new Color3(0.03, 0.03, 0.03);
      m.specularPower = 4;
      return m;
    };
    return [
      make("t_lowland",  0.58, 0.46, 0.28),  // warm dusty sand
      make("t_midland",  0.52, 0.32, 0.18),  // reddish clay
      make("t_highland", 0.46, 0.40, 0.32),  // rocky grey-brown
    ];
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

    // Pick material based on average height of chunk center
    const centerH = this.sampleHeight(worldX, worldZ);
    const threshold = MAX_TERRAIN_HEIGHT;
    if (centerH > threshold * 0.55) {
      mesh.material = this.materials[2]; // highland rocky
    } else if (centerH > threshold * 0.25) {
      mesh.material = this.materials[1]; // midland clay
    } else {
      mesh.material = this.materials[0]; // lowland sand
    }

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
    this.materials.forEach((m) => m.dispose());
  }
}
