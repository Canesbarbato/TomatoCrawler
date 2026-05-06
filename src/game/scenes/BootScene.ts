/**
 * BootScene.ts
 * Loads every asset declared in AssetManifest, shows a progress bar,
 * then hands off to GameScene.
 */

import Phaser from 'phaser';
import { AssetManifest } from '../assets/AssetManifest';
import { TILESET_ASSET_KEYS, TILE_SIZE, TILESET_ATLAS_WIDTH } from '../dungeon/TileRenderer';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    const { width, height } = this.scale;

    // ── Progress bar ──────────────────────────────────────────────────────────
    this.add.rectangle(width / 2, height / 2, 322, 22, 0x333333);
    const bar = this.add.rectangle(width / 2 - 160, height / 2, 0, 18, 0xff4444);
    bar.setOrigin(0, 0.5);

    this.add
      .text(width / 2, height / 2 - 28, 'Gathering dungeon supplies…', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5);

    this.load.on('progress', (v: number) => { bar.width = 318 * v; });

    // ── Tiles ─────────────────────────────────────────────────────────────────
    const { tiles, player, enemies, baseGear, foundItems, ui } = AssetManifest;
    this.load.image(tiles.undiscovered.key, tiles.undiscovered.path);
    this.load.image(tiles.floor.key,        tiles.floor.path);
    this.load.image(tiles.wall.key,         tiles.wall.path);
    this.load.image(tiles.corridor.key,     tiles.corridor.path);
    this.load.image(tiles.entrance.key,     tiles.entrance.path);

    // ── Player ────────────────────────────────────────────────────────────────
    this.load.image(player.key, player.path);

    // ── Enemies ───────────────────────────────────────────────────────────────
    for (const e of Object.values(enemies)) {
      this.load.image(e.key, e.path);
    }

    // ── Base gear ─────────────────────────────────────────────────────────────
    for (const item of Object.values(baseGear)) {
      this.load.image(item.key, item.path);
    }

    // ── Found items ───────────────────────────────────────────────────────────
    for (const item of Object.values(foundItems)) {
      this.load.image(item.key, item.path);
    }

    // ── UI ────────────────────────────────────────────────────────────────────
    for (const uiAsset of Object.values(ui)) {
      this.load.image(uiAsset.key, uiAsset.path);
    }
  }

  create(): void {
    // ── Build the runtime tileset atlas ──────────────────────────────────────
    // Draw all per-tile PNGs side-by-side onto an offscreen canvas and register
    // it as the 'tileset' texture so both terrain and fog TilemapLayers can use it.
    const canvas  = document.createElement('canvas');
    canvas.width  = TILESET_ATLAS_WIDTH;
    canvas.height = TILE_SIZE;
    const ctx     = canvas.getContext('2d')!;

    TILESET_ASSET_KEYS.forEach((key, i) => {
      const src = this.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
      ctx.drawImage(src, i * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE);
    });

    this.textures.addCanvas('tileset', canvas);

    this.scene.start('GameScene');
  }
}
