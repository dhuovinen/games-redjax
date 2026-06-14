import type { WeatherState, GameTime, HonorTier, EncounterType, Vec3 } from "./types";

// Typed event map — add new events here as systems grow
export interface GameEvents {
  // Time
  "time:tick": { time: GameTime };
  "time:hourChanged": { hour: number };
  // Weather
  "weather:changed": { state: WeatherState };
  // Player
  "player:moved": { position: Vec3 };
  "player:mounted": void;
  "player:dismounted": void;
  "player:healthChanged": { current: number; max: number };
  "player:died": void;
  // Dead Eye
  "deadeye:activated": void;
  "deadeye:deactivated": void;
  "deadeye:targetLocked": { targetId: string };
  // Honor
  "honor:changed": { value: number; tier: HonorTier };
  // Encounters
  "encounter:triggered": { id: string; type: EncounterType; position: Vec3 };
  "encounter:resolved": { id: string };
  // Combat
  "combat:npcKilled": { npcId: string; isInnocent: boolean };
  "npc:attackedPlayer": { damage: number };
  "weapon:fired": void;
  // Horse bonding
  "horse:bondingIncreased": { level: number };
}

type EventKey = keyof GameEvents;
type Handler<K extends EventKey> = GameEvents[K] extends void
  ? () => void
  : (payload: GameEvents[K]) => void;

export class EventBus {
  private static instance: EventBus;
  private listeners = new Map<EventKey, Set<Handler<EventKey>>>();

  static getInstance(): EventBus {
    if (!EventBus.instance) EventBus.instance = new EventBus();
    return EventBus.instance;
  }

  on<K extends EventKey>(event: K, handler: Handler<K>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler as Handler<EventKey>);
    return () => this.off(event, handler);
  }

  off<K extends EventKey>(event: K, handler: Handler<K>): void {
    this.listeners.get(event)?.delete(handler as Handler<EventKey>);
  }

  emit<K extends EventKey>(
    event: K,
    ...args: GameEvents[K] extends void ? [] : [GameEvents[K]]
  ): void {
    const payload = args[0] as GameEvents[K];
    this.listeners.get(event)?.forEach((h) => (h as (p: GameEvents[K]) => void)(payload));
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const bus = EventBus.getInstance();
