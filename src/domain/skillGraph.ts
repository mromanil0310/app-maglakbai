// ─── Skill-graph & achievement helpers ─────────────────────────────────────────
// Pure functions extracted from appStore.ts (ARCH-002). They operate on the static
// catalog (CAREER_PATHS / ALL_SKILLS) + plain state, with no store/React deps, so
// they can be unit-tested in isolation.

import type { UserSkill, CareerPathId } from '../types';
import { CAREER_PATHS } from '../data/careerPaths';
import { ALL_SKILLS } from '../data/skills';

export function initUserSkills(pathId: CareerPathId): Record<string, UserSkill> {
  const path = CAREER_PATHS.find((p) => p.id === pathId)!;
  const result: Record<string, UserSkill> = {};
  path.skillIds.forEach((skillId) => {
    const skill = ALL_SKILLS.find((s) => s.id === skillId)!;
    result[skillId] = {
      skillId,
      status: skill.prerequisites.length === 0 ? 'available' : 'locked',
      outputCount: 0,
    };
  });
  return result;
}

export function unlockDependentSkills(
  completedSkillId: string,
  pathId: CareerPathId,
  userSkills: Record<string, UserSkill>
): Record<string, UserSkill> {
  const path = CAREER_PATHS.find((p) => p.id === pathId)!;
  const updated = { ...userSkills };

  path.skillIds.forEach((skillId) => {
    const skill = ALL_SKILLS.find((s) => s.id === skillId)!;
    if (updated[skillId]?.status !== 'locked') return;

    const allPrereqsMet = skill.prerequisites.every(
      (prereqId) => updated[prereqId]?.status === 'completed'
    );
    if (allPrereqsMet) {
      updated[skillId] = { ...updated[skillId], status: 'available' };
    }
  });

  return updated;
}

export function checkAchievements(
  outputCount: number,
  completedSkillCount: number,
  xp: number,
  streak: number,
  unlockedIds: string[]
): string[] {
  const newUnlocks: string[] = [];

  if (outputCount >= 1 && !unlockedIds.includes('first-steps')) newUnlocks.push('first-steps');
  if (outputCount >= 5 && !unlockedIds.includes('builder')) newUnlocks.push('builder');
  if (completedSkillCount >= 1 && !unlockedIds.includes('skill-mastered')) newUnlocks.push('skill-mastered');
  if (streak >= 7 && !unlockedIds.includes('consistent')) newUnlocks.push('consistent');
  if (streak >= 14 && !unlockedIds.includes('on-fire')) newUnlocks.push('on-fire');
  if (streak >= 30 && !unlockedIds.includes('thirty-day-legend')) newUnlocks.push('thirty-day-legend');
  if (xp >= 500 && !unlockedIds.includes('evolution')) newUnlocks.push('evolution');
  if (completedSkillCount >= 3 && !unlockedIds.includes('triple-master')) newUnlocks.push('triple-master');

  return newUnlocks;
}
