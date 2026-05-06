/**
 * BspDungeonGenerator.ts
 *
 * Strict 4-stage dungeon generator:
 *   1. placeRooms       — random placement with overlap/margin guard
 *   2. connectRooms     — L-shaped corridors, only overwrites wall tiles
 *   3. markSpecialTiles — place 'entrance' at spawn, 'stairs' at far corner
 *   4. assertInvariants — hard checks; fail = return null and retry
 *
 * No post-processing passes. Tile classifications are set once by the
 * carving algorithm and never mutated afterward. This guarantees that the
 * TilemapData model matches the rendered tilemap at all times.
 *
 * Retry policy: up to 5 attempts with re-seeded RNG, then fallbackLayout().
 */

import { TileType, TilemapData, Room, MapConfig, DEFAULT_MAP_CONFIG, ItemSpawnConfig, DEFAULT_ITEM_SPAWN_CONFIG, isWalkable, FloorDifficulty, FloorItem } from './DungeonTypes';
import { getRandomItemTemplate } from '../items/ItemRegistry';
import { spawnForFloor } from '../enemies/EnemySpawner';

export class BspDungeonGenerator {
  private tiles: TileType[][] = [];
  private rooms: Room[]       = [];
  private roomIdCounter       = 0;
  private seed: number;
  private config: MapConfig;
  private spawnConfig: ItemSpawnConfig;

  constructor(seed?: number, config: MapConfig = DEFAULT_MAP_CONFIG, spawnConfig: ItemSpawnConfig = DEFAULT_ITEM_SPAWN_CONFIG) {
    this.seed         = seed ?? Date.now();
    this.config       = { ...config };
    this.spawnConfig  = { ...spawnConfig };
  }

  setConfig(config: Partial<MapConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): MapConfig {
    return { ...this.config };
  }

  setSpawnConfig(spawnConfig: Partial<ItemSpawnConfig>): void {
    this.spawnConfig = { ...this.spawnConfig, ...spawnConfig };
  }

  getSpawnConfig(): ItemSpawnConfig {
    return { ...this.spawnConfig };
  }

  // ─── Public entry point ───────────────────────────────────────────────────

  generate(floorDepth: number, difficulty?: FloorDifficulty): TilemapData {
    for (let attempt = 0; attempt < 5; attempt++) {
      const result = this.attempt(floorDepth, difficulty);
      if (result) return result;
      this.seed = (this.seed ^ 0xdeadbeef) >>> 0;
    }
    return this.fallbackLayout(floorDepth, difficulty);
  }

  // ─── Stage orchestration ─────────────────────────────────────────────────

  private attempt(floorDepth: number, difficulty?: FloorDifficulty): TilemapData | null {
    const extraCols = Math.min(floorDepth - 1, 4) * 4;
    const extraRows = Math.min(floorDepth - 1, 4) * 3;
    const cols      = this.config.cols + extraCols;
    const rows      = this.config.rows + extraRows;

    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;

    // Stage 1: fill with walls, place rooms
    this.tiles         = Array.from({ length: rows }, () => new Array<TileType>(cols).fill('wall'));
    this.rooms         = [];
    this.roomIdCounter = 0;

    const targetRooms = Math.min(4 + (floorDepth - 1) * 2, 10);
    const maxTries    = targetRooms * 20;

    for (let i = 0; i < maxTries && this.rooms.length < targetRooms; i++) {
      this.tryPlaceRoom(cols, rows);
    }

    if (this.rooms.length < 2) return null;

    // Stage 2: connect rooms with L-shaped corridors
    for (let i = 1; i < this.rooms.length; i++) {
      this.connectRooms(this.rooms[i - 1], this.rooms[i], cols, rows);
    }

    // Stage 3: mark entrance and stairs
    const first       = this.rooms[0];
    const playerStart = {
      col: first.col + Math.floor(first.w / 2),
      row: first.row + Math.floor(first.h / 2),
    };

    const last      = this.rooms.at(-1)!;
    const stairsPos = {
      col: Math.min(last.col + last.w - 2, last.col + last.w - 1),
      row: Math.min(last.row + last.h - 2, last.row + last.h - 1),
    };

    this.tiles[stairsPos.row][stairsPos.col]     = 'stairs';
    this.tiles[playerStart.row][playerStart.col] = 'entrance';

    // Stage 4: assert invariants — null triggers a re-seeded retry
    if (!this.assertInvariants(cols, rows, playerStart, stairsPos)) return null;

    // Stage 5: scatter items on the map
    const items = this.scatterItems(cols, rows, playerStart, stairsPos, floorDepth, difficulty);

    const floorDiff: FloorDifficulty = {
      depth: floorDepth,
      taskCount: difficulty?.taskCount ?? 0,
      sessionMinutes: difficulty?.sessionMinutes ?? 0,
      tomatoCount: difficulty?.tomatoCount ?? 0,
    };

    // Stage 6: spawn enemies (after items so occupied tiles are consistent)
    const enemies = spawnForFloor({ cols, rows, tiles: this.tiles, rooms: [...this.rooms], playerStart, stairsPos, floorDepth, floorName: '', items, enemies: [], floorDifficulty: floorDiff }, floorDiff);

    return {
      cols, rows,
      tiles:    this.tiles,
      rooms:    [...this.rooms],
      playerStart,
      stairsPos,
      floorDepth,
      floorName: BspDungeonGenerator.floorName(floorDepth),
      items,
      enemies,
      floorDifficulty: floorDiff,
    };
  }

