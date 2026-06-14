import {
  Scene,
  Mesh,
  MeshBuilder,
  Vector3,
  KeyboardEventTypes,
} from "@babylonjs/core";
import { HorseVisual } from "./HorseVisual";
import { HORSE_MOUNT_DISTANCE } from "@shared/constants";
import type { HorseBondingSystem } from "@core/horse/HorseBondingSystem";
import type { TerrainManager } from "@world/terrain/TerrainManager";
import type { PlayerController } from "@entities/player/PlayerController";

const HORSE_WALK_SPEED    = 7;
const HORSE_GALLOP_SPEED  = 17;
const HORSE_FOLLOW_SPEED  = 5;
const HORSE_FOLLOW_STOP   = 4;

export class HorseController {
  /** Invisible root — carries world position */
  readonly mesh: Mesh;
  readonly visual: HorseVisual;

  private isMounted = false;
  private isGalloping = false;
  private moving = false;
  private keys = new Set<string>();

  constructor(
    private scene: Scene,
    private bonding: HorseBondingSystem,
    private terrain: TerrainManager,
    private player: PlayerController
  ) {
    this.mesh = MeshBuilder.CreateBox("horseRoot", { width: 0.1, height: 0.1, depth: 0.1 }, scene);
    this.mesh.isVisible = false;
    this.mesh.isPickable = false;
    this.mesh.position.set(6, 2, 0);

    this.visual = new HorseVisual(scene);

    this.bindInput();
  }

  private bindInput(): void {
    this.scene.onKeyboardObservable.add((info) => {
      const key = info.event.code;
      if (info.type === KeyboardEventTypes.KEYDOWN) {
        this.keys.add(key);
        if (key === "KeyE") this.tryMountDismount();
      } else {
        this.keys.delete(key);
      }
    });
  }

  private tryMountDismount(): void {
    if (this.isMounted) {
      this.dismount();
      return;
    }
    const dist = Vector3.Distance(this.player.getPosition(), this.mesh.position);
    if (dist <= HORSE_MOUNT_DISTANCE) {
      this.mount();
    }
  }

  private mount(): void {
    this.isMounted = true;
    this.player.setMounted(true);
  }

  private dismount(): void {
    this.isMounted = false;
    this.player.setMounted(false);
    // Drop player beside horse
    this.player.mesh.position.set(
      this.mesh.position.x + 1.5,
      this.mesh.position.y,
      this.mesh.position.z
    );
  }

  update(deltaSeconds: number): void {
    if (this.isMounted) {
      this.updateMounted(deltaSeconds);
      this.bonding.onRideUpdate(deltaSeconds);
    } else {
      this.updateFollowing(deltaSeconds);
    }

    const groundY = this.terrain.sampleHeight(this.mesh.position.x, this.mesh.position.z);
    this.mesh.position.y = groundY + 0.05;

    this.visual.sync(
      this.mesh.position.x,
      groundY,
      this.mesh.position.z,
      this.mesh.rotation.y
    );

    const isMoving = this.isMounted
      ? (this.keys.has("KeyW") || this.keys.has("ArrowUp")    ||
         this.keys.has("KeyS") || this.keys.has("ArrowDown")  ||
         this.keys.has("KeyA") || this.keys.has("ArrowLeft")  ||
         this.keys.has("KeyD") || this.keys.has("ArrowRight"))
      : Vector3.Distance(this.player.getPosition(), this.mesh.position) > HORSE_FOLLOW_STOP;

    this.moving = isMoving;
    this.visual.animate(isMoving, this.isGalloping, deltaSeconds);
  }

  private updateMounted(deltaSeconds: number): void {
    this.isGalloping = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    const speed = this.isGalloping ? HORSE_GALLOP_SPEED : HORSE_WALK_SPEED;

    const camera = this.scene.activeCamera;
    if (!camera) return;

    const forward = camera.getForwardRay().direction;
    forward.y = 0;
    if (forward.lengthSquared() < 0.001) return;
    forward.normalize();

    const right = Vector3.Cross(forward, Vector3.Up()).normalize();
    const move  = Vector3.Zero();

    if (this.keys.has("KeyW") || this.keys.has("ArrowUp"))    move.addInPlace(forward);
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown"))  move.subtractInPlace(forward);
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft"))  move.subtractInPlace(right);
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) move.addInPlace(right);

    if (move.lengthSquared() > 0) {
      move.normalize().scaleInPlace(speed * deltaSeconds);
      this.mesh.position.addInPlace(move);
      this.mesh.rotation.y = Math.atan2(move.x, move.z);
    }

    // Move player root to horse saddle position and pass horse facing to visual
    this.player.mesh.position.set(
      this.mesh.position.x,
      this.mesh.position.y + 1.1,
      this.mesh.position.z
    );
    this.player.setMountedRotation(this.mesh.rotation.y);
  }

  private updateFollowing(deltaSeconds: number): void {
    const playerPos = this.player.getPosition();
    const dist = Vector3.Distance(playerPos, this.mesh.position);

    if (dist > HORSE_FOLLOW_STOP) {
      const dir = playerPos.subtract(this.mesh.position).normalize();
      this.mesh.position.addInPlace(dir.scale(HORSE_FOLLOW_SPEED * deltaSeconds));
      this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
    }
  }

  getMountStatus(): boolean {
    return this.isMounted;
  }

  isMovingNow(): boolean {
    return this.moving;
  }

  isGallopingNow(): boolean {
    return this.isMounted && this.isGalloping && this.moving;
  }

  getPosition(): Vector3 {
    return this.mesh.position.clone();
  }
}
