// World
export const WORLD_SIZE_METERS = 1024; // 1 km²
export const CHUNK_COUNT = 8; // 8×8 grid
export const CHUNK_SIZE = WORLD_SIZE_METERS / CHUNK_COUNT; // 128m per chunk
export const TERRAIN_HEIGHTMAP_RESOLUTION = 512;
export const MAX_TERRAIN_HEIGHT = 80;

// Time — 1 real second = 1 game minute (24-min full day cycle)
export const GAME_MINUTES_PER_REAL_SECOND = 1;
export const GAME_HOURS_PER_REAL_MINUTE = 1;
export const DAWN_HOUR = 6;
export const DUSK_HOUR = 20;

// Player
export const PLAYER_MOVE_SPEED = 5; // m/s walk
export const PLAYER_SPRINT_SPEED = 9; // m/s sprint
export const PLAYER_MAX_HEALTH = 100;
export const HORSE_MOUNT_DISTANCE = 3; // meters

// Dead Eye
export const DEADEYE_SLOW_FACTOR = 0.2; // 20% time scale
export const DEADEYE_MAX_TARGETS = 4;

// Honor — −1 to +1 float
export const HONOR_KILL_INNOCENT = -0.15;
export const HONOR_KILL_BANDIT = 0.05;
export const HONOR_HELP_TRAVELER = 0.1;
export const HONOR_TIER_THRESHOLDS: Record<string, number> = {
  outlaw: -0.8,
  dishonorable: -0.4,
  neutral: 0.0,
  honorable: 0.4,
  legendary: 0.8,
};

// Encounter
export const ENCOUNTER_TRIGGER_RADIUS = 60; // meters from player
export const ENCOUNTER_COOLDOWN_SECONDS = 120;
export const ENCOUNTER_SPAWN_INTERVAL_SECONDS = 90;

// Horse bonding
export const HORSE_BOND_PER_RIDE_MINUTE = 0.005;
export const HORSE_MAX_BOND = 1.0;
