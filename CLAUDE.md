# SkillForge — Claude Code Project Context

> "The Strava for professional growth."
> Track your evolution as a tech professional through proof-based progression.

---

## Linked Files

| File | Purpose |
|------|---------|
| `docs/skillforge-daily-qa.md` | Canonical skill definition for the daily QA scheduled task |
| `reports/skillforge-audit-report.md` | Live backlog and run log — source of truth for bugs, fixes, and next actions |
| `docs/PRD.md` | Full product requirements and feature specs |
| `docs/ARCHITECTURE.md` | Tech decisions, animation patterns, Edge Function spec |
| `docs/DATABASE.md` | Supabase schema design (planned integration) |
| `docs/design/skillforge-prototype.html` | Interactive UI prototype — open in browser for visual reference |
| `docs/USER_GUIDE.html` | End-user how-to guide (on-brand, self-contained) |

---

## What This App Is

SkillForge is a career gamification app for tech professionals. Users log real proof-of-work outputs — projects, scripts, books, certifications, GitHub repos — to earn XP, unlock milestone achievements, and share progress on a social feed.

**Core differentiator:** Proof-based progression. XP comes from building, not watching.

**Core addiction loop:** Learn → Build → Log Output → Gain XP → Unlock Milestone → Share → Receive Recognition → Repeat

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React Native + Expo SDK 55 |
| Navigation | React Navigation 7 (Native Stack + Bottom Tabs) |
| State | Zustand store — `src/store/appStore.ts` (runtime state + actions + persistence). Static catalog lives in `src/data/`, pure calculators in `src/domain/`. |
| Styling | StyleSheet.create() with design tokens in `src/utils/theme.ts` |
| Web bundler | Vite (for fast web dev), Metro (for native) |
| Persistence | `localStorage` key `skillforge_v1`, written directly in `appStore.ts` (auto-persist `subscribe`). `src/utils/asyncStorageWeb.ts` is a localStorage shim aliased in `vite.config.ts`. |
| Testing | Vitest (`npm test`) — unit tests over `src/domain/` + `src/utils/theme.ts` |
| Backend | **Not yet integrated** — Supabase planned (see `docs/DATABASE.md`) |
| AI | **Not yet integrated** — OpenAI Edge Function planned (see `docs/ARCHITECTURE.md`) |

---

## Project Structure