  // ─── Stage 1: room placement ──────────────────────────────────────────────

  private tryPlaceRoom(cols: number, rows: number): void {
    const minR = this.config.minRoom;
    const maxR = this.config.maxRoom;

    const rw = minR + Math.floor(this.rng() * (maxR - minR + 1));
    const rh = minR + Math.floor(this.rng() * (maxR - minR + 1));
    // Keep 1 tile from every edge so the border row/col stays wall.
    const rc = 1 + Math.floor(this.rng() * (cols - rw - 2));
    const rr = 1 + Math.floor(this.rng() * (rows - rh - 2));

    if (rc < 1 || rr < 1 || rc + rw > cols - 1 || rr + rh > rows - 1) return;

    const candidate: Room = { id: this.roomIdCounter, col: rc, row: rr, w: rw, h: rh };
    if (this.overlapsAny(candidate)) return;

    this.roomIdCounter++;
    this.rooms.push(candidate);

    for (let r = rr; r < rr + rh; r++) {
      for (let c = rc; c < rc + rw; c++) {
        this.tiles[r][c] = 'floor';
      }
    }
  }

  private overlapsAny(candidate: Room): boolean {
    const m = 2; // minimum gap between rooms
    for (const r of this.rooms) {
      if (
        candidate.col             < r.col + r.w + m &&
        candidate.col + candidate.w + m > r.col      &&
        candidate.row             < r.row + r.h + m &&
        candidate.row + candidate.h + m > r.row
      ) return true;
    }
    return false;
  }

  // ─── Stage 2: corridor carving ────────────────────────────────────────────

  private connectRooms(a: Room, b: Room, cols: number, rows: number): void {
    const ax = a.col + Math.floor(a.w / 2);
    const ay = a.row + Math.floor(a.h / 2);
    const bx = b.col + Math.floor(b.w / 2);
    const by = b.row + Math.floor(b.h / 2);

    if (this.rng() > 0.5) {
      this.carveH(ax, bx, ay, cols, rows);
      this.carveV(ay, by, bx, cols, rows);
    } else {
      this.carveV(ay, by, ax, cols, rows);
      this.carveH(ax, bx, by, cols, rows);
    }
  }

  /**
   * Carve a horizontal corridor.
   * Only overwrites wall tiles — room 'floor' tiles are never touched,
   * so corridors cannot appear inside room bounding boxes.
   */
  private carveH(c0: number, c1: number, row: number, cols: number, rows: number): void {
    const cMin = Math.min(c0, c1);
    const cMax = Math.max(c0, c1);
    for (let c = cMin; c <= cMax; c++) {
      if (row >= 1 && row <= rows - 2 && c >= 1 && c <= cols - 2) {
        if (this.tiles[row][c] === 'wall') this.tiles[row][c] = 'corridor';
      }
    }
  }

