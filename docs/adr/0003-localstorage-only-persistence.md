# ADR-0003 — localStorage-only persistence for the pilot

**Status:** Accepted (pilot) — to be superseded by the Phase 2 Supabase ADR

## Context
The pilot has no backend. User progress must persist across reloads on a single device with zero infrastructure. A full auth + database (Supabase) is planned for Phase 2 but is out of scope for validating the core loop.

## Decision
Persist a defined slice of state to `localStorage` key `skillforge_v1` via a single `subscribe()` listener (`src/store/persistence.ts` → `attachPersistence`), with reference-equality short-circuiting. Provide **Export / Import** in Settings as the user's backup mechanism. Only user-created feed posts are persisted; `MOCK_FEED` is reconstructed on load.

## Consequences
- No server, no per-action save calls; adding a persisted field touches only `getPersistable()`.
- **Risks (accepted for pilot):** data is device-local — lost on cleared browser data / new device / incognito (mitigated by Export). Single-user only.
- **Known debt:** no schema versioning or migration (tracked as **ARCH-003**, P1) — a breaking shape change could drop/fail to load saved data. Must be addressed before relying on long-lived user data.
