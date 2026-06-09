# SkillForge — Architecture & Technical Decisions

> Describes the **current implemented architecture** (web/PWA pilot, as of sprint 39 — post ARCH-001 Supabase integration). This is the BAEF Phase 3 artifact; it must match the code. If you change structure, update this doc (see DOC-002 history in `reports/skillforge-audit-report.md`).

---

## Current Stack (Implemented)

| Concern | Choice | Notes |
|---|---|---|
| Framework | React Native 0.76.9 + Expo SDK 55 | One codebase; **only the web/PWA target ships today** (no native build — see REL-001/ARCH-007) |
| Web bundler | Vite 5 | Powers the web/PWA build; Metro handles native |
| Navigation | React Navigation 7 (Native Stack + Bottom Tabs) | Manual stack config; no Expo Router |
| State | Zustand 5 — **one store composed from slices** (`src/store/appStore.ts`) | Actions split into 4 slices; catalog + pure logic extracted (see Module Map) |
| Styling | `StyleSheet.create()` with design tokens | No NativeWind/Tailwind; all colors in `src/utils/theme.ts` |
| Animations | React Native `Animated` API | No Reanimated; no Lottie; confetti via injected CSS keyframes |
| Persistence | `localStorage` key `skillforge_v1` (`src/store/persistence.ts`) | No backend yet; single-device. Schema-versioned envelope `{ v, data }` with migration + validation (ARCH-003) |
| Testing | Vitest — 46 unit + integration tests (`npm test`) | Pure domain + store-action coverage (see Testing) |
| Analytics | PostHog-compatible HTTP API (`src/utils/analytics.ts`) | **Opt-in + PII-scrubbed**; no-ops without consent or `VITE_POSTHOG_API_KEY` |
| Icons | Unicode emoji only | No icon library dependency |

### Web entry points

```
index.html          ← Vite HTML entry
web-index.tsx       ← React root render (renders App into #root)
App.tsx             ← SafeAreaProvider + ErrorBoundary + ToastProvider + AppNavigator
```

---

## Module Map (post ARCH-002)

The store was decomposed from a single ~4,400-line file into focused modules. `appStore.ts` is now ~270 lines of state-init + slice composition + wiring.

```
src/
├── store/
│   ├── appStore.ts            ← state init (hydration), AppState type, slice composition, persistence wiring
│   ├── persistence.ts         ← loadFromStorage / getPersistable / attachPersistence(subscribe)
│   └── slices/
│       ├── coreSlice.ts       ← progression: completeOnboarding, logOutput, validateSkill,
│       │                         logCareerOutcome, deletes, useStreakFreeze, celebration/selection
│       ├── roadmapSlice.ts    ← custom paths + roadmap lifecycle (enroll/switch/pause/archive/…)
│       ├── feedSlice.ts       ← reactToPost, toggleSavePost, addComment
│       └── profileSlice.ts    ← avatar/bio/name/targetRole/pace/email/theme setters
├── data/                      ← pure static catalog (no logic, type-only imports)
│   ├── careerPaths.ts         ← CAREER_PATHS (19 paths)
│   ├── skills.ts              ← ALL_SKILLS
│   ├── achievements.ts        ← ALL_ACHIEVEMENTS (8)
│   └── mockFeed.ts            ← MOCK_FEED (seed/PREVIEW posts — not live data)
├── domain/                    ← pure, unit-tested calculators (no store/React deps)
│   ├── progression.ts         ← decay, burnout, evidence tier, skill/career mastery, OUTCOME_XP
│   ├── hydration.ts           ← reconcileAchievementsAndXP() — heals XP + achievements on load
│   ├── skillGraph.ts          ← initUserSkills, unlockDependentSkills, checkAchievements
│   └── __tests__/             ← progression / leveling / skillGraph / hydration suites
└── utils/
    ├── theme.ts               ← Colors, PathColors, typography, getLevelFromXP(), getLevelTitle()
    ├── analytics.ts           ← opt-in PostHog capture + PII scrub
    └── asyncStorageWeb.ts     ← localStorage shim (aliased in vite.config.ts)
```

`appStore.ts` re-exports the moved symbols (`CAREER_PATHS`, `ALL_SKILLS`, `ALL_ACHIEVEMENTS`, the domain calculators, etc.) so existing `from '../store/appStore'` imports in screens are unchanged.

---

## Navigation Structure

