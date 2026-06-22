import { describe, it, expect } from 'vitest';
import { reconcileAchievementsAndXP, healPhantomSkillProgress } from '../hydration';
import type { UserSkill } from '../../types';

// Grants (from src/data/achievements.ts): first-steps 25, builder 75,
// skill-mastered 100, consistent 150, on-fire 300, evolution 100,
// triple-master 500, thirty-day-legend 500.

const base = {
  savedUnlocked: [] as string[],
  outputCount: 3,
  completedSkillCount: 2,
  xp: 595,
  streak: 7,
  longestStreak: 8,
  hasOutputs: true,
};

describe('reconcileAchievementsAndXP', () => {
  it('is a no-op when saved achievements are already consistent', () => {
    // 595 = outputs(320) + first-steps(25) + skill-mastered(100) + consistent(150) = 595.
    // Nothing missed (xp 595 ≥ 500 → evolution IS earned, so include it to be consistent).
    const r = reconcileAchievementsAndXP({
      ...base,
      savedUnlocked: ['first-steps', 'skill-mastered', 'consistent', 'evolution'],
      xp: 695, // 320 + 25 + 100 + 150 + 100(evolution)
    });
    expect(r.achievements.sort()).toEqual(['consistent', 'evolution', 'first-steps', 'skill-mastered']);
    expect(r.healedXP).toBe(695);
  });

  it('credits XP for a missed achievement (UX-025)', () => {
    // saved has 3 achievements (275 XP) + outputs (320) = 595, but evolution (xp≥500)
    // was never recorded. It should be ADDED and its 100 XP CREDITED → 695.
    const r = reconcileAchievementsAndXP({
      ...base,
      savedUnlocked: ['first-steps', 'skill-mastered', 'consistent'],
      xp: 595,
    });
    expect(r.achievements).toContain('evolution');
    expect(r.healedXP).toBe(695); // 595 + 100 (evolution credited)
  });

  it('revokes an invalid achievement and deducts its XP', () => {
    // 'builder' needs ≥5 outputs; with 3 outputs it's invalid → removed, 75 XP deducted.
    const r = reconcileAchievementsAndXP({
      ...base,
      savedUnlocked: ['first-steps', 'builder', 'skill-mastered', 'consistent', 'evolution'],
      outputCount: 3,
      xp: 770, // includes builder's 75
    });
    expect(r.achievements).not.toContain('builder');
    expect(r.healedXP).toBe(695); // 770 - 75
  });

  it('caps XP to held-achievement XP for accounts with no outputs and no streak', () => {
    // No outputs, no streak, phantom xp 200 (below the 500 evolution threshold).
    // first-steps is invalid (0 outputs) and removed → no achievements hold any XP → cap to 0.
    const r = reconcileAchievementsAndXP({
      savedUnlocked: ['first-steps'],
      outputCount: 0, completedSkillCount: 0, xp: 200, streak: 0, longestStreak: 0, hasOutputs: false,
    });
    expect(r.achievements).not.toContain('first-steps'); // invalid: 0 outputs
    expect(r.healedXP).toBe(0); // capped to validAchievementXP (0)
  });

  it('does not cap XP for active users (has outputs or streak)', () => {
    const r = reconcileAchievementsAndXP({
      ...base, savedUnlocked: ['first-steps', 'skill-mastered', 'consistent', 'evolution'], xp: 695,
    });
    expect(r.healedXP).toBe(695); // not capped — has outputs + streak
  });
});

describe('healPhantomSkillProgress', () => {
  const skills = (over: Record<string, UserSkill>): Record<string, UserSkill> => over;

  it('strips phantom completed/in-progress skills when there are no outputs', () => {
    const input = skills({
      a: { skillId: 'a', status: 'completed', outputCount: 2, completedAt: '2026-01-01' },
      b: { skillId: 'b', status: 'in_progress', outputCount: 1 },
      c: { skillId: 'c', status: 'available', outputCount: 0 },
      d: { skillId: 'd', status: 'locked', outputCount: 0 },
    });
    const out = healPhantomSkillProgress(input, 0);
    expect(out.a).toEqual({ skillId: 'a', status: 'available', outputCount: 0 }); // demoted, completedAt dropped
    expect(out.b).toEqual({ skillId: 'b', status: 'available', outputCount: 0 }); // demoted
    expect(out.c).toEqual({ skillId: 'c', status: 'available', outputCount: 0 }); // untouched
    expect(out.d).toEqual({ skillId: 'd', status: 'locked', outputCount: 0 });    // untouched
  });

  it('is a strict no-op when the account has any output', () => {
    const input = skills({
      a: { skillId: 'a', status: 'completed', outputCount: 2, completedAt: '2026-01-01' },
    });
    const out = healPhantomSkillProgress(input, 1);
    expect(out).toBe(input); // same reference — untouched
  });

  it('returns the same reference when there is nothing to heal', () => {
    const input = skills({
      a: { skillId: 'a', status: 'available', outputCount: 0 },
      b: { skillId: 'b', status: 'locked', outputCount: 0 },
    });
    const out = healPhantomSkillProgress(input, 0);
    expect(out).toBe(input); // no phantom progress → no new object
  });

  it('GROW-002: preserves assessment-validated (tested-out) skills with zero outputs', () => {
    const input = skills({
      tested: { skillId: 'tested', status: 'completed', outputCount: 0, validated: true, validationSource: 'assessment', completedAt: '2026-06-22' },
      phantom: { skillId: 'phantom', status: 'completed', outputCount: 0 }, // no provenance → phantom
    });
    const out = healPhantomSkillProgress(input, 0);
    expect(out.tested).toEqual(input.tested);                                       // kept intact
    expect(out.phantom).toEqual({ skillId: 'phantom', status: 'available', outputCount: 0 }); // demoted
  });
});
