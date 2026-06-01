import { describe, it, expect } from 'vitest';
import { useAppStore } from '../appStore';
import type { ExperienceLevel } from '../../types';

// Integration tests over the core store actions. These exercise the real Zustand
// store (no mocks) — the behavioral safety net required before slicing actions
// into separate modules (ARCH-002). localStorage is absent under Node, so the
// store boots clean and persistence is a guarded no-op.

const store = useAppStore;
const get = () => store.getState();
const reset = () => get().resetApp();
const onboard = (exp: ExperienceLevel = 'beginner') =>
  get().completeOnboarding('Tester', 'data-architect', undefined, exp);

const log = (over: Partial<{ type: string; title: string; description: string; link: string; keyTakeaway: string }> = {}) =>
  get().logOutput({
    skillId: 'sql-foundations',
    type: (over.type ?? 'project') as never,
    title: over.title ?? 'Output',
    description: over.description ?? 'short',
    link: over.link,
    keyTakeaway: over.keyTakeaway,
  });

// ─── completeOnboarding ─────────────────────────────────────────────────────────
describe('completeOnboarding', () => {
  it('creates the user and initializes the path skill graph', () => {
    reset();
    onboard('beginner');
    const s = get();
    expect(s.hasOnboarded).toBe(true);
    expect(s.user!.xp).toBe(0);
    expect(s.user!.level).toBe(1);
    expect(s.userSkills['sql-foundations'].status).toBe('available'); // no prereqs
    expect(s.userSkills['python-automation'].status).toBe('locked');  // gated on sql-foundations
    expect(s.roadmaps[0].pathId).toBe('data-architect');
    expect(s.roadmaps[0].priorityStatus).toBe('PRIORITY');
  });

  it("pre-completes the first two skills for an 'experienced' user", () => {
    reset();
    onboard('experienced');
    const s = get();
    expect(s.userSkills['sql-foundations'].status).toBe('completed');
    expect(s.userSkills['python-automation'].status).toBe('completed');
    expect(s.userSkills['snowflake-engineering'].status).toBe('available'); // unlocked dependent
  });
});

// ─── logOutput ──────────────────────────────────────────────────────────────────
describe('logOutput', () => {
  it('returns a zero result and records nothing when there is no user', () => {
    reset();
    const r = log();
    expect(r.xpGained).toBe(0);
    expect(r.skillCompleted).toBe(false);
    expect(get().outputs).toHaveLength(0);
  });

  it('awards XP by output type plus quality and takeaway bonuses', () => {
    reset();
    onboard();
    // cert(200) + description >=120 chars (+20) + key takeaway (+15) = 235; req 2 → not complete yet
    const r = log({ type: 'cert', description: 'a'.repeat(130), keyTakeaway: 'the big lesson' });
    expect(r.xpGained).toBe(235);
    expect(r.skillCompleted).toBe(false);
    const s = get();
    expect(s.outputs).toHaveLength(1);
    expect(s.outputs[0].xpGained).toBe(235);
    expect(s.userSkills['sql-foundations'].status).toBe('in_progress');
    expect(s.userSkills['sql-foundations'].outputCount).toBe(1);
  });

  it('blocks skill completion until there is quality evidence (evidence gate)', () => {
    reset();
    onboard();
    log({ title: 'o1', description: 'short' });        // logged tier
    const r = log({ title: 'o2', description: 'short' }); // 2nd output reaches requiredOutputs but no evidence
    expect(r.evidenceRequired).toBe(true);
    expect(r.skillCompleted).toBe(false);
    expect(get().userSkills['sql-foundations'].status).toBe('in_progress');
    expect(get().userSkills['sql-foundations'].outputCount).toBe(2);
  });

  it('completes the skill with quality evidence and unlocks the dependent', () => {
    reset();
    onboard();
    log({ title: 'o1', description: 'a'.repeat(60) });                         // documented (>=50)
    const r = log({ title: 'o2', description: 'short', link: 'https://github.com/x/y' }); // verified
    expect(r.skillCompleted).toBe(true);
    expect(r.newSkillId).toBe('sql-foundations');
    expect(r.xpGained).toBe(175); // project(75) + skill reward(100)
    const s = get();
    expect(s.userSkills['sql-foundations'].status).toBe('completed');
    expect(s.userSkills['python-automation'].status).toBe('available'); // dependent unlocked
  });

  it('unlocks the first-steps achievement on the first output', () => {
    reset();
    onboard();
    log();
    expect(get().unlockedAchievementIds).toContain('first-steps');
  });

  it('increments the streak on a consecutive day', () => {
    reset();
    onboard();
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    store.setState({ user: { ...get().user!, lastActiveDate: yesterday, streak: 3, longestStreak: 3 } });
    const r = log();
    expect(r.newStreak).toBe(4);
    expect(get().user!.streak).toBe(4);
  });

  it('does not increment the streak twice within the same day', () => {
    reset();
    onboard(); // onboarding sets lastActiveDate = today, streak = 0
    log();
    const r = log();
    expect(r.newStreak).toBe(0);
  });
});

// ─── validateSkill ──────────────────────────────────────────────────────────────
describe('validateSkill', () => {
  it('is a no-op unless the skill is completed', () => {
    reset();
    onboard();
    get().validateSkill('sql-foundations'); // still only 'available'
    expect(get().userSkills['sql-foundations'].validated).toBeFalsy();
    expect(get().user!.xp).toBe(0);
  });

  it('validates a completed skill and grants the 50 XP bonus', () => {
    reset();
    onboard();
    log({ title: 'o1', description: 'a'.repeat(60) });
    log({ title: 'o2', description: 'short', link: 'https://x.com' }); // completes the skill
    const before = get().user!.xp;
    get().validateSkill('sql-foundations');
    const s = get();
    expect(s.userSkills['sql-foundations'].validated).toBe(true);
    expect(s.user!.xp).toBe(before + 50);
  });
});
