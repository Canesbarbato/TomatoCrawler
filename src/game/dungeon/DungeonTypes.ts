/**
 * DungeonTypes.ts
 * Shared types for the dungeon generation and rendering systems.
 */

/**
 * Tile types on a map grid.
 * 'corridor' = floor carved between rooms — distinct for corridor-aware fog.
 * 'stairs'   = descend to the next floor when stepped on.
 * 'entrance' = player spawn marker tile, placed at centre of first room.
 */
export type TileType = 'wall' | 'floor' | 'corridor' | 'stairs' | 'entrance';

/**
 * Tunable map generation parameters — exposed via the dev Map Config panel.
 * Replaces hardcoded constants in BspDungeonGenerator.
 */
export interface MapConfig {
  cols: number;
  rows: number;
  /** Minimum size of a BSP partition in any dimension before becoming a leaf. */
  minPartition: number;
  minRoom: number;
  maxRoom: number;
}

export const DEFAULT_MAP_CONFIG: MapConfig = {
  cols: 52,
  rows: 40,
  minPartition: 9,
  minRoom: 4,
  maxRoom: 9,
};

/**
 * Item spawn rate configuration — exposed via dev Item Spawn panel.
 * Controls how many items spawn per floor and their distribution.
 */
export interface ItemSpawnConfig {
  /** Base items per room (before multipliers). Default: 1. */
  itemsPerRoom: number;
  /** Maximum items that can spawn on a floor. Default: rooms.length * 3. */
  maxItemsPerFloor: number;
  /** Spawn rate multiplier for depth scaling. Default: 0.3. */
  depthMultiplier: number;
  /** Spawn rate multiplier for task count. Default: 0.2. */
  taskMultiplier: number;
  /** Spawn rate multiplier for session duration. Default: 0.01. */
  sessionMultiplier: number;
  /** Spawn rate multiplier for tomato count. Default: 0.05. */
  tomatoMultiplier: number;
}

export const DEFAULT_ITEM_SPAWN_CONFIG: ItemSpawnConfig = {
  itemsPerRoom: 1,
  maxItemsPerFloor: 999, // Will be set to rooms.length * 3 at runtime
  depthMultiplier: 0.3,
  taskMultiplier: 0.2,
  sessionMultiplier: 0.01,
  tomatoMultiplier: 0.05,
}

/** A single room placed inside a BSP leaf node. */
export interface Room {
  id: number;
  col: number; // top-left column
  row: number; // top-left row
  w: number;   // width in tiles
  h: number;   // height in tiles
}

/** Full output of a single dungeon floor generation pass. */
export interface TilemapData {
  cols: number;
  rows: number;
  tiles: TileType[][];
  rooms: Room[];
  playerStart: { col: number; row: number };
  /** Position of the staircase tile — The Tomato must walk here to descend. */
  stairsPos: { col: number; row: number };
  floorDepth: number;
  floorName: string;
  /** Items scattered on this floor — picked up during autonomous run. */
  items: FloorItem[];
  /** Enemies spawned on this floor — defeated flag set on combat victory. */
  enemies: FloorEnemy[];
  /** Difficulty parameters used for item spawning — tunable by future phases. */
  floorDifficulty: FloorDifficulty;
}

/**
 * Pre-run behaviour profile — controls how The Tomato prioritises
 * its actions during a run. Each value is 0–10.
 *
 * 'fight' is wired into the interface now but dormant until Phase 3 adds enemies.
 */
export interface BehaviourProfile {
  /** Weight toward exploring every room before heading to the stairs. */
  explore: number;
  /** Weight toward engaging enemies in rooms. Dormant until Phase 3. */
  fight: number;
  /** Weight toward heading straight to the stairs as quickly as possible. */
  exit: number;
}

export const DEFAULT_BEHAVIOUR: BehaviourProfile = {
  explore: 7,
  fight:   5,
  exit:    3,
};

// ─── Phase 3: Character Stats ──────────────────────────────────────────────

/** Character state — HP and max HP. Updated by consumable effects throughout a run. */
export interface CharacterState {
  hp: number;
  maxHp: number;
}

/** Core character attributes that modify combat damage and movement speed. */
export interface CharacterStats {
  strength: number;  // damage dealt
  defence: number;   // flat damage reduction
  speed: number;     // affects moveInterval (120 - (speed - 5) * 5 ms)
}

/** Base stats — all items start from here. */
export const BASE_STATS: CharacterStats = {
  strength: 5,
  defence:  5,
  speed:    5,
};

/** Base character state — initial HP at start of each run. */
export const BASE_CHARACTER_STATE = {
  hp:    100,
  maxHp: 100,
};

/** Tunable difficulty parameters passed from SessionStore to floor generation. */
export interface FloorDifficulty {
  depth: number;                     // required: floor depth (1–infinity)
  taskCount?: number;                // tasks queued in this session (default 0)
  sessionMinutes?: number;           // session duration in minutes (default 0)
  tomatoCount?: number;              // tomato counter / past session count (default 0)
}

/** A single item found on a floor — picked up during autonomous run. */
export interface FloorItem {
  key: string;                       // AssetManifest.foundItems key
  col: number;
  row: number;
  pickedUp: boolean;
}

// ─── Phase 3.E: Enemy types (defined here to avoid circular imports) ─────────

/** Static definition of an enemy type. */
export interface EnemyTemplate {
  /** AssetManifest.enemies key e.g. 'enemy-breadknight' */
  key: string;
  name: string;
  rank: 'I' | 'II' | 'III' | 'IV' | 'V';
  hp: number;
  strength: number;
  defence: number;
}

/** A live enemy instance — carries mutable HP. */
export interface EnemyInstance {
  template: EnemyTemplate;
  currentHp: number;
  floorSpawned: number;
}

/** An enemy placed on a floor — positional + defeated state. */
export interface FloorEnemy extends EnemyInstance {
  col: number;
  row: number;
  defeated: boolean;
}

/**
 * Single source of truth for tile walkability.
 * Use this everywhere instead of inline `=== 'wall'` checks.
 */
export function isWalkable(tile: TileType): boolean {
  return tile === 'floor' || tile === 'corridor' || tile === 'stairs' || tile === 'entrance';
}

