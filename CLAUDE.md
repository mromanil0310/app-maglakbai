# MaglakbAI — Claude Code Project Context

> "Level up through proof, not promises."
> Any skill. Any field. Any level.

---

## Linked Files

| File | Purpose |
|------|---------|
| `docs/maglakbai-daily-qa.md` | Canonical skill definition for the daily QA scheduled task |
| `reports/maglakbai-audit-report.md` | Live backlog and run log — source of truth for bugs, fixes, and next actions |
| `docs/PRD.md` | Full product requirements and feature specs |
| `docs/ARCHITECTURE.md` | Tech decisions, animation patterns, Edge Function spec |
| `docs/DATABASE.md` | Supabase schema design (live — project `wovceouygyobczkkeyxy`) |
| `docs/design/maglakbai-prototype.html` | Interactive UI prototype — open in browser for visual reference |
| `public/USER_GUIDE.html` | End-user how-to guide (on-brand, self-contained; the copy that deploys) |

---

## What This App Is

MaglakbAI is a skill gamification app for anyone who wants to grow — not just tech professionals. Users log real proof-of-work outputs — projects, scripts, books, certifications, GitHub repos — to earn XP, unlock milestone achievements, and share progress on a social feed.

**Core differentiator:** Proof-based progression. XP comes from building, not watching.

**Core tagline:** *"Stop watching. Start building."*

**Core addiction loop:** Learn → Build → Log Output → Gain XP → Unlock Milestone → Share → Receive Recognition → Repeat

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React Native + Expo SDK 55 |
| Navigation | React Navigation 7 (Native Stack + Bottom Tabs) |
| State | Zustand store — `src/store/appStore.ts` (runtime state + slice composition). Static catalog in `src/data/`, pure calculators in `src/domain/`, store slices in `src/store/slices/`. |
| Styling | StyleSheet.create() with design tokens in `src/utils/theme.ts` |
| Web bundler | Vite (for fast web dev), Metro (for native) |
| Persistence | `localStorage` key `maglakbai_v1` (primary, always-on) + **Supabase** (cloud backup, activated on Magic Link sign-in). Schema-versioned envelope `{ v, data }` with migration + validation (`src/store/persistence.ts`). |
| Backend | **Live (ARCH-001)** — Supabase project `wovceouygyobczkkeyxy`. Auth (Magic Link), profiles, outputs, skill_progress. Client in `src/lib/`. |
| Testing | Vitest (`npm test`) — **116 tests** across domain, persistence, and all store-action slices + CI gate |
| Deployment | Netlify (`netlify.toml`) — auto-deploys on push to `main`. Live at `https://fascinating-kitten-b6a79d.netlify.app` |
| AI | **Not yet integrated** — OpenAI Edge Function planned (see `docs/ARCHITECTURE.md`) |

---

## Project Structure

