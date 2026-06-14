import {
  Scene,
  TransformNode,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  PointLight,
  Mesh,
} from "@babylonjs/core";
import type { Vec3 } from "@shared/types";

/**
 * A campfire prop: a pile of logs, a stone ring, and an animated emissive
 * flame lit by a flickering point light. `update()` drives the flicker so
 * bloom in the post pipeline makes the fire glow.
 */
export class Campfire {
  readonly root: TransformNode;
  private flameOuter: Mesh;
  private flameInner: Mesh;
  private light: PointLight;
  private logMeshes: Mesh[] = [];
  private t = 0;
  private readonly baseIntensity = 1.3;
  private readonly position: Vector3;

  constructor(scene: Scene, position: Vec3) {
    this.position = new Vector3(position.x, position.y, position.z);
    this.root = new TransformNode("campfire", scene);
    this.root.position.copyFrom(this.position);

    const logMat = new StandardMaterial("camp_log", scene);
    logMat.diffuseColor  = new Color3(0.26, 0.16, 0.09);
    logMat.emissiveColor = new Color3(0.10, 0.05, 0.02); // embers glow faintly
    logMat.specularColor = new Color3(0.05, 0.05, 0.05);

    const stoneMat = new StandardMaterial("camp_stone", scene);
    stoneMat.diffuseColor  = new Color3(0.34, 0.32, 0.30);
    stoneMat.emissiveColor = new Color3(0.05, 0.05, 0.05);
    stoneMat.specularColor = new Color3(0.04, 0.04, 0.04);

    // ── Logs — crossed pile of short cylinders ──────────────────────────────
    const logAngles = [0.2, 1.25, 2.3, 3.4];
    for (let i = 0; i < logAngles.length; i++) {
      const log = MeshBuilder.CreateCylinder(`camp_log_${i}`, { diameter: 0.16, height: 1.0, tessellation: 6 }, scene);
      log.parent = this.root;
      log.material = logMat;
      log.rotation.z = Math.PI / 2;          // lie flat
      log.rotation.y = logAngles[i];         // fan out
      log.position.set(0, 0.12, 0);
      log.receiveShadows = true;
      this.logMeshes.push(log);
    }

    // ── Stone ring ──────────────────────────────────────────────────────────
    const stoneCount = 7;
    for (let i = 0; i < stoneCount; i++) {
      const a = (i / stoneCount) * Math.PI * 2;
      const stone = MeshBuilder.CreateBox(`camp_stone_${i}`, { width: 0.22, height: 0.18, depth: 0.22 }, scene);
      stone.parent = this.root;
      stone.material = stoneMat;
      stone.position.set(Math.cos(a) * 0.62, 0.06, Math.sin(a) * 0.62);
      stone.rotation.y = a;
      stone.receiveShadows = true;
      this.logMeshes.push(stone);
    }

    // ── Flame — two stacked emissive cones ──────────────────────────────────
    const flameOuterMat = new StandardMaterial("camp_flameO", scene);
    flameOuterMat.emissiveColor   = new Color3(0.95, 0.35, 0.08); // orange
    flameOuterMat.diffuseColor    = new Color3(0, 0, 0);
    flameOuterMat.disableLighting = true;
    flameOuterMat.alpha = 0.85;

    const flameInnerMat = new StandardMaterial("camp_flameI", scene);
    flameInnerMat.emissiveColor   = new Color3(1.0, 0.85, 0.35); // yellow core
    flameInnerMat.diffuseColor    = new Color3(0, 0, 0);
    flameInnerMat.disableLighting = true;

    this.flameOuter = MeshBuilder.CreateCylinder("camp_flameOuter", { diameterTop: 0, diameterBottom: 0.5, height: 0.9, tessellation: 8 }, scene);
    this.flameOuter.parent = this.root;
    this.flameOuter.material = flameOuterMat;
    this.flameOuter.position.set(0, 0.55, 0);
    this.flameOuter.isPickable = false;

    this.flameInner = MeshBuilder.CreateCylinder("camp_flameInner", { diameterTop: 0, diameterBottom: 0.28, height: 0.6, tessellation: 8 }, scene);
    this.flameInner.parent = this.root;
    this.flameInner.material = flameInnerMat;
    this.flameInner.position.set(0, 0.42, 0);
    this.flameInner.isPickable = false;

    // ── Warm flickering light ───────────────────────────────────────────────
    this.light = new PointLight("camp_light", new Vector3(this.position.x, this.position.y + 0.8, this.position.z), scene);
    this.light.diffuse   = new Color3(1.0, 0.6, 0.28);
    this.light.specular  = new Color3(1.0, 0.7, 0.4);
    this.light.intensity = this.baseIntensity;
    this.light.range     = 16;
  }

  update(deltaSeconds: number): void {
    this.t += deltaSeconds;
    // Layered sines = organic flicker
    const flicker = 1 + Math.sin(this.t * 17) * 0.07 + Math.sin(this.t * 29 + 1.3) * 0.05;
    this.flameOuter.scaling.set(1, flicker, 1);
    this.flameInner.scaling.set(1, flicker * 1.06, 1);
    this.flameOuter.rotation.y += deltaSeconds * 1.5;
    this.light.intensity = this.baseIntensity * (0.82 + (flicker - 1) * 2.4);
  }

  getPosition(): Vector3 {
    return this.position;
  }

  /** Logs/stones cast shadows; the flame does not. */
  getShadowCasters(): Mesh[] {
    return this.logMeshes;
  }

  dispose(): void {
    this.light.dispose();
    this.flameOuter.dispose();
    this.flameInner.dispose();
    this.logMeshes.forEach((m) => m.dispose());
    this.root.dispose();
  }
}
