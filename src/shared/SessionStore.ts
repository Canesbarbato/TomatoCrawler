/**
 * SessionStore.ts
 * Single source of truth for all persisted game state.
 * All reads/writes go through StorageAdapter — never touch localStorage directly.
 */

import { StorageAdapter } from './StorageAdapter';
import { BehaviourProfile, DEFAULT_BEHAVIOUR } from '../game/dungeon/DungeonTypes';
import { InventoryItem } from '../game/items/ItemTypes';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BaseGearSlot {
  /** Key from BaseGearRegistry */
  itemKey: string;
  /** 0–5, capped at maxUpgradeLevel */
  upgradeLevel: number;
}

export interface FoundItemSlot {
  /** Key from FoundItemRegistry */
  itemKey: string;
  usesRemaining: number;
}

export interface Task {
  id: string;
  label: string;
  completed: boolean;
}

export interface RunRecord {
  runNumber: number;
  floorsReached: number;
  enemiesDefeated: number;
  saucePointsEarned: number;
  itemsExpired: string[];
  completedAt: string; // ISO date string
}

export interface SessionState {
  // ── Progress ──────────────────────────────────────────────────────────────
  /** Number of fully completed Pomodoro sessions */
  tomatoCount: number;
  totalRuns: number;
  runHistory: RunRecord[];

  // ── Economy ───────────────────────────────────────────────────────────────
  saucePoints: number;

  // ── Loadout ───────────────────────────────────────────────────────────────
  /** Permanent base gear — always 2 slots, locked at bottom of queue */
  baseGear: BaseGearSlot[];
  /** Player-ordered queue of found items to use during the next run */
  priorityQueue: FoundItemSlot[];
  /** Current max found-item slots (starts 4, expandable to 6, then 8) */
  queueSlotCap: number;
  /** Unqueued found items sitting in inventory pool, not yet assigned */
  inventoryPool: FoundItemSlot[];

  // ── Current Run (persisted for page-reload safety) ────────────────────────
  currentFloor: number;
  currentRunEnemiesDefeated: number;

  // ── Tasks ─────────────────────────────────────────────────────────────────
  tasks: Task[];

  // ── Pomodoro ──────────────────────────────────────────────────────────────
  pomodoroPhase: 'idle' | 'focus' | 'short-break' | 'long-break';
  /** Epoch ms when the current phase ends — null when idle */
  phaseEndTimestamp: number | null;
  runsSinceLastLongBreak: number;

  // ── Behaviour ─────────────────────────────────────────────────────────────
  /** Pre-run behaviour sliders — persisted across page reloads. */
  behaviourProfile: BehaviourProfile;

  // ── Active Run Inventory ──────────────────────────────────────────────────
  /** Items collected during the current run — cleared on run end / retreat. */
  activeInventory: InventoryItem[];
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'tomatoCrawler_session';

const DEFAULT_STATE: SessionState = {
  tomatoCount: 0,
  totalRuns: 0,
  runHistory: [],
  saucePoints: 0,
  baseGear: [
    { itemKey: 'bruisedFist',       upgradeLevel: 0 },
    { itemKey: 'staleBaguetteClub', upgradeLevel: 0 },
  ],
  priorityQueue: [],
  queueSlotCap: 4,
  inventoryPool: [],
  currentFloor: 0,
  currentRunEnemiesDefeated: 0,
  tasks: [],
  pomodoroPhase: 'idle',
  phaseEndTimestamp: null,
  runsSinceLastLongBreak: 0,
  behaviourProfile: { ...DEFAULT_BEHAVIOUR },
  activeInventory: [],
};

// ─── Store ────────────────────────────────────────────────────────────────────

class SessionStoreClass {
  private state: SessionState;

  constructor() {
    const saved = StorageAdapter.get<SessionState>(STORAGE_KEY);
    // Merge onto defaults so any new fields added in future phases are always present
    this.state = saved ? { ...DEFAULT_STATE, ...saved } : { ...DEFAULT_STATE };
  }

  getState(): Readonly<SessionState> {
    return this.state;
  }

  update(patch: Partial<SessionState>): void {
    this.state = { ...this.state, ...patch };
    StorageAdapter.set(STORAGE_KEY, this.state);
  }

  /** Hard reset — wipes localStorage and returns to defaults */
  reset(): void {
    this.state = { ...DEFAULT_STATE };
    StorageAdapter.remove(STORAGE_KEY);
  }
}

export const SessionStore = new SessionStoreClass();
