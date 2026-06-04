import { bus } from "@shared/EventBus";
import {
  ENCOUNTER_TRIGGER_RADIUS,
  ENCOUNTER_COOLDOWN_SECONDS,
  ENCOUNTER_SPAWN_INTERVAL_SECONDS,
} from "@shared/constants";
import type { Encounter, EncounterType, Vec3 } from "@shared/types";

interface EncounterTemplate {
  type: EncounterType;
  weight: number;
}

const TEMPLATES: EncounterTemplate[] = [
  { type: "bandit_ambush", weight: 0.6 },
  { type: "injured_traveler", weight: 0.4 },
];

export class EncounterManager {
  private encounters: Encounter[] = [];
  private timeSinceLastSpawn = 0;
  private cooldownRemaining = 0;
  private nextEncounterId = 1;

  update(deltaSeconds: number, playerPosition: Vec3): void {
    if (this.cooldownRemaining > 0) {
      this.cooldownRemaining -= deltaSeconds;
    }

    this.timeSinceLastSpawn += deltaSeconds;

    if (
      this.timeSinceLastSpawn >= ENCOUNTER_SPAWN_INTERVAL_SECONDS &&
      this.cooldownRemaining <= 0
    ) {
      this.spawnNear(playerPosition);
      this.timeSinceLastSpawn = 0;
    }

    this.checkProximity(playerPosition);
  }

  private spawnNear(playerPosition: Vec3): void {
    const angle = Math.random() * Math.PI * 2;
    const distance = ENCOUNTER_TRIGGER_RADIUS * (0.8 + Math.random() * 0.4);
    const position: Vec3 = {
      x: playerPosition.x + Math.cos(angle) * distance,
      y: playerPosition.y,
      z: playerPosition.z + Math.sin(angle) * distance,
    };

    const type = this.pickType();
    const encounter: Encounter = {
      id: `enc_${this.nextEncounterId++}`,
      type,
      position,
      isActive: false,
      isResolved: false,
    };

    this.encounters.push(encounter);
  }

  private pickType(): EncounterType {
    const total = TEMPLATES.reduce((s, t) => s + t.weight, 0);
    let roll = Math.random() * total;
    for (const template of TEMPLATES) {
      roll -= template.weight;
      if (roll <= 0) return template.type;
    }
    return TEMPLATES[0].type;
  }

  private checkProximity(playerPosition: Vec3): void {
    for (const enc of this.encounters) {
      if (enc.isActive || enc.isResolved) continue;

      const dx = enc.position.x - playerPosition.x;
      const dz = enc.position.z - playerPosition.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist <= ENCOUNTER_TRIGGER_RADIUS) {
        enc.isActive = true;
        bus.emit("encounter:triggered", {
          id: enc.id,
          type: enc.type,
          position: enc.position,
        });
      }
    }
  }

  resolve(id: string): void {
    const enc = this.encounters.find((e) => e.id === id);
    if (!enc) return;
    enc.isResolved = true;
    enc.isActive = false;
    this.cooldownRemaining = ENCOUNTER_COOLDOWN_SECONDS;
    bus.emit("encounter:resolved", { id });
  }

  getActive(): Encounter[] {
    return this.encounters.filter((e) => e.isActive && !e.isResolved);
  }
}
