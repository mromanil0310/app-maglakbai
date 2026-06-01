# Architecture Decision Records (ADRs)

Dated, append-only records of significant technical/product decisions. An ADR is **immutable once Accepted** — to change a decision, add a new ADR that supersedes the old one (note it in both).

Format per ADR: **Title · Status · Context · Decision · Consequences.**
Status: Proposed · Accepted · Superseded (by ADR-NNNN) · Deprecated.

| # | Title | Status |
|---|-------|--------|
| [0001](0001-one-store-composed-from-slices.md) | One Zustand store, composed from slices | Accepted |
| [0002](0002-extract-catalog-and-domain.md) | Extract static catalog (`src/data`) and pure logic (`src/domain`) | Accepted |
| [0003](0003-localstorage-only-persistence.md) | localStorage-only persistence for the pilot | Accepted |
| [0004](0004-web-pwa-pilot-positioning.md) | Ship as a web/PWA pilot (defer native) | Accepted |
| [0005](0005-opt-in-pii-free-analytics.md) | Opt-in, PII-free analytics | Accepted |

> These ADRs back-document decisions already in force (previously captured as prose in `docs/ARCHITECTURE.md`). New decisions get a new numbered file.
