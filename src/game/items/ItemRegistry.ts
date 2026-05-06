/**
 * ItemRegistry.ts
 * Registry of all found item templates available in the game.
 * Maps item keys to their full templates — single source of truth.
 *
 * Phase 3.A starter set: 5 items with stat boosts.
 * Future: consumable items added in Phase 3.F.
 */

import { ItemTemplate } from './ItemTypes';

/** Registry of all available found item templates. */
const ITEM_REGISTRY = new Map<string, ItemTemplate>([
  [
    'croutonShield',
    {
      key: 'croutonShield',
      name: 'Crouton Shield',
      description: 'Slightly stale. Offers mild resistance.',
      statBoosts: { defence: 3 },
      spriteKey: 'item-crouton-shield',
    },
  ],
  [
    'oliveOilFlask',
    {
      key: 'oliveOilFlask',
      name: 'Olive Oil Flask',
      description: 'The Tomato moves faster. Suspiciously.',
      statBoosts: { speed: 2 },
      spriteKey: 'item-olive-oil-flask',
      consumable: {
        speedBoost: { multiplier: 1.5, durationMs: 8000 },
      },
    },
  ],
  [
    'parchmentOfMildThreat',
    {
      key: 'parchmentOfMildThreat',
      name: 'Parchment of Mild Threat',
      description: 'The words are concerning. Mostly.',
      statBoosts: { strength: 2, defence: 1 },
      spriteKey: 'item-parchment-mild-threat',
    },
  ],
  [
    'staleBreadloaf',
    {
      key: 'staleBreadloaf',
      name: 'Stale Breadloaf',
      description: 'Dense. Heavy. Effective.',
      statBoosts: { strength: 4 },
      spriteKey: 'item-stale-breadloaf',
    },
  ],
  [
    'vinaigrette',
    {
      key: 'vinaigrette',
      name: 'Vinaigrette',
      description: 'Applied externally. Do not ask.',
      statBoosts: { speed: 3 },
      spriteKey: 'item-vinaigrette',
    },
  ],
  [
    'tomatoJuiceVial',
    {
      key: 'tomatoJuiceVial',
      name: 'Tomato Juice Vial',
      description: 'The Tomato drinks it. Feels slightly less doomed.',
      statBoosts: {},
      spriteKey: 'item-found',
      consumable: {
        hp: 20,
      },
    },
  ],
]);

/**
 * Retrieve an item template by key.
 * @param key AssetManifest.foundItems key
 * @returns ItemTemplate, or undefined if not found
 */
export function getItemTemplate(key: string): ItemTemplate | undefined {
  return ITEM_REGISTRY.get(key);
}

/**
 * Get all registered item templates.
 * @returns Array of all item templates
 */
export function getAllItemTemplates(): ItemTemplate[] {
  return Array.from(ITEM_REGISTRY.values());
}

/**
 * Get a random item template.
 * Used for spawning items on floors.
 * @returns Randomly selected ItemTemplate
 */
export function getRandomItemTemplate(): ItemTemplate {
  const templates = getAllItemTemplates();
  return templates[Math.floor(Math.random() * templates.length)];
}

export { ITEM_REGISTRY };
