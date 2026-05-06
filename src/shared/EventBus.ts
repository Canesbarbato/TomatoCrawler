/**
 * EventBus.ts
 * Typed singleton event emitter shared across Phaser scenes and UI layers.
 * Zero external dependencies — uses a plain Map of Sets.
 *
 * Usage:
 *   EventBus.on('contextChanged', (ctx) => { ... });
 *   EventBus.emit('contextChanged', 'corridor');
 *   EventBus.off('contextChanged', myHandler);
 */

import { EnemyTemplate, CombatLogEntry, CombatState } from '../game/enemies/EnemyTypes';
import { CharacterStats } from '../game/dungeon/DungeonTypes';

export type PomodoroPhase = 'idle' | 'focus' | 'short-break' | 'long-break';

export interface EventBusMap {
  /** Emitted by GameScene when The Tomato enters a room or corridor. */
  contextChanged: 'room' | 'corridor';
  /** Emitted by GameScene when The Tomato picks up a floor item. */
  itemPickedUp: { key: string; name: string };
  /** Emitted by GameScene when a consumable restores HP. */
  hpRestored: number;
  /** Emitted by GameScene when a speed-boost consumable activates. */
  speedBoostStarted: null;
  /** Emitted by GameScene when a speed-boost consumable expires. */
  speedBoostEnded: null;
  /** Emitted by GameScene when The Tomato starts or stops moving. */
  movementChanged: boolean;
  /** Emitted by GameScene when The Tomato encounters an enemy (Phase 3.E+). */
  enemyEncountered: { key: string };
  /** Emitted by GameScene when combat begins. */
  combatStarted: { enemy: EnemyTemplate; playerHp: number; playerStats: CharacterStats };
  /** Emitted by GameScene after each combat turn resolves. */
  combatTurnResolved: { entry: CombatLogEntry; state: CombatState };
  /** Emitted by GameScene when combat ends. */
  combatEnded: { outcome: 'player_won' | 'enemy_won'; enemy: EnemyTemplate };
  // ─── Phase 4: Pomodoro ────────────────────────────────────────────────────
  /** Emitted by PomodoroManager whenever the phase changes. */
  pomodoroPhaseChanged: PomodoroPhase;
  /** Emitted every second by PomodoroManager while a phase is active. ms remaining. */
  timerTick: number;
  /** Emitted when the focus timer expires without a run completing. */
  focusTimerExpired: undefined;
  /** Emitted when a break phase ends naturally or is skipped. */
  breakEnded: 'short-break' | 'long-break';
  /** Emitted by TaskPanel when a task is added. */
  taskAdded: { id: string; label: string };
  /** Emitted by TaskPanel when a task is toggled completed. */
  taskCompleted: { id: string; completed: boolean };
}

type Listener<T> = (data: T) => void;

class EventBusClass {
  private readonly listeners = new Map<string, Set<Listener<unknown>>>();

  on<K extends keyof EventBusMap>(event: K, fn: Listener<EventBusMap[K]>): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn as Listener<unknown>);
  }

  off<K extends keyof EventBusMap>(event: K, fn: Listener<EventBusMap[K]>): void {
    this.listeners.get(event)?.delete(fn as Listener<unknown>);
  }

  emit<K extends keyof EventBusMap>(event: K, data: EventBusMap[K]): void {
    this.listeners.get(event)?.forEach(fn => fn(data));
  }
}

/** Singleton instance — import and use directly. */
export const EventBus = new EventBusClass();
