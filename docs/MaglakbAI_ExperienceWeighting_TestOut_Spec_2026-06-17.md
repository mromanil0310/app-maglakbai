# MaglakbAI — Experience Weighting via Validation Test-Out

**Status:** ✅ Implemented 2026-06-22 (GROW-002) — final knobs below differ from the original draft per owner sign-off · **Date:** 2026-06-17 · **Owner:** Biboy
**Supersedes:** the experience-level pre-credit behavior removed in `75e85fe`

---

## ✅ As-built summary (2026-06-22)

Shipped per the owner's clarified requirements (these override the draft tables below where they differ):

| Starting point | Skills pre-unlocked (pacing) | Test-out? |
|---|---|---|
| 🌱 Fresh Start (`beginner`) | 1 | No — build-only (log outputs to unlock the next skill) |
| ⚡ Some Foundation (`building`) | 1 | Yes — foundational skills (first 3); pass the quiz to complete, else build |
| 🏆 Bringing Experience (`experienced`) | 3 | Yes — foundational skills (first 3); pass the quiz to complete, else build |

- **Test mechanic:** a **10-question** quiz drawn (shuffled order) from the skill's curated bank. **All-or-nothing:** every answer must be correct, and the **first wrong answer ends the attempt immediately** (the quiz stops — no point continuing). **Up to 3 attempts**; each retry reshuffles. Exhaust all 3 → the skill becomes **build-only** (must log outputs). `MAX_TESTOUT_ATTEMPTS=3`, `TESTOUT_QUESTION_COUNT=10`, `FOUNDATIONAL_WINDOW=3` in `domain/progression.ts`. (Modal `strict` prop drives all-or-nothing + fail-fast + the honor code; the post-build "Test Your Knowledge" validation still uses the 70% bar.)
- **Honor code:** the strict test shows a persistent, always-visible reminder — "🤝 All or nothing · honor code: every answer must be correct… answer from your own knowledge, no looking things up or searching online" — so the self-assessment stays honest.
- **XP on pass:** the existing `VALIDATION_BONUS_XP = 100` (owner chose parity with build-validate), plus any achievement that legitimately unlocks (e.g. skill-mastered). Marks the skill `completed` + `validated` with `validationSource: 'assessment'`, unlocks dependents, and fires the standard milestone celebration.
- **Eligibility** (`isTestOutEligible`, unit-tested): building/experienced level · skill in the first-3 foundational window · status `available` · attempts `< 3` · a question bank exists (custom-path skills have none → build-only).
- **Hydration interplay (critical):** assessment-validated skills are legitimate progress with **zero outputs** — `healPhantomSkillProgress` preserves them, and the empty-account XP floor is `ONBOARDING_XP_GRANT + assessmentCount×VALIDATION_BONUS_XP + valid-achievement XP` so tested-out XP survives a reload. Verified live (reload kept 225 XP + completed skill).
- **Store actions:** `testOutSkill(skillId)`, `recordTestOutAttempt(skillId)` in `coreSlice`.
- **UI:** Evolve skill-detail shows a "Test Out · 10 Questions → +100 XP" CTA (with "Or log work to build it" secondary) on eligible nodes; tested-out skills read "Tested out ✓ — validated by assessment".
- **Known limitation (future):** the bank holds exactly 10 questions per skill, so retries reshuffle order rather than serving fully distinct question sets; a larger bank is needed for that. Supabase `skill_progress` does not yet round-trip `validation_source` (Phase 2) — test-out state is localStorage-authoritative for now.

---

---

## 1. Goal & principle

Give the onboarding "starting point" (experience level) a *real weight* without violating the product thesis — **"XP from proof, not promises."**

Core rule: **a self-declared experience level never mints XP or completed milestones by itself.** It does two honest things:

1. **Personalizes pace** — how much of the path is unlocked up front, weekly-goal expectations, coaching tone. (No score impact.)
2. **Offers an *earned* shortcut** — the user can convert prior experience into credit only by **passing a knowledge check** ("test out"). Proof by assessment, not by declaration.

This reuses the existing `ValidationChallengeModal` and the "Validated" mastery tier.

---

## 2. Model overview

| Starting point | Pacing weight (unlocks) | Test-out allowance (must pass a quiz) |
|---|---|---|
| 🌱 Fresh Start (`beginner`) | Linear (skill 1 available) | None |
| ⚡ Some Foundation (`building`) | First 2 skills available | Up to **1** foundational skill |
| 🏆 Bringing Experience (`experienced`) | First 3 skills available | Up to **2** foundational skills |

"Foundational" = the first **3** skills of the path (the only skills eligible to test out, regardless of level). Everything beyond the foundation is **build-only** — proof via logged outputs, no shortcuts.

---

## 3. XP model — two clearly-separated buckets

| Bucket | Source | Notes |
|---|---|---|
| **Build XP** | Logged outputs + skill *build* completion rewards | The hero number; drives the dashboard ring |
| **Knowledge XP** | Test-out validations | Flat, **path-independent** (fairness fix vs old 200–450 spread) |
| Bonus XP | Achievements, streak milestones | Unchanged |

**Recommended knob:** `TESTOUT_KNOWLEDGE_XP = 30` per validated skill (flat). For comparison, building-then-validating a skill stays at the existing `VALIDATION_BONUS_XP = 100` (more, because you built it). The Profile "XP Sources" panel splits Build vs Knowledge vs Bonus so experience can never silently inflate the headline.

