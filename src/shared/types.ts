// Core domain types shared across all layers

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type WeatherState = "clear" | "cloudy" | "rain" | "storm";

export type HonorTier = "outlaw" | "dishonorable" | "neutral" | "honorable" | "legendary";

export interface GameTime {
  /** 0–24 hours in game time */
  hour: number;
  /** 0–59 minutes in game time */
  minute: number;
  /** full day count since start */
  day: number;
}

export interface PlayerState {
  position: Vec3;
  health: number;
  maxHealth: number;
  isMounted: boolean;
  isDeadEyeActive: boolean;
}

export interface HorseState {
  position: Vec3;
  bondingLevel: number;
  isFollowing: boolean;
}

export type EncounterType = "bandit_ambush" | "injured_traveler";

export interface Encounter {
  id: string;
  type: EncounterType;
  position: Vec3;
  isActive: boolean;
  isResolved: boolean;
}