  /** Carve a vertical corridor — only overwrites wall tiles. */
  private carveV(r0: number, r1: number, col: number, cols: number, rows: number): void {
    const rMin = Math.min(r0, r1);
    const rMax = Math.max(r0, r1);
    for (let r = rMin; r <= rMax; r++) {
      if (r >= 1 && r <= rows - 2 && col >= 1 && col <= cols - 2) {
        if (this.tiles[r][col] === 'wall') this.tiles[r][col] = 'corridor';
      }
    }
  }

  // ─── Stage 4: invariant assertion ────────────────────────────────────────

  /**
   * Hard invariants — return false to trigger a re-seeded retry.
   *
   * INV-1: All border row/col tiles are wall.
   * INV-2: No corridor tile inside any room AABB.
   *        (Guaranteed by carveH/V, checked here as a regression guard.)
   * INV-3: Entrance and stairs are walkable.
   * INV-4: All walkable tiles form a single connected component.
   */
  private assertInvariants(
    cols: number,
    rows: number,
    playerStart: { col: number; row: number },
    stairsPos:   { col: number; row: number },
  ): boolean {
    // INV-1
    for (let c = 0; c < cols; c++) {
      if (this.tiles[0][c] !== 'wall' || this.tiles[rows - 1][c] !== 'wall') return false;
    }
    for (let r = 0; r < rows; r++) {
      if (this.tiles[r][0] !== 'wall' || this.tiles[r][cols - 1] !== 'wall') return false;
    }

    // INV-2
    for (const room of this.rooms) {
      for (let r = room.row; r < room.row + room.h; r++) {
        for (let c = room.col; c < room.col + room.w; c++) {
          if (this.tiles[r][c] === 'corridor') return false;
        }
      }
    }

    // INV-3
    if (!isWalkable(this.tiles[playerStart.row][playerStart.col])) return false;
    if (!isWalkable(this.tiles[stairsPos.row][stairsPos.col]))     return false;

    // INV-4
    if (this.floodFill(playerStart.col, playerStart.row) < this.countWalkable()) return false;

    return true;
  }

  // ─── Connectivity helpers ─────────────────────────────────────────────────

  private countWalkable(): number {
    let n = 0;
    for (const row of this.tiles) {
      for (const t of row) { if (isWalkable(t)) n++; }
    }
    return n;
  }

  private floodFill(startCol: number, startRow: number): number {
    const cols    = this.tiles[0].length;
    const rows    = this.tiles.length;
    const visited = new Set<number>();
    const queue   = [startRow * cols + startCol];
    visited.add(queue[0]);

    const DIRS = [[-1,0],[1,0],[0,-1],[0,1]];
    while (queue.length > 0) {
      const k   = queue.shift()!;
      const col = k % cols;
      const row = Math.floor(k / cols);
      for (const [dc, dr] of DIRS) {
        const nc = col + dc;
        const nr = row + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        if (!isWalkable(this.tiles[nr][nc])) continue;
        const nk = nr * cols + nc;
        if (visited.has(nk)) continue;
        visited.add(nk);
        queue.push(nk);
      }
    }
    return visited.size;
  }

  // ─── Guaranteed fallback (2 rooms) ───────────────────────────────────────

