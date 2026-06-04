import { Engine, Scene } from "@babylonjs/core";

// Core systems
import { DayNightCycle }     from "@core/time/DayNightCycle";
import { WeatherSystem }     from "@core/weather/WeatherSystem";
import { HonorSystem }       from "@core/reputation/HonorSystem";
import { DeadEyeSystem }     from "@core/combat/DeadEyeSystem";
import { EncounterManager }  from "@core/encounter/EncounterManager";
import { HorseBondingSystem }from "@core/horse/HorseBondingSystem";

// World
import { TerrainManager }    from "@world/terrain/TerrainManager";
import { SkyController }     from "@world/environment/SkyController";
import { WeatherController } from "@world/environment/WeatherController";
import { VegetationManager } from "@world/environment/VegetationManager";

// Entities
import { PlayerController }  from "@entities/player/PlayerController";
import { HorseController }   from "@entities/horse/HorseController";
import { NpcController }     from "@entities/npc/NpcController";

// UI
import { HudController }     from "@ui/hud/HudController";

// Bus
import { bus } from "@shared/EventBus";

async function main(): Promise<void> {
  const canvas  = document.getElementById("game-canvas") as HTMLCanvasElement;
  const hudRoot = document.getElementById("hud") as HTMLElement;

  const engine = new Engine(canvas, true, { adaptToDeviceRatio: true, antialias: true });
  const scene  = new Scene(engine);
  scene.collisionsEnabled = true;

  // ── Core systems ──────────────────────────────────────────────────────────
  const dayNight    = new DayNightCycle();
  const weatherSys  = new WeatherSystem();
  const honorSys    = new HonorSystem();
  const deadEye     = new DeadEyeSystem();
  const encounterMgr= new EncounterManager();
  const horseBonding= new HorseBondingSystem();

  // ── World ─────────────────────────────────────────────────────────────────
  const terrain     = new TerrainManager(scene);
  const sky         = new SkyController(scene, dayNight);
  const weatherCtrl = new WeatherController(scene, weatherSys);
  const vegetation  = new VegetationManager(scene, terrain);

  // ── Entities ──────────────────────────────────────────────────────────────
  const player = new PlayerController(scene, deadEye, terrain);
  const horse  = new HorseController(scene, horseBonding, terrain, player);

  // Register player + horse meshes as shadow casters
  const sg = sky.getShadowGenerator();
  player.visual.getMeshes().forEach((m) => sg.addShadowCaster(m));
  horse.visual.getMeshes().forEach((m)  => sg.addShadowCaster(m));

  // ── UI ────────────────────────────────────────────────────────────────────
  new HudController(hudRoot);

  // Dead Eye canvas filter for sepia slow-motion feel
  bus.on("deadeye:activated",   () => { canvas.style.filter = "sepia(0.45) contrast(1.15)"; });
  bus.on("deadeye:deactivated", () => { canvas.style.filter = ""; });

  // ── NPC tracking ─────────────────────────────────────────────────────────
  const activeNpcs = new Map<string, NpcController[]>();

  bus.on("encounter:triggered", ({ id, type, position }) => {
    const npcs: NpcController[] = [];

    if (type === "bandit_ambush") {
      for (let i = 0; i < 3; i++) {
        const offset = { x: position.x + (i - 1) * 3, y: 0, z: position.z + 4 };
        const npc = new NpcController(scene, `${id}_b${i}`, "bandit", offset);
        npc.visual.getMeshes().forEach((m) => sg.addShadowCaster(m));
        npcs.push(npc);
      }
    } else {
      const npc = new NpcController(scene, `${id}_t0`, "traveler", position);
      npc.visual.getMeshes().forEach((m) => sg.addShadowCaster(m));
      npcs.push(npc);
    }

    activeNpcs.set(id, npcs);

    // Auto-resolve traveler encounter after 8 seconds
    if (type === "injured_traveler") {
      setTimeout(() => {
        encounterMgr.resolve(id);
        honorSys.helpTraveler();
        activeNpcs.get(id)?.forEach((n) => n.dispose());
        activeNpcs.delete(id);
      }, 8000);
    }
  });

  // ── Dead Eye execution ────────────────────────────────────────────────────
  bus.on("deadeye:deactivated", () => {
    // executeTargets() returns locked list then clears it
    const targets = deadEye.executeTargets();
    targets.forEach((targetId) => {
      activeNpcs.forEach((npcs) => npcs.find((n) => n.id === targetId)?.kill());
    });
  });

  // ── Shooting (left click) ─────────────────────────────────────────────────
  scene.onPointerDown = (evt) => {
    if (evt.button !== 0) return;

    const pickResult = scene.pick(scene.pointerX, scene.pointerY);
    if (!pickResult?.hit || !pickResult.pickedMesh) return;

    const npcId = pickResult.pickedMesh.metadata?.npcId as string | undefined;
    if (!npcId) return;

    if (deadEye.isActive()) {
      deadEye.lockTarget(npcId);
    } else {
      // Direct shot — find and kill NPC
      activeNpcs.forEach((npcs) => npcs.find((n) => n.id === npcId)?.kill());
    }
  };

  // ── Initial world load ────────────────────────────────────────────────────
  const startPos = player.getPosition();
  terrain.update(startPos);
  vegetation.update(startPos);

  // ── Render loop ───────────────────────────────────────────────────────────
  let lastTime = performance.now();

  engine.runRenderLoop(() => {
    const now      = performance.now();
    const rawDelta = (now - lastTime) / 1000;
    lastTime = now;
    const delta     = Math.min(rawDelta, 0.05);
    const gameDelta = delta * (deadEye.isActive() ? 0.2 : 1.0);

    // Core
    dayNight.update(gameDelta);
    weatherSys.update(gameDelta);

    const playerPos = player.getPosition();
    encounterMgr.update(gameDelta, { x: playerPos.x, y: playerPos.y, z: playerPos.z });

    // World
    terrain.update(playerPos);
    vegetation.update(playerPos);
    sky.update(delta);
    weatherCtrl.update(playerPos);

    // Entities
    player.update(gameDelta);
    horse.update(gameDelta);

    // NPC AI
    activeNpcs.forEach((npcs) => {
      npcs.forEach((npc) => npc.update(gameDelta, playerPos, terrain.sampleHeight.bind(terrain)));
    });

    scene.render();
  });

  window.addEventListener("resize", () => engine.resize());
}

main().catch(console.error);
