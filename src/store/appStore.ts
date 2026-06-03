import { create } from 'zustand';
import {
  User,
  Skill,
  UserSkill,
  Output,
  FeedPost,
  Achievement,
  CareerPath,
  CareerPathId,
  CustomPath,
  CustomSkill,
  LogOutputPayload,
  LogOutputResult,
  SkillStatus,
  RoadmapEntry,
  RoadmapPriorityStatus,
  RoadmapStatus,
  EvidenceTier,
  CareerOutcome,
  LogOutcomePayload,
  OutcomeType,
  ExperienceLevel,
  PaceMode,
} from '../types';
import { getLevelFromXP, Colors } from '../utils/theme';
import { track, identify } from '../utils/analytics';

// ─── Progression domain logic (extracted → ../domain/progression for unit testing, ARCH-002) ───
// Pure calculators now live in src/domain/progression.ts. They are imported here
// and re-exported so existing `from '../store/appStore'` imports keep working.
import {
  getDecayStage,
  getBurnoutSignal,
  getEvidenceTier,
  getSkillMasteryLevel,
  getCareerMastery,
  CAREER_MASTERY_LADDER,
  OUTCOME_XP,
} from '../domain/progression';
import type {
  DecayStage,
  BurnoutSignal,
  MasteryLevel,
  CareerMasteryTitle,
} from '../domain/progression';

export {
  getDecayStage,
  getBurnoutSignal,
  getEvidenceTier,
  getSkillMasteryLevel,
  getCareerMastery,
  CAREER_MASTERY_LADDER,
  OUTCOME_XP,
};
export type { DecayStage, BurnoutSignal, MasteryLevel, CareerMasteryTitle };

// ─── Mastery presentation metadata (theme-coupled — stays in the store layer) ───
export const MASTERY_TIERS: Record<MasteryLevel, {
  label: string;
  shortLabel: string;
  color: string;
  icon: string;
  description: string;
}> = {
  0: { label: 'Not Started', shortLabel: '',           color: Colors.textMuted, icon: '○', description: 'Not yet attempted' },
  1: { label: 'Practicing',  shortLabel: 'PRACTICING', color: '#60A5FA',        icon: '◑', description: 'Building familiarity through proof-of-work' },
  2: { label: 'Competent',   shortLabel: 'COMPETENT',  color: '#A855F7',        icon: '●', description: 'Applied and completed — evidence gate passed' },
  3: { label: 'Validated',   shortLabel: 'VALIDATED',  color: '#F59E0B',        icon: '★', description: 'Demonstrated under testing — knowledge confirmed' },
};

export const CAREER_MASTERY_META: Record<CareerMasteryTitle, { color: string; description: string; next: string }> = {
  Beginner:   { color: Colors.textMuted,  description: 'Just getting started',                  next: 'Log outputs to start building skills' },
  Developing: { color: '#60A5FA',         description: 'Building core skills',                  next: 'Complete more skills to reach Competent' },
  Competent:  { color: '#A855F7',         description: 'Applying skills effectively',            next: 'Validate your skills to reach Advanced' },
  Advanced:   { color: Colors.success,    description: 'Demonstrating validated expertise',      next: 'Validate remaining skills to reach Expert' },
  Expert:     { color: Colors.gold,       description: 'Full path mastery — all skills validated', next: 'You\'ve reached the top. Build and share.' },
};

// ─── Static Catalog ──────────────────────────────────────────────────────────

import { CAREER_PATHS } from '../data/careerPaths';
import { ALL_SKILLS } from '../data/skills';
import { ALL_ACHIEVEMENTS } from '../data/achievements';
import { MOCK_FEED } from '../data/mockFeed';

// Re-exported so existing `from '../store/appStore'` imports keep working.
export { CAREER_PATHS, ALL_SKILLS, ALL_ACHIEVEMENTS };
import { reconcileAchievementsAndXP } from '../domain/hydration';
import { loadFromStorage, attachPersistence } from './persistence';
import { createCoreSlice } from './slices/coreSlice';
import { createRoadmapSlice } from './slices/roadmapSlice';
import { createFeedSlice } from './slices/feedSlice';
import { createProfileSlice } from './slices/profileSlice';

