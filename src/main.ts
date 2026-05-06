/**
 * main.ts
 * Entry point — bootstraps the Phaser game instances.
 *   Game 1: main dungeon map (800×600) → #game-container
 *   Game 2: side-view scroll scene (800×96) → #side-view-container
 */

import Phaser from 'phaser';
import { BootScene } from './game/scenes/BootScene';
import { GameScene } from './game/scenes/GameScene';
import { SideViewScene } from './game/scenes/SideViewScene';

// ── Main dungeon game ─────────────────────────────────────────────────────────
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#111111',
  parent: 'game-container',
  pixelArt: true,
  scene: [BootScene, GameScene],
};

new Phaser.Game(config);

// ── Side-view scroll game ─────────────────────────────────────────────────────
const sideViewConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 96,
  backgroundColor: '#1a1a1a',
  parent: 'side-view-container',
  pixelArt: true,
  scene: [SideViewScene],
};

new Phaser.Game(sideViewConfig);

