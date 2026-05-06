/**
 * FogView.ts
 *
 * Phaser-side view layer for the fog of war.
 * Consumes FogDelta arrays from FogModel and updates a Phaser TilemapLayer.
 *
 * Tile conventions on the fog layer:
 *   UNDISCOVERED_GID (1) → opaque fog tile
 *   -1                   → empty / transparent (tile has been revealed)
 */

import Phaser from 'phaser';
import { FogDelta } from './FogModel';
import { UNDISCOVERED_GID } from '../dungeon/TileRenderer';

export class FogView {
  private readonly tilemap: Phaser.Tilemaps.Tilemap;
  private readonly layer:   Phaser.Tilemaps.TilemapLayer;

  constructor(tilemap: Phaser.Tilemaps.Tilemap, layer: Phaser.Tilemaps.TilemapLayer) {
    this.tilemap = tilemap;
    this.layer   = layer;
  }

  /**
   * Apply a set of reveal deltas — set each tile to transparent (-1).
   * Called after FogModel.revealRoom / revealCorridor.
   */
  applyDeltas(deltas: FogDelta[]): void {
    for (const { col, row } of deltas) {
      this.tilemap.putTileAt(-1, col, row, false, this.layer);
    }
  }

  /**
   * Reveal every tile (dev helper — matches FogModel.revealAll).
   */
  revealAll(cols: number, rows: number): void {
    this.tilemap.fill(-1, 0, 0, cols, rows, false, this.layer);
  }

  /**
   * Re-fog every tile (dev helper — matches FogModel.fogAll).
   */
  fogAll(cols: number, rows: number): void {
    this.tilemap.fill(UNDISCOVERED_GID, 0, 0, cols, rows, false, this.layer);
  }
}
