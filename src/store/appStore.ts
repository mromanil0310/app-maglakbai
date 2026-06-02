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
import { initUserSkills, unlockDependentSkills, checkAchievements } from '../domain/skillGraph';
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
}

const saved = loadFromStorage();

// Re-evaluate achievements against restored state.
// 1. Add any that were earned but not recorded (e.g. pre-fix accounts).
// 2. Remove any that are no longer valid (e.g. output deleted without revoking the badge).
const _savedOutputs: Output[]      = saved?.outputs ?? [];
const _savedUnlocked: string[]      = saved?.unlockedAchievementIds ?? [];
const _savedUser                    = saved?.user ?? null;
const _savedUserSkills              = saved?.userSkills ?? {};
const _savedCompletedSkillCount     = Object.values(_savedUserSkills).filter((us) => us.status === 'completed').length;

// Checks whether a given achievement id is still valid given the current saved state
function _achievementStillValid(id: string): boolean {
  if (id === 'first-steps')    return _savedOutputs.length >= 1;
  if (id === 'builder')        return _savedOutputs.length >= 5;
  if (id === 'skill-mastered') return _savedCompletedSkillCount >= 1;
  if (id === 'triple-master')  return _savedCompletedSkillCount >= 3;
  // Streak and XP-threshold achievements are persistent once earned
  return true;
}

const _rehydratedAchievements: string[] = _savedUser
  ? (() => {
      // Step 1: remove any that are no longer valid
      const stillValid = _savedUnlocked.filter(_achievementStillValid);
      // Step 2: add any that were missed (positive rehydration)
      const missed = checkAchievements(
        _savedOutputs.length,
        _savedCompletedSkillCount,
        _savedUser.xp,
        _savedUser.streak,
        stillValid,
      );
      return [...stillValid, ...missed];
    })()
  : _savedUnlocked;

// Heal orphaned XP: if the rehydration revoked achievements, deduct their XP
// so user.xp stays consistent with what the achievements actually granted.
const _revokedOnLoad = _savedUser
  ? _savedUnlocked.filter((id) => !_rehydratedAchievements.includes(id))
  : [];
const _revokedXPOnLoad = _revokedOnLoad.reduce((sum, id) => {
  const ach = ALL_ACHIEVEMENTS.find((a) => a.id === id);
  return sum + (ach?.xpGranted ?? 0);
}, 0);

// Also heal NaN in xpGained on stored outputs (guard against corrupt data)
const _savedOutputsHealed = _savedOutputs.map((o) => ({
  ...o,
  xpGained: Number.isFinite(o.xpGained) ? o.xpGained : 0,
}));

// Hard-floor: if there are no outputs AND no streak history (streak + longestStreak both 0),
// ALL earned XP must come from achievements only — there's no way streak milestone bonuses
// accumulated. Strip any phantom output XP from deleted/lost records.
const _validAchievementXP = _rehydratedAchievements.reduce((sum, id) => {
  const ach = ALL_ACHIEVEMENTS.find((a) => a.id === id);
  return sum + (ach?.xpGranted ?? 0);
}, 0);
const _healedXP = _savedUser
  ? (() => {
      const afterRevoke = Math.max(0, _savedUser.xp - _revokedXPOnLoad);
      const hasNoHistory =
        _savedOutputsHealed.length === 0 &&
        (_savedUser.streak ?? 0) === 0 &&
        (_savedUser.longestStreak ?? 0) === 0;
      // For users with no outputs and no streak history, cap XP to what valid
      // achievements can account for. Preserves streak milestone XP for active users.
      return hasNoHistory ? Math.min(afterRevoke, _validAchievementXP) : afterRevoke;
    })()
  : 0;

export const useAppStore = create<AppState>((set, get) => ({
  hasOnboarded: saved?.hasOnboarded ?? false,
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
}));

// Persist the store to localStorage on every change (see src/store/persistence.ts).
attachPersistence(useAppStore);
