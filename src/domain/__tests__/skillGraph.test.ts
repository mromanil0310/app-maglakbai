import { describe, it, expect } from 'vitest';
import { checkAchievements } from '../skillGraph';

// checkAchievements(outputCount, completedSkillCount, xp, streak, alreadyUnlocked)
// returns the NEW achievement ids earned by the given state (excluding ones
// already in `alreadyUnlocked`).
describe('checkAchievements', () => {
  it('returns nothing for a fresh/empty state', () => {
    expect(checkAchievements(0, 0, 0, 0, [])).toEqual([]);
  });

  it('unlocks output-count milestones at their thresholds', () => {
    expect(checkAchievements(1, 0, 0, 0, [])).toContain('first-steps');
    expect(checkAchievements(4, 0, 0, 0, [])).not.toContain('builder');
    expect(checkAchievements(5, 0, 0, 0, [])).toContain('builder');
  });

  it('unlocks skill-completion milestones', () => {
    expect(checkAchievements(0, 1, 0, 0, [])).toContain('skill-mastered');
    expect(checkAchievements(0, 3, 0, 0, [])).toContain('triple-master');
    expect(checkAchievements(0, 2, 0, 0, [])).not.toContain('triple-master');
  });

  it('unlocks streak milestones at 7 / 14 / 30', () => {
    expect(checkAchievements(0, 0, 0, 7, [])).toContain('consistent');
    expect(checkAchievements(0, 0, 0, 14, [])).toContain('on-fire');
    expect(checkAchievements(0, 0, 0, 30, [])).toContain('thirty-day-legend');
    expect(checkAchievements(0, 0, 0, 6, [])).toEqual([]);
  });

  it('unlocks the XP-threshold milestone at 500', () => {
    expect(checkAchievements(0, 0, 499, 0, [])).not.toContain('evolution');
    expect(checkAchievements(0, 0, 500, 0, [])).toContain('evolution');
  });

  it('never re-emits an already-unlocked achievement', () => {
    const already = ['first-steps', 'builder'];
    const out = checkAchievements(5, 0, 0, 0, already);
    expect(out).not.toContain('first-steps');
    expect(out).not.toContain('builder');
  });

  it('emits multiple new unlocks at once', () => {
    const out = checkAchievements(5, 3, 500, 30, []);
    expect(out).toEqual(
      expect.arrayContaining([
        'first-steps', 'builder', 'skill-mastered', 'triple-master',
        'consistent', 'on-fire', 'thirty-day-legend', 'evolution',
      ]),
    );
  });
});
