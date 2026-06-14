import { Engine, Scene, Vector3 } from "@babylonjs/core";

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
import { PostProcessController } from "@world/environment/PostProcessController";

// Entities
import { PlayerController }  from "@entities/player/PlayerController";
import { HorseController }   from "@entities/horse/HorseController";
import { NpcController }     from "@entities/npc/NpcController";
import { Campfire }          from "@entities/camp/Campfire";

// UI
import { HudController }     from "@ui/hud/HudController";
import { Minimap }           from "@ui/hud/Minimap";
import { PauseMenu }         from "@ui/menus/PauseMenu";
import { RestMenu }          from "@ui/menus/RestMenu";

// Audio
import { AudioManager }      from "./audio/AudioManager";

// Bus
import { bus } from "@shared/EventBus";
import { MAX_TERRAIN_HEIGHT } from "@shared/constants";

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

  // Campfire near spawn — a rest point
  const campX = 6, campZ = 6;
  const campfire = new Campfire(scene, { x: campX, y: terrain.sampleHeight(campX, campZ), z: campZ });

  // Register player + horse + campfire meshes as shadow casters
  const sg = sky.getShadowGenerator();
  player.visual.getMeshes().forEach((m) => sg.addShadowCaster(m));
  horse.visual.getMeshes().forEach((m)  => sg.addShadowCaster(m));
  campfire.getShadowCasters().forEach((m) => sg.addShadowCaster(m));

  // ── Post-processing ────────────────────────────────────────────────────────
  new PostProcessController(scene, player.getCamera());

  // ── UI ────────────────────────────────────────────────────────────────────
  new HudController(hudRoot);

  new Minimap(
    hudRoot,
    (x, z) => terrain.sampleHeight(x, z),
    () => { const p = player.getPosition(); return { x: p.x, y: p.y, z: p.z }; },
    () => player.getFacingAngle(),
    MAX_TERRAIN_HEIGHT
  );

  // Pause menu + rest menu both gate the simulation; rendering continues so
  // the frozen frame stays visible.
  let pauseOpen = false;
  let restOpen  = false;
  new PauseMenu(hudRoot, (p) => { pauseOpen = p; });
  const restMenu = new RestMenu(
    hudRoot,
    (hour) => { dayNight.setTime(hour); player.restoreFullHealth(); },
    (open) => { restOpen = open; }
  );

  // Procedural audio (wind, gunshots, melee thuds, hoofbeats). M toggles mute.
  const audio = new AudioManager();

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
    targets.forEach((targetId, i) => {
      activeNpcs.forEach((npcs) => npcs.find((n) => n.id === targetId)?.kill());
      setTimeout(() => bus.emit("weapon:fired"), i * 130); // staggered volley
    });
  });

  // ── Bandits damage the player ──────────────────────────────────────────────
  bus.on("npc:attackedPlayer", ({ damage }) => {
    if (player.isAlive()) player.takeDamage(damage);
  });

  // ── Encounter resolution: an ambush is over once every bandit is down ──────
  bus.on("combat:npcKilled", ({ npcId }) => {
    for (const [encId, npcs] of activeNpcs) {
      if (!npcs.some((n) => n.id === npcId)) continue;
      if (npcs[0].isInnocent) break;                 // travelers resolve on a timer
      if (npcs.every((n) => !n.getIsAlive())) {
        encounterMgr.resolve(encId);                 // emits encounter:resolved + cooldown
        activeNpcs.delete(encId);
        setTimeout(() => npcs.forEach((n) => n.dispose()), 3000);
      }
      break;
    }
  });

  // ── Player death → clear the field and respawn at the homestead ────────────
  bus.on("player:died", () => {
    activeNpcs.forEach((npcs) => npcs.forEach((n) => n.dispose()));
    activeNpcs.clear();
    player.respawn();
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
      bus.emit("weapon:fired");
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

    // Paused (pause menu or rest panel open): present the last frame, no sim
    if (pauseOpen || restOpen) {
      scene.render();
      return;
    }

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

    // Campfire flicker + rest proximity (only available on foot)
    campfire.update(gameDelta);
    const nearFire = !player.isMountedOnHorse() &&
      Vector3.Distance(playerPos, campfire.getPosition()) < 4;
    restMenu.setNearby(nearFire);

    // Hoofbeats while riding
    audio.update(player.isMountedOnHorse() && horse.isMovingNow(), horse.isGallopingNow());

    // NPC AI
    activeNpcs.forEach((npcs) => {
      npcs.forEach((npc) => npc.update(gameDelta, playerPos, terrain.sampleHeight.bind(terrain)));
    });

    scene.render();
  });

  window.addEventListener("resize", () => engine.resize());
}

main().catch(console.error);
