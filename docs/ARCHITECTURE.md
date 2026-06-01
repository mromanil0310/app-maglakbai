# SkillForge — Architecture & Technical Decisions

> This document describes the **current implemented architecture** (pilot-ready as of sprint 26) and the **planned Phase 2 backend migration** to Supabase.

---

## Current Stack (Implemented)

| Concern | Choice | Notes |
|---|---|---|
| Framework | React Native 0.76.9 + Expo SDK 55 | iOS + Android from one codebase |
| Web bundler | Vite 5 | Powers the web/PWA build; Metro handles native |
| Navigation | React Navigation 7 (Native Stack + Bottom Tabs) | Manual stack config; no Expo Router |
| State | Zustand 5 — single store (`src/store/appStore.ts`) | All state, actions, and static catalog in one file |
| Styling | `StyleSheet.create()` with design tokens | No NativeWind/Tailwind; all colors in `src/utils/theme.ts` |
| Animations | React Native `Animated` API | No Reanimated; no Lottie; confetti via injected CSS keyframes |
| Persistence | `localStorage` via `src/utils/asyncStorageWeb.ts` shim | No Supabase yet; single-device only |
| Analytics | PostHog-compatible HTTP API (`src/utils/analytics.ts`) | Gracefully no-ops without `VITE_POSTHOG_API_KEY` |
| Icons | Unicode emoji only | No icon library dependency |

### Web entry points

```
index.html          ← Vite HTML entry
web-index.tsx       ← React root render (renders App into #root)
App.tsx             ← SafeAreaProvider + ErrorBoundary + ToastProvider + AppNavigator
```

---

## Navigation Structure

```
Stack.Navigator (headerShown: false, animation: fade)
├── Onboarding          ← OnboardingScreen  (when hasOnboarded === false)
└── Main                ← Bottom Tab Navigator
    ├── Home            ← DashboardScreen
    ├── Community       ← FeedScreen
    ├── Log (+ button)  ← LogOutputScreen
    ├── Evolve          ← EvolveScreen
    └── Profile         ← ProfileScreen
MilestoneDetail (modal, slide_from_bottom) ← MilestoneScreen
```

Auth gate lives in `AppNavigator.tsx`:
```tsx
const hasOnboarded = useAppStore((s) => s.hasOnboarded);
// ...
<Stack.Screen name={hasOnboarded ? 'Main' : 'Onboarding'} />
```

---

## State — Single Zustand Store

All app state lives in `src/store/appStore.ts`. There is **one store**, not per-domain stores.

### Persisted fields (saved to `localStorage` key `skillforge_v1`)

```typescript
hasOnboarded: boolean
user: User | null
userSkills: Record<string, UserSkill>
outputs: Output[]
unlockedAchievementIds: string[]
customPaths: CustomPath[]
prioritizedPathId: string | null
roadmaps: RoadmapEntry[]
celebratedMilestones: string[]
userFeedPosts: FeedPost[]   // user-created posts; reconstructed into communityFeed on load
```

### Ephemeral fields (in-memory only)

```typescript
communityFeed: FeedPost[]        // reconstructed from [...userFeedPosts, ...MOCK_FEED] on load
pendingCelebration: PendingCelebration | null
selectedSkillId: string | null
showWelcomeCard: boolean          // ephemeral — fires once per new-user session
```

### Persistence mechanism

A single `useAppStore.subscribe()` listener at module level (not per-action `saveToStorage` calls):

```typescript
function getPersistable(state: AppState) { /* 10 persisted fields */ }

useAppStore.subscribe((state) => {
  const p = getPersistable(state);
  // Reference-equality short-circuit — only writes when a persisted field changed
  if (_lastPersisted !== null && /* all fields === */) return;
  _lastPersisted = p;
  saveToStorage(p);
});
```

### Static catalog (defined in appStore.ts, not DB-driven)

- `CAREER_PATHS` — 19 built-in paths with color themes and ordered skill IDs
- `ALL_SKILLS` — ~100 skill nodes with prerequisites, XP rewards, required output counts
- `ALL_ACHIEVEMENTS` — 8 achievement definitions
- `MOCK_FEED` — 24 seed community posts across all 19 paths

---

## XP & Leveling

```typescript
OUTPUT_XP = 50           // flat XP per output logged
skill.xpReward           // bonus XP on skill completion (75–400 by rarity)
achievement.xpGranted    // bonus XP on achievement unlock

// Streak milestone bonuses (applied in logOutput)
STREAK_MILESTONES = [
  { days: 7,  bonusXP: 25 },
  { days: 14, bonusXP: 50 },
  { days: 30, bonusXP: 100 },
]
```

