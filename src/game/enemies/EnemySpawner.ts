/**
 * EnemySpawner.ts
 * Spawns enemies on a floor after item scatter (Phase 3.E).
 *
 * Rules:
 *   - 1–3 enemies per floor; one per qualifying room
 *   - Excludes the spawn room (room 0)
 *   - Minimum 3 rooms away from room 0 (by index)
 *   - Enemy placed on a random walkable floor tile inside the room AABB
 *     (not on entrance or stairs)
 */

import { TilemapData, FloorDifficulty, FloorEnemy, isWalkable } from '../dungeon/DungeonTypes';
import { getRandomEnemyTemplate } from './EnemyRegistry';

export function spawnForFloor(
  map: TilemapData,
  difficulty: FloorDifficulty,
): FloorEnemy[] {
  const enemies: FloorEnemy[] = [];
  const { rooms, tiles, playerStart, stairsPos } = map;

  const count = Math.min(3, 1 + Math.floor(difficulty.depth * 0.4));
  const spawnedRooms = new Set<number>();

  for (let i = 0; i < rooms.length && enemies.length < count; i++) {
    if (i === 0) continue; // skip spawn room

    const room = rooms[i];
    // Collect valid floor tiles in this room
    const candidates: Array<{ col: number; row: number }> = [];
    for (let r = room.row; r < room.row + room.h; r++) {
      for (let c = room.col; c < room.col + room.w; c++) {
        const tile = tiles[r][c];
        if (!isWalkable(tile)) continue;
        if (tile === 'entrance' || tile === 'stairs') continue;
        if (c === playerStart.col && r === playerStart.row) continue;
        if (c === stairsPos.col   && r === stairsPos.row)   continue;
        candidates.push({ col: c, row: r });
      }
    }

    if (candidates.length === 0) continue;
    if (spawnedRooms.has(room.id)) continue;

    const pos = candidates[Math.floor(Math.random() * candidates.length)];
    const template = getRandomEnemyTemplate();

    enemies.push({
      template,
      currentHp: template.hp,
      floorSpawned: difficulty.depth,
      col: pos.col,
      row: pos.row,
      defeated: false,
    });
    spawnedRooms.add(room.id);
  }

  return enemies;
}
