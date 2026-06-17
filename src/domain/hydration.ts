// ─── Load-time state reconciliation ────────────────────────────────────────────
// Pure healing logic used when rehydrating persisted state (extracted from
// appStore.ts; ARCH-002 spirit + fixes UX-025). Given the saved achievement list
// and the saved progression state, it:
//   1. drops achievements that are no longer valid (e.g. outputs were deleted),
//   2. adds achievements that were earned but never recorded ("missed"),
//   3. heals user.xp so it stays consistent with the achievements actually held:
//        - subtract XP for revoked achievements,
//        - **credit XP for newly-added (missed) achievements** (UX-025: previously
//          missed achievements were added to the list but their XP was never
//          granted, so the Profile "XP Sources" breakdown overshot Total XP and
//          the user was under-credited),
//        - for accounts with no outputs and no streak history, cap XP to what the
//          held achievements can account for (strip phantom output XP).

import type { UserSkill } from '../types';
import { ALL_ACHIEVEMENTS } from '../data/achievements';
import { checkAchievements } from './skillGraph';

// ─── Phantom skill-progress heal ────────────────────────────────────────────────
// An account that has logged ZERO outputs cannot hold any legitimately completed
// or in-progress skill — progress requires logged proof. Older builds pre-credited
// skills (status 'completed'/'in_progress') and XP directly from the experience-level
// onboarding step, producing "milestones" with no backing output that also round-trip
// through Cloud Backup. This strips that phantom progress back to a clean, accessible
// state. It is a strict no-op the moment any real output exists, so it can never
// touch a user with genuine progress. Pure + idempotent.
export function healPhantomSkillProgress(
  userSkills: Record<string, UserSkill>,
  outputCount: number,
): Record<string, UserSkill> {
  if (outputCount > 0) return userSkills;
  let changed = false;
  const healed: Record<string, UserSkill> = {};
  for (const [id, us] of Object.entries(userSkills)) {
    if (us.status === 'completed' || us.status === 'in_progress') {
      // Demote unearned progress; keep the node accessible, drop proof markers.
      healed[id] = { skillId: us.skillId, status: 'available', outputCount: 0 };
      changed = true;
    } else {
      healed[id] = us;
    }
  }
  return changed ? healed : userSkills;
}

const grantOf = (id: string): number =>
  ALL_ACHIEVEMENTS.find((a) => a.id === id)?.xpGranted ?? 0;

// Output/skill-threshold achievements can become invalid if their underlying
// proof is gone. Streak/XP-threshold achievements are persistent once earned.
function achievementStillValid(id: string, outputCount: number, completedSkillCount: number): boolean {
  if (id === 'first-steps')    return outputCount >= 1;
  if (id === 'builder')        return outputCount >= 5;
  if (id === 'skill-mastered') return completedSkillCount >= 1;
  if (id === 'triple-master')  return completedSkillCount >= 3;
  return true;
}

export interface ReconcileInput {
  savedUnlocked: string[];
  outputCount: number;
  completedSkillCount: number;
  xp: number;
  streak: number;
  longestStreak: number;
  hasOutputs: boolean;
}

export interface ReconcileResult {
  achievements: string[];
  healedXP: number;
}

export function reconcileAchievementsAndXP(input: ReconcileInput): ReconcileResult {
  const { savedUnlocked, outputCount, completedSkillCount, xp, streak, longestStreak, hasOutputs } = input;

  // 1. drop invalid
  const stillValid = savedUnlocked.filter((id) => achievementStillValid(id, outputCount, completedSkillCount));
  // 2. add missed (earned by current state but not recorded)
  const missed = checkAchievements(outputCount, completedSkillCount, xp, streak, stillValid);
  const achievements = [...stillValid, ...missed];

  // 3. heal XP
  const revokedXP = savedUnlocked
    .filter((id) => !achievements.includes(id))
    .reduce((sum, id) => sum + grantOf(id), 0);
  const addedXP = achievements
    .filter((id) => !savedUnlocked.includes(id))
    .reduce((sum, id) => sum + grantOf(id), 0);
  const validAchievementXP = achievements.reduce((sum, id) => sum + grantOf(id), 0);

  const afterAdjust = Math.max(0, xp - revokedXP + addedXP);
  const hasNoHistory = !hasOutputs && (streak ?? 0) === 0 && (longestStreak ?? 0) === 0;
  const healedXP = hasNoHistory ? Math.min(afterAdjust, validAchievementXP) : afterAdjust;

  return { achievements, healedXP };
}
