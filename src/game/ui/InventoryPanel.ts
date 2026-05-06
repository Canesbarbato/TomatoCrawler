/**
 * InventoryPanel.ts
 *
 * Binds to pre-existing #inventory-panel elements in index.html.
 * View-only during runs. Shows stat bonuses and item icons.
 */

import { InventoryItem } from '../items/ItemTypes';
import { AssetManifest } from '../assets/AssetManifest';

export class InventoryPanel {
  private readonly container: HTMLDivElement;
  private readonly itemList: HTMLDivElement;
  private readonly statusLabel: HTMLDivElement;
  private isRunning = false;

  constructor(_parent: HTMLElement) {
    this.container   = document.getElementById('inventory-panel')  as HTMLDivElement;
    this.itemList    = document.getElementById('inventory-list')   as HTMLDivElement;
    this.statusLabel = document.getElementById('inventory-status') as HTMLDivElement;
  }

  /**
   * Update the displayed inventory.
   * Called whenever an item is picked up or floor transitions.
   */
  update(inventory: InventoryItem[]): void {
    // Clear old list
    this.itemList.innerHTML = '';

    if (inventory.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:8px;color:#666666;text-align:center;font-size:10px;';
      empty.textContent = '(empty)';
      this.itemList.appendChild(empty);
      return;
    }

    // Build item rows
    for (const item of inventory) {
      const row = document.createElement('div');
      row.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px;
        margin-bottom: 2px;
        border: 1px solid #333333;
        border-radius: 1px;
      `;

      // ── Icon ──────────────────────────────────────────────────────────────
      const icon = document.createElement('img');
      icon.src = AssetManifest.foundItems[item.template.key as keyof typeof AssetManifest.foundItems]?.path ?? 'about:blank';
      icon.style.cssText = 'width:16px;height:16px;image-rendering:pixelated;flex-shrink:0;';
      row.appendChild(icon);

      // ── Item info (name + stats) ──────────────────────────────────────────
      const info = document.createElement('div');
      info.style.cssText = 'flex:1;';

      const name = document.createElement('div');
      name.style.cssText = 'color:#ffdd66;font-size:11px;font-weight:bold;';
      name.textContent = item.template.name;
      info.appendChild(name);

      // Stat badges
      const statLine = document.createElement('div');
      statLine.style.cssText = 'color:#aaaaaa;font-size:9px;margin-top:2px;';
      const statParts: string[] = [];

      if (item.template.statBoosts.strength) {
        statParts.push(`⚔+${item.template.statBoosts.strength}`);
      }
      if (item.template.statBoosts.defence) {
        statParts.push(`🛡+${item.template.statBoosts.defence}`);
      }
      if (item.template.statBoosts.speed) {
        statParts.push(`💨+${item.template.statBoosts.speed}`);
      }

      // Consumable indicator
      if (item.template.consumable) {
        statParts.push('⚡');
      }

      statLine.textContent = statParts.length > 0 ? statParts.join(' ') : '—';
      info.appendChild(statLine);

      row.appendChild(info);
      this.itemList.appendChild(row);
    }
  }

  /**
   * Update run state — shows/hides warning label.
   */
  setRunning(running: boolean): void {
    this.isRunning = running;
    if (running) {
      this.statusLabel.textContent = '🏃 Rummaging not permitted mid-run.';
      this.statusLabel.style.color = '#666666';
    } else {
      this.statusLabel.textContent = '✓ Ready to equip.';
      this.statusLabel.style.color = '#88ff88';
    }
  }

  /**
   * Show the panel.
   */
  show(): void {
    this.container.style.display = 'flex';
  }

  /**
   * Hide the panel.
   */
  hide(): void {
    this.container.style.display = 'none';
  }

  /**
   * Clear the displayed inventory (called on run end/retreat).
   */
  clear(): void {
    this.itemList.innerHTML = '';
  }
}
