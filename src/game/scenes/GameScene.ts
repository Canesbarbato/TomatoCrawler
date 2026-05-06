/// <reference types="vite/client" />
/**
 * GameScene.ts
 *
 * Main gameplay scene. Wires together:
 *   BspDungeonGenerator → TilemapLayer terrain + FogModel/FogView fog
 *   PlayerAgent         → autonomous movement + behaviour-weighted routing
 *   RunManager          → run lifecycle state machine
 *   BehaviourSliderUI   → HTML overlay for pre-run behaviour sliders
 *   HUD                 → floor name, Sauce Points, ▶ Start button
 *
 * Phase 2.H — tilemap layers replace RenderTexture + Graphics.
 * Phase 3.B — item sprites added with fog-aware visibility.
 * Render order (depth):
 *   - terrain:  Phaser.Tilemaps.TilemapLayer  (depth 0)
 *   - fog:      Phaser.Tilemaps.TilemapLayer  (depth 5)  via FogView
 *   - items:    Phaser.GameObjects.Image      (depth 8)  via itemSprites Map
 *   - player:   Phaser.GameObjects.Image      (depth 10)
 *   - grid:     Phaser.GameObjects.Graphics   (depth 15, dev only)
 *   - HUD:      Phaser.GameObjects.Text       (depth 20, scroll-factor 0)
 * Single source of truth for tile mappings: TileRenderer.ts
 */

import Phaser from 'phaser';
import { AssetManifest } from '../assets/AssetManifest';
import { SessionStore } from '../../shared/SessionStore';
import { BspDungeonGenerator } from '../dungeon/BspDungeonGenerator';
import { TilemapData, BASE_STATS, BASE_CHARACTER_STATE, CharacterState, FloorEnemy } from '../dungeon/DungeonTypes';
import { tileToTilemapIndex, worldFromTile, UNDISCOVERED_GID, TILE_SIZE } from '../dungeon/TileRenderer';
import { PlayerAgent } from '../agents/PlayerAgent';
import { RunManager } from '../managers/RunManager';
import { BehaviourSliderUI } from '../ui/BehaviourSliderUI';
import { EventLog, ParityDiff } from '../ui/EventLog';
import { DebugControls } from '../ui/DebugControls';
import { CharacterStatusPanel } from '../ui/CharacterStatusPanel';
import { CharacterStatsPanel } from '../ui/CharacterStatsPanel';
import { InventoryPanel } from '../ui/InventoryPanel';
import { FogModel } from '../fog/FogModel';
import { FogView } from '../fog/FogView';
import { EventBus } from '../../shared/EventBus';
import { computeStats } from '../items/ItemTypes';
import { getItemTemplate } from '../items/ItemRegistry';
import { startCombat, resolveTurn } from '../enemies/CombatResolver';
import { CombatState } from '../enemies/EnemyTypes';
import { PomodoroManager, FOCUS_DURATION_MS } from '../../shared/PomodoroManager';
import { PomodoroHUD } from '../ui/PomodoroHUD';
import { TaskPanel } from '../ui/TaskPanel';
import { BreakOverlay } from '../ui/BreakOverlay';
import { EventBusMap } from '../../shared/EventBus';

const TILE = TILE_SIZE;

export class GameScene extends Phaser.Scene {
  private generator!: BspDungeonGenerator;
  private currentMap!: TilemapData;
  private agent!: PlayerAgent;
  private runManager!: RunManager;
  private sliderUI!: BehaviourSliderUI;
  private eventLog!: EventLog;

  // ── Rendering ──────────────────────────────────────────────────────────────
  private terrainMap!: Phaser.Tilemaps.Tilemap;
  private terrainLayer!: Phaser.Tilemaps.TilemapLayer;
  private fogMap!: Phaser.Tilemaps.Tilemap;
  private fogLayer!: Phaser.Tilemaps.TilemapLayer;
  private fogModel!: FogModel;
  private fogView!: FogView;
  private playerSprite!: Phaser.GameObjects.Image;

  // ── Dev ────────────────────────────────────────────────────────────────────
  private debugControls?: DebugControls;
  private statusPanel?: CharacterStatusPanel;
  private gridGraphics?: Phaser.GameObjects.Graphics;
  private gridVisible = false;
  private lastParityDiffs: ParityDiff[] = [];

