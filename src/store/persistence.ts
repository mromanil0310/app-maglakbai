// ─── Persistence ────────────────────────────────────────────────────────────────
// localStorage persistence for the SkillForge store, extracted from appStore.ts
// (ARCH-002) and made schema-versioned (ARCH-003).
//
// On disk the payload is a versioned envelope: `{ v: SCHEMA_VERSION, data: {...} }`.
// On load we detect the version, run migrations up to the current schema, and
// lightly validate the shape before handing it back — so a schema change can never
// silently corrupt or crash on stale data (with no backend, localStorage is the
// system of record). Legacy pre-ARCH-003 saves were unversioned flat objects;
// they are treated as schema v0 and migrated forward.

import type { StoreApi } from 'zustand';
import type { AppState } from './appStore'; // type-only import → no runtime cycle

const STORAGE_KEY = 'skillforge_v1'; // localStorage key (kept stable so existing data isn't orphaned)
export const SCHEMA_VERSION = 1; // bump when the persisted shape changes; add a migration step below

interface VersionedEnvelope {
  v: number;
  data: unknown;
}

// The persisted slice of state — the single typed shape we read/write.
// (Adding a persisted field: update getPersistable + the equality check in
// attachPersistence, and add a migration step + SCHEMA_VERSION bump if the
// change isn't purely additive-with-safe-defaults.)
export type PersistedState = ReturnType<typeof getPersistable>;

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

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

// Migrate raw persisted `data` from `fromVersion` up to SCHEMA_VERSION.
// Each step transforms the previous shape into the next; returns null if the
// data can't be brought to the current version.
function migrate(data: Record<string, unknown>, fromVersion: number): Record<string, unknown> | null {
  let v = fromVersion;
  let d = data;
  // v0 → v1: the legacy unversioned flat object already matches v1's data shape (identity).
  if (v === 0) v = 1;
  // Future steps go here, e.g.:
  //   if (v === 1) { d = migrateV1toV2(d); v = 2; }
  return v === SCHEMA_VERSION ? d : null;
}

function saveToStorage(data: PersistedState): void {
  try {
    const envelope: VersionedEnvelope = { v: SCHEMA_VERSION, data };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // Notify UI (e.g. avatar too large) — components listen for this event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('skillforge:storage-quota-exceeded'));
    }
  }
}

export function loadFromStorage(): Partial<PersistedState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed)) return null;

    // Versioned envelope vs. legacy unversioned payload (schema v0).
    let version: number;
    let data: unknown;
    if (typeof parsed.v === 'number' && 'data' in parsed) {
      version = parsed.v;
      data = parsed.data;
    } else {
      version = 0;
      data = parsed;
    }

    if (!isPlainObject(data)) return null;
    if (version > SCHEMA_VERSION) return null; // saved by a newer app version → start fresh rather than crash

    const migrated = migrate(data, version);
    if (!migrated) return null;
    return migrated as Partial<PersistedState>;
  } catch {
    return null;
  }
}

// Subscribe to the store and persist the persistable slice on every change.
// Short-circuits via reference equality when no persisted field changed.
export function attachPersistence(store: StoreApi<AppState>): void {
  let last: PersistedState | null = null;
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
