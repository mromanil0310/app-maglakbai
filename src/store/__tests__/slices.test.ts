import { describe, it, expect } from 'vitest';
import { useAppStore } from '../appStore';
import type { FeedPost, User } from '../../types';

// Store-action tests for the feed / profile / roadmap slices (QA-001).
// These exercise the real store; resetApp() isolates each test.

const store = useAppStore;
const get = () => store.getState();
const reset = () => get().resetApp();
const onboard = () => get().completeOnboarding('Tester', 'data-architect');

const fakeUser = (over: Partial<User> = {}): User => ({
  id: 'u', name: 'Tester', handle: 'tester', careerPathId: 'data-architect',
  xp: 0, level: 1, streak: 0, longestStreak: 0, bio: '', avatarEmoji: '⚡',
  avatarColor: '#000', joinedAt: '2026-01-01T00:00:00.000Z', ...over,
});
const fakePost = (over: Partial<FeedPost> = {}): FeedPost => ({
  id: 'fp1', userId: 'u', userName: 'Tester', userHandle: 'tester', avatarEmoji: '⚡',
  avatarColor: '#000', pathId: 'data-architect', pathLabel: 'Data Architect', pathColor: '#000',
  type: 'output', content: 'c', xpGained: 0, reactions: {}, userReactions: [], comments: [],
  timestamp: '2026-01-01T00:00:00.000Z', ...over,
});

// ─── feedSlice ──────────────────────────────────────────────────────────────────
describe('feedSlice', () => {
  it('toggleSavePost adds then removes a post id', () => {
    reset();
    get().toggleSavePost('p1');
    expect(get().savedPostIds).toContain('p1');
    get().toggleSavePost('p1');
    expect(get().savedPostIds).not.toContain('p1');
  });

  it('reactToPost adds a reaction then toggles it off', () => {
    reset();
    store.setState({ communityFeed: [fakePost({ id: 'fp1' })] });
    get().reactToPost('fp1', '🔥');
    let post = get().communityFeed.find((p) => p.id === 'fp1')!;
    expect(post.userReactions).toContain('🔥');
    expect(post.reactions['🔥']).toBe(1);
    get().reactToPost('fp1', '🔥');
    post = get().communityFeed.find((p) => p.id === 'fp1')!;
    expect(post.userReactions).not.toContain('🔥');
    expect(post.reactions['🔥']).toBeUndefined();
  });

  it('addComment appends a comment (and no-ops on empty text / no user)', () => {
    reset();
    store.setState({ user: fakeUser(), communityFeed: [fakePost({ id: 'fp1' })] });
    get().addComment('fp1', '   '); // empty after trim → no-op
    expect(get().communityFeed.find((p) => p.id === 'fp1')!.comments).toHaveLength(0);
    get().addComment('fp1', 'great work');
    const post = get().communityFeed.find((p) => p.id === 'fp1')!;
    expect(post.comments).toHaveLength(1);
    expect(post.comments[0].text).toBe('great work');
  });
});

// ─── profileSlice ─────────────────────────────────────────────────────────────────
describe('profileSlice', () => {
  it('updateName sets name and recomputes the handle', () => {
    reset();
    onboard();
    get().updateName('Ada Lovelace');
    expect(get().user!.name).toBe('Ada Lovelace');
    expect(get().user!.handle).toBe('ada.lovelace');
  });

  it('updateEmail trims and clears to undefined when blank', () => {
    reset();
    onboard();
    get().updateEmail('  a@b.com  ');
    expect(get().user!.email).toBe('a@b.com');
    get().updateEmail('   ');
    expect(get().user!.email).toBeUndefined();
  });

  it('updateAvatar sets emoji and clears any uploaded image', () => {
    reset();
    store.setState({ user: fakeUser({ avatarUri: 'data:img' }) });
    get().updateAvatar('🚀');
    expect(get().user!.avatarEmoji).toBe('🚀');
    expect(get().user!.avatarUri).toBeUndefined();
  });

  it('setPaceMode, setComebackGoal, updateBio update the user', () => {
    reset();
    onboard();
    get().setPaceMode('recovery');
    get().setComebackGoal(3);
    get().updateBio('building things');
    expect(get().user!.paceMode).toBe('recovery');
    expect(get().user!.weeklyOutputGoal).toBe(3);
    expect(get().user!.bio).toBe('building things');
  });

  it('setColorScheme updates the scheme (works without a user)', () => {
    reset();
    get().setColorScheme('light');
    expect(get().colorScheme).toBe('light');
  });

  it('profile setters no-op when there is no user', () => {
    reset(); // user is null
    get().updateName('X');
    get().updateBio('Y');
    expect(get().user).toBeNull();
  });
});

