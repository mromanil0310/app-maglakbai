// Core progression store slice — actions extracted from appStore.ts (ARCH-002).
// Action bodies are unchanged; recombined in appStore.ts via the Zustand slices pattern.

import type { StoreApi } from 'zustand';
import type { AppState, PendingCelebration } from '../appStore';
import type {
  User, Output, FeedPost, CareerPathId, CustomPath, CustomSkill,
  LogOutputPayload, LogOutputResult, SkillStatus, RoadmapEntry,
  RoadmapPriorityStatus, RoadmapStatus, CareerOutcome, LogOutcomePayload,
  OutcomeType, ExperienceLevel, PaceMode,
} from '../../types';
import { getLevelFromXP, Colors } from '../../utils/theme';
import { track, identify } from '../../utils/analytics';
import { CAREER_PATHS } from '../../data/careerPaths';
import { ALL_SKILLS } from '../../data/skills';
import { ALL_ACHIEVEMENTS } from '../../data/achievements';
import { MOCK_FEED } from '../../data/mockFeed';
import { getEvidenceTier, OUTCOME_XP, getCareerMastery, calculateOutputXP, CUSTOM_SKILL_COMPLETION_XP, ONBOARDING_XP_GRANT } from '../../domain/progression';
import { initUserSkills, unlockDependentSkills, checkAchievements } from '../../domain/skillGraph';
// ARCH-001: fire-and-forget Supabase sync after local state is updated
import { upsertProfile, insertOutput, upsertSkillProgress } from '../../lib/db';
import { signOut } from '../../lib/auth';

type Set = StoreApi<AppState>['setState'];
type Get = StoreApi<AppState>['getState'];

