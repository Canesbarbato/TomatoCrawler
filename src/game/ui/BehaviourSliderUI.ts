/**
 * BehaviourSliderUI.ts
 *
 * Binds to pre-existing #behaviour-sliders elements in index.html.
 * Syncs initial values from SessionStore and wires up change listeners.
 */

import { SessionStore } from '../../shared/SessionStore';
import { BehaviourProfile } from '../dungeon/DungeonTypes';

export class BehaviourSliderUI {
  private readonly container: HTMLDivElement;

  constructor(_parent: HTMLElement) {
    this.container = document.getElementById('behaviour-sliders') as HTMLDivElement;
    this.init();
  }

  show(): void { this.container.style.display = 'flex'; }
  hide(): void { this.container.style.display = 'none'; }

  private init(): void {
    const profile = SessionStore.getState().behaviourProfile;

    this.bindSlider('explore', profile.explore);
    this.bindSlider('exit',    profile.exit);
    // 'fight' slider is dormant — no listener needed
  }

  private bindSlider(key: keyof BehaviourProfile, initialValue: number): void {
    const slider = document.getElementById(`slider-${key}`) as HTMLInputElement;
    const valEl  = document.getElementById(`slider-${key}-val`) as HTMLSpanElement;

    if (!slider || !valEl) return;

    // Set initial value from store
    slider.value     = String(initialValue);
    valEl.textContent = String(initialValue);

    slider.addEventListener('input', () => {
      const n = Number(slider.value);
      valEl.textContent = String(n);
      const current = { ...SessionStore.getState().behaviourProfile };
      current[key] = n;
      SessionStore.update({ behaviourProfile: current });
    });
  }
}