```
SkillForge/
├── CLAUDE.md                        ← you are here
├── App.tsx                          ← root: SafeAreaProvider + ErrorBoundary + AppNavigator
├── index.ts                         ← Expo entry point (registerRootComponent)
├── index.html                       ← Vite web entry HTML (loads web-index.tsx)
├── web-index.tsx                    ← Vite web entry (renders App into #root)
├── vite.config.ts                   ← Vite config (aliases react-native → react-native-web)
├── vitest.config.ts                 ← Vitest config (node env, runs src/**/*.test.ts)
├── babel.config.js                  ← Babel config for Expo
├── tsconfig.json                    ← TypeScript strict config
├── app.json                         ← Expo project config
├── vercel.json                      ← Vercel rewrites + security headers (web/PWA deploy)
├── package.json
│
├── public/                          ← PWA assets copied to dist/ on build (manifest, icons, USER_GUIDE.html)
├── scripts/
│   └── start-vite.sh
│
├── docs/                            ← Product & technical docs
│   ├── PRD.md                       ← Full product requirements & feature specs
│   ├── ARCHITECTURE.md              ← Tech decisions, animation patterns, Edge Function
│   ├── DATABASE.md                  ← Supabase schema design (planned integration)
│   ├── USER_GUIDE.html              ← end-user how-to guide (also deployed via public/)
│   ├── skillforge-daily-qa.md       ← canonical daily-QA scheduled-task skill definition
│   └── design/
│       └── skillforge-prototype.html  ← Interactive UI prototype (open in browser)
│
├── reports/
│   └── skillforge-audit-report.md   ← live backlog + run log (BAEF-governed source of truth)
│
└── src/
    ├── components/                  ← 10 presentational components
    │   ├── AchievementBadge.tsx     ← rarity badge chip (common…legendary)
    │   ├── CareerNode.tsx           ← skill node on the evolution map
    │   ├── CelebrationOverlay.tsx   ← full-screen confetti/mascot overlay (Home)
    │   ├── ConsentBanner.tsx        ← analytics opt-in consent gate
    │   ├── FeedCard.tsx             ← community feed post card with reactions
    │   ├── LevelUpOverlay.tsx       ← level-up celebration overlay
    │   ├── PrivacyPolicyModal.tsx   ← privacy policy modal
    │   ├── Toast.tsx                ← XP feedback toast notification
    │   ├── ValidationChallengeModal.tsx ← skill-validation knowledge-check modal
    │   └── XPBar.tsx                ← animated XP progress bar
    │
    ├── data/                        ← static catalog + seed data (pure; extracted from store, ARCH-002)
    │   ├── careerPaths.ts           ← CAREER_PATHS (19 paths)
    │   ├── skills.ts                ← ALL_SKILLS (all skill nodes)
    │   ├── achievements.ts          ← ALL_ACHIEVEMENTS (8)
    │   └── mockFeed.ts              ← MOCK_FEED (seed/PREVIEW posts — not live data)
    │
    ├── domain/                      ← pure, unit-tested progression calculators (ARCH-002)
    │   ├── progression.ts           ← decay, burnout, evidence tier, skill/career mastery, OUTCOME_XP
    │   └── __tests__/               ← Vitest suites (progression.test.ts, leveling.test.ts)
    │
    ├── navigation/
    │   └── AppNavigator.tsx         ← Onboarding → Main tabs → modal/stack screens; per-screen ErrorBoundary
    │
    ├── screens/                     ← 9 screens
    │   ├── OnboardingScreen.tsx     ← 5-step onboarding: welcome → name/email → path → experience level → first output
    │   ├── DashboardScreen.tsx      ← Home tab: path ring, XP bar, coaching, decay/burnout nudges
    │   ├── EvolveScreen.tsx         ← Evolve tab: milestone map, path switcher, custom roadmaps
    │   ├── LogOutputScreen.tsx      ← Log tab: proof-of-work output (6 types + XP float)
    │   ├── FeedScreen.tsx           ← Community tab: feed (PREVIEW) + leaderboard + coaching banner
    │   ├── ProfileScreen.tsx        ← Profile tab: stats, achievements, mastery, gallery
    │   ├── MilestoneScreen.tsx      ← skill-completion celebration (modal + share)
    │   ├── SettingsScreen.tsx       ← theme, analytics consent, data export/import, reset
    │   └── PortfolioScreen.tsx      ← proof-of-work portfolio + self-reported career outcomes
    │
    ├── store/
    │   └── appStore.ts              ← Zustand store: runtime state + 40+ actions + persistence (logic/wiring)
    │
    ├── types/
    │   └── index.ts                 ← All TypeScript interfaces (User, Skill, Output, FeedPost, etc.)
    │
    └── utils/
        ├── analytics.ts             ← PostHog-compatible, opt-in + PII-scrubbed (set VITE_POSTHOG_API_KEY)
        ├── asyncStorageWeb.ts       ← localStorage shim for Vite/web (aliased in vite.config.ts)
        └── theme.ts                 ← Colors, typography tokens, getLevelFromXP(), getLevelTitle()
```

---

## Navigation Structure

```
Stack.Navigator (headerShown: false, animation: fade)
├── Onboarding          ← OnboardingScreen  (shown when hasOnboarded === false)
├── Main                ← Bottom Tab Navigator
│   ├── Home  "Home"         ← DashboardScreen  (path ring, XP bar, coaching)
│   ├── Feed  "Community"    ← FeedScreen
│   ├── Log   (+ button)     ← LogOutputScreen
│   ├── Map   "Evolve"       ← EvolveScreen     (milestone map, custom roadmaps)
│   └── Profile "Profile"   ← ProfileScreen
├── MilestoneDetail (modal, slide_from_bottom) ← MilestoneScreen
├── Settings  (stack)       ← SettingsScreen
└── Portfolio (stack)       ← PortfolioScreen
```

Every screen is wrapped with a per-screen `withScreenBoundary(...)` ErrorBoundary in `AppNavigator.tsx`.
Auth gate: `AppNavigator.tsx` reads `useAppStore((s) => s.hasOnboarded)` and conditionally renders Onboarding or Main.

---

## State — `src/store/appStore.ts`

Single Zustand store for runtime state + actions + persistence wiring. Static catalog data and pure calculators were extracted out of this file (ARCH-002) and are imported back + re-exported, so existing `from '../store/appStore'` imports still resolve.

**Static catalog — now in `src/data/` (re-exported from appStore):**
- `CAREER_PATHS` (`src/data/careerPaths.ts`) — **19 paths**, each with color theme + ordered skill IDs
- `ALL_SKILLS` (`src/data/skills.ts`) — all skill nodes with prerequisites, XP rewards, required output counts
- `ALL_ACHIEVEMENTS` (`src/data/achievements.ts`) — **8** achievement definitions with XP grants
- `MOCK_FEED` (`src/data/mockFeed.ts`) — seed/PREVIEW community posts (fictional users; labeled non-live)

