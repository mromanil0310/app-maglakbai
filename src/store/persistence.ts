// ─── Persistence ────────────────────────────────────────────────────────────────
// localStorage persistence for the SkillForge store, extracted from appStore.ts
// (ARCH-002). Single source-of-truth for what gets persisted (`getPersistable`) and
// how (`attachPersistence`). The store imports `loadFromStorage` for initial hydration
// and calls `attachPersistence(useAppStore)` once after creation.
//
// NOTE: there is still no schema versioning/migration here — see ARCH-003.

import type { StoreApi } from 'zustand';
import type { AppState } from './appStore'; // type-only import → no runtime cycle

const STORAGE_KEY = 'skillforge_v1';

function saveToStorage(data: object): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Notify UI (e.g. avatar too large) — components listen for this event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('skillforge:storage-quota-exceeded'));
    }
  }
}

export function loadFromStorage(): Partial<AppState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// The persisted slice of state. Adding a new persisted field requires updating
// AppState and this selector (+ the equality check below).
function getPersistable(state: AppState) {
  return {
    hasOnboarded: state.hasOnboarded,
    user: state.user,
    userSkills: state.userSkills,
    outputs: state.outputs,
    unlockedAchievementIds: state.unlockedAchievementIds,
    customPaths: state.customPaths,
    prioritizedPathId: state.prioritizedPathId,
    roadmaps: state.roadmaps,
    celebratedMilestones: state.celebratedMilestones,
    userFeedPosts: state.userFeedPosts,
    savedPostIds: state.savedPostIds,
    colorScheme: state.colorScheme,
    careerOutcomes: state.careerOutcomes,
  };
}

// Subscribe to the store and persist the persistable slice on every change.
// Short-circuits via reference equality when no persisted field changed.
export function attachPersistence(store: StoreApi<AppState>): void {
  let last: ReturnType<typeof getPersistable> | null = null;
  store.subscribe((state) => {
    const p = getPersistable(state);
    if (
      last !== null &&
      last.hasOnboarded === p.hasOnboarded &&
      last.user === p.user &&
      last.userSkills === p.userSkills &&
      last.outputs === p.outputs &&
      last.unlockedAchievementIds === p.unlockedAchievementIds &&
      last.customPaths === p.customPaths &&
      last.prioritizedPathId === p.prioritizedPathId &&
      last.roadmaps === p.roadmaps &&
      last.celebratedMilestones === p.celebratedMilestones &&
      last.userFeedPosts === p.userFeedPosts &&
      last.savedPostIds === p.savedPostIds &&
      last.colorScheme === p.colorScheme &&
      last.careerOutcomes === p.careerOutcomes
    ) return;
    last = p;
    saveToStorage(p);
  });
}