---

## 4. Data model changes

### `UserSkill` (src/types/index.ts)
Add one field to record provenance:

```ts
validationSource?: 'build' | 'assessment';   // why a skill is validated/completed
```

A test-out skill becomes:
```ts
{ skillId, status: 'completed', outputCount: 0, validated: true,
  validatedAt: <iso>, validationSource: 'assessment', completedAt: <iso> }
```
Built skills set `validationSource: 'build'` (absent = 'build' for backward-compat).

### Supabase `skill_progress` (DATABASE.md)
Today the sync persists only `status, outputs_count, completed_at` — it does **not** sync `validated`. Add:

```sql
alter table public.skill_progress
  add column if not exists validated boolean not null default false,
  add column if not exists validated_at timestamptz,
  add column if not exists validation_source text;   -- 'build' | 'assessment' | null
```
Update `upsertSkillProgress`/`fetchSkillProgress` to round-trip these three fields.

---

## 5. Completion & unlock semantics

- A test-out (`assessment`) skill **counts as completed** for path progress and **unlocks its dependents** (it's validated knowledge).
- It is **visually distinguished** on the node: e.g. a "Validated by assessment" badge vs "Built" — so the user always knows which milestones were built vs tested-out.
- The dashboard ring counts assessment-completed skills, but the headline XP stays Build-XP-dominated.

---

## 6. Flow / UX entry points

1. **Post-onboarding prompt (primary):** after Foundation/Experienced onboarding, offer "You said you've done some of this — want to test out of the basics?" → opens the knowledge check for each eligible foundational skill in turn. Pass → validated; skip/fail → just unlocked.
2. **On-demand (secondary):** on an eligible `available` foundational node in Evolve, a "Test out" affordance opens the same modal.

Pass threshold: reuse the modal's existing scoring (recommend ≥ the current pass bar). One retry, then the skill is build-only until they log outputs.

---

## 7. Interplay with existing safeguards (critical)

The phantom heal and sync guard from `fe38425` must treat assessment-validated skills as **legitimate**, not phantom:

- **`healPhantomSkillProgress`** (no-output accounts): demote completed/in_progress to available **unless** `validated && validationSource === 'assessment'`. Those are kept.
- **XP floor for empty accounts:** floor to `ONBOARDING_XP_GRANT + (assessmentValidatedCount × TESTOUT_KNOWLEDGE_XP)` rather than a flat 25, so earned Knowledge XP survives even before any output is logged.
- **`syncFromSupabase` guard:** import a remote completed/in_progress skill if it is output-backed **or** `validated && validation_source === 'assessment'`.

---

## 8. Edge cases

- **Test out, then build the same skill:** already completed; building adds Build XP for the outputs but no second completion reward. Provenance stays 'assessment' unless you want to "upgrade" it to 'build' (recommend: leave as first-validated).
- **Switch/abandon path:** test-out skills behave like any completed skill on switch.
- **Custom paths:** no curated knowledge checks exist → **test-out disabled** for custom-path skills (build-only). Pacing unlock still applies.
- **Re-onboard/reset:** unchanged; reset clears everything.
- **Quiz unavailable for a foundational skill:** if no `validationQuestions` entry exists, that skill is not test-out-eligible.

---

## 9. Recommended default knobs (for your sign-off)

| Knob | Recommended | Rationale |
|---|---|---|
| `TESTOUT_KNOWLEDGE_XP` | 30 (flat) | Meaningful but well below build+validate (100); path-independent = fair |
| Foundational window | first 3 skills | Bounds credit to basics; advanced stays build-only |
| Test-out cap — Foundation | 1 | Matches "some" foundation |
| Test-out cap — Experienced | 2 | Matches old "2 skills" mental model, now *earned* |
| Pass threshold / retries | existing bar / 1 retry | Reuse modal behavior |

---

## 10. Implementation checklist (phased)

**Phase 1 — core logic (safe, unit-testable, no UI):**
- [ ] `UserSkill.validationSource` field + types
- [ ] `validateSkillByAssessment(skillId)` store action (guards: eligible foundational skill, available/not-completed, quiz exists, under cap) → sets completed + validated + 'assessment', grants `TESTOUT_KNOWLEDGE_XP`, unlocks dependents
- [ ] Update `healPhantomSkillProgress` + empty-account XP floor to preserve assessment validations
- [ ] Update `syncFromSupabase` guard to allow assessment validations
- [ ] Vitest coverage for action + heal/guard interplay

**Phase 2 — persistence:**
- [ ] `skill_progress` columns + `upsert/fetchSkillProgress` round-trip

**Phase 3 — UX:**
- [ ] Post-onboarding test-out prompt
- [ ] "Test out" affordance + "Validated by assessment" badge on eligible nodes
- [ ] Profile "XP Sources" split: Build / Knowledge / Bonus

---

## 11. Open decisions for sign-off

1. Confirm `TESTOUT_KNOWLEDGE_XP = 30` (or pick a value).
2. Confirm caps (Foundation 1 / Experienced 2) and foundational window (3).
3. Should building a tested-out skill later "upgrade" provenance to 'build'? (Recommend: no.)
4. Post-onboarding prompt vs on-demand-only for v1? (Recommend: both, prompt is the hook.)
