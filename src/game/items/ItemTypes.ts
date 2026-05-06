/**
 * ItemTypes.ts
 * Type definitions for found items and inventory management.
 * Defines the structure of item templates, their stat boosts, and inventory tracking.
 */

import { CharacterStats, BASE_STATS } from '../dungeon/DungeonTypes';

/**
 * Stat modifiers that an item can apply to the character.
 * All fields are optional — items can boost any combination of stats.
 */
export interface StatBoost {
  strength?: number;
  defence?: number;
  speed?: number;
}

/**
 * Immediate consumable effect applied when item is picked up.
 * hp — restores character HP by this amount.
 * speedBoost — temporarily increases speed for durationMs.
 */
export interface ConsumableEffect {
  hp?: number;
  speedBoost?: {
    multiplier: number;  // e.g. 1.5 = 50% faster
    durationMs: number;  // how long the boost lasts
  };
}

/**
 * Character state — HP and max HP.
 * Updated by consumable effects; persists throughout a run.
 */
export interface CharacterState {
  hp: number;
  maxHp: number;
}

/**
 * Blueprint for a found item — defines its name, description, and stat effects.
 * Each item in the dungeon is an instantiation of one of these templates.
 */
export interface ItemTemplate {
  key: string;                    // AssetManifest.foundItems key
  name: string;                   // e.g. "Crouton Shield"
  description: string;            // deadpan flavour text
  statBoosts: StatBoost;          // stat modifiers when in inventory
  spriteKey: string;              // asset key for sprite rendering
  consumable?: ConsumableEffect;  // immediate effect on pickup (Phase 3.F)
}

/**
 * An item in the player's active inventory during a run.
 * Tracks both the template and the floor where it was picked up.
 */
export interface InventoryItem {
  template: ItemTemplate;
  pickedUpOnFloor: number;        // floor depth (1–infinity)
}

/**
 * Compute merged character stats by summing all stat boosts from inventory.
 * Returns a new CharacterStats object; does not mutate inputs.
 *
 * @param inventory Array of collected items (can be empty)
 * @returns Merged stats = BASE_STATS + sum of all boosts
 */
export function computeStats(inventory: InventoryItem[]): CharacterStats {
  const merged: CharacterStats = { ...BASE_STATS };

  for (const item of inventory) {
    const { statBoosts } = item.template;
    if (statBoosts.strength !== undefined) {
      merged.strength += statBoosts.strength;
    }
    if (statBoosts.defence !== undefined) {
      merged.defence += statBoosts.defence;
    }
    if (statBoosts.speed !== undefined) {
      merged.speed += statBoosts.speed;
    }
  }

  return merged;
}
