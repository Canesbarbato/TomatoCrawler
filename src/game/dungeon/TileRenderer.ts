/**
 * TileRenderer.ts
 *
 * Single source of truth for all tile-to-rendering mappings.
 * Used by:
 *   - GameScene       → tileToTilemapIndex(), worldFromTile()
 *   - BootScene       → TILESET_ASSET_KEYS, TILE_SIZE
 *   - EventLog        → tileToAsciiChar()
 *   - DebugControls   → (indirectly via EventLog)
 *
 * Tileset atlas layout (1 row, each tile TILE_SIZE × TILE_SIZE px, firstgid = 1):
 *   GID 1 → undiscovered  (fog tile)
 *   GID 2 → wall
 *   GID 3 → floor
 *   GID 4 → corridor
 *   GID 5 → entrance
 *   GID 6 → stairs
 *
 * Empty / transparent slot = -1 (Phaser "no tile").
 */

import { TileType } from './DungeonTypes';
import { AssetManifest } from '../assets/AssetManifest';

export const TILE_SIZE = 16;

/**
 * GID (global tile ID) for the "undiscovered / fog" tile in the atlas.
 * Used to fill the fog layer at floor load; revealed tiles are set to -1.
 */
export const UNDISCOVERED_GID = 1;

/**
 * Ordered asset keys used when building the runtime tileset atlas.
 * The position in this array (0-based) + 1 equals the tile's GID.
 */
export const TILESET_ASSET_KEYS: string[] = [
  AssetManifest.tiles.undiscovered.key, // GID 1 (index 0 in array)
  AssetManifest.tiles.wall.key,         // GID 2
  AssetManifest.tiles.floor.key,        // GID 3
  AssetManifest.tiles.corridor.key,     // GID 4
  AssetManifest.tiles.entrance.key,     // GID 5
  AssetManifest.ui.stairs.key,          // GID 6
];

/** Width (px) of the synthesised tileset atlas canvas. */
export const TILESET_ATLAS_WIDTH = TILE_SIZE * TILESET_ASSET_KEYS.length;

/**
 * Map a TileType to its GID in the synthesised tileset atlas.
 * Keeps terrain layer indices in sync with the atlas order above.
 */
export function tileToTilemapIndex(tile: TileType): number {
  switch (tile) {
    case 'wall':     return 2;
    case 'floor':    return 3;
    case 'corridor': return 4;
    case 'entrance': return 5;
    case 'stairs':   return 6;
    default:         return 2; // fallback: treat unknown as wall
  }
}

/**
 * Map a TileType to its AssetManifest texture key.
 * Delegates the asset-key switch to one canonical location.
 */
export function tileToAssetKey(tile: TileType): string {
  switch (tile) {
    case 'wall':     return AssetManifest.tiles.wall.key;
    case 'floor':    return AssetManifest.tiles.floor.key;
    case 'corridor': return AssetManifest.tiles.corridor.key;
    case 'entrance': return AssetManifest.tiles.entrance.key;
    case 'stairs':   return AssetManifest.ui.stairs.key;
    default:         return AssetManifest.tiles.floor.key;
  }
}

/**
 * Map a TileType to its ASCII character for log exports and parity checks.
 * Pass isPlayer = true to render '@' regardless of tile type.
 */
export function tileToAsciiChar(tile: TileType, isPlayer = false): string {
  if (isPlayer) return '@';
  switch (tile) {
    case 'wall':     return '#';
    case 'floor':    return '.';
    case 'corridor': return '+';
    case 'entrance': return 'E';
    case 'stairs':   return '>';
    default:         return '?';
  }
}

/**
 * Convert tile grid coordinates to Phaser world centre coordinates.
 * Used by GameScene to position the player sprite and camera.
 */
export function worldFromTile(col: number, row: number): { x: number; y: number } {
  return {
    x: col * TILE_SIZE + TILE_SIZE / 2,
    y: row * TILE_SIZE + TILE_SIZE / 2,
  };
}
