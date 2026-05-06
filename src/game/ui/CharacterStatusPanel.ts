/**
 * CharacterStatusPanel.ts
 *
 * Dev-only HTML overlay — stripped from production builds.
 * Only instantiate when import.meta.env.DEV === true.
 *
 * Binds to pre-existing #character-status-panel elements in index.html.
 * Shows live tile/room/floor/run-state info updated on every agent step.
 */

import { TilemapData, Room } from '../dungeon/DungeonTypes';
import { RunState } from '../managers/RunManager';

export class CharacterStatusPanel {
  private readonly container: HTMLDivElement;
  private readonly rows: Record<string, HTMLSpanElement> = {};

  constructor(_parent: HTMLElement) {
    this.container = document.getElementById('character-status-panel') as HTMLDivElement;

    const fieldMap: Record<string, string> = {
      tile:     'status-tile',
      type:     'status-type',
      room:     'status-room',
      floor:    'status-floor',
      runState: 'status-runstate',
    };

    for (const [key, id] of Object.entries(fieldMap)) {
      this.rows[key] = document.getElementById(id) as HTMLSpanElement;
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  update(col: number, row: number, map: TilemapData, runState: RunState): void {
    const tile = map.tiles[row][col];
    const room = this.findRoom(col, row, map.rooms);

    this.rows['tile'].textContent     = `${col}, ${row}`;
    this.rows['type'].textContent     = tile;
    this.rows['room'].textContent     = room
      ? `#${room.id + 1}  (${room.col},${room.row}  ${room.w}×${room.h})`
      : '—';
    this.rows['floor'].textContent    = `${map.floorDepth} — ${map.floorName}`;
    this.rows['runState'].textContent = runState;

    const typeColors: Record<string, string> = {
      floor:    '#aaddaa',
      corridor: '#aaaadd',
      stairs:   '#aaffaa',
      wall:     '#ff4444',
    };
    this.rows['type'].style.color = typeColors[tile] ?? '#ffffff';
  }

  show(): void { this.container.style.display = 'block'; }
  hide(): void { this.container.style.display = 'none'; }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private findRoom(col: number, row: number, rooms: Room[]): Room | undefined {
    return rooms.find(
      r => col >= r.col && col < r.col + r.w && row >= r.row && row < r.row + r.h,
    );
  }
}
