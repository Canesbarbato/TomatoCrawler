/**
 * FogModel.ts
 *
 * Pure (Phaser-free) fog-of-war model.
 * Owns the revealed[][] boolean grid and exposes reveal methods that return
 * only the newly revealed tiles as delta arrays — the view layer applies them.
 *
 * Corridor-aware logic:
 *   - In a room  → square FOG_RADIUS_ROOM reveal around the player
 *   - In a corridor → flashlight: 1 tile perpendicular + FOG_REACH_CORRIDOR ahead,
 *                     stopping at wall tiles
 */

import { TilemapData, TileType } from '../dungeon/DungeonTypes';

export const FOG_RADIUS_ROOM    = 3;
export const FOG_REACH_CORRIDOR = 5;

export interface FogDelta {
  col: number;
  row: number;
}

export class FogModel {
  /** Full revealed state — read by EventLog.saveToDisk and parity check. */
  readonly revealed: boolean[][];

  private readonly cols: number;
  private readonly rows: number;
  private readonly tiles: TileType[][];

  constructor(map: TilemapData) {
    this.cols   = map.cols;
    this.rows   = map.rows;
    this.tiles  = map.tiles;
    this.revealed = Array.from(
      { length: map.rows },
      () => new Array<boolean>(map.cols).fill(false),
    );
  }

  // ─── Reveal ────────────────────────────────────────────────────────────────

  /** Square reveal around a room tile. Returns newly-revealed deltas. */
  revealRoom(col: number, row: number): FogDelta[] {
    const r = FOG_RADIUS_ROOM;
    const deltas: FogDelta[] = [];
    for (let dr = -r; dr <= r; dr++) {
      for (let dc = -r; dc <= r; dc++) {
        const nc = col + dc;
        const nr = row + dr;
        if (nc >= 0 && nr >= 0 && nc < this.cols && nr < this.rows && !this.revealed[nr][nc]) {
          this.revealed[nr][nc] = true;
          deltas.push({ col: nc, row: nr });
        }
      }
    }
    return deltas;
  }

  /**
   * Flashlight reveal along a corridor.
   * dc/dr = direction the player is travelling (−1, 0, or 1 each).
   * Returns newly-revealed deltas.
   */
  revealCorridor(col: number, row: number, dc: number, dr: number): FogDelta[] {
    const deltas: FogDelta[] = [];

    // Perpendicular width at the current tile (−1, 0, +1)
    for (let side = -1; side <= 1; side++) {
      const pc = col + (dr !== 0 ? side : 0);
      const pr = row + (dc !== 0 ? side : 0);
      if (pc >= 0 && pr >= 0 && pc < this.cols && pr < this.rows && !this.revealed[pr][pc]) {
        this.revealed[pr][pc] = true;
        deltas.push({ col: pc, row: pr });
      }
    }

    // Forward beam — stops at the first wall tile
    for (let i = 1; i <= FOG_REACH_CORRIDOR; i++) {
      const nc = col + dc * i;
      const nr = row + dr * i;
      if (nc < 0 || nr < 0 || nc >= this.cols || nr >= this.rows) break;
      if (this.tiles[nr][nc] === 'wall') break;

      if (!this.revealed[nr][nc]) {
        this.revealed[nr][nc] = true;
        deltas.push({ col: nc, row: nr });
      }

      // Perpendicular sides along the beam
      for (const side of [-1, 1]) {
        const sc = nc + (dr !== 0 ? side : 0);
        const sr = nr + (dc !== 0 ? side : 0);
        if (sc >= 0 && sr >= 0 && sc < this.cols && sr < this.rows && !this.revealed[sr][sc]) {
          this.revealed[sr][sc] = true;
          deltas.push({ col: sc, row: sr });
        }
      }
    }

    return deltas;
  }

  // ─── Bulk operations (dev helpers) ────────────────────────────────────────

  /** Reveal every tile. Returns all newly-revealed deltas. */
  revealAll(): FogDelta[] {
    const deltas: FogDelta[] = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.revealed[r][c]) {
          this.revealed[r][c] = true;
          deltas.push({ col: c, row: r });
        }
      }
    }
    return deltas;
  }

  /** Re-fog every tile (no deltas needed — caller rebuilds the full layer). */
  fogAll(): void {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.revealed[r][c] = false;
      }
    }
  }
}