Level thresholds live in `getLevelFromXP()` in `src/utils/theme.ts`.

Skill rarity XP rewards:
- `common` — 75–100 XP
- `uncommon` — 125–150 XP
- `rare` — 200–250 XP
- `epic` — 300–350 XP
- `legendary` — 400 XP

---

## Animation Patterns

All animations use React Native's `Animated` API. No Reanimated 3.

### XP Float (LogOutputScreen)
```tsx
// "+75 XP" floats upward from submit button on successful log
const floatAnim = useRef(new Animated.Value(0)).current;
Animated.sequence([
  Animated.timing(floatAnim, { toValue: -60, duration: 700, useNativeDriver: false }),
  Animated.timing(floatAnim, { toValue: -90, duration: 400, useNativeDriver: false }),
]).start();
```

### XP Bar Fill (DashboardScreen)
```tsx
const xpBarAnim = useRef(new Animated.Value(prevProgress)).current;
Animated.timing(xpBarAnim, { toValue: newProgress, duration: 800, useNativeDriver: false }).start();
```

### Skill Node Pulse (CareerNode — in-progress status)
```tsx
// Infinite alternating opacity pulse on the glow ring
Animated.loop(
  Animated.sequence([
    Animated.timing(pulseAnim, { toValue: 1, duration: 1100, useNativeDriver: false }),
    Animated.timing(pulseAnim, { toValue: 0.3, duration: 1100, useNativeDriver: false }),
  ])
).start();
```

### Streak-risk badge pulse (AppNavigator — Log tab)
```tsx
Animated.loop(
  Animated.sequence([
    Animated.timing(badgePulse, { toValue: 1.5, duration: 700, useNativeDriver: false }),
    Animated.timing(badgePulse, { toValue: 0.85, duration: 700, useNativeDriver: false }),
  ])
).start();
```

### Milestone Confetti (MilestoneScreen)
Full-screen confetti uses CSS `@keyframes` injected into `<head>` (web-only). 26 pieces fall from top with `msConfFall` animation. Platform: web only (`pointerEvents="none"`).

### Level-Up Overlay (LevelUpOverlay.tsx)
```tsx
// Spring entrance + pulsing glow ring + scale-in level number
Animated.spring(cardScale, { toValue: 1, tension: 65, friction: 8, useNativeDriver: false }).start();
Animated.loop(
  Animated.sequence([
    Animated.timing(glowAnim, { toValue: 1, duration: 900 }),
    Animated.timing(glowAnim, { toValue: 0.4, duration: 900 }),
  ])
).start();
```

---

## Design Tokens — `src/utils/theme.ts`

```typescript
Colors.bg            = '#080810'
Colors.surface       = '#0D0D1A'
Colors.card          = '#11111C'
Colors.border        = 'rgba(255,255,255,0.07)'
Colors.primary       = '#7C3AED'
Colors.primaryLight  = '#A855F7'
Colors.gold          = '#F59E0B'
Colors.success       = '#10B981'
Colors.danger        = '#EF4444'
Colors.text          = '#EEEEF8'
Colors.textSub       = '#8888AA'
Colors.textMuted     = '#7070A0'   // ≥4.6:1 contrast on card bg — WCAG AA compliant
```

`PathColors` record maps all 19 `CareerPathId` values to `{ primary, dim, text, border }`.

Never hardcode hex values in components — always import from `theme.ts`.

---

## Vite Build Configuration

```typescript
// vite.config.ts
resolve.alias: {
  'react-native': 'react-native-web',
  '@react-native-async-storage/async-storage': 'src/utils/asyncStorageWeb.ts',
}

build.rollupOptions.output.manualChunks: {
  vendor: ['react', 'react-dom', 'react-native-web'],           // 542KB — cached across deploys
  navigation: ['@react-navigation/*'],                           // 163KB — cached across deploys
  // App code chunk: ~230KB — the only chunk that changes per deploy
}
```

---

## Analytics — `src/utils/analytics.ts`

PostHog-compatible HTTP capture. Gracefully no-ops when `VITE_POSTHOG_API_KEY` is unset.

**16 instrumented events:**