```
Stack.Navigator (headerShown: false, animation: fade)
├── Onboarding              ← OnboardingScreen  (when hasOnboarded === false)
├── Main                    ← Bottom Tab Navigator
│   ├── Home                ← DashboardScreen
│   ├── Community           ← FeedScreen
│   ├── Log (+ button)      ← LogOutputScreen
│   ├── Evolve              ← EvolveScreen
│   └── Profile             ← ProfileScreen
├── MilestoneDetail (modal, slide_from_bottom) ← MilestoneScreen
├── Settings  (stack)       ← SettingsScreen
└── Portfolio (stack)       ← PortfolioScreen
```

Every screen is wrapped with `withScreenBoundary(Component, name)` — a per-screen ErrorBoundary (friendly fallback; stack shown in dev only).
Auth gate in `AppNavigator.tsx`: `const hasOnboarded = useAppStore((s) => s.hasOnboarded)` selects Onboarding vs Main.

---

## State — Zustand Store (sliced)

There is **one store**, composed from slices:

```typescript
export const useAppStore = create<AppState>((set, get) => ({
  ...initialState,            // hydrated from localStorage in appStore.ts
  ...createCoreSlice(set, get),
  ...createRoadmapSlice(set, get),
  ...createFeedSlice(set, get),
  ...createProfileSlice(set, get),
}));
attachPersistence(useAppStore);
```

Slices add **actions only**; all state fields are initialized in `appStore.ts` (so `tsc` enforces a complete `AppState`). Actions read full state via `get()` and update via `set()` — a `logOutput` call still mutates skills, XP, achievements, streak, and feed in a single transaction.

### Persisted fields (14) — `localStorage` key `skillforge_v1`

`getPersistable()` in `src/store/persistence.ts` persists exactly:

```typescript
hasOnboarded, user, userSkills, outputs, unlockedAchievementIds,
customPaths, prioritizedPathId, roadmaps, celebratedMilestones,
userFeedPosts, savedPostIds, colorScheme, careerOutcomes,
fontScale          // user-adjustable text size (0.9–1.2, default 1)
```

### Ephemeral fields (in-memory only)

```typescript
communityFeed: FeedPost[]        // reconstructed from [...userFeedPosts, ...MOCK_FEED] on load
pendingCelebration | null
selectedSkillId: string | null
showWelcomeCard: boolean          // fires once per new-user session
```

### Persistence mechanism — `src/store/persistence.ts`

`attachPersistence(store)` registers a single `store.subscribe()` listener (not per-action `saveToStorage` calls). It diffs the persistable slice by reference equality and writes only when a persisted field changed. `saveToStorage` swallows quota errors and dispatches a `skillforge:storage-quota-exceeded` event for the UI. On load, `loadFromStorage()` + module-level rehydration in `appStore.ts` heal achievements/XP against the restored state.

> **Schema versioning (ARCH-003):** the payload is a versioned envelope `{ v: SCHEMA_VERSION, data }`. On load, `loadFromStorage` detects the version, runs a `migrate()` chain (legacy unversioned saves are treated as v0 and migrated forward), validates the shape, and returns `null` (clean reset) on corrupt data or a newer-than-current version. To evolve the shape: bump `SCHEMA_VERSION` and add a migration step.

---

## XP & Leveling

XP is awarded per output **by type**, plus quality and takeaway bonuses, computed in `coreSlice.logOutput`:

```typescript
// base XP by output type
project 75 · cert 200 · github 60 · book 50 · script 50 ·
diagram 75 · reflection 30 · event 65 · other 50          // default 50

qualityBonus  = description.length >= 120 ? 20 : >= 50 ? 10 : 0
takeawayBonus = keyTakeaway?.trim() ? 15 : 0
// keyTakeaway is persisted on the Output object and shown in the Profile detail modal

OUTPUT_XP   = baseXP + qualityBonus + takeawayBonus
skill.xpReward         // bonus on skill completion (gated by the evidence rule below)
achievement.xpGranted  // bonus on achievement unlock
validateSkill          // +50 XP for passing a skill's knowledge check
OUTCOME_XP             // career-outcome bonuses (src/domain/progression.ts): offer 500, role_change 500,
                       // promotion 400, certification 300, salary_increase 300, freelance 250, portfolio 200, interview 150

// Streak milestone bonuses (one-time, in logOutput)
day 7 → +25 · day 14 → +50 · day 30 → +100   // a streak freeze is also granted every 7 days
```