// ─── Store ────────────────────────────────────────────────────────────────────

export interface PendingCelebration {
  skillId: string;
  xpGained: number;
  leveledUp: boolean;
  newLevel: number;
}

export interface AppState {
  hasOnboarded: boolean;
  // ARCH-001: Supabase session state — null when not signed in or backend disabled
  supabaseUserId: string | null;
  supabaseEmail: string | null;
  supabaseSyncing: boolean; // true while an initial sync is in progress
  user: User | null;
  userSkills: Record<string, UserSkill>;
  outputs: Output[];
  unlockedAchievementIds: string[];
  communityFeed: FeedPost[];
  userFeedPosts: FeedPost[]; // user-generated posts, persisted to localStorage
  pendingCelebration: PendingCelebration | null;
  selectedSkillId: string | null;
  customPaths: CustomPath[];
  prioritizedPathId: string | null; // path pinned to Home (null → falls back to careerPathId)
  roadmaps: RoadmapEntry[]; // lifecycle tracking per enrolled path
  celebratedMilestones: string[]; // tracks "${pathId}-${tierPct}" keys already shown
  showWelcomeCard: boolean; // true on first Dashboard load after onboarding — ephemeral, not persisted
  savedPostIds: string[]; // post IDs bookmarked by the user
  colorScheme: 'dark' | 'light'; // persisted theme preference
  careerOutcomes: CareerOutcome[]; // self-reported real-world career wins

  completeOnboarding: (name: string, pathId: CareerPathId | string, email?: string, experienceLevel?: ExperienceLevel) => void;
  logOutput: (payload: LogOutputPayload) => LogOutputResult;
  reactToPost: (postId: string, emoji: string) => void;
  toggleSavePost: (postId: string) => void;
  setSelectedSkill: (skillId: string | null) => void;
  clearCelebration: () => void;
  resetApp: () => void;
  addCustomPath: (path: { name: string; icon: string; description: string; color: string; skills: CustomSkill[] }) => string; // returns new path ID
  switchPath: (pathId: string) => void;
  setPrioritizedPath: (pathId: string) => void;
  enrollInRoadmap: (pathId: string) => void; // enroll as SECONDARY + init skills
  setPriorityRoadmap: (pathId: string) => void; // promote to PRIORITY, demote current priority to SECONDARY
  pauseRoadmap: (pathId: string) => void; // ACTIVE → PAUSED
  archiveRoadmap: (pathId: string) => void; // → ARCHIVED
  reactivateRoadmap: (pathId: string) => void; // PAUSED/ARCHIVED → ACTIVE SECONDARY
  addRoadmapItem: (name: string, icon: string) => string; // creates item in personal library, returns new skillId
  // FEAT-001: editable roadmaps — all milestone edits are gated to *before the journey starts*
  // (no progress logged) and to custom paths only; built-in paths must be forked first.
  isRoadmapEditable: (pathId: string) => boolean; // custom + not locked + not started
  forkBuiltInPath: (pathId: CareerPathId | string) => string | null; // copy a built-in path → editable custom copy + enroll; returns new id (null if not built-in)
  addMilestone: (pathId: string, name: string, icon: string) => string | null; // returns new skillId (null if not editable)
  renameMilestone: (pathId: string, skillId: string, name: string) => void;
  removeMilestone: (pathId: string, skillId: string) => void;
  reorderMilestones: (pathId: string, orderedSkillIds: string[]) => void;
  lockRoadmap: (pathId: string, locked: boolean) => void; // user "focus-lock" — commit the roadmap
  deleteRoadmap: (pathId: string) => void; // un-enroll + drop a custom path's definition (the "delete & rebuild" path)
  useStreakFreeze: () => void;
  markMilestoneCelebrated: (key: string) => void;
  dismissWelcomeCard: () => void;
  updateAvatar: (emoji: string) => void;
  updateAvatarImage: (uri: string) => void;
  updateBio: (bio: string) => void;
  updateName: (name: string) => void;
  updateTargetRole: (role: string) => void;
  setComebackGoal: (weeklyGoal: number) => void;
  setPaceMode: (mode: PaceMode) => void;    // sprint / steady / recovery
  validateSkill: (skillId: string) => void; // marks skill validated + grants bonus XP
  logCareerOutcome: (payload: LogOutcomePayload) => number; // returns xpAwarded
  deleteCareerOutcome: (outcomeId: string) => void;
  togglePinOutput: (outputId: string) => void; // pin/unpin output in Portfolio (max 3)
  updateEmail: (email: string) => void;
  deleteOutput: (outputId: string) => void;
  addComment: (postId: string, text: string) => void;
  setColorScheme: (scheme: 'dark' | 'light') => void;
  // ARCH-001: auth actions
  setSupabaseSession: (userId: string | null, email: string | null) => void;
  setSupabaseSyncing: (syncing: boolean) => void;
  syncFromSupabase: () => Promise<void>; // pull remote → merge into local state
}

