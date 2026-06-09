# MaglakbAI — Testing

MaglakbAI uses **Vitest** for unit and integration tests. The suite focuses on the logic that *is the product* — XP, leveling, streaks, the evidence gate, achievement unlocks, and the core store actions.

## Running

```bash
npm test          # run once (CI mode)
npm run test:watch # watch mode during development
```

Config: `vitest.config.ts` (Node environment, picks up `src/**/*.test.ts`). No DOM/React Native runtime is needed — tests target pure logic and the headless Zustand store.

## What's covered (46 tests)

### Pure domain — `src/domain/__tests__/`
| Suite | Covers |
|-------|--------|
| `progression.test.ts` | decay stages, burnout sprint-window detection, evidence tiers (verified/documented/logged), per-skill mastery levels, the Beginner→Expert career ladder, `OUTCOME_XP` values |
| `leveling.test.ts` | `getLevelFromXP` thresholds, `getLevelTitle` (incl. clamp >10), `getLevelBounds`, and their mutual consistency at boundaries |
| `skillGraph.test.ts` | `checkAchievements` — every unlock threshold (outputs/skills/streak/XP) + no-duplicate behavior |

### Store-action integration — `src/store/__tests__/`
`appStore.test.ts` exercises the **real store** (no mocks; `resetApp()` isolates each test):
- `completeOnboarding` — user creation + skill-graph init; `experienced` pre-credit
- `logOutput` — XP by output type + quality/takeaway bonuses; the **evidence gate**; skill completion + prerequisite unlock; `first-steps` achievement; streak increment + same-day no-op; no-user guard
- `validateSkill` — completion guard + 50 XP bonus

## Conventions

- **New pure logic in `src/domain/` ships with a test.** Keep calculators pure (data in → data out, no store/React deps) so they stay unit-testable.
- Prefer asserting **observable behavior** (returned `LogOutputResult`, resulting state) over internals.
- Use `resetApp()` to isolate store tests; `useAppStore.setState(...)` to set up specific scenarios (e.g. a yesterday `lastActiveDate` for streak tests).

## Known gaps

- The **roadmap / feed / profile slices** were extracted verbatim during ARCH-002 and are build-verified + type-checked but lack per-action behavioral tests. Adding them is tracked under QA-001.
- No component/render tests yet (screens are large — see ARCH-004). Logic was deliberately pulled into `src/domain` so the highest-value behavior is testable without rendering.

## Verifying a refactor

Because the store actions now have a behavioral net, the safe verification ladder for any store change is:
1. `tsc --noEmit` (types + completeness)
2. `npm test` (behavior)
3. `npm run build` (full module graph compiles/bundles)
