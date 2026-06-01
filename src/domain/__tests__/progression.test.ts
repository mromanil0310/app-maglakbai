import { describe, it, expect } from 'vitest';
import {
  getDecayStage,
  getBurnoutSignal,
  getEvidenceTier,
  getSkillMasteryLevel,
  getCareerMastery,
  OUTCOME_XP,
} from '../progression';
import type { Output, UserSkill } from '../../types';

// ─── Test helpers ───────────────────────────────────────────────────────────
const skill = (over: Partial<UserSkill>): UserSkill =>
  ({ skillId: 's', status: 'in_progress', outputCount: 1, ...over } as UserSkill);

const daysAgoISO = (days: number): string =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const output = (daysAgo: number): Output =>
  ({ id: `o${daysAgo}`, createdAt: daysAgoISO(daysAgo) } as Output);

// ─── getDecayStage ────────────────────────────────────────────────────────────
describe('getDecayStage', () => {
  it('returns active when not started, regardless of days', () => {
    expect(getDecayStage(99, false)).toBe('active');
  });
  it('maps day ranges to the five stages (boundaries)', () => {
    expect(getDecayStage(0, true)).toBe('active');
    expect(getDecayStage(1, true)).toBe('active');
    expect(getDecayStage(2, true)).toBe('coasting');
    expect(getDecayStage(3, true)).toBe('coasting');
    expect(getDecayStage(4, true)).toBe('drifting');
    expect(getDecayStage(6, true)).toBe('drifting');
    expect(getDecayStage(7, true)).toBe('fading');
    expect(getDecayStage(13, true)).toBe('fading');
    expect(getDecayStage(14, true)).toBe('recovery');
    expect(getDecayStage(100, true)).toBe('recovery');
  });
});

// ─── getEvidenceTier ──────────────────────────────────────────────────────────
describe('getEvidenceTier', () => {
  it('verified when a non-empty link is present', () => {
    expect(getEvidenceTier('https://github.com/x', '')).toBe('verified');
  });
  it('ignores whitespace-only links', () => {
    expect(getEvidenceTier('   ', 'short')).toBe('logged');
  });
  it('documented when description >= 50 chars (boundary at exactly 50)', () => {
    expect(getEvidenceTier(undefined, 'a'.repeat(49))).toBe('logged');
    expect(getEvidenceTier(undefined, 'a'.repeat(50))).toBe('documented');
  });
  it('trims description before measuring', () => {
    expect(getEvidenceTier(undefined, '   ' + 'a'.repeat(40) + '   ')).toBe('logged');
  });
});

// ─── getSkillMasteryLevel ─────────────────────────────────────────────────────
describe('getSkillMasteryLevel', () => {
  it('0 when undefined or no outputs', () => {
    expect(getSkillMasteryLevel(undefined)).toBe(0);
    expect(getSkillMasteryLevel(skill({ outputCount: 0 }))).toBe(0);
  });
  it('1 when in progress with outputs', () => {
    expect(getSkillMasteryLevel(skill({ status: 'in_progress', outputCount: 2 }))).toBe(1);
  });
  it('2 when completed but not validated', () => {
    expect(getSkillMasteryLevel(skill({ status: 'completed', outputCount: 3, validated: false }))).toBe(2);
  });
  it('3 when completed and validated', () => {
    expect(getSkillMasteryLevel(skill({ status: 'completed', outputCount: 3, validated: true }))).toBe(3);
  });
});

// ─── getCareerMastery ─────────────────────────────────────────────────────────
describe('getCareerMastery', () => {
  const ids = (n: number) => Array.from({ length: n }, (_, i) => `s${i}`);
  const build = (states: Partial<UserSkill>[]): Record<string, UserSkill> =>
    Object.fromEntries(states.map((s, i) => [`s${i}`, skill(s)]));

  it('Beginner for an empty path', () => {
    expect(getCareerMastery({}, []).title).toBe('Beginner');
  });
  it('Beginner when nothing started', () => {
    const us = build(Array(10).fill({ outputCount: 0 }));
    expect(getCareerMastery(us, ids(10)).title).toBe('Beginner');
  });
  it('Developing when practicing but 0% competent', () => {
    const us = build(Array(10).fill({ status: 'in_progress', outputCount: 1 }));
    expect(getCareerMastery(us, ids(10)).title).toBe('Developing');
  });
  it('Competent at 40% competent', () => {
    const states = [
      ...Array(4).fill({ status: 'completed', outputCount: 1 }),
      ...Array(6).fill({ status: 'in_progress', outputCount: 1 }),
    ];
    expect(getCareerMastery(build(states), ids(10)).title).toBe('Competent');
  });
  it('Advanced at >=70% competent but <60% validated', () => {
    const states = Array(8).fill({ status: 'completed', outputCount: 1 })
      .concat(Array(2).fill({ status: 'in_progress', outputCount: 1 }));
    const r = getCareerMastery(build(states), ids(10));
    expect(r.title).toBe('Advanced');
    expect(r.competentCount).toBe(8);
    expect(r.validatedCount).toBe(0);
  });
  it('Expert at >=70% competent and >=60% validated', () => {
    const states = Array(7).fill({ status: 'completed', outputCount: 1, validated: true })
      .concat(Array(3).fill({ status: 'completed', outputCount: 1 }));
    const r = getCareerMastery(build(states), ids(10));
    expect(r.title).toBe('Expert');
    expect(r.competentCount).toBe(10);
    expect(r.validatedCount).toBe(7);
  });
});

// ─── getBurnoutSignal ─────────────────────────────────────────────────────────
describe('getBurnoutSignal', () => {
  it('null when paceMode is recovery', () => {
    const outs = [output(5), output(6), output(7), output(8)];
    expect(getBurnoutSignal(outs, 3, 'recovery')).toBeNull();
  });
  it('null when gap < 2 days', () => {
    const outs = [output(0), output(0), output(0), output(0)];
    expect(getBurnoutSignal(outs, 1, undefined)).toBeNull();
  });
  it('null with fewer than 4 outputs', () => {
    expect(getBurnoutSignal([output(5), output(6)], 3, undefined)).toBeNull();
  });
  it('signals sprint-then-drop: >=4 outputs in the 14d window before the gap', () => {
    const outs = [output(5), output(6), output(7), output(8)]; // all within 14d window before a 3-day gap
    expect(getBurnoutSignal(outs, 3, undefined)).toBe('sprint_followed_by_drop');
  });
  it('null when the 4 outputs predate the sprint window', () => {
    const outs = [output(40), output(41), output(42), output(43)]; // older than gapStart-14d
    expect(getBurnoutSignal(outs, 3, undefined)).toBeNull();
  });
});

// ─── OUTCOME_XP ───────────────────────────────────────────────────────────────
describe('OUTCOME_XP', () => {
  it('awards the documented values', () => {
    expect(OUTCOME_XP.offer).toBe(500);
    expect(OUTCOME_XP.role_change).toBe(500);
    expect(OUTCOME_XP.promotion).toBe(400);
    expect(OUTCOME_XP.certification).toBe(300);
    expect(OUTCOME_XP.salary_increase).toBe(300);
    expect(OUTCOME_XP.freelance).toBe(250);
    expect(OUTCOME_XP.portfolio).toBe(200);
    expect(OUTCOME_XP.interview).toBe(150);
  });
});