```
MaglakbAI/
├── CLAUDE.md                        ← you are here
├── App.tsx                          ← root: ThemeContext + SafeAreaProvider + ErrorBoundary + AppNavigator
├── index.ts                         ← Expo entry point (registerRootComponent)
├── index.html                       ← Vite web entry HTML (loads web-index.tsx)
├── web-index.tsx                    ← Vite web entry (renders App into #root)
├── vite.config.ts                   ← Vite config (aliases react-native → react-native-web)
├── vitest.config.ts                 ← Vitest config (node env, runs src/**/*.test.ts)
├── babel.config.js                  ← Babel config for Expo
├── tsconfig.json                    ← TypeScript strict config
├── app.json                         ← Expo project config
├── netlify.toml                     ← Netlify build config + security headers + asset cache
├── vercel.json                      ← Vercel rewrites (legacy; Netlify is the active deploy target)
├── .env.example                     ← env var template (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_POSTHOG_API_KEY)
├── package.json
│
├── public/                          ← PWA assets copied to dist/ on build (manifest, icons, _redirects, USER_GUIDE.html)
├── scripts/
│   └── start-vite.sh
│
├── docs/                            ← Product & technical docs
│   ├── PRD.md                       ← Full product requirements & feature specs
│   ├── ARCHITECTURE.md              ← Tech decisions, animation patterns, Supabase integration
│   ├── DATABASE.md                  ← Supabase schema (live — project wovceouygyobczkkeyxy)
│   ├── DEPLOYMENT.md                ← Netlify deploy guide + env vars + Supabase URL config
│   ├── maglakbai-daily-qa.md       ← canonical daily-QA scheduled-task skill definition
│   └── design/
│       └── maglakbai-prototype.html  ← Interactive UI prototype (open in browser)
│
├── reports/
│   └── maglakbai-audit-report.md   ← live backlog + run log (BAEF-governed source of truth)
│
└── src/
    ├── components/                  ← 10 presentational components
    │   ├── AchievementBadge.tsx     ← rarity badge chip (common…legendary)
    │   ├── CareerNode.tsx           ← skill node on the evolution map
    │   ├── CelebrationOverlay.tsx   ← full-screen confetti/mascot overlay (Home)
    │   ├── ConsentBanner.tsx        ← analytics opt-in consent gate (shown post-onboarding only)
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
    │   ├── progression.ts           ← decay, burnout, evidence tier, skill/career mastery, OUTCOME_XP, ONBOARDING_XP_GRANT
    │   ├── hydration.ts             ← reconcileAchievementsAndXP() — heals XP on load
    │   ├── skillGraph.ts            ← initUserSkills, unlockDependentSkills, checkAchievements, pathHasProgress
    │   └── __tests__/               ← Vitest suites (progression, leveling, skillGraph, hydration)
    │
    ├── lib/                         ← Supabase backend layer (ARCH-001)
    │   ├── supabase.ts              ← Supabase client singleton; isSupabaseEnabled guard
    │   ├── auth.ts                  ← Magic Link send/verify, session listener, onAuthStateChange
    │   └── db.ts                    ← upsertProfile, insertOutput, upsertSkillProgress + fetch helpers
    │
    ├── navigation/
    │   └── AppNavigator.tsx         ← Onboarding → Main tabs → modal/stack screens; per-screen ErrorBoundary; auth session listener
    │
    ├── screens/                     ← 9 screens
    │   ├── OnboardingScreen.tsx     ← 5-step onboarding: welcome → name/email → path → experience level → first output
    │   ├── DashboardScreen.tsx      ← Home tab: path ring, XP bar, coaching, decay/burnout nudges
    │   ├── EvolveScreen.tsx         ← Evolve tab: milestone map, path switcher, editable custom roadmaps
    │   ├── LogOutputScreen.tsx      ← Log tab: proof-of-work output (9 types + XP float)
    │   ├── FeedScreen.tsx           ← Feed tab: community feed (PREVIEW) + leaderboard + coaching banner
    │   ├── ProfileScreen.tsx        ← Profile tab: stats, achievements, mastery, gallery, pace mode
    │   ├── MilestoneScreen.tsx      ← skill-completion celebration (modal + share)
    │   ├── SettingsScreen.tsx       ← theme, analytics consent, cloud backup, data export/import, reset
    │   └── PortfolioScreen.tsx      ← proof-of-work portfolio + self-reported career outcomes
    │
    ├── store/
    │   ├── appStore.ts              ← Zustand store: state init + slice composition + AppState interface
    │   ├── persistence.ts           ← schema-versioned localStorage persistence (ARCH-003)
    │   └── slices/
    │       ├── coreSlice.ts         ← completeOnboarding, logOutput, validateSkill, logCareerOutcome, resetApp…
    │       ├── roadmapSlice.ts      ← addCustomPath, enrollInRoadmap, forkBuiltInPath, addMilestone, lockRoadmap, deleteRoadmap…
    │       ├── feedSlice.ts         ← reactToPost, toggleSavePost, addComment
    │       ├── profileSlice.ts      ← updateName, updateBio, setPaceMode, setColorScheme…
    │       └── authSlice.ts         ← setSupabaseSession, setSupabaseSyncing, syncFromSupabase
    │
    ├── types/
    │   └── index.ts                 ← All TypeScript interfaces (User, Skill, Output, FeedPost, RoadmapEntry, etc.)
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
│   ├── Feed  "Feed"         ← FeedScreen        (tab label "Feed"; screen header "Community")
│   ├── Log   (+ button)     ← LogOutputScreen
│   ├── Map   "Evolve"       ← EvolveScreen     (milestone map, editable custom roadmaps)
│   └── Profile "Profile"   ← ProfileScreen
├── MilestoneDetail (modal, slide_from_bottom) ← MilestoneScreen
├── Settings  (stack)       ← SettingsScreen
└── Portfolio (stack)       ← PortfolioScreen
```

Every screen is wrapped with a per-screen `withScreenBoundary(...)` ErrorBoundary in `AppNavigator.tsx`.
Auth gate: `AppNavigator.tsx` reads `useAppStore((s) => s.hasOnboarded)` and conditionally renders Onboarding or Main. Supabase session listener (`onAuthStateChange`) bootstraps cloud sync on sign-in.

---

## State — `src/store/appStore.ts`

Single Zustand store composed from slices. Static catalog and pure calculators live outside the store; the store imports + re-exports them for backward-compat.