**Evidence gate:** a built-in skill can only reach `completed` once at least one of its outputs is `verified` (has a link) or `documented` (description ≥ 50 chars). Logging-only entries can't fake mastery. See `getEvidenceTier` in `src/domain/progression.ts`.

Level thresholds: `getLevelFromXP()` in `src/utils/theme.ts` (cumulative `level*200`: L1 0, L2 200, L3 600, L4 1200, …). Skill rarity rewards range common (75–100) → legendary (400).

---

## Testing — Vitest (`npm test`)

94 tests; node environment; runs `src/**/*.test.ts`. Two layers:

- **Pure domain** (`src/domain/__tests__/`): `progression` (decay stages, burnout window, evidence tiers, skill/career mastery ladder, OUTCOME_XP), `leveling` (XP→level/title/bounds), `skillGraph` (achievement unlock thresholds + dedupe).
- **Store-action integration** (`src/store/__tests__/appStore.test.ts`): exercises the real store — `completeOnboarding` (init + experienced pre-credit), `logOutput` (XP-by-type + bonuses, evidence gate, completion + prerequisite unlock, first-steps achievement, streak), `validateSkill`.

Convention: new pure logic in `src/domain/` ships with a test. Known gap: the roadmap/feed/profile slices were moved verbatim and are build-verified but lack per-action tests.

---

## Animation Patterns

All animations use React Native's `Animated` API (no Reanimated). `useNativeDriver: false` for web compatibility.

- **XP Float** (LogOutputScreen) — "+XP" rises from the submit button via an `Animated.sequence`.
- **XP Bar Fill** (DashboardScreen / XPBar) — `Animated.timing` from previous → new progress over 800ms.
- **Skill Node Pulse** (CareerNode) — infinite alternating opacity loop on the in-progress glow ring.
- **Streak-risk badge pulse** (AppNavigator Log tab) — looping scale pulse.
- **Milestone Confetti** (MilestoneScreen) — web-only CSS `@keyframes` injected into `<head>` (`pointerEvents="none"`).
- **Level-Up Overlay** (LevelUpOverlay) — spring entrance + looping glow ring.

---

## Design Tokens

`src/utils/theme.ts` is the **single source of truth** — never hardcode hex values in components; import from `Colors` / `PathColors`.

- `Colors` — dark-theme palette (bg/surface/card/border, primary/primaryLight, gold/success/danger, text/textSub/textMuted). `textMuted` is tuned for WCAG AA contrast on card backgrounds.
- `PathColors` — maps all 19 `CareerPathId` values to `{ primary, dim, text, border }`.
- `getColors(scheme)` returns the dark or light palette based on `colorScheme`.

(Exact values intentionally not duplicated here to prevent drift — read them from `theme.ts`.)

---

## Vite Build Configuration

```typescript
// vite.config.ts
resolve.alias: {
  'react-native': 'react-native-web',
  '@react-native-async-storage/async-storage': 'src/utils/asyncStorageWeb.ts',
}

build.rollupOptions.output.manualChunks: {
  vendor: ['react', 'react-dom', 'react-native-web'],   // ~545KB — cached across deploys
  navigation: ['@react-navigation/*'],                   // ~163KB — cached across deploys
  // app chunk: ~415KB — changes per deploy
}
```

`public/` assets (PWA manifest, icons, `USER_GUIDE.html`) are copied to `dist/` on build. `vercel.json` provides SPA rewrites + security headers. See `docs/DEPLOYMENT.md` (DOC-005) for the full deploy path.

---

## Analytics — `src/utils/analytics.ts`

PostHog-compatible HTTP capture. **Opt-in only**: every `track()`/`identify()` is a hard no-op until the user grants consent (persisted as `sf_analytics_consent`), and also no-ops without `VITE_POSTHOG_API_KEY`. **No PII** — users are identified by an anonymous id; a defensive scrub strips `name`/`email`/free-text keys from payloads.

Instrumented events include: `onboarding_started/step_completed/step_skipped/completed`, `first_output_logged`, `output_logged`, `skill_completed`, `level_up`, `achievement_unlocked`, `streak_milestone`, `post_reacted`, `comment_posted`, `milestone_screen_viewed`, `path_switched`, `custom_path_created`, `screen_viewed`, `log_screen_abandoned`, `session_started/ended`, and retention markers (`retention_d1_activated/d7/d30`).

