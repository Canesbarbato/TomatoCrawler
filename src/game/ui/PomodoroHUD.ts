/**
 * PomodoroHUD.ts
 *
 * Binds to pre-existing #pomodoro-hud elements in index.html.
 * Zero Phaser dependency — pure DOM.
 */

import { EventBus, PomodoroPhase, EventBusMap } from '../../shared/EventBus';
import { SessionStore } from '../../shared/SessionStore';
import { FOCUS_DURATION_MS, SHORT_BREAK_DURATION_MS, LONG_BREAK_DURATION_MS } from '../../shared/PomodoroManager';

const PHASE_LABELS: Record<PomodoroPhase, string> = {
  'idle':        'Ready — press ▶ START',
  'focus':       '🍅 Focus',
  'short-break': '☕ Short Break',
  'long-break':  '💤 Long Break',
};

export class PomodoroHUD {
  private readonly tomatoEl: HTMLSpanElement;
  private readonly phaseEl: HTMLSpanElement;
  private readonly timerEl: HTMLSpanElement;
  private readonly taskEl: HTMLSpanElement;
  private readonly progressEl: HTMLDivElement;

  private readonly onPhaseBound: (p: EventBusMap['pomodoroPhaseChanged']) => void;
  private readonly onTickBound:  (ms: EventBusMap['timerTick']) => void;
  private readonly onTaskBound:  (t: EventBusMap['taskCompleted']) => void;

  constructor(_parent: HTMLElement) {
    this.progressEl = document.getElementById('pomodoro-progress') as HTMLDivElement;
    this.tomatoEl   = document.getElementById('pomodoro-tomato')   as HTMLSpanElement;
    this.phaseEl    = document.getElementById('pomodoro-phase')    as HTMLSpanElement;
    this.timerEl    = document.getElementById('pomodoro-timer')    as HTMLSpanElement;
    this.taskEl     = document.getElementById('pomodoro-tasks')    as HTMLSpanElement;

    this.refresh();

    this.onPhaseBound = (p) => this.onPhaseChanged(p);
    this.onTickBound  = (ms) => this.onTick(ms);
    this.onTaskBound  = () => this.refreshTasks();

    EventBus.on('pomodoroPhaseChanged', this.onPhaseBound);
    EventBus.on('timerTick',            this.onTickBound);
    EventBus.on('taskCompleted',        this.onTaskBound);
    EventBus.on('taskAdded',            () => this.refreshTasks());
  }

  // ─── Refresh ──────────────────────────────────────────────────────────────

  private refresh(): void {
    const s = SessionStore.getState();
    this.tomatoEl.textContent = `🍅 ${s.tomatoCount}`;
    this.phaseEl.textContent  = PHASE_LABELS[s.pomodoroPhase];
    this.refreshTimer(s.pomodoroPhase);
    this.refreshTasks();
  }

  private refreshTimer(phase: PomodoroPhase): void {
    if (phase === 'idle') {
      this.timerEl.textContent = '--:--';
      this.progressEl.style.width = '0%';
      return;
    }
    const { phaseEndTimestamp } = SessionStore.getState();
    if (!phaseEndTimestamp) return;
    const remaining = Math.max(0, phaseEndTimestamp - Date.now());
    this.timerEl.textContent = formatTime(remaining);

    const total = phaseDuration(phase);
    const pct   = total > 0 ? ((total - remaining) / total) * 100 : 0;
    this.progressEl.style.width = `${pct}%`;
  }

  private refreshTasks(): void {
    const tasks = SessionStore.getState().tasks;
    const done  = tasks.filter(t => t.completed).length;
    this.taskEl.textContent = tasks.length === 0
      ? 'no tasks'
      : `${done}/${tasks.length} tasks`;
  }

  // ─── Event handlers ───────────────────────────────────────────────────────

  private onPhaseChanged(phase: PomodoroPhase): void {
    this.phaseEl.textContent = PHASE_LABELS[phase];
    this.tomatoEl.textContent = `🍅 ${SessionStore.getState().tomatoCount}`;

    if (phase === 'focus')       { this.phaseEl.style.color = '#ff4444'; }
    else if (phase === 'idle')   { this.phaseEl.style.color = '#888888'; }
    else                         { this.phaseEl.style.color = '#44aaff'; }

    this.refreshTimer(phase);
  }

  private onTick(ms: number): void {
    this.timerEl.textContent = formatTime(ms);
    const phase = SessionStore.getState().pomodoroPhase;
    const total = phaseDuration(phase);
    const pct   = total > 0 ? ((total - ms) / total) * 100 : 0;
    this.progressEl.style.width = `${pct}%`;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const s = (totalSec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function phaseDuration(phase: PomodoroPhase): number {
  if (phase === 'focus')       return FOCUS_DURATION_MS;
  if (phase === 'short-break') return SHORT_BREAK_DURATION_MS;
  if (phase === 'long-break')  return LONG_BREAK_DURATION_MS;
  return 0;
}
