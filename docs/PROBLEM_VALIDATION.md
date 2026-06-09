# MaglakbAI — Problem Validation (BAEF Phase 1)

> The BAEF Phase 1 artifact: *"Are we solving a problem worth solving?"* This formalizes the assumptions the PRD builds on. Several items are **hypotheses to validate in the pilot**, not proven facts — flagged as such.

---

## Problem statement

Tech professionals who learn and build constantly have **no structured, credible way to show the proof that they're growing.** Tutorials watched leave no trace; projects built get forgotten; skills acquired aren't visible. LinkedIn shows a static résumé and GitHub shows raw code, but **nothing captures the journey** — the accumulating, verifiable evidence of getting better over time.

## Who has this problem (target personas)

- **The Upskiller** — an AI/data/software professional already learning constantly (courses, side projects, certs) who wants their effort to *compound into visible identity*, not vanish.
- **The Builder-Sharer** — someone who already posts wins on LinkedIn/X and values professional visibility; wants a lighter, proof-based way to track and share progress.
- **The Career-Switcher / Early-career dev** — building a portfolio to prove capability to employers; needs evidence of consistent, real output.

## Pain points

- Effort → no durable artifact ("I learned X" with nothing to show).
- Progress is invisible and unmotivating; no feedback loop between learning and recognition.
- Portfolios are manual to maintain and easy to abandon.
- No community that recognizes *the work itself* (vs. credentials or follower counts).

## Unique value proposition

**Proof-based progression:** XP comes from *building, not watching*. Logging real outputs (projects, scripts, books, certs, repos) turns continuous learning into an evolving, shareable professional identity with milestones and streaks.

## Competitive landscape

| Alternative | Gap it leaves |
|-------------|---------------|
| LinkedIn | Static résumé; rewards posting/credentials, not a tracked build journey |
| GitHub | Code only; no XP/skills narrative; invisible to non-engineers |
| Duolingo / habit apps | Gamify *consumption/streaks*, not real-world professional output |
| Notion/portfolio sites | Manual, high-effort, no gamification or community recognition |

**Wedge:** the "proof-based progression" framing — gamified, social, any-field — is not directly occupied by the above. (Original positioning used a "Strava for growth" analogy; replaced with owned copy: "Level up through proof, not promises.")

## Success metrics (pilot)

Leading indicators the pilot should move (instrumented via the opt-in analytics events in `docs/ARCHITECTURE.md`):
- **Activation:** % of new users who log ≥1 output (and time-to-first-output).
- **Engagement:** outputs logged per active user / week; streak length distribution.
- **Progression:** % reaching first skill completion / first milestone.
- **Retention:** D1 / D7 / D30 return rates.

## Open assumptions to validate (hypotheses, not facts)

1. Users will log proof-of-work *honestly and consistently* without external accountability. *(The evidence gate exists to protect this; retention/honesty unproven.)*
2. Gamified XP/streaks meaningfully increase upskilling consistency for professionals (not just novelty).
3. A proof-based feed earns recognition that LinkedIn doesn't — i.e., community value materializes once the feed is *live* (it's preview/seed data today).
4. The "Level up through proof, not promises" positioning resonates enough to drive word-of-mouth — especially with the inclusive "any skill, any field" framing replacing the earlier tech-only positioning.

## Viability notes (pilot stage)

No monetization is implemented; this is a closed web/PWA pilot to test the core loop. Business model, pricing, and scale (backend, multi-device, real community) are **out of scope until the loop is validated** — deliberately, to avoid premature scaling (a BAEF anti-goal).

---

_See `docs/PRD.md` for product definition (Phase 2), `reports/skillforge-audit-report.md` for the live release decision + backlog._