**Static catalog — `src/data/`:**
- `CAREER_PATHS` — **19 paths**, each with color theme + ordered skill IDs
- `ALL_SKILLS` — all skill nodes with prerequisites, XP rewards, required output counts
- `ALL_ACHIEVEMENTS` — **8** achievement definitions with XP grants
- `MOCK_FEED` — seed/PREVIEW community posts (fictional users; labeled non-live)

**Pure progression logic — `src/domain/`:**
- `progression.ts` — `getDecayStage`, `getBurnoutSignal`, `getEvidenceTier`, `getSkillMasteryLevel`, `getCareerMastery`, `OUTCOME_XP`, `calculateOutputXP`, `OUTPUT_XP_BY_TYPE`, `ONBOARDING_XP_GRANT`, `CUSTOM_SKILL_COMPLETION_XP`
- `hydration.ts` — `reconcileAchievementsAndXP()` heals XP + achievements on load
- `skillGraph.ts` — `initUserSkills`, `unlockDependentSkills`, `checkAchievements`, `pathHasProgress`

**Runtime state (selected fields):**
```typescript
hasOnboarded: boolean
supabaseUserId: string | null    // null = not signed in / Supabase disabled
supabaseEmail: string | null
supabaseSyncing: boolean          // true during remote→local sync
user: User | null                 // xp, level, streak, careerPathId, paceMode, lastActiveDate, etc.
userSkills: Record<string, UserSkill>
outputs: Output[]
unlockedAchievementIds: string[]
communityFeed / userFeedPosts: FeedPost[]
customPaths / roadmaps            // custom paths + enrolled roadmap lifecycle
careerOutcomes: CareerOutcome[]
savedPostIds, celebratedMilestones, colorScheme, prioritizedPathId
pendingCelebration, selectedSkillId
```

**Actions (50+ across 5 slices):**
- **Core:** `completeOnboarding`, `logOutput`, `validateSkill`, `logCareerOutcome`, `deleteCareerOutcome`, `deleteOutput`, `togglePinOutput`, `useStreakFreeze`, `clearCelebration`, `resetApp`
- **Roadmap:** `addCustomPath`, `switchPath`, `enrollInRoadmap`, `setPriorityRoadmap`, `pauseRoadmap`, `archiveRoadmap`, `reactivateRoadmap`, `addRoadmapItem`, `isRoadmapEditable`, `forkBuiltInPath`, `addMilestone`, `renameMilestone`, `removeMilestone`, `reorderMilestones`, `lockRoadmap`, `deleteRoadmap`
- **Feed:** `reactToPost`, `toggleSavePost`, `addComment`
- **Profile:** `updateName`, `updateEmail`, `updateBio`, `updateAvatar`, `updateAvatarImage`, `updateTargetRole`, `setPaceMode`, `setComebackGoal`, `setColorScheme`, `dismissWelcomeCard`
- **Auth:** `setSupabaseSession`, `setSupabaseSyncing`, `syncFromSupabase`

**Persistence:** Dual-layer. (1) `localStorage` key `maglakbai_v1` — always-on, fast, offline-capable. Schema-versioned envelope `{ v, data }` with migration chain. (2) Supabase — activated on Magic Link sign-in; `logOutput` and `completeOnboarding` fire-and-forget sync to cloud. `syncFromSupabase()` merges remote on sign-in (remote wins on XP/streak; union on outputs).

---

## Career Paths

**19 built-in paths** in `src/data/careerPaths.ts`. Examples:

| ID | Label | Skills (ordered) |
|---|---|---|
| `data-architect` | Data Architect 🏗️ | SQL Foundations → Python Automation → Snowflake Engineering → Data Modeling → AI Workflow Design |
| `ai-engineer` | AI Engineer 🤖 | Python Fundamentals → REST APIs → Prompt Engineering → Vector Databases → RAG Systems → AI Agents |
| `fullstack` | Full Stack 🌐 | HTML & CSS → JavaScript → React & RN → Backend APIs → Database Design → Cloud Deployment |

Others: `data-engineer`, `ml-engineer`, `backend-engineer`, `frontend-engineer`, `cloud-engineer`, `devops`, `cybersecurity`, `product-manager`, `business-analyst`, `data-analyst`, `project-manager`, `solutions-architect`, `software-architect`, `mobile-developer`, `ui-ux-designer`, `startup-founder`. Users can also create **custom paths** and **fork built-in paths** into editable copies.

Skill status flow: `locked` → `available` → `in_progress` → `completed`

**FEAT-001 — Editable roadmaps:** Custom paths can be edited (add/rename/reorder/remove milestones) only *before the journey starts* (no outputs logged). Once started, structure freezes. To change a started roadmap: Delete & Rebuild. Built-in paths must be forked into an editable copy first.

---

## XP & Leveling

