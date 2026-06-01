# ADR-0005 — Opt-in, PII-free analytics

**Status:** Accepted (sprint 28)

## Context
Understanding the pilot needs behavioral analytics, but the app is privacy-sensitive (career data) and was initially sending events without consent — a privacy issue flagged in the BAEF audit (SEC-001/PRIV-001). Analytics must not become a trust liability.

## Decision
Analytics (PostHog-compatible) is **opt-in only**: `track()`/`identify()` are hard no-ops until the user grants consent via the in-app `ConsentBanner` (consent persisted as `sf_analytics_consent`, revocable in Settings). **No PII** is ever sent — users are identified by a random anonymous id, and a defensive scrub strips `name`/`email`/handle/free-text from payloads. Analytics also no-ops without `VITE_POSTHOG_API_KEY`.

## Consequences
- Default posture is privacy-preserving; consent + PII-scrubbing are baked into Phase 5, not retrofitted.
- This is now a cross-project Biboy standard (recorded in `Projects/Biboy_BAEF/REGISTRY.md`).
- Trade-off: opt-in reduces event volume vs. opt-out. Accepted — trust > completeness for a career app.
