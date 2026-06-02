import { describe, it, expect } from 'vitest';
import { reconcileAchievementsAndXP } from '../hydration';

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