  // ── HUD ───────────────────────────────────────────────────────────────────
  private hudFloor!: Phaser.GameObjects.Text;
  private hudSauce!: Phaser.GameObjects.Text;
  private hudStatus!: Phaser.GameObjects.Text;
  private btnStart!: Phaser.GameObjects.Text;
  private btnRetreat!: Phaser.GameObjects.Text;

  // ── Phase 3: Character Stats ───────────────────────────────────────────────
  private statsPanel!: CharacterStatsPanel;
  private inventoryPanel!: InventoryPanel;
  private characterState: CharacterState = { ...BASE_CHARACTER_STATE };
  private activeInventory: Array<{ template: any; pickedUpOnFloor: number }> = [];
  private speedBoostTimer?: Phaser.Time.TimerEvent;

  // ── Phase 3.B: Items on Map ────────────────────────────────────────────────
  private itemSprites: Map<string, Phaser.GameObjects.Image> = new Map();

  // ── Phase 3.E: Enemy sprites + combat ─────────────────────────────────────
  private enemySprites: Map<string, Phaser.GameObjects.Image> = new Map();
  private combatTimer?: Phaser.Time.TimerEvent;
  private activeCombatState?: CombatState;

  // ── Phase 4: Pomodoro UI ──────────────────────────────────────────────────
  private pomodoroHUD?: PomodoroHUD;
  private taskPanel?: TaskPanel;
  private breakOverlay?: BreakOverlay;
  private onBreakEndedBound!: (p: EventBusMap['breakEnded']) => void;
  private onPhaseChangedBound!: (p: EventBusMap['pomodoroPhaseChanged']) => void;

  constructor() { super({ key: 'GameScene' }); }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  create(): void {
    this.generator  = new BspDungeonGenerator();
    this.currentMap = this.generator.generate(1);

    this.buildTerrainLayer();
    this.buildFogLayer();
    this.buildPlayer();
    this.buildCamera();

    const profile = SessionStore.getState().behaviourProfile;
    this.agent      = new PlayerAgent(this, this.currentMap, profile);
    this.runManager = new RunManager();

    this.wireEvents();
    this.buildHUD();

    const parent = document.getElementById('game-container') ?? document.body;
    this.sliderUI = new BehaviourSliderUI(parent);
    this.eventLog = new EventLog(parent);
    this.eventLog.setStateProvider(() => ({
      map:       this.currentMap,
      playerPos: this.agent.getPos(),
      revealed:  this.fogModel.revealed,
    }));

    // Phase 3.A: Instantiate character stats panel (production-visible)
    this.statsPanel = new CharacterStatsPanel(parent);
    this.statsPanel.show();
    // Initialize with BASE_STATS and BASE_CHARACTER_STATE
    this.characterState = { ...BASE_CHARACTER_STATE };
    this.statsPanel.update(BASE_STATS, this.characterState);

    // Phase 3.H: Instantiate inventory panel (production-visible)
    this.inventoryPanel = new InventoryPanel(parent);
    this.inventoryPanel.show();
    this.inventoryPanel.setRunning(false);

    if (import.meta.env.DEV) {
      this.debugControls = new DebugControls(parent);
      this.debugControls.bind({
        agent:          this.agent,
        runManager:     this.runManager,
        generator:      this.generator,
        loadFloor:      (map) => this.loadFloor(map),
        eventLog:       this.eventLog,
        revealAll:      () => this.revealAll(),
        fogAll:         () => this.fogAll(),
        toggleGrid:     () => this.toggleGrid(),
        runParityCheck: () => this.runParityCheck(),
      });
      // Show the debug panel which contains sliderUI and eventLog
      this.debugControls.show();
      this.sliderUI.show();
      this.eventLog.show();

      this.statusPanel = new CharacterStatusPanel(parent);
      this.statusPanel.update(
        this.currentMap.playerStart.col,
        this.currentMap.playerStart.row,
        this.currentMap,
        this.runManager.getState(),
      );
    }

    // Initial reveal at spawn
    this.revealAround(
      this.currentMap.playerStart.col,
      this.currentMap.playerStart.row,
      this.currentMap.playerStart.col,
      this.currentMap.playerStart.row,
    );

    // Phase 3.B: Build item sprites after initial reveal
    this.buildItemSprites();

    // Phase 3.E: Build enemy sprites and register with agent
    this.buildEnemySprites();
    this.agent.setEnemies(this.currentMap.enemies);

    // Phase 4: Pomodoro UI
    const pomodoroBar = document.getElementById('pomodoro-bar') ?? document.body;
    this.pomodoroHUD  = new PomodoroHUD(pomodoroBar);
    this.taskPanel    = new TaskPanel(pomodoroBar);
    this.breakOverlay = new BreakOverlay(document.body);

    this.onBreakEndedBound  = () => this.onBreakEnded();
    this.onPhaseChangedBound = (p) => {
      if (p === 'short-break' || p === 'long-break') {
        this.breakOverlay?.show(p);
      }
    };
    EventBus.on('breakEnded',           this.onBreakEndedBound);
    EventBus.on('pomodoroPhaseChanged', this.onPhaseChangedBound);

    // If a break was already in progress when the page loaded, show it.
    const existingPhase = SessionStore.getState().pomodoroPhase;
    if (existingPhase === 'short-break' || existingPhase === 'long-break') {
      this.breakOverlay.show(existingPhase);
    }
  }

