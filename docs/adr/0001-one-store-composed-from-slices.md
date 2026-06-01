# ADR-0001 — One Zustand store, composed from slices

**Status:** Accepted (2026-06-02, formalizing a decision in force since the ARCH-002 refactor)

## Context
SkillForge state is deeply interrelated: `logOutput` mutates skills, XP, achievements, streak, and the feed in a single user action. The store had grown into a single ~4,400-line file (the "god object", ARCH-002), which was hard to review and merge. Per-domain *stores* were considered but would require cross-store subscriptions to keep one action's effects consistent.

## Decision
Keep **one** Zustand store, but split the **actions** into cohesive slice creators (`core`, `roadmap`, `feed`, `profile`) combined in `create()` via `...createXSlice(set, get)`. State initialization stays in `appStore.ts` so `tsc` enforces a complete `AppState`.

## Consequences
- Transaction model unchanged — actions still read full state via `get()` / update via `set()`.
- `appStore.ts` reduced to ~270 lines (state init + composition + wiring).
- Slices are cohesive and individually reviewable.
- Trade-off: actions live across files; the slices pattern adds a small amount of wiring boilerplate. Accepted for the maintainability gain.