| Event | When fired |
|---|---|
| `onboarding_started` | OnboardingScreen mount |
| `onboarding_step_completed` | Each step advance |
| `onboarding_step_skipped` | Skip link tapped |
| `onboarding_completed` | `completeOnboarding` action |
| `first_output_logged` | Store — `logOutput` when `outputs.length === 1`; includes `time_to_first_output_minutes` |
| `output_logged` | Every `logOutput` call |
| `skill_completed` | Skill reaches `completed` status |
| `level_up` | User crosses level threshold |
| `achievement_unlocked` | Achievement badge granted |
| `streak_milestone` | 7/14/30-day streak hit |
| `post_reacted` | Emoji reaction toggled |
| `comment_posted` | Comment submitted on a post |
| `milestone_screen_viewed` | MilestoneScreen opened |
| `path_switched` | User switches career path |
| `custom_path_created` | User creates a custom roadmap |
| `screen_viewed` | Any tab navigation |
| `log_screen_abandoned` | LogOutputScreen unmounted without submit |
| `session_started` | App.tsx visibility change → visible |
| `session_ended` | App.tsx visibility change → hidden; includes `duration_seconds` |

**Retention events** (also fired from `output_logged`):
- `retention_d1_activated`, `retention_d7`, `retention_d30`

**Activation:** Set `VITE_POSTHOG_API_KEY=phc_xxx` in a `.env` file.

---

## Key Architectural Decisions

### Why one Zustand store (not per-domain stores)
All state is deeply interrelated: logging an output affects skills, XP, achievements, streaks, and the feed simultaneously. Per-domain stores would require cross-store subscriptions. A single store keeps `logOutput` as a single transaction with no inter-store coordination.

### Why static career path data (not DB-driven)
Career paths are curated, not user-generated — changes deploy with code. Avoids a CMS integration for MVP. All path definitions live in `appStore.ts`; adding a path requires no schema change.

### Why `userFeedPosts` instead of persisting full `communityFeed`
`MOCK_FEED` is static and reconstructed from source on every load. Persisting only user-generated posts minimizes localStorage footprint. On load: `communityFeed = [...savedUserFeedPosts, ...MOCK_FEED]`.

### Why a persistence subscriber instead of per-action `saveToStorage` calls
A single `useAppStore.subscribe()` with reference-equality short-circuiting ensures every state mutation is automatically persisted without manually maintaining a list of call sites. Adding a new persisted field requires only updating `getPersistable()`.

### Optimistic reactions
`reactToPost` updates local state immediately. No rollback needed for a single-user local prototype; Supabase will add server-side sync in Phase 2.

---

## Phase 2 — Supabase Migration (Planned)

The following are **not yet implemented** and require a Supabase project with credentials.

### Required environment variables
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Migration plan

1. **Auth** — Replace `hasOnboarded` localStorage flag with Supabase Magic Link auth. Gate: read session from `supabase.auth.getSession()` instead of Zustand `hasOnboarded`.

2. **Profiles table** — Migrate `user: User` to `profiles` Supabase table. Schema in `docs/DATABASE.md`.

3. **Outputs + skill_progress** — Persist `outputs[]` and `userSkills` to Supabase. `logOutput` becomes an async action calling the DB.

4. **Community feed** — Replace `MOCK_FEED` + `userFeedPosts` with a live Supabase query. Add follow graph for personalized feed.

5. **Real leaderboard** — Replace the merged-mock leaderboard in FeedScreen with a live `SELECT user_id, SUM(xp) GROUP BY user_id ORDER BY xp DESC LIMIT 10` query on a weekly window.

6. **AI LinkedIn post** — OpenAI GPT-4o mini via Supabase Edge Function triggered on skill completion. Spec preserved below.

### OpenAI Edge Function (planned)

```typescript
// supabase/functions/generate-milestone-post/index.ts
serve(async (req) => {
  const { skillName, careerPath, evolutionPercent, streakDays, outputs } = await req.json();
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: `Generate a LinkedIn milestone post for a tech professional 
    who just completed "${skillName}" on their ${careerPath} path...` }],
    max_tokens: 300,
  });
  return new Response(JSON.stringify({ post: completion.choices[0].message.content }));
});
```

Client call via `supabase.functions.invoke('generate-milestone-post', { body: params })`.

---

## Performance Notes

- Vite `manualChunks`: vendor (542KB) and navigation (163KB) are highly cacheable; only the ~230KB app chunk changes per deploy.
- `buildInsights()` and `buildWeekGrid()` in DashboardScreen are wrapped in `useMemo([outputs])` — not recomputed on every render.
- Feed uses a flat `FlatList` with `keyExtractor`; no custom canvas.
- `getSkillStreak()` in EvolveScreen scans up to 60 days of output history per skill node — bounded and fast for pilot-scale output counts.
