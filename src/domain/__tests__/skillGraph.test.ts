import { describe, it, expect } from 'vitest';
import { checkAchievements, pathHasProgress, isTestOutEligible } from '../skillGraph';
import type { UserSkill } from '../../types';

// GROW-002 test-out eligibility. data-architect foundational window:
// sql-foundations → python-automation → snowflake-engineering (all have question banks).
const DA = ['sql-foundations', 'python-automation', 'snowflake-engineering', 'data-modeling', 'ai-workflow-design'];
const avail = (extra: Partial<UserSkill> = {}): UserSkill => ({ skillId: 'sql-foundations', status: 'available', outputCount: 0, ...extra });

describe('isTestOutEligible', () => {
  it('is true for an available foundational skill at building/experienced', () => {
    const us = { 'sql-foundations': avail() };
    expect(isTestOutEligible('sql-foundations', us, DA, 'building')).toBe(true);
    expect(isTestOutEligible('sql-foundations', us, DA, 'experienced')).toBe(true);
  });

  it('is false for beginner (build-only)', () => {
    expect(isTestOutEligible('sql-foundations', { 'sql-foundations': avail() }, DA, 'beginner')).toBe(false);
    expect(isTestOutEligible('sql-foundations', { 'sql-foundations': avail() }, DA, undefined)).toBe(false);
  });

  it('is false beyond the foundational window (4th skill+)', () => {
    const us = { 'data-modeling': avail({ skillId: 'data-modeling' }) };
    expect(isTestOutEligible('data-modeling', us, DA, 'experienced')).toBe(false);
  });

  it('requires the skill to be available (not locked/in-progress/completed)', () => {
    for (const status of ['locked', 'in_progress', 'completed'] as const) {
      const us = { 'sql-foundations': avail({ status }) };
      expect(isTestOutEligible('sql-foundations', us, DA, 'building')).toBe(false);
    }
  });

  it('is false once attempts are exhausted', () => {
    const us = { 'sql-foundations': avail({ testOutAttempts: 3 }) };
    expect(isTestOutEligible('sql-foundations', us, DA, 'building')).toBe(false);
    const us2 = { 'sql-foundations': avail({ testOutAttempts: 2 }) };
    expect(isTestOutEligible('sql-foundations', us2, DA, 'building')).toBe(true);
  });

  it('is false for a skill with no question bank', () => {
    const us = { 'no-such-skill': avail({ skillId: 'no-such-skill' }) };
    expect(isTestOutEligible('no-such-skill', us, ['no-such-skill'], 'building')).toBe(false);
  });
});

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

// pathHasProgress(skillIds, userSkills) — FEAT-001: is a roadmap "started"?
describe('pathHasProgress', () => {
  const us = (over: Partial<UserSkill>): UserSkill => ({ skillId: 's', status: 'available', outputCount: 0, ...over });

  it('is false when no skill in the path has any progress', () => {
    const skills = { a: us({ skillId: 'a' }), b: us({ skillId: 'b', status: 'locked' }) };
    expect(pathHasProgress(['a', 'b'], skills)).toBe(false);
  });

  it('is false for skills outside the given id list', () => {
    const skills = { other: us({ skillId: 'other', outputCount: 3 }) };
    expect(pathHasProgress(['a', 'b'], skills)).toBe(false);
  });

  it('is true when a path skill has a logged output', () => {
    const skills = { a: us({ skillId: 'a', outputCount: 1 }) };
    expect(pathHasProgress(['a', 'b'], skills)).toBe(true);
  });

  it('is true when a path skill is in_progress or completed (pre-credited)', () => {
    expect(pathHasProgress(['a'], { a: us({ skillId: 'a', status: 'in_progress' }) })).toBe(true);
    expect(pathHasProgress(['a'], { a: us({ skillId: 'a', status: 'completed' }) })).toBe(true);
  });
});
