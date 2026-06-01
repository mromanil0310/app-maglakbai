---
name: skillforge-daily-qa
category: App Dev
description: Daily QA and improvement pass on the SkillForge app. Audits the codebase, fixes the top bug or implements the highest-priority backlog item, rebuilds, and serves the updated app.
schedule: Mon–Fri at 9:00 AM
status: Active
---

You are performing a daily QA audit and improvement pass on the SkillForge app — a "Strava for professional growth" PWA built with React Native Web, Vite, Zustand, and React Navigation.

## App context
- Root: /Users/marloromanillos/Documents/Claude/Projects/App_SkillForge
- Build command: see Build Notes below (FUSE mount workaround required)
- Live URL: http://192.168.123.37:8083
- Storage key: skillforge_v1 (do NOT rename)
- Backlog report: /Users/marloromanillos/Documents/Claude/Projects/App_SkillForge/reports/skillforge-audit-report.md
- Stack: React Native Web · Vite 5 · React Navigation v7 · Zustand · TypeScript strict

## Screen map
- src/screens/DashboardScreen.tsx — Home tab (🏠)
- src/screens/FeedScreen.tsx — Community tab (🌐)
- src/screens/LogOutputScreen.tsx — Log tab (➕)
- src/screens/EvolveScreen.tsx — Evolve tab (⚡)
- src/screens/ProfileScreen.tsx — Profile tab (👤)
- src/screens/OnboardingScreen.tsx — 4-step onboarding
- src/screens/MilestoneScreen.tsx — stack modal after skill completion
- src/store/appStore.ts — Zustand store
- src/utils/theme.ts — design tokens
- src/navigation/AppNavigator.tsx — navigation structure

---

## Step 1 — Read the current backlog report
Read /Users/marloromanillos/Documents/Claude/Projects/App_SkillForge/reports/skillforge-audit-report.md if it exists. This is the running record of what's been fixed, what's pending, and what was discovered on previous runs. If the file doesn't exist yet, start fresh.

## Step 2 — Audit the codebase
Read the source files, focusing on:
1. All screen files — look for TODO comments, broken states, empty states without CTAs, UX dead-ends, hardcoded data
2. src/store/appStore.ts — missing actions, stale logic, data gaps
3. src/navigation/AppNavigator.tsx — routing gaps
4. Check the Open Bugs section of the backlog report — verify each is still present or mark fixed

## Step 3 — Choose one improvement
Pick the single highest-priority item: either fix the most critical bug found, or implement the most valuable missing feature. Be opinionated — don't ask, just decide. Prioritize:
1. Broken / crashes (silent nulls, dead-ends)
2. UX dead-ends (action with no result)
3. Missing feedback (no visual confirmation)
4. Visual polish / empty states
5. Feature gaps from the backlog report (read it first — it has the current priority order)

## Step 4 — Implement
Make the change. Implementation rules:
- Web-compatible styles only — use `// @ts-ignore` for CSS properties like `background: 'linear-gradient(...)'`, `boxShadow`, `backdropFilter`. Always provide a fallback `backgroundColor`.
- Animations must use `useNativeDriver: false`
- Initial animated values should start at 1 (visible) for entry animations
- Safe area on iPhone: use `env(safe-area-inset-bottom, Npx)` via `// @ts-ignore`
- Do NOT break existing navigation — tab names (Home, Feed, Log, Map, Profile) and stack names (Onboarding, Main, MilestoneDetail) must remain stable
- Keep store key `skillforge_v1`
- If touching appStore.ts, update saveToStorage and loadFromStorage to persist new state

## Step 5 — Build
The Vite build cannot run directly on the FUSE-mounted workspace (unlink permission error). Use this workaround:

```bash
# 1. Copy source to tmp (skip node_modules and dist)
mkdir -p /tmp/sf_today
for item in App.tsx index.ts index.html web-index.tsx vite.config.ts babel.config.js tsconfig.json app.json package.json public src; do
  cp -r /sessions/*/mnt/App_SkillForge/$item /tmp/sf_today/ 2>/dev/null || true
done
ln -sfn /sessions/*/mnt/App_SkillForge/node_modules /tmp/sf_today/node_modules

# 2. Build to tmp output
cd /tmp/sf_today && node node_modules/.bin/vite build --outDir /tmp/sf_dist_today 2>&1

# 3. Sync assets back to workspace
cp /tmp/sf_dist_today/index.html /sessions/*/mnt/App_SkillForge/dist/index.html
cp /tmp/sf_dist_today/assets/* /sessions/*/mnt/App_SkillForge/dist/assets/
```

Fix any TypeScript or Vite errors before proceeding. Do not report success until the build output shows `✓ built`.

## Step 6 — Serve
```bash
cat > /tmp/serve_sf.js << 'SERVEOF'
const http = require('http');
const fs = require('fs');
const path = require('path');
const distDir = '/sessions/SESSIONID/mnt/App_SkillForge/dist';
const PORT = 8083;
const mime = { '.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.ico':'image/x-icon','.svg':'image/svg+xml','.json':'application/json' };
const server = http.createServer((req, res) => {
  let fp = path.join(distDir, req.url === '/' ? 'index.html' : req.url);
  if (!fs.existsSync(fp)) fp = path.join(distDir, 'index.html');
  res.setHeader('Content-Type', mime[path.extname(fp)] || 'text/plain');
  fs.createReadStream(fp).pipe(res);
});
server.listen(PORT, '0.0.0.0', () => console.log(`Serving at http://192.168.123.37:${PORT}`));
SERVEOF
node /tmp/serve_sf.js &
sleep 2
curl -s -o /dev/null -w "%{http_code}" http://localhost:8083/
```

Replace SESSIONID with the actual session directory name (find it via `ls /sessions/`).

## Step 7 — Update the backlog report
Write an updated version of /Users/marloromanillos/Documents/Claude/Projects/App_SkillForge/reports/skillforge-audit-report.md.

The report must follow this structure:

```markdown
# SkillForge Audit Report
_Last updated: [YYYY-MM-DD]_

## ✅ Fixed
<!-- Items confirmed resolved, newest first -->
- [YYYY-MM-DD] **[Item name]** — brief description of what was fixed and which file(s) changed

## 🔴 Open Bugs
<!-- Confirmed bugs blocking the core loop, highest severity first -->
- **[Bug name]** — description, file(s) affected, severity

## 🟡 Backlog
<!-- Features and improvements not yet started, in priority order -->
- **[Item name]** — description

## 📓 Run Log
<!-- One entry per daily run, newest first -->
### [YYYY-MM-DD]
- Improvement made: [what was implemented]
- Files changed: [list]
- Notes: [anything notable discovered]
```

Preserve all previous entries. Only move items from Open Bugs or Backlog to Fixed once the fix is confirmed in a successful build. Add today's run to the Run Log.

## Step 8 — Report
Summarize the run concisely:

```
✅ Improved: <what you changed, 1–2 sentences>

📁 Files changed:
  - src/screens/XxxScreen.tsx
  - src/store/appStore.ts  (if applicable)

📋 Backlog updated: skillforge-audit-report.md

🔗 Live at: http://192.168.123.37:8083

⏭️  Next up: <the next highest-priority item>
```
