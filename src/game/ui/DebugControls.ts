/**
 * DebugControls.ts
 *
 * Dev-only HTML overlay — stripped from production builds.
 * Only instantiate when import.meta.env.DEV === true.
 *
 * Binds to pre-existing #debug-controls elements in index.html.
 * Populates slider grids and legend dynamically on construction.
 */

import { PlayerAgent } from '../agents/PlayerAgent';
import { RunManager } from '../managers/RunManager';
import { BspDungeonGenerator } from '../dungeon/BspDungeonGenerator';
import { TilemapData, MapConfig, DEFAULT_MAP_CONFIG, ItemSpawnConfig, DEFAULT_ITEM_SPAWN_CONFIG } from '../dungeon/DungeonTypes';
import { EventLog } from './EventLog';

type LoadFloorFn = (map: TilemapData) => void;
type FogFn       = () => void;
type DevFn       = () => void;

export class DebugControls {
  private readonly container: HTMLDivElement;
  private readonly buttonRow: HTMLDivElement;

  // bound references set via bind()
  private agent!: PlayerAgent;
  private runManager!: RunManager;
  private generator!: BspDungeonGenerator;
  private loadFloor!: LoadFloorFn;
  private eventLog!: EventLog;
  private revealAll!: FogFn;
  private fogAll!: FogFn;
  private toggleGridFn!: DevFn;
  private runParityCheckFn!: DevFn;

  private revealed = false;
  private readonly revealBtn: HTMLButtonElement;
  private readonly mapConfig: MapConfig = { ...DEFAULT_MAP_CONFIG };
  private readonly spawnConfig: ItemSpawnConfig = { ...DEFAULT_ITEM_SPAWN_CONFIG };

  constructor(_parent: HTMLElement) {
    this.container = document.getElementById('debug-controls')  as HTMLDivElement;
    this.buttonRow = document.getElementById('debug-btn-row')   as HTMLDivElement;
    this.revealBtn = document.getElementById('debug-btn-reveal') as HTMLButtonElement;

    // Wire up static buttons
    (document.getElementById('debug-btn-play')    as HTMLButtonElement).addEventListener('click', () => this.onPlay());
    (document.getElementById('debug-btn-pause')   as HTMLButtonElement).addEventListener('click', () => this.onPause());
    (document.getElementById('debug-btn-resume')  as HTMLButtonElement).addEventListener('click', () => this.onResume());
    (document.getElementById('debug-btn-restart') as HTMLButtonElement).addEventListener('click', () => this.onRestart());
    this.revealBtn.addEventListener('click', () => this.onReveal());
    (document.getElementById('debug-btn-grid')    as HTMLButtonElement).addEventListener('click', () => this.toggleGridFn?.());
    (document.getElementById('debug-btn-parity')  as HTMLButtonElement).addEventListener('click', () => this.runParityCheckFn?.());

    // Populate dynamic slider grids
    const mapGrid   = document.getElementById('debug-map-config-grid')   as HTMLDivElement;
    const spawnGrid = document.getElementById('debug-spawn-config-grid') as HTMLDivElement;

    this.addSlider(mapGrid, 'Cols',     20, 120, this.mapConfig.cols,         v => this.mapConfig.cols = v);
    this.addSlider(mapGrid, 'Rows',     16,  80, this.mapConfig.rows,         v => this.mapConfig.rows = v);
    this.addSlider(mapGrid, 'Min Room',  3,   8, this.mapConfig.minRoom,      v => this.mapConfig.minRoom = v);
    this.addSlider(mapGrid, 'Max Room',  5,  16, this.mapConfig.maxRoom,      v => this.mapConfig.maxRoom = v);
    this.addHint(mapGrid, 'Changes apply on next ↺ Restart.');

    this.addSlider(spawnGrid, 'Items/Room',   0,   5, this.spawnConfig.itemsPerRoom,      v => { this.spawnConfig.itemsPerRoom = v;      this.generator?.setSpawnConfig(this.spawnConfig); });
    this.addSlider(spawnGrid, 'Depth Mult',   0,   1, this.spawnConfig.depthMultiplier,   v => { this.spawnConfig.depthMultiplier = v;   this.generator?.setSpawnConfig(this.spawnConfig); }, 0.1);
    this.addSlider(spawnGrid, 'Task Mult',    0,   1, this.spawnConfig.taskMultiplier,    v => { this.spawnConfig.taskMultiplier = v;    this.generator?.setSpawnConfig(this.spawnConfig); }, 0.1);
    this.addSlider(spawnGrid, 'Session Mult', 0, 0.2, this.spawnConfig.sessionMultiplier, v => { this.spawnConfig.sessionMultiplier = v; this.generator?.setSpawnConfig(this.spawnConfig); }, 0.01);
    this.addSlider(spawnGrid, 'Tomato Mult',  0, 0.2, this.spawnConfig.tomatoMultiplier,  v => { this.spawnConfig.tomatoMultiplier = v;  this.generator?.setSpawnConfig(this.spawnConfig); }, 0.01);
    this.addHint(spawnGrid, 'Live changes. Affects next floor.');

    // Populate tile legend
    this.buildLegend(document.getElementById('debug-legend-list') as HTMLDivElement);
  }

  // ─── Binding ──────────────────────────────────────────────────────────────