  // ─── Terrain layer ─────────────────────────────────────────────────────────

  private buildTerrainLayer(): void {
    this.terrainMap?.destroy();

    const { cols, rows, tiles } = this.currentMap;
    const data = tiles.map(row => row.map(t => tileToTilemapIndex(t)));

    const tmap = this.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
    const tileset = tmap.addTilesetImage('tileset', 'tileset', TILE, TILE, 0, 0)!;
    const layer   = tmap.createLayer(0, tileset, 0, 0)!;
    layer.setDepth(0);

    this.terrainMap   = tmap;
    this.terrainLayer = layer;
  }

  // ─── Fog layer ───────────────────────────────────────��─────────────────────

  private buildFogLayer(): void {
    this.fogMap?.destroy();

    const { cols, rows } = this.currentMap;
    // Start fully fogged — every tile is UNDISCOVERED_GID
    const fogData = Array.from({ length: rows }, () =>
      new Array<number>(cols).fill(UNDISCOVERED_GID),
    );

    const fmap    = this.make.tilemap({ data: fogData, tileWidth: TILE, tileHeight: TILE });
    const tileset = fmap.addTilesetImage('tileset', 'tileset', TILE, TILE, 0, 0)!;
    const layer   = fmap.createLayer(0, tileset, 0, 0)!;
    layer.setDepth(5);

    this.fogMap   = fmap;
    this.fogLayer = layer;
    this.fogModel = new FogModel(this.currentMap);
    this.fogView  = new FogView(fmap, layer);
  }

  // ─── Fog of war ────────────────────────────────────────────────────────────

  private revealAround(col: number, row: number, prevCol: number, prevRow: number): void {
    const tile = this.currentMap.tiles[row][col];
    const deltas = tile === 'corridor'
      ? this.fogModel.revealCorridor(col, row, col - prevCol, row - prevRow)
      : this.fogModel.revealRoom(col, row);
    this.fogView.applyDeltas(deltas);

    // Phase 3.B: Update item visibility based on newly revealed tiles
    this.updateItemVisibility();

    // Phase 3.E: Update enemy visibility
    this.updateEnemyVisibility();
  }

  private revealAll(): void {
    const deltas = this.fogModel.revealAll();
    this.fogView.applyDeltas(deltas);
  }

  private fogAll(): void {
    this.fogModel.fogAll();
    this.fogView.fogAll(this.currentMap.cols, this.currentMap.rows);
  }

  // ─── Player sprite ─────────────────────────────────────────────────────────

  private buildPlayer(): void {
    const { x, y } = worldFromTile(this.currentMap.playerStart.col, this.currentMap.playerStart.row);
    if (this.playerSprite) {
      this.playerSprite.setPosition(x, y);
    } else {
      this.playerSprite = this.add
        .image(x, y, AssetManifest.player.key)
        .setDepth(10)
        .setOrigin(0.5, 0.5);
    }
  }

  // ─── Camera ────────────────────────────────────────────────────────────────

