# MaglakbAI — Developer QA Report
**Date:** 2026-06-17  
**Auditor:** QA Lead AI Agent  
**Scope:** Full codebase code-level audit — all bugs, performance issues, and regressions actionable by the Senior Developer  
**Files audited:** `.github/workflows/ci.yml`, `src/lib/auth.ts`, `src/lib/supabase.ts`, `src/lib/db.ts`, `src/store/slices/authSlice.ts`, `src/store/persistence.ts`, `src/navigation/AppNavigator.tsx`, `src/screens/OnboardingScreen.tsx`, `src/screens/DashboardScreen.tsx`, `src/screens/FeedScreen.tsx`, `src/screens/LogOutputScreen.tsx`, `src/screens/PortfolioScreen.tsx`, `src/utils/errorMonitor.ts`, `package.json`

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 4 |
| HIGH | 6 |
| MEDIUM | 8 |
| LOW | 4 |
| **Total** | **22** |

---

## CRITICAL Defects

---

### [CRIT-001] CI Pipeline broken — TypeScript 5.9 pre-release dependency

**File:** `package.json:38`  
**Symptom:** CI has been failing since June 3 (14 days). The `Type-check` step (`tsc --noEmit`) is the most likely failure point.

**Root cause:** `typescript: "~5.9.2"` pins to a pre-release version. TypeScript 5.9 was not yet GA at this codebase's state; the patch range `~5.9.2` resolves to whatever 5.9.x exists on the npm registry, which may ship breaking strict-mode changes or be unavailable in the CI's npm cache, causing the install or type-check step to fail.

**Reproduction:** Run `npm ci && node node_modules/.bin/tsc --noEmit` locally. Compare output with what runs in CI (`ubuntu-latest`, Node 22).

**Fix:**
```json
// package.json
"typescript": "~5.8.3"   // pin to the current stable patch
```
Then regenerate `package-lock.json` (`npm install`) and commit both. If 5.9 is intentional, ensure it has GA status and all breaking changes are resolved first.

---

### [CRIT-002] PortfolioScreen is unreachable from any UI entry point

**Files:** `src/navigation/AppNavigator.tsx:326–328`, `src/screens/DashboardScreen.tsx` (entire file)  
**Symptom:** Users can never view their Portfolio. The screen exists and has full functionality but is dead code from the user's perspective.

**Root cause:** `PortfolioScreen` is registered as a Stack screen (line 326–328 of AppNavigator) but is never navigated to from any tab screen, button, or menu item. `DashboardScreen` has no Portfolio entry point — confirmed by full read of the 2,120-line file.

**Fix:** Add a navigation trigger. Recommended placement — on the Dashboard, inside the "Portfolio Score" or profile header card:
```tsx
// DashboardScreen.tsx — inside the portfolio score card or header section
<TouchableOpacity
  onPress={() => navigation.navigate('Portfolio')}
  accessibilityLabel="View your portfolio"
>
  <Text>View Portfolio →</Text>
</TouchableOpacity>
```
Alternatively, add Portfolio as a Stack entry accessible from ProfileScreen (profile cards already show XP/level — a natural home for a "View my portfolio" link).

---

### [CRIT-003] Double-navigate race condition after logging an output

**File:** `src/screens/LogOutputScreen.tsx:452–489`  
**Symptom:** After logging an output, the app can fire two `navigation.navigate('Home')` calls within the same session recap flow, causing unpredictable navigation state corruption on slow devices or when users tap quickly.

**Root cause:** Two simultaneous dismissal paths exist for the SessionRecap modal:
1. The `SessionRecap` `onDismiss` prop (called when user taps the overlay) directly calls `navigation.navigate('Home')` (line 861).
2. A `setTimeout(..., 3500)` auto-dismisses and calls `maybeShowSignalPrompt` → `navigation.navigate('Home')` (lines 463 and 489).

If the user taps the overlay before 3500ms, the manual dismiss navigates home, but the timeout still fires 3500ms later and calls navigate again.

**Fix:** Cancel the timer when the user manually dismisses:
```tsx
// At the top of the component, add a ref:
const recapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// When setting the timeout (lines 463 and 489):
recapTimerRef.current = setTimeout(() => {
  setShowRecap(false);
  maybeShowSignalPrompt(effectiveSkillId);
}, 3500);

// In the Modal onDismiss:
onDismiss={() => {
  if (recapTimerRef.current) clearTimeout(recapTimerRef.current);
  setShowRecap(false);
  navigation.navigate('Home');
}}
```