**Pure progression logic — now in `src/domain/progression.ts` (unit-tested, re-exported):**
- `getDecayStage`, `getBurnoutSignal`, `getEvidenceTier`, `getSkillMasteryLevel`, `getCareerMastery`, `OUTCOME_XP`
- (`MASTERY_TIERS` / `CAREER_MASTERY_META` presentation metadata stay in `appStore.ts` — they depend on theme `Colors`.)

**Runtime state (selected fields):**
```typescript
hasOnboarded: boolean
user: User | null                          // xp, level, streak, careerPathId, avatarEmoji, paceMode, etc.
userSkills: Record<string, UserSkill>      // per-skill: status + outputCount + validated
outputs: Output[]                          // all logged proof-of-work items
unlockedAchievementIds: string[]
communityFeed / userFeedPosts: FeedPost[]  // seed (preview) + user's own posts
customPaths / roadmaps                     // custom + enrolled-roadmap state
careerOutcomes: CareerOutcome[]            // self-reported real-world wins
savedPostIds, celebratedMilestones, colorScheme, prioritizedPathId
pendingCelebration, selectedSkillId
```

**Actions:** 40+ actions (the full surface is large). Core ones: `completeOnboarding`, `logOutput`, `logCareerOutcome`, `validateSkill`, `reactToPost`, `addComment`, roadmap lifecycle (`enrollInRoadmap`/`switchPath`/`pauseRoadmap`/…), `useStreakFreeze`, `clearCelebration`, `resetApp`.

**Persistence:** `localStorage` key `skillforge_v1`, via an auto-persist `subscribe`. Persisted slice includes `hasOnboarded`, `user`, `userSkills`, `outputs`, `unlockedAchievementIds`, `customPaths`, `prioritizedPathId`, `roadmaps`, `celebratedMilestones`, `userFeedPosts`, `savedPostIds`, `colorScheme`, `careerOutcomes`. Stored as a schema-versioned envelope `{ v, data }` with migration + validation on load (ARCH-003, `src/store/persistence.ts`).

---

## Career Paths

**19 built-in paths** in `src/data/careerPaths.ts`. Examples:

| ID | Label | Skills (ordered) |
|---|---|---|
| `data-architect` | Data Architect 🏗️ | SQL Foundations → Python Automation → Snowflake Engineering → Data Modeling → AI Workflow Design |
| `ai-engineer` | AI Engineer 🤖 | Python Fundamentals → REST APIs → Prompt Engineering → Vector Databases → RAG Systems → AI Agents |
| `fullstack` | Full Stack 🌐 | HTML & CSS → JavaScript → React & RN → Backend APIs → Database Design → Cloud Deployment |

Others: `data-engineer`, `ml-engineer`, `backend-engineer`, `frontend-engineer`, `cloud-engineer`, `devops`, `cybersecurity`, `product-manager`, `business-analyst`, `data-analyst`, `project-manager`, `solutions-architect`, `software-architect`, `mobile-developer`, `ui-ux-designer`, `startup-founder`. Users can also create **custom paths**.

Skill status flow: `locked` → `available` → `in_progress` → `completed`

Prerequisites are enforced in `unlockDependentSkills()` — a skill only becomes `available` when all its `prerequisites[]` are `completed`.

---

## XP & Leveling

```typescript
OUTPUT_XP = 50       // flat XP per any output logged
skill.xpReward       // bonus XP on skill completion (75–400 depending on rarity)
achievement.xpGranted // bonus XP on achievement unlock
```

Level thresholds live in `getLevelFromXP()` in `src/utils/theme.ts`. Check that file for the full table.

Skill rarities: `common` | `uncommon` | `rare` | `epic` | `legendary`

---

## Design Tokens — `src/utils/theme.ts`

```typescript
Colors.bg            = '#0A0A0F'
Colors.surface       = '#13131F'
Colors.surfaceHigh   = '#1A1A2E'
Colors.border        = 'rgba(255,255,255,0.07)'
Colors.primary       = '#7C3AED'
Colors.primaryLight  = '#A855F7'
Colors.gold          = '#F59E0B'
Colors.green         = '#10B981'
Colors.text          = '#EEEEF8'
Colors.textSecondary = '#8888AA'
Colors.textMuted     = '#44446A'
```