  bind(opts: {
    agent: PlayerAgent;
    runManager: RunManager;
    generator: BspDungeonGenerator;
    loadFloor: LoadFloorFn;
    eventLog: EventLog;
    revealAll: FogFn;
    fogAll: FogFn;
    toggleGrid: DevFn;
    runParityCheck: DevFn;
  }): void {
    this.agent            = opts.agent;
    this.runManager       = opts.runManager;
    this.generator        = opts.generator;
    this.loadFloor        = opts.loadFloor;
    this.eventLog         = opts.eventLog;
    this.revealAll        = opts.revealAll;
    this.fogAll           = opts.fogAll;
    this.toggleGridFn     = opts.toggleGrid;
    this.runParityCheckFn = opts.runParityCheck;
    this.generator.setConfig(this.mapConfig);
    this.generator.setSpawnConfig(this.spawnConfig);
  }

  show(): void { this.container.style.display = 'flex'; }
  hide(): void { this.container.style.display = 'none'; }

  // ─── Button actions ───────────────────────────────────────────────────────

  private onPlay(): void {
    if (this.runManager.getState() === 'idle') {
      this.runManager.startRun();
    }
  }

  private onPause(): void {
    this.agent.stop();
  }

  private onResume(): void {
    if (this.runManager.getState() === 'running') {
      this.agent.start();
    }
  }

  private onRestart(): void {
    const state = this.runManager.getState();
    if (state !== 'idle') {
      this.agent.stop();
      this.runManager.retreat();
      this.eventLog.append('[DEV] Run restarted via retreat.');
      return;
    }
    const newMap = this.generator.generate(1);
    this.loadFloor(newMap);
    this.eventLog.clear();
    this.eventLog.append('[DEV] Fresh floor loaded.');
  }

  private onReveal(): void {
    if (this.revealed) {
      this.fogAll();
      this.revealed = false;
      this.revealBtn.textContent = '👁 Reveal';
    } else {
      this.revealAll();
      this.revealed = true;
      this.revealBtn.textContent = '🌫 Re-fog';
    }
  }

  // ─── Tile legend ──────────────────────────────────────────────────────────

  private buildLegend(list: HTMLDivElement): void {
    list.style.cssText = 'display:grid;grid-template-columns:14px 16px 1fr;gap:3px 8px;align-items:center;padding:6px 4px 4px;';
    const TILES = [
      { label: 'Wall',     color: '#4a3728', char: '#', desc: 'Impassable — solid dungeon wall' },
      { label: 'Floor',    color: '#cccccc', char: '.', desc: 'Room interior tile' },
      { label: 'Corridor', color: '#666666', char: '+', desc: 'Passage between rooms' },
      { label: 'Entrance', color: '#ff8800', char: 'E', desc: 'Player spawn on this floor' },
      { label: 'Stairs',   color: '#00ff44', char: '>', desc: 'Descend to next floor' },
      { label: 'Player',   color: '#4488ff', char: '@', desc: 'The Tomato — current position' },
      { label: 'Fog',      color: '#000000', char: ' ', desc: 'Undiscovered — not yet revealed' },
    ];

    for (const t of TILES) {
      const swatch = document.createElement('div');
      swatch.style.cssText = [
        `background:${t.color}`,
        'width:12px', 'height:12px', 'border-radius:2px',
        t.color === '#000000' ? 'border:1px solid #555' : 'border:1px solid #33333388',
      ].join(';');

      const ch = document.createElement('span');
      ch.textContent = t.char;
      ch.style.cssText = 'color:#ffdd66;text-align:center;font-weight:bold;';

      const text = document.createElement('span');
      text.style.cssText = 'color:#cccccc;';
      text.innerHTML = `<span style="color:#ffffff;">${t.label}</span> <span style="opacity:0.55;font-size:10px;">${t.desc}</span>`;

      list.appendChild(swatch);
      list.appendChild(ch);
      list.appendChild(text);
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private addHint(grid: HTMLElement, text: string): void {
    const hint = document.createElement('div');
    hint.textContent = text;
    hint.style.cssText = 'grid-column:1 / -1;color:#888;font-size:10px;padding-top:4px;';
    grid.appendChild(hint);
  }

  private addSlider(
    grid: HTMLElement,
    name: string,
    min: number,
    max: number,
    initial: number,
    onChange: (value: number) => void,
    step: number = 1,
  ): void {
    const label = document.createElement('span');
    label.textContent = name;

    const input = document.createElement('input');
    input.type = 'range';
    input.min  = String(min);
    input.max  = String(max);
    input.step = String(step);
    input.value = String(initial);
    input.style.cssText = 'width:140px;';

    const valueSpan = document.createElement('span');
    const formatValue = (v: number) => step < 1 ? v.toFixed(2) : String(Math.round(v));
    valueSpan.textContent = formatValue(initial);
    valueSpan.style.cssText = 'min-width:40px;text-align:right;color:#ffdd66;';

    input.addEventListener('input', () => {
      const v = Number(input.value);
      valueSpan.textContent = formatValue(v);
      onChange(v);
      if (name.startsWith('Col') || name.startsWith('Row') || name.includes('Room')) {
        this.generator?.setConfig(this.mapConfig);
      }
    });

    grid.appendChild(label);
    grid.appendChild(input);
    grid.appendChild(valueSpan);
  }
}