**Activation:** set `VITE_POSTHOG_API_KEY` (and optional `VITE_POSTHOG_HOST`) — see `.env.example` (DOC-004).

---

## Key Architectural Decisions

### One store, composed from slices (not per-domain stores)
State is deeply interrelated — `logOutput` touches skills, XP, achievements, streak, and the feed in one transaction. Per-domain stores would need cross-store subscriptions. We keep a single store but split the **actions** into cohesive slices (`core`/`roadmap`/`feed`/`profile`) combined in `create()`, so the transaction model is unchanged while the file is reviewable (ARCH-002).

### Catalog in `src/data/`, pure logic in `src/domain/`
Static catalog (paths/skills/achievements/seed feed) is curated and deploys with code — no CMS for the pilot. Extracting it (and the pure calculators) out of the store made both independently importable and unit-testable, and shrank `appStore.ts` by ~94%.

### Persistence as a subscriber (not per-action saves)
A single `subscribe()` with reference-equality short-circuiting auto-persists every mutation; adding a persisted field touches only `getPersistable()`. Lives in `persistence.ts`.

### `userFeedPosts` persisted, `communityFeed` reconstructed
`MOCK_FEED` is static and clearly labeled preview data; only user-created posts are persisted. On load: `communityFeed = [...userFeedPosts, ...MOCK_FEED]`.

### Optimistic reactions
`reactToPost` updates local state immediately — acceptable for a single-user local pilot; Supabase adds server sync in Phase 2.

---

## Phase 2 — Supabase Backend

### ✅ Implemented (sprint 39, ARCH-001)

**Project:** `wovceouygyobczkkeyxy.supabase.co`

**Environment variables** (set in Netlify dashboard + `.env` locally):
```bash
VITE_SUPABASE_URL=https://wovceouygyobczkkeyxy.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_rRWhF-tIe1f8Kx5lck15Mw_KFcEcQ9Z
```

**Client layer** — `src/lib/`:
- `supabase.ts` — singleton client; `isSupabaseEnabled` guard (no-ops when env vars absent — CI stays green)
- `auth.ts` — `sendMagicLink`, `signOut`, `getSession`, `onAuthStateChange`
- `db.ts` — `upsertProfile`, `fetchProfile`, `insertOutput`, `fetchOutputs`, `upsertSkillProgress`, `fetchSkillProgress`

**Store layer** — `src/store/slices/authSlice.ts`:
- `setSupabaseSession` — stores session userId + email in Zustand state
- `syncFromSupabase` — pulls remote → merges into local (remote wins on XP/streak; union on outputs; `completed` status wins on skills)

**Sync strategy** — localStorage-first, Supabase additive:
- `localStorage` is always the primary store (fast, offline-capable, no latency change)
- `logOutput` + `completeOnboarding` fire-and-forget sync to Supabase after local state is updated
- `AppNavigator` subscribes to `onAuthStateChange` — triggers `syncFromSupabase` on SIGNED_IN
- Users sign in via **Settings → Cloud Backup** (Magic Link email)

**RLS policies** — all tables are owner-only (tightened from initial schema):
- `profiles`, `outputs`, `milestones` — select only for `auth.uid() = user_id / id`
- `skill_progress` — select only for `auth.uid() = user_id`
- Feed tables (`feed_posts`, `reactions`, `comments`) — public read (ready for Phase 2 social feed)

### 🔲 Remaining Phase 2 (not yet built)
4. **Community feed** — replace `MOCK_FEED` + `userFeedPosts` with a live query + follow graph.
5. **Real leaderboard** — replace the mocked FeedScreen leaderboard with a weekly `SUM(xp)` query.
6. **AI LinkedIn post** — OpenAI `gpt-4o-mini` via a Supabase Edge Function on skill completion.

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
Client: `supabase.functions.invoke('generate-milestone-post', { body: params })`.

---

## Performance Notes

- Vite `manualChunks`: vendor (~545KB) + navigation (~163KB) are highly cacheable; only the ~415KB app chunk changes per deploy.
- DashboardScreen insight/week-grid builders are wrapped in `useMemo([outputs])`.
- Feed uses a flat `FlatList` with `keyExtractor`.
- `getSkillStreak()` (EvolveScreen) scans up to 60 days of history per node — bounded for pilot-scale data.
