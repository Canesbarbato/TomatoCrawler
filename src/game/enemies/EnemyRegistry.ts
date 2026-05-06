/**
 * EnemyRegistry.ts
 * Single source of truth for all enemy templates.
 * Pattern mirrors ItemRegistry.ts.
 */

import { EnemyTemplate } from './EnemyTypes';
import { AssetManifest } from '../assets/AssetManifest';

const registry = new Map<string, EnemyTemplate>([
  [
    'breadknight',
    {
      key:      AssetManifest.enemies.breadknight.key,
      name:     'Breadknight',
      rank:     'I',
      hp:       30,
      strength: 6,
      defence:  1,
    },
  ],
]);

export function getEnemyTemplate(key: string): EnemyTemplate | undefined {
  return registry.get(key);
}

/** All registered enemy keys. */
export function allEnemyKeys(): string[] {
  return [...registry.keys()];
}

/** Random enemy template — weighted towards low rank in early phases. */
export function getRandomEnemyTemplate(): EnemyTemplate {
  const keys = allEnemyKeys();
  return registry.get(keys[Math.floor(Math.random() * keys.length)])!;
}
