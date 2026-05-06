/**
 * CombatResolver.ts
 * Pure state machine for turn-based combat (Phase 3.E).
 * No Phaser dependency — fully unit-testable.
 *
 * Turn order: player first, then enemy — alternating every 600 ms (timer lives in GameScene).
 * Player HP floors at 1 — The Tomato cannot die in this phase.
 */

import { CharacterStats } from '../dungeon/DungeonTypes';
import { EnemyInstance, CombatState, CombatLogEntry, applyDamage } from './EnemyTypes';

export function startCombat(
  enemy: EnemyInstance,
  playerHp: number,
  playerStats: CharacterStats,
): CombatState {
  return {
    enemy: { ...enemy, template: { ...enemy.template } },
    playerHp,
    playerStats,
    turn: 'player',
    log: [],
    outcome: 'ongoing',
  };
}

/**
 * Resolve one turn — immutable, returns a new CombatState.
 */
export function resolveTurn(state: CombatState): CombatState {
  if (state.outcome !== 'ongoing') return state;

  const { enemy, playerHp, playerStats, turn, log } = state;
  const newEnemy = { ...enemy, template: { ...enemy.template } };

  let newPlayerHp = playerHp;
  let entry: CombatLogEntry;

  if (turn === 'player') {
    const dmg = applyDamage(playerStats.strength, newEnemy.template.defence);
    newEnemy.currentHp = Math.max(0, newEnemy.currentHp - dmg);
    entry = { attacker: 'player', damage: dmg, remainingHp: newEnemy.currentHp };
  } else {
    const dmg = applyDamage(newEnemy.template.strength, playerStats.defence);
    newPlayerHp = Math.max(1, newPlayerHp - dmg); // floors at 1
    entry = { attacker: 'enemy', damage: dmg, remainingHp: newPlayerHp };
  }

  const newLog = [...log, entry];
  const nextTurn: 'player' | 'enemy' = turn === 'player' ? 'enemy' : 'player';

  let outcome: CombatState['outcome'] = 'ongoing';
  if (newEnemy.currentHp <= 0) outcome = 'player_won';
  // enemy_won branch stubbed — player HP floors at 1 this phase

  return {
    enemy: newEnemy,
    playerHp: newPlayerHp,
    playerStats,
    turn: nextTurn,
    log: newLog,
    outcome,
  };
}