// ─── roadmapSlice ─────────────────────────────────────────────────────────────────
describe('roadmapSlice', () => {
  it('addCustomPath returns an id, stores the path, and inits its skills', () => {
    reset();
    onboard();
    const id = get().addCustomPath({
      name: 'My Path', icon: '🎯', description: 'd', color: '#000',
      skills: [{ id: 'cs1', name: 'A', description: '', icon: '🅰️' }, { id: 'cs2', name: 'B', description: '', icon: '🅱️' }],
    });
    expect(id.startsWith('custom_')).toBe(true);
    expect(get().customPaths.some((p) => p.id === id)).toBe(true);
    expect(get().userSkills['cs1'].status).toBe('available'); // first available
    expect(get().userSkills['cs2'].status).toBe('locked');    // rest locked
  });

  it('enrollInRoadmap adds a SECONDARY/ACTIVE entry and is idempotent', () => {
    reset();
    onboard(); // data-architect is PRIORITY
    get().enrollInRoadmap('ai-engineer');
    const entry = get().roadmaps.find((r) => r.pathId === 'ai-engineer')!;
    expect(entry.priorityStatus).toBe('SECONDARY');
    expect(entry.roadmapStatus).toBe('ACTIVE');
    const count = get().roadmaps.length;
    get().enrollInRoadmap('ai-engineer'); // already enrolled → no-op
    expect(get().roadmaps.length).toBe(count);
  });

  it('setPriorityRoadmap promotes the target and demotes the previous priority', () => {
    reset();
    onboard();
    get().enrollInRoadmap('ai-engineer');
    get().setPriorityRoadmap('ai-engineer');
    const ai = get().roadmaps.find((r) => r.pathId === 'ai-engineer')!;
    const da = get().roadmaps.find((r) => r.pathId === 'data-architect')!;
    expect(ai.priorityStatus).toBe('PRIORITY');
    expect(da.priorityStatus).toBe('SECONDARY');
    expect(get().prioritizedPathId).toBe('ai-engineer');
    expect(get().user!.careerPathId).toBe('ai-engineer');
  });

  it('switchPath changes careerPathId and auto-enrolls the path', () => {
    reset();
    onboard();
    get().switchPath('frontend-engineer');
    expect(get().user!.careerPathId).toBe('frontend-engineer');
    expect(get().roadmaps.some((r) => r.pathId === 'frontend-engineer')).toBe(true);
  });

  it('pause / archive / reactivate transition roadmap status', () => {
    reset();
    onboard();
    get().enrollInRoadmap('ai-engineer');
    get().pauseRoadmap('ai-engineer');
    expect(get().roadmaps.find((r) => r.pathId === 'ai-engineer')!.roadmapStatus).toBe('PAUSED');
    get().reactivateRoadmap('ai-engineer');
    expect(get().roadmaps.find((r) => r.pathId === 'ai-engineer')!.roadmapStatus).toBe('ACTIVE');
  });

  it('archiving the PRIORITY promotes the next active roadmap to PRIORITY', () => {
    reset();
    onboard(); // data-architect PRIORITY
    get().enrollInRoadmap('ai-engineer'); // SECONDARY ACTIVE
    get().archiveRoadmap('data-architect');
    const da = get().roadmaps.find((r) => r.pathId === 'data-architect')!;
    const ai = get().roadmaps.find((r) => r.pathId === 'ai-engineer')!;
    expect(da.roadmapStatus).toBe('ARCHIVED');
    expect(ai.priorityStatus).toBe('PRIORITY');
    expect(get().prioritizedPathId).toBe('ai-engineer');
  });

  it('addRoadmapItem creates the personal library path + an available skill', () => {
    reset();
    onboard();
    const id = get().addRoadmapItem('Read SICP', '📖');
    expect(id.startsWith('personal_')).toBe(true);
    expect(get().userSkills[id].status).toBe('available');
    expect(get().customPaths.some((p) => p.id === 'personal_library')).toBe(true);
  });
});