  private fallbackLayout(floorDepth: number, difficulty?: FloorDifficulty): TilemapData {
    const cols = this.config.cols;
    const rows = this.config.rows;
    this.tiles = Array.from({ length: rows }, () => new Array<TileType>(cols).fill('wall'));

    for (let r = 5; r < 12; r++) {
      for (let c = 5;  c < 14; c++) this.tiles[r][c] = 'floor';
      for (let c = 35; c < 44; c++) this.tiles[r][c] = 'floor';
    }
    for (let c = 14; c <= 35; c++) this.tiles[8][c] = 'corridor';

    const playerStart = { col: 9,  row: 8 };
    const stairsPos   = { col: 41, row: 9 };
    this.tiles[stairsPos.row][stairsPos.col]     = 'stairs';
    this.tiles[playerStart.row][playerStart.col] = 'entrance';

    this.rooms = [
      { id: 0, col: 5,  row: 5, w: 9, h: 7 },
      { id: 1, col: 35, row: 5, w: 9, h: 7 },
    ];

    const items = this.scatterItems(cols, rows, playerStart, stairsPos, floorDepth, difficulty);

    const floorDiff: FloorDifficulty = {
      depth: floorDepth,
      taskCount: difficulty?.taskCount ?? 0,
      sessionMinutes: difficulty?.sessionMinutes ?? 0,
      tomatoCount: difficulty?.tomatoCount ?? 0,
    };

    const enemies = spawnForFloor({ cols, rows, tiles: this.tiles, rooms: this.rooms, playerStart, stairsPos, floorDepth, floorName: '', items, enemies: [], floorDifficulty: floorDiff }, floorDiff);

    return {
      cols, rows,
      tiles: this.tiles,
      rooms: this.rooms,
      playerStart,
      stairsPos,
      floorDepth,
      floorName: BspDungeonGenerator.floorName(floorDepth),
      items,
      enemies,
      floorDifficulty: floorDiff,
    };
  }

  // ─── Item Scattering ──────────────────────────────────────────────────────

  private scatterItems(
    cols: number,
    rows: number,
    playerStart: { col: number; row: number },
    stairsPos: { col: number; row: number },
    floorDepth: number,
    difficulty?: FloorDifficulty,
  ): FloorItem[] {
    const items: FloorItem[] = [];
    const occupiedTiles = new Set<string>();

    // Mark occupied tiles
    occupiedTiles.add(`${playerStart.col},${playerStart.row}`);
    occupiedTiles.add(`${stairsPos.col},${stairsPos.row}`);

    // Determine items per room based on spawn config and difficulty
    const cfg = this.spawnConfig;
    const itemsPerRoom = Math.min(
      3,
      cfg.itemsPerRoom + Math.floor(
        (difficulty?.depth ?? floorDepth) * cfg.depthMultiplier +
        (difficulty?.taskCount ?? 0) * cfg.taskMultiplier +
        (difficulty?.sessionMinutes ?? 0) * cfg.sessionMultiplier +
        (difficulty?.tomatoCount ?? 0) * cfg.tomatoMultiplier
      )
    );

    // Max items for this floor (default: rooms.length * 3)
    const maxItems = cfg.maxItemsPerFloor === 999 ? this.rooms.length * 3 : cfg.maxItemsPerFloor;

    // For each room (except the first), scatter items
    for (let i = 1; i < this.rooms.length; i++) {
      const room = this.rooms[i];
      const roomItems = Math.min(itemsPerRoom, 3);

      for (let attempt = 0; attempt < roomItems * 10 && items.length < maxItems; attempt++) {
        const col = room.col + Math.floor(this.rng() * room.w);
        const row = room.row + Math.floor(this.rng() * room.h);
        const key = `${col},${row}`;

        // Skip if tile is not walkable, already occupied, or is entrance/stairs
        if (!isWalkable(this.tiles[row][col]) || occupiedTiles.has(key)) {
          continue;
        }

        occupiedTiles.add(key);
        items.push({
          key: getRandomItemTemplate().key,
          col,
          row,
          pickedUp: false,
        });
        break;
      }
    }

    return items;
  }

  // ─── Seeded RNG (mulberry32) ──────────────────────────────────────────────

  private rng(): number {
    this.seed = (this.seed + 0x6d2b79f5) >>> 0;
    let z = Math.imul(this.seed ^ (this.seed >>> 15), 1 | this.seed);
    z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
    return ((z ^ (z >>> 14)) >>> 0) / 0x100000000;
  }

  // ─── Floor name ───────────────────────────────────────────────────────────

  static floorName(depth: number): string {
    if (depth <= 2) return 'The Pantry';
    if (depth <= 4) return 'The Fridge Depths';
    if (depth <= 6) return 'The Forgotten Tupperware';
    return 'The Spice Rack';
  }
}