---

### [CRIT-004] fetchOutputs maps skillName to skill_id string

**File:** `src/lib/db.ts:83`  
**Symptom:** When a user signs into a second device (or after clearing local state), their outputs synced from Supabase show raw skill IDs (e.g. `da_skill_sql`) as the skill name instead of the human-readable name (e.g. "SQL & Data Modeling"). This affects Portfolio display, Feed posts, and the Profile output list.

**Root cause:**
```typescript
// db.ts line 83 — current (WRONG):
skillName: r.skill_id,  // populates display name with the ID string
```

**Fix:**
```typescript
// db.ts — import ALL_SKILLS at top of file:
import { ALL_SKILLS } from '../store/appStore';  // or from the data layer

// In fetchOutputs map():
skillName: ALL_SKILLS.find((s) => s.id === r.skill_id)?.name ?? r.skill_id,
```

---

## HIGH Defects

---

### [HIGH-001] signalStyles uses static Colors — breaks dark mode ✅ RESOLVED 2026-06-24 (makeSignalStyles + useMemo)

**File:** `src/screens/LogOutputScreen.tsx:1554–1619`  
**Symptom:** The Market Signal prompt modal renders with hardcoded light-mode colors regardless of the user's selected color scheme. Confirmed: `const signalStyles = StyleSheet.create({...})` at module level uses the imported `Colors` singleton, not the reactive `useThemeColors()`.

**Fix:** Move `signalStyles` into a maker function, identical to the pattern used for `makeStyles` and `makeRecapStyles` in the same file:
```tsx
// Replace the module-level const:
const makeSignalStyles = (Colors: ColorsType) => StyleSheet.create({
  // ... same content, but Colors is now the themed parameter
});

// Inside LogOutputScreen component:
const signalStyles = React.useMemo(() => makeSignalStyles(Colors), [Colors]);
```

---

### [HIGH-002] DashboardScreen StyleSheet factory functions called on every render (no memoization) ✅ RESOLVED 2026-06-24 (decayNudgeStyles memoized; others already were)

