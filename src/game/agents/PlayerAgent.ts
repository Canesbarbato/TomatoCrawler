/**
 * PlayerAgent.ts
 *
 * Autonomous player character controller.
 * The Tomato navigates the dungeon without any player input:
 *  - BFS to the nearest unvisited room, weighted by BehaviourProfile
 *  - Steps one tile every MOVE_INTERVAL_MS milliseconds
 *  - Emits events for fog reveal, room entry, stairs reached
 *
 * Behaviour weights (0–10):
 *   explore  → high = visit all rooms before heading to stairs
 *   exit     → high = skip unvisited rooms and rush to stairs
 *   fight    → wired but dormant until Phase 3 adds enemies
 */

import Phaser from 'phaser';
import { TilemapData, Room, BehaviourProfile, DEFAULT_BEHAVIOUR, isWalkable, FloorEnemy } from '../dungeon/DungeonTypes';

export class PlayerAgent extends Phaser.Events.EventEmitter {
  /** Milliseconds between each tile step. */
  static readonly MOVE_INTERVAL_MS = 120;

  /** Reveal radius when inside a room. */
  static readonly FOG_RADIUS_ROOM = 3;

  /** Forward reveal distance when in a corridor (flashlight). */
  static readonly FOG_REACH_CORRIDOR = 5;

  private col: number;
  private row: number;
  private prevCol: number;
  private prevRow: number;
  private map: TilemapData;
  private behaviour: BehaviourProfile;
  private readonly visitedRooms = new Set<number>();
  /** Every tile coordinate ever stepped on this floor (`row * cols + col`). */
  private readonly visitedTiles = new Set<number>();
  /** Consecutive corridor steps; resets on entering a room or stairs. */
  private corridorDwellCount = 0;
  /** Loop-break threshold — recompute path after this many corridor steps. */
  private static readonly CORRIDOR_DWELL_LIMIT = 8;
  private path: Array<{ col: number; row: number }> = [];
  private moveTimer?: Phaser.Time.TimerEvent;
  private readonly scene: Phaser.Scene;
  private active = false;
  /** Current floor enemies — set by GameScene after floor load and combat. */
  private enemies: FloorEnemy[] = [];

  constructor(scene: Phaser.Scene, map: TilemapData, behaviour: BehaviourProfile = DEFAULT_BEHAVIOUR) {
    super();
    this.scene    = scene;
    this.map      = map;
    this.behaviour = behaviour;
    this.col      = map.playerStart.col;
    this.row      = map.playerStart.row;
    this.prevCol  = this.col;
    this.prevRow  = this.row;
    this.visitedTiles.add(this.row * map.cols + this.col);
  }

  getPos(): { col: number; row: number } {
    return { col: this.col, row: this.row };
  }

  /** Called by GameScene after floor load and after each combat ends. */
  setEnemies(enemies: FloorEnemy[]): void {
    this.enemies = enemies;
  }

  start(): void {
    this.active = true;
    this.schedule();
  }

  stop(): void {
    this.active = false;
    this.moveTimer?.remove();
    this.moveTimer = undefined;
  }

  loadFloor(map: TilemapData, behaviour?: BehaviourProfile): void {
    this.stop();
    this.map       = map;
    this.behaviour = behaviour ?? this.behaviour;
    this.col       = map.playerStart.col;
    this.row       = map.playerStart.row;
    this.prevCol   = this.col;
    this.prevRow   = this.row;
    this.visitedRooms.clear();
    this.visitedTiles.clear();
    this.visitedTiles.add(this.row * map.cols + this.col);
    this.corridorDwellCount = 0;
    this.path = [];
  }

  // ─── Movement loop ───────────────────────────────────────────────────────────

  private schedule(): void {
    if (!this.active) return;
    this.moveTimer = this.scene.time.delayedCall(PlayerAgent.MOVE_INTERVAL_MS, () => this.step());
  }

  private step(): void {
    if (!this.active) return;

    // Loop-break safeguard: if The Tomato has been wandering corridors for
    // too long without entering a room, discard the current path and
    // recompute toward the unvisited room with the most unvisited tiles.
    if (this.corridorDwellCount > PlayerAgent.CORRIDOR_DWELL_LIMIT) {
      this.path = [];
      this.corridorDwellCount = 0;
    }

    if (this.path.length > 0) {
      const next = this.path.shift()!;
      this.moveTo(next.col, next.row);
      this.schedule();
      return;
    }

    const target = this.nextTarget();
    if (!target) {
      // Nowhere left — head to stairs as final fallback
      const stairs = this.bfs({ col: this.col, row: this.row }, this.map.stairsPos);
      if (stairs.length > 0) { this.path = stairs; }
      this.schedule();
      return;
    }

    const newPath = this.bfs({ col: this.col, row: this.row }, target);
    if (newPath.length === 0) {
      const blocked = this.getRoomAt(target.col, target.row);
      if (blocked) this.visitedRooms.add(blocked.id);
      this.schedule();
      return;
    }

    this.path = newPath;
    this.schedule();
  }

  private moveTo(col: number, row: number): void {
    // Absolute bounds clamp — coordinates must be inside the map grid.
    const maxCol = this.map.cols - 1;
    const maxRow = this.map.rows - 1;
    if (col < 0 || row < 0 || col > maxCol || row > maxRow) {
      this.path = [];
      this.corridorDwellCount = 0;
      this.schedule();
      return;
    }
    // Hard wall rejection — wall tiles are never walkable.
    if (this.map.tiles[row][col] === 'wall') {
      this.path = [];
      this.corridorDwellCount = 0;
      this.schedule();
      return;
    }
    // General walkability guard.
    if (!isWalkable(this.map.tiles[row][col])) {
      this.path = [];
      this.corridorDwellCount = 0;
      this.schedule();
      return;
    }

    this.prevCol = this.col;
    this.prevRow = this.row;
    this.col = col;
    this.row = row;
    this.visitedTiles.add(row * this.map.cols + col);
    this.emit('moved', col, row, this.prevCol, this.prevRow);
    this.checkTile();
  }

