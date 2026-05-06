/**
 * BreakOverlay.ts
 *
 * Binds to pre-existing #break-overlay elements in index.html.
 * Zero Phaser dependency.
 */

import { EventBus, EventBusMap } from '../../shared/EventBus';
import { PomodoroManager } from '../../shared/PomodoroManager';

export class BreakOverlay {
  private readonly overlay: HTMLDivElement;
  private readonly titleEl: HTMLHeadingElement;
  private readonly timerEl: HTMLDivElement;

  private readonly onTickBound: (ms: EventBusMap['timerTick']) => void;
  private readonly onPhaseBound: (p: EventBusMap['pomodoroPhaseChanged']) => void;

  constructor(_parent: HTMLElement) {
    this.overlay = document.getElementById('break-overlay') as HTMLDivElement;
    this.titleEl = document.getElementById('break-title')   as HTMLHeadingElement;
    this.timerEl = document.getElementById('break-timer')   as HTMLDivElement;
    const skipBtn = document.getElementById('break-skip')   as HTMLButtonElement;

    skipBtn.addEventListener('click', () => PomodoroManager.skipBreak());

    this.onTickBound  = (ms) => { this.timerEl.textContent = formatTime(ms); };
    this.onPhaseBound = (p)  => { if (p === 'idle') this.hide(); };
    EventBus.on('timerTick',            this.onTickBound);
    EventBus.on('pomodoroPhaseChanged', this.onPhaseBound);
  }

  show(phase: 'short-break' | 'long-break'): void {
    const isLong = phase === 'long-break';
    this.titleEl.textContent = isLong
      ? 'The Tomato rests. Mysteriously.'
      : 'The Tomato rests briefly. Back soon.';
    this.overlay.style.display = 'flex';
  }

  hide(): void {
    this.overlay.style.display = 'none';
  }
}

function formatTime(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const s = (totalSec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
