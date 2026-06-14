import {
  Scene,
  Mesh,
  MeshBuilder,
  ArcRotateCamera,
  Vector3,
  KeyboardEventTypes,
} from "@babylonjs/core";
import { bus } from "@shared/EventBus";
import {
  PLAYER_MOVE_SPEED,
  PLAYER_SPRINT_SPEED,
  PLAYER_MAX_HEALTH,
  PLAYER_COLLISION_RADIUS,
} from "@shared/constants";
import { PlayerVisual } from "./PlayerVisual";
import type { DeadEyeSystem } from "@core/combat/DeadEyeSystem";
import type { TerrainManager } from "@world/terrain/TerrainManager";
import type { CollisionSystem } from "@core/physics/CollisionSystem";

export class PlayerController {
  /** Invisible root mesh — used for position tracking and camera target only */
  readonly mesh: Mesh;
  readonly visual: PlayerVisual;

  private camera: ArcRotateCamera;
  private keys = new Set<string>();
  private health = PLAYER_MAX_HEALTH;
  private isMounted = false;
  private isMoving = false;
  private currentSpeed = 0;
  private facingAngle = 0;
  private mountedRotY = 0; // updated each frame by HorseController

  constructor(
    private scene: Scene,
    private deadEye: DeadEyeSystem,
    private terrain: TerrainManager,
    private collision: CollisionSystem
  ) {
    // Invisible thin slab — sole purpose is to carry position/rotation for camera
    this.mesh = MeshBuilder.CreateBox("playerRoot", { width: 0.4, height: 0.1, depth: 0.4 }, scene);
    this.mesh.isVisible = false;
    this.mesh.isPickable = false;
    this.mesh.position.set(0, 5, 0);

    this.visual = new PlayerVisual(scene);

    // Third-person camera targets the invisible root
    this.camera = new ArcRotateCamera(
      "playerCam",
      -Math.PI / 2,
      Math.PI / 3,
      8,
      this.mesh.position,
      scene
    );
    this.camera.lowerRadiusLimit = 2;
    this.camera.upperRadiusLimit = 15;
    this.camera.lowerBetaLimit = 0.1;
    this.camera.upperBetaLimit = Math.PI / 2.1;
    this.camera.attachControl(scene.getEngine().getRenderingCanvas()!, true);

    this.bindInput();
  }

  private bindInput(): void {
    this.scene.onKeyboardObservable.add((info) => {
      const key = info.event.code;
      if (info.type === KeyboardEventTypes.KEYDOWN) {
        this.keys.add(key);
        if (key === "KeyQ") this.deadEye.toggle();
      } else {
        this.keys.delete(key);
      }
    });
  }

  /** Called every frame by HorseController so the rider faces the horse's direction. */
  setMountedRotation(rotY: number): void {
    this.mountedRotY = rotY;
  }

  update(deltaSeconds: number): void {
    if (this.isMounted) {
      // Horse controller has already moved this.mesh.position to sit above the horse.
      // horse.mesh.y = groundY + 0.05, player.mesh.y = horse + 1.1 = groundY + 1.15
      const terrainY = this.mesh.position.y - 1.15;

      // Place visual root so the player's belt sits at saddle height (~1.65 m above ground)
      this.visual.sync(
        this.mesh.position.x,
        terrainY + 0.98,
        this.mesh.position.z,
        this.mountedRotY
      );

      // Keep camera target at rider head height
      this.camera.target.set(
        this.mesh.position.x,
        terrainY + 1.6,
        this.mesh.position.z
      );
      return;
    }

    const isSprinting = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    const speed = isSprinting ? PLAYER_SPRINT_SPEED : PLAYER_MOVE_SPEED;

    // Camera-relative movement
    const forward = this.camera.getForwardRay().direction;
    forward.y = 0;
    forward.normalize();
    const right = Vector3.Cross(forward, Vector3.Up()).normalize();

    const move = Vector3.Zero();
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp"))    move.addInPlace(forward);
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown"))  move.subtractInPlace(forward);
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft"))  move.subtractInPlace(right);
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) move.addInPlace(right);

    this.isMoving = move.lengthSquared() > 0.001;

    if (this.isMoving) {
      move.normalize().scaleInPlace(speed * deltaSeconds);
      const fromX = this.mesh.position.x;
      const fromZ = this.mesh.position.z;
      // Resolve the desired step against world obstacles (ignore our own entry)
      const resolved = this.collision.resolve(
        fromX, fromZ, fromX + move.x, fromZ + move.z,
        PLAYER_COLLISION_RADIUS, "player"
      );
      this.mesh.position.x = resolved.x;
      this.mesh.position.z = resolved.z;
      this.facingAngle = Math.atan2(move.x, move.z);
    }

    this.currentSpeed = this.isMoving ? speed : 0;

    // Snap root to terrain
    const groundY = this.terrain.sampleHeight(this.mesh.position.x, this.mesh.position.z);
    this.mesh.position.y = groundY + 0.05;

    // Sync visual
    this.visual.sync(this.mesh.position.x, groundY, this.mesh.position.z, this.facingAngle);
    this.visual.animate(this.isMoving, this.currentSpeed / PLAYER_SPRINT_SPEED, deltaSeconds);

    // Camera follows root
    this.camera.target.set(
      this.mesh.position.x,
      groundY + 1.0,
      this.mesh.position.z
    );

    bus.emit("player:moved", {
      position: { x: this.mesh.position.x, y: groundY, z: this.mesh.position.z },
    });
  }

  setMounted(mounted: boolean): void {
    this.isMounted = mounted;
    this.visual.setRidingPose(mounted); // spread legs / reset — visual stays visible
    if (mounted) {
      bus.emit("player:mounted");
    } else {
      bus.emit("player:dismounted");
    }
  }

  takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
    bus.emit("player:healthChanged", { current: this.health, max: PLAYER_MAX_HEALTH });
    if (this.health <= 0) bus.emit("player:died");
  }

  restoreFullHealth(): void {
    this.health = PLAYER_MAX_HEALTH;
    bus.emit("player:healthChanged", { current: this.health, max: PLAYER_MAX_HEALTH });
  }

  /** Reset to the spawn point with full health (on foot). */
  respawn(): void {
    this.restoreFullHealth();
    if (!this.isMounted) this.mesh.position.set(0, 5, 0);
  }

  getPosition(): Vector3 {
    return this.mesh.position.clone();
  }

  getFacingAngle(): number {
    return this.facingAngle;
  }

  isAlive(): boolean {
    return this.health > 0;
  }

  isMountedOnHorse(): boolean {
    return this.isMounted;
  }

  getCamera(): ArcRotateCamera {
    return this.camera;
  }

  /** Look sensitivity 0..1 → camera angular sensibility (lower = faster look). */
  setLookSensitivity(value: number): void {
    const v = Math.max(0, Math.min(1, value));
    const sensibility = 4500 - v * 3500; // 4500 (slow) … 1000 (fast)
    this.camera.angularSensibilityX = sensibility;
    this.camera.angularSensibilityY = sensibility;
  }
}