  private buildCamera(): void {
    const { cols, rows } = this.currentMap;
    const { x, y } = worldFromTile(this.currentMap.playerStart.col, this.currentMap.playerStart.row);
    this.cameras.main.setBounds(0, 0, cols * TILE, rows * TILE);
    this.cameras.main.centerOn(x, y);
    this.cameras.main.startFollow(this.playerSprite, true, 0.12, 0.12);
  }

  // ─── Floor load ────────────────────────────────────────────────────────────

  private loadFloor(map: TilemapData): void {
    this.currentMap = map;
    this.buildTerrainLayer();
    this.buildFogLayer();

    // Re-attach the eventLog state provider after new FogModel is created
    this.eventLog?.setStateProvider(() => ({
      map:       this.currentMap,
      playerPos: this.agent.getPos(),
      revealed:  this.fogModel.revealed,
    }));

    const profile = SessionStore.getState().behaviourProfile;
    this.agent.loadFloor(map, profile);

    const { x, y } = worldFromTile(map.playerStart.col, map.playerStart.row);
    this.playerSprite.setPosition(x, y);
    this.cameras.main.setBounds(0, 0, map.cols * TILE, map.rows * TILE);
    this.cameras.main.stopFollow();
    this.cameras.main.centerOn(x, y);
    this.cameras.main.startFollow(this.playerSprite, true, 0.12, 0.12);

    this.revealAround(
      map.playerStart.col, map.playerStart.row,
      map.playerStart.col, map.playerStart.row,
    );

    // Rebuild grid overlay for new map dimensions (dev only)
    if (import.meta.env.DEV && this.gridVisible) {
      this.buildGridOverlay();
    }

    // Phase 3.B: Rebuild item sprites
    this.buildItemSprites();

    // Phase 3.E: Rebuild enemy sprites and register with agent
    this.buildEnemySprites();
    this.agent.setEnemies(this.currentMap.enemies);

    // Phase 3.F: Update stats panel with current character state
    const newStats = computeStats(
      this.activeInventory.map(inv => ({
        template: inv.template,
        pickedUpOnFloor: inv.pickedUpOnFloor,
      })),
    );
    this.statsPanel.update(newStats, this.characterState);

    // Phase 3.H: Update inventory panel
    this.inventoryPanel.update(this.activeInventory.map(inv => ({
      template: inv.template,
      pickedUpOnFloor: inv.pickedUpOnFloor,
    })));
  }

  // ─── Dev: grid overlay ─────────────────────────────────────────────────────

  private toggleGrid(): void {
    if (this.gridVisible) {
      this.gridGraphics?.destroy();
      this.gridGraphics = undefined;
      this.gridVisible  = false;
    } else {
      this.buildGridOverlay();
      this.gridVisible = true;
    }
  }

  private buildGridOverlay(): void {
    this.gridGraphics?.destroy();
    const { cols, rows } = this.currentMap;
    const g = this.add.graphics().setDepth(15).setScrollFactor(1);

    // Grid lines every 5 tiles
    g.lineStyle(1, 0xffffff, 0.15);
    for (let c = 0; c <= cols; c += 5) {
      g.moveTo(c * TILE, 0).lineTo(c * TILE, rows * TILE);
    }
    for (let r = 0; r <= rows; r += 5) {
      g.moveTo(0, r * TILE).lineTo(cols * TILE, r * TILE);
    }
    g.strokePath();

    // Col/row labels every 5 tiles
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'monospace', fontSize: '8px', color: '#ffffff44',
    };
    for (let c = 0; c < cols; c += 5) {
      for (let r = 0; r < rows; r += 5) {
        this.add.text(c * TILE + 1, r * TILE + 1, `${c},${r}`, style).setDepth(15);
      }
    }