```typescript
ONBOARDING_XP_GRANT = 25        // granted on completeOnboarding (journey started ⚡)
OUTPUT_XP_BY_TYPE = {            // base XP per output type
  project: 75, cert: 200, github: 60, book: 50,
  script: 50, diagram: 75, reflection: 30, event: 65, other: 50
}
qualityBonus = +10 (50+ chars) or +20 (120+ chars)   // description quality
takeawayBonus = +15              // key takeaway provided
skill.xpReward                   // bonus on skill completion (75–400 by rarity)
CUSTOM_SKILL_COMPLETION_XP = 50  // flat bonus for completing a user-defined milestone
achievement.xpGranted            // bonus on achievement unlock
```

Level thresholds live in `getLevelFromXP()` in `src/utils/theme.ts`.

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
Colors.textSub       = '#8888AA'   // use this — not Colors.textSecondary (doc alias only)
Colors.textMuted     = '#44446A'
```

Never hardcode hex values in components — always import from theme.ts.

For the full visual target, open `docs/design/maglakbai-prototype.html` in a browser.

---

## Key Commands

```bash
# Fastest for UI work — web via Vite
npx vite

# Run unit tests (Vitest)
npm test                          # 116 tests, all green

# Production build
npm run build                     # → dist/

# Expo dev server (all platforms)
npx expo start
```

---

## Build Status

### ✅ Already Built (Pilot-Live)
- Onboarding — 5-step flow: welcome → name/email → path → experience level → first output log
  - Beginner path adapted for Fresh Start users (forward-looking framing)
  - 25 XP + streak 1 granted on completion (UX-029)
  - Consent banner shown post-onboarding only (UX-028)
- Career Evolution Map (`EvolveScreen`) with skill nodes + **editable custom roadmaps (FEAT-001)**
  - Fork built-in paths, add/rename/reorder/remove milestones pre-start
  - Focus-lock, Delete & Rebuild for post-start changes
- Dashboard — hero ring, XP bar, streak dots, coaching cards, burnout detection
- Log Output form — **9 output types** (project, cert, github, book, script, diagram, reflect, event, other)
  - XP float animation, evidence-quality indicator, key-takeaway bonus
- XP calculation — per-type base + quality bonus + takeaway bonus + completion rewards
- Level-up logic (10 levels with titles), achievement system (8 achievements)
- Streak system — grace period, freeze mechanic, milestone bonuses (7/14/30-day)
- Milestone celebration + CelebrationOverlay (confetti/animations)
- Community feed (PREVIEW) — 8+ seed posts, emoji reactions, comments, coaching banner
- Profile — stats, XP sources, level progress, achievements, proof gallery, pace mode
- Analytics — PostHog-compatible, opt-in, PII-scrubbed
- **Supabase backend (ARCH-001 — LIVE):**
  - Magic Link auth (no password)
  - Cloud backup of profiles, outputs, skill_progress
  - Settings → Cloud Backup UI
  - Fire-and-forget sync on every logOutput / completeOnboarding
  - Remote→local merge on sign-in (multi-device safe)
- Deployed on **Netlify** (`netlify.toml`) — auto-deploys on `git push main`

### 🔲 Phase 2 — Community + AI
- Live community feed (replace MOCK_FEED with real Supabase queries)
- Follow / unfollow users
- Real weekly XP leaderboard (server-side SUM query)
- Comments + reactions persisted to Supabase
- AI-generated LinkedIn post (OpenAI Edge Function on milestone completion)
- Pace mode gameplay weight (FEAT-002 — Sprint XP multiplier, Recovery streak freeze)

### 🔲 Phase 3 — Identity & Portfolio
- Public profile URL (`maglakbai.app/@username`)
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
- **Web-only gradients:** use `backgroundImage: 'linear-gradient(...)'` with `// @ts-ignore` + always provide a `backgroundColor` fallback. Never use `background:` shorthand (react-native-web rejects it, fires console errors)
- All state reads/writes through `useAppStore` — no shared state in local useState
- New screen → add to `AppNavigator.tsx` (wrap with `withScreenBoundary`) and update the relevant param list type
- New skill/path → update `src/data/careerPaths.ts` and `src/data/skills.ts`
- New achievement → add to `src/data/achievements.ts` and update `checkAchievements()` in `appStore.ts`
- New pure progression logic → add to `src/domain/progression.ts` **with a Vitest test** in `src/domain/__tests__/`
- New store action → add signature to `AppState` in `appStore.ts`, implement in the appropriate slice in `src/store/slices/`, add to the slice's `Pick<>` type

## Do NOT Build
- AI tutoring or course content
- Course marketplace
- DMs / private messaging
- Recruiter marketplace
- Live chat or video
- Push notifications (Phase 3+)