export const createCoreSlice = (set: Set, get: Get): Pick<AppState, 'completeOnboarding' | 'logOutput' | 'validateSkill' | 'logCareerOutcome' | 'deleteCareerOutcome' | 'deleteOutput' | 'useStreakFreeze' | 'markMilestoneCelebrated' | 'clearCelebration' | 'setSelectedSkill' | 'dismissWelcomeCard' | 'resetApp' | 'togglePinOutput'> => ({
  completeOnboarding: (name: string, pathId: CareerPathId | string, email?: string, experienceLevel?: ExperienceLevel) => {
    const userId = `user_${Date.now()}`;
    const pathMeta = CAREER_PATHS.find(p => p.id === pathId);
    const isBuiltInPath = !!pathMeta;

    // For custom paths, find the path definition so we can use its icon/color
    const customPathMeta = !isBuiltInPath
      ? get().customPaths.find(p => p.id === pathId)
      : null;

    // UX-029: grant a small "journey started" XP so new users never land on 0.
    // Pre-credited skill XP is added below after the experience-level block.
    const todayStr = new Date().toISOString().slice(0, 10);

    const user: User = {
      id: userId,
      name,
      handle: name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '') || 'explorer',
      email: email?.trim() || undefined,
      careerPathId: pathId,
      xp: ONBOARDING_XP_GRANT,
      level: getLevelFromXP(ONBOARDING_XP_GRANT),
      // UX-029: starting the streak at 1 (they took real action today by beginning
      // their journey). Setting lastActiveDate prevents double-incrementing if they
      // log an output later the same day. Safe with BUG-012 fix: we set BOTH fields
      // together so the first same-day logOutput correctly stays at 1 (not 0→1).
      streak: 1,
      longestStreak: 1,
      lastActiveDate: todayStr,
      bio: '',
      avatarEmoji: pathMeta?.icon ?? customPathMeta?.icon ?? '⚡',
      avatarColor: pathMeta?.dimColor ?? '#0A0A0F',
      joinedAt: new Date().toISOString(),
      streakFreezes: 0,
      experienceLevel: experienceLevel ?? 'beginner',
    };

    // ── Skills initialization ─────────────────────────────────────────────────
    // Built-in paths: initialize from the catalog. Custom paths: preserve
    // userSkills already set by addCustomPath (called just before this in the
    // onboarding flow) so we don't wipe out the custom skill entries.
    let userSkills = isBuiltInPath ? initUserSkills(pathId as CareerPathId) : { ...get().userSkills };

    // ── Pre-credit skills based on experience level (built-in paths only) ────
    // 'building': mark first skill in_progress (half-way) — they have some foundation
    // 'experienced': mark first 2 skills completed — prior experience credited
    if (isBuiltInPath && pathMeta && (experienceLevel === 'building' || experienceLevel === 'experienced')) {
      const orderedSkillIds = pathMeta.skillIds;
      const now = new Date().toISOString();

      if (experienceLevel === 'building') {
        // Pre-credit skill 1 as in_progress (1 output logged)
        const skill1Id = orderedSkillIds[0];
        if (skill1Id && userSkills[skill1Id]) {
          userSkills = {
            ...userSkills,
            [skill1Id]: { skillId: skill1Id, status: 'in_progress', outputCount: 1 },
          };
        }
      } else {
        // 'experienced': pre-complete first 2 skills, unlock their dependents
        const toPrecredit = orderedSkillIds.slice(0, 2);
        for (const skillId of toPrecredit) {
          if (!userSkills[skillId]) continue;
          const skill = ALL_SKILLS.find((s) => s.id === skillId);
          userSkills = {
            ...userSkills,
            [skillId]: {
              skillId,
              status: 'completed',
              outputCount: skill?.requiredOutputs ?? 1,
              completedAt: now,
            },
          };
          userSkills = unlockDependentSkills(skillId, pathId as CareerPathId, userSkills);
        }
      }
    }

    // UX-029: credit XP for pre-completed skills so experienced users don't start
    // with completed skills but 0 XP. Each completed skill grants its xpReward;
    // in-progress skills grant one output's worth of base XP.
    let precreditXP = 0;
    if (isBuiltInPath && pathMeta) {
      if (experienceLevel === 'building') {
        precreditXP = 50; // one output's base XP for the in-progress first skill
      } else if (experienceLevel === 'experienced') {
        const toPrecredit = pathMeta.skillIds.slice(0, 2);
        toPrecredit.forEach((skillId) => {
          const skill = ALL_SKILLS.find((s) => s.id === skillId);
          precreditXP += skill?.xpReward ?? 75;
        });
      }
    }
    const finalXP = ONBOARDING_XP_GRANT + precreditXP;
    const finalUser: User = precreditXP > 0
      ? { ...user, xp: finalXP, level: getLevelFromXP(finalXP) }
      : user;

    const initialRoadmap: RoadmapEntry = {
      pathId,
      priorityStatus: 'PRIORITY',
      roadmapStatus: 'ACTIVE',
      startedAt: new Date().toISOString(),
    };
    const state = { hasOnboarded: true, user: finalUser, userSkills, prioritizedPathId: pathId, roadmaps: [initialRoadmap], showWelcomeCard: true };
    set(state);
    // ARCH-001: sync the new profile to Supabase (fire-and-forget)
    const syncUserId = get().supabaseUserId;
    if (syncUserId) upsertProfile(syncUserId, finalUser).catch(() => {});
    // Anonymous-only analytics: identify by id, never name/email (see analytics.ts).
    identify(userId, { career_path: pathId, joined_at: user.joinedAt });
    track('onboarding_completed', {
      career_path: pathId,
      is_custom_path: !isBuiltInPath,
      has_email: !!email?.trim(),
      experience_level: experienceLevel ?? 'beginner',
    });
  },

  logOutput: (payload: LogOutputPayload): LogOutputResult => {
    const state = get();
    if (!state.user) return { skillCompleted: false, xpGained: 0, leveledUp: false, newLevel: 1 };

    const skill = ALL_SKILLS.find((s) => s.id === payload.skillId);

    // For custom path items (not in ALL_SKILLS catalog), find the skill in customPaths
    let customSkillName: string | null = null;
    if (!skill) {
      for (const cp of state.customPaths) {
        const cs = cp.skills.find((s) => s.id === payload.skillId);
        if (cs) { customSkillName = cs.name; break; }
      }
      if (customSkillName === null) {
        // Not tied to any milestone — still award XP for the work done
        customSkillName = 'General Work';
      }
    }
    const skillName = skill?.name ?? customSkillName!;

    // ISSUE-010: XP = base (by type) + quality bonus + takeaway bonus.
    // Calculation delegated to domain/progression.ts (ARCH-006 — single source of truth).
    const OUTPUT_XP = calculateOutputXP(
      payload.type,
      payload.description.length,
      (payload.keyTakeaway?.trim().length ?? 0) > 0,
    );
    const existingUserSkill = state.userSkills[payload.skillId] ?? {
      skillId: payload.skillId,
      status: 'available' as SkillStatus,
      outputCount: 0,
    };

    const newOutputCount = existingUserSkill.outputCount + 1;
    // Custom items complete after 1 output; built-in skills use their requiredOutputs
    const requiredOutputs = skill?.requiredOutputs ?? 1;
    const wouldComplete = newOutputCount >= requiredOutputs;

    // ── Evidence gate (built-in skills only) ────────────────────────────────
    // A skill may not complete unless at least one of its outputs is 'verified'
    // (has a link) or 'documented' (description ≥ 50 chars). This prevents
    // users from spamming minimal entries to fake mastery.
    const currentEvidenceTier = getEvidenceTier(payload.link, payload.description);
    let evidenceRequired = false;
    if (wouldComplete && skill) {
      const hasQualityEvidence =
        currentEvidenceTier !== 'logged' || // current output qualifies
        state.outputs
          .filter((o) => o.skillId === payload.skillId)
          .some((o) => {
            const t = o.evidenceTier ?? getEvidenceTier(o.link, o.description);
            return t !== 'logged';
          });
      evidenceRequired = !hasQualityEvidence;
    }

    const skillCompleted = wouldComplete && !evidenceRequired;
    // Built-in skills award their curated reward; user-defined (custom) milestones
    // award a modest flat bonus (FEAT-001) — proof is still required to complete them.
    const skillXP = skillCompleted ? (skill ? skill.xpReward : CUSTOM_SKILL_COMPLETION_XP) : 0;
    const totalXPGained = OUTPUT_XP + skillXP;

    const newXP = state.user.xp + totalXPGained;
    const oldLevel = state.user.level;
    const newLevel = getLevelFromXP(newXP);
    const leveledUp = newLevel > oldLevel;

    const newOutput: Output = {
      id: `out_${Date.now()}`,
      skillId: payload.skillId,
      skillName,
      type: payload.type,
      title: payload.title,
      description: payload.description,
      link: payload.link,
      keyTakeaway: payload.keyTakeaway?.trim() || undefined,
      xpGained: totalXPGained,
      createdAt: new Date().toISOString(),
      evidenceTier: currentEvidenceTier,
    };

    let updatedUserSkills = {
      ...state.userSkills,
      [payload.skillId]: {
        ...existingUserSkill,
        outputCount: newOutputCount,
        status: skillCompleted
          ? ('completed' as SkillStatus)
          : ('in_progress' as SkillStatus),
        completedAt: skillCompleted ? new Date().toISOString() : undefined,
      },
    };

    // Only unlock dependent skills for built-in career path skills (use skill's own pathId, not enrolled path)
    if (skillCompleted && skill && CAREER_PATHS.some(p => p.id === skill.pathId)) {
      updatedUserSkills = unlockDependentSkills(payload.skillId, skill.pathId as CareerPathId, updatedUserSkills);
    }

    // Unlock next skill in custom path sequence when current skill completes
    if (skillCompleted && !skill) {
      for (const cp of state.customPaths) {
        const idx = cp.skills.findIndex(s => s.id === payload.skillId);
        if (idx >= 0 && idx < cp.skills.length - 1) {
          const nextSkill = cp.skills[idx + 1];
          if (updatedUserSkills[nextSkill.id]?.status === 'locked') {
            updatedUserSkills = {
              ...updatedUserSkills,
              [nextSkill.id]: {
                skillId: nextSkill.id,
                status: 'available' as SkillStatus,
                outputCount: updatedUserSkills[nextSkill.id]?.outputCount ?? 0,
              },
            };
          }
          break;
        }
      }
    }

    const newOutputs = [...state.outputs, newOutput];

    // Check achievements
    const completedSkillCount = Object.values(updatedUserSkills).filter(
      (us) => us.status === 'completed'
    ).length;
    const newAchievementIds = checkAchievements(
      newOutputs.length,
      completedSkillCount,
      newXP,
      state.user.streak,
      state.unlockedAchievementIds
    );
    const bonusXP = newAchievementIds.reduce((sum, id) => {
      const ach = ALL_ACHIEVEMENTS.find((a) => a.id === id);
      return sum + (ach?.xpGranted ?? 0);
    }, 0);

    const finalXP = newXP + bonusXP;
    const finalLevel = getLevelFromXP(finalXP);

    // ── Streak calculation ────────────────────────────────────────────────────
    // Compare today's date (local) against the last date the user logged anything.
    const todayStr = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    const lastActive = state.user.lastActiveDate;
    let newStreak = state.user.streak;

    if (!lastActive) {
      // First ever log — start at 1
      newStreak = 1;
    } else if (lastActive === todayStr) {
      // Already logged today — streak unchanged
      newStreak = state.user.streak;
    } else {
      // Check consecutive / grace-period / broken
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);

      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const twoDaysAgoStr = twoDaysAgo.toISOString().slice(0, 10);

      if (lastActive === yesterdayStr) {
        newStreak = state.user.streak + 1; // consecutive day
      } else if (lastActive === twoDaysAgoStr) {
        newStreak = state.user.streak; // grace period: preserve streak, don't increment
      } else {
        newStreak = 1; // streak broken
      }
    }

    const newLongestStreak = Math.max(state.user.longestStreak, newStreak);

    // Award a streak freeze when streak first hits a multiple of 7
    const hitsFreezeMilestone = newStreak > 0 && newStreak % 7 === 0 && state.user.streak % 7 !== 0;
    const newFreezes = (state.user.streakFreezes ?? 0) + (hitsFreezeMilestone ? 1 : 0);

    // One-time milestone bonus when streak first crosses 7 / 14 / 30
    const streakMilestoneBonus =
      (newStreak === 7  && state.user.streak < 7)  ? 25  :
      (newStreak === 14 && state.user.streak < 14) ? 50  :
      (newStreak === 30 && state.user.streak < 30) ? 100 : 0;

    // Re-check streak-based achievements with the updated streak value
    const streakAchievementIds = checkAchievements(
      newOutputs.length,
      completedSkillCount,
      finalXP,
      newStreak,
      [...state.unlockedAchievementIds, ...newAchievementIds]
    );
    const streakAchievementBonusXP = streakAchievementIds.reduce((sum, id) => {
      const ach = ALL_ACHIEVEMENTS.find((a) => a.id === id);
      return sum + (ach?.xpGranted ?? 0);
    }, 0);
    const absoluteFinalXP = finalXP + streakAchievementBonusXP + streakMilestoneBonus;
    const absoluteFinalLevel = getLevelFromXP(absoluteFinalXP);
    const allNewAchievementIds = [...newAchievementIds, ...streakAchievementIds];

    // UX-030: the TOTAL XP the user actually gained this action (output + skill
    // bonus + achievement grants + streak-milestone bonus), plus the unlocked
    // achievements — so the milestone celebration reconciles with the real
    // XP change instead of showing only output+skill XP.
    const sessionXpGained = absoluteFinalXP - state.user.xp;
    const newAchievements = allNewAchievementIds
      .map((id) => ALL_ACHIEVEMENTS.find((a) => a.id === id))
      .filter((a) => !!a)
      .map((a) => ({ id: a!.id, title: a!.title, xpGranted: a!.xpGranted }));

    const updatedUser: User = {
      ...state.user,
      xp: absoluteFinalXP,
      level: absoluteFinalLevel,
      streak: newStreak,
      longestStreak: newLongestStreak,
      lastActiveDate: todayStr,
      streakFreezes: newFreezes,
    };

    // Add to feed
    const feedPost: FeedPost = {
      id: `fp_${Date.now()}`,
      userId: state.user.id,
      userName: state.user.name,
      userHandle: state.user.handle,
      avatarEmoji: state.user.avatarEmoji,
      avatarColor: state.user.avatarColor,
      avatarUri: state.user.avatarUri,
      // Use the logged skill's actual pathId so secondary-roadmap posts appear under the correct path filter.
      // Fall back to the user's primary careerPathId for custom skills (they have no built-in pathId).
      pathId: skill?.pathId ?? state.user.careerPathId,
      pathLabel: CAREER_PATHS.find((p) => p.id === (skill?.pathId ?? state.user!.careerPathId))?.name ?? '',
      pathColor: CAREER_PATHS.find((p) => p.id === (skill?.pathId ?? state.user!.careerPathId))?.color ?? '#7C3AED',
      type: skillCompleted ? 'milestone' : 'output',
      skillId: payload.skillId,
      skillName,
      outputTitle: payload.title,
      content: payload.description,
      xpGained: totalXPGained,
      reactions: {},
      userReactions: [],
      comments: [],
      timestamp: new Date().toISOString(),
      isCurrentUser: true,
    };

    const updatedUserFeedPosts = [feedPost, ...state.userFeedPosts];
    const updatedFeed = [feedPost, ...state.communityFeed];
    const updatedAchievementIds = [...state.unlockedAchievementIds, ...allNewAchievementIds];

    const celebration: PendingCelebration | null = skillCompleted
      ? { skillId: payload.skillId, xpGained: totalXPGained, sessionXpGained, newAchievements, leveledUp: absoluteFinalLevel > oldLevel, newLevel: absoluteFinalLevel }
      : null;

    const newState = {
      user: updatedUser,
      userSkills: updatedUserSkills,
      outputs: newOutputs,
      communityFeed: updatedFeed,
      userFeedPosts: updatedUserFeedPosts,
      unlockedAchievementIds: updatedAchievementIds,
      pendingCelebration: celebration,
    };

    set(newState);

    // ── Analytics ─────────────────────────────────────────────────────────────
    const daysSinceJoin = state.user.joinedAt
      ? Math.floor((Date.now() - new Date(state.user.joinedAt).getTime()) / 86_400_000)
      : 0;
    const isFirstOutput = newOutputs.length === 1;
    if (isFirstOutput && state.user.joinedAt) {
      const minutesSinceJoin = Math.round(
        (Date.now() - new Date(state.user.joinedAt).getTime()) / 60_000
      );
      track('first_output_logged', {
        output_type: payload.type,
        skill_id: payload.skillId,
        skill_name: skillName,
        xp_gained: totalXPGained,
        time_to_first_output_minutes: minutesSinceJoin,
        career_path: state.user.careerPathId,
      });
    }
    track('output_logged', {
      output_type: payload.type,
      skill_id: payload.skillId,
      skill_name: skillName,
      xp_gained: totalXPGained,
      total_outputs: newOutputs.length,
      is_first_output: isFirstOutput,
      days_since_join: daysSinceJoin,
      streak: newStreak,
    });
    if (skillCompleted) {
      track('skill_completed', {
        skill_id: payload.skillId,
        skill_name: skillName,
        xp_reward: skill?.xpReward ?? 0,
        rarity: skill?.rarity ?? 'common',
        output_count: newOutputCount,
      });
    }
    if (absoluteFinalLevel > oldLevel) {
      track('level_up', { old_level: oldLevel, new_level: absoluteFinalLevel, total_xp: absoluteFinalXP });
    }
    allNewAchievementIds.forEach((achId) => {
      const ach = ALL_ACHIEVEMENTS.find((a) => a.id === achId);
      if (ach) track('achievement_unlocked', { achievement_id: achId, achievement_title: ach.title, rarity: ach.rarity });
    });
    if (streakMilestoneBonus > 0) {
      track('streak_milestone', { streak: newStreak, bonus_xp: streakMilestoneBonus });
    }
    // NOTE: retention_dN events are NOT fired here. Retention is "did the user
    // come back," which is driven by app opens — see trackRetention() called on
    // session start in App.tsx. Firing them from logOutput (the old behaviour)
    // missed every returning user who didn't happen to log on the exact Nth day.
    // ─────────────────────────────────────────────────────────────────────────

    // ARCH-001: fire-and-forget Supabase sync (localStorage already updated above via set())
    const syncUserId = get().supabaseUserId;
    if (syncUserId) {
      const syncPathId = updatedUser.careerPathId;
      insertOutput(syncUserId, newOutput, syncPathId).catch(() => {});
      upsertSkillProgress(syncUserId, payload.skillId, syncPathId, updatedUserSkills[payload.skillId]).catch(() => {});
      upsertProfile(syncUserId, updatedUser).catch(() => {});
    }

    return {
      skillCompleted,
      xpGained: totalXPGained,
      sessionXpGained,
      newAchievements,
      leveledUp: absoluteFinalLevel > oldLevel,
      newLevel: absoluteFinalLevel,
      newSkillId: skillCompleted ? payload.skillId : undefined,
      streakBonusXP: streakMilestoneBonus > 0 ? streakMilestoneBonus : undefined,
      newStreak,
      evidenceRequired: evidenceRequired || undefined,
    };
  },

  validateSkill: (skillId: string) => {
    const state = get();
    if (!state.user) return;
    const us = state.userSkills[skillId];
    if (!us || us.status !== 'completed' || us.validated) return; // guard: must be completed and not already validated
    const VALIDATION_BONUS_XP = 50;
    const newXP = state.user.xp + VALIDATION_BONUS_XP;
    const newLevel = getLevelFromXP(newXP);
    set({
      user: { ...state.user, xp: newXP, level: newLevel },
      userSkills: {
        ...state.userSkills,
        [skillId]: {
          ...us,
          validated: true,
          validatedAt: new Date().toISOString(),
        },
      },
    });
  },

  logCareerOutcome: (payload: LogOutcomePayload): number => {
    const state = get();
    if (!state.user) return 0;

    const xpAwarded = OUTCOME_XP[payload.type];
    const newXP = state.user.xp + xpAwarded;
    const newLevel = getLevelFromXP(newXP);

    const outcome: CareerOutcome = {
      id: `outcome_${Date.now()}`,
      type: payload.type,
      title: payload.title.trim(),
      company: payload.company?.trim() || undefined,
      note: payload.note?.trim() || undefined,
      xpAwarded,
      date: payload.date,
      createdAt: new Date().toISOString(),
    };

    // Build a feed post so the win shows up in the community feed
    const pathEntry = CAREER_PATHS.find((p) => p.id === state.user!.careerPathId);
    const winLabels: Record<OutcomeType, string> = {
      interview:       '🎯 Landed an interview',
      offer:           '🎉 Received a job offer',
      promotion:       '🚀 Got promoted',
      role_change:     '✨ Changed roles',
      certification:   '🏅 Earned a certification',
      salary_increase: '💰 Got a raise',
      portfolio:       '🌐 Published to portfolio',
      freelance:       '💼 Won a freelance client',
    };
    const winContent = payload.company
      ? `${winLabels[payload.type]}: ${payload.title.trim()} @ ${payload.company.trim()}${payload.note ? ` — ${payload.note.trim()}` : ''}`
      : `${winLabels[payload.type]}: ${payload.title.trim()}${payload.note ? ` — ${payload.note.trim()}` : ''}`;

    const winPost: FeedPost = {
      id: `fp_win_${Date.now()}`,
      userId: state.user.id,
      userName: state.user.name,
      userHandle: state.user.handle,
      avatarEmoji: state.user.avatarEmoji,
      avatarColor: state.user.avatarColor,
      avatarUri: state.user.avatarUri,
      pathId: state.user.careerPathId,
      pathLabel: pathEntry?.name ?? 'Career',
      pathColor: pathEntry?.color ?? Colors.primary,
      type: 'career_win',
      outcomeType: payload.type,
      content: winContent,
      xpGained: xpAwarded,
      reactions: {},
      userReactions: [],
      comments: [],
      timestamp: new Date().toISOString(),
      isCurrentUser: true,
    };

    const updatedUserFeedPosts = [winPost, ...state.userFeedPosts];
    const updatedFeed = [winPost, ...state.communityFeed];

    set({
      careerOutcomes: [outcome, ...state.careerOutcomes],
      user: { ...state.user, xp: newXP, level: newLevel },
      userFeedPosts: updatedUserFeedPosts,
      communityFeed: updatedFeed,
    });
    track('career_outcome_logged', { type: payload.type, xp_awarded: xpAwarded });
    return xpAwarded;
  },

  deleteCareerOutcome: (outcomeId: string) => {
    const state = get();
    if (!state.user) return;
    const outcome = state.careerOutcomes.find((o) => o.id === outcomeId);
    if (!outcome) return;
    const newXP = Math.max(0, state.user.xp - outcome.xpAwarded);
    const newLevel = getLevelFromXP(newXP);
    set({
      careerOutcomes: state.careerOutcomes.filter((o) => o.id !== outcomeId),
      user: { ...state.user, xp: newXP, level: newLevel },
    });
    track('career_outcome_deleted', { type: outcome.type });
  },

  deleteOutput: (outputId: string) => {
    const state = get();
    if (!state.user) return;

    const output = state.outputs.find((o) => o.id === outputId);
    if (!output) return;

    const newOutputs = state.outputs.filter((o) => o.id !== outputId);

    // Recompute skill output count from remaining outputs (source of truth)
    const remainingForSkill = newOutputs.filter((o) => o.skillId === output.skillId).length;
    const skill = ALL_SKILLS.find((s) => s.id === output.skillId);
    const requiredOutputs = skill?.requiredOutputs ?? 1;

    const newUserSkills = { ...state.userSkills };
    const existingUs = state.userSkills[output.skillId];
    if (existingUs) {
      let newStatus: SkillStatus = existingUs.status;
      // Revert completed → in_progress / available if we no longer meet the bar
      if (existingUs.status === 'completed' && remainingForSkill < requiredOutputs) {
        newStatus = remainingForSkill > 0 ? 'in_progress' : 'available';
      } else if (existingUs.status === 'in_progress' && remainingForSkill === 0) {
        newStatus = 'available';
      }
      newUserSkills[output.skillId] = {
        ...existingUs,
        outputCount: remainingForSkill,
        status: newStatus,
        completedAt: newStatus === 'completed' ? existingUs.completedAt : undefined,
      };
    }

    // Deduct exactly the XP that was awarded when this output was logged.
    // Guard against NaN/undefined in stored xpGained (shouldn't happen, but legacy data may differ).
    const safeOutputXP = Number.isFinite(output.xpGained) ? output.xpGained : 0;
    const xpAfterOutput = Math.max(0, state.user.xp - safeOutputXP);

    // Re-evaluate output-count and skill-count achievements — revoke ones that
    // the user no longer qualifies for after this deletion (e.g. deleting the
    // only output means 'first-steps' is no longer earned).
    const newCompletedSkillCount = Object.values(newUserSkills).filter(
      (us) => us.status === 'completed'
    ).length;
    const achievementsToRevoke = state.unlockedAchievementIds.filter((id) => {
      if (id === 'first-steps')    return newOutputs.length < 1;
      if (id === 'builder')        return newOutputs.length < 5;
      if (id === 'skill-mastered') return newCompletedSkillCount < 1;
      if (id === 'triple-master')  return newCompletedSkillCount < 3;
      // Streak and XP-threshold achievements are not revoked by output deletion
      return false;
    });
    const revokedAchievementXP = achievementsToRevoke.reduce((sum, id) => {
      const ach = ALL_ACHIEVEMENTS.find((a) => a.id === id);
      return sum + (ach?.xpGranted ?? 0);
    }, 0);

    const finalXP = Math.max(0, xpAfterOutput - revokedAchievementXP);
    const newLevel = getLevelFromXP(finalXP);
    const newUser = { ...state.user, xp: finalXP, level: newLevel };
    const updatedAchievementIds = state.unlockedAchievementIds.filter(
      (id) => !achievementsToRevoke.includes(id)
    );

    // Remove the feed post generated by this output (match on skillId + title + isCurrentUser).
    // This ensures the community feed stays in sync when outputs are deleted.
    const updatedUserFeedPosts = state.userFeedPosts.filter(
      (p) => !(p.isCurrentUser && p.skillId === output.skillId && p.outputTitle === output.title)
    );
    const updatedCommunityFeed = [
      ...updatedUserFeedPosts,
      ...state.communityFeed.filter((p) => !p.isCurrentUser),
    ];

    const totalXPDeducted = safeOutputXP + revokedAchievementXP;
    set({ outputs: newOutputs, userSkills: newUserSkills, user: newUser, unlockedAchievementIds: updatedAchievementIds, userFeedPosts: updatedUserFeedPosts, communityFeed: updatedCommunityFeed });
    track('output_deleted', { output_type: output.type, xp_deducted: totalXPDeducted, achievements_revoked: achievementsToRevoke.length });
  },

  useStreakFreeze: () => {
    const state = get();
    if (!state.user || (state.user.streakFreezes ?? 0) <= 0) return;
    const todayStr = new Date().toISOString().slice(0, 10);
    const updatedUser = {
      ...state.user,
      streakFreezes: (state.user.streakFreezes ?? 1) - 1,
      lastActiveDate: todayStr, // mark today as active so streak won't break tonight
    };
    set({ user: updatedUser });
  },

  markMilestoneCelebrated: (key: string) => {
    const state = get();
    if (state.celebratedMilestones.includes(key)) return; // idempotent
    const updated = [...state.celebratedMilestones, key];
    set({ celebratedMilestones: updated });
  },

  clearCelebration: () => set({ pendingCelebration: null }),

  setSelectedSkill: (skillId: string | null) => set({ selectedSkillId: skillId }),

  dismissWelcomeCard: () => {
    set({ showWelcomeCard: false });
    // Not persisted — ephemeral for the current session only
  },

  resetApp: () => {
    try { localStorage.removeItem('skillforge_v1'); } catch {}
    // PRIV-003: Reset wipes THIS DEVICE and signs out of Cloud Backup. It does
    // NOT delete cloud rows (no server-side delete path yet — COMP-001); the
    // Settings copy and privacy policy state this honestly. Signing out here
    // prevents the auth listener from silently re-syncing cloud data back
    // into the freshly reset app.
    signOut().catch(() => {});
    set({
      hasOnboarded: false,
      user: null,
      userSkills: {},
      outputs: [],
      unlockedAchievementIds: [],
      communityFeed: MOCK_FEED,
      userFeedPosts: [],
      pendingCelebration: null,
      customPaths: [],
      prioritizedPathId: null,
      roadmaps: [],
      celebratedMilestones: [],
      supabaseUserId: null,
      supabaseEmail: null,
      supabaseSyncing: false,
    });
  },

  togglePinOutput: (outputId: string) => {
    const state = get();
    if (!state.user) return;
    const current = state.user.pinnedOutputIds ?? [];
    const isPinned = current.includes(outputId);
    const MAX_PINS = 3;
    let updated: string[];
    if (isPinned) {
      updated = current.filter((id) => id !== outputId);
    } else {
      if (current.length >= MAX_PINS) return; // already at max, do nothing
      updated = [...current, outputId];
    }
    set({ user: { ...state.user, pinnedOutputIds: updated } });
    track('portfolio_pin_toggled', { pinned: !isPinned, output_id: outputId });
  },

});
