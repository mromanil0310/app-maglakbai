# ADR-0002 — Extract static catalog (`src/data`) and pure logic (`src/domain`)

**Status:** Accepted (2026-06-02)

## Context
The store file inlined ~2,600 lines of static catalog (`CAREER_PATHS`, `ALL_SKILLS`, `ALL_ACHIEVEMENTS`, `MOCK_FEED`) plus pure calculators (decay, burnout, evidence tier, mastery, achievement unlocks) and skill-graph helpers. None of it was independently importable or unit-testable, and it dominated the file's size.

## Decision
- Move static catalog → `src/data/{careerPaths,skills,achievements,mockFeed}.ts` (pure data, type-only imports).
- Move pure calculators → `src/domain/progression.ts`; skill-graph/achievement helpers → `src/domain/skillGraph.ts`.
- `appStore.ts` imports and **re-exports** the moved symbols so existing `from '../store/appStore'` imports in screens are unchanged.

## Consequences
- Pure logic is now unit-tested in isolation (`src/domain/__tests__`).
- Store shrank dramatically; data edits no longer touch the store.
- Trade-off: presentation metadata that needs theme `Colors` (e.g. `MASTERY_TIERS`) stays in `appStore.ts`, so mastery presentation and mastery logic live in different files. Accepted.