const saved = loadFromStorage();

// Re-evaluate achievements + heal XP against restored state (see src/domain/hydration.ts).
const _savedUser            = saved?.user ?? null;
const _savedUserSkills      = saved?.userSkills ?? {};
// Heal NaN in xpGained on stored outputs (guard against corrupt data)
const _savedOutputsHealed: Output[] = (saved?.outputs ?? []).map((o) => ({
  ...o,
  xpGained: Number.isFinite(o.xpGained) ? o.xpGained : 0,
}));

const { achievements: _rehydratedAchievements, healedXP: _healedXP } = _savedUser
  ? reconcileAchievementsAndXP({
      savedUnlocked: saved?.unlockedAchievementIds ?? [],
      outputCount: _savedOutputsHealed.length,
      completedSkillCount: Object.values(_savedUserSkills).filter((us) => us.status === 'completed').length,
      xp: _savedUser.xp,
      streak: _savedUser.streak,
      longestStreak: _savedUser.longestStreak,
      hasOutputs: _savedOutputsHealed.length > 0,
    })
  : { achievements: saved?.unlockedAchievementIds ?? [], healedXP: 0 };

import { createAuthSlice } from './slices/authSlice';

export const useAppStore = create<AppState>((set, get) => ({
  hasOnboarded: saved?.hasOnboarded ?? false,
  supabaseUserId: null,
  supabaseEmail: null,
  supabaseSyncing: false,
  user: saved?.user
    ? { ...saved.user, xp: _healedXP, level: getLevelFromXP(_healedXP) }
    : null,
  userSkills: _savedUserSkills,
  outputs: _savedOutputsHealed,
  unlockedAchievementIds: _rehydratedAchievements,
  communityFeed: [...(saved?.userFeedPosts ?? []), ...MOCK_FEED],
  userFeedPosts: saved?.userFeedPosts ?? [],
  pendingCelebration: null,
  selectedSkillId: null,
  customPaths: saved?.customPaths ?? [],
  prioritizedPathId: saved?.prioritizedPathId ?? null,
  roadmaps: (() => {
    const r: RoadmapEntry[] = saved?.roadmaps ?? [];
    // Migration: existing users with no roadmaps array → create initial PRIORITY entry
    if (r.length === 0 && saved?.hasOnboarded && saved?.user?.careerPathId) {
      r.push({
        pathId: saved.user.careerPathId,
        priorityStatus: 'PRIORITY',
        roadmapStatus: 'ACTIVE',
        startedAt: saved.user?.joinedAt ?? new Date().toISOString(),
      });
    }
    return r;
  })(),
  celebratedMilestones: saved?.celebratedMilestones ?? [],
  showWelcomeCard: false,
  savedPostIds: saved?.savedPostIds ?? [],
  colorScheme: saved?.colorScheme ?? 'dark',
  careerOutcomes: saved?.careerOutcomes ?? [],

  ...createCoreSlice(set, get),
  ...createRoadmapSlice(set, get),
  ...createFeedSlice(set, get),
  ...createProfileSlice(set, get),
  ...createAuthSlice(set, get),
}));

// Persist the store to localStorage on every change (see src/store/persistence.ts).
attachPersistence(useAppStore);
