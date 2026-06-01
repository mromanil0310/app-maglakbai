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
| State | Zustand (single store — `src/store/appStore.ts`) |
| Styling | StyleSheet.create() with design tokens in `src/utils/theme.ts` |
| Web bundler | Vite (for fast web dev), Metro (for native) |
| Persistence | localStorage via `src/utils/asyncStorageWeb.ts` |
| Backend | **Not yet integrated** — Supabase planned (see `docs/DATABASE.md`) |
| AI | **Not yet integrated** — OpenAI Edge Function planned (see `docs/ARCHITECTURE.md`) |

---

## Project Structure

```
SkillForge/
├── CLAUDE.md                        ← you are here
├── App.tsx                          ← root component: SafeAreaProvider + ErrorBoundary + AppNavigator
├── index.ts                         ← Expo entry point (registerRootComponent)
├── index.html                       ← Vite web entry HTML (loads web-index.tsx)
├── web-index.tsx                    ← Vite web entry (renders App into #root)
├── vite.config.ts                   ← Vite config (aliases react-native → react-native-web)
├── babel.config.js                  ← Babel config for Expo
├── tsconfig.json                    ← TypeScript strict config
├── app.json                         ← Expo project config
├── package.json
│
├── scripts/                         ← Dev helper scripts (not imported by app source)
│   ├── start-web.js                 ← Metro web server without Expo CLI TTY
│   ├── start-web.sh
│   ├── start-vite.sh
│   └── metro-web-server.js
│
├── docs/                            ← Product & architecture documentation
│   ├── PRD.md                       ← Full product requirements & feature specs
│   ├── DATABASE.md                  ← Supabase schema design (planned integration)
│   ├── ARCHITECTURE.md              ← Tech decisions, animation patterns, Edge Function
│   └── design/
│       └── skillforge-prototype.html  ← Interactive UI prototype — open in browser for visual reference
│
└── src/
    ├── components/
    │   ├── AchievementBadge.tsx     ← Rarity badge chip (common/rare/epic/legendary)
    │   ├── CareerNode.tsx           ← Individual skill node on the evolution map
    │   ├── CelebrationOverlay.tsx   ← Full-screen confetti + mascot overlay (Home screen)
    │   ├── FeedCard.tsx             ← Community feed post card with reactions
    │   ├── Toast.tsx                ← XP feedback toast notification
    │   └── XPBar.tsx                ← Animated XP progress bar
    │
    ├── navigation/
    │   └── AppNavigator.tsx         ← Root: Onboarding → Main tabs → MilestoneDetail modal
    │
    ├── screens/
    │   ├── OnboardingScreen.tsx     ← 4-step onboarding: welcome → name → path → first output
    │   ├── DashboardScreen.tsx      ← Home tab: path ring, XP bar, empty-state coaching, next action
    │   ├── EvolveScreen.tsx         ← Evolve tab: milestone map, path switcher, custom roadmap modal
    │   ├── LogOutputScreen.tsx      ← Log a proof-of-work output (6 types + XP float animation)
    │   ├── MilestoneScreen.tsx      ← Skill completion celebration (bottom-sheet modal + share)
    │   ├── FeedScreen.tsx           ← Community feed + leaderboard + coaching banner
    │   └── ProfileScreen.tsx        ← User profile + XP bar + achievements + proof-of-work gallery
    │
    ├── store/
    │   └── appStore.ts              ← Zustand store: all state, actions, and static catalog data
    │
    ├── types/
    │   └── index.ts                 ← All TypeScript interfaces (User, Skill, Output, FeedPost, etc.)
    │
    └── utils/
        ├── analytics.ts             ← PostHog-compatible event tracking (set VITE_POSTHOG_API_KEY)
        ├── asyncStorageWeb.ts       ← localStorage shim for Vite/web (aliased in vite.config.ts)
        └── theme.ts                 ← Colors, typography tokens, getLevelFromXP(), getLevelTitle()
```

---

## Navigation Structure

```
Stack.Navigator (headerShown: false, animation: fade)
├── Onboarding          ← OnboardingScreen  (shown when hasOnboarded === false)
└── Main                ← Bottom Tab Navigator
    ├── Home  "Home"         ← DashboardScreen  (path ring, XP bar, coaching)
    ├── Feed  "Community"    ← FeedScreen
    ├── Log   (+ button)     ← LogOutputScreen
    ├── Map   "Evolve"       ← EvolveScreen     (milestone map, custom roadmaps)
    └── Profile "Profile"   ← ProfileScreen
MilestoneDetail (modal, slide_from_bottom) ← MilestoneScreen
```

Auth gate: `AppNavigator.tsx` reads `useAppStore((s) => s.hasOnboarded)` and conditionally renders Onboarding or Main.

---

## State — `src/store/appStore.ts`

Single Zustand store. All app state lives here.

**Static catalog (defined at top of appStore.ts, not in DB yet):**
- `CAREER_PATHS` — 3 paths with color themes and ordered skill IDs
- `ALL_SKILLS` — all skill nodes with prerequisites, XP rewards, and required output counts
- `ALL_ACHIEVEMENTS` — achievement definitions with XP grants
- `MOCK_FEED` — seed community posts (7 realistic posts from fictional users)

**Runtime state:**
```typescript
hasOnboarded: boolean
user: User | null                          // xp, level, streak, careerPathId, avatarEmoji, etc.
userSkills: Record<string, UserSkill>      // per-skill: status + outputCount
outputs: Output[]                          // all logged proof-of-work items
unlockedAchievementIds: string[]
communityFeed: FeedPost[]                  // mock + user's own posts prepended
pendingCelebration: PendingCelebration | null   // set → triggers MilestoneDetail modal
selectedSkillId: string | null
```

**Key actions:**
```typescript
completeOnboarding(name, pathId)    // creates User, initializes userSkills from path
logOutput(payload)                  // awards XP, checks skill completion, checks achievements,
                                    // prepends to feed, sets pendingCelebration if skill done
reactToPost(postId, emoji)          // toggle reaction (optimistic, no backend)
clearCelebration()                  // call after MilestoneScreen dismisses
resetApp()                          // clears localStorage, resets to onboarding state
```

**Persistence:** `localStorage` key `skillforge_v1`. Saves: `hasOnboarded`, `user`, `userSkills`, `outputs`, `unlockedAchievementIds`.

---

## Career Paths

| ID | Label | Skills (ordered) |
|---|---|---|
| `data-architect` | Data Architect 🏗️ | SQL Foundations → Python Automation → Snowflake Engineering → Data Modeling → AI Workflow Design |
| `ai-engineer` | AI Engineer 🤖 | Python Fundamentals → REST APIs → Prompt Engineering → Vector Databases → RAG Systems → AI Agents |
| `fullstack` | Full Stack 🌐 | HTML & CSS → JavaScript → React & RN → Backend APIs → Database Design → Cloud Deployment |

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
```

---

## Build Status

### ✅ Already Built (Pilot-Ready)
- Onboarding — 4-step flow: welcome → name → path selection → first output log
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
- Achievement system (7 achievements including streak-based ones)
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
- New screen → add to `AppNavigator.tsx` and update the relevant param list type
- New skill/path → update `CAREER_PATHS` and `ALL_SKILLS` in `appStore.ts`
- New achievement → add to `ALL_ACHIEVEMENTS` and update `checkAchievements()` in `appStore.ts`

## Do NOT Build
- AI tutoring or course content
- Course marketplace
- DMs / private messaging
- Recruiter marketplace
- Live chat or video
- Push notifications (Phase 3+)
