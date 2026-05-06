/**
 * RunManager.ts
 *
 * State machine that governs the lifecycle of a single run.
 *
 * States:
 *   idle            → waiting for ▶ Start
 *   running         → The Tomato is exploring
 *   in-combat       → (Phase 3) combat encounter active
 *   floor-transition → brief pause between floors
 *   run-end         → all floors completed successfully
 *   retreat         → player exited early (soft penalty applied)
 *
 * Emits:
 *   runStarted      (floor: number)
 *   floorTransition (fromFloor: number, toFloor: number)
 *   floorAdvanced   (floor: number)
 *   runEnd          (floorsReached: number)
 *   retreat         ()
 */

import Phaser from 'phaser';
import { SessionStore } from '../../shared/SessionStore';

export type RunState =
  | 'idle'
  | 'running'
  | 'in-combat'
  | 'floor-transition'
  | 'run-end'
  | 'retreat';

/** Default floor count for Phase 2. Phase 4 will derive this from session duration. */
const DEFAULT_MAX_FLOORS = 3;

/** Sauce Points earned per floor on a completed run. */
const SAUCE_PER_FLOOR = 10;

export class RunManager extends Phaser.Events.EventEmitter {
  private state: RunState = 'idle';
  private currentFloor = 0;
  private maxFloors: number;
  private enemiesDefeated = 0;

  constructor(maxFloors = DEFAULT_MAX_FLOORS) {
    super();
    this.maxFloors = maxFloors;
  }

  getState(): RunState       { return this.state; }
  getCurrentFloor(): number  { return this.currentFloor; }

  /** Update the max floors for the next run (called by GameScene before startRun). */
  setMaxFloors(n: number): void {
    this.maxFloors = n;
  }
  // ─── Public transitions ──────────────────────────────────────────────────────

  /** Called by the ▶ Start button. */
  startRun(): void {
    if (this.state !== 'idle') return;
    this.currentFloor = 1;
    this.enemiesDefeated = 0;
    this.state = 'running';
    SessionStore.update({ currentFloor: 1, currentRunEnemiesDefeated: 0 });
    this.emit('runStarted', this.currentFloor);
  }

  /** Called by PlayerAgent when the stairs tile is stepped on. */
  onStairsReached(): void {
    if (this.state !== 'running') return;
    if (this.currentFloor >= this.maxFloors) {
      this.completeRun();
    } else {
      this.state = 'floor-transition';
      this.emit('floorTransition', this.currentFloor, this.currentFloor + 1);
    }
  }


  /** Called by GameScene after generating the next floor's map. */
  advanceFloor(): void {
    if (this.state !== 'floor-transition') return;
    this.currentFloor++;
    this.state = 'running';
    SessionStore.update({ currentFloor: this.currentFloor });
    this.emit('floorAdvanced', this.currentFloor);
  }

  /** Soft early-exit penalty — no Sauce Points awarded. */
  retreat(): void {
    if (this.state === 'idle' || this.state === 'run-end' || this.state === 'retreat') return;
    this.state = 'retreat';
    this.emit('retreat');
    this.saveRunRecord(false);
  }

  /**
   * Debug-only hard reset — returns to idle with no run record persisted.
   * Called exclusively by DebugControls.
   */
  resetToIdle(): void {
    this.state = 'idle';
    this.currentFloor = 0;
    this.enemiesDefeated = 0;
  }

  // ─── Internal ────────────────────────────────────────────────────────────────

  private completeRun(): void {
    this.state = 'run-end';
    this.emit('runEnd', this.currentFloor);
    this.saveRunRecord(true);
  }

  private saveRunRecord(completed: boolean): void {
    const prev       = SessionStore.getState();
    const earned     = completed ? this.currentFloor * SAUCE_PER_FLOOR : 0;
    const runNumber  = prev.totalRuns + 1;

    SessionStore.update({
      totalRuns:     runNumber,
      saucePoints:   prev.saucePoints + earned,
      currentFloor:  0,
      runHistory: [
        ...prev.runHistory,
        {
          runNumber,
          floorsReached:      this.currentFloor,
          enemiesDefeated:    this.enemiesDefeated,
          saucePointsEarned:  earned,
          itemsExpired:       [],
          completedAt:        new Date().toISOString(),
        },
      ],
    });

    this.state = 'idle';
  }
}