Never hardcode hex values in components — always import from theme.ts.

For the full visual target, open `docs/design/skillforge-prototype.html` in a browser.

---

## Key Commands

```bash
# Fastest for UI work — web via Vite
npx vite

# Expo dev server (all platforms)
npx expo start

# iOS simulator
npx expo run:ios

# Android emulator
npx expo run:android

# Web via Expo (Metro)
npx expo start --web

# Run unit tests (Vitest)
npm test
```

---

## Build Status

### ✅ Already Built (Pilot-Ready)
- Onboarding — 5-step flow: welcome → name/email → path selection → experience level (Fresh Start / Some Foundation / Bringing Experience, with skill pre-crediting) → first output log
- Career Evolution Map (`EvolveScreen`) with skill nodes (locked / available / in-progress / completed)
- Custom roadmaps — users can create personal skill paths beyond the 3 built-in ones
- Path switching — users can switch between built-in and custom paths
- Dashboard (`DashboardScreen`) — hero card with giant ring, XP bar, stats
  - Empty-state coaching card for users with 0 outputs (with proof-of-work prompts + CTA)
  - "Next Milestone" quick-action card shows next skill to work on
  - Streak nudge + 7-day progress dots for days 1-6
  - Streak-at-risk pulsing warning + "Use Freeze" button
- Log Output form (6 output types: project, book, cert, script, diagram, GitHub)
  - XP float animation (+XP rising from submit button)
  - XP preview showing base + skill-completion bonus
  - Dynamic "Add to My Library" when typing a new item title
- XP calculation + level-up logic (10 levels with titles)
- Skill completion detection + prerequisite unlocking
- Achievement system (8 achievements including streak-based ones)
- Streak system with grace period, freeze mechanic, milestone bonuses (7/14/30-day)
- Milestone celebration screen (modal) with particle burst + level-up card + share post
- CelebrationOverlay (Home screen) — confetti + rocket/trophy/dancer animations per milestone tier
- Community feed with 8 seed posts from fictional users + user posts prepended on log
- Feed coaching banner for users with no personal posts yet
- Emoji reactions on feed posts (optimistic, toggle)
- Profile screen with stats, XP bar, achievements, proof-of-work gallery
- Toast notification system for XP feedback
- localStorage persistence (`skillforge_v1`)
- **Analytics instrumentation** (`src/utils/analytics.ts`) — PostHog-compatible
  - Events: onboarding_started, onboarding_step_completed, onboarding_completed,
    first_output_logged, output_logged, skill_completed, level_up, achievement_unlocked,
    streak_milestone, post_reacted, milestone_screen_viewed, path_switched,
    custom_path_created, screen_viewed
  - Set `VITE_POSTHOG_API_KEY` in `.env` to activate (gracefully no-ops when unset)

### 🔲 Phase 2 — Real Backend (next priority)
- Supabase auth (Magic Link — replace localStorage)
- Supabase database (schema in `docs/DATABASE.md`)
- Multi-device support + persistent profiles
- Follow / unfollow users
- Comments on feed posts
- Real weekly XP leaderboard (currently mocked)
- AI-generated LinkedIn post (OpenAI Edge Function — see `docs/ARCHITECTURE.md`)

### 🔲 Phase 3 — Identity & Portfolio
- Public profile URL (`skillforge.app/@username`)
- GitHub link support on outputs
- LinkedIn share deep link from MilestoneScreen
- Push notifications (streak reminders)

### 🔲 Phase 4 — Growth
- Referral system
- Cohort/team support
- Recruiter-facing profile view

---

## Coding Conventions

- TypeScript strict — no `any`, no type casting unless unavoidable
- Functional components only, `const` arrow functions
- `StyleSheet.create()` for all styles — no inline style objects in JSX
- All colors from `Colors` in `src/utils/theme.ts` — never hardcode hex
- All state reads/writes through `useAppStore` — no shared state in local useState
- New screen → add to `AppNavigator.tsx` (wrap with `withScreenBoundary`) and update the relevant param list type
- New skill/path → update `src/data/careerPaths.ts` and `src/data/skills.ts`
- New achievement → add to `src/data/achievements.ts` and update `checkAchievements()` in `appStore.ts`
- New pure progression logic → add to `src/domain/progression.ts` **with a Vitest test** in `src/domain/__tests__/`

## Do NOT Build
- AI tutoring or course content
- Course marketplace
- DMs / private messaging
- Recruiter marketplace
- Live chat or video
- Push notifications (Phase 3+)
