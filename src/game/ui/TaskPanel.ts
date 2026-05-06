/**
 * TaskPanel.ts
 *
 * Binds to pre-existing #task-panel elements in index.html.
 * Zero Phaser dependency — pure DOM.
 */

import { EventBus } from '../../shared/EventBus';
import { SessionStore, Task } from '../../shared/SessionStore';

export class TaskPanel {
  private readonly container: HTMLDivElement;
  private readonly listEl: HTMLUListElement;
  private readonly inputEl: HTMLInputElement;
  private readonly addBtn: HTMLButtonElement;
  private locked = false;

  constructor(_parent: HTMLElement) {
    this.container = document.getElementById('task-panel')    as HTMLDivElement;
    this.listEl    = document.getElementById('task-list')     as HTMLUListElement;
    this.inputEl   = document.getElementById('task-input')    as HTMLInputElement;
    this.addBtn    = document.getElementById('task-add-btn')  as HTMLButtonElement;

    this.inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.addTask(); });
    this.addBtn.addEventListener('click', () => this.addTask());

    this.render();
  }

  /** Lock edits during a run — add and complete disabled. */
  setLocked(locked: boolean): void {
    this.locked = locked;
    this.inputEl.disabled = locked;
    this.addBtn.disabled  = locked;
    this.inputEl.placeholder = locked ? 'Tasks locked during run' : 'Add a task…';
  }

  show(): void { this.container.style.display = 'flex'; }
  hide(): void { this.container.style.display = 'none'; }

  destroy(): void { /* element stays in DOM */ }

  // ─── Task management ─────────────────────────────────────────────────────

  private addTask(): void {
    if (this.locked) return;
    const label = this.inputEl.value.trim();
    if (!label) return;

    const task: Task = { id: `task-${Date.now()}`, label, completed: false };
    const prev = SessionStore.getState();
    SessionStore.update({ tasks: [...prev.tasks, task] });
    EventBus.emit('taskAdded', { id: task.id, label: task.label });
    this.inputEl.value = '';
    this.render();
  }

  private toggleTask(id: string): void {
    if (this.locked) return;
    const tasks = SessionStore.getState().tasks.map(t =>
      t.id === id ? { ...t, completed: !t.completed } : t,
    );
    SessionStore.update({ tasks });
    const task = tasks.find(t => t.id === id)!;
    EventBus.emit('taskCompleted', { id, completed: task.completed });
    this.render();
  }

  private render(): void {
    this.listEl.innerHTML = '';
    const tasks = SessionStore.getState().tasks;

    if (tasks.length === 0) {
      const empty = document.createElement('li');
      empty.textContent = 'No objectives. The Tomato ventures forth unburdened.';
      empty.style.color = '#555';
      empty.style.fontStyle = 'italic';
      this.listEl.appendChild(empty);
      return;
    }

    for (const task of tasks) {
      const li = document.createElement('li');
      Object.assign(li.style, { display: 'flex', alignItems: 'center', gap: '6px', cursor: this.locked ? 'default' : 'pointer' });

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = task.completed;
      cb.disabled = this.locked;
      cb.addEventListener('change', () => this.toggleTask(task.id));

      const lbl = document.createElement('span');
      lbl.textContent = task.label;
      if (task.completed) { lbl.style.textDecoration = 'line-through'; lbl.style.color = '#555'; }

      li.appendChild(cb);
      li.appendChild(lbl);
      this.listEl.appendChild(li);
    }
  }
}
