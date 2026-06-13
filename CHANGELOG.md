# Changelog

All notable changes to MaglakbAI are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/). This is a pre-release **web/PWA pilot**;
the detailed engineering log lives in `reports/maglakbai-audit-report.md`.

## [Unreleased]

### Changed
- **Store architecture (ARCH-002):** decomposed the ~4,400-line store into focused modules — static catalog (`src/data/`), pure calculators (`src/domain/`), persistence (`src/store/persistence.ts`), and 4 action slices (`src/store/slices/`). `appStore.ts` is now ~270 lines of state-init + composition. No user-facing behavior change.
- Removed a redundant explicit persistence write in `toggleSavePost` (the subscribe already covers it).

### Added
- **Test suite:** Vitest with 46 unit + integration tests (`npm test`) covering the XP/leveling/streak/evidence/achievement logic and the core store actions.
- **Documentation:** rewrote `docs/ARCHITECTURE.md`; added `LICENSE`, `.env.example`, `docs/DEPLOYMENT.md`, `docs/TESTING.md`, `CONTRIBUTING.md`, `SECURITY.md`, `docs/PRIVACY.md`, `docs/PROBLEM_VALIDATION.md`, ADR log (`docs/adr/`), and this changelog. Refreshed `CLAUDE.md` and added a positioning banner to `docs/PRD.md`.

## [Pilot baseline] — 2026-06-01

The first closed web/PWA pilot release (BAEF Conditional Go). Highlights:

### Added
- 4-step onboarding; Career Evolution Map; custom roadmaps + path switching.
- Log Output (6 types) with XP, quality/takeaway bonuses, and the evidence gate.
- XP & leveling (10 levels), skill completion + prerequisite unlocking, 8 achievements.
- Streak system (grace period, freeze, 7/14/30-day milestone bonuses).
- Milestone celebration + level-up overlay; community feed (clearly labeled **preview/seed** data) with reactions and comments; Profile + Portfolio.
- **Privacy:** opt-in, PII-free analytics with a consent banner + privacy policy; data Export/Import; local-only data notice.
- User guide (`docs/USER_GUIDE.html`), published via GitHub Pages.

### Fixed (pilot release blockers)
- Re-enabled pinch-zoom (WCAG 1.4.4).
- Analytics no longer sends PII without consent; consent UI + policy added.
- Error boundary no longer leaks stack traces in production.
- Community feed relabeled as preview (no longer presented as live).

### Known limitations
- Device-local only (no backend/multi-device); no schema migration yet (ARCH-003).
- Web/PWA only — no native build (ARCH-007/REL-001).
- Privacy contact is a placeholder pending a real inbox (PRIV-002).
