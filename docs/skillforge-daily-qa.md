---
name: skillforge-daily-qa
category: App Dev
description: Daily QA and improvement pass on the SkillForge app. Audits the codebase, fixes the top bug or implements the highest-priority backlog item, rebuilds, and serves the updated app.
schedule: Mon–Fri at 9:00 AM
status: Active
---

You are performing a daily QA audit and improvement pass on the SkillForge app — a skill gamification PWA ("Level up through proof, not promises.") built with React Native Web, Vite, Zustand, and React Navigation. Open to any skill, any field, any level — not just tech professionals.

## App context
- Root: /Users/marloromanillos/Documents/Claude/Projects/App_SkillForge
- Live URL (production): https://fascinating-kitten-b6a79d.netlify.app
- Local dev: `npx vite` → http://localhost:8082
- Storage key: skillforge_v1 (do NOT rename)
- Backlog report: /Users/marloromanillos/Documents/Claude/Projects/App_SkillForge/reports/skillforge-audit-report.md
- Stack: React Native Web · Vite 5 · React Navigation v7 · Zustand · TypeScript strict · Supabase (live backend)
- Tests: 94 passing — run via `npm test` (Vitest)
- Deploy: Netlify auto-deploys on `git push main`

## Screen map
- src/screens/DashboardScreen.tsx — Home tab (🏠)
- src/screens/FeedScreen.tsx — Feed tab (🌐) — tab label "Feed", screen header "Community"
- src/screens/LogOutputScreen.tsx — Log tab (➕) — 9 output types
- src/screens/EvolveScreen.tsx — Evolve tab (⚡) — milestone map + editable custom roadmaps (FEAT-001)
- src/screens/ProfileScreen.tsx — Profile tab (👤)
- src/screens/OnboardingScreen.tsx — 5-step onboarding (welcome → name/email → path → experience level → first output)
- src/screens/MilestoneScreen.tsx — stack modal after skill completion
- src/screens/SettingsScreen.tsx — settings + Cloud Backup (Magic Link auth)
- src/store/appStore.ts — Zustand store (state + slice composition)
- src/store/slices/ — coreSlice, roadmapSlice, feedSlice, profileSlice, authSlice
- src/lib/ — supabase.ts, auth.ts, db.ts (Supabase client + helpers)
- src/utils/theme.ts — design tokens (Colors.textSub, not Colors.textSecondary)
- src/navigation/AppNavigator.tsx — navigation structure + Supabase auth session listener

---

## Step 1 — Read the current backlog report
Read /Users/marloromanillos/Documents/Claude/Projects/App_SkillForge/reports/skillforge-audit-report.md. This is the BAEF-governed source of truth for open items, priorities, and run history. Focus on the **Open Items** table at the top and the **Recommended sequence**.

## Step 2 — Audit the codebase
Read the source files, focusing on:
1. All screen files — TODO comments, broken states, empty states without CTAs, UX dead-ends, hardcoded data
2. src/store/slices/ — missing actions, stale logic, data gaps
3. src/lib/ — Supabase sync correctness
4. src/navigation/AppNavigator.tsx — routing gaps
5. The Open Items in the backlog report — verify each is still present or mark fixed

## Step 3 — Choose one improvement
Pick the single highest-priority item from the backlog's **Recommended sequence**. Be opinionated — don't ask, just decide. Prioritize:
1. P1 items (blocking public launch)
2. P2 items in the recommended sequence
3. Broken / crashes (silent nulls, dead-ends)
4. UX dead-ends (action with no result)
5. Missing feedback (no visual confirmation)
6. Visual polish / empty states

## Step 4 — Implement
Make the change. Implementation rules:
- Web-compatible styles only
- **Gradients:** use `backgroundImage: 'linear-gradient(...)'` with `// @ts-ignore` — NEVER `background:` shorthand (react-native-web rejects it, fires console errors). Always provide a fallback `backgroundColor`.
- `boxShadow`, `backdropFilter` — use `// @ts-ignore`
- Animations must use `useNativeDriver: false`
- Safe area on iPhone: use `env(safe-area-inset-bottom, Npx)` via `// @ts-ignore`
- Do NOT break existing navigation — tab names (Home, Feed, Log, Map, Profile) and stack names (Onboarding, Main, MilestoneDetail) must remain stable
- Keep store key `skillforge_v1`
- New store action → add to AppState interface + appropriate slice + slice Pick<> type
- New pure logic → add to src/domain/ with a Vitest test
- Run `npm test` before declaring success — all 94 tests must pass

## Step 5 — Build
On the local Mac, `npm run build` works directly (no workaround needed):

```bash
cd /Users/marloromanillos/Documents/Claude/Projects/App_SkillForge
npm test          # must be green first
npm run build     # → dist/
```

If running in the Claude Code sandbox (FUSE mount), build to a temp dir:
```bash
node node_modules/.bin/vite build --outDir /tmp/sf_dist_today --emptyOutDir
```

Fix any TypeScript or Vite errors before proceeding. Do not report success until the build output shows `✓ built`.

## Step 6 — Update the backlog report
Update /Users/marloromanillos/Documents/Claude/Projects/App_SkillForge/reports/skillforge-audit-report.md:
- Mark resolved items with ✅ + sprint number
- Add a new Run Log entry (newest first) with: what was done, files changed, test count, build status
- Update the Open Items table count
- Update the Last updated header line

## Step 7 — Commit (do NOT push — owner pushes manually)
```bash
git add <changed files>
git commit -m "fix/feat: <description>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
Never `git push` — the owner does that.

## Step 8 — Report
Summarize the run concisely:

```
✅ Improved: <what you changed, 1–2 sentences>

📁 Files changed:
  - src/screens/XxxScreen.tsx
  - src/store/slices/xxxSlice.ts  (if applicable)

🧪 Tests: 94/94 (or N/N if count changed)
🏗  Build: ✓

📋 Backlog updated: reports/skillforge-audit-report.md

⏭️  Next up: <the next highest-priority item from the recommended sequence>
```