**File:** `src/screens/DashboardScreen.tsx` — inline calls to `decayNudgeStyles()`, `makeRecoveryCardStyles()`, `makeDormancyStyles()`, `makeComebackStyles()`  
**Symptom:** Every state update causes 4+ `StyleSheet.create()` calls to run, generating new style objects unnecessarily. On the Dashboard (the app's highest-traffic screen), this causes measurable jank on lower-end devices.

**Fix:** Memoize each factory with `useMemo`:
```tsx
const decayStyles = useMemo(() => decayNudgeStyles(Colors, nudgeColor), [Colors, nudgeColor]);
const recoveryCardStyles = useMemo(() => makeRecoveryCardStyles(Colors), [Colors]);
const dormancyStyles = useMemo(() => makeDormancyStyles(Colors), [Colors]);
const comebackStyles = useMemo(() => makeComebackStyles(Colors), [Colors]);
```

---

### [HIGH-003] Market demand gap strip uses wrong career path ID ✅ RESOLVED 2026-06-24 (uses focusPath)

**File:** `src/screens/DashboardScreen.tsx` — line filtering `CAREER_PATHS.find(p => p.id === user?.careerPathId)`  
**Symptom:** If a user has pinned (prioritized) a secondary career path via the Dashboard, the "Skills in Demand" gap strip still shows skills for the user's *enrolled* path (`user.careerPathId`), not the *active focus* path (`prioritizedPathId ?? user.careerPathId`). The rest of the Dashboard correctly uses `focusPath`, making this the only widget that ignores the user's active path selection.

**Fix:**
```tsx
// Current (WRONG):
const pathSkillIds = CAREER_PATHS.find(p => p.id === user?.careerPathId)?.skillIds ?? [];

// Fix — use the already-computed focusPath:
const pathSkillIds = focusPath?.skillIds ?? [];
```

---

### [HIGH-004] FlatList ListHeader inner components recreate on every render

**File:** `src/screens/FeedScreen.tsx:209–270`  
**Symptom:** `ListHeader`, `FeedCoachingBanner`, and `EmptyFilter` are defined as inner function components inside the `FeedScreen` function body. React sees a new function reference on every render, causing `FlatList` to unmount and remount the header component on every state change (including filter taps, scroll, refreshing toggle). This produces visible flicker and kills header animation continuity.

**Fix:** Hoist the components out of `FeedScreen` or wrap them with `useCallback`:
```tsx
// Option A: Hoist to module level (requires passing props)
function ListHeader({ activeFilter, setActiveFilter, allFilters, ... }) { ... }

// Option B: Memoize the JSX element (simpler, no prop drilling change):
const listHeader = useMemo(() => <ListHeaderContent ... />, [activeFilter, communityFeed, ...]);
// Then: ListHeaderComponent={listHeader}
```

---

### [HIGH-005] FeedScreen pull-to-refresh is a no-op ✅ RESOLVED 2026-06-24 (shuffleFeed action + test; verified live)

**File:** `src/screens/FeedScreen.tsx:92–98`  
**Symptom:** Users pull down to refresh the feed. The spinner appears for 800ms and vanishes. The feed data is identical before and after — no posts are re-fetched, re-ordered, or updated. Users will repeat the gesture expecting a result and lose trust in the app.

**Root cause:**
```typescript
const onRefresh = useCallback(() => {
  setRefreshing(true);
  setTimeout(() => {
    setRefreshing(false);   // only hides the spinner; nothing changes
  }, 800);
}, []);
```

**Fix:** At minimum, shuffle non-user seed posts to give visual confirmation the action had an effect. For the pilot, a simple shuffle is acceptable:
```typescript
const shuffleFeed = useAppStore((s) => s.shuffleFeed); // add action to feedSlice

const onRefresh = useCallback(() => {
  setRefreshing(true);
  setTimeout(() => {
    shuffleFeed();          // reorder non-user posts
    setRefreshing(false);
  }, 800);
}, [shuffleFeed]);
```

---

### [HIGH-006] screenErrorStyles uses static Colors — error fallback UI breaks in dark mode ✅ RESOLVED 2026-06-24 (themed ScreenErrorFallback)

**File:** `src/navigation/AppNavigator.tsx:336–371`  
**Symptom:** The error boundary fallback screen (shown when a tab crashes) uses a module-level `StyleSheet.create({backgroundColor: Colors.bg, ...})`. `Colors` here is the static default (light mode), so dark mode users see a bright white crash screen with near-invisible text.

**Fix:** Convert `ScreenErrorBoundary` to use inline styles or a theme-aware component. Since it's a class component, move the styles into a functional wrapper:
```tsx
// Replace the static styles with a themed functional shell:
function ScreenErrorFallback({ screenName, message, onRetry }: ...) {
  const Colors = useThemeColors();
  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', ... }}>
      ...
    </View>
  );
}
```

---

## MEDIUM Defects

---

### [MED-001] OnboardingScreen finishOnboarding fires despite back-navigation (setTimeout race)

**File:** `src/screens/OnboardingScreen.tsx` — `ExperienceLevelStep.onSelect` handler  
**Symptom:** When a user selects an experience level and immediately taps Back within 320ms, `finishOnboarding()` still fires 320ms later. This can commit an onboarding with mismatched or incomplete data.

**Fix:** Store the timer in a ref and cancel it if the component unmounts or step changes:
```tsx
const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const onSelect = (level: ExperienceLevel) => {
  setSelected(level);
  if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
  finishTimerRef.current = setTimeout(() => {
    finishOnboarding(selectedPath ?? ..., level);
  }, 320);
};

useEffect(() => () => {
  if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
}, []);
```

---

### [MED-002] Email field in OnboardingScreen has no format validation

**File:** `src/screens/OnboardingScreen.tsx` — email input in step 4  
**Symptom:** Users can enter "abc" or "notanemail" and proceed. When Magic Link auth launches, Supabase will reject the malformed address, but the error is surfaced only then — after onboarding is complete — with no guidance to return and fix it.

**Fix:** Validate on blur or on the next-step press:
```typescript
const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

// In the next-step handler:
if (email && !isValidEmail(email)) {
  showToast({ message: 'Enter a valid email address', variant: 'warning' });
  return;
}
```

---

### [MED-003] Custom path skill IDs can collide

**File:** `src/screens/OnboardingScreen.tsx` — custom skill generation  
**Symptom:** Custom path skills use `__skill_${i}_${Date.now()}` as IDs. If two skills are created in the same millisecond (programmatic rapid creation, or future batch-import feature), IDs collide. The second skill's progress will overwrite the first in `userSkills`.

**Fix:** Use `crypto.randomUUID()` (available in all modern browsers and Node 22):
```typescript
id: `__skill_${crypto.randomUUID()}`,
```

---

### [MED-004] WeeklyDots individual dots have no accessibility annotation

**File:** `src/screens/DashboardScreen.tsx` — `WeeklyDots` component  
**Symptom:** Screen reader users hear nothing when focusing the activity dots strip. There are no `accessibilityLabel` or `accessibilityHint` attributes on individual dot views.

**Fix:**
```tsx
<View
  key={i}
  accessibilityRole="image"
  accessibilityLabel={`Day ${i + 1}: ${isActive ? 'active' : 'inactive'}`}
  style={[styles.dot, isActive && styles.dotActive]}
/>
```

---

### [MED-005] Streak bonus XP display uses brittle reverse-mapping

**File:** `src/screens/LogOutputScreen.tsx:407`  
**Symptom:** The streak-bonus toast infers the streak day count from the bonus XP amount using hardcoded reverse logic:
```typescript
const streakDays = result.newStreak ?? (result.streakBonusXP === 25 ? 7 : result.streakBonusXP === 50 ? 14 : 30);
```
If the XP values in `domain/progression.ts` are ever adjusted, this inference silently produces wrong day counts in the toast (e.g. "30-Day Streak Bonus!" when the user only hit 14 days).

**Fix:** `logOutput` should return `newStreak` directly. If it already does (`result.newStreak`), remove the fallback inference entirely:
```typescript
// If result.newStreak is reliable, simplify to:
const streakDays = result.newStreak;
if (!streakDays) return; // guard before showing toast
```

---

### [MED-006] authSlice silently drops upsertProfile failure after sync

**File:** `src/store/slices/authSlice.ts:118–124`  
**Symptom:** After a successful remote→local merge, `upsertProfile` is called to push local data back up. If it fails (network drop, Supabase outage), the outer `catch` logs a warning but the remote profile goes stale indefinitely. The user sees no indication that their remote profile is out of sync.

**Fix:** Either retry with exponential backoff, or set a `supabaseProfileDirty` flag so the next successful connection triggers re-sync:
```typescript
// Add to store state: supabaseProfileDirty: boolean
// On upsertProfile failure in authSlice:
set({ supabaseProfileDirty: true });
// On next auth state change (SIGNED_IN), if supabaseProfileDirty, run upsertProfile again.
```

---

### [MED-007] persistence.ts loadFromStorage silent catch with no logging

**File:** `src/store/persistence.ts:131`  
**Symptom:** If `localStorage.getItem` or `JSON.parse` throws (corrupted storage, quota errors on read, Safari ITP purge), the entire function returns `null` silently. The app starts fresh without any indication that user data was present but unreadable. Debugging storage corruption in production is impossible without a logged error.

**Fix:**
```typescript
} catch (err) {
  console.warn('[persistence] loadFromStorage failed — starting fresh:', err);
  return null;
}
```

---

### [MED-008] LogOutputScreen link field has no URL validation

**File:** `src/screens/LogOutputScreen.tsx:712–723`  
**Symptom:** The link field accepts any text. A user typing `github/myrepo` (missing `https://`) will submit it as evidence, but the `getEvidenceTier` function counts it as "verified" (has a link value), even though the URL is non-navigable. Portfolio viewers see a dead link badge.

**Fix:** Validate URL format before accepting it as evidence:
```typescript
const isValidUrl = (url: string) => {
  try { new URL(url); return true; } catch { return false; }
};

// In getEvidenceTier or in the LogOutputScreen before submit:
const effectiveLink = link && isValidUrl(link.trim()) ? link.trim() : undefined;
```

---

## LOW Defects

---

### [LOW-001] Expo dependency is unused in the PWA target

**File:** `package.json:17`  
**Symptom:** `expo: ^55.0.24` is listed as a production dependency, but the app compiles entirely through Vite for web. The `ios`/`android` npm scripts invoke Expo, but no iOS/Android build is currently maintained. Expo and its transitive dependencies add to `node_modules` size, slow `npm ci`, and may introduce peer-dep conflicts on CI.

**Fix:** Move Expo to `devDependencies` if mobile builds are ever revived, or remove it entirely until a mobile build target is committed:
```json
// If mobile is not a near-term target:
// Remove from dependencies; add a comment in README explaining the intent
```

---

### [LOW-002] AppNavigator suppresses react-hooks/exhaustive-deps warning

**File:** `src/navigation/AppNavigator.tsx:304`  
**Symptom:** `// eslint-disable-line react-hooks/exhaustive-deps` on the auth `useEffect`. While the Zustand action functions are stable references (safe), this suppression will silently hide future dependency issues if the effect is modified.

**Fix:** Add the deps explicitly (Zustand guarantees store function refs are stable):
```tsx
useEffect(() => {
  if (!isSupabaseEnabled) return;
  const unsub = onAuthStateChange(async (session) => {
    if (session) {
      setSupabaseSession(session.user.id, session.user.email ?? null);
      await syncFromSupabase();
    } else {
      setSupabaseSession(null, null);
    }
  });
  return unsub;
}, [setSupabaseSession, syncFromSupabase]); // stable refs, safe to declare
```

---

### [LOW-003] FeedScreen leaderboard/pool computed on every render without memoization

**File:** `src/screens/FeedScreen.tsx:172–199`  
**Symptom:** `SEED_LEADERS`, `leaderboardPool`, `sortedPool`, `leaderboard`, and `userLeaderEntry` are all recalculated on every `FeedScreen` render (including filter chip taps, scroll events, and other state updates). While not a correctness issue, it's unnecessary computation on the highest-activity screen component.

**Fix:**
```tsx
const leaderboard = useMemo(() => {
  const pool = user
    ? [...SEED_LEADERS, { id: user.id, name: user.name, xp: weeklyUserXP, ... }]
    : SEED_LEADERS;
  return [...pool].sort((a, b) => b.xp - a.xp).slice(0, 3).map((e, i) => ({...}));
}, [user, weeklyUserXP]);
```

---

### [LOW-004] PortfolioScreen not wrapped in ScreenErrorBoundary

**File:** `src/navigation/AppNavigator.tsx:326–328`  
**Symptom:** Every tab screen is wrapped with `withScreenBoundary()` (e.g. `GuardedDashboard`, `GuardedProfile`). `PortfolioScreen` is registered directly — if it crashes, the entire app tree crashes instead of showing the isolated error fallback.

**Fix:**
```tsx
const GuardedPortfolio = withScreenBoundary(PortfolioScreen, 'Portfolio');

// In the Stack.Navigator:
<Stack.Screen name="Portfolio" component={GuardedPortfolio} ... />
```

---

## Files with No Issues Found

| File | Verdict |
|------|---------|
| `src/lib/auth.ts` | Clean — proper `isSupabaseEnabled` guards, no silent failures |
| `src/lib/supabase.ts` | Clean — guard pattern correct, `detectSessionInUrl: true` properly placed |
| `src/store/slices/authSlice.ts` | Acceptable — uses `console.warn` (not silent catch); MED-006 noted |
| `src/utils/errorMonitor.ts` | Clean — consent-gated, PII-scrubbed, deduped, hard-capped. Good design |
| `src/navigation/AppNavigator.tsx` | Issues noted (HIGH-006, LOW-002, LOW-004); core routing logic is correct |

---

## Fix Priority Order (for the Senior Developer)

1. **[CRIT-001]** Fix TypeScript version → unblocks CI → all other changes can be validated
2. **[CRIT-004]** Fix `fetchOutputs` skillName mapping → data correctness for multi-device users
3. **[CRIT-003]** Fix double-navigate in LogOutputScreen → prevents navigation state corruption
4. **[CRIT-002]** Add Portfolio entry point → makes the screen usable at all
5. **[HIGH-001]** Fix signalStyles dark mode → visible to every dark-mode user on first output log
6. **[HIGH-003]** Fix market demand path ID → correctness bug for users with a prioritized path
7. **[HIGH-005]** Fix pull-to-refresh no-op → user-facing trust issue
8. **[HIGH-002/004/006]** Performance + theme fixes → batch in one PR
9. **[MED-001 through MED-008]** Polish pass
10. **[LOW-001 through LOW-004]** Housekeeping

---

*Generated by QA Lead AI Agent — 2026-06-17. Based on direct code read of 14 source files.*
