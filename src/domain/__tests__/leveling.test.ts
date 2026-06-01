import { describe, it, expect } from 'vitest';
import { getLevelFromXP, getLevelTitle, getLevelBounds } from '../../utils/theme';

// Level thresholds are cumulative sums of level*200:
// L1: 0, L2: 200, L3: 600, L4: 1200, L5: 2000, ...
describe('getLevelFromXP', () => {
  it('starts at level 1', () => {
    expect(getLevelFromXP(0)).toBe(1);
    expect(getLevelFromXP(199)).toBe(1);
  });
  it('crosses to the next level exactly at the threshold', () => {
    expect(getLevelFromXP(200)).toBe(2);
    expect(getLevelFromXP(599)).toBe(2);
    expect(getLevelFromXP(600)).toBe(3);
    expect(getLevelFromXP(1199)).toBe(3);
    expect(getLevelFromXP(1200)).toBe(4);
    expect(getLevelFromXP(2000)).toBe(5);
  });
});

describe('getLevelTitle', () => {
  it('maps known levels', () => {
    expect(getLevelTitle(1)).toBe('Learner');
    expect(getLevelTitle(2)).toBe('Builder');
    expect(getLevelTitle(10)).toBe('Principal Architect');
  });
  it('clamps beyond level 10', () => {
    expect(getLevelTitle(11)).toBe('Principal Architect');
    expect(getLevelTitle(99)).toBe('Principal Architect');
  });
});

describe('getLevelBounds', () => {
  it('returns cumulative min and the next-level span', () => {
    expect(getLevelBounds(1)).toEqual({ min: 0, max: 200 });
    expect(getLevelBounds(2)).toEqual({ min: 200, max: 600 });
    expect(getLevelBounds(3)).toEqual({ min: 600, max: 1200 });
  });
  it('is consistent with getLevelFromXP at boundaries', () => {
    for (let lvl = 1; lvl <= 6; lvl++) {
      const { min, max } = getLevelBounds(lvl);
      expect(getLevelFromXP(min)).toBe(lvl);
      expect(getLevelFromXP(max - 1)).toBe(lvl);
      expect(getLevelFromXP(max)).toBe(lvl + 1);
    }
  });
});
