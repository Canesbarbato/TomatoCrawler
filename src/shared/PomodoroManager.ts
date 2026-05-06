/**
 * PomodoroManager.ts
 *
 * Timer state machine that drives the Pomodoro cycle:
 *   idle → focus → short-break → idle (repeat)
 *   After every RUNS_PER_LONG_BREAK completed focus runs: long-break instead of short-break.
 *
 * All mutable phase state is persisted to SessionStore on every change.
 * The tick interval runs continuously while the page is open; phase-end
 * is derived from `phaseEndTimestamp` in SessionStore so it survives
 * page reloads correctly.
 *
 * Zero Phaser dependency — runs identically in browser, Electron, and Capacitor.
 */

import { SessionStore } from './SessionStore';
import { EventBus, PomodoroPhase } from './EventBus';

export type { PomodoroPhase };

// ─── Duration constants (ms) ─────────────────────────────────────────────────
export const FOCUS_DURATION_MS       = 25 * 60 * 1000;
export const SHORT_BREAK_DURATION_MS =  5 * 60 * 1000;
export const LONG_BREAK_DURATION_MS  = 15 * 60 * 1000;
export const RUNS_PER_LONG_BREAK     = 4;

/** Milliseconds between timer ticks. */
const TICK_MS = 1000;

export type PomodoroPhase = 'idle' | 'focus' | 'short-break' | 'long-break';

class PomodoroManagerClass {
  private tickInterval?: ReturnType<typeof setInterval>;

  constructor() {
    // Resume tick if a phase was in progress before the page was closed.
    const { pomodoroPhase } = SessionStore.getState();
    if (pomodoroPhase !== 'idle') {
      this.startTick();
    }
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  getPhase(): PomodoroPhase {
    return SessionStore.getState().pomodoroPhase;
  }

  /** Remaining milliseconds in the current phase. 0 if idle. */
  getTimeRemaining(): number {
    const { phaseEndTimestamp } = SessionStore.getState();
    if (!phaseEndTimestamp) return 0;
    return Math.max(0, phaseEndTimestamp - Date.now());
  }

  /** Called by the ▶ Start button in focus mode. Starts a focus phase. */
  startFocus(durationMs = FOCUS_DURATION_MS): void {
    if (this.getPhase() !== 'idle') return;
    SessionStore.update({
      pomodoroPhase: 'focus',
      phaseEndTimestamp: Date.now() + durationMs,
    });
    this.startTick();
    EventBus.emit('pomodoroPhaseChanged', 'focus');
  }

  /**
   * Called by GameScene when a run ends (completed).
   * Advances runsSinceLastLongBreak, increments tomatoCount, schedules break.
   */
  onRunCompleted(): void {
    if (this.getPhase() !== 'focus') return;
    const prev = SessionStore.getState();
    const newRuns = prev.runsSinceLastLongBreak + 1;
    const newTomatoes = prev.tomatoCount + 1;

    const isLongBreak = newRuns >= RUNS_PER_LONG_BREAK;
    const breakDuration = isLongBreak ? LONG_BREAK_DURATION_MS : SHORT_BREAK_DURATION_MS;
    const nextPhase: PomodoroPhase = isLongBreak ? 'long-break' : 'short-break';

    SessionStore.update({
      tomatoCount: newTomatoes,
      pomodoroPhase: nextPhase,
      phaseEndTimestamp: Date.now() + breakDuration,
      runsSinceLastLongBreak: isLongBreak ? 0 : newRuns,
    });
    EventBus.emit('pomodoroPhaseChanged', nextPhase);
  }

  /** Manually skip the current break (user override). */
  skipBreak(): void {
    const phase = this.getPhase();
    if (phase !== 'short-break' && phase !== 'long-break') return;
    this.endPhase();
  }

  // ─── Internal ────────────────────────────────────────────────────────────────

  private startTick(): void {
    if (this.tickInterval) return;
    this.tickInterval = setInterval(() => this.tick(), TICK_MS);
  }

  private stopTick(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = undefined;
    }
  }

  private tick(): void {
    const remaining = this.getTimeRemaining();
    EventBus.emit('timerTick', remaining);

    if (remaining <= 0) {
      this.endPhase();
    }
  }

  private endPhase(): void {
    const phase = this.getPhase();
    this.stopTick();

    SessionStore.update({ pomodoroPhase: 'idle', phaseEndTimestamp: null });
    EventBus.emit('pomodoroPhaseChanged', 'idle');

    if (phase === 'focus') {
      // Focus ended without run completion — transition to idle only.
      // (Normal path is onRunCompleted() → break; this handles timer expiry.)
      EventBus.emit('focusTimerExpired', undefined);
    }
    // On break end: emit so the UI can show the "Ready" state.
    if (phase === 'short-break' || phase === 'long-break') {
      EventBus.emit('breakEnded', phase);
    }
  }
}

export const PomodoroManager = new PomodoroManagerClass();
