/**
 * EnemyTypes.ts
 * Combat-specific types for Phase 3.E.
 * EnemyTemplate / EnemyInstance / FloorEnemy live in DungeonTypes to avoid circular imports.
 */

import { CharacterStats } from '../dungeon/DungeonTypes';

// Re-export for consumers that only need to import from one place.
export type { EnemyTemplate, EnemyInstance, FloorEnemy } from '../dungeon/DungeonTypes';

// ─── Combat state ────────────────────────────────────────────────────────────

export interface CombatLogEntry {
  attacker: 'player' | 'enemy';
  /** Damage dealt after defence reduction */
  damage: number;
  /** Defender's HP after the blow */
  remainingHp: number;
}

export interface CombatState {
  enemy: import('../dungeon/DungeonTypes').EnemyInstance;
  playerHp: number;
  playerStats: CharacterStats;
  turn: 'player' | 'enemy';
  log: CombatLogEntry[];
  outcome: 'ongoing' | 'player_won' | 'enemy_won';
}

// ─── Combat helper ───────────────────────────────────────────────────────────

/**
 * Calculate damage dealt — always at least 1.
 */
export function applyDamage(attackStrength: number, defenderDefence: number): number {
  return Math.max(1, attackStrength - defenderDefence);
}