  private checkTile(): void {
    const tile = this.map.tiles[this.row][this.col];

    if (tile === 'stairs') {
      this.corridorDwellCount = 0;
      this.emit('stairsReached');
      return;
    }

    // Corridor entry event — emitted once per corridor segment transition
    if (tile === 'corridor') {
      const prevTile = this.map.tiles[this.prevRow][this.prevCol];
      if (prevTile !== 'corridor') {
        this.corridorDwellCount = 1;
        this.emit('corridorEntered');
      } else {
        this.corridorDwellCount++;
      }
      return;
    }

    // Floor / entrance tile — reset corridor dwell counter
    this.corridorDwellCount = 0;

    // Phase 3.F: Check for nearby items (Chebyshev distance ≤ 1)
    this.checkItemPickup();

    // Phase 3.E: Check for nearby enemies (Chebyshev distance ≤ 1)
    this.checkEnemyProximity();

    const room = this.getRoomAt(this.col, this.row);
    if (room && !this.visitedRooms.has(room.id)) {
      this.visitedRooms.add(room.id);
      this.emit('roomEntered', room);
    }
  }

  // ─── Item pickup (Phase 3.F) ──────────────────────────────────────────────────

  private checkItemPickup(): void {
    // Scan all unpicked items for Chebyshev distance ≤ 1
    for (const item of this.map.items) {
      if (item.pickedUp) continue;

      const dx = Math.abs(item.col - this.col);
      const dy = Math.abs(item.row - this.row);

      if (dx <= 1 && dy <= 1) {
        item.pickedUp = true;
        this.emit('itemPickedUp', { item, col: item.col, row: item.row });
      }
    }
  }

  // ─── Enemy proximity (Phase 3.E) ─────────────────────────────────────────────

  private checkEnemyProximity(): void {
    for (const enemy of this.enemies) {
      if (enemy.defeated) continue;
      const dx = Math.abs(enemy.col - this.col);
      const dy = Math.abs(enemy.row - this.row);
      if (dx <= 1 && dy <= 1) {
        this.active = false;
        this.moveTimer?.remove();
        this.moveTimer = undefined;
        this.emit('combatStarted', enemy);
        return;
      }
    }
  }

  // ─── Behaviour-weighted target selection ─────────────────────────────────────

  private nextTarget(): { col: number; row: number } | null {
    const { explore, exit } = this.behaviour;
    const total = explore + exit;

    // When exit weight dominates, skip rooms and rush to stairs
    if (total > 0 && Math.random() < exit / total) {
      return this.map.stairsPos;
    }

    // Otherwise pick the unvisited room with the most unvisited floor tiles —
    // richer exploration than "first-room-in-list".
    const cols = this.map.cols;
    let best: { room: Room; score: number } | null = null;

    for (const room of this.map.rooms) {
      if (this.visitedRooms.has(room.id)) continue;

      let unvisited = 0;
      for (let r = room.row; r < room.row + room.h; r++) {
        for (let c = room.col; c < room.col + room.w; c++) {
          if (!this.visitedTiles.has(r * cols + c)) unvisited++;
        }
      }

      if (!best || unvisited > best.score) {
        best = { room, score: unvisited };
      }
    }

    if (best) {
      return {
        col: best.room.col + Math.floor(best.room.w / 2),
        row: best.room.row + Math.floor(best.room.h / 2),
      };
    }

    // All rooms visited — head to stairs
    return this.map.stairsPos;
  }

  // ─── BFS ─────────────────────────────────────────────────────────────────────

  private bfs(
    from: { col: number; row: number },
    to:   { col: number; row: number },
  ): Array<{ col: number; row: number }> {
    const { cols, rows, tiles } = this.map;
    const idx = (c: number, r: number) => r * cols + c;
    const visited = new Set<number>();
    const parent  = new Map<number, number>();
    const queue: Array<{ col: number; row: number }> = [from];
    visited.add(idx(from.col, from.row));

    const DIRS = [
      { dc: 0, dr: -1 }, { dc: 0, dr: 1 },
      { dc: -1, dr: 0 }, { dc: 1, dr: 0 },
    ];

    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (cur.col === to.col && cur.row === to.row) {
        const path: Array<{ col: number; row: number }> = [];
        let k = idx(cur.col, cur.row);
        while (parent.has(k)) {
          path.unshift({ col: k % cols, row: Math.floor(k / cols) });
          k = parent.get(k)!;
        }
        return path;
      }
      for (const { dc, dr } of DIRS) {
        const nc = cur.col + dc;
        const nr = cur.row + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const t = tiles[nr][nc];
        if (t === 'wall') continue;           // explicit wall rejection
        if (!isWalkable(t)) continue;         // catch any other non-walkable type
        const nk = idx(nc, nr);
        if (visited.has(nk)) continue;
        visited.add(nk);
        parent.set(nk, idx(cur.col, cur.row));
        queue.push({ col: nc, row: nr });
      }
    }
    return [];
  }

  private getRoomAt(col: number, row: number): Room | undefined {
    return this.map.rooms.find(
      r => col >= r.col && col < r.col + r.w && row >= r.row && row < r.row + r.h,
    );
  }
}
