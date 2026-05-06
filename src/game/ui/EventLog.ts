/**
 * EventLog.ts
 *
 * Binds to pre-existing #event-log elements in index.html.
 * append(msg) adds a timestamped entry and auto-scrolls.
 * clear() resets the log for a new run.
 * show() / hide() controlled by GameScene.
 * 💾 Save Log exports log + ASCII map snapshot + player position to a .txt file.
 */

import { TilemapData, TileType } from '../dungeon/DungeonTypes';
import { tileToAsciiChar } from '../dungeon/TileRenderer';

/** A single cell divergence found by the parity check. */
export interface ParityDiff {
  col: number;
  row: number;
  modelTile: TileType;
  renderedIndex: number;
  layer: 'terrain' | 'fog';
}

export interface MapStateSnapshot {
  map: TilemapData;
  playerPos: { col: number; row: number };
  /** Optional set of revealed tiles (row * cols + col) for fog-aware export. */
  revealed?: boolean[][];
}

/** Callback supplied by GameScene to provide live state at save time. */
export type StateProvider = () => MapStateSnapshot | null;

export class EventLog {
  private readonly container: HTMLDivElement;
  private readonly header: HTMLDivElement;
  private readonly body: HTMLDivElement;
  private readonly footer: HTMLDivElement;
  private expanded = false;
  private entries: string[] = [];
  private stateProvider: StateProvider | null = null;
  private lastParityDiff: ParityDiff[] = [];

  /** Call this once after construction to wire up live map/player state. */
  setStateProvider(fn: StateProvider): void {
    this.stateProvider = fn;
  }

  /** Called by GameScene after each parity check to store the diff for export. */
  setLastParityDiff(diffs: ParityDiff[]): void {
    this.lastParityDiff = diffs;
  }

  constructor(_parent: HTMLElement) {
    this.container = document.getElementById('event-log')        as HTMLDivElement;
    this.header    = document.getElementById('event-log-header') as HTMLDivElement;
    this.body      = document.getElementById('event-log-body')   as HTMLDivElement;
    this.footer    = document.getElementById('event-log-footer') as HTMLDivElement;

    this.header.addEventListener('click', () => this.toggle());

    const saveBtn = document.getElementById('event-log-save') as HTMLButtonElement;
    saveBtn.addEventListener('click', (e) => { e.stopPropagation(); void this.saveToDisk(); });

    this.setCollapsed();
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  append(message: string): void {
    const now  = new Date();
    const time = `${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    this.entries.push(`[${time}] ${message}`);

    if (this.entries.length > 200) this.entries.shift();

    this.render();

    if (this.expanded) {
      this.body.scrollTop = this.body.scrollHeight;
    }
  }

  clear(): void {
    this.entries = [];
    this.render();
  }

  /** Returns a copy of all log entries (used by save). */
  getEntries(): string[] {
    return [...this.entries];
  }

  show(): void { this.container.style.display = 'flex'; }
  hide(): void { this.container.style.display = 'none'; }

  // ─── Save to disk ─────────────────────────────────────────────────────────

  async saveToDisk(): Promise<void> {
    const date     = new Date();
    const stamp    = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}_${String(date.getHours()).padStart(2,'0')}-${String(date.getMinutes()).padStart(2,'0')}`;
    const filename = `tomato-crawler-log_${stamp}.txt`;

    const lines: string[] = [
      `Tomato Crawler — Session Log`,
      `Generated: ${date.toLocaleString()}`,
      '─'.repeat(60),
    ];

    const snapshot = this.stateProvider?.() ?? null;
    if (snapshot) {
      const { map, playerPos, revealed } = snapshot;
      lines.push('');
      lines.push(`MAP SNAPSHOT  —  Floor ${map.floorDepth}: ${map.floorName}`);
      lines.push(`Dimensions   : ${map.cols} cols × ${map.rows} rows`);
      lines.push(`Rooms        : ${map.rooms.length}`);
      lines.push(`Player pos   : col ${playerPos.col}, row ${playerPos.row}`);
      lines.push(`Stairs pos   : col ${map.stairsPos.col}, row ${map.stairsPos.row}`);
      lines.push('');
      lines.push('Legend: # wall  . floor  + corridor  > stairs  @ player  E entrance');
      if (revealed) lines.push('        (fog-aware: space = undiscovered)');
      lines.push('');
      lines.push(...this.renderAsciiMap(map, playerPos, revealed ?? null));
      lines.push('');
      lines.push('─'.repeat(60));
    }

    lines.push('');
    lines.push('EVENT LOG');
    lines.push('─'.repeat(60));
    lines.push(...this.entries);

    if (this.lastParityDiff.length > 0) {
      lines.push('');
      lines.push('─'.repeat(60));
      lines.push(`RENDER PARITY DIFF  —  ${this.lastParityDiff.length} divergence(s) (showing first ${Math.min(this.lastParityDiff.length, 20)})`);
      lines.push('Layer    Col  Row  Model Tile   Rendered GID');
      for (const d of this.lastParityDiff.slice(0, 20)) {
        lines.push(`${d.layer.padEnd(8)} ${String(d.col).padStart(4)} ${String(d.row).padStart(4)}  ${d.modelTile.padEnd(12)} ${d.renderedIndex}`);
      }
    }

    const content = lines.join('\n');

    if ('showSaveFilePicker' in globalThis) {
      try {
        const handle = await (globalThis as typeof globalThis & {
          showSaveFilePicker: (opts: object) => Promise<FileSystemFileHandle>;
        }).showSaveFilePicker({
          suggestedName: filename,
          startIn: 'documents',
          types: [{ description: 'Text file', accept: { 'text/plain': ['.txt'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
        return;
      } catch {
        // User cancelled or API unavailable — fall through to download
      }
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── ASCII map renderer ───────────────────────────────────────────────────

  private renderAsciiMap(
    map: TilemapData,
    playerPos: { col: number; row: number },
    revealed: boolean[][] | null,
  ): string[] {
    const lines: string[] = [];
    for (let r = 0; r < map.rows; r++) {
      let row = '';
      for (let c = 0; c < map.cols; c++) {
        if (revealed && !revealed[r][c]) { row += ' '; continue; }
        const isPlayer = r === playerPos.row && c === playerPos.col;
        row += tileToAsciiChar(map.tiles[r][c], isPlayer);
      }
      lines.push(row);
    }
    return lines;
  }

  // ─── Rendering ────────────────────────────────────────────────────────────

  private toggle(): void {
    this.expanded = !this.expanded;
    if (this.expanded) {
      this.setExpanded();
    } else {
      this.setCollapsed();
    }
  }

  private setCollapsed(): void {
    this.header.textContent = '▶ Event Log';
    this.body.style.display = 'none';
    this.footer.style.display = 'none';
    this.render();
  }

  private setExpanded(): void {
    this.header.textContent = '▼ Event Log';
    this.body.style.display = 'block';
    this.footer.style.display = 'flex';
    this.render();
    this.body.scrollTop = this.body.scrollHeight;
  }

  private render(): void {
    if (this.expanded) {
      this.body.innerHTML = this.entries
        .map(e => `<div style="padding:1px 0;opacity:0.85">${this.escape(e)}</div>`)
        .join('');
    } else {
      const last3 = this.entries.slice(-3);
      this.header.innerHTML =
        `<span style="opacity:0.6;font-size:10px;">▶ Log</span>` +
        (last3.length > 0
          ? `<div style="margin-top:3px;opacity:0.75;font-size:10px;">${this.escape(last3.at(-1) ?? '')}</div>`
          : '');
    }
  }


  private escape(s: string): string {
    return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  }
}
