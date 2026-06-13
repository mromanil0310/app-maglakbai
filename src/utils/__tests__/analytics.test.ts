import { describe, it, expect } from 'vitest';
import { pendingRetentionMilestones, RETENTION_MILESTONES } from '../analytics';

// Pure retention-milestone logic (the decision behind trackRetention).
// Semantics: retention_dN should fire once, the first time the user is active
// on or after N calendar days since joining. Driven by app opens, not logging.
describe('pendingRetentionMilestones', () => {
  it('exposes the expected milestone days', () => {
    expect([...RETENTION_MILESTONES]).toEqual([1, 7, 30]);
  });

  it('fires nothing before the user reaches day 1', () => {
    expect(pendingRetentionMilestones(0, [])).toEqual([]);
  });

  it('fires d1 on the first return at day 1', () => {
    expect(pendingRetentionMilestones(1, [])).toEqual([1]);
  });

  it('does not re-fire an already-fired milestone (dedup)', () => {
    expect(pendingRetentionMilestones(1, [1])).toEqual([]);
    expect(pendingRetentionMilestones(7, [1, 7])).toEqual([]);
    expect(pendingRetentionMilestones(100, [1, 7, 30])).toEqual([]);
  });

  it('fires only the newly-reached milestone when earlier ones already fired', () => {
    expect(pendingRetentionMilestones(7, [1])).toEqual([7]);
    expect(pendingRetentionMilestones(30, [1, 7])).toEqual([30]);
  });

  it('back-fills passed milestones when the first return is late (>= semantics)', () => {
    // First time we ever see the user is day 10 → they are demonstrably
    // retained past the d1 and d7 marks; both should fire, d30 should not.
    expect(pendingRetentionMilestones(10, [])).toEqual([1, 7]);
    // First return at day 40 → all three.
    expect(pendingRetentionMilestones(40, [])).toEqual([1, 7, 30]);
  });

  it('fires d7 on or after day 7 (not only on the exact day) — the core fix', () => {
    // The old logOutput-based check used `=== 7` and missed day-8 returns.
    expect(pendingRetentionMilestones(8, [1])).toEqual([7]);
    expect(pendingRetentionMilestones(9, [1])).toEqual([7]);
  });
});
