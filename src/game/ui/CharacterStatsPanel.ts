/**
 * CharacterStatsPanel.ts
 *
 * Binds to pre-existing #character-stats-panel elements in index.html.
 * Updates on every item pickup, consumable use, and floor transition.
 */

import { CharacterStats, CharacterState } from '../dungeon/DungeonTypes';

export class CharacterStatsPanel {
  private container: HTMLDivElement;
  private hpLabel: HTMLElement;
  private strLabel: HTMLElement;
  private defLabel: HTMLElement;
  private spdLabel: HTMLElement;

  constructor(_parent: HTMLElement) {
    this.container = document.getElementById('character-stats-panel') as HTMLDivElement;
    this.hpLabel   = document.getElementById('stats-hp')  as HTMLElement;
    this.strLabel  = document.getElementById('stats-str') as HTMLElement;
    this.defLabel  = document.getElementById('stats-def') as HTMLElement;
    this.spdLabel  = document.getElementById('stats-spd') as HTMLElement;
  }

  /**
   * Update the displayed stats and HP.
   * Called whenever stats change (item pickup, consumable use, floor transition).
   */
  update(stats: CharacterStats, state: CharacterState): void {
    this.hpLabel.textContent  = `❤ HP ${state.hp}/${state.maxHp}`;
    this.strLabel.textContent = `⚔ STR ${stats.strength}`;
    this.defLabel.textContent = `🛡 DEF ${stats.defence}`;
    this.spdLabel.textContent = `💨 SPD ${stats.speed}`;
  }

  /**
   * Show the panel.
   */
  show(): void { this.container.style.display = 'block'; }

  /**
   * Hide the panel.
   */
  hide(): void { this.container.style.display = 'none'; }
}