    this.gridGraphics = g;
  }

  // ─── Dev: parity check ─────────────────────────────────────────────────────

  runParityCheck(): void {
    const { cols, rows, tiles } = this.currentMap;
    const diffs: ParityDiff[] = [];

    // Terrain: compare model tile type → expected GID vs. rendered GID
    outer:
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const expected = tileToTilemapIndex(tiles[r][c]);
        const rendered = this.terrainMap.getTileAt(c, r)?.index ?? -1;
        if (rendered !== expected) {
          diffs.push({ col: c, row: r, modelTile: tiles[r][c], renderedIndex: rendered, layer: 'terrain' });
          if (diffs.length >= 20) break outer;
        }
      }
    }

    // Fog: model.revealed[r][c] should match fog layer tile being -1 (empty = revealed)
    outer2:
    for (let r = 0; r < rows && diffs.length < 20; r++) {
      for (let c = 0; c < cols && diffs.length < 20; c++) {
        const modelRevealed  = this.fogModel.revealed[r][c];
        const fogTile        = this.fogMap.getTileAt(c, r);
        const layerRevealed  = fogTile === null || fogTile.index === -1;
        if (modelRevealed !== layerRevealed) {
          diffs.push({ col: c, row: r, modelTile: tiles[r][c], renderedIndex: fogTile?.index ?? -1, layer: 'fog' });
          if (diffs.length >= 20) break outer2;
        }
      }
    }

    this.lastParityDiffs = diffs;
    this.eventLog?.setLastParityDiff(diffs);

    if (diffs.length > 0) {
      const first = diffs[0];
      this.eventLog?.append(
        `⚠ PARITY: ${diffs.length} divergence(s). First — ${first.layer} [${first.col},${first.row}] model:'${first.modelTile}' rendered:${first.renderedIndex}`,
      );
    }
  }

  // ─── HUD ───────────────────────────────────────────────────────────────────

  private buildHUD(): void {
    const { width, height } = this.scale;
    const state = SessionStore.getState();

    const textStyle = (color = '#ffffff'): Phaser.Types.GameObjects.Text.TextStyle => ({
      fontFamily: 'monospace', fontSize: '12px', color,
      backgroundColor: '#000000bb', padding: { x: 7, y: 4 },
    });

    this.hudFloor = this.add.text(10, 10, 'The Tomato stands still. Menacingly.', textStyle())
      .setScrollFactor(0).setDepth(20);

    this.hudSauce = this.add
      .text(width - 10, 10, this.sauceLabel(state.saucePoints, state.tomatoCount), textStyle('#ffdd00'))
      .setScrollFactor(0).setDepth(20).setOrigin(1, 0);

    this.hudStatus = this.add.text(10, height - 10, 'Set behaviour above, then press ▶ START.', textStyle('#aaaaaa'))
      .setScrollFactor(0).setDepth(20).setOrigin(0, 1);

    this.btnStart = this.add
      .text(width - 10, height - 10, '▶  START', {
        fontFamily: 'monospace', fontSize: '14px',
        color: '#000000', backgroundColor: '#ff4444',
        padding: { x: 12, y: 7 },
      })
      .setScrollFactor(0).setDepth(20).setOrigin(1, 1)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.runManager.setMaxFloors(this.computeMaxFloors());
        this.runManager.startRun();
      })
      .on('pointerover', () => this.btnStart.setStyle({ backgroundColor: '#ff7777' }))
      .on('pointerout',  () => this.btnStart.setStyle({ backgroundColor: '#ff4444' }));

    this.btnRetreat = this.add
      .text(width / 2, height - 10, '⚠  RETREAT', {
        fontFamily: 'monospace', fontSize: '11px',
        color: '#ffffff', backgroundColor: '#884400',
        padding: { x: 10, y: 5 },
      })
      .setScrollFactor(0).setDepth(20).setOrigin(0.5, 1)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { this.agent.stop(); this.runManager.retreat(); });
  }

  private sauceLabel(sauce: number, tomatoes: number): string {
    return `🍅 ${tomatoes}   Sauce: ${sauce} pts`;
  }

  // ─── Event wiring ──────────────────────────────────────────────────────────

  private wireEvents(): void {
    this.agent.on('moved', (col: number, row: number, prevCol: number, prevRow: number) => {
      const { x, y } = worldFromTile(col, row);
      this.playerSprite.setPosition(x, y);
      this.revealAround(col, row, prevCol, prevRow);
      this.statusPanel?.update(col, row, this.currentMap, this.runManager.getState());
      EventBus.emit('movementChanged', true);
    });

    this.agent.on('corridorEntered', () => {
      this.eventLog.append('The Tomato squeezes into a corridor.');
      EventBus.emit('contextChanged', 'corridor');
    });

    this.agent.on('roomEntered', (room: { id: number }) => {
      this.eventLog.append(`The Tomato enters Room ${room.id + 1}.`);
      EventBus.emit('contextChanged', 'room');
    });

    this.agent.on('stairsReached', () => {
      this.eventLog.append('The Tomato finds the stairs. Reluctantly descends.');
      this.agent.stop();
      this.runManager.onStairsReached();
    });

    // Phase 3.E: Combat
    this.agent.on('combatStarted', (enemy: FloorEnemy) => {
      this.startCombat(enemy);
    });

    // Phase 3.F: Item pickup with consumable effect handling
    this.agent.on('itemPickedUp', (data: any) => {
      const { item, col, row } = data;
      const template = getItemTemplate(item.key);
      if (!template) return;

      // Remove sprite from map
      const spriteKey = `${col},${row}`;
      this.itemSprites.get(spriteKey)?.destroy();
      this.itemSprites.delete(spriteKey);

      // Add to active inventory
      this.activeInventory.push({ template, pickedUpOnFloor: this.currentMap.floorDepth });

      // Log pickup
      this.eventLog.append(`The Tomato picks up a ${template.name}.`);
      EventBus.emit('itemPickedUp', { key: item.key, name: template.name });

      // Handle consumable effects
      if (template.consumable) {
        // HP restore
        if (template.consumable.hp !== undefined) {
          const oldHp = this.characterState.hp;
          this.characterState.hp = Math.min(
            this.characterState.maxHp,
            this.characterState.hp + template.consumable.hp,
          );
          const healed = this.characterState.hp - oldHp;
          this.eventLog.append(`The Tomato drinks the ${template.name}. Healed ${healed} HP.`);
          EventBus.emit('hpRestored', healed);
        }

        // Speed boost
        if (template.consumable.speedBoost) {
          const { multiplier, durationMs } = template.consumable.speedBoost;
          this.eventLog.append(`The Tomato drinks the ${template.name}. Slides unusually fast.`);
          EventBus.emit('speedBoostStarted', null);

          // Apply speed boost temporarily
          this.speedBoostTimer?.remove();
          this.speedBoostTimer = this.time.delayedCall(durationMs, () => {
            this.eventLog.append('The speed boost wears off. The Tomato is again merely fast.');
            EventBus.emit('speedBoostEnded', null);
          });
        }
      }

      // Recalculate stats
      const newStats = computeStats(
        this.activeInventory.map(inv => ({
          template: inv.template,
          pickedUpOnFloor: inv.pickedUpOnFloor,
        })),
      );
      this.statsPanel.update(newStats, this.characterState);

      // Phase 3.H: Update inventory panel
      this.inventoryPanel.update(this.activeInventory.map(inv => ({
        template: inv.template,
        pickedUpOnFloor: inv.pickedUpOnFloor,
      })));
    });

    this.runManager.on('runStarted', (floor: number) => {
      EventBus.emit('movementChanged', true);
      this.eventLog.clear();
      this.eventLog.append(`Run started. Entering Floor ${floor} — ${this.currentMap.floorName}.`);
      if (import.meta.env.DEV) { this.sliderUI.hide(); }

      // Phase 4: Start focus timer & lock tasks
      PomodoroManager.startFocus(FOCUS_DURATION_MS);
      this.taskPanel?.setLocked(true);

      // Derive maxFloors from session task count for difficulty scaling
      // (RunManager already constructed; future runs will pick up task count)

      // Phase 3.F: Reset character state and inventory for new run
      this.characterState = { ...BASE_CHARACTER_STATE };
      this.activeInventory = [];
      this.speedBoostTimer?.remove();
      this.speedBoostTimer = undefined;
      this.statsPanel.update(BASE_STATS, this.characterState);

      // Phase 3.H: Set inventory panel to running state
      this.inventoryPanel.setRunning(true);
      this.inventoryPanel.update([]);

      this.agent.start();
      this.btnStart.setVisible(false);
      this.btnRetreat.setVisible(true);
      this.hudFloor.setText(`Floor ${floor} — ${this.currentMap.floorName}`);
      this.hudStatus.setText(`The Tomato ventures into ${this.currentMap.floorName}.`);
      this.statusPanel?.update(this.currentMap.playerStart.col, this.currentMap.playerStart.row, this.currentMap, 'running');
    });

    this.runManager.on('floorTransition', (from: number, to: number) => {
      this.eventLog.append(`Floor ${from} → Floor ${to}.`);
      this.hudStatus.setText('The Tomato eyes the next staircase. Suspiciously.');
      this.time.delayedCall(1200, () => {
        const newMap = this.generator.generate(to);
        this.loadFloor(newMap);
        this.runManager.advanceFloor();
      });
    });

    this.runManager.on('floorAdvanced', (floor: number) => {
      this.eventLog.append(`The Tomato enters ${this.currentMap.floorName}.`);
      this.hudFloor.setText(`Floor ${floor} — ${this.currentMap.floorName}`);
      this.hudStatus.setText(`The Tomato enters ${this.currentMap.floorName}.`);
      this.agent.start();

      // Auto parity check on every floor in dev
      if (import.meta.env.DEV) {
        this.time.delayedCall(100, () => this.runParityCheck());
      }
    });

    this.runManager.on('runEnd', (floorsReached: number) => {
      EventBus.emit('movementChanged', false);
      this.speedBoostTimer?.remove();
      this.speedBoostTimer = undefined;
      // Phase 3.H: Reset inventory panel state
      this.inventoryPanel.setRunning(false);
      // Phase 4: Advance Pomodoro cycle, unlock tasks
      PomodoroManager.onRunCompleted();
      this.taskPanel?.setLocked(false);
      const s = SessionStore.getState();
      const earned = s.runHistory.at(-1)?.saucePointsEarned ?? 0;
      this.eventLog.append(`Run complete. ${floorsReached} floor(s) cleared. ${earned} Sauce Points earned.`);
      this.btnRetreat.setVisible(false);
      this.hudFloor.setText(`Run complete — ${floorsReached} floor(s) cleared.`);
      this.hudStatus.setText('The Tomato has done enough. For now.');
      this.hudSauce.setText(this.sauceLabel(s.saucePoints, s.tomatoCount));
      this.showNewRunButton();
    });

    this.runManager.on('retreat', () => {
      EventBus.emit('movementChanged', false);
      this.speedBoostTimer?.remove();
      this.speedBoostTimer = undefined;
      // Phase 3.H: Reset inventory panel state
      this.inventoryPanel.setRunning(false);
      // Phase 4: Unlock tasks on retreat (no Pomodoro advance)
      this.taskPanel?.setLocked(false);
      this.eventLog.append('The Tomato retreated. Suspiciously quickly.');
      this.btnRetreat.setVisible(false);
      this.hudStatus.setText('The Tomato retreated. Suspiciously quickly.');
      this.showNewRunButton();
    });
  }

  private showNewRunButton(): void {
    if (import.meta.env.DEV) {
      this.sliderUI.show();
      this.eventLog.show();
    }
    this.btnStart
      .setText('▶  NEW RUN')
      .setVisible(true)
      .off('pointerdown')
      .on('pointerdown', () => {
        const profile = SessionStore.getState().behaviourProfile;
        const { tasks, tomatoCount } = SessionStore.getState();
        const taskCount = tasks.length;
        const difficulty = { depth: 1, taskCount, tomatoCount };
        const newMap = this.generator.generate(1, difficulty);
        this.loadFloor(newMap);
        this.agent.loadFloor(newMap, profile);
        this.runManager.setMaxFloors(this.computeMaxFloors());
        this.runManager.startRun();
      });
  }

  // ─── Combat orchestration (Phase 3.E) ─────────────────────────────────────

  private startCombat(enemy: FloorEnemy): void {
    const currentStats = computeStats(
      this.activeInventory.map(inv => ({ template: inv.template, pickedUpOnFloor: inv.pickedUpOnFloor })),
    );

    this.activeCombatState = startCombat(enemy, this.characterState.hp, currentStats);

    this.eventLog.append(`The Tomato engages the ${enemy.template.name}. Reluctantly.`);
    EventBus.emit('combatStarted', {
      enemy: enemy.template,
      playerHp: this.activeCombatState.playerHp,
      playerStats: currentStats,
    });

    this.combatTimer?.remove();
    this.combatTimer = this.time.addEvent({
      delay: 600,
      loop: true,
      callback: () => {
        if (!this.activeCombatState || this.activeCombatState.outcome !== 'ongoing') return;

        this.activeCombatState = resolveTurn(this.activeCombatState);
        const entry = this.activeCombatState.log.at(-1)!;
        EventBus.emit('combatTurnResolved', { entry, state: this.activeCombatState });

        if (this.activeCombatState.outcome !== 'ongoing') {
          this.combatTimer?.remove();
          this.combatTimer = undefined;
          this.endCombat(enemy, this.activeCombatState);
        }
      },
    });
  }

  private endCombat(enemy: FloorEnemy, state: CombatState): void {
    EventBus.emit('combatEnded', { outcome: state.outcome, enemy: enemy.template });

    if (state.outcome === 'player_won') {
      // Mark defeated, remove sprite
      enemy.defeated = true;
      const spriteKey = `${enemy.col},${enemy.row}`;
      this.enemySprites.get(spriteKey)?.destroy();
      this.enemySprites.delete(spriteKey);

      // Update HP
      this.characterState.hp = state.playerHp;
      const newStats = computeStats(
        this.activeInventory.map(inv => ({ template: inv.template, pickedUpOnFloor: inv.pickedUpOnFloor })),
      );
      this.statsPanel.update(newStats, this.characterState);

      this.eventLog.append(`The ${enemy.template.name} falls. Suspiciously crumbly.`);

      // Re-register enemies (defeated flag updated) and resume
      this.agent.setEnemies(this.currentMap.enemies);
      this.agent.start();
    } else {
      // enemy_won stub — player floors at 1 this phase, just resume
      console.warn('[Combat] enemy_won branch reached — player HP floored at 1, resuming.');
      this.agent.setEnemies(this.currentMap.enemies);
      this.agent.start();
    }

    this.activeCombatState = undefined;
  }

  // ─── Phase 4: Break handler ────────────────────────────────────────────────

  private onBreakEnded(): void {
    this.breakOverlay?.hide();
    this.hudStatus.setText('Break over. The Tomato is ready. Apparently.');
  }

  /**
   * Compute maxFloors for the next run based on session state.
   * Base 3 floors + 1 per task queued (capped at 8).
   */
  private computeMaxFloors(): number {
    const { tasks } = SessionStore.getState();
    return Math.min(8, 3 + tasks.length);
  }

  // ─── Item sprites (Phase 3.B) ──────────────────────────────────────────────

  private buildItemSprites(): void {
    // Clear old item sprites
    this.itemSprites.forEach(sprite => sprite.destroy());
    this.itemSprites.clear();

    // Create sprites for each unpicked item
    for (const item of this.currentMap.items) {
      if (item.pickedUp) continue;

      const { x, y } = worldFromTile(item.col, item.row);
      const assetKey = AssetManifest.foundItems[item.key as keyof typeof AssetManifest.foundItems]?.key;

      if (!assetKey) continue;

      const sprite = this.add
        .image(x, y, assetKey)
        .setOrigin(0.5, 0.5)
        .setDepth(8)
        .setVisible(this.fogModel.revealed[item.row][item.col]);

      this.itemSprites.set(`${item.col},${item.row}`, sprite);
    }
  }

  private updateItemVisibility(): void {
    for (const item of this.currentMap.items) {
      if (item.pickedUp) continue;
      const key = `${item.col},${item.row}`;
      const sprite = this.itemSprites.get(key);
      if (sprite) {
        sprite.setVisible(this.fogModel.revealed[item.row][item.col]);
      }
    }
  }

  // ─── Enemy sprites (Phase 3.E) ─────────────────────────────────────────────

  private buildEnemySprites(): void {
    this.enemySprites.forEach(s => s.destroy());
    this.enemySprites.clear();

    for (const enemy of this.currentMap.enemies) {
      if (enemy.defeated) continue;
      const { x, y } = worldFromTile(enemy.col, enemy.row);
      const assetKey = (enemy.template as any).key as string;
      const sprite = this.add
        .image(x, y, assetKey)
        .setOrigin(0.5, 0.5)
        .setDepth(9)
        .setVisible(this.fogModel.revealed[enemy.row][enemy.col]);
      this.enemySprites.set(`${enemy.col},${enemy.row}`, sprite);
    }
  }

  private updateEnemyVisibility(): void {
    for (const enemy of this.currentMap.enemies) {
      if (enemy.defeated) continue;
      const key = `${enemy.col},${enemy.row}`;
      const sprite = this.enemySprites.get(key);
      if (sprite) {
        sprite.setVisible(this.fogModel.revealed[enemy.row][enemy.col]);
      }
    }
  }
}
