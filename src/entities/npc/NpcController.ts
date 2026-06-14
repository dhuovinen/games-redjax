import {
  Scene,
  Mesh,
  MeshBuilder,
  Vector3,
  StandardMaterial,
  Color3,
} from "@babylonjs/core";
import { bus } from "@shared/EventBus";
import { PlayerVisual, BANDIT_COLORS, TRAVELER_COLORS } from "@entities/player/PlayerVisual";
import type { Vec3 } from "@shared/types";

export type NpcRole = "bandit" | "traveler";

const NPC_CHASE_SPEED   = 3.2;
const NPC_CHASE_RANGE   = 28;
const NPC_STOP_RANGE    = 2.5;
const NPC_ATTACK_RANGE  = 3.2;
const NPC_ATTACK_INTERVAL = 1.4; // seconds between strikes
const NPC_ATTACK_DAMAGE = 7;

export class NpcController {
  readonly id: string;
  /** Invisible root for position; real visuals are in `visual` */
  readonly mesh: Mesh;
  readonly visual: PlayerVisual;
  readonly isInnocent: boolean;

  private isAlive = true;
  private facingAngle = 0;
  private marker: Mesh | null = null;
  private attackTimer = NPC_ATTACK_INTERVAL;
  private attackPulse = 0; // brief telegraph after a strike

  constructor(
    scene: Scene,
    id: string,
    private role: NpcRole,
    spawnPosition: Vec3
  ) {
    this.id = id;
    this.isInnocent = role === "traveler";

    this.mesh = MeshBuilder.CreateBox(`npcRoot_${id}`, { width: 0.4, height: 0.1, depth: 0.4 }, scene);
    this.mesh.isVisible = false;
    this.mesh.isPickable = false;
    this.mesh.position.set(spawnPosition.x, spawnPosition.y + 1, spawnPosition.z);

    const colors = role === "bandit" ? BANDIT_COLORS : TRAVELER_COLORS;
    // Pass npcId as metadata on each body-part mesh so raycasts find it
    this.visual = new PlayerVisual(scene, id, colors, { npcId: id, role });
    this.visual.sync(spawnPosition.x, spawnPosition.y, spawnPosition.z, 0);

    // Floating marker: red for hostile bandits, gold for interactable travelers
    this.marker = MeshBuilder.CreateBox(`marker_${id}`, { width: 0.20, height: 0.20, depth: 0.20 }, scene);
    const markerMat = new StandardMaterial(`markerMat_${id}`, scene);
    markerMat.emissiveColor = role === "bandit"
      ? new Color3(0.95, 0.10, 0.10)
      : new Color3(0.95, 0.78, 0.20);
    markerMat.disableLighting = true;
    this.marker.material = markerMat;
    this.marker.isPickable = false;
    this.marker.rotation.x = Math.PI / 4; // diamond orientation
    this.marker.position.set(spawnPosition.x, spawnPosition.y + 2.4, spawnPosition.z);
  }

  update(deltaSeconds: number, playerPosition: Vector3, terrainSampleHeight: (x: number, z: number) => number): void {
    if (!this.isAlive) return;

    // Travelers are stationary — just bob their marker and wait for the player
    if (this.role !== "bandit") {
      if (this.marker) this.marker.rotation.y += 1.2 * deltaSeconds;
      return;
    }

    const dist = Vector3.Distance(playerPosition, this.mesh.position);

    // Face & approach the player while within awareness range
    let isMoving = false;
    if (dist < NPC_CHASE_RANGE) {
      const dir = playerPosition.subtract(this.mesh.position);
      dir.y = 0;
      dir.normalize();
      this.facingAngle = Math.atan2(dir.x, dir.z);
      if (dist > NPC_STOP_RANGE) {
        this.mesh.position.addInPlace(dir.scale(NPC_CHASE_SPEED * deltaSeconds));
        isMoving = true;
      }
    }

    // Strike when in melee range
    this.attackTimer -= deltaSeconds;
    if (this.attackPulse > 0) this.attackPulse -= deltaSeconds;
    if (dist <= NPC_ATTACK_RANGE && this.attackTimer <= 0) {
      this.attackTimer = NPC_ATTACK_INTERVAL;
      this.attackPulse = 0.25;
      bus.emit("npc:attackedPlayer", { damage: NPC_ATTACK_DAMAGE });
    }

    const groundY = terrainSampleHeight(this.mesh.position.x, this.mesh.position.z);
    this.mesh.position.y = groundY + 0.05;
    this.visual.sync(this.mesh.position.x, groundY, this.mesh.position.z, this.facingAngle);

    if (this.marker) {
      this.marker.position.set(this.mesh.position.x, groundY + 2.5, this.mesh.position.z);
      this.marker.rotation.y += 1.5 * deltaSeconds;
      // Pulse larger right after a strike as a visible attack tell
      const s = this.attackPulse > 0 ? 1.8 : 1.0;
      this.marker.scaling.set(s, s, s);
    }

    this.visual.animate(isMoving, 0.5, deltaSeconds);
  }

  kill(): void {
    if (!this.isAlive) return;
    this.isAlive = false;
    this.visual.setVisible(false);
    if (this.marker) this.marker.isVisible = false;
    bus.emit("combat:npcKilled", { npcId: this.id, isInnocent: this.isInnocent });
  }

  getIsAlive(): boolean {
    return this.isAlive;
  }

  dispose(): void {
    this.visual.dispose();
    this.mesh.dispose();
    this.marker?.dispose();
  }
}
