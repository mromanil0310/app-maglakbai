# MaglakbAI Audit Report
_Last updated: 2026-06-13 (sprint 44 follow-up: all sprint-43/44 fixes committed (`3f3dcd7`) and deployed to production. **OPS-002 ✅ fully resolved + verified live** — PostHog key set in Netlify, CSP fixed, redeployed, and `session_started`/`screen_viewed`/`retention_d1`/`retention_d7`/`client_error` all confirmed arriving in PostHog from the live site. PRIV-003 remains ✅ resolved. REL-001 ✅ closed (committed web/PWA per ADR-0004; all user-facing positioning already aligned). BRAND-002 ✅ resolved (brand fonts self-hosted via `@fontsource-variable` — no Google Fonts origin, tight CSP unchanged, verified zero third-party hits locally). **COMP-001 🔶 resolved in code** (Terms of Service live + reachable pre-signup; full-erasure Delete Account via a `delete-account` Edge Function — code-complete + UI-verified, needs one owner deploy step). New finding: OPS-003 (Supabase refresh-token retry loop spamming the console on the live site). 114 tests, NO GO public still stands until COMP-001's Edge Function is deployed + verified; then only P1s AUTH-001/GROW-001/OPS-003 remain.)_

> **Governed by BAEF** — the [Biboy Application Excellence Framework](../Biboy_BAEF/BAEF.md) is the operating standard for this app. The authoritative current assessment is the **sprint-44 Public-Release Board Review** immediately below. Earlier dated sections are retained for history (do not delete) and are superseded by the most recent dated section.

---

## 🏛️ BAEF Public-Release Board Review (sprint 44, 2026-06-12)

_Question under review: is MaglakbAI ready for **public release** at BIBOY Group quality standards — a strictly higher bar than the closed web/PWA pilot cleared at sprint 43. Evidence-driven: secrets/CSP/RLS/legal surfaces inspected directly this run._

### Decision
**❌ NO GO — public release.** ✅ The sprint-43 **Conditional Go for the closed pilot stands** (none of the new findings break the closed-pilot posture, but PRIV-003 and OPS-002 should be fixed during the pilot regardless).

**Update (2026-06-13):** PRIV-003, OPS-002 and BRAND-002 are now ✅ resolved + verified live (commit `3f3dcd7` / `ff4f97f`, Netlify deploy `6a2cbc3e0a3cf4000898d50b`), and **REL-001 ✅ closed** (web/PWA per ADR-0004). **COMP-001 is now 🔶 resolved in code** — the Terms of Service half is fully done + verified (reachable pre-signup + in Settings); self-serve account deletion is code-complete + UI-verified via a `delete-account` Edge Function (full cascade erasure incl. the auth email), needing **one owner deploy step** (`supabase functions deploy delete-account`) to go live. The decision is unchanged — **still NO GO for public release** — because COMP-001 isn't fully live until that function is deployed and verified; once it is, the last public-P0 clears (leaving only P1s AUTH-001 / GROW-001 / OPS-003). A new finding, **OPS-003** (Supabase refresh-token retry loop), was logged during the earlier live verification.

### New backlog items (sprint 44)

#### PRIV-003 — Privacy policy materially false since the backend went live ✅ Resolved (sprint 44)
- **Priority:** **P0 (public)** / P1 (pilot) · **Severity:** 🔴 Critical · **Category:** Privacy / Compliance / Trust
- **Description (refined during fix):** The in-app `PrivacyPolicyModal` had already been updated for Cloud Backup (largely accurate); the materially false artifact was **`docs/PRIVACY.md`** — the "keep in sync" standalone copy still claiming *"We do not have a server," "email stored only on this device," "Reset removes it permanently."* Two Settings strings also lied when signed in ("stored only on this device"; Reset "will be wiped"), and **`resetApp` didn't clear the Supabase session** — after Reset the user stayed signed in and the auth listener could silently re-sync cloud data into the "reset" app.
- **Resolution (sprint 44):**
  1. **Behavior:** `coreSlice.resetApp` now calls `signOut()` (fire-and-forget) and clears `supabaseUserId/supabaseEmail/supabaseSyncing` — Reset = device wiped + signed out, no silent re-sync. Unit test added ("resetApp wipes the device AND clears the cloud session"); **114 tests green**.
  2. **Settings copy:** Reset confirm is now conditional — signed-in users are told the cloud backup is NOT deleted, they'll be signed out, and how to request cloud erasure (PRIVACY_CONTACT); the Data & Privacy notice is conditional on sign-in state.
  3. **Policy:** `docs/PRIVACY.md` fully rewritten to mirror the modal (cloud backup disclosure incl. profile fields + output text, honest Reset semantics, erasure-by-email path, dependent-artifact warning banner); modal "Deleting your data" section tightened (Reset signs out; cloud copy persists until erasure requested); effective date bumped to June 12, 2026.
  4. **Verified live in preview:** modal shows the new effective date, cloud disclosure, honest Reset wording, erasure path; no "we do not have a server" claim anywhere; signed-out Settings variants render; 0 console errors.
- **Remaining (tracked separately):** in-app self-serve cloud deletion = **COMP-001** — now code-complete via a `delete-account` Edge Function (full cascade erasure), pending one owner deploy step. The erasure-by-email path remains the lawful interim until it's deployed.

#### OPS-002 — Production analytics + error monitoring are dead-on-arrival (key empty, CSP blocks the endpoint) ✅ Resolved + verified live (2026-06-13)
- **Priority:** **P0 (public)** / P1 (pilot — defeats the pilot's measurement purpose) · **Severity:** 🔴 Critical · **Category:** Ops / Analytics
- **Description:** Two independent kills: (1) `VITE_POSTHOG_API_KEY` is **EMPTY** in `.env` (verified) → `analytics.ts:97 post()` no-ops everywhere, so every event — including `retention_d1/d7/d30` (ANL-001) and `client_error` (OPS-001) — is silently dropped; Netlify env unverified. (2) Even with a key, the CSP in `netlify.toml` allows `connect-src … https://app.posthog.com` while `analytics.ts:34` defaults to `https://us.i.posthog.com` → production capture calls are CSP-blocked. Bonus footgun: `?? 'https://us.i.posthog.com'` doesn't survive an *empty-string* env var (`'' ?? x` → `''`), which would POST to the app's own origin.
- **Business impact:** The pilot exists to produce activation/retention data; with this configuration **zero events ever arrive**, so the pilot cannot answer its own go/no-go question and crashes are invisible despite the monitor being wired. **User impact:** none directly.
- **Acceptance criteria:** PostHog key + host set in Netlify env; CSP `connect-src` includes the actual ingest host; `??` → `||` (or trim+validate); **a real event verified end-to-end in the deployed prod app** (network 200 + visible in PostHog).
- **QA validation:** Deployed site → grant consent → log output → event visible in PostHog; forced error → `client_error` visible. **Effort:** S. **Dependencies:** PostHog project provisioning.
- **Status: ✅ Fully resolved and verified live (2026-06-13).** (1) CSP `connect-src` now includes `https://us.i.posthog.com` alongside `app.posthog.com` (`netlify.toml`). (2) `analytics.ts` host/key fallbacks changed `??` → `||` so an empty-string env var can't produce a same-origin POST. (3) `VITE_POSTHOG_API_KEY` set in Netlify (PostHog US Cloud, project 468331). (4) All sprint-43/44 code committed (`3f3dcd7`) and pushed to `main` → Netlify auto-deployed to production.
- **Live verification (production, `fascinating-kitten-b6a79d.netlify.app`):** a manual `fetch` to `https://us.i.posthog.com/capture/` from the deployed origin returned `200 {"status":"Ok"}` (was `TypeError: Failed to fetch` / CSP-blocked before the redeploy). Real app-driven events confirmed in PostHog Activity within the same minute: `session_started` ×2, `session_ended`, `screen_viewed` ×2, **`retention_d1`**, **`retention_d7`** (ANL-001 also confirmed live), and a forced **`client_error`** (OPS-001 also confirmed live). Tab title/OG tags now read "MaglakbAI" (BRAND-001 confirmed live).

#### BRAND-002 — CSP blocks Google Fonts in production: premium brand fonts have never shipped ✅ Resolved (sprint 44, 2026-06-13)
- **Priority:** P1 · **Severity:** 🟠 High · **Category:** Brand / UX / Ops
- **Description:** `index.html:40-42` (and shipped `dist/index.html`) load Plus Jakarta Sans + Space Grotesk from `fonts.googleapis.com` / `fonts.gstatic.com`, but the Netlify CSP allows only `style-src 'self' 'unsafe-inline'` and `font-src 'self'` → in production the stylesheet and font files are blocked and the app silently falls back to system fonts. The sprint-42 "premium fonts" flagship has **never rendered in production**. Undetectable in local e2e because localhost serves no Netlify headers.
- **Acceptance criteria:** Either add `https://fonts.googleapis.com` to `style-src` + `https://fonts.gstatic.com` to `font-src`, or (better for CSP tightness + performance) self-host the two font families and keep `font-src 'self'`. Verify rendered font-family **on the deployed site**, not localhost. **Effort:** S.
- **Resolution (sprint 44):** Took the **self-host** path (acceptance-criteria option b) — chosen over loosening the CSP for a privacy reason specific to this app: loading from Google Fonts leaks every user's IP + User-Agent to Google on each page load, an undisclosed third-party data flow inconsistent with the PRIV-003 posture. Self-hosting removes it entirely and also helps the offline-PWA goal (PERF-002).
  1. **Deps:** added `@fontsource-variable/plus-jakarta-sans` + `@fontsource-variable/space-grotesk` (OFL; single variable woff2 per family covers all weights). Install clean under the repo's pinned `legacy-peer-deps` (`.npmrc`); **114 tests still green, `tsc --noEmit` exit 0**.
  2. **Wiring:** imported the three font CSS entry points in `web-index.tsx` (Vite bundles the woff2 into `/assets`, served same-origin); removed the two `preconnect` + the `fonts.googleapis.com` stylesheet `<link>` from `index.html`; updated the two `font-family` rules to the registered variable names `'Plus Jakarta Sans Variable'` / `'Space Grotesk Variable'` (these names are referenced **only** in `index.html`).
  3. **CSP:** **no `netlify.toml` change needed** — the existing tight `font-src 'self'` / `style-src 'self' 'unsafe-inline'` is already correct for same-origin fonts; the bug was the app reaching for origins the (correct) CSP didn't allow. No third-party font origin is introduced.
  4. **Verified (local, build + dev):** production build emits 9 same-origin `dist/assets/*.woff2`; **grep of `dist/` finds zero `googleapis`/`gstatic` references**; in the running app the computed font is `'Plus Jakarta Sans Variable'` and the face reports `loaded`, Space Grotesk Variable lazy-loads on the wordmark, and `performance` resource timings show **zero Google-origin hits** — every woff2 served from our own origin. Because self-hosting removes all CSP/third-party dependence, localhost now faithfully represents prod (the original "only breaks in prod" footgun is gone).
  5. **✅ Verified live on production (2026-06-13, commit `ff4f97f`, `fascinating-kitten-b6a79d.netlify.app`):** the deployed CSP header is unchanged (`font-src 'self'`, `style-src 'self' 'unsafe-inline'`, no Google origins); the live `/assets/index-*.css` registers both `Plus Jakarta Sans Variable` + `Space Grotesk Variable` `@font-face`s with same-origin woff2 URLs; a sample woff2 returns `HTTP/2 200` `content-type: font/woff2` from the Netlify origin; and the live `index.html` contains **zero** `googleapis`/`gstatic` references. The premium brand fonts now render from production itself — first time since the sprint-42 "premium fonts" work shipped.

#### COMP-001 — No Terms of Service; no server-side account deletion (right to erasure) 🔶 Resolved in code — one owner deploy step remains (sprint 44, 2026-06-13)
- **Priority:** **P0 (public)** / P2 (pilot) · **Severity:** 🔴 Critical (public) · **Category:** Compliance / Legal
- **Description:** No ToS anywhere in app or docs (verified by repo-wide search). `src/lib/db.ts` has zero delete functions — once a signed-in user's profile/outputs reach Supabase there is **no user-facing way to erase them** (GDPR Art.17 / PH DPA right to erasure). Settings "Reset" misleadingly suggests full deletion (see PRIV-003).
- **Acceptance criteria:** ToS reachable pre-signup; "Delete my cloud data" (or full account deletion via Supabase) in Settings; Reset semantics honest. **Effort:** M. **Dependencies:** PRIV-003 wording.
- **Resolution (sprint 44):**
  1. **Terms of Service — ✅ fully done + verified.** New `docs/TERMS.md` + in-app `src/components/TermsOfServiceModal.tsx` (honest pilot terms: 16+, as-is/no-warranty, your-content ownership, acceptable use, self-serve deletion, PH governing law). Reachable **pre-signup**: onboarding NameStep now shows "By continuing, you agree to our Terms of Service and Privacy Policy" with both as tappable links (verified live in preview — links render and open their modals), and a Terms row was added to Settings → App. Owner note in `docs/TERMS.md`: confirm legal entity + jurisdiction with counsel before a true public launch.
  2. **Self-serve account deletion — ✅ code-complete + UI-verified; ⏳ one owner deploy step.** Chose **full erasure via a Supabase Edge Function** (`supabase/functions/delete-account/index.ts`): it authenticates the caller by their JWT and uses the service role to `auth.admin.deleteUser(userId)`. Because `profiles.id → auth.users(id) ON DELETE CASCADE` and every data table → `profiles(id) ON DELETE CASCADE`, that single delete cascades to erase the profile, outputs, skill_progress, milestones, market_signals **and** the email in `auth.users` — true right-to-erasure, no extra DELETE RLS policies needed, service key never on the client. Client wrapper `deleteAccount()` in `src/lib/auth.ts`; **Settings → Delete Account** danger action (shown only when signed in) → confirm → Edge Function → `resetApp()` → back to onboarding. Verified in preview: Settings renders Terms + Reset; the Delete Account row is correctly **hidden when not signed into Supabase** (gating works); `tsc` 0, build clean, **114 tests green**, zero console errors.
  3. **Honest Reset copy:** the Reset sub-label is now conditional — signed-in users are told Reset wipes only the device and keeps the cloud backup (full erasure is the separate Delete Account). `PrivacyPolicyModal` + `docs/PRIVACY.md` "Deleting your data" rewritten to lead with Settings → Delete Account.
- **Remaining (owner step — like OPS-002's Netlify key):** deploy the Edge Function once: `supabase functions deploy delete-account --project-ref wovceouygyobczkkeyxy` (runbook in `supabase/functions/delete-account/README.md` + `docs/DATABASE.md`). Until deployed, the in-app button surfaces a friendly error and the email-erasure interim stands. After deploy: sign in → log an output → Delete Account → confirm the user + rows are gone in the Supabase dashboard. **Then COMP-001 → fully resolved and the last public-P0 clears.**

#### AUTH-001 — Magic Link on Supabase default SMTP cannot survive public traffic
- **Priority:** P1 (public) · **Severity:** 🟠 High · **Category:** Ops / Auth
- **Description:** Auth uses Supabase's built-in email service, which is explicitly not for production (low hourly send limits, shared-IP deliverability/spam issues). At public scale, sign-in emails throttle or land in spam → auth is effectively down. **Acceptance criteria:** Custom SMTP (Resend/Postmark/SES) configured + deliverability tested; rate-limit/abuse posture reviewed. **Effort:** S–M.

#### PERF-002 — No service worker: the "PWA" has no offline support
- **Priority:** P2 · **Severity:** 🟡 Medium · **Category:** Performance / UX
- **Description:** Manifest + A2HS exist but no service worker (verified) → installed app white-screens offline; no asset caching. Combined with the ~353KB-gzip JS payload, mid-range-device cold loads are mediocre vs. best-in-class PWAs. **Acceptance criteria:** Workbox (or vite-plugin-pwa) precache + offline shell; route-level code splitting for the 699KB app chunk. **Effort:** M.

#### GROW-001 — No public-facing growth surface
- **Priority:** P2 (pilot) / P1 (public) · **Severity:** 🟡 Medium · **Category:** Growth
- **Description:** `index.html` IS the app — no landing page, no SEO content, no referral mechanic; community is PREVIEW-only so the Share→Recognition half of the addiction loop doesn't exist publicly; no monetization model defined anywhere. OG/Twitter cards exist (good). **Acceptance criteria (public):** landing page + live community (Phase 2) + referral hook + a monetization thesis before paid acquisition. **Effort:** L–XL (Phase 2 scope).

#### OPS-003 — Supabase refresh-token retry loop spams the console with `TypeError: Failed to fetch` (new finding, 2026-06-13)
- **Priority:** P1 · **Severity:** 🟠 High · **Category:** Ops / Auth / Stability
- **Description:** During the OPS-002 live-verification pass on production (`fascinating-kitten-b6a79d.netlify.app`), the Supabase JS client's `GoTrueClient._refreshAccessToken` / `_callRefreshToken` (minified `Oc._refreshAccessToken` / `Oc._callRefreshToken`) entered a continuous retry loop, throwing `TypeError: Failed to fetch` roughly every 1-4 seconds — 7+ consecutive failures observed in one browsing session. Likely cause: a stale/expired refresh token persisted in this browser's localStorage for the Netlify origin from an earlier QA sign-in, which the client keeps retrying instead of failing gracefully into a signed-out state.
- **Risk:** (1) With OPS-001 now live, each failed retry can itself fire a `client_error` event — a real user stuck in this state would flood PostHog with noise and burn the event quota. (2) Continuous network retries drain battery/data on mobile. (3) If a real user's session expires after a long absence, they may be silently stuck half-signed-in instead of being cleanly signed out and prompted to re-authenticate.
- **Acceptance criteria:** Reproduce with a deliberately-expired/invalid `sb-*-auth-token` in localStorage; determine whether `src/lib/auth.ts`'s `onAuthStateChange` handler (or Supabase client config) needs an explicit refresh-failure path that clears the stale token and signs the user out locally instead of retrying indefinitely. Confirm the loop stops and `client_error` volume doesn't spike for this case. **Effort:** S–M. **Dependencies:** none — independent of COMP-001/REL-001/BRAND-002.
- **Status:** 🔵 New — not yet investigated. Root cause not confirmed; may be specific to this QA browser's stale localStorage rather than a general defect affecting real users.

### Public-release scorecard (0–100, board scale)

| Score | Value | One-line basis |
|---|---|---|
| **Release Readiness (public)** | **68/100** | PRIV-003 + OPS-002 ✅ live; REL-001 ✅ closed; BRAND-002 ✅ resolved. **COMP-001 🔶 resolved in code** (ToS fully done + verified; full-erasure Delete Account code-complete + UI-verified) — one owner step (deploy the `delete-account` Edge Function) clears the last public-P0. Remaining after that: P1s AUTH-001, GROW-001, OPS-003. |
| **Product Quality** | **72/100** | Core loop excellent and 113-test-verified; community half is sample-only; god screens; no component/e2e tests (ARCH-004). |
| **UX** | **82/100** | Onboarding→first-win verified end-to-end three times, celebrations reconcile (UX-030); premium brand fonts now self-hosted and actually render (BRAND-002 resolved); a11y audit still missing (A11Y-011). |
| **Security** | **70/100** | Opt-in/PII-scrub/CSP/RLS-by-design/no committed secrets all good; live RLS unverified, no abuse/rate-limit story, localStorage unencrypted. |
| **Growth Readiness** | **40/100** | No live community/referral/landing/monetization; analytics pipeline is now ✅ live and verified (OPS-002 resolved) — activation/retention finally measurable; magic-link email ceiling (AUTH-001) unresolved. |

### BAEF 12-dimension re-score (public-release context)
Product Strategy 8 (REL-001 closed — channel/positioning now coherent: committed web/PWA per ADR-0004) · UX 8 · Accessibility 6 · Performance 6 · Security 7 · Stability 8 · Scalability 5 · Technical Quality 8 · Retention 7 (OPS-002 resolved — `retention_d1`/`retention_d7` confirmed live) · Operational Readiness 7 (telemetry live + verified end-to-end; new OPS-003 retry-loop finding) · Documentation 9 (PRIV-003 resolved — privacy policy now accurate; ToS now exists) · Release Readiness 5 (public — COMP-001 down to one owner deploy step; until the `delete-account` Edge Function is live, the right-to-erasure flow isn't functional end-to-end). **Overall (public): 6.0/10 — still NO GO.** The legal P0 (COMP-001) is code-complete but not yet live; once the Edge Function is deployed and verified, the last public-P0 clears. _Pilot context remains ~7.9/10 Conditional Go._

### Sign-off
Product, UX, QA cleared the **core loop** quality. **Update 2026-06-13:** PRIV-003 and OPS-002 are now resolved and verified live — telemetry is flowing and the privacy policy is accurate, so Ops and Compliance withdraw those two vetoes. **Compliance's COMP-001 veto is now conditional** — a Terms of Service exists and is reachable pre-signup, and a full-erasure Delete Account flow is code-complete and UI-verified; the veto lifts the moment the `delete-account` Edge Function is deployed and a real erasure is verified (one owner step). Growth and the independent skeptics still flag preview-only community + no growth surface (GROW-001). **Brand withdraws the BRAND-002 veto** — premium fonts now self-hosted and rendering, with no Google Fonts data leak. New: **OPS-003** (Supabase refresh-token retry loop) — Ops to triage.

---

## 🎯 BAEF Re-Audit — Elite Launch Readiness — Web/PWA Pilot (sprint 43, 2026-06-12)

_Full 10-phase re-audit ahead of MaglakbAI's framing as the **first BIBOY Group pilot launch**. Verified the live artifact directly (ran the suite, built, grepped brand surfaces) rather than trusting the prior report. Supersedes the sprint-42 scorecard._

### Verified facts (this run)
- **Tests:** `npm test` → **94 passing** at audit start → **112 passing** after this run (added 7 retention-logic + 11 error-monitor tests). Confirmed green, not aspirational.
- **Build:** `npm run build` → clean (`613 modules`, App chunk 699 KB / 185 KB gzip, vendor 545 KB / 168 KB gzip). Largest-chunk warning persists (no code-splitting beyond vendor/nav).
- **`tsc --noEmit`:** ❌ at audit start — exit code 2, `web-index.tsx` missing `@types/react-dom`. ✅ **Fixed this run** (CI-001/TD-001) — now exit 0.
- **CI reality check:** the workflow's `npm ci` step **also failed** at audit start (ERESOLVE peer conflict, no `.npmrc`). Combined with the `tsc` failure, **the "green CI gate" the report relied on was not actually running.** Both fixed this run (see CI-001).

### Release Decision (sprint 43)
**Decision:** ✅ **CONDITIONAL GO** — closed web/PWA pilot · ❌ **NO GO** — public launch / App Store.
**Release scope:** Closed **web / PWA pilot** (browser + Add-to-Home-Screen), invited cohort. Not a native iOS/Android store release.

- **P0 blockers:** 0 open. The five original P0s remain resolved. **BRAND-001** (rebrand never reached distribution surfaces) was found this run and **fixed in-session** — see below.
- **Conditions to monitor for the pilot:**
  1. Community must stay labeled **PREVIEW** with sample data marked (TRUST-001 must not regress).
  2. Brand surfaces must stay on **MaglakbAI** (BRAND-001 regression guard — add a CI grep).
  3. Privacy contact + analytics opt-in + export/import must remain intact.
- **Rationale:** The core loop is polished, tested (94 tests + CI), and infra-hardened (CSP, Supabase backup, consent gate, schema-versioned persistence, export/import). The one launch-credibility defect — three competing brand names across the installed PWA name, browser tab, social cards, and user-shared portfolios (`MaglakbAI` in-app, `LakbAI` on distribution surfaces, `skillforge.app` in shared portfolio text) — was corrected this run. Accepted risks for a **closed** cohort: sample-only community (Phase 2), god-component screens + no e2e/component tests (ARCH-004). _(Error monitoring OPS-001 — previously an accepted risk — was closed this run.)_
- **Sign-off:** Product, UX, Accessibility, Security, Privacy → cleared for **pilot scope**. Independent skeptics + QA → withhold sign-off for **public/store launch** pending REL-001 (web/PWA positioning) and ARCH-004 (component/e2e tests). _OPS-001 (error monitoring) closed this run; only the PostHog alert threshold remains a dashboard config step._

### BAEF Production Readiness Scorecard — sprint 43 (12 dimensions)

| Dimension | Score | Δ | Notes |
|---|---|---|---|
| Product Strategy | 8/10 | – | Strong differentiator (proof-based progression); market-demand layer adds real signal. PMF still unproven (no live retention data). |
| UX | 9/10 | – | First-run win (25 XP + streak), evidence gate, editable roadmaps. Minor open: UX-022 weekly-unit consistency. |
| Accessibility | 7/10 | – | Labels, AA contrast, pinch-zoom, tap targets fixed. No full screen-reader/keyboard audit (A11Y-011). |
| Performance | 8/10 | – | Chunk-split; ~185 KB gzip app chunk. Not load-tested; no route-level lazy-loading. |
| Security | 8/10 | – | CSP header, Magic Link auth, PII scrub, 0 console errors. localStorage unencrypted (acceptable for pilot). |
| Stability | 8/10 | ▼1 | Root + per-screen error boundaries; 101 tests. **CI gate was silently broken** (CI-001: `npm ci` + `tsc` both failed on a clean runner) — fixed this run, so the gate is now real. No e2e/component render tests (ARCH-004). |
| Scalability | 7/10 | – | Supabase backend live (auth, backup, multi-device). Community still single-device/Phase 2. |
| Technical Quality | 8/10 | ▼1 | Solid domain/slice separation; `tsc` type gap (TD-001) fixed this run → clean type-check. God-screens persist (Profile 2,992 / Dashboard 2,086 / Evolve 1,886 lines — ARCH-004). |
| User Retention | 7/10 | – | Loops well-designed; unproven at scale; no push (Phase 3). |
| Operational Readiness | 8/10 | ▲1 | Netlify auto-deploy + CSP + **working CI gate** (CI-001). Retention instrumentation corrected (ANL-001). **Client error monitoring wired** (OPS-001) — consent-gated `client_error` events; only the PostHog alert threshold remains a dashboard config step. |
| Documentation | 9/10 | – | Complete doc set + ADRs. Minor: CLAUDE.md tagline ("Stop watching. Start building.") differs from in-app tagline ("Navigate Your Future / Isulong ang pangarap") — DOC-015. |
| Release Readiness | 8/10 | – | Closed web/PWA pilot: Conditional Go. Open P1: REL-001 (positioning). BRAND-001 fixed this run. |
| **Overall (pilot)** | **7.9/10** | ▲0.2 | **Conditional Go — closed web/PWA pilot. No Go — public/store.** This run closed BRAND-001 (full rebrand cleanup + CI guard), ANL-001 (retention instrumentation), CI-001/TD-001 (CI gate now actually runs), and OPS-001 (client error monitoring). Genuine hardening across Ops/Stability. Remaining for public launch: owner-decision REL-001 (web/PWA vs native) and ARCH-004 (component/e2e tests). |

### New backlog items (sprint 43)

#### BRAND-001 — Rebrand never reached distribution surfaces ✅ Resolved (this run)
- **Priority:** P1 (P0 for any *branded* public launch) · **Severity:** 🟠 High · **Category:** Product / Brand / Trust
- **Description:** Sprint-42 renamed the app to **MaglakbAI** in-screen, but the install/share surfaces still carried older brands: `index.html` `<title>` + `apple-mobile-web-app-title` + OG/Twitter titles = "LakbAI"; `public/manifest.json` `name`/`short_name` = "LakbAI" (the name shown on the home screen when installed); `app.json` `name`/`slug` = "LakbAI"/"lakbai"; and `PortfolioScreen.tsx:242` shared-portfolio footer = **`skillforge.app`** (two brands stale, externally shared).
- **Business impact:** A first BIBOY-Group brand launch shipping three different names (installed PWA, browser tab, social preview card, user-shared portfolio) reads as unfinished and erodes brand trust at the worst moment — first impression and word-of-mouth share.
- **User impact:** Installs an app named "LakbAI," shares a portfolio that cites a dead `skillforge.app`.
- **Acceptance criteria:** Every distribution/share surface reads "MaglakbAI" / `maglakbai.app`; in-app wordmark already correct.
- **QA validation:** `grep -rn "LakbAI" index.html public/manifest.json app.json` → no matches; portfolio share text cites `maglakbai.app`; build clean.
- **Effort:** XS · **Resolution (sprint 43):** Two passes. (1) Distribution surfaces: `index.html` (title + apple title + OG + Twitter), `public/manifest.json` (name + short_name), `app.json` (name + slug), `PortfolioScreen.tsx:242` (`skillforge.app` → `maglakbai.app`). (2) Deeper residue surfaced by the CI guard below: native bundle id + Android package (`com.skillforge.app` → `com.maglakbai.app`), Magic-Link deep-link scheme (`skillforge://auth` → `maglakbai://auth`), internal DOM event namespaces (`skillforge:consent-changed`, `skillforge:storage-quota-exceeded` → `maglakbai:*`, both ends matched), and the user-downloaded backup filename (`skillforge-backup-*.json` → `maglakbai-backup-*.json`). **Only** the `skillforge_v1` localStorage key is intentionally kept (renaming would orphan existing pilot data). **CI grep guard added** (`.github/workflows/ci.yml`) so any stale brand fails the build. 101 tests + build green after changes.

#### ANL-001 — Retention events wired to the wrong trigger (under-count) ✅ Resolved (this run)
- **Priority:** P1 · **Severity:** 🟠 High · **Category:** Analytics / Ops
- **Description:** The activation funnel (`onboarding_*`, `first_output_logged`, `output_logged`, `skill_completed`, `level_up`, `streak_milestone`) was well-instrumented, but the **retention** events were broken: `retention_d7`/`d30` fired from *inside* `logOutput` (`coreSlice.ts`) with exact-day equality (`daysSinceJoin === 7`). Retention measures whether a user **returns** — but this only fired if they happened to *log an output on the exact Nth calendar day*. A genuinely-retained user who opened the app on day 7 (or day 8) without logging produced **no event**, so D1/D7/D30 — the single most important pilot KPI — would have been massively under-counted. No dedup guard (multiple day-7 outputs → duplicate events); `retention_d1_activated` was also redundant with `first_output_logged`.
- **Business impact:** The pilot's go/no-go retention numbers would have been wrong (under-reported), risking a false "low retention → kill" or "looks fine" read on bad data.
- **Acceptance criteria:** retention_dN driven by **app opens** (session start), fired **once** per milestone, counting users active **on or after** day N. **QA validation:** `pendingRetentionMilestones` unit-tested (dedup, `>=`, back-fill, day-8 case); app boots cleanly with the session-start call (verified in preview — 0 console errors). **Effort:** S.
- **Resolution (sprint 43):** Added pure `pendingRetentionMilestones(daysSinceJoin, alreadyFired)` + session-based `trackRetention(joinedAt)` in `analytics.ts` (once-guarded via `sf_retention_fired`, consent-gated so the guard isn't burned pre-opt-in, cleared on analytics reset). Wired into `App.tsx` session-start + resume. Removed the broken block from `coreSlice.logOutput`. **7 new unit tests** (101 total green). Events renamed `retention_d1_activated`→`retention_d1`; semantics documented in `analytics.ts`.

#### OPS-001 — No error monitoring / alerting ✅ Resolved (this run)
- **Priority:** P1 (for public launch) / P2 (closed pilot) · **Severity:** 🟡 Medium · **Category:** Ops
- **Description:** Error boundaries recovered the UI but had **no `componentDidCatch`** — crashes were invisible. Once external users hit the pilot, nothing was reported.
- **Acceptance criteria:** Client error reporting wired (consent-respecting, PII-scrubbed) with an alert path. **QA:** forced error is captured; identical errors deduped; no PII in payload.
- **Effort:** S · **Resolution (sprint 43):** Added `src/utils/errorMonitor.ts` — `captureError()` routes crashes through the **existing consent-gated, PII-scrubbed `track()`** as a `client_error` event (no new vendor SDK, ~0 bundle cost; PostHog can alert on volume). Defensive sanitizing on top: emails redacted, URL query/hash stripped (auth tokens), message/stack truncated; per-session dedupe + 25-event cap prevent floods. Wired into **both** error boundaries (`App.tsx` root + `AppNavigator.tsx` per-screen `componentDidCatch`) and **global** `window` `error` + `unhandledrejection` handlers. **11 unit tests** (PII redaction, payload shape, dedupe signature). **Verified live in preview:** clean boot (0 console errors); a synthetic `unhandledrejection` carrying an email was captured; 3 identical errors produced 1 capture (dedupe confirmed). 112 tests total green. _Alert wiring is a PostHog dashboard config step (no code) — set an alert on `client_error` count._

#### QA-002 — EvolveScreen emitted DOM-nesting console errors (nested `<button>`) ✅ Resolved (this run)
- **Priority:** P2 · **Severity:** 🟡 Medium · **Category:** QA / Accessibility / Technical Quality
- **Description:** Surfaced during the sprint-43 **live test run** (mobile 375×812, full tab sweep). Navigating to **Evolve** emitted repeating React/RN-web `console.error`s: (1) **"validateDOMNesting: `<button>` cannot appear as a descendant of `<button>`"** (×8) — the roadmap cards (`renderRoadmapCard` priority + `renderCompactRoadmap` secondary) were a `TouchableOpacity` containing an inner `⋯` options `TouchableOpacity`; RN-web renders `accessibilityRole="button"` as a real `<button>`, so the card-button wrapped the options-button (DOM-verified: 2 nested buttons — "Options for AI Engineer", "Options for Data Architect"); (2) **"Unexpected text node: . A text node cannot be a child of a `<View>`"** (×16).
- **Business/Technical impact:** Nested interactive controls are invalid HTML and an **accessibility defect** (ambiguous focus/activation target). Also corrected the record: the report's "0 console errors" only ever covered the `background:` CSS storm (NEW-001); this was a separate, open source. Confirmed **not** captured by the OPS-001 monitor (these are `console.error` warnings, not thrown errors).
- **Acceptance criteria:** Evolve renders with **0** console errors; no `<button>` nested in a `<button>`; primary card tap + ⋯ options work independently.
- **Resolution (sprint 43):** Restructured both cards so the outer is a plain `View` container and the card-tap, the `⋯` options button, and (for the priority card) the "view skills" footer are **DOM siblings** — no nested interactive elements. Added `cardTapMain` + `compactMain` styles; visual layout unchanged. **Verified live in light mode:** `document.querySelectorAll('button button').length === 0`; a fresh `console.error` hook captured **0 errors** across repeated Evolve mounts (Home→Evolve→Profile→Evolve); the "Unexpected text node" warning also no longer fires. tsc + build clean; 112 tests green. **Effort:** S · Pre-existing (not introduced by sprint-43 changes).

#### UX-030 — Milestone "XP earned this session" under-reported actual XP gained ✅ Resolved (this run)
- **Priority:** P2 · **Severity:** 🟡 Medium · **Category:** UX / Trust
- **Description:** Found during the sprint-43 **live test run** completing a skill. `coreSlice.logOutput` built the celebration with `xpGained: totalXPGained = OUTPUT_XP + skillXP` (coreSlice.ts:207, 388) — **excluding** achievement XP (`bonusXP`) and streak-milestone bonus awarded by the *same* action. `MilestoneScreen` rendered this as "+{xpGained} XP — earned this session." Observed: completing **Python Fundamentals** (3rd skill) showed **"+195 XP"** while `user.xp` actually rose **+695** (1,435 → 2,130) because **`triple-master` (+500)** unlocked simultaneously — and that achievement was not surfaced on the milestone screen.
- **Business/User impact:** Under-credited the user at the highest-emotion moment and left a notable achievement uncelebrated — a numbers-don't-reconcile trust gap (same family as the resolved UX-025). XP was always **correctly stored** — purely a display/celebration-completeness gap.
- **Acceptance criteria:** The milestone "earned this session" figure equals the true session delta (incl. achievement + streak-milestone XP), **and** the unlocked achievement(s) are shown so the totals reconcile on screen. **Both** delivered.
- **Resolution (sprint 43):** Added `sessionXpGained = absoluteFinalXP − state.user.xp` and a `newAchievements` list (id/title/xpGranted) to the `logOutput` result + `PendingCelebration` (types: `UnlockedAchievementInfo`, `LogOutputResult`, `PendingCelebration`, `RootStackParamList.MilestoneDetail`). `MilestoneScreen` now shows `displayXp = sessionXpGained ?? xpGained` and renders an **"🏆 Achievement unlocked: <title> +XP"** card. Both nav paths updated (`LogOutputScreen` direct nav + `EvolveScreen` pendingCelebration, mapping `newAchievements`→`achievements`). The per-output stored `output.xpGained` is untouched (accounting unaffected). **Unit test added** (appStore.test.ts: `sessionXpGained === xpAfter − xpBefore === xpGained + Σ achievement grants`; 113 tests green). **Verified live (light mode):** completing REST APIs while crossing a 7-day streak showed **"+420 XP earned this session"** + "Achievement unlocked: Consistent +150"; persisted `user.xp` delta = exactly **420** (95 output + 150 skill + 150 achievement + 25 streak bonus). **Effort:** S · Pre-existing (not introduced by sprint-43 changes).

#### A11Y-011 — No full screen-reader / keyboard audit
- **Priority:** P2 · **Severity:** 🟡 Medium · **Category:** Accessibility
- **Description:** Labels/contrast/zoom/tap-targets are fixed, but no end-to-end VoiceOver/TalkBack + keyboard-only pass has been run. **Effort:** M.

#### CI-001 — The CI gate wasn't actually running (npm ci + tsc both failed) ✅ Resolved (this run)
- **Priority:** P1 · **Severity:** 🟠 High · **Category:** Ops / Stability
- **Description:** The report credited a "94-test CI gate" as a stability guarantee, but on a clean runner the workflow failed before it ever ran tests: (1) **`npm ci` failed** with ERESOLVE — `react-native-screens@4.25.1` peers `react-native >=0.82` while Expo 55 pins `0.76.9`, and there was **no `.npmrc`** to relax it; (2) **`tsc --noEmit` exited 2** — `@types/react-dom` was never installed (`web-index.tsx` TS7016). Local `node_modules` had been installed with `--legacy-peer-deps`, masking the problem; CI got neither that flag nor the types.
- **Business/Technical impact:** Every "CI is green" assumption was false — regressions and type errors could merge unguarded. This is a release-readiness gap, not cosmetic.
- **Acceptance criteria:** Fresh-runner `npm ci` succeeds; `tsc --noEmit` exits 0; tests + build run as gates. **QA validation:** `npm ci --dry-run` exit 0; `tsc --noEmit` exit 0; full local pipeline green.
- **Effort:** S · **Resolution (sprint 43):** Added `.npmrc` (`legacy-peer-deps=true`, documented as web/PWA-only rationale) so `npm ci` is deterministic; installed `@types/react-dom@^18` (TD-001). Verified `npm ci --dry-run` exit 0, `tsc --noEmit` exit 0, 101 tests green, build clean. **Also hardened the gate:** added a **brand guard** step to `.github/workflows/ci.yml` (fails the build on any stale `skillforge`/standalone `LakbAI` on a user-facing surface — protects BRAND-001).

#### TD-001 — Missing `@types/react-dom` (was breaking the CI type-check) ✅ Resolved (this run)
- **Priority:** P1 (reclassified up from P3 — it was failing the CI `tsc` gate, exit 2) · **Severity:** 🟠 High · **Category:** Technical Quality
- **Description:** `web-index.tsx` triggered TS7016 on `react-dom/client` because `@types/react-dom` was absent. Did not break the Vite build, but **did break `tsc --noEmit`** — the CI type-check step. **Resolution:** `npm i -D @types/react-dom@^18`; `tsc` now exits 0. Folded into CI-001. **Effort:** XS.

#### DOC-015 — Tagline mismatch (docs vs in-app)
- **Priority:** P3 · **Severity:** 🟢 Low · **Category:** Documentation
- **Description:** `CLAUDE.md` cites "Level up through proof, not promises" / "Stop watching. Start building." while the shipped in-app tagline is "Navigate Your Future. / Isulong ang pangarap." Pick the canonical line and align docs. **Effort:** XS.

---

## 🎯 BAEF Release Readiness Audit — Web/PWA Pilot (sprint 28, 2026-06-01)

_Applies the [Biboy Application Excellence Framework](../Biboy_BAEF/BAEF.md). This is the current source of truth for release readiness._

### Release Decision

**Decision:** ✅ **CONDITIONAL GO** for closed web/PWA pilot · ❌ **NO GO** for public launch or App Store _(reaffirmed sprint 41 — original sprint 28)_
**Release scope:** Closed **web / PWA pilot** (browser + Add-to-Home-Screen). **NOT** a native iOS App Store release.

- **P0 blockers:** 5 — **all RESOLVED** (sprint 28). See Resolved backlog below.
- **Conditions for the pilot to proceed / be monitored:**
  1. ✅ **Met (sprint 33):** real privacy contact set (`marlo.romanillos@gmail.com`); placeholder removed (PRIV-002 closed).
  2. ✅ **Met (sprint 41):** Supabase cloud backup live (ARCH-001 closed). Users can sign in with Magic Link to sync across devices. Export also available in Settings.
  3. Keep the community labeled **PREVIEW** with sample data clearly marked (TRUST-001 must not regress).
- **Rationale:** The core loop is polished and the privacy/consent posture is correct for a pilot. Since sprint 28 the pilot is on firmer footing: the store was decomposed (ARCH-002), a **94-test suite** now guards the core loop (domain + persistence + all store-action slices + FEAT-001 editable-roadmap tests), and the documentation set is complete. FEAT-001 (editable roadmaps) shipped sprint 37. Mobile responsiveness audit (sprint 38) fixed 4 issues. Sprint 40–41 closed the P1 console-error storm, added CSP security header, wired Supabase backend, fixed consent banner timing, and added starter XP on onboarding. We accept for **closed** validation: sample-only community (Phase 2) and god-component screens (ARCH-004).
- **Team sign-off:** Product, UX, Accessibility, Security, and Privacy cleared for **pilot scope**. Independent skeptics + QA withhold sign-off for **public/iOS launch** pending REL-001 (web/PWA positioning) and ARCH-004 (component tests).

### BAEF Production Readiness Scorecard (12 dimensions)

_Honest, skeptic-informed scores for the **web/PWA pilot** context. **Re-scored sprint 41** after closing P1 console errors (NEW-001), adding CSP header (NEW-011), fixing native compat gaps (NEW-004/005), wiring Supabase backend (ARCH-001), fixing consent banner timing (UX-028), and adding starter XP/streak on onboarding (UX-029). Sprint-38 baselines noted where scores moved._

| Dimension | Score | Notes |
|---|---|---|
| Product Strategy | 8/10 | Strong differentiator (proof-based progression). Community market demand layer (sprint 40) shows which skills are in demand by real users. FEAT-001 editable roadmaps add user agency. |
| UX | 9/10 _(was 8)_ | UX-028 fixed (consent no longer blocks Begin CTA). UX-029 fixed (25 XP + streak 1 on onboarding). Market demand gap strip on Dashboard. Remaining: UX-022 (this-week units), UX-026 (deferred). |
| Accessibility | 7/10 | Labels, AA contrast, pinch-zoom, tap-target all fixed. No full screen-reader/keyboard audit yet. |
| Performance | 8/10 | Vendor/nav chunk split. App chunk ~668KB (up from 192KB after Supabase SDK added — expected). Not load-tested. |
| Security | 8/10 _(was 6)_ | **CSP header added** (NEW-011). `background:` console errors eliminated (NEW-001). Supabase auth live (Magic Link). `window.location.origin` guarded (NEW-004). `import.meta.env` replaced with `__DEV__` (NEW-005). localStorage unencrypted (acceptable for pilot). |
| Stability | 9/10 | Per-screen + root error boundaries; **94 automated tests** (domain + persistence + all store-action slices) + **CI gate**. Supabase test crash fixed (browser-env guard). Remaining: no component/render or e2e tests (ARCH-004). |
| Scalability | 7/10 _(was 5)_ | **Supabase backend live (ARCH-001)** — Magic Link auth, cloud backup, multi-device sync, market signals. Still single-device community (Phase 2). |
| Technical Quality | 9/10 _(was 8)_ | All `background:` CSS shorthand replaced with `backgroundImage:`+`backgroundColor` fallback (128 console errors → 0). `getPathColor()` theme-aware path colors for light/dark mode. Screens still large (ARCH-004). |
| User Retention | 7/10 _(was 6)_ | Market demand layer (sprint 40) adds real signal for skill prioritization. Starter XP (25 + streak 1) on onboarding reduces drop-off. Loops unproven at scale; no push (Phase 3). |
| Operational Readiness | 8/10 | Netlify auto-deploy + CSP headers. Opt-in analytics. CI gates pushes. Still no error monitoring/alerting. |
| Documentation | 9/10 | Complete set: PRD, ARCHITECTURE, CLAUDE, ADRs, TESTING, DEPLOYMENT, CONTRIBUTING, SECURITY, PRIVACY, USER_GUIDE, CHANGELOG, LICENSE. NEW-009 naming mismatch resolved. |
| Release Readiness | 8/10 _(was 7)_ | **Web/PWA pilot: Conditional Go.** P1 NEW-001 closed; all UX pilot-blockers (UX-028/029) closed; ARCH-001 live. Remaining open P1: REL-001 (web/PWA positioning decision). |
| **Overall (pilot)** | **7.7/10** _(was 6.5 → 7.7 sprint 41)_ | **Conditional Go for CLOSED web/PWA pilot. NO GO for public/App Store.** Sprint 40–41 resolved the major blockers: 0 console errors, CSP header, Supabase backend, fixed first-run UX. Remaining P1: REL-001 (owner positioning decision). Core loop is solid and infrastructure is hardened for pilot. |

### Open Items — current (sprint 41)

At-a-glance view of everything still open. Full detail in the per-item entries below; closed items are in **Backlog — Resolved**.

| ID | Title | Priority | Status | Blocked by / depends on |
|----|-------|----------|--------|--------------------------|
| REL-001 | Native-iOS framing vs. web/PWA reality | P1 | Open | Owner positioning decision |
| ~~ARCH-001~~ | ~~No backend; localStorage-only~~ | P1 | ✅ Resolved (sprint 40) — Supabase backend live: auth, cloud backup, multi-device, market signals | — |
| ~~ARCH-003~~ | ~~Persistence: no schema versioning/migration~~ | P1 | ✅ Resolved (sprint 34) | — |
| ~~QA-001~~ | ~~Automated test coverage~~ | P1 | ✅ Resolved (sprint 34) — 94 tests + CI | — |
| ARCH-004 | God components (2,000+ line screens) + add component tests | P2 | Open | — |
| ARCH-005 | Model-layer feature bloat | P2 | Open | Product decision |
| ~~ARCH-006~~ | ~~XP logic leaking into views~~ | P2 | ✅ Resolved sprint 34 | — |
| ARCH-007 | Dual-build overhead (web-only) | P2 | Open | REL-001 |
| ~~BUG-012~~ | ~~Day-streak shows 0 after day-1 first output~~ | P2 | ✅ Resolved (sprint 33) | — |
| ~~DOC-013~~ | ~~Onboarding documented as 4 steps; actually 5~~ | P2 | ✅ Resolved (sprint 33) | — |
| ~~UX-017~~ | ~~Onboarding first-output "Log It" silently gated~~ | P2 | ✅ Resolved (sprint 33) | — |
| ~~UX-018~~ | ~~Home: over-spaced hero (dead space around the ring)~~ | P2 | ✅ Resolved (sprint 36) | — |
| ~~UX-019~~ | ~~Stat-label casing inconsistent (Home CAPS vs Profile Title)~~ | P3 | ✅ Resolved (sprint 35) | — |
| ~~UX-020~~ | ~~"Skills" count means 3 different things across screens~~ | P2 | ✅ Resolved (sprint 39) | — |
| ~~UX-021~~ | ~~Community header subtitle clipped at right edge~~ | P2 | ✅ Resolved (sprint 35) | — |
| UX-022 | "This week" metric presented 3 different ways | P3 | Open | — |
| ~~UX-023~~ | ~~Home hero overlaps header at short viewport heights~~ | P2 | ✅ Resolved (sprint 36) | — |
| ~~UX-024~~ | ~~Streak vs dormancy contradict~~ → **BUG-013** (decay read oldest output) | P2 | ✅ Resolved (sprint 35) | — |
| ~~UX-025~~ | ~~Profile XP Sources don't reconcile with Total XP~~ | P2 | ✅ Resolved (sprint 35) | — |
| UX-026 | Community "XP this week" counts output XP only | P3 | Deferred → Phase 2 | — |
| ~~UX-027~~ | ~~First-output step contradicts a "Fresh Start" beginner~~ | P2 | ✅ Resolved (sprint 36) | — |
| ~~UX-028~~ | ~~Consent banner fires before any value (hides "Begin" CTA)~~ | P2 | ✅ Resolved (sprint 40) — gated behind `hasOnboarded` in App.tsx | — |
| ~~UX-029~~ | ~~Slow time-to-first-win: skip → 0 XP/🔥0~~ | P2 | ✅ Resolved (sprint 40) — 25 XP + streak 1 granted on completeOnboarding; pre-completed skills credited | — |
| ~~FEAT-001~~ | ~~Editable journey/roadmap milestones~~ | P2 | ✅ Resolved (sprint 37) | — |
| ~~RES-001~~ | ~~"TOTAL XP ⓘ" tap target only 13px tall~~ | P2 | ✅ Resolved (sprint 38) | — |
| ~~RES-002~~ | ~~"Community" tab label truncates at 320px~~ | P2 | ✅ Resolved (sprint 38) | — |
| ~~RES-003~~ | ~~Filter chips horizontal scroll no right-edge affordance~~ | P3 | ✅ Resolved (sprint 38) | — |
| ~~RES-004~~ | ~~"MILESTONE MAP" header wraps at 320px~~ | P3 | ✅ Resolved (sprint 38) | — |
| ~~RES-005~~ | ~~"WEEKLY XP LEADERBOARD" header wraps at 320px~~ | P3 | ✅ Resolved (sprint 39) | — |
| RES-006 | Tablet (768px+): bare side bands — no visual separator | P3 | Open | Owner design decision |
| ~~NEW-001~~ | ~~128 console errors/session: `background:` CSS shorthand~~ | P1 | ✅ Resolved (sprint 41) — all 10 files fixed: `background:` → `backgroundImage:`+`backgroundColor` fallback | — |
| ~~NEW-004~~ | ~~`window.location.origin` in `auth.ts` — native incompatibility~~ | P2 | ✅ Resolved (sprint 41) — guarded with `typeof window !== 'undefined'` | — |
| ~~NEW-005~~ | ~~`import.meta.env` in `App.tsx` — Metro bundler incompatibility~~ | P2 | ✅ Resolved (sprint 41) — replaced with `__DEV__` (Vite define + Metro compatible) | — |
| NEW-007 | `app.json` missing required App Store fields | P2 | Open (deferred — web/PWA pilot only, no App Store target) | REL-001 |
| ~~NEW-011~~ | ~~Missing Content-Security-Policy header~~ | P2 | ✅ Resolved (sprint 41) — CSP added to `netlify.toml` covering self, Supabase, PostHog | — |
| NEW-006 | ~11 hardcoded hex values in `DashboardScreen.tsx` | P3 | Open | — |
| ~~NEW-009~~ | ~~`Colors.textSub` vs `Colors.textSecondary` naming mismatch~~ | P3 | ✅ Resolved (sprint 39 docs alignment) — CLAUDE.md updated | — |
| FEAT-002 | Pace mode has no gameplay weight | P3 | Deferred — intentional, Phase 2 | — |
| — | P3 product ideas (public profiles, GitHub links, referrals, push) | P3 | Open | Phase 2/3 |

**8 open items total — 1 × P1, 2 × P2, 5 × P3.** Sprint 40–41 closed: ARCH-001, UX-028, UX-029, NEW-001, NEW-004, NEW-005, NEW-009, NEW-011. Down from 18 open items.

**Recommended sequence (sprint 41):**

| When | Item | Why now |
|---|---|---|
| Owner decision | **REL-001** | Commit to web/PWA → ARCH-007 closes automatically; NEW-007 deferred until this resolves |
| Owner decision | **ARCH-005** | Keep-or-cut feature audit → reduces scope before Phase 2 |
| Ongoing | **ARCH-004** | Incremental — extract one sub-component at a time from the god screens |
| Design call | **RES-006** | 1-line box-shadow on `#root` if tablet side-band treatment is wanted |
| Nice-to-have | **NEW-006** | Convert ~11 hardcoded hex values in DashboardScreen to theme tokens (~30 min) |
| Phase 2 | **UX-022** | "This week" label consistency — wait for the real leaderboard to resolve all three surfaces |
| Phase 2 | **UX-026** | Community XP completeness — depends on ARCH-001 ✅ real leaderboard |

**Closed this run (sprint 41):** NEW-001, NEW-004, NEW-005, NEW-011, UX-028, UX-029 (via prior commit), ARCH-001 (via prior commit), NEW-009 (via prior commit). **Closed sprint 40:** ARCH-001, UX-028, UX-029, RES-005, UX-020. Previously closed: ARCH-002/003/006, QA-001, FEAT-001, RES-001–005, all DOC-*, PRIV-002, BUG-012/013, UX-017/018/019/021/023/024/025/027.

**ID prefixes:** `ARCH` architecture · `QA` testing/quality · `REL` release/positioning · `SEC` security · `PRIV` privacy · `A11Y` accessibility · `TRUST` trust/honesty · `DOC` documentation · `UX` user experience · `PERF` performance · `OPS` operational · `TD` tech debt · `BUG` defect · `RES` responsiveness/mobile · `FEAT` features.

### Backlog — P0 (Release Blockers) — ALL RESOLVED sprint 28

#### SEC-001 — PII sent to analytics without consent ✅ Resolved
- **Priority:** P0 · **Severity:** 🔴 Critical · **Category:** Security / Privacy
- **Description:** `analytics.ts` / onboarding `identify()` sent name + email to PostHog, with no consent gate — tracking fired on first launch.
- **Business impact:** GDPR/privacy non-compliance; trust and legal exposure. **Technical impact:** Coupled identity to a 3rd party with no opt-out. **User impact:** Personal data left the device without permission.
- **Acceptance criteria:** Nothing sent until explicit opt-in; name/email/handle/free-text never sent; user can revoke and data resets.
- **QA validation:** Fresh profile → no network calls to PostHog until "Allow"; payloads contain only anonymous ID + non-PII props; revoke clears the anonymous ID.
- **Effort:** M · **Dependencies:** none.
- **Resolution:** Opt-in consent gate + `scrubPII()` (name/email/handle/bio/full_name blocked); `post()` no-ops unless consent granted; revoke calls `reset()`. Dropped name/email from onboarding `identify()`.

#### PRIV-001 — No consent mechanism or privacy policy ✅ Resolved
- **Priority:** P0 · **Severity:** 🔴 Critical · **Category:** Privacy / Compliance
- **Description:** No consent UI and no privacy policy anywhere in-app.
- **Business impact:** Cannot lawfully collect analytics; blocks pilot invite. **Technical impact:** none. **User impact:** No transparency or control.
- **Acceptance criteria:** First-launch consent banner; readable privacy policy reachable from banner + Settings; analytics toggle in Settings.
- **QA validation:** Banner appears once on first launch; policy opens from banner and Settings; toggling Settings switch enables/disables tracking.
- **Effort:** M · **Dependencies:** SEC-001.
- **Resolution:** `ConsentBanner.tsx` + `PrivacyPolicyModal.tsx`; Settings → Data & Privacy analytics toggle. Verified end-to-end in browser.

#### A11Y-010 — Pinch-zoom disabled (WCAG 1.4.4) ✅ Resolved
- **Priority:** P0 · **Severity:** 🟠 High · **Category:** Accessibility
- **Description:** `index.html` viewport had `maximum-scale=1.0, user-scalable=no`, blocking zoom.
- **Business impact:** Accessibility-law risk; excludes low-vision users. **Technical impact:** none. **User impact:** Cannot zoom text/UI.
- **Acceptance criteria:** Users can pinch-zoom; meta viewport no longer disables scaling.
- **QA validation:** Pinch-zoom works on device; viewport tag lacks `maximum-scale`/`user-scalable=no`.
- **Effort:** XS · **Dependencies:** none.
- **Resolution:** Viewport changed to `width=device-width, initial-scale=1.0, viewport-fit=cover`.

#### SEC-002 — Error boundary leaks raw stack trace to users ✅ Resolved
- **Priority:** P0 · **Severity:** 🟡 Medium · **Category:** Security / UX
- **Description:** Root error boundary rendered raw error message + stack to end users in all builds.
- **Business impact:** Unprofessional; potential info disclosure. **Technical impact:** none. **User impact:** Scary/confusing crash screen.
- **Acceptance criteria:** Friendly recovery screen in production; raw stack only in dev.
- **QA validation:** Forced error shows friendly message + Reload in prod; stack shown only when `import.meta.env.DEV`.
- **Effort:** S · **Dependencies:** none.
- **Resolution:** Rewrote `App.tsx` ErrorBoundary — friendly message + Reload button; stack gated behind `IS_DEV`.

#### TRUST-001 — Mock community feed presented as live ✅ Resolved
- **Priority:** P0 · **Severity:** 🟠 High · **Category:** Product / Trust
- **Description:** Community feed + leaderboard showed fictional users as if real/live, with a "LIVE" badge.
- **Business impact:** Trust collapses the moment a user realizes it's fake. **Technical impact:** none. **User impact:** Misleading social proof.
- **Acceptance criteria:** Feed clearly labeled a preview; sample users/benchmarks marked as samples; user's own posts stay device-local with honest copy.
- **QA validation:** "PREVIEW" badge present; "sample benchmarks"/"SAMPLE" labels visible; coaching copy states posts stay on device.
- **Effort:** S · **Dependencies:** none.
- **Resolution:** Relabeled to PREVIEW; leaderboard marked "sample benchmarks"; subtitle + coaching banner state posts stay on device.

### Backlog — P1 (High priority — must-fix before public / iOS launch)

#### REL-001 — Positioned as native iOS but is a web/PWA app ✅ Resolved (sprint 44, 2026-06-13)
- **Priority:** P1 · **Severity:** 🟠 High · **Category:** Product / Release · **Effort:** XL
- **Description:** `app.json`/Expo config imply a native iOS App Store product, but there is no native build; the app is React-Native-Web + Vite, uses web-only APIs, and deploys to the web.
- **Business/Technical/User impact:** An App Store submission would fail or mislead; sets wrong expectations. Pilot is fine as web/PWA.
- **Acceptance criteria:** Either (a) commit to web/PWA and align all positioning/store assets, or (b) stand up a real native build + test on device before any App Store claim.
- **QA validation:** Release artifacts match the stated channel; no web-only API used on a native target.
- **Dependencies:** Architecture decision (web/PWA vs native).
- **Resolution (sprint 44):** Closed on **path (a) — commit to web/PWA**. The decision was made and accepted in **[ADR-0004](../docs/adr/0004-web-pwa-pilot-positioning.md)** ("Ship as a web/PWA pilot; defer native"), and confirmed still standing this run. **All user/stakeholder-facing positioning is already aligned to web/PWA** (audited 2026-06-13): `README.md` ("🚀 Live web / PWA pilot", live URL = the Netlify site), `CHANGELOG.md` ("Web/PWA only — no native build"), `CONTRIBUTING.md` ("Native iOS/Android is not part of the current pilot"), `docs/ARCHITECTURE.md` ("only the web/PWA target ships today"), `docs/USER_GUIDE.html` ("runs right in your browser — nothing to download from an app store"), and `docs/PRD.md` (app-store release listed under future/not-now). No surface tells a user or an App Store reviewer this is a native product. The only native-flavored artifacts remaining are **build config, not claims** — `app.json`'s `ios`/`android` blocks and `package.json`'s `expo start --ios/--android` dev scripts — which **ADR-0004 deliberately retains** so a future native build stays possible ("Keep the RN/Expo codebase … do not claim native until one is actually built and tested"). No code/behavior change required; verified no App-Store/native *claim* exists anywhere user-facing. **Re-opening native** (path b — a real EAS build + on-device test) remains a future option with no current driver (Phase 3 native push is the earliest trigger); the dual-tooling overhead is tracked separately as **ARCH-007**.

#### QA-001 — No automated test suite
- **Priority:** P1 · **Severity:** 🟠 High · **Category:** QA / Stability · **Effort:** L
- **Description:** All verification is manual/browser. No unit/integration/regression tests. (Architecture review ARCH-C folds into this item.)
- **Impact:** Regressions ship silently; refactors are risky; the ~4,400-line store is untested. This is the prerequisite that makes ARCH-002/003/004 refactors safe.
- **Acceptance criteria:** Test runner configured; store logic (XP, skill completion, prerequisite unlock, persistence) covered; CI runs on change.
- **QA validation:** `test` script green in CI; coverage on core store actions.
- **Dependencies:** none.
- **Status (sprint 34):** ✅ **Resolved** against acceptance — runner configured (Vitest), store logic covered, CI added. **76 tests** across: domain (`progression`, `leveling`, `skillGraph`), persistence (envelope/migration/validation), and **all store actions** — `appStore.test.ts` (onboarding, logOutput, validateSkill) **plus `slices.test.ts`** (feed: react/save/comment; profile: name/email/avatar/pace/goal/bio/theme + no-user guards; roadmap: addCustomPath, enroll, setPriority, switchPath, pause/archive/reactivate, addRoadmapItem). **CI runs on push/PR** via `.github/workflows/ci.yml` (tsc + `npm test` + build). _Remaining gap, folded into **ARCH-004**:_ no component/render tests for the large screens (logic was deliberately pulled into `src/domain` so the highest-value behavior is unit-testable without rendering).

#### ARCH-003 — Persistence has no schema versioning, migration, or validation
- **Priority:** P1 · **Severity:** 🟠 High · **Category:** Architecture / Stability · **Effort:** M
- **Description:** `loadFromStorage` does a bare `JSON.parse` of hardcoded key `skillforge_v1` and rehydrates via ad-hoc "healing" using `as any` (bypasses strict TS at the most data-critical boundary). No version field, no schema validation, no migration path. With no backend, localStorage IS the system of record (relates to ARCH-001 but is distinct).
- **Business impact:** Silent data loss or load-time crashes as the schema evolves erode trust.
- **Technical impact:** Schema changes force either an unsafe reuse of `_v1` or a key bump that wipes users; `as any` hides type regressions.
- **User impact:** Lost progress / broken app after an update.
- **Acceptance criteria:** Versioned payload (`{ schemaVersion, data }`); runtime validation (e.g. zod) on load; explicit migration functions per version bump; remove `as any` from rehydration.
- **QA validation:** Load tests with v0/old + malformed payloads → no crash, correct migration or clean reset; round-trip save/load preserves state.
- **Dependencies:** QA-001.
- **Status (sprint 34):** ✅ Resolved — `persistence.ts` now writes a versioned envelope `{ v: SCHEMA_VERSION, data }`, and `loadFromStorage` detects the version, runs a `migrate()` chain (legacy unversioned saves = v0 → migrated forward), validates shape (`isPlainObject`, rejects arrays/primitives/corrupt JSON), and returns `null` on a newer-than-current version (no downgrade crash). Typed `PersistedState` removed **all `as any`** from the rehydration block (+ the `us: any`). Lightweight hand-rolled validation (no zod dependency — noted as a future option). Verified: 7 new persistence unit tests (60 total green), `tsc` clean, `vite build` ✓, **live**: a real legacy v0 payload booted the app intact, and the next save was a `{v:1,data}` envelope.

#### ARCH-001 — No backend; localStorage-only ✅ Resolved (sprint 40)
- **Priority:** P1 · **Severity:** 🟠 High · **Category:** Architecture / Scalability · **Effort:** XL
- **Description:** Identity + all progress live in `localStorage`; no auth, no multi-device, lost on clear/incognito/device switch.
- **Resolution (sprint 40):** Supabase backend integrated — Magic Link auth, `profiles`/`outputs`/`skill_progress` tables, cloud backup via Settings → "Back up to cloud". `syncFromSupabase()` merges remote on sign-in (remote wins on XP/streak; union on outputs). Fire-and-forget sync on every `logOutput`. `src/lib/supabase.ts` + `src/lib/auth.ts` + `src/lib/db.ts`. `isSupabaseEnabled` guard ensures graceful localStorage fallback when env vars absent. Browser-env guard added (sprint 41) so tests don't crash on WebSocket init in Node.js.

### Backlog — P2 (Post-launch enhancements)
- Real weekly XP leaderboard (replace mock) · Follow/unfollow + real feed · Reaction/comment persistence via backend · AI-generated LinkedIn post (Edge Function) · Performance profiling under real load · Error monitoring/alerting (ops).

#### ARCH-004 — God components (2,000+ line screens)
- **Priority:** P2 · **Severity:** 🟡 Medium · **Category:** Technical Quality / Maintainability · **Effort:** L
- **Description:** `ProfileScreen` 2,992 · `DashboardScreen` 2,086 · `EvolveScreen` 1,886 lines — logic + styles + JSX inline, no decomposition.
- **Impact:** Hard to maintain/test/review; encourages copy-paste; slows iteration.
- **Acceptance criteria:** Extract presentational sub-components + hooks; no screen > ~600 lines; shared pieces reused.
- **QA validation:** Visual parity (tests + manual); extracted components unit-tested.
- **Dependencies:** QA-001.

#### ARCH-005 — Model-layer feature bloat / scope creep
- **Priority:** P2 · **Severity:** 🟡 Medium · **Category:** Product / Architecture · **Effort:** M
- **Description:** Store carries decay stages, burnout signals, mastery ladders, pace modes, validation challenges, comments, color scheme, multi-roadmap state — far beyond the documented MVP. Each adds persisted state + logic with no tests. BAEF exists to prevent exactly this.
- **Impact:** Compounds ARCH-002/003; more surface to break; diluted core loop.
- **Acceptance criteria:** Product decision per feature — keep (with tests + docs) or cut; document the decision; align CLAUDE.md/PRD.
- **QA validation:** Retained features tested + documented; cut features removed cleanly (incl. persisted fields + migration).
- **Dependencies:** Product decision; ARCH-003 (for clean field removal).

#### ARCH-006 — Business logic leaking into views ✅ Resolved sprint 34
- **Priority:** P2 · **Severity:** 🟡 Medium · **Category:** Technical Quality · **Effort:** S
- **Description:** XP totals computed inline in `LogOutputScreen`'s submit/preview path (`selectedType.xp + qualityBonus + takeawayBonus`) instead of the store/domain layer → two sources of truth for XP math.
- **Impact:** Screen and store XP calculations can diverge → wrong XP shown vs awarded.
- **Acceptance criteria:** Single XP calculator in `src/domain/`; screen calls it; no inline XP arithmetic in screens.
- **QA validation:** Preview XP === awarded XP across all output types (tested).
- **Dependencies:** ARCH-002 (domain extraction).
- **Resolution (sprint 34):** Added `calculateOutputXP(type, descriptionLength, hasKeyTakeaway)` and `OUTPUT_XP_BY_TYPE` to `src/domain/progression.ts`. `coreSlice.ts` now calls `calculateOutputXP()` instead of inlining the math. `LogOutputScreen.tsx` imports both — `OUTPUT_XP_BY_TYPE` feeds the `OUTPUT_TYPES` display array (so the base XP labels are always in sync), and `calculateOutputXP()` drives the live XP preview. Added 11 tests in `progression.test.ts` covering per-type base values, quality-bonus thresholds (50-char +10, 120-char +20), takeaway bonus (+15), bonus stacking, and a consistency check across the full type table. **57 tests total, all passing (46 + 11 new).**

#### ARCH-007 — Dual-build overhead for a web-only pilot
- **Priority:** P2 · **Severity:** 🟢 Low · **Category:** Architecture / Ops · **Effort:** M (decision)
- **Description:** Maintains RN + react-native-web + Vite + Expo/Metro (with `@ts-ignore` CSS shims) while the only shipping target is web/PWA.
- **Impact:** Two bundlers + a compat shim layer to keep working for a native build that doesn't ship.
- **Acceptance criteria:** Decide web-only vs native (ties to REL-001); if web-only, document the native path as deferred and stop carrying unused config; if native, stand up + test a real build.
- **QA validation:** Single documented build path for the active target; no dead config.
- **Dependencies:** REL-001 (positioning decision).

#### BUG-012 — Day-streak shows 0 after the day-1 first output
- **Priority:** P2 · **Severity:** 🟢 Low · **Category:** UX / Defect · **Effort:** XS
- **Description:** Found in the sprint-33 onboarding test. After completing onboarding + logging the first output (same day), the Dashboard shows **"0 DAY STREAK"** even though today's week-grid dot is filled and "THIS WEEK" = 1. Root cause: `completeOnboarding` sets `user.lastActiveDate = today`, so the first `logOutput` hits the same-day branch and `newStreak` stays at the initial `0`. A first-ever activity day should read as a 1-day streak.
- **Business/User impact:** A brand-new user's first-impression dashboard shows an inconsistent/zero streak — undercuts the core streak motivation on day one.
- **Technical impact:** Minor; isolated to streak init vs. first-log interaction.
- **Acceptance criteria:** After onboarding + first output on the same day, streak reads **1** (and the today-dot + "this week" stay consistent). Logging again the same day does not double-increment.
- **QA validation:** Repeat the onboarding test → Dashboard shows "1 DAY STREAK"; add a store-action test for "first output sets streak to 1" (extends QA-001).
- **Dependencies:** none.
- **Status (sprint 33):** ✅ Resolved — removed the `lastActiveDate` pre-set from `completeOnboarding` (coreSlice) so the first `logOutput` hits the `!lastActive → streak = 1` branch. Added test "starts the streak at 1 on the day-1 first output (BUG-012)" and updated the same-day test (now expects 1). 53 tests green; `tsc` clean; `vite build` passes.

#### DOC-013 — Onboarding documented as 4 steps; it's actually 5
- **Priority:** P2 · **Severity:** 🟡 Medium · **Category:** Documentation · **Effort:** XS
- **Description:** Found in the sprint-33 onboarding test. Docs (`CLAUDE.md`, likely `docs/PRD.md` and `docs/USER_GUIDE.html`) describe a **4-step** onboarding (welcome → name → path → first output). The real flow is **5 steps**: welcome → identity (name/email) → path → **experience level** ("Where are you starting from?") → first output.
- **Impact:** Doc/onboarding mismatch; user guide understates the flow.
- **Acceptance criteria:** All docs describe the 5-step flow incl. the experience-level step (and its beginner/building/experienced pre-credit behavior).
- **QA validation:** Doc step list matches `OnboardingScreen.tsx`.
- **Dependencies:** none.
- **Status (sprint 33):** ✅ Resolved — updated to the 5-step flow (added the experience-level step + name/email) in `CLAUDE.md` (×2), `README.md`, `docs/USER_GUIDE.html` (+ "Step 3 of 5" caption, synced to `public/`), and both daily-QA skill copies. No "4-step" references remain.

#### UX-017 — First-output "Log It" silently gated (no inline hint)
- **Priority:** P2 · **Severity:** 🟢 Low · **Category:** UX · **Effort:** S
- **Description:** Found in the sprint-33 onboarding re-drive. On the onboarding first-output step, **"Log It & Start My Journey"** does nothing until *both* an output type is selected *and* a description is entered — but there is no inline message explaining the requirement; the press just no-ops. A first-time user could tap it and be confused why nothing happens.
- **Business/User impact:** Friction at the most activation-critical moment (the very first log); risk of drop-off / "is it broken?".
- **Scope (verified sprint 33):** **`OnboardingScreen` only.** `LogOutputScreen` does NOT share the silent no-op — it disables the button (`disabled={!canSubmit || submitting}`), dims it (`submitBtnDisabled` → `opacity: 0.35`), and sets `accessibilityState={{ disabled }}`. It is the pattern to copy; its only minor gap is no explicit text hint (acceptable — a dimmed/disabled button is a standard affordance).
- **Technical impact:** Minor; make `OnboardingScreen`'s first-output button mirror `LogOutputScreen` — compute `canSubmit = title.trim() && description.trim()`, then disable + dim it (and ideally add a one-line hint).
- **Acceptance criteria:** On the onboarding first-output step, when requirements are unmet the button reads clearly disabled (dimmed) and never silently no-ops; with both fields it submits. (`LogOutputScreen` already meets this.)
- **QA validation:** With type-only / description-only, the onboarding button shows disabled; with both, it submits.
- **Dependencies:** none. (LogOutputScreen verified clean — no change needed there beyond an optional hint.)
- **Status (sprint 33):** ✅ Resolved — `OnboardingScreen` first-output button now mirrors `LogOutputScreen`: `disabled={!canSubmit}` + `accessibilityState={{ disabled }}` (was tap-then-no-op), keeps the `btnDisabled` dim (opacity 0.35), and adds an inline hint "Add a title and a short description to continue." Live-verified: empty → `aria-disabled=true`, `tabindex=-1`, hint shown; filled → enabled, submits, lands Home. `tsc` clean; `vite build` passes.

#### UX-018 — Home: over-spaced hero (dead space around the evolution ring)
- **Priority:** P2 · **Severity:** 🟢 Low · **Category:** UX · **Effort:** S
- **Description:** Found in the sprint-35 UI/UX review. On `DashboardScreen` at normal mobile height (375×812) there are two large vertical gaps — header → ring (~140px) and the "XP to complete" line → stats card (~140px). The hero floats mid-screen with a lot of emptiness while other screens (Evolve/Profile) are dense.
- **Acceptance criteria:** Tighten hero vertical spacing so Home reads as intentionally composed (no >~80px empty bands); content balanced top-to-bottom.
- **QA validation:** Visual check at 812px height; no large empty bands above/below the ring.
- **Dependencies:** none.
- **Status (sprint 36):** ✅ **Resolved** — root cause was `ringSection: { flex: 1 }` which expanded the ring area to fill all remaining screen height. Resolved by wrapping the evolution view in a `ScrollView` (UX-023 fix) and removing `flex: 1` from `ringSection`. Ring now sits at its natural height (no more dead-centered floating).
- **Verification (sprint 36, independent):** committed (`a7c8b70`); `tsc` clean, `vite build` ✓; live at 375×812 the hero is top-anchored (the two centered gaps are gone). Minor residual: for sparse content (e.g. a brand-new user) some whitespace remains *below* the last card — expected (content top, slack bottom) and far less jarring than the prior centered floating.

#### UX-019 — Stat-label casing inconsistent across screens
- **Priority:** P3 · **Severity:** 🟢 Low · **Category:** UI · **Effort:** XS
- **Description:** Home stat labels are ALL-CAPS (`TOTAL XP`, `DAY STREAK`, `THIS WEEK`); Profile stat labels are Title Case (`Total XP`, `Day Streak`, `Skills Done`). Same data, two styles. App section labels are ALL-CAPS elsewhere, so Profile is the outlier.
- **Acceptance criteria:** One casing convention for stat labels app-wide (align to the ALL-CAPS section-label style).
- **QA validation:** Home and Profile stat labels render in the same case.
- **Dependencies:** none.
- **Status (sprint 35):** ✅ Resolved — added `textTransform: 'uppercase'` to Profile's `statLabel`; labels now render `TOTAL XP / OUTPUTS / DAY STREAK / SKILLS DONE`, matching Home. Live-verified.

#### UX-020 — "Skills" count means three different things ✅ Resolved (sprint 39)
- **Priority:** P2 · **Severity:** 🟡 Medium · **Category:** UX / Trust · **Effort:** S
- **Description:** Home/Evolve showed **2/5 skills** (completed/total), Profile showed **2 Skills Done** (completed), Portfolio showed **3 SKILLS** (skills with outputs). One word, three values — users can't tell which is "right."
- **Resolution (sprint 39):** Disambiguated all three labels: (1) Dashboard ring text: `X / Y skills` → `X / Y skills completed` (`DashboardScreen.tsx`). (2) Profile stat label: `Skills Done` → `Skills Completed` (`ProfileScreen.tsx`). (3) Portfolio stat label: `skill`/`skills` → `skill started`/`skills started` (`PortfolioScreen.tsx`). Three distinct terms now clearly signal: "completed" = finished milestone, "started" = any outputs logged.
- **QA validation:** Each "skills" figure has an unambiguous label; cross-screen meanings don't collide. ✓ live-verified.
- **Dependencies:** none.

#### UX-021 — Community header subtitle clipped
- **Priority:** P2 · **Severity:** 🟢 Low · **Category:** UI · **Effort:** XS
- **Description:** On `FeedScreen` the subtitle "A preview of what builders share — your posts stay on this device" is cut off at the right edge ("…on this d") at 375px width — no wrap/ellipsis.
- **Acceptance criteria:** Subtitle wraps (or is shortened) so the full sentence is readable at ≥375px.
- **QA validation:** Full subtitle visible at 375px.
- **Dependencies:** none.
- **Status (sprint 35):** ✅ Resolved — gave the title/subtitle `<View>` `flex: 1` (+ small right margin) in `FeedScreen.headerTop` so the subtitle wraps within the `space-between` row instead of overflowing. Live-verified: full sentence wraps to two lines at 375px.

#### UX-022 — "This week" metric presented three ways
- **Priority:** P3 · **Severity:** 🟢 Low · **Category:** UX · **Effort:** S
- **Description:** Home shows a primary stat `THIS WEEK 1` (ambiguous unit), Profile shows `+1 this wk` under Outputs, Community leaderboard shows `135 XP this week`. Inconsistent presentation/units of "this week."
- **Acceptance criteria:** Consistent label + unit for the weekly metric; Home's "THIS WEEK" states its unit (outputs vs XP).
- **QA validation:** "This week" reads consistently across Home/Profile/Community.
- **Dependencies:** none.

#### UX-023 — Home hero overlaps the header at short viewport heights
- **Priority:** P2 · **Severity:** 🟡 Medium · **Category:** UX / Responsive · **Effort:** M
- **Description:** At ~384×622 (landscape / small browser window) the `DashboardScreen` evolution ring renders **on top of** the header (name/streak) — the screen isn't scrollable at that height so the hero collides. Clean at 812px tall.
- **Acceptance criteria:** Home content is scrollable / reflows without overlap at short heights (≥~600px); no element overlaps another.
- **QA validation:** Resize to 384×622 → no overlap; content scrolls if needed.
- **Dependencies:** none.
- **Status (sprint 36):** ✅ **Resolved** — wrapped the evolution view (ring + stats + cards) in a `ScrollView` with `style={{ flex: 1 }}`. Content now scrolls at any height instead of overflowing into the header. Also removed `flex: 1` from `ringSection` (resolves UX-018 dead-space as a side effect). Files: `src/screens/DashboardScreen.tsx`.
- **Verification (sprint 36, independent):** committed (`a7c8b70`); reproduced the original repro at **384×622** → **no overlap** (header → ring → stats → card all render cleanly); `tsc` clean, `vite build` ✓.

#### UX-024 — Streak stat vs. dormancy card can contradict
- **Priority:** P2 · **Severity:** 🟡 Medium · **Category:** UX · **Effort:** S · **Status:** 🔶 Pending verification
- **Description:** Found in the review with time-aged test data: a **5-day streak** stat showed alongside a **"13 days away — your momentum is waiting"** dormancy card. The streak number doesn't reflect lapse, so a dormant user may see a stale streak next to a "you've been gone" card. **Needs verification with clean/real data** to confirm it's not solely a test-data artifact.
- **Acceptance criteria:** When the dormancy/decay card is shown, the streak display reconciles (e.g. shows "at risk"/reset) — the two never assert contradictory states.
- **QA validation:** Reproduce with an aged `lastActiveDate`; confirm whether streak + dormancy contradict; if real, fix.
- **Dependencies:** none.
- **Status (sprint 35):** ✅ **Resolved — confirmed a real logic bug (BUG-013), fixed.** Root cause: `logOutput` *appends* outputs (newest last), but `DashboardScreen.daysSinceLastOutput` read `outputs[0]` (the **oldest**), so decay/dormancy fired off a user's *first* output date — a 7+-day-old first output showed a false "you've been away N days" card even after logging today (this is the "13 days away" seen with a same-day output). Fixed to compute days-since from the most-recent `createdAt` (order-independent: `max` reduce). Live-verified: active user (logged today, 7-day streak) now shows the correct "next milestone" nudge, no dormancy card. The streak/dormancy contradiction was a symptom of this.

#### UX-025 — Profile "XP Sources" don't reconcile with Total XP
- **Priority:** P2 · **Severity:** 🟡 Medium · **Category:** UX / Correctness · **Effort:** S · **Status:** 🔶 Pending verification
- **Description:** Found in the review: Profile "XP Sources" showed Outputs **+320** + Achievements **+375** = **695**, but Total XP = **625** — the breakdown counts an achievement's XP that was revoked on load by the healing logic. **Needs verification with clean data** (the revoke was triggered by deliberately-inconsistent test data); confirm whether the breakdown can over/under-count for real users.
- **Acceptance criteria:** XP-source breakdown sums to Total XP for all states (incl. post-revoke healing).
- **QA validation:** Construct a state where an achievement is revoked on load; confirm the breakdown matches Total XP; if it diverges, fix the source calc.
- **Dependencies:** none.
- **Status (sprint 35):** ✅ **Resolved.** Extracted the load-time heal into a pure, tested `src/domain/hydration.ts` → `reconcileAchievementsAndXP()`, which now **credits the XP of newly-added (missed) achievements** (alongside the existing revoke-deduct + no-history cap). `appStore.ts` calls it (and the old inline block + a now-dead `skillGraph` import were removed). Result: breakdown reconciles and the user gets the XP they earned. 5 new unit tests (no-op consistent, missed-credit, revoke-deduct, no-history cap, active-not-capped) — 81 total green. **Live-verified:** clean user missing `evolution` loaded → Total XP 595 → **695** (evolution +100 credited), Profile XP Sources **320 + 375 = 695** (reconciles).

### Backlog — P3 (Future ideas)
- Public profile URLs (`/@handle`) · GitHub links on outputs · Referral system · Cohort/team support · Recruiter-facing profile view · Push notifications (streak reminders).

#### FEAT-002 — Pace mode has no real gameplay weight
- **Priority:** P3 · **Category:** Product / Gamification · **Effort:** M · **Status:** ⏸ Deferred — intentional for pilot
- **Description:** Pace mode (Sprint / Steady / Recovery) exists in the store and UI but has minimal effect today. Currently: **Sprint** does nothing different. **Steady** is the default with no change. **Recovery** suppresses the burnout nudge card on Home and highlights the Reflect output type (+30 XP). That's it — changing modes has no XP, streak, or evidence-gate effect.
- **What it should eventually do:**
  - **Sprint 🚀** — XP multiplier (e.g. ×1.25) for a 7-day window. Encourages bursts of logging; creates a meaningful "push hard this week" decision.
  - **Recovery 🌿** — Auto-applies a streak freeze for the duration; reduces the evidence gate to "logged" tier (no 50-char description required); lowers anxiety around taking a real break.
  - **Steady ⚡** — Default. No change. The reference state.
- **Owner decision (sprint 39):** Leave as-is during the pilot. The current lightweight implementation is acceptable while validating the core loop. Add gameplay weight in Phase 2 after real user behaviour data is available.
- **Dependencies:** ARCH-001 (backend) — streak freeze auto-apply and XP multipliers need server-side validation to prevent abuse in a multi-user context.

#### UX-026 — Community "XP this week" counts output XP only
- **Priority:** P3 · **Severity:** 🟢 Low · **Category:** UX / Correctness · **Effort:** S (interim) / M (full) · **Status:** ⏸ Deferred to Phase 2
- **Description:** The Community leaderboard's weekly XP (`FeedScreen.tsx` `weeklyUserXP`) sums only `output.xpGained` from the last 7 days. It excludes achievement XP, streak milestone bonuses, career-outcome XP, and the skill-validation bonus — because only outputs carry a `createdAt` the code can window to "this week"; the other awards aren't timestamped per-award. Label says "XP this week" (implies all XP) but it's output-XP-only.
- **Impact:** A week where the user unlocked an achievement / hit a streak milestone / logged an outcome under-reports their weekly XP. (Mitigated for now: the three leaders are fixed **SAMPLE** benchmarks, so the ranking isn't a real comparison yet.)
- **Decision (owner, sprint 35):** **Hold for the fuller fix when the real weekly leaderboard lands in Phase 2** (depends on ARCH-001 backend). The full fix timestamps achievement/streak/outcome/validation awards so weekly XP can include them.
- **Interim option (not taken):** relabel "XP this week" → "Output XP this week" (~1 line) so the number matches its meaning until Phase 2.
- **Acceptance criteria:** Weekly XP reflects all XP earned in the window (or the label unambiguously states it's output-only).
- **Dependencies:** ARCH-001 (backend / real leaderboard).

#### UX-027 — First-output step contradicts a "Fresh Start" beginner
- **Priority:** P2 · **Severity:** 🟠 High (activation) · **Category:** UX / Onboarding · **Effort:** S
- **Description:** From the sprint-36 first-time-user simulation (top abandonment risk). A user who picks **"Fresh Start — just beginning this path"** was immediately asked **"Prove it with your first output — what have you *already* built, read, or earned?"** A genuine beginner has nothing to log → forced to fabricate or skip; the demand contradicts the experience level they just chose.
- **Acceptance criteria:** The first-output step's framing matches the chosen level; for beginners it's forward-looking and logging is clearly optional, with skip a first-class choice.
- **Status (sprint 36):** ✅ Resolved — reframed the beginner branch in `OnboardingScreen.FirstOutputStep`: heading "Start with one small step." + subtitle "New to this? Log anything you've already tried … Nothing yet? Tap Skip and we'll line up your first mission," and the skip relabeled "I'm just getting started — skip →". Experienced/building/custom branches unchanged. `tsc` clean, build ✓, live-verified.

#### UX-028 — Consent banner fires before any value
- **Priority:** P2 · **Severity:** 🟡 Medium · **Category:** UX / Onboarding · **Effort:** M
- **Description:** From the first-run sim. On first load the analytics consent banner overlays the welcome and **hides the "Begin Your Journey" CTA** — the very first interaction is a privacy decision, before the user sees what the app does.
- **Acceptance criteria:** The primary CTA is visible/usable before any consent decision; consent is non-blocking (e.g. show after onboarding or as a dismissible chip).
- **Dependencies:** none. (Owner call on timing — keep opt-in posture.)

#### UX-029 — Slow time-to-first-win for new users
- **Priority:** P2 · **Severity:** 🟡 Medium · **Category:** UX / Activation · **Effort:** M
- **Description:** From the first-run sim. Onboarding promises "Gain XP," but a beginner who skips the first output lands at **0 XP / 🔥0**, and the first real reward (skill unlocked, +100 XP) requires **2 outputs AND the evidence gate** (link or 50+ char description). The first dopamine hit is far for a casual evaluator.
- **Acceptance criteria:** Guarantee a small immediate win (e.g. grant a starter achievement/XP on completing onboarding even when skipping the output, and/or let the very first skill complete on 1 output).
- **Dependencies:** none. (Product decision; relates to the evidence-gate tuning.)

---


### Backlog — Resolved (BAEF, sprints 28–33)

Closed items, kept for governance history. Full implementation detail is in the Run Log.

#### ARCH-002 — Store is a god object (`src/store/appStore.ts`, 4,378 lines)
- **Priority:** P1 · **Severity:** 🟠 High · **Category:** Architecture / Technical Quality · **Effort:** L
- **Description:** One file mixes four concerns: ~1,900 lines of inline `ALL_SKILLS` catalog, ~700 lines of `MOCK_FEED`, all domain calculators (`getDecayStage`, `getBurnoutSignal`, `getCareerMastery`, mastery tiers), the persistence layer, and 40+ mutating actions.
- **Business impact:** Slows every change; raises defect risk; hard to onboard contributors.
- **Technical impact:** Un-reviewable diffs, merge-conflict magnet, untestable as units.
- **User impact:** Indirect — slower, riskier delivery of fixes/features.
- **Acceptance criteria:** Static catalog → `src/data/`; pure calculators → `src/domain/`; actions split into Zustand slices; `appStore.ts` becomes composition + wiring only.
- **QA validation:** No behavior change (tests from QA-001 stay green); each extracted module imported and unit-tested; file < ~500 lines.
- **Dependencies:** QA-001 (tests must exist first).
- **Status (sprint 29-32):** ✅ **Resolved.** Fully decomposed: pure calculators → `src/domain/progression.ts`; static catalog → `src/data/{careerPaths,skills,achievements,mockFeed}.ts`; skill-graph/achievement helpers → `src/domain/skillGraph.ts`; persistence → `src/store/persistence.ts`; and the **36 actions split into 4 Zustand slices** (`src/store/slices/{core,roadmap,feed,profile}Slice.ts`). `appStore.ts` is now state-init + slice composition + wiring only: **4,378 → 274 lines (−94%)**, under the <500 target. Everything re-exported so no screen import changed. Verified: `tsc` clean on store/slices/data/domain; **46 unit + integration tests** green; **`vite build` passes**. Action bodies moved verbatim (behavior-preserving); the core loop is covered by store-action tests (QA-001).

#### DOC-001 — CLAUDE.md ↔ architecture drift
- **Priority:** P1 · **Severity:** 🟡 Medium · **Category:** Documentation · **Effort:** XS
- **Description:** `CLAUDE.md` documents 7 screens / ~6 components and a small store; reality is 9 screens / 10 components (Portfolio, Settings, ValidationChallengeModal, LevelUpOverlay, ConsentBanner, PrivacyPolicyModal undocumented) plus 40+ store actions and many undocumented features. Violates BAEF's own "stale doc" lesson.
- **Acceptance criteria:** CLAUDE.md project map matches the actual `src/` tree, screen/component list, and store action surface.
- **QA validation:** Every screen/component/action in `src/` appears in CLAUDE.md and vice-versa.
- **Dependencies:** none.
- **Status (sprint 30):** ✅ Resolved — CLAUDE.md refreshed: 9 screens / 10 components, new `src/data` + `src/domain` folders, 19 career paths, 8 achievements, Settings/Portfolio stack screens, per-screen ErrorBoundary, Vitest/`npm test`, real persisted-field list + ARCH-003 caveat, and catalog/achievement file-location updates in Coding Conventions.

#### PRIV-002 — Placeholder privacy contact
- **Priority:** P1 · **Severity:** 🟡 Medium · **Category:** Privacy / Documentation · **Effort:** XS
- **Description:** Privacy policy uses `privacy@maglakbai.app` placeholder.
- **Acceptance criteria:** Real monitored contact before external users.
- **QA validation:** Policy shows a real address; email deliverable.
- **Dependencies:** Business decision on contact.
- **Status (sprint 33):** ✅ Resolved — real contact `marlo.romanillos@gmail.com` set in all three places: `PrivacyPolicyModal.tsx` (`PRIVACY_CONTACT`, the in-app authoritative one), `SECURITY.md`, and `docs/PRIVACY.md`. Placeholder + warnings removed.

#### DOC-002 — ARCHITECTURE.md is stale (contradicts post-ARCH-002 code)
- **Priority:** P1 · **Severity:** 🟠 High · **Category:** Documentation · **Effort:** M
- **Description:** `docs/ARCHITECTURE.md` ("as of sprint 26") describes a single Zustand store with the static catalog defined in `appStore.ts`, and a decision section "Why one Zustand store (not per-domain stores)" — all false after ARCH-002 (now `src/data/`, `src/domain/`, 4 slices, `persistence.ts`). No mention of the test layer (Vitest). It's the BAEF Phase 3 artifact and is actively wrong.
- **Business/Technical/User impact:** Misleads any contributor/reviewer; a wrong architecture doc is worse than none (BAEF lesson); undermines the Phase 3 gate.
- **Acceptance criteria:** Rewrite to reflect the real module map (data/domain/store-slices/persistence), the test strategy, web/PWA framing, and updated decision records.
- **QA validation:** Every module in `src/` is represented; no statement contradicts the code; decisions match reality.
- **Dependencies:** none.
- **Status (sprint 33):** ✅ Resolved — rewrote `docs/ARCHITECTURE.md`: added a Module Map (data/domain/store-slices/persistence), rewrote the State section for the sliced store + 13 persisted fields, added a Testing section, corrected the XP model (per-type + quality/takeaway bonuses + evidence gate, not flat 50), refreshed navigation (Settings/Portfolio + per-screen ErrorBoundary), de-duplicated design tokens to point at `theme.ts`, and updated the decision records. Flagged the ARCH-003 persistence caveat inline.

#### DOC-003 — No LICENSE
- **Priority:** P1 · **Severity:** 🟡 Medium · **Category:** Documentation / Legal · **Effort:** XS
- **Description:** Public GitHub repo (`mromanil0310/skillforge`) has no license → all-rights-reserved by default.
- **Impact:** Ambiguous reuse terms; blocks any open contribution/sharing.
- **Acceptance criteria:** A `LICENSE` file committed (license choice is the owner's call).
- **QA validation:** GitHub shows the chosen license in the repo header.
- **Dependencies:** Owner decision on license.
- **Status (sprint 33):** ✅ Resolved — added a **proprietary "All Rights Reserved"** `LICENSE` (the reversible default for a product brand; can be relaxed to MIT/Apache later if open-sourcing is desired). Owner can swap anytime.

#### DOC-004 — No .env.example
- **Priority:** P1 · **Severity:** 🟡 Medium · **Category:** Documentation / DX · **Effort:** XS
- **Description:** `VITE_POSTHOG_API_KEY` / `VITE_POSTHOG_HOST` (and planned Supabase/OpenAI vars) are referenced in code + docs but there's no template env file.
- **Impact:** Dev-onboarding friction; analytics/Phase-2 setup is undiscoverable.
- **Acceptance criteria:** `.env.example` lists all recognized vars with comments; referenced from README/CONTRIBUTING.
- **QA validation:** Copying `.env.example` → `.env` and filling values activates the relevant features.
- **Dependencies:** none.
- **Status (sprint 33):** ✅ Resolved — added `.env.example` (PostHog key/host + planned Supabase vars, all optional, with comments). Confirmed not excluded by `.gitignore`.

#### DOC-005 — No DEPLOYMENT doc
- **Priority:** P1 · **Severity:** 🟡 Medium · **Category:** Documentation / Ops · **Effort:** S
- **Description:** The deploy path (Vite build, `vercel.json` rewrites/headers, GitHub Pages for `USER_GUIDE.html`, the FUSE build workaround) lives only scattered across the QA skill + run log.
- **Impact:** Releases depend on tribal knowledge; risky/irreproducible.
- **Acceptance criteria:** `docs/DEPLOYMENT.md` documents local build, web/PWA deploy (Vercel), the guide's GitHub Pages path, env vars, and the FUSE workaround.
- **QA validation:** A new contributor can deploy from the doc alone.
- **Dependencies:** none.
- **Status (sprint 33):** ✅ Resolved — added `docs/DEPLOYMENT.md`: scripts table, Vercel first-time + per-release flow, static-file-vs-rewrite precedence note, Netlify alt, GitHub Pages guide path, FUSE workaround, and a pre-deploy checklist.

#### DOC-006 — No TESTING doc
- **Priority:** P2 · **Severity:** 🟡 Medium · **Category:** Documentation / QA · **Effort:** S
- **Description:** 46 Vitest tests exist but nothing documents how to run them (`npm test`), what's covered (domain vs store-action), the verification approach, or known gaps (roadmap/feed/profile slices untested).
- **Acceptance criteria:** `docs/TESTING.md` covers run commands, coverage map, conventions ("new domain logic ships with a test"), and the gap list.
- **QA validation:** Doc matches the actual `src/**/__tests__` layout and `package.json` scripts.
- **Dependencies:** none.
- **Status (sprint 33):** ✅ Resolved — added `docs/TESTING.md` (run commands, 46-test coverage map across domain + store-action layers, conventions, known gaps, refactor-verification ladder).

#### DOC-007 — No CONTRIBUTING doc
- **Priority:** P2 · **Severity:** 🟡 Medium · **Category:** Documentation / DX · **Effort:** S
- **Description:** No contributor-facing setup/run/test/build + conventions doc (CLAUDE.md is agent-facing).
- **Acceptance criteria:** `CONTRIBUTING.md`: prerequisites, install, `npx vite`, `npm test`, build, coding conventions, PR expectations.
- **QA validation:** A new contributor can go from clone → running app → green tests using only the doc.
- **Dependencies:** DOC-004 (.env.example).
- **Status (sprint 33):** ✅ Resolved — added `CONTRIBUTING.md` (setup/run/test/build, module map, coding conventions, do-not-build list, PR checklist incl. BAEF backlog discipline).

#### DOC-008 — No SECURITY.md / standalone privacy policy
- **Priority:** P2 · **Severity:** 🟡 Medium · **Category:** Documentation / Security · **Effort:** S
- **Description:** Privacy policy text lives only inside `PrivacyPolicyModal.tsx`; there's no standalone policy doc or vulnerability-reporting file for the public repo.
- **Acceptance criteria:** `SECURITY.md` (reporting channel) + a hosted/standalone privacy policy; reconcile with PRIV-002 (real contact).
- **QA validation:** Repo shows a security policy; privacy contact is real + consistent across app and docs.
- **Dependencies:** PRIV-002 (real contact email).
- **Status (sprint 33):** ✅ Resolved (docs) — added `SECURITY.md` (private reporting, pilot posture) + `docs/PRIVACY.md` (standalone mirror of the in-app policy). Both flag the placeholder contact; **PRIV-002 (real monitored email) remains open** and must be set before external release.

#### DOC-009 — PRD.md stale (pre web/PWA reframing + BAEF)
- **Priority:** P2 · **Severity:** 🟢 Low · **Category:** Documentation / Product · **Effort:** S
- **Description:** `docs/PRD.md` (v1.0) still frames the original vision; doesn't reflect the web/PWA pilot positioning or BAEF governance.
- **Acceptance criteria:** PRD updated to current positioning + scope, or explicitly versioned/superseded.
- **QA validation:** PRD positioning matches README/audit-report framing.
- **Dependencies:** none.
- **Status (sprint 33):** ✅ Resolved — added a status banner to `docs/PRD.md`: v1.0 kept as the product vision, current reality framed as the web/PWA pilot (BAEF-governed), pointing to the audit report + ARCHITECTURE.md as live sources of truth where they diverge.

- **Docs (P3) — ✅ all resolved (sprint 33):** DOC-010 `docs/PROBLEM_VALIDATION.md` (BAEF Phase 1 — problem, personas, competitive landscape, success metrics, open hypotheses); DOC-011 ADR log `docs/adr/` (index + ADR-0001…0005 back-documenting decisions previously inline in ARCHITECTURE.md); DOC-012 `CHANGELOG.md` (Keep a Changelog — Unreleased + Pilot baseline).

## ✅ Fixed

- [2026-06-09] **Sprint 42: MaglakbAI rebrand, premium fonts, text-size control, Key Takeaway fix, evidence gate UX** — (1) **App renamed LakbAI → MaglakbAI**: all user-facing strings, onboarding copy, meta tags, and `docs/USER_GUIDE.html` (+ `public/USER_GUIDE.html`) updated. `index.html` title/OG/Twitter tags updated. (2) **Premium font stack**: Plus Jakarta Sans (geometric-humanist, app-wide body/UI) + Space Grotesk (brand wordmark only) loaded via Google Fonts. react-native-web overrides patched with id-scoped `!important` CSS in `index.html`. `nativeID="brand-wordmark"` added to wordmark Text in `OnboardingScreen`. (3) **Text-size control (Settings → App → Text Size)**: `fontScale: number` (0.9–1.2, step 0.1) added to store + persisted. `setFontScale` action in `profileSlice.ts`. `App.tsx` syncs value to `--app-font-scale` CSS variable; `#root { zoom: var(--app-font-scale, 1) }` in `index.html` scales everything uniformly. (4) **Welcome screen redesign**: `OnboardingScreen` WelcomeStep rebuilt as non-scrolling single-screen layout — `MaglakbAILogo` SVG (isometric staircase + cyan gem), `JourneyStaircase` SVG (4-step LEARN/APPLY/ACHIEVE/ELEVATE with aligned right-column descriptions), glass "Show results." quote card, Space Grotesk gradient wordmark, Fil tagline "Isulong ang pangarap.", "Start Building Now →" CTA. `UX: Create your identity` hint text: "Alex Chen" → "Juan Masipag". (5) **Key Takeaway bug fix (BUG-014)**: `Output` interface was missing `keyTakeaway?: string`. The field was collected in `LogOutputScreen`, used to calculate +15 XP, then silently discarded — never written to the stored output. Fixed: added field to `src/types/index.ts`; `coreSlice.logOutput` now persists `keyTakeaway: payload.keyTakeaway?.trim() || undefined`; `ProfileScreen` output detail modal now shows a KEY TAKEAWAY section with "💡 {keyTakeaway}". (6) **Evidence gate UX improvements**: `LogOutputScreen` skill context banner now shows an amber warning state ("⚠️ Needs proof" badge + "Add a link or write 50+ chars to unlock this skill" hint) when this output would complete the skill but evidence gate would block it. Session recap `progressMsg` fixed — was incorrectly showing "🎯 Skill complete!" when `outputsLeft === 0` but `evidenceRequired === true`; now shows the correct actionable message. All stale "80+ chars" references in toast, hint text, and gate warning corrected to "50+ chars" (actual `getEvidenceTier` threshold). Files: `index.html`, `App.tsx`, `src/types/index.ts`, `src/store/appStore.ts`, `src/store/persistence.ts`, `src/store/slices/coreSlice.ts`, `src/store/slices/profileSlice.ts`, `src/screens/OnboardingScreen.tsx`, `src/screens/LogOutputScreen.tsx`, `src/screens/ProfileScreen.tsx`, `src/screens/SettingsScreen.tsx`, `docs/ARCHITECTURE.md`, `docs/USER_GUIDE.html`, `public/USER_GUIDE.html`.

- [2026-06-05] **Sprint 41: Security hardening, compatibility fixes, test suite repair** — (1) **NEW-001 (P1) — 0 console errors:** All `background:` CSS shorthand (rejected by react-native-web) replaced with `backgroundImage:` + `backgroundColor` fallback across 10 files. Console errors per session: 128 → 0. (2) **NEW-011 (P2) — CSP header:** Content-Security-Policy added to `netlify.toml` covering `'self'`, Supabase CDN, and PostHog. (3) **NEW-004 (P2):** `window.location.origin` in `auth.ts` guarded with `typeof window !== 'undefined'`. (4) **NEW-005 (P2):** `import.meta.env.DEV` in `App.tsx` replaced with `__DEV__` (Metro + Vite compatible; declared via `vite.config.ts` define). (5) **Supabase test crash fixed:** `isSupabaseEnabled` now requires `typeof window !== 'undefined'` — prevents WebSocket init crash in Node.js 20 test environment. 94 tests restored green. Files: `src/lib/supabase.ts`, `src/lib/auth.ts`, `App.tsx`, `netlify.toml`.

- [2026-06-05] **Sprint 40: ARCH-001 Supabase backend + UX-028/029 onboarding fixes + market demand layer** — (1) **ARCH-001 (P1):** Supabase backend live — Magic Link auth, `profiles`/`outputs`/`skill_progress` cloud backup, multi-device sync via `syncFromSupabase()`. Settings → "Back up to cloud" UI. (2) **UX-028 (P2):** Consent banner gated behind `hasOnboarded` in `App.tsx` — no longer overlaps "Begin Your Journey" CTA. (3) **UX-029 (P2):** `completeOnboarding` grants 25 XP + streak 1; experience-level pre-crediting grants completion XP for prior work. (4) **Market demand layer:** `DemandBadge` component, curated `MARKET_DEMAND_MAP` (all 19 paths), `marketDemand`/`submittedSignalSkillIds` store state, gap strip on Dashboard, demand badges on EvolveScreen skill nodes, one-tap signal prompt post-output. (5) **Theme:** `ColorsLight` refined, `getPathColor()` helper, improved light-mode tab opacity. New types: `MarketDemand`, `MarketSignal`. Files: `src/lib/db.ts`, `src/lib/auth.ts`, `src/lib/supabase.ts`, `src/store/appStore.ts`, `src/store/persistence.ts`, `src/types/index.ts`, `src/data/marketDemand.ts`, `src/components/DemandBadge.tsx`, `src/utils/theme.ts`, `src/screens/DashboardScreen.tsx`, `src/screens/EvolveScreen.tsx`, `src/screens/LogOutputScreen.tsx`, `App.tsx`.

- [2026-06-04] **UX-020: Skills label disambiguation (sprint 39)** — "Skills" appeared with three different meanings across screens. Fixed: Dashboard ring `X / Y skills` → `X / Y skills completed`; Profile stat `Skills Done` → `Skills Completed`; Portfolio stat `skill/skills` → `skill started/skills started`. Files: `DashboardScreen.tsx`, `ProfileScreen.tsx`, `PortfolioScreen.tsx`.

- [2026-06-04] **RES-005: Leaderboard header wraps at 320px (sprint 39)** — Shortened "🏅 WEEKLY XP LEADERBOARD" to "🏅 WEEKLY XP" in `FeedScreen.tsx`. No longer wraps at 320px.

- [2026-05-31] **Gap 5: Career Win Feed Posts + Social Proof Gallery (sprint 27)** — Closed the social proof gap where career wins logged on Profile were entirely private, invisible to the community. Three-part implementation: (1) Added `'career_win'` to `PostType` union and `outcomeType?: OutcomeType` to `FeedPost` interface in `types/index.ts`. (2) Updated `logCareerOutcome` in `appStore.ts` to auto-create a `FeedPost` of type `'career_win'` and prepend it to both `communityFeed` and `userFeedPosts` — so every Interview/Offer/Promotion/Role Change/Cert/Raise/Portfolio/Freelance win immediately appears in the feed with the user's name, path, and XP. (3) Added 3 seed career win posts (`fp-win-001`–`fp-win-003`) to `MOCK_FEED`: Kenji Nakamura (ML Engineer, offer at Stripe +$175k after logging churn model project — "proof-based progression is real"), Sofia Petrov (Full Stack, promoted to Senior Frontend at Shopify after architecture milestone), Tariq Hassan (Data Architect, interview at Databricks Staff — "they asked me to walk through my logged projects here"). (4) Updated `FeedCard.tsx`: detects `isCareerWin`, renders a gold-accented WIN card with "🏆 CAREER WIN" label, outcome type (Offer Received/Promotion/etc.), XP badge, and `winCard` styles (gold border, gold gradient background). (5) Updated `FeedScreen.tsx`: "🏆 Wins" filter chip appears dynamically when career win posts exist (count shown), filter logic routes `wins` to `p.type === 'career_win'`, empty state for wins filter explains how to log a win. Total feed posts: 27. Verified: Wins filter highlights in gold, Kenji's card shows gold border + "🏆 CAREER WIN" chip + "Offer Received" outcome + "+500 XP" badge. Build: 552 modules, 0 TS errors, 1.63s. Files: `src/types/index.ts`, `src/store/appStore.ts`, `src/components/FeedCard.tsx`, `src/screens/FeedScreen.tsx`.

- [2026-05-31] **Evidence-based progress gate — verified (sprint 27)** — Three-part feature confirmed live: (1) Evidence Meter on Log Output screen shows real-time tier (📌 Logged / 📝 Documented / 📝+20 XP / 🔗 Verified) based on description length (≥80 chars) and link presence. Tier updates reactively as user types. (2) Gate warning fires when the next output would complete a skill and tier is still Logged — "⚠️ This will complete the skill — add a link or expand your description to 80+ chars to unlock it." Warning disappears once tier improves. (3) Profile output cards show 🔗 pill (Verified) or 📝 pill (Documented) — Logged outputs show no pill. All three confirmed live via browser drive. Finding: "XP SOURCES: 🔨 Outputs +NaN" bug on Profile — calculation error in XP breakdown row; flagged as separate fix.

- [2026-05-31] **First Mission Card on Dashboard empty state — verified (sprint 27)** — Dashboard empty state (0 outputs) now shows a skill-specific mission card instead of generic rocket text: "⚡ YOUR FIRST MISSION" chip in pathColor, skill icon + name, "Complete N outputs to unlock" meta, EXAMPLE OUTPUT block with `outputExamples[0]`, XP preview row (+75 per output / +100 on complete), "Start This Mission ⚡" CTA that sets selectedSkillId and navigates to Log. Confirmed live: data-architect path shows SQL Foundations skill, example query text, gold XP chips, and working CTA. Falls back to generic card if no built-in skill found (custom paths). Files: `src/screens/DashboardScreen.tsx`.

- [2026-05-30] **Feed reaction/comment persistence on user posts; analytics JSDoc dedupe; ARCHITECTURE.md rewrite (sprint 26)** — (1) `reactToPost` and `addComment` updated `communityFeed` in memory but never synced back to `userFeedPosts` (the persisted field). Reactions and comments on user-authored posts were lost on page reload. Fixed: both actions now remap `state.userFeedPosts` through the updated feed array before calling `set()`. No new state fields needed; MOCK_FEED post interactions remain ephemeral (by design — seed posts are not user-owned). (2) `analytics.ts` JSDoc had `first_output_logged` listed twice — removed the redundant entry. (3) `docs/ARCHITECTURE.md` described a planned-but-never-built stack (Expo Router, NativeWind, Reanimated 3, Lottie, three separate stores). Complete rewrite documenting the actual implementation: React Navigation 7, StyleSheet.create(), RN Animated API, single Zustand store, persistence subscriber pattern, Vite chunk config, all animation patterns, analytics event table, and architectural decisions. Phase 2 Supabase migration preserved as a planned section. Files: `src/store/appStore.ts`, `src/utils/analytics.ts`, `docs/ARCHITECTURE.md`.

- [2026-05-30] **8 paths with zero community posts — sprint 25** — 8 of 19 built-in paths (business-analyst, data-analyst, project-manager, solutions-architect, software-architect, mobile-developer, ui-ux-designer, startup-founder) had no seed posts. New users enrolling in these paths saw only the "Your work deserves to be seen" coaching banner with zero community feed activity. Added 8 posts (fp-017–fp-024): Mei Lin (business-analyst, requirements workshop revealing 12 hidden contradictions), Carlos Mendez (data-analyst, SQL milestone — VLOOKUP-to-CTE upgrade story), Yuki Yamamoto (project-manager, sprint retro framework with Start/Stop/Continue), Fatima Al-Hassan (solutions-architect, event-driven 2M-tx/day microservices design with 40% communication reality check), Lucas Benetti (software-architect, design patterns milestone — naming things is power), Nkechi Okafor (mobile-developer, React Native iOS+Android launch milestone — Xcode provisioning is the hard part), Anna Dubois (ui-ux-designer, 40-component Figma design system — dev handoff from 2h to 20min), Rajan Mehta (startup-founder, MVP shipped in 6 weeks — what not to build is the skill). Feed filter chips now auto-appear for all 19 paths. File: `src/store/appStore.ts`.

- [2026-05-29] **Avatar emoji/color hardcoded to 3 of 19 paths; duplicate analytics event; 6 new community seed posts (sprint 24)** — (1) `completeOnboarding` in `appStore.ts` used a 3-case ternary for `avatarEmoji`/`avatarColor` — only `data-architect` and `ai-engineer` had dedicated values; all other paths defaulted to fullstack's `🌐`/`#061A10`. Users selecting any of the 16 newer paths (ML Engineer, Cybersecurity, Cloud Engineer, etc.) got the wrong avatar icon and background color on their Dashboard hero card, feed posts, and profile. Fixed by resolving `const pathMeta = CAREER_PATHS.find(p => p.id === pathId)` before user creation and using `pathMeta?.icon ?? '⚡'` and `pathMeta?.dimColor ?? '#0A0A0F'`. (2) `first_output_logged` analytics event fired twice on the first onboarding output — from both `OnboardingScreen.handleFirstOutput` (sparse: only `output_type`, `career_path`) and from `logOutput` in the store (rich: adds `skill_id`, `skill_name`, `xp_gained`, `time_to_first_output_minutes`). Removed the duplicate from `OnboardingScreen`; store version is the authoritative source. (3) 14 of 19 paths had zero seed community posts; users enrolling in those paths saw only the "Your work deserves to be seen" coaching banner with no feed activity. Added 6 new `MOCK_FEED` entries (`fp-011`–`fp-016`): ML Engineer (Kenji Nakamura, churn prediction model), Frontend Engineer (Sofia Petrov, React SPA milestone), DevOps (Tariq Hassan, CI/CD pipeline), Cloud Engineer (Isabelle Müller, Terraform IaC), Cybersecurity (Jordan Lee, bug bounty XSS+SQLi), Product Manager (Priscilla Okwu, discovery sprint). Feed filter chips now auto-appear for 11 of 19 paths (up from 5). Files: `src/store/appStore.ts`, `src/screens/OnboardingScreen.tsx`.

- [2026-05-29] **Feed filter chips hardcoded to 3 of 17 paths — UX-016 (sprint 23)** — Medium: `PATH_FILTERS` in `FeedScreen.tsx` was a static array listing only `data-architect`, `ai-engineer`, and `fullstack`. With 17 built-in paths now in the app, users enrolled in Data Engineer, ML Engineer, Backend Engineer, Frontend Engineer, DevOps, Cybersecurity, etc. had their feed posts silently uncategorized — posts only visible under "All", no path-specific filter chip ever appeared. Fix: removed static array; replaced with dynamic `builtInPathFilters` derived at render time from `CAREER_PATHS.filter(cp => feedPathIds.has(cp.id))`, using `PathColors[cp.id]` for per-path color theming. Added `CAREER_PATHS` import. Custom path logic (`customPathFilters`) unchanged. Also added 2 new MOCK_FEED posts — `fp-009` (Ananya Rao, `data-engineer`, Spark ETL story) and `fp-010` (Kwame Boateng, `backend-engineer`, JWT auth migration) — so the community feels active for those paths immediately. Filter chips now auto-appear for any path with ≥1 post and auto-disappear when posts drop to 0. No future maintenance needed as paths are added. Files: `src/screens/FeedScreen.tsx`, `src/store/appStore.ts`.

- [2026-05-29] **Custom path Dashboard action card blank — BUG-011 (sprint 22)** — High: users whose focused path was a custom path (created via "New Roadmap") saw a completely empty Dashboard action strip — no "NEXT MILESTONE" card, no "Log Work ⚡" CTA. Root cause: `nextSkill` in `DashboardScreen` mapped each skill ID through `ALL_SKILLS.find()`, which only covers built-in skills. Custom skills (IDs like `custom_*` or `personal_*`) returned `undefined`, causing the `.find()` condition `nextSkill?.skill ? (...)` to silently produce nothing. Fix: added `customSkillMap` (built from `customPaths.flatMap(cp => cp.skills.map(...))`) as a fallback lookup. When `ALL_SKILLS.find()` returns `undefined`, the map returns a compatible `{ id, name, icon, requiredOutputs: 1, xpReward: 50 }` object. The `.find()` condition now also checks `skill &&` to ensure valid results. Both the action card and its `accessibilityLabel` now correctly surface custom skill names and progress. File: `src/screens/DashboardScreen.tsx`.

- [2026-05-29] **Accessibility labels on all interactive elements — A11Y-001 (sprint 20)** — Added `accessibilityLabel` and `accessibilityRole="button"` to every interactive `TouchableOpacity` and `accessibilityLabel` to all `TextInput` fields across 7 files. Specific changes: (1) `CareerNode.tsx` — skill node card gets context-aware label describing skill name, status, output progress, and XP reward; `accessibilityState={{ disabled: isLocked }}` added. (2) `FeedCard.tsx` — active reaction chips get "React with / Remove {emoji}, N total" labels; quick-react chips get "Add {emoji} reaction"; "more comments" button, comment prompt, and send button all labeled; comment TextInput gets `accessibilityLabel`. (3) `DashboardScreen.tsx` — freeze button, "Log My First Output" CTA, NEXT MILESTONE card, Today's Challenge card, path-complete CTAs all labeled. (4) `LogOutputScreen.tsx` — output type chips get label + `accessibilityState={{ selected }}`; skill option cards get progress-context labels ("2 of 5 outputs, final push!"); title/description/link TextInputs labeled; submit button labeled with `accessibilityState={{ disabled }}`. (5) `AppNavigator.tsx` — all 5 tabs get `tabBarAccessibilityLabel`; Log tab uses dynamic label "Log output — streak at risk!" when streak is at risk. (6) `EvolveScreen.tsx` — "+ Roadmap" button, path switcher tabs (with `accessibilityState={{ selected }}`), add-path tab, empty-state CTA all labeled. (7) `ProfileScreen.tsx` — share button, edit-name/edit-bio tappable areas, bio TextInput, name TextInput, all achievement tiles (with unlocked/locked context), output filter chips (with `accessibilityState={{ selected }}`) all labeled.

- [2026-05-29] **Post-onboarding welcome card — UX-015 (sprint 19)** — First-time users now see a full-screen "Welcome to MaglakbAI!" overlay on their first Dashboard load. Card shows the MaglakbAI ⚡ logo, a welcome message, and an animated XP counter counting up to their first output's XP earned. Auto-dismisses after 3.2s or tap. Implemented via `showWelcomeCard: boolean` in Zustand store (set in `completeOnboarding`, cleared by `dismissWelcomeCard`), `Modal` overlay in `DashboardScreen`, and a 30-step setInterval XP counter animation. Per-boundary: `showWelcomeCard` is ephemeral (not persisted to localStorage) so it only fires on the first session after onboarding. Files: `src/store/appStore.ts`, `src/screens/DashboardScreen.tsx`.

- [2026-05-29] **textMuted contrast fix — A11Y-005 (sprint 19)** — `Colors.textMuted` changed from `#44446A` (~2.8:1 contrast on `#11111C`) to `#7070A0` (~4.6:1 contrast), meeting WCAG AA 4.5:1 minimum for normal text. Affects timestamps, output meta labels, placeholder text, comment author names, and all secondary labels across every screen. File: `src/utils/theme.ts`.

- [2026-05-29] **useMemo for buildInsights/buildWeekGrid — PERF-002 (sprint 19)** — Both functions previously ran as inline IIFEs on every render of `DashboardScreen`, iterating the full `outputs[]` array with date math on every state update. Hoisted to `const weekGrid = useMemo(() => buildWeekGrid(outputs), [outputs])` and `const insights = useMemo(() => outputs.length >= 5 ? buildInsights(outputs) : null, [outputs])` at the component level. JSX updated to use the memoized variables directly. Added `useMemo` and `Modal` to imports. File: `src/screens/DashboardScreen.tsx`.

- [2026-05-29] **Per-screen error boundaries — OPS-002 (sprint 19)** — Added `ScreenErrorBoundary` class and `withScreenBoundary<P>()` HOC to `AppNavigator.tsx`. Each of the 5 tab screens is now wrapped: `GuardedDashboard`, `GuardedFeed`, `GuardedLog`, `GuardedEvolve`, `GuardedProfile`. Error fallback shows screen name, error message, and a "Try Again" retry button that resets the boundary state. An isolated tab crash no longer kills the rest of the app. Imports updated: `TouchableOpacity`, `StyleSheet`, and theme tokens added. File: `src/navigation/AppNavigator.tsx`.

- [2026-05-29] **communityFeed persistence — user posts survive page refresh (BUG-010, sprint 18)** — Critical: user-generated feed posts were stored only in-memory and lost on every page reload, breaking the "Share → Receive Recognition" addiction loop. Fix: added `userFeedPosts: FeedPost[]` to `AppState` interface and to `localStorage` persistence. Store init now reconstructs `communityFeed: [...savedUserFeedPosts, ...MOCK_FEED]` so user posts appear above mock feed posts on reload. `logOutput` action populates `updatedUserFeedPosts` and includes it in `saveToStorage`. `resetApp` clears `userFeedPosts: []`. All 9 `saveToStorage` call sites updated to include the field. File: `src/store/appStore.ts`.

- [2026-05-29] **unlockDependentSkills uses skill.pathId not user.careerPathId (BUG-002, sprint 18)** — High: when a user switches to a prioritized path that differs from their enrolled `careerPathId`, completing a skill on the prioritized path called `unlockDependentSkills(payload.skillId, state.user.careerPathId, ...)` — passing the enrolled path ID instead of the completed skill's path. Result: dependent skills on the prioritized path never unlocked. Fix: changed the guard to `CAREER_PATHS.some(p => p.id === skill.pathId)` and the call to `unlockDependentSkills(payload.skillId, skill.pathId as CareerPathId, updatedUserSkills)`. File: `src/store/appStore.ts`.

- [2026-05-29] **Wrong direction text in empty skill list card (UX-001, sprint 18)** — Medium: when no built-in skills were available to select (all locked), the empty-state card read "type a title above to add a new item" — but the title input is below the skill list, not above it. Misleading spatial reference caused confusion during pilot testing. Fix: changed "above" → "below". File: `src/screens/LogOutputScreen.tsx`.

- [2026-05-29] **Skill progress bars on LogOutputScreen (sprint 17)** — Each built-in skill option in the Log Output form now shows: a thin 3px progress bar (filled proportionally to `outputCount / requiredOutputs`), an `N/M outputs` counter with a gold `+XP on complete` hint, and a gold `🎯 Final push!` badge when exactly one output away from completing the skill. Skill options with the "final push" state also get a gold border and dim gold background to visually surface the urgency even before selection. When selected, the progress bar switches to `primaryLight` purple and the label adopts a tinted purple color. Custom path skills continue to show their `pathLabel` without a progress bar (they don't have a fixed `requiredOutputs`). No store changes required — `outputCount` and `requiredOutputs` were already part of the `SkillOption` interface, just not rendered. File: `src/screens/LogOutputScreen.tsx` (render block + 11 new StyleSheet entries). Build: 549 modules, 0 TS errors. ✓ built in 2.36s.

- [2026-05-28] **Comment feature on Feed posts (sprint 16)** — Users can now add comments directly on any community feed post. A "💬 Comment" prompt appears at the bottom of each `FeedCard` (below the existing comments and reactions). Tapping it expands to a `TextInput` with "Add a comment..." placeholder, a focused purple border, and a circular purple send button (→). Submitting adds the comment to the post via new `addComment(postId, text)` Zustand action, attributing it to the current user with a `c_${Date.now()}` ID. Input auto-dismisses after submission. The `comment_posted` analytics event fires with `post_id` and `is_own_post` flag. Comment prompt is only rendered when `onComment` prop is provided — FeedScreen passes `addComment` from the store; future screens that render `FeedCard` without the prop will show read-only cards. Files: `src/store/appStore.ts` (new `addComment` action + `AppState` interface), `src/components/FeedCard.tsx` (new `onComment` prop, `showCommentInput` state, `TextInput`, 7 new styles), `src/screens/FeedScreen.tsx` (reads `addComment`, passes as prop to `FeedCard`). Build: 0 new TS errors. Browser verified: clicking "💬 Comment" opens focused input; send button styled correctly.

- [2026-05-28] **Streak-risk notification badge on Log tab (sprint 15)** — A pulsing red dot badge now appears on the center + (Log) tab when the user has a streak > 0 but hasn't logged today (`user.lastActiveDate !== todayStr`). Implemented as an `Animated.View` (11×11px, `#EF4444`, `borderColor: '#0A0A0F'`) positioned `absolute top: 1, right: 1` on the `LogTabIcon`. Uses `Animated.loop(Animated.sequence([scale 1→1.5→0.85]))` with 700ms each arm — visible urgency without being obnoxious. Animation starts/stops reactively via `useEffect([isStreakAtRisk])`. `MainTabs()` reads `user.lastActiveDate` from the store and computes `isStreakAtRisk` to pass as prop. When streak is 0 or user has already logged today, no badge renders. Reinforces the "Today's Challenge" card nudge with a persistent tab-level signal the user sees without needing to be on the Home screen. Files: `src/navigation/AppNavigator.tsx` (new `Animated` + `useRef`/`useEffect` imports, `isStreakAtRisk` prop on `LogTabIcon`, `MainTabs` store read). Build: 0 TS errors. Browser verified: red dot appears with correct placement when streak=5 + lastActiveDate=yesterday.

- [2026-05-28] **"Today's Challenge" card on DashboardScreen (sprint 14)** — Added a personalized daily call-to-action card that appears between the NEXT MILESTONE card and the 7-day heatmap. Shows one of five states based on user context: (1) **streak_risk** — gold/urgent card "Don't break your N-day streak!" when streak > 0 and user hasn't logged today with lastActiveDate = yesterday; (2) **final_push** — green card "One more output — master [skill]!" when exactly 1 output remains; (3) **almost_there** — purple card with specific count when 2–3 outputs remain and user hasn't logged today; (4) **daily_start** — default purple nudge when user hasn't logged today at all; (5) **keep_going** — softer dimmed card "You've logged today — push further!" when user has already logged and more outputs remain. Each card state has distinct border color, box-shadow glow, tag color, and CTA button color. Only renders when `nextSkill` exists (i.e., an in-progress skill is present). New `buildTodayChallenge` pure helper function at module level, `ChallengeData` interface, and 7 new StyleSheet entries. File: `src/screens/DashboardScreen.tsx`

- [2026-05-28] **Streak Bonus XP Visibility + Per-Skill Streak Badges (sprint 13)** — Two complementary improvements that make hidden dopamine mechanics explicit. (1) **Streak bonus XP toast**: When a user hits a 7/14/30-day streak milestone during a log, a gold "🔥 N-Day Streak Bonus! +XP" toast fires 1.4 s after the output toast — calling out the bonus that was previously silently added to XP with no fanfare. Implemented by adding `streakBonusXP?: number` and `newStreak?: number` to `LogOutputResult`, returning them from `logOutput`, and detecting them in `handleSubmit` in `LogOutputScreen`. (2) **Per-skill streak badges on Evolve map**: `in_progress` skill nodes on the milestone map now show a gold pill badge "🔥 N-day streak" when the user has logged to that skill on N consecutive calendar days (N ≥ 2). Computed by new module-level `getSkillStreak()` helper in `EvolveScreen` — counts consecutive days from today backward through `outputs`. `CareerNode` extended with `skillStreak?: number` prop and matching `streakBadge` / `streakBadgeText` styles. Both features verified in browser: REST APIs node correctly showed "🔥 3-day streak" with gold pill styling. Files: `src/types/index.ts`, `src/store/appStore.ts`, `src/screens/LogOutputScreen.tsx`, `src/screens/EvolveScreen.tsx`, `src/components/CareerNode.tsx`

- [2026-05-28] **Pace-to-completion estimate on NEXT MILESTONE card** — The "NEXT MILESTONE" coaching card on DashboardScreen now shows a green pace line below the outputs meta text: "⚡ ~N days at your current pace", "⚡ You could finish today!", or "~N weeks at your current pace". Computed from the user's 14-day output velocity (`recentOutputCount / 2` = weekly rate). Shows only when the user has started logging (`hasStarted`) and has at least 0.5 outputs/week on average — avoids misleading estimates for brand-new or inactive users. A "🎯 Ready to complete!" variant fires when outputs remaining = 0 (edge case). Closes the motivational gap on the most-viewed actionable card on the Home screen. File: `src/screens/DashboardScreen.tsx`

- [2026-05-28] **Personal Growth Insights Card on Dashboard** — Added a "📊 GROWTH INSIGHTS · Your last 2 weeks" analytics card to DashboardScreen, appearing after the 7-day heatmap once the user has ≥5 total outputs. Card shows a 2×2 metric grid: **THIS WEEK** (output velocity with ↑/↓/→ trend arrow and delta vs last week), **XP THIS WEEK** (total XP earned in the last 7 days with trend), **CONSISTENCY** (active days out of the last 14 with percentage), and **PEAK DAY** (the day of week the user most frequently logs). Computed by new `buildInsights()` pure helper function (module-level, outside component). Only surfaces to active users — hidden for new users and low-activity users (<5 outputs). Reinforces the "Strava for professional growth" positioning by giving users a personal analytics view that rewards habitual logging. Files: `src/screens/DashboardScreen.tsx`

- [2026-05-28] **Skill Detail Bottom Sheet on EvolveScreen** — Tapping any non-locked skill node on the Evolve / milestone map now opens a beautiful bottom-sheet modal instead of navigating directly to Log Output. The sheet shows: large skill icon with rarity-colored border and glow, COMMON/RARE/EPIC badge, status badge (READY / IN PROGRESS / MASTERED), full skill description, animated progress bar with "N / M outputs" count and hint text, XP completion reward card, prerequisites list (for built-in skills) with per-prerequisite completion status, a "Log Work on This Skill ⚡" primary CTA that sets the skill selection and navigates to Log, and a Close button. Mastered skills show a "🏆 This skill is mastered" card instead of the CTA. Custom path skills are supported via a fallback Skill object. Closes the UX gap where tapping a node immediately jumped to the Log form with no context. Files: `src/screens/EvolveScreen.tsx`

- [2026-05-27] **Achievement detail modal** — Tapping any achievement badge (unlocked or locked) now opens a bottom-sheet modal showing: large icon with rarity-colored background, COMMON/RARE/EPIC/LEGENDARY badge, title, description, and XP reward row. For locked achievements, a progress bar shows current progress toward the unlock requirement (e.g., "1 / 5 outputs logged" for Builder, "3 / 7 day streak" for Consistent). For unlocked achievements, a "✓ Unlocked" tag is shown. Helper function `getAchievementProgress()` maps each achievement ID to its progress metric. Closes the UX gap where users saw locked achievements with no path to unlock them. Files: `src/screens/ProfileScreen.tsx`

- [2026-05-27] **Progress share card (Web Share API)** — "📤 Share Progress" button added to the Profile identity section (between bio and stats row). On tap: calls `navigator.share()` if the browser supports it (mobile web, PWA), falling back to `navigator.clipboard.writeText()` with a toast confirmation on desktop. Share card includes name, level + title, XP, streak, skills mastered, outputs logged, and `#MaglakbAI` hashtag. Closes the "Share → Receive Recognition" step of the core addiction loop. Files: `src/screens/ProfileScreen.tsx`

- [2026-05-27] **Output timestamps + type filter in Profile gallery** — Output cards in ProfileScreen now show a relative timestamp (`timeAgo()` — "16m ago", "3d ago", etc.) in the metadata line. A horizontal filter chip row appears above the gallery when the user has outputs of 2+ different types, allowing one-tap filtering by type (Project / Book / Cert / GitHub / Script / Design). Section header now shows "YOUR OUTPUTS · N total" count. The filter chips correctly hide for users with only one output type. Files: `src/screens/ProfileScreen.tsx`

- [2026-05-27] **7-day activity heatmap on DashboardScreen** — Added a "THIS WEEK" calendar grid below the hero card and next-milestone card. Shows 7 rounded squares (one per calendar day, starting 6 days ago), each filled with the path color on days with logged outputs and empty/dim on inactive days. Today's square has a light border highlight. Header shows "N output(s)" total for the week. Reinforces the habit-formation loop by making activity patterns visible at a glance. Files: `src/screens/DashboardScreen.tsx`

- [2026-05-27] **Custom path auto-switch on creation (EvolveScreen)** — When a user finished the 2-step "New Roadmap" modal, `handleCreate` was calling `addCustomPath(newPath)` and then silently closing the modal without switching to the new path. The user was left staring at their old path with the new roadmap sitting invisibly in the tab bar. Root cause: `addCustomPath` returned `void`, so `const newId = \`custom_${Date.now()}\`` was computed but never used, and `switchPath(newId)` was never called. Fix: made `addCustomPath` return the generated path ID (`string` instead of `void`), then in `handleCreate` captured the return value and called `switchPath(newPathId)` before `handleClose()`. Files: `src/store/appStore.ts`, `src/screens/EvolveScreen.tsx`

- [2026-05-27] **Level-Up Overlay Animation** — New `LevelUpOverlay` component (`src/components/LevelUpOverlay.tsx`) shows a full-screen gold animated overlay when a user levels up via a non-skill-completion output. Features: spring-animated card entrance, pulsing glow ring, animated level number scale-in, auto-dismisses after 3 s (or tap), fires "Level N reached!" toast on dismiss then navigates to Map. Fills the dopamine gap where previously a level-up triggered only a generic "Output logged!" toast. `first_output_logged` analytics event added with `time_to_first_output_minutes` property. `log_screen_abandoned` event added with form-fill depth properties. Files: `src/components/LevelUpOverlay.tsx` (new), `src/screens/LogOutputScreen.tsx`, `src/store/appStore.ts`, `src/utils/analytics.ts`

- [2026-05-27] **"Path Complete" state on DashboardScreen** — When a user finishes all skills on their current path, the Home screen now renders a gold celebration card ("PATH COMPLETE · {Path Name} Mastered!") instead of simply showing nothing. Card displays total path XP earned, a primary CTA ("Explore New Paths ⚡" → Evolve tab), and a secondary CTA ("Keep Logging Outputs" → Log tab). XP bar hint also updates to "🎉 Path Complete!" when `pathXpRemaining === 0`. File: `src/screens/DashboardScreen.tsx`

- [2026-05-27] **Confetti burst on MilestoneScreen** — Full-screen CSS confetti overlay added to MilestoneScreen. 26 pieces fall from top using `msConfFall` keyframe (path-colored palette: primary, text, gold, white, rarity color). Auto-fades after 2.8 s. Layer is `pointerEvents="none"` — does not block scroll or taps. CSS injected once into `<head>` per session. Files: `src/screens/MilestoneScreen.tsx`

- [2026-05-27] **Name editing on Profile** — Users can now tap their name on ProfileScreen to edit it inline. Shows a centered `TextInput` pre-filled with current name + Save/Cancel buttons (same visual style as bio editing). Save updates `user.name` and derives a new `user.handle`. New `updateName` action added to store. Files: `src/screens/ProfileScreen.tsx`, `src/store/appStore.ts`

- [2026-05-27] **Onboarding skip button (steps 1 & 2)** — Added "Skip for now — I'll set this up later" link on NameStep (step 1) and "Skip — start with Data Architect path" link on PathStep (step 2). Skipping name defaults to `'Explorer'`; skipping path auto-selects `data-architect`. Both fire `onboarding_step_skipped` analytics event. File: `src/screens/OnboardingScreen.tsx`

- [2026-05-26] **Pull-to-refresh on Profile** — Added `RefreshControl` to ProfileScreen's `ScrollView`. On pull, triggers 800ms simulated refresh (ready for real Supabase profile re-fetch). Matches Feed screen behaviour. Files: `src/screens/ProfileScreen.tsx`

- [2026-05-26] **Email capture in onboarding** — Added optional email field to step 1 (NameStep). NameStep updated to "Create your identity." with name + email inputs. Email stored on User object, included in PostHog `identify` call and `onboarding_completed` event (`has_email` property). Files: `src/types/index.ts`, `src/store/appStore.ts`, `src/screens/OnboardingScreen.tsx`

- [2026-05-26] **Pull-to-refresh on Feed** — Added `RefreshControl` to FeedScreen's `FlatList`. On pull, triggers 800ms simulated refresh (ready for real backend re-fetch). Files: `src/screens/FeedScreen.tsx`

- [2026-05-26] **Streak milestone cards beyond day 7** — Dashboard now shows progress cards for days 7-13 (toward 14-day badge), days 14-29 (toward 30-day badge with % complete), and a 30+ legend card. Each shows progress dots and bonus XP reminder. File: `src/screens/DashboardScreen.tsx`

- [2026-05-26] **Bio editing on Profile** — Users can now tap "+ Add a bio" on ProfileScreen to enter/edit their bio inline. Saves via new `updateBio` action in store. Files: `src/screens/ProfileScreen.tsx`, `src/store/appStore.ts`, `src/types/index.ts`

- [2026-05-26] **Session duration analytics** — App now tracks `session_ended` event with `duration_seconds` on tab/window visibility change. On tab return, fires a new `session_started` with `resumed: true`. File: `App.tsx`

- [2026-05-26] **Feed: filter by path** — Added horizontal scrollable filter chips (All / Data Architect / AI Engineer / Full Stack + any custom paths with posts) above the feed list. Each chip shows a post count badge. Active chip highlights in the path's brand color. Filtering to a path with no posts shows a path-colored empty state with a "Log Output →" CTA. Footer message adapts to filtered vs. all view. File: `src/screens/FeedScreen.tsx`

- [2026-05-25] **LogOutputScreen shows wrong skills when prioritized path differs from enrolled path** — Added `prioritizedPathId` to store reads in `LogOutputScreen.tsx`. `builtInOptions` now filters by `prioritizedPathId ?? user.careerPathId` instead of always using `user.careerPathId`. File: `src/screens/LogOutputScreen.tsx`

- [2026-05-25] **Streak freeze button missing remaining count** — "Use Freeze" button text updated to show `🧊 Use Freeze (N left)` using `user.streakFreezes`. File: `src/screens/DashboardScreen.tsx`

- [2026-05-25] **Weekly leaderboard permanently hardcoded** — Leaderboard now merges seed users with the current user's actual XP, sorts by XP, takes top 3. Current user renders as "You" with purple highlight. File: `src/screens/FeedScreen.tsx`

- [2026-05-25] **MilestoneScreen blank screen for custom skill completions** — Extended skill resolution to search `customPaths` from the Zustand store. Guard only bails on missing `user`/`skill`. File: `src/screens/MilestoneScreen.tsx`

- [2026-05-24] **CelebrationOverlay fires on every Dashboard mount** — Changed `useState(true)` → `useState(false)`, added `celebratedMilestones: string[]` persistent state + `markMilestoneCelebrated(key)` action. Files: `src/store/appStore.ts`, `src/screens/DashboardScreen.tsx`

---

## 🔴 Open Bugs

_(None — all previously tracked bugs fixed as of sprint 21)_

---

## 🟡 Product Backlog

> **Superseded (sprint 28) — historical.** The **active** backlog is the BAEF section at the top (**Open Items** dashboard + **P0–P3** + **Resolved**). This pre-BAEF tier list is retained for history; its only still-relevant content is **Tier 4 (Phase 2 backend)**, now tracked as **ARCH-001** + the P2 backend bullets. Do not add new items here — add them to the BAEF backlog.

_Priority order within each tier. Severity: 🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low_

---

### Tier 1 — Pilot Launch Blockers (none as of sprint 18)

All critical and high issues resolved. App is ship-ready for closed pilot.

---

### Tier 2 — Pre-Public-Launch Quality (P1)

#### ~~UX-015 — No post-onboarding welcome moment~~ ✅ Fixed sprint 19

#### ~~A11Y-001 — No accessibilityLabel on interactive elements~~ ✅ Fixed sprint 20

#### ~~A11Y-005 — textMuted color fails WCAG AA contrast ratio~~ ✅ Fixed sprint 19

#### ~~OPS-002 — No per-screen error boundaries~~ ✅ Fixed sprint 19

---

### Tier 3 — Performance & Technical Debt (P2)

#### ~~PERF-002 — buildInsights() and buildWeekGrid() not memoized~~ ✅ Fixed sprint 19

#### ~~TD-001 — saveToStorage called manually at 10+ call sites~~ ✅ Fixed sprint 21

#### ~~OPS-005 — Single JS chunk at 565KB uncompressed~~ ✅ Fixed sprint 21 (partial)

---

### Tier 4 — Phase 2 Backend Infrastructure

These items unblock multi-user features and real data persistence. None block the pilot — mock data is sufficient for single-user validation.

- **Supabase auth** — Magic Link authentication replacing `localStorage`-based identity. Schema in `docs/DATABASE.md`.
- **Supabase database** — Persist outputs, userSkills, communityFeed, achievements server-side. Enables multi-device sync.
- **Real community feed** — Replace `MOCK_FEED` with live posts from followed users. Requires Supabase + follow graph.
- **Real weekly XP leaderboard** — Replace static mock leaderboard with live aggregated XP query.
- **Follow / unfollow users** — Social graph foundation for real feed and notifications.
- **Feed post persistence** — Reactions and comments added after page load currently live in-memory only (sprint 18 fixed post *creation* persistence; reaction/comment persistence needs Supabase).
- **AI-generated LinkedIn post** — OpenAI Edge Function triggered on skill completion. Spec in `docs/ARCHITECTURE.md`.
- **PostHog activation** — Set `VITE_POSTHOG_API_KEY` in `.env`. All 16 events already instrumented; just needs the key.

---

### ✅ Completed Backlog Items

**[2026-05-29 sprint 22]**
- **BUG-011 — Custom path Dashboard action card** — `customSkillMap` fallback added to `nextSkill` computation in `DashboardScreen`. Custom path users now see NEXT MILESTONE card and Log Work CTA.

**[2026-05-29 sprint 21]**
- **TD-001 — Zustand persistence subscriber** — Replaced all 11 manual `saveToStorage(...)` call sites with a single `useAppStore.subscribe()` listener at module level. Subscriber uses reference-equality short-circuit; only writes to localStorage when a persisted field actually changed. Also fixed a latent bug in `markMilestoneCelebrated` that was silently omitting `userFeedPosts` from its payload (would have caused feed posts to vanish on next reload when a milestone was celebrated). Updated `updateAvatar/updateBio/updateName` to be more concise (no intermediate `updatedUser` variable needed at call site).
- **OPS-005 — Vite bundle splitting** — Added `build.rollupOptions.output.manualChunks` to `vite.config.ts`. Vendor chunk: react + react-dom + react-native-web (542KB, highly cacheable). Navigation chunk: @react-navigation/* (163KB, cacheable). App code chunk: 192KB (down from 565KB — 66% reduction in the chunk that refreshes on every deploy). Returning users re-download only 192KB per deploy instead of 565KB.
- **BUG (sprint 20 regression) — ProfileScreen `a.name` → `a.title`** — Sprint 20's accessibility pass introduced `${a.name}` in two `accessibilityLabel` strings, but the `Achievement` type has `title` not `name`. Caused 2 TypeScript errors. Fixed: both references updated to `${a.title}`. Files: `src/screens/ProfileScreen.tsx`.

**[2026-05-29 sprint 20]**
- **A11Y-001 — Accessibility labels on all interactive elements** — `accessibilityLabel` + `accessibilityRole="button"` on all `TouchableOpacity` and `TextInput` elements across 7 files. Tab bar uses `tabBarAccessibilityLabel` including dynamic streak-risk label for Log tab.

**[2026-05-29 sprint 19]**
- **UX-015 — Post-onboarding welcome card** — `showWelcomeCard` store flag + Modal overlay with XP counter animation in DashboardScreen.
- **A11Y-005 — textMuted contrast fix** — `Colors.textMuted` `#44446A` → `#7070A0` (≥4.6:1 WCAG AA).
- **PERF-002 — useMemo on buildInsights/buildWeekGrid** — hoisted from inline IIFEs to memoized component-level constants.
- **OPS-002 — Per-screen error boundaries** — `withScreenBoundary` HOC wraps all 5 tab screens in AppNavigator.

**[2026-05-29 sprint 18]**
- **communityFeed persistence (BUG-010)** — User posts now survive page refresh via `userFeedPosts[]` in localStorage.
- **unlockDependentSkills pathId fix (BUG-002)** — Prioritized-path skill completions now unlock correct dependents.
- **Empty skill list direction text (UX-001)** — "above" → "below" copy fix in LogOutputScreen.

**[2026-05-29 sprint 17]**
- **Skill progress bars on LogOutputScreen** — Inline progress + "🎯 Final push!" badge on skill option cards.

**[2026-05-28 sprint 16]**
- **Comment feature on Feed posts** — `addComment` Zustand action; expandable TextInput per FeedCard.

**[2026-05-27 sprint 8]**
- **Output timestamps in Profile gallery** — `timeAgo()` in metadata; "N total" count in section header.
- **Output type filter in Profile gallery** — Horizontal filter chips; hidden when ≤1 output type.

**[2026-05-27 sprint 7]**
- **Custom path auto-switch** — `addCustomPath` returns path ID; `switchPath` called on creation.

**[2026-05-27 sprint 6]**
- **Level-Up Overlay Animation** — Full-screen gold overlay for non-skill-completion level-ups.
- **`first_output_logged` analytics event** — Fires separately from `output_logged` with `time_to_first_output_minutes`.
- **`log_screen_abandoned` analytics event** — Fires on unmount without submit; includes form-fill depth properties.

---

## 🗄 Archive (pre-BAEF, superseded)

Historical artifacts kept for reference. **Not active** — the live assessment is the BAEF Release Readiness Audit + Open Items at the top.

---

## 🏆 Production-Readiness Scorecard _(legacy — superseded by BAEF audit, sprint 28)_

| Dimension | Score | Status |
|---|---|---|
| Core addiction loop | 10/10 | ✅ Log → XP → Milestone → Feed → Repeat all functional; user post reactions/comments now persist |
| State management | 10/10 | ✅ TD-001 fixed; single persistence subscriber; userFeedPosts synced on react/comment |
| Skill progression logic | 10/10 | ✅ BUG-002 fixed; BUG-011 fixed (sprint 22); custom path Dashboard action card now renders |
| UX copy clarity | 9/10 | ✅ UX-001 fixed; remaining copy clean |
| Onboarding flow | 9/10 | ✅ UX-015 fixed; welcome card with XP counter on first Dashboard load; avatar fixed for all 19 paths |
| Accessibility (WCAG AA) | 9/10 | ✅ A11Y-005 fixed (contrast); A11Y-001 fixed; sprint 21 fixed a.name→a.title TS regression |
| Performance | 9/10 | ✅ OPS-005 addressed; vendor chunk split, App bundle ~231KB |
| Error handling | 8/10 | ✅ OPS-002 fixed; per-screen error boundaries via withScreenBoundary HOC |
| Analytics coverage | 10/10 | ✅ 16 events instrumented; duplicate JSDoc comment removed; PostHog-ready |
| Security | 7/10 | 🟡 No XSS risk (RN renders text nodes); localStorage unencrypted (acceptable for pilot) |
| Architecture cleanliness | 10/10 | ✅ ARCHITECTURE.md fully rewritten to match actual implementation (was describing wrong stack) |
| App Store / PWA readiness | 8/10 | ✅ manifest.json, icons present; no HTTPS enforcement yet |
| Community feed | 10/10 | ✅ 24 seed posts across 19 paths; every path now has ≥1 community post; filter chips dynamic for all 19 paths |
| **Overall pilot readiness** | **10/10** | ✅ **All Tier 1–3 items resolved. Sprint 26: reaction/comment persistence, docs alignment. Remaining: Phase 2 backend (requires credentials)** |

> **Sprint 26 verdict:** Three targeted fixes — (1) Reactions and comments on user's own feed posts were ephemeral: `reactToPost` and `addComment` updated `communityFeed` in memory but never synced back to `userFeedPosts` (the persisted field). On page reload, all reactions/comments on user-created posts were silently dropped. Fixed by adding a `userFeedPosts` sync step in both actions — maps each user post to its updated version in the new feed array before calling `set()`. No new state fields needed. (2) `analytics.ts` JSDoc had a duplicate `first_output_logged` line — removed the redundant entry. (3) `docs/ARCHITECTURE.md` described an entirely different planned stack (Expo Router, NativeWind v4, Reanimated 3, Lottie, three separate Zustand stores) — none of which are in the actual codebase. Complete rewrite: current stack accurately documented (React Navigation 7, StyleSheet.create, RN Animated API, single store), animation patterns with real code, Vite chunk config, analytics event table, persistence mechanism, all key architectural decisions. Phase 2 Supabase migration plan preserved as a planned section. 0 TS errors. Browser verified: feed renders, all 24 posts and 19 filter chips present.

> **Sprint 25 verdict:** Final community coverage gap closed — 8 paths (business-analyst, data-analyst, project-manager, solutions-architect, software-architect, mobile-developer, ui-ux-designer, startup-founder) had zero seed posts. Added 8 high-quality posts (fp-017–fp-024) with realistic personas, specific technical details, and engaging comments on 4 of them. Community feed now has 24 posts across all 19 built-in paths. Every new user, regardless of their chosen path, will immediately see community activity from peers on the same journey. Filter chips auto-appear for all 19 paths. App chunk: 231KB (was 223KB, expected +8KB). 0 TS errors. ✓ built in 2.89s.

> **Sprint 24 verdict:** Three targeted polishing fixes — (1) Avatar emoji/color bug: `completeOnboarding` had a 3-path hardcoded ternary for avatar values; users selecting any of the 16 newer paths (ML Engineer, Cybersecurity, etc.) got fullstack's `🌐` avatar. Fixed to use `CAREER_PATHS.find(p => p.id === pathId)?.icon` and `?.dimColor`. (2) Duplicate analytics: `first_output_logged` fired twice when the first output was logged during onboarding — once from `OnboardingScreen.tsx` (fewer properties) and once from `logOutput` in the store (richer, with `time_to_first_output_minutes`). Removed the redundant call from `OnboardingScreen`. (3) Community seed posts: 14 of 19 paths had zero MOCK_FEED posts; users enrolling in those paths saw no community. Added 6 realistic posts: ML Engineer (Kenji Nakamura, churn model), Frontend Engineer (Sofia Petrov, React SPA rebuild), DevOps (Tariq Hassan, CI/CD pipeline), Cloud Engineer (Isabelle Müller, Terraform IaC), Cybersecurity (Jordan Lee, bug bounty), Product Manager (Priscilla Okwu, discovery sprint). Feed filter chips now auto-appear for 11 of 19 paths (up from 5). 0 new TS errors. Verified in browser: All 16 count confirmed, all 6 new path chips visible in filter row.

## 🏗 Build Notes

- **Toolchain:** Vite 5 (web), Metro (native). Web builds go via Vite only.
- **FUSE workaround:** FUSE-mounted workspace (`/sessions/*/mnt/App_MaglakbAI`) blocks `unlink` in bash, causing Vite build failures if run in-place. Workaround:
  1. `cp -r /sessions/.../App_MaglakbAI /tmp/sf_<sprint>` (cp errors on node_modules are non-fatal)
  2. `rm -rf /tmp/sf_<sprint>/node_modules && ln -s /sessions/.../App_MaglakbAI/node_modules /tmp/sf_<sprint>/node_modules`
  3. `cd /tmp/sf_<sprint> && node node_modules/.bin/vite build --outDir /tmp/sf_dist_<sprint>`
  4. Copy new `dist/` files back to workspace (old files cannot be deleted from bash; new files overwrite correctly)
- **Dev server:** Write a static Node HTTP server to the persistent outputs path (`/sessions/.../outputs/serve_sf_<sprint>.js`) — not `/tmp` (lost between bash calls). Serve from `/tmp/sf_dist_<sprint>` on port 8083.
- **Verify:** `curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:8083/` should return `HTTP 200`.

---

## 📓 Run Log

### 2026-06-05 (sprint 41) — Security hardening + compatibility fixes + test suite repair
- **Improvements made:** Fixed all 7 remaining sprint-39 audit findings that could be addressed without a native build target:
  - **NEW-001 (P1) — FIXED:** All `background:` CSS shorthand replaced with `backgroundImage:` + `backgroundColor` fallback across 10 files (`CareerNode.tsx`, `FeedCard.tsx`, `LevelUpOverlay.tsx`, `XPBar.tsx`, `DashboardScreen.tsx`, `LogOutputScreen.tsx`, `EvolveScreen.tsx`, `MilestoneScreen.tsx`, `ProfileScreen.tsx`, `AppNavigator.tsx`). Console errors per session: 128 → 0.
  - **NEW-004 (P2) — FIXED:** `window.location.origin` in `auth.ts` guarded with `typeof window !== 'undefined'` fallback to `'skillforge://auth'`.
  - **NEW-005 (P2) — FIXED:** `import.meta.env.DEV` in `App.tsx` replaced with `__DEV__` (Vite defines it; also Metro-compatible).
  - **NEW-011 (P2) — FIXED:** Content-Security-Policy header added to `netlify.toml` covering self, Supabase, and PostHog.
  - **NEW-009 (P3) — ALREADY FIXED:** Sprint-39 docs alignment had corrected `CLAUDE.md` to `Colors.textSub` (not `Colors.textSecondary`). Confirmed closed.
  - **Test suite crash fix:** Supabase Realtime client initializes a WebSocket at module load time, crashing Node.js 20 tests when `.env` credentials are present. Fixed by adding `isBrowserEnv = typeof window !== 'undefined'` guard to `isSupabaseEnabled` in `supabase.ts` — Supabase no-ops gracefully in Node.js.
- **Sprint 40 items (previously committed, now confirmed):**
  - **ARCH-001 (P1) — RESOLVED:** Supabase backend live (`7461f04`) — Magic Link auth, cloud backup, multi-device sync. Market demand layer (community signals) added.
  - **UX-028 (P2) — RESOLVED:** Consent banner moved post-onboarding (`{hasOnboarded && <ConsentBanner />}` in App.tsx). No longer blocks "Begin Your Journey" CTA.
  - **UX-029 (P2) — RESOLVED:** `completeOnboarding` now grants 25 XP + streak 1 (`0b22c20`); pre-completed skills credited on experience-level selection.
  - **Sprint-40 feature:** Community market demand layer — `DemandBadge` component, curated `MARKET_DEMAND_MAP` (19 paths × skills), `marketDemand`/`submittedSignalSkillIds` store state, `loadMarketDemand`/`submitMarketSignal` actions, demand gap strip on Dashboard, demand badges on skill nodes in EvolveScreen, one-tap signal prompt after output recap.
  - **Theme improvements:** `ColorsLight` palette refined (better lavender bg, richer accents), `getPathColor()` theme-aware path color helper, improved inactive tab opacity in light mode.
- **Files changed:** `src/lib/supabase.ts`, `src/lib/auth.ts`, `App.tsx`, `netlify.toml`, `reports/skillforge-audit-report.md`.
- **Verification:** `npm test` → **94 passed / 0 failed** (restored after supabase.ts browser-env guard); `vite build` ✓ (613 modules, 0 TS errors, 1.81s).
- **Score: 7.7/10** — up from 6.5. Pilot-ready.
- **Open items after this run:** 8 total — 1 × P1, 2 × P2, 5 × P3.

### 2026-06-04 (sprint 39) — UX-020 Skills label disambiguation + RES-005 leaderboard header
- **Improvement made:** Resolved two open items — UX-020 (P2) and RES-005 (P3).
  - **UX-020:** "Skills" appeared on 3 screens with 3 different meanings (completed/total ratio, completed count, outputs-based count). Fixed with targeted label changes: Dashboard ring `X / Y skills` → `X / Y skills completed`; Profile stat `Skills Done` → `Skills Completed`; Portfolio stat `skill`/`skills` → `skill started`/`skills started`. Three unambiguous terms now surface distinctly across all screens.
  - **RES-005:** "🏅 WEEKLY XP LEADERBOARD" wrapped to 2 lines at 320px. Shortened to "🏅 WEEKLY XP" in `FeedScreen.tsx`.
- **Files changed:** `src/screens/DashboardScreen.tsx`, `src/screens/ProfileScreen.tsx`, `src/screens/PortfolioScreen.tsx`, `src/screens/FeedScreen.tsx`, `reports/skillforge-audit-report.md`.
- **Verification:** `vite build` ✓ (611 modules, 0 TS errors, 4.82s); HTTP 200 confirmed at http://192.168.123.37:8083.
- **Notes:** Build used `/tmp/sf_build` workaround (old `/tmp/sf_today` node_modules symlink from prior session was unremovable). 94 tests unaffected (pure label changes; no store/domain logic touched).
- **Open items after this run:** 10 total — 2 × P1, 5 × P2, 3 × P3.

### 2026-06-04 (sprint 39) — Full production-readiness audit (Filesystem + Playwright MCPs)
- **Audit scope:** Architecture, UX, onboarding, learning science alignment, mobile responsiveness, accessibility, performance, App Store readiness. Playwright used against live production app (`https://fascinating-kitten-b6a79d.netlify.app`).
- **Verdict: CONDITIONAL GO for closed web/PWA pilot · NO GO for public launch or App Store.**
- **Overall score: 6.5/10** (down from 7.5 — live audit surfaced systemic issues masked by static analysis).
- **7 new findings logged:**
  - **NEW-001 (P1):** 128 console errors per session — `background:` CSS shorthand rejected across 10 files by react-native-web. Real errors are invisible in this noise. Fix: replace with `backgroundColor` or inline `backgroundImage` for gradients.
  - **NEW-004 (P2):** `window.location.origin` directly in `auth.ts:22` — throws on native/Metro. Fix: guard with `typeof window !== 'undefined'` and use Expo `Linking` for native.
  - **NEW-005 (P2):** `import.meta.env` in `App.tsx` — Metro bundler incompatibility. Fix: replace with `__DEV__`.
  - **NEW-007 (P2):** `app.json` missing `icon`, `splash.image`, `ios.buildNumber`, `ios.privacyManifest` — all required for App Store submission.
  - **NEW-011 (P2):** No Content-Security-Policy header in `netlify.toml` — XSS risk with Supabase credentials in bundle.
  - **NEW-006 (P3):** 14 hardcoded hex values in `DashboardScreen.tsx` — bypass theme + won't respond to color scheme switching.
  - **NEW-009 (P3):** `Colors.textSub` in code vs `Colors.textSecondary` in `CLAUDE.md` — documentation/code naming mismatch.
- **Confirmed still open:** UX-028 (consent banner overlaps Begin CTA — confirmed via geometry: `overlaps: true`), UX-029 (skip → 0 XP / 🔥0 confirmed), UX-022, ARCH-004, ARCH-005, ARCH-007, REL-001, RES-006.
- **UX-020 confirmed closed:** Playwright found consistent skill-count labeling across all screens.
- **App Store gap analysis:** 11 blocking items identified including 6 web-only API call sites, `import.meta.env`, missing app assets, no Universal Links for Magic Link auth, SVG-as-JSX incompatible with native, and `localStorage` persistence layer. Estimated 3–4 weeks engineering to achieve a submittable iOS build.
- **Scorecard (per dimension):** Architecture 7 · UX 7 · Onboarding 7 · Learning Science 8 · Mobile Responsiveness 7 · Accessibility 6 · Performance 9 · App Store Readiness 2.
- **Open items after this run:** 17 total — 3 × P1, 9 × P2, 5 × P3.

### 2026-06-03 (sprint 38) — Mobile responsiveness audit + 4 fixes
- **Audit method:** live preview at 320px (iPhone SE), 375px (standard), 768px (tablet) across all 5 tabs + onboarding + Log form.
- **Findings logged:** RES-001–006. Two P2 items, two P3 cosmetic items fixed immediately; two P3 deferred (owner decision or Phase 2).
- **RES-001 (P2) — Touch target too small:** `TOTAL XP ⓘ` button measured at 13px tall (29px with `hitSlop`) — below the 44px WCAG minimum. Fixed: added `minHeight: 44, justifyContent: 'center'` to `statLblRow` in `DashboardScreen.tsx`.
- **RES-002 (P2) — Tab label truncates at 320px:** "Community" (9 chars) truncates to "Commu…" in the bottom nav at 320px. Fixed: renamed tab label to "Feed" in `AppNavigator.tsx` (screen header still says "Community"; accessibility label unchanged).
- **RES-003 (P3) — Filter chips: no scroll affordance:** 19 path-filter chips in a horizontal `ScrollView` with `showsHorizontalScrollIndicator={false}` gave no visual cue that more chips exist off-screen. Fixed: added a 40px right-to-background fade gradient overlay (`View` with inline `background: linear-gradient(...)` — inline is required; RN-web's StyleSheet.create strips CSS gradient shorthand).
- **RES-004 (P3) — "MILESTONE MAP" wraps at 320px:** At 320px the header row was too wide, causing the label to wrap to 2 lines. Fixed: shortened to "MILESTONES", added `numberOfLines={1}` and `flexShrink: 0` via a `skillTreeLabel` style in `EvolveScreen.tsx`.
- **Deferred:** RES-005 ("WEEKLY XP LEADERBOARD" wraps at 320px — cosmetic, low priority); RES-006 (bare side bands on tablet — owner design decision).
- **Verification:** `tsc` clean; **94 passed / 0 failed**; `vite build` ✓; all 4 fixes live-verified in preview at 320px.
- **Files:** `src/screens/DashboardScreen.tsx`, `src/navigation/AppNavigator.tsx`, `src/screens/FeedScreen.tsx`, `src/screens/EvolveScreen.tsx`, `reports/skillforge-audit-report.md`.

### 2026-06-03 (sprint 37) — FEAT-001 Step 2: EvolveScreen edit UI (shipped + live-verified)
- **Built the editable-roadmap UI** on top of the Step-1 store layer, per the approved sketch (3 confirmed decisions: dedicated Edit modal · ▲▼ reorder buttons · keep both Archive *and* Delete & rebuild with distinct copy).
- **State-aware MILESTONE MAP chip** (`EvolveScreen` header) reflects the viewed roadmap: `✏️ Edit` (editable custom) · `🔒 Locked` (tap to unlock, pre-start) · `🔒 In progress` (started → delete & rebuild) · `📋 Editable copy` (built-in → fork). Hidden for `personal_library`.
- **New `EditRoadmapModal`** (reuses the `makeModal` milestone-editor styling + a new `makeEdit` factory): pre-start banner, path preview, per-row rename (writes `renameMilestone` on change), ▲▼ reorder (`reorderMilestones`), ✕ remove (`removeMilestone`), an add row (icon-cycle + name + Add → `addMilestone`), and a "🔒 Lock it in" CTA (`lockRoadmap`). All actions are store-gated to pre-start/editable.
- **New `ForkConfirmModal`** (built-in → `forkBuiltInPath`, then drops the user straight into editing the copy) and **`DeleteRebuildConfirmModal`** (`deleteRoadmap`, then opens the builder to rebuild). Both mirror `PriorityConfirmModal`.
- **`RoadmapActionsSheet` (⋯ menu)** gained conditional rows: *Edit Milestones*, *Lock It In*, *Unlock to Edit*, *Make an Editable Copy*, and a danger *Delete & Rebuild* — alongside the existing Set Priority / Pause / Archive. Archive copy clarified to "Pause and keep. Reactivate anytime." so it reads distinctly from Delete & Rebuild ("Remove to start fresh — your proof & XP are kept").
- **Live smoke test (Vite preview, seeded custom journey):** edit chip renders → modal opens → add milestone (new `userSkill` created + persisted) → reorder (persisted) → lock (`locked=true`, chip → 🔒 Locked) → unlock (chip → ✏️ Edit). No new console errors, no error boundary. (Only pre-existing `background`-shorthand style warnings remain — unrelated, lines 1727/2322.)
- **Verification:** `tsc` clean (source); full suite still **94 passed / 0 failed**; `vite build` ✓.
- **Files:** `src/screens/EvolveScreen.tsx` (chip + 3 new modals + sheet rows + `makeEdit` styles + wiring), `reports/skillforge-audit-report.md`. No store changes (Step 1 already shipped the actions).

### 2026-06-03 (sprint 37) — FEAT-001 Step 1: editable-roadmap data/store/XP foundation
- **Feature:** editable journey/roadmap milestones. Users can shape a roadmap to their real work/planned trainings, fork a built-in path into an editable copy, optionally **focus-lock** it, and (the post-start escape hatch) delete & rebuild.
- **Assessment outcome (binding product decisions, owner):** (1) **Edit only *before* the journey starts** — once any milestone has logged progress the structure freezes; to change it the user deletes & rebuilds. Rationale: keep the XP target stable mid-journey, avoid analysis paralysis / never-finishing. (2) Built-in paths are **forked to an editable custom copy** (catalog never mutated). (3) Custom milestones **require proof (an output) + a modest flat XP bonus** (no curated rewards — leaderboard-safe). (4) Company/admin default roadmaps = **NOT feasible now** (needs backend ARCH-001 + team model) → deferred to Phase 2/4.
- **"Started" definition:** a roadmap is started once any of its skills has progress — an output logged (`outputCount > 0`) or a credited `in_progress`/`completed` state. Experience-level pre-crediting therefore counts as started; a Fresh Start custom path stays editable until the first output.
- **Implemented (Step 1 — data/store/XP + tests):**
  - `RoadmapEntry.locked?: boolean` (`src/types/index.ts`) — user focus-lock.
  - `pathHasProgress(skillIds, userSkills)` pure helper (`src/domain/skillGraph.ts`) + `CUSTOM_SKILL_COMPLETION_XP = 50` (`src/domain/progression.ts`).
  - `coreSlice.logOutput` now grants the flat custom-completion bonus (custom milestones previously gave **0** completion XP).
  - `roadmapSlice` actions, **all gated by `isRoadmapEditable` (custom + not locked + not started)**: `isRoadmapEditable`, `forkBuiltInPath`, `addMilestone`, `renameMilestone`, `removeMilestone`, `reorderMilestones`, `lockRoadmap`, `deleteRoadmap`. Wired into the `AppState` interface + slice `Pick`.
  - `deleteRoadmap` semantics: un-enroll + drop the custom path definition + drop only its **unstarted** userSkills; **earned outputs/XP are kept** (permanent proof); promotes the next active roadmap to PRIORITY if the deleted one was priority; repoints `user.careerPathId` if needed.
- **Tests:** +13 (81 → **94 passing**). New: `pathHasProgress` (4, domain) and FEAT-001 store tests (9) covering editable-gating allowed pre-start / blocked post-start / blocked when locked / blocked for built-in, fork (copy + enroll + catalog untouched + null for non-built-in), rename/remove/reorder, lock toggle, delete (un-enroll + drop + promote), and the +50 custom-completion XP rule.
- **Verification:** `tsc` clean (only pre-existing sandbox `vitest`/`react-dom` type noise); full suite **94 passed, 0 failed**; `vite build` ✓.
- **Files:** `src/types/index.ts`, `src/domain/skillGraph.ts`, `src/domain/progression.ts`, `src/store/slices/coreSlice.ts`, `src/store/slices/roadmapSlice.ts`, `src/store/appStore.ts`, `src/store/__tests__/slices.test.ts`, `src/domain/__tests__/skillGraph.test.ts`, `reports/skillforge-audit-report.md`.
- **Next (Step 2 — paused for confirmation):** `EvolveScreen` edit UI — pre-start edit/fork/lock controls; started state = read-only + a "delete & rebuild" affordance. Touches the 1,886-line god component (ARCH-004), so confirm UX before building.

### 2026-06-03 (sprint 36) — First-time-user simulation + UX-027 fix
- **Simulated a fresh first-run** (clear state → consent → 5-step onboarding → skip → Home/Evolve). Identified abandonment risks; logged **UX-027** (beginner first-output contradiction — highest), **UX-028** (consent before value), **UX-029** (slow time-to-first-win). Lower-priority: path-choice overload, no real social proof until Phase 2.
- **Fixed UX-027 (top activation risk):** `OnboardingScreen.FirstOutputStep` beginner branch reframed from "Prove it with your first output / what have you already built" → **"Start with one small step"** + optional/forward-looking subtitle + skip relabeled "I'm just getting started — skip →". Experienced/building/custom unchanged.
- **Verification:** `tsc` clean; `vite build` ✓; live-verified the Fresh Start path shows the new copy.
- **Files changed:** `src/screens/OnboardingScreen.tsx`, `reports/skillforge-audit-report.md`.

### 2026-06-03 (sprint 36) — UX-026 logged (deferred to Phase 2)
- User noticed the Community "XP this week" (e.g. 265) is **output XP only** — confirmed: `FeedScreen.weeklyUserXP` sums `output.xpGained` from the last 7 days, excluding achievement/streak/outcome/validation XP (only outputs are timestamped to a window). Logged **UX-026** (P3). **Owner decision: hold for the fuller fix with the Phase-2 real leaderboard (ARCH-001)** rather than the interim relabel. No code change.

### 2026-06-03 (sprint 36) — UX-023 + UX-018: Dashboard made scrollable, dead space eliminated
- **Improvement made:** **UX-023 + UX-018** — The `DashboardScreen` evolution view (ring, stats, cards) was a non-scrollable flex column. At short viewports (~384×622) the ring overflowed into the header. At tall viewports the `ringSection: { flex: 1 }` expanded to fill all remaining space, creating large dead bands above/below the ring.
- **Fix — `src/screens/DashboardScreen.tsx`:**
  - Replaced the bare `<>...</>` evolution fragment with a `<ScrollView style={{ flex: 1 }} contentContainerStyle={styles.evolutionScroll} showsVerticalScrollIndicator={false}>`. Header remains outside ScrollView (sticky).
  - Added `evolutionScroll` style: `{ gap: Spacing.sm, paddingBottom: Spacing.md }` — inherits all the card spacing from the old `inner` gap.
  - Changed `ringSection` from `{ flex: 1, justifyContent: 'center', alignItems: 'center' }` to `{ alignItems: 'center', paddingTop/Bottom: Spacing.sm }` — ring no longer expands to fill height.
  - Removed `paddingBottom` from `inner` (the ScrollView's `evolutionScroll` content padding covers it).
- **Result:** Content scrolls gracefully at any height; ring sits at natural size (no dead-space bands at 812px); header never overlaps at 622px. Two open P2 items closed in one change.
- **Files changed:** `src/screens/DashboardScreen.tsx`, `reports/skillforge-audit-report.md`.
- **Tests:** 81 tests unaffected (pure layout change; no store/domain logic touched). `vite build` ✓ — 566 modules, 0 TS errors, 3.41s. HTTP 200 verified at http://192.168.123.37:8083.
- **Independent verification + commit (sprint 36):** this change had been left uncommitted in the working tree; reviewed, re-verified live (384×622 → **no overlap**; 375×812 → hero top-anchored, prior centered gaps gone), and **committed `a7c8b70`**. Accuracy note: at 812px with sparse content (brand-new user) some whitespace remains *below* the last card — expected (content top, slack bottom), much less jarring than the old centered floating, so "dead space eliminated" is more precisely "dead-centered floating eliminated."

### 2026-06-02 (sprint 35) — UX-025 fix: credit missed-achievement XP on load
- **Resolved UX-025 (P2 🟠).** Root cause: load-time rehydration added "missed" achievements to `unlockedAchievementIds` without crediting their XP → Profile XP-source breakdown overshot Total XP and the user was under-credited.
- **Fix:** extracted the heal logic into a pure `src/domain/hydration.ts` → `reconcileAchievementsAndXP()` that drops invalid achievements, adds missed ones, **deducts revoked XP AND credits added (missed) XP**, and caps no-history accounts. `appStore.ts` now calls it (old ~50-line inline block removed; dead `skillGraph` import removed → store shrinks further).
- **Tests:** `src/domain/__tests__/hydration.test.ts` (5: consistent no-op, missed-credit, revoke-deduct, no-history cap, active-not-capped). **81 tests total, green.**
- **Verification:** `tsc` clean; `vite build` ✓; **live** — user missing earned `evolution` loaded → Total 595→**695** (credited), Profile XP Sources **320+375=695** reconcile.
- **Files changed:** `src/domain/hydration.ts` (new), `src/domain/__tests__/hydration.test.ts` (new), `src/store/appStore.ts`, `reports/skillforge-audit-report.md`.

### 2026-06-02 (sprint 35) — UI/UX review: 8 findings logged, 3 fixed, 1 real bug fixed, 1 confirmed
- **Reviewed all screens** (Home/Community/Evolve/Profile/Settings/Portfolio + onboarding/Log) with a realistic injected user. Logged **UX-018…UX-025** (dead space, casing, "skills"/"this week" ambiguity, subtitle clip, short-viewport overlap, streak/dormancy, XP-source reconciliation).
- **Fixed (presentation):** **UX-019** Profile stat labels → ALL-CAPS (match Home); **UX-021** Community subtitle wraps (title/subtitle `View` → `flex:1`). Both live-verified.
- **Found + fixed a real logic bug — BUG-013 (was UX-024):** `DashboardScreen.daysSinceLastOutput` read `outputs[0]` assuming newest-first, but `logOutput` *appends* (newest last) → decay/dormancy computed from the user's *oldest* output, showing a false "you've been away 13 days" card to active users. Fixed to use the most-recent `createdAt`. Live-verified: active user now shows the correct next-milestone nudge.
- **Confirmed real (not fixed) — UX-025:** XP-source breakdown overshoots Total XP because rehydration adds "missed" achievements without crediting their XP. Reproduced with clean data (595 XP showed Achievements +375). Severity 🟠; recommended a focused, tested fix in the healing path.
- **UX-018 (Home dead space):** attempted top-anchor, reverted (just moved the slack) — needs a layout pass with UX-023.
- **Verification:** `tsc` clean; **76 tests** green; `vite build` ✓.
- **Files changed:** `src/screens/ProfileScreen.tsx`, `src/screens/FeedScreen.tsx`, `src/screens/DashboardScreen.tsx`, `reports/skillforge-audit-report.md`.

### 2026-06-02 (sprint 33) — DOC-013 fix + UX-017 logged
- **DOC-013 resolved:** updated onboarding from "4-step" to the real **5-step** flow (added the experience-level step + name/email) across `CLAUDE.md` (×2), `README.md`, `docs/USER_GUIDE.html` (incl. "Step 3 of 5" caption; re-synced to `public/USER_GUIDE.html`), and both daily-QA skill copies. Repo-wide check: no "4-step" references remain.
- **UX-017 logged (P2 🟢):** the onboarding first-output "Log It" silently no-ops until both a type and a description are entered — no inline hint. Found during the BUG-012 live re-drive.
- **UX-017 scoped (code-verified):** checked `LogOutputScreen` for the same gap — it's **clean** (button `disabled` + `submitBtnDisabled` opacity 0.35 + a11y disabled state). UX-017 is therefore **OnboardingScreen-only**; `LogOutputScreen` is the pattern to copy.
- **UX-017 fixed:** applied the pattern to `OnboardingScreen` first-output button — `disabled={!canSubmit}` + `accessibilityState` + inline hint ("Add a title and a short description to continue"); kept the existing dim. Live-verified empty (disabled+hint) and filled (enabled, submits, lands Home); `tsc` clean, `vite build` passes. `src/screens/OnboardingScreen.tsx` changed.

### 2026-06-02 (sprint 33) — BUG-012 fix: day-1 streak
- **Fixed BUG-012** — removed the `lastActiveDate` pre-set in `completeOnboarding` (coreSlice). The streak calc already starts at 1 for a first-ever log (`!lastActive` branch); the pre-set was forcing the same-day branch and pinning streak at 0. A new user's first output now correctly reads **1 DAY STREAK**.
- **Tests:** added "starts the streak at 1 on the day-1 first output (BUG-012)"; updated the same-day test to expect 1. **53 tests green**, `tsc` clean, `vite build` passes.
- **Files:** `src/store/slices/coreSlice.ts`, `src/store/__tests__/appStore.test.ts`, `reports/skillforge-audit-report.md`.

### 2026-06-02 (sprint 33) — Onboarding QA test (live, web/PWA)
- **Drove the full onboarding flow** in the preview (cleared localStorage → welcome → declined analytics → identity (Ada Pilot + email) → Data Architect path → Fresh Start (beginner) → first output (project, quality desc)). **Result: PASS** — landed on Home, no runtime errors.
- **Verified persisted state:** hasOnboarded ✓, handle derived (`ada.pilot`) ✓, email device-local ✓, roadmap `data-architect PRIORITY/ACTIVE` ✓, 5 skills initialized (`sql-foundations` in_progress 1/2, `python-automation` locked) ✓, first output XP **85** = project 75 + quality 10 (matches the XP model) ✓, evidence `documented` ✓, `first-steps` achievement (+25) ✓, total 110 / L1 ✓, consent `denied` respected ✓, 1 feed post ✓.
- **Two findings logged:** **BUG-012** (day-streak shows 0 after day-1 first output — `completeOnboarding` pre-sets `lastActiveDate`), **DOC-013** (onboarding is 5 steps, docs say 4 — missing the experience-level step).
- Reset the test account + stopped the preview server afterward.

### 2026-06-02 (sprint 34) — QA-001: slice tests + CI (resolved)
- **Closed QA-001 (P1).** Added `src/store/__tests__/slices.test.ts` — 16 store-action tests covering the previously-untested slices: **feed** (reactToPost toggle, toggleSavePost, addComment + empty-text guard), **profile** (updateName/handle, updateEmail trim, updateAvatar clears image, pace/goal/bio, setColorScheme, no-user guards), **roadmap** (addCustomPath + skill init, enrollInRoadmap idempotent, setPriorityRoadmap promote/demote, switchPath auto-enroll, pause/archive/reactivate, archive-priority promotes next active, addRoadmapItem → personal library). **76 tests total, green.**
- **CI added:** `.github/workflows/ci.yml` runs `tsc --noEmit` + `npm test` + `vite build` on every push/PR to main — satisfies QA-001's "CI runs on change."
- **Verification:** `tsc` clean; 76 tests green (esbuild+node harness); `vite build` ✓.
- **Scorecard:** Stability 8→9, Operational Readiness 7→8 (broad coverage + CI gate) → **Overall 7.3 → 7.4**.
- **Remaining test gap:** component/render tests for the large screens — folded into **ARCH-004** (decompose god components + add component tests).
- **Files changed:** `src/store/__tests__/slices.test.ts` (new), `.github/workflows/ci.yml` (new), `reports/skillforge-audit-report.md`.

### 2026-06-02 (sprint 34) — ARCH-003: schema-versioned persistence + migration
- **Resolved ARCH-003 (P1).** `persistence.ts` now writes a versioned envelope `{ v: SCHEMA_VERSION (1), data }`. `loadFromStorage` detects the version, runs a `migrate()` chain (legacy unversioned saves → v0 → migrated forward), validates shape (`isPlainObject` — rejects arrays/primitives/corrupt JSON/non-object envelope data), and returns `null` on a newer-than-current version (no downgrade crash). Used a lightweight hand-rolled validator (no new `zod` dependency — noted as a future option).
- **Removed all `as any`** from the appStore rehydration block (typed `PersistedState` return from `loadFromStorage`) + the `us: any` filter param — closes the strict-TS hole at the data-critical boundary.
- **Tests:** added `src/store/__tests__/persistence.test.ts` (7 tests: null/empty, v1 envelope, legacy v0 migration, corrupt JSON, non-object payload, non-object envelope data, newer-version reset). **60 tests total, green.**
- **Verification:** `tsc` clean; `vite build` ✓; **live** — injected a real legacy v0 flat payload → app booted to Home with all data intact (Welcome back Legacy, 250 XP, 4-day streak, 1/5 skills); after logging an output, storage was a `{ "v":1, "data":{…13 fields…} }` envelope (XP 250→335). Backward compat + new format both confirmed.
- **Docs:** updated `docs/ARCHITECTURE.md` (persistence row + versioning note now describe the envelope/migration instead of the old ⚠️ caveat).
- **Files changed:** `src/store/persistence.ts`, `src/store/appStore.ts`, `src/store/__tests__/persistence.test.ts` (new), `docs/ARCHITECTURE.md`, `reports/skillforge-audit-report.md`.

### 2026-06-02 (sprint 34) — ARCH-006: XP calculation extracted to domain
- **Improvement made:** **ARCH-006 — Single source of truth for output XP math.** `LogOutputScreen.tsx` and `coreSlice.ts` each independently computed `baseXP + qualityBonus + takeawayBonus` — if one was updated, the XP preview shown to the user would silently diverge from the XP actually awarded.
- **Fix — 3 files changed:**
  - `src/domain/progression.ts` — added `OUTPUT_XP_BY_TYPE: Record<OutputType, number>` (canonical base-XP lookup) and `calculateOutputXP(type, descriptionLength, hasKeyTakeaway): number` (single formula for the full XP calculation: base + quality bonus at ≥50/≥120 chars + takeaway bonus).
  - `src/store/slices/coreSlice.ts` — replaced the 11-line inline `OUTPUT_XP_BY_TYPE` dict + quality/takeaway bonus math with a single `calculateOutputXP(...)` call. Deleted the local dict entirely.
  - `src/screens/LogOutputScreen.tsx` — imported `OUTPUT_XP_BY_TYPE` (feeds the `OUTPUT_TYPES` display array so base-XP chip labels are in sync) and `calculateOutputXP` (drives the live XP preview IIFE). Preview XP now guaranteed to match awarded XP.
- **Tests added:** 6 new tests in `src/domain/__tests__/progression.test.ts` — per-type base values, 50-char quality threshold (+10), 120-char detailed threshold (+20), takeaway bonus (+15), bonus stacking, and a consistency check verifying every key in `OUTPUT_XP_BY_TYPE` matches `calculateOutputXP` with no bonuses. **53 tests total, all green** _(count corrected on sprint-34 verification: 4 files — leveling 6 + progression 28 + skillGraph 7 + appStore 12; an earlier draft of this entry said "11 new / 57 total", which was inaccurate)._
- **Files changed:** `src/domain/progression.ts`, `src/store/slices/coreSlice.ts`, `src/screens/LogOutputScreen.tsx`, `src/domain/__tests__/progression.test.ts`, `reports/skillforge-audit-report.md`
- **Build:** 565 modules, 0 TS errors. ✓ built in 2.46s. Chunks: vendor 545KB, navigation 163KB, App 416KB, index 2.45KB. Server live at http://192.168.123.37:8083 (HTTP 200 verified).
- **BAEF scorecard impact:** Technical Quality 8/10 → maintained (ARCH-006 closed, one fewer open P2); Stability 8/10 → maintained (+6 tests, 53 total). Overall 7.3/10 unchanged (ARCH-006 was P2, not a scorecard driver).
- **Verification (sprint 34, independent re-run):** `tsc --noEmit` clean on `progression.ts`/`coreSlice.ts`/`LogOutputScreen.tsx`; **53 tests green**; `vite build` ✓. Confirmed the store (`coreSlice.logOutput`) and the view (`LogOutputScreen` preview + type chips) both call `calculateOutputXP` — single source of truth achieved, no inline duplicate remains, preview total uses `totalBase` (no double-count).
- **Next up:** ARCH-003 (persistence schema versioning/migration — P1, next highest actionable item after ARCH-006).

### 2026-06-02 (sprint 33) — Backlog grooming
- **Hygiene:** moved the 11 resolved P1/P2 items (ARCH-002, PRIV-002, DOC-001…009) out of the active backlog into a new **Backlog — Resolved (BAEF, sprints 28–33)** section. Active backlog now shows only the **8 truly-open** items (REL-001, ARCH-001, ARCH-003, QA-001, ARCH-004/005/006/007).
- **Re-scored** the BAEF scorecard (stale since sprint 28): Stability 7→8, Technical Quality 7→8, Operational Readiness 6→7, Documentation 8→9 → **Overall 6.9 → 7.3**; refreshed stale notes.
- **Release Decision** reaffirmed + re-dated; condition #1 (privacy contact) checked off; rationale updated for the test/architecture/doc hardening.
- **Added an Open Items dashboard** (ID · priority · status · blocked-by + suggested order) at the top of the BAEF section.
- **Consolidated taxonomy:** relocated the superseded legacy scorecard from the top of the doc into a new **🗄 Archive** section; added a "superseded — historical" banner to the legacy **🟡 Product Backlog** tier list (BAEF P0–P3 + Open Items is now the single active backlog; legacy Tier 4 maps to ARCH-001).
- **Added an ID-prefix legend**; de-pinned ARCH-006's stale line reference (now file-relative); confirmed P3 holds only open product ideas (resolved docs already moved).

### 2026-06-02 (sprint 33) — Documentation audit (BAEF) + ARCHITECTURE rewrite + P1 docs
- **P1 doc trio resolved:** **DOC-003** `LICENSE` (proprietary / all-rights-reserved — reversible default for a product brand); **DOC-004** `.env.example` (PostHog + planned Supabase vars, gitignore-safe); **DOC-005** `docs/DEPLOYMENT.md` (build/test scripts, Vercel flow, GitHub Pages guide path, FUSE workaround, pre-deploy checklist).
- **Open docs remaining:** P2 — DOC-006 TESTING, DOC-007 CONTRIBUTING, DOC-008 SECURITY+privacy, DOC-009 PRD refresh; P3 — DOC-010/011/012.
- **Files added:** `LICENSE`, `.env.example`, `docs/DEPLOYMENT.md`.
- **P2 docs resolved:** **DOC-006** `docs/TESTING.md`; **DOC-007** `CONTRIBUTING.md`; **DOC-008** `SECURITY.md` + `docs/PRIVACY.md` (PRIV-002 real contact still open); **DOC-009** PRD status banner. Files added: `docs/TESTING.md`, `CONTRIBUTING.md`, `SECURITY.md`, `docs/PRIVACY.md`; edited `docs/PRD.md`.
- **P3 docs resolved:** **DOC-010** `docs/PROBLEM_VALIDATION.md`; **DOC-011** ADR log (`docs/adr/README.md` + ADR-0001…0005); **DOC-012** `CHANGELOG.md`. **All DOC-xxx items now closed** (DOC-001→012). Only the non-doc PRIV-002 (real privacy inbox) remains as a documentation-adjacent dependency.
- **Housekeeping:** removed 4 stray `.DS_Store` files (root, dist, docs, src).
- **Doc-set status:** documentation is now complete and self-consistent for the pilot — builder docs (README/CONTRIBUTING/ARCHITECTURE/TESTING/DEPLOYMENT/ADRs), user docs (USER_GUIDE/PRIVACY), product docs (PRD/PROBLEM_VALIDATION), governance (audit report/CHANGELOG/LICENSE/SECURITY).

### 2026-06-02 (sprint 33) — Documentation audit (BAEF) + ARCHITECTURE.md rewrite
- **Audited all docs.** Current: CLAUDE.md, README.md, audit report, USER_GUIDE.html, DATABASE.md, daily-qa skill, design assets. Logged gaps as governed items: **DOC-002** (ARCHITECTURE.md stale — top finding), **DOC-003** (no LICENSE), **DOC-004** (no `.env.example`), **DOC-005** (no DEPLOYMENT doc) [P1]; **DOC-006** (TESTING), **DOC-007** (CONTRIBUTING), **DOC-008** (SECURITY + privacy policy), **DOC-009** (PRD stale) [P2]; **DOC-010/011/012** (Phase-1 validation, ADR log, CHANGELOG) [P3].
- **DOC-002 resolved:** rewrote `docs/ARCHITECTURE.md` to match reality — new Module Map, sliced-store State section (13 persisted fields), Testing section, corrected XP model (per-type + bonuses + evidence gate, not flat 50), refreshed navigation, tokens point to `theme.ts`, updated decisions, ARCH-003 caveat noted.

### 2026-06-02 (sprint 32) — ARCH-002 COMPLETE: store-action tests + Zustand slices
- **Store-action test net (QA-001):** added `src/store/__tests__/appStore.test.ts` — 11 integration tests over the real store covering `completeOnboarding`, `logOutput` (XP-by-type + quality/takeaway bonuses, evidence gate, completion + prerequisite unlock, first-steps achievement, streak increment + same-day no-op), and `validateSkill`. **46 tests total, all green.** Writing them first also confirmed the prior extractions behave correctly.
- **Action slicing:** split the 36 store actions (verbatim bodies) into 4 cohesive Zustand slices — `src/store/slices/{core,roadmap,feed,profile}Slice.ts` — recombined in `appStore.ts` via `...createXSlice(set, get)`. Exported `PendingCelebration` for the slices' type imports.
- **Result:** `appStore.ts` is now state-init + composition + wiring only — **274 lines (4,378 → 274 since sprint 28, −94%)**. ARCH-002 ✅ resolved.
- **Method/safety:** worked off a backup; one slicer bug caught (matched the `AppState` interface decl instead of the impl, dropping state-init) → fixed and re-run. Verified at every layer: `tsc --noEmit` clean on store/slices/data/domain; **46 tests green against the sliced store**; **`vite build` succeeds**.
- **Files changed:** `src/store/__tests__/appStore.test.ts`, `src/store/slices/coreSlice.ts`, `roadmapSlice.ts`, `feedSlice.ts`, `profileSlice.ts` (new); `src/store/appStore.ts` (actions → slice composition, `export PendingCelebration`); `reports/skillforge-audit-report.md`.

### 2026-06-02 (sprint 31) — ARCH-002 cont.: store internals → modules + skillGraph tests
- **Extracted** the pure skill-graph/achievement helpers (`initUserSkills`, `unlockDependentSkills`, `checkAchievements`) → `src/domain/skillGraph.ts`, and the persistence layer (`saveToStorage`, `loadFromStorage`, `getPersistable`, auto-persist `subscribe`) → `src/store/persistence.ts` (exposes `loadFromStorage` + `attachPersistence(store)`). `appStore.ts` now imports/wires both.
- **Also:** removed the redundant explicit `saveToStorage()` in `toggleSavePost` (the `subscribe` already persists `savedPostIds`) — closes the logged low-severity nit. Exported `AppState` for the persistence module's type-only import.
- **Added** `src/domain/__tests__/skillGraph.test.ts` (7 tests for `checkAchievements`). Total **35 tests green**.
- **Impact:** `appStore.ts` 1,408 → **1,284 lines** (4,378 → 1,284 since sprint 28, **−71%**). Store file is now state init + actions + wiring; data, pure calculators, helpers, and persistence all live in dedicated modules.
- **Verification:** `tsc --noEmit` clean on `store/`/`data/`/`domain/`; 35 unit tests pass; **`vite build` succeeds — 561 modules transformed**.
- **Decision (risk):** stopped short of slicing the 36 cross-cutting actions into Zustand slices. They have no behavioral test coverage and the app can't be fully exercised in this environment, so a restructure there is unsafe without first writing store-action tests (extends QA-001). Recommended next step: integration tests for `logOutput` / `completeOnboarding` / `validateSkill`, then slice.
- **Files changed:** `src/domain/skillGraph.ts` `src/store/persistence.ts` `src/domain/__tests__/skillGraph.test.ts` (new), `src/store/appStore.ts` (extractions + `export interface AppState` + redundant-save removal), `reports/skillforge-audit-report.md`.

### 2026-06-02 (sprint 30) — ARCH-002 cont.: static catalog → `src/data/`
- **Extracted** `CAREER_PATHS`, `ALL_SKILLS`, `ALL_ACHIEVEMENTS` (catalog) and `MOCK_FEED` (seed/preview data) out of `appStore.ts` into `src/data/careerPaths.ts` · `skills.ts` · `achievements.ts` · `mockFeed.ts` (pure data, only type imports). Re-imported + re-exported from `appStore.ts` so all 8 screens importing them are unchanged.
- **Impact:** `appStore.ts` 4,378 → **1,408 lines** (−68% across sprints 29-30). The store file is now logic + wiring; data and pure calculators live in dedicated modules.
- **Verification:** `tsc --noEmit` clean on `store/`, `data/`, `domain/` (only the expected `vitest` install-pending + pre-existing `web-index` nit remain); 28 domain tests still green via esbuild+Node harness.
- **DOC-001 resolved:** Refreshed `CLAUDE.md` to match reality (9 screens / 10 components, `src/data` + `src/domain`, 19 paths, 8 achievements, Settings/Portfolio screens, per-screen ErrorBoundary, Vitest, real persistence field list).
- **Files changed:** `src/data/careerPaths.ts` `src/data/skills.ts` `src/data/achievements.ts` `src/data/mockFeed.ts` (new), `src/store/appStore.ts` (data → imports/re-exports), `CLAUDE.md`, `reports/skillforge-audit-report.md`.

### 2026-06-01 (sprint 29) — BAEF Phase 3 Architecture Review + test scaffolding
- **Architecture review:** Examined the full `src/` tree (21,919 LOC, 0 tests). Logged governed backlog items: **ARCH-002** (god store, 4,378 lines), **ARCH-003** (no persistence versioning/migration/validation; `as any` rehydration), **ARCH-004** (god components — 2,000+ line screens), **ARCH-005** (model-layer feature bloat), **ARCH-006** (XP logic leaking into views), **ARCH-007** (dual-build overhead for web-only pilot), **DOC-001** (CLAUDE.md drift). ARCH-C (zero tests) folded into existing **QA-001**.
- **Highest-leverage fix started (QA-001 + first slice of ARCH-002):** Extracted the pure progression calculators (decay, burnout, evidence tier, skill/career mastery, outcome XP) from the 4,378-line store into a dependency-free `src/domain/progression.ts`, re-exported from `appStore.ts` so all screen imports keep working. Added **Vitest** (config + `test`/`test:watch` scripts) and **28 unit tests** over those functions plus the XP→level math (`getLevelFromXP`/`getLevelTitle`/`getLevelBounds`). All 28 pass; `tsc --noEmit` clean on changed files (the only remaining errors are the expected `vitest` module-resolution until `npm install`, and a pre-existing `react-dom/client` types nit in `web-index.tsx`).
- **Verification note:** runner verified in-sandbox via esbuild + Node (vitest not installable on the FUSE mount); on a normal checkout, run `npm install` then `npm test`.
- **Files changed:** `src/domain/progression.ts` (new), `src/domain/__tests__/progression.test.ts` (new), `src/domain/__tests__/leveling.test.ts` (new), `vitest.config.ts` (new), `src/store/appStore.ts` (logic → re-exports), `package.json` (test scripts + vitest devDep), `reports/skillforge-audit-report.md`.

### 2026-06-01 (sprint 28) — BAEF adoption + Web/PWA Pilot Release Readiness
- **Framework:** Adopted the [Biboy Application Excellence Framework (BAEF)](../Biboy_BAEF/BAEF.md) as the permanent operating standard. Shared brand-wide location created at `Projects/Biboy_BAEF/` (BAEF.md, TEMPLATES.md, REGISTRY.md); MaglakbAI registered at Phase 8→9.
- **Release-readiness audit:** Reframed MaglakbAI as a **web/PWA pilot** (not native iOS). Ran the BAEF 12-dimension scorecard (overall 6.9/10) and produced a **Conditional Go** for closed web/PWA pilot.
- **P0 blockers — all resolved this cycle:** SEC-001 (PII to analytics without consent → opt-in gate + `scrubPII`), PRIV-001 (no consent UI/policy → `ConsentBanner` + `PrivacyPolicyModal` + Settings toggle), A11Y-010 (pinch-zoom disabled → viewport fixed, WCAG 1.4.4), SEC-002 (error boundary stack leak → friendly screen, stack dev-only), TRUST-001 (mock feed shown as live → relabeled PREVIEW + sample markers). Also added Data export/import + local-only notice in Settings.
- **User-facing docs:** Wrote `docs/USER_GUIDE.html` — self-contained, on-brand how-to guide with inline screen mockups (10 sections: install/PWA, consent, onboarding, Home, Log, Evolve, Community preview, Profile, data & privacy, FAQ).
- **Files changed:** `index.html`, `App.tsx`, `src/utils/analytics.ts`, `src/store/appStore.ts`, `src/screens/SettingsScreen.tsx`, `src/screens/FeedScreen.tsx`, `src/components/ConsentBanner.tsx` (new), `src/components/PrivacyPolicyModal.tsx` (new), `docs/USER_GUIDE.html` (new), `skillforge-audit-report.md`.
- **Verification:** Typecheck clean (pre-existing unrelated `web-index.tsx` react-dom warning only). Browser-verified end-to-end: consent banner on first launch, privacy modal, analytics persists, Settings Data & Privacy section, feed PREVIEW labeling, all core screens render with seeded state.
- **Open conditions before external invite:** PRIV-002 (real privacy contact), surface Export Backup in onboarding, keep community PREVIEW labeling. **Before public/iOS launch:** P1s — REL-001 (native build decision), QA-001 (automated tests), ARCH-001 (Supabase backend).

### 2026-05-30 (sprint 26) — Persistence fix, analytics cleanup, ARCHITECTURE.md rewrite
- **Improvements implemented (3 fixes):**
  - **Feed reaction/comment persistence on user posts**: `reactToPost` and `addComment` both updated the in-memory `communityFeed` but never synced changes back to `userFeedPosts` (the field that's persisted to localStorage). When a user reacted to or commented on their own post and reloaded the page, all those interactions were silently dropped — the post reappeared clean from `userFeedPosts`. Fix: both actions now compute `updatedUserFeedPosts` by mapping each entry in `state.userFeedPosts` to its updated counterpart in `updatedFeed` before calling `set()`. No new state fields needed. MOCK_FEED reactions remain ephemeral (acceptable for pilot — those are seed posts, not user-authored). File: `src/store/appStore.ts`.
  - **Duplicate JSDoc entry in analytics.ts**: `first_output_logged` appeared twice in the events comment block (once as a plain event line, once with the `time_to_first_output_minutes` detail). Removed the redundant plain entry. File: `src/utils/analytics.ts`.
  - **ARCHITECTURE.md complete rewrite**: The existing document described a planned architecture that was never built — Expo Router (actual: React Navigation 7), NativeWind v4/Tailwind (actual: StyleSheet.create()), React Native Reanimated 3 (actual: RN Animated API), Lottie (actual: CSS keyframe confetti), and three separate Zustand stores (actual: one store). A developer reading it would have a completely wrong mental model. Rewrote with accurate documentation: actual stack table, correct navigation structure, single-store architecture with persisted/ephemeral field breakdown, persistence subscriber pattern, XP/leveling constants, all animation patterns with real code snippets, design token reference, Vite chunk config, analytics event table with 19 events, 4 key architectural decisions with rationale. Phase 2 Supabase migration plan preserved as a "planned" section with env vars and step-by-step migration order. File: `docs/ARCHITECTURE.md`.
- **Files changed:** `src/store/appStore.ts`, `src/utils/analytics.ts`, `docs/ARCHITECTURE.md`, `skillforge-audit-report.md`
- **Build:** 0 new TS errors (only pre-existing `web-index.tsx` react-dom/client warning). Browser verified: feed renders, all 24 posts, 19 filter chips, leaderboard, streak-risk dot all present. No runtime errors.
- **Pilot readiness verdict:** **10/10** — all Tier 1–3 items resolved. Persistence gap on user-authored post interactions closed. Architecture documentation now trustworthy for onboarding new developers. Only remaining work is Phase 2 Supabase backend (requires external credentials).
- **Next sprint recommendation:** Phase 2 Supabase integration — provision project, set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, wire Magic Link auth to replace localStorage identity. Schema designed in `docs/DATABASE.md`. Alternatively: path-aware XP leaderboard (filter the weekly leaderboard to show only users on the same career path as the viewer).

### 2026-05-30 (sprint 25) — Community Coverage: 8 new seed posts completing all 19 paths
- **Improvement made:** **8 new MOCK_FEED seed posts — all 19 paths now have community presence.** 8 of 19 built-in paths had zero seed posts. New users on business-analyst, data-analyst, project-manager, solutions-architect, software-architect, mobile-developer, ui-ux-designer, and startup-founder paths saw only the coaching banner with no community activity — a cold-start problem that would make the app feel empty to roughly 40% of new users depending on path selection.
- **Posts added (fp-017–fp-024):**
  - `fp-017` — **Mei Lin** (business-analyst): requirements workshop output — 47 requirements, 12 contradictions surfaced. Comment thread with Priscilla Okwu.
  - `fp-018` — **Carlos Mendez** (data-analyst): SQL for Analysis milestone — VLOOKUP-to-CTE mindset shift story with LAG/LEAD/PERCENTILE_CONT.
  - `fp-019` — **Yuki Yamamoto** (project-manager): Agile sprint retro framework output — Start/Stop/Continue with committed action items.
  - `fp-020` — **Fatima Al-Hassan** (solutions-architect): event-driven microservices design for 2M daily transactions — Kafka + 6 services + eventual consistency. Comment thread with Kwame Boateng.
  - `fp-021` — **Lucas Benetti** (software-architect): design patterns milestone — found and named patterns in legacy codebase. "Naming things is power."
  - `fp-022` — **Nkechi Okafor** (mobile-developer): React Native milestone — iOS + Android in 5 months. Xcode provisioning/keystore is the hard part. Comment thread with Diego Rivera.
  - `fp-023` — **Anna Dubois** (ui-ux-designer): 40-component Figma design system output — dev handoff from 2h → 20min per feature.
  - `fp-024` — **Rajan Mehta** (startup-founder): MVP shipped in 6 weeks milestone — cut team collaboration feature after user interviews. 2-comment thread showing the learning.
- **Files changed:** `src/store/appStore.ts`, `skillforge-audit-report.md`
- **Build:** 549 modules, 0 TS errors. ✓ built in 2.89s. Chunks: vendor 542KB, navigation 163KB, App 231KB (was 223KB, +8KB from 8 new posts), index 1.45KB. Server live at http://192.168.123.37:8083 (HTTP 200 verified).
- **Pilot readiness verdict:** **10/10** — all 19 paths now have community presence from day 1. Feed filter chips auto-appear for all 19 paths. The cold-start community problem is fully resolved client-side. Only remaining work is Phase 2 Supabase backend (requires external credentials).
- **Next sprint recommendation:** Phase 2 Supabase integration — provision project, set `SUPABASE_URL`/`SUPABASE_ANON_KEY`, wire Magic Link auth to replace localStorage identity. Schema in `docs/DATABASE.md`. Alternatively: path-aware leaderboard (filter weekly XP leaderboard by selected path to show "Top learners on your path").

### 2026-05-29 (sprint 24) — Polish: Avatar bug, duplicate analytics, 6 new community seed posts
- **Improvements implemented (3 fixes):**
  - **Avatar emoji/color for all 19 paths**: `completeOnboarding` had a 3-case ternary for `avatarEmoji`/`avatarColor` that only handled `data-architect` and `ai-engineer`; all 17 other paths defaulted to fullstack's `🌐`/`#061A10`. Users selecting Cloud Engineer, ML Engineer, Cybersecurity, etc. saw the wrong avatar icon in their hero card, feed posts, and profile. Fix: replaced the ternary with `const pathMeta = CAREER_PATHS.find(p => p.id === pathId)` before user creation, then `avatarEmoji: pathMeta?.icon ?? '⚡'` and `avatarColor: pathMeta?.dimColor ?? '#0A0A0F'`. File: `src/store/appStore.ts`.
  - **Deduped `first_output_logged` analytics**: event was firing twice on the first onboarding output — once from `OnboardingScreen.handleFirstOutput` (sparse properties) and once from `logOutput` in the store (rich: includes `skill_id`, `skill_name`, `xp_gained`, `time_to_first_output_minutes`). Removed the duplicate from `OnboardingScreen`; store version is now the single authoritative source. File: `src/screens/OnboardingScreen.tsx`.
  - **6 new MOCK_FEED seed posts**: 14 of 19 paths had zero community posts; users on those paths saw only the coaching banner. Added `fp-011`–`fp-016`: Kenji Nakamura (ml-engineer, churn model, 94% precision), Sofia Petrov (frontend-engineer, React SPA milestone), Tariq Hassan (devops, CI/CD 22-min pipeline), Isabelle Müller (cloud-engineer, Terraform 11-env IaC), Jordan Lee (cybersecurity, $2,400 bug bounty), Priscilla Okwu (product-manager, 14-interview discovery sprint). Feed filter chips now auto-appear for 11 of 19 paths (up from 5). File: `src/store/appStore.ts`.
- **Files changed:** `src/store/appStore.ts`, `src/screens/OnboardingScreen.tsx`, `skillforge-audit-report.md`
- **Build:** 0 new TS errors (pre-existing `web-index.tsx` react-dom/client warning unchanged). Browser verified: "All 16" feed count confirmed; ML Engineer, Frontend En, Cloud Engin, DevOps Engi, Cybersecuri, Product Man filter chips all present in snapshot.
- **Pilot readiness verdict:** **9.8/10** — analytics cleaner, avatar correct for all 19 paths, community feels alive for 11 of 19 paths from day 1. No remaining client-side gaps.
- **Next sprint recommendation:** Phase 2 Supabase integration (requires credentials). Alternatively client-side: add path-aware leaderboard filtering, or add seed posts for the remaining 8 paths (project-manager, business-analyst, data-analyst, solutions-architect, software-architect, mobile-developer, ui-ux-designer, startup-founder).

### 2026-05-29 (sprint 23) — Feed Filter: UX-016 — Dynamic path filter chips for all 17 paths
- **Improvement made:** **UX-016 — Dynamic feed filter chips** — replaced hardcoded 3-path filter list with dynamically derived chips for all built-in paths that have posts, plus 2 new MOCK_FEED posts to populate Data Engineer and Backend Engineer filters.
- **Problem:** `FeedScreen.tsx` hardcoded `PATH_FILTERS` to only 3 paths (data-architect, ai-engineer, fullstack). App now has 17 built-in career paths. Users on the other 14 paths (Data Engineer, ML Engineer, Backend Engineer, etc.) could log outputs that generated feed posts, but those posts had no filter chip — they appeared only under "All". When a Data Engineer user wanted to browse posts from their path community, no filter existed. Every new path we add requires manual maintenance of a hardcoded constant.
- **Fix:** Removed static `PATH_FILTERS` constant entirely. Added `CAREER_PATHS` import from the store. At render time, `builtInPathFilters` is computed by: (1) collecting all path IDs present in `communityFeed` into a `Set`; (2) filtering `CAREER_PATHS` to those with ≥1 post; (3) mapping to chip config using `PathColors[cp.id]` for colors and `cp.icon` for the emoji. Custom path logic unchanged. The "All" chip is always first. Two new MOCK_FEED entries added: `fp-009` (Ananya Rao, data-engineer, Spark 300x ETL speedup) and `fp-010` (Kwame Boateng, backend-engineer, zero-downtime JWT auth migration).
- **Files changed:** `src/screens/FeedScreen.tsx`, `src/store/appStore.ts`, `skillforge-audit-report.md`
- **Build:** 549 modules, 0 TS errors. ✓ built in 2.26s. Chunks: vendor 542KB, navigation 163KB, App 223KB, index 1.45KB. Server live at http://192.168.123.37:8083 (HTTP 200 verified).
- **Pilot readiness verdict:** **9.7/10** — feed community now correctly represents all 17 paths; filter infrastructure scales automatically as paths are added. No remaining client-side UX gaps found.
- **Next sprint recommendation:** Phase 2 Supabase integration. Alternatively if staying client-side: add a "recently active paths" leaderboard chip ranking or make the weekly XP leaderboard path-aware (filter by path).

### 2026-05-29 (sprint 22) — Bug Fix: BUG-011 — Custom path Dashboard action card blank
- **Improvement made:** **BUG-011 — Custom path Dashboard action card** — users on custom career paths saw a blank Dashboard action strip with no NEXT MILESTONE card and no Log Work CTA. The core addiction loop was silently broken for this user segment.
- **Problem:** `DashboardScreen` computed `nextSkill` by mapping each `focusPath.skillIds` through `ALL_SKILLS.find(s => s.id === sid)`. `ALL_SKILLS` only contains built-in skills. Custom path skill IDs (`custom_*`, `personal_*`) always returned `undefined`. The render condition `nextSkill?.skill ? (...)` silently evaluated to nothing. Custom path users who built roadmaps using the "+ Roadmap" feature saw an empty Home screen with ring + stats but zero call-to-action — a complete UX dead-end in the core loop.
- **Fix:** Added `customSkillMap` — a `Map<string, { id, name, icon, requiredOutputs, xpReward }>` built from `customPaths.flatMap(cp => cp.skills.map(...))`. Modified the `nextSkill` computation to: (1) try `ALL_SKILLS.find()` first, (2) fall back to `customSkillMap.get(sid)` for custom skills, (3) add `skill &&` guard to `.find()` so undefined skills are excluded. Custom skills use `requiredOutputs: 1` and `xpReward: 50` (matching the `LogOutputScreen` custom option logic). The NEXT MILESTONE card and accessibilityLabel now correctly display custom skill names.
- **Files changed:** `src/screens/DashboardScreen.tsx`, `skillforge-audit-report.md`
- **Build:** 549 modules, 0 TS errors. ✓ built in 3.01s. Chunks: vendor 542KB, navigation 163KB, App 223KB, index 2.4KB. Server live at http://192.168.123.37:8083 (HTTP 200 verified).
- **Pilot readiness verdict:** **9.6/10** — custom path users now have a fully functional Dashboard action loop. No remaining client-side bugs found. Only open work is Phase 2 backend infrastructure (Supabase auth/DB).
- **Next sprint recommendation:** Phase 2 Supabase integration — provision a Supabase project, set `SUPABASE_URL` / `SUPABASE_ANON_KEY`, wire up Magic Link auth to replace `localStorage` identity. Schema already designed in `docs/DATABASE.md`.

### 2026-05-29 (sprint 20) — Accessibility Sprint: A11Y-001 — all interactive elements labeled
- **Improvement made:** **A11Y-001 — Comprehensive accessibility labels** — the last remaining Tier 2 pre-public-launch item. Every `TouchableOpacity` and `TextInput` across the entire app now has correct `accessibilityLabel`, `accessibilityRole="button"`, and `accessibilityState` where relevant (`disabled`, `selected`).
- **Problem:** All interactive elements (reaction chips, skill nodes, tab icons, CTAs, TextInputs) had zero accessibility attributes. Screen readers announced only "button" with no context, making the app unusable for visually impaired users and non-compliant with App Store accessibility review requirements.
- **Fix scope — 7 files:**
  - `src/components/CareerNode.tsx` — skill node card: context-aware label ("Python Fundamentals — 2 of 5 outputs, +200 XP on complete"), `accessibilityState={{ disabled: isLocked }}`
  - `src/components/FeedCard.tsx` — reaction chips ("React with ⚡, 3 total" / "Remove ⚡ reaction, 3 total"), quick-react chips ("Add 🔥 reaction"), more-comments button, comment prompt, send button, comment TextInput
  - `src/screens/DashboardScreen.tsx` — streak freeze button ("Use streak freeze, 2 remaining"), "Log My First Output" CTA, NEXT MILESTONE card (with skill name and progress), Today's Challenge card (dynamic label from `challenge.tag` + `challenge.title`), path-complete primary and secondary CTAs
  - `src/screens/LogOutputScreen.tsx` — output type chips (label + `accessibilityState={{ selected }}`), skill option cards (with progress context + "final push!" flag), "add to roadmap" option, title/description/link TextInputs, submit button (`accessibilityState={{ disabled }}`)
  - `src/navigation/AppNavigator.tsx` — all 5 tabs get `tabBarAccessibilityLabel`; Log tab gets dynamic "Log output — streak at risk!" label when `isStreakAtRisk`
  - `src/screens/EvolveScreen.tsx` — "+ Roadmap" header button, path switcher tabs (with `accessibilityState={{ selected }}`), add-path "+" tab button, empty-state "Add milestones" CTA
  - `src/screens/ProfileScreen.tsx` — share progress button, edit-name tap area, edit-bio tap area, bio TextInput, name TextInput, unlocked/locked achievement tiles (with description in label), output type filter chips (with `accessibilityState={{ selected }}`)
- **Files changed:** `src/components/CareerNode.tsx`, `src/components/FeedCard.tsx`, `src/screens/DashboardScreen.tsx`, `src/screens/LogOutputScreen.tsx`, `src/navigation/AppNavigator.tsx`, `src/screens/EvolveScreen.tsx`, `src/screens/ProfileScreen.tsx`, `skillforge-audit-report.md`
- **Build:** 549 modules, 0 TS errors. ✓ built in 2.48s. Server live at http://192.168.123.37:8083 (HTTP 200 verified).
- **Pilot readiness verdict:** **9/10** — all Tier 2 pre-public-launch items now complete. Remaining open: TD-001 (saveToStorage middleware consolidation, Tier 3), OPS-005 (bundle splitting, Tier 3), Phase 2 backend infrastructure. None block pilot or public launch accessibility review.
- **Next sprint recommendation:** **TD-001** — replace 10+ manual `saveToStorage` call sites with a single Zustand `subscribeWithSelector` middleware subscriber. Reduces the risk of data loss when adding new persisted fields and is the cleanest remaining tech debt item.

### 2026-05-29 (sprint 21) — Tech Debt Sprint: TD-001, OPS-005, sprint-20 TS regression fix
- **Improvements implemented (3 fixes):**
  - **TD-001 — Zustand persistence subscriber**: Removed all 11 manual `saveToStorage({...})` call sites from action handlers (`completeOnboarding`, `logOutput`, `addCustomPath`, `switchPath`, `setPrioritizedPath`, `useStreakFreeze`, `addRoadmapItem`, `markMilestoneCelebrated`, `updateAvatar`, `updateBio`, `updateName`). Added `getPersistable(state)` selector and a `useAppStore.subscribe()` call at module level. The subscriber uses per-field reference equality (`===`) to short-circuit — only calls `saveToStorage` when at least one of the 9 persisted fields has changed. In addition: fixed a latent data-loss bug — `markMilestoneCelebrated` was missing `userFeedPosts` in its payload (would have caused user feed posts to silently disappear after celebrating a path milestone). Simplified `updateAvatar/updateBio/updateName` to inline the user update directly in `set({})`. File: `src/store/appStore.ts`.
  - **OPS-005 — Vite `manualChunks` splitting**: Added `build.rollupOptions.output.manualChunks` to `vite.config.ts`. Result: vendor chunk (react + react-dom + react-native-web) → 542KB; navigation chunk (@react-navigation/*) → 163KB; App code → 192KB (was 565KB — **66% reduction in the app code chunk**). Returning users only re-download the 192KB App chunk on each deploy; vendor/navigation chunks are served from browser cache. File: `vite.config.ts`.
  - **Sprint 20 TS regression — `a.name` → `a.title` in ProfileScreen**: Sprint 20's accessibility pass used `${a.name}` in two `accessibilityLabel` strings on achievement tiles, but the `Achievement` type has `title` not `name`. This caused 2 silent TypeScript errors. Fixed: `a.name` → `a.title` in both `accessibilityLabel` props (unlocked and locked achievement tiles). File: `src/screens/ProfileScreen.tsx`.
- **Files changed:** `src/store/appStore.ts`, `vite.config.ts`, `src/screens/ProfileScreen.tsx`, `skillforge-audit-report.md`
- **Build:** 549 modules, 0 TS errors (only pre-existing `web-index.tsx` warning unchanged). Build: 1.35s. Chunks: vendor 542KB, navigation 163KB, App 192KB, index 2.4KB. Dev server verified: Dashboard renders, streak badge shows, no runtime errors.
- **Pilot readiness verdict:** **9.5/10** — all Tier 1, 2, and 3 items resolved. Only remaining items are Phase 2 backend infrastructure (Supabase auth/DB) which require external credentials.
- **Next sprint recommendation:** No further client-side improvements are needed for pilot launch. The next meaningful sprint is **Supabase integration** (Phase 2 backend) — requires provisioning a Supabase project and setting `SUPABASE_URL` / `SUPABASE_ANON_KEY` environment variables. Schema is already designed in `docs/DATABASE.md`.

### 2026-05-29 (sprint 19) — Quality Sprint: UX-015, A11Y-005, PERF-002, OPS-002
- **Scope:** All remaining Tier 2 (Pre-Public-Launch Quality) backlog items plus the Tier 3 PERF-002 item.
- **Improvements implemented (4 fixes):**
  - **UX-015 — Post-onboarding welcome card**: Added `showWelcomeCard: boolean` + `dismissWelcomeCard()` to Zustand store. Set `true` in `completeOnboarding`. `DashboardScreen` reads the flag, triggers a `Modal` overlay with spring-animated card entrance, ⚡ logo, welcome copy, and a 30-step JS interval XP counter animating up to the user's first-output XP. Auto-dismisses after 3.2s. Ephemeral (not persisted) — fires once per new-user session. Files: `src/store/appStore.ts`, `src/screens/DashboardScreen.tsx`.
  - **A11Y-005 — textMuted contrast**: Changed `Colors.textMuted` from `#44446A` to `#7070A0` in `theme.ts`. Contrast ratio ~4.6:1 on card backgrounds — meets WCAG AA 4.5:1 for normal text. Affects all secondary labels, timestamps, meta text, placeholder text across every screen. File: `src/utils/theme.ts`.
  - **PERF-002 — useMemo on buildInsights/buildWeekGrid**: Both functions now memoized at component level with `[outputs]` dependency. JSX IIFE wrappers updated to use memoized values directly. Added `useMemo` to imports. File: `src/screens/DashboardScreen.tsx`.
  - **OPS-002 — Per-screen error boundaries**: Added `ScreenErrorBoundary` class (shows screen name, error message, retry button) and `withScreenBoundary<P>()` HOC. All 5 tab screens wrapped as `GuardedDashboard/Feed/Log/Evolve/Profile`. A crash in one tab no longer affects the others. Added `TouchableOpacity`, `StyleSheet`, and `Colors/FontSize/Spacing` imports. File: `src/navigation/AppNavigator.tsx`.
- **Files changed:** `src/store/appStore.ts`, `src/screens/DashboardScreen.tsx`, `src/navigation/AppNavigator.tsx`, `src/utils/theme.ts`, `skillforge-audit-report.md`
- **Build:** 0 new TS errors (pre-existing `web-index.tsx` react-dom/client warning unchanged). Dev server HMR verified. Dashboard renders correctly; no crash loops. Pre-existing `background` CSS shorthand warnings (~420) unchanged.
- **Pilot readiness verdict:** **8.5/10** — all Tier 2 items resolved except A11Y-001 (accessibilityLabels). Remaining open items: A11Y-001 (pre-public launch), TD-001 (tech debt), OPS-005 (bundle splitting), Phase 2 backend infrastructure. None block the closed pilot.
- **Next sprint recommendation:** **A11Y-001** — add `accessibilityLabel` and `accessibilityRole="button"` to all interactive elements. This is the last remaining Tier 2 item and required for App Store accessibility review at public launch.

### 2026-05-29 (sprint 18) — Governance Audit + Three-Fix Build
- **Audit scope:** Comprehensive production-readiness governance review across 12 dimensions: state management, skill progression logic, UX copy, accessibility, performance, error handling, analytics, security, architecture, App Store readiness, observability, long-term maintainability. All source files read: `appStore.ts` (1312 lines), `AppNavigator.tsx`, `DashboardScreen.tsx`, `LogOutputScreen.tsx`, `FeedScreen.tsx`, `EvolveScreen.tsx`, `ProfileScreen.tsx`, `MilestoneScreen.tsx`, `FeedCard.tsx`, `theme.ts`, `types/index.ts`, `analytics.ts`.
- **Issues identified:** 10 total — 1 critical (BUG-010), 1 high (BUG-002), 4 medium (UX-001, A11Y-001, A11Y-005, UX-015), 2 medium/low (PERF-002, OPS-002), 2 low (TD-001, OPS-005). All documented above with severity, impact, fix recommendation, and acceptance criteria.
- **Improvements implemented (3 fixes):**
  - **BUG-010 (CRITICAL) — communityFeed persistence**: Added `userFeedPosts: FeedPost[]` to `AppState` interface. Store init reconstructs `communityFeed` from `[...savedUserFeedPosts, ...MOCK_FEED]`. `logOutput` tracks `updatedUserFeedPosts` and includes in `saveToStorage`. `resetApp` clears the field. All 9 remaining `saveToStorage` call sites updated. 16 `userFeedPosts` references placed correctly. `src/store/appStore.ts`.
  - **BUG-002 (HIGH) — Wrong pathId in unlockDependentSkills**: Guard changed from `CAREER_PATHS.some(p => p.id === state.user.careerPathId)` to `CAREER_PATHS.some(p => p.id === skill.pathId)`. Call changed from `state.user.careerPathId as CareerPathId` to `skill.pathId as CareerPathId`. Ensures prioritized-path skill completions correctly unlock their dependents. `src/store/appStore.ts`.
  - **UX-001 (MEDIUM) — Wrong direction text**: Changed "type a title above" → "type a title below" in empty skill list card. `src/screens/LogOutputScreen.tsx`.
- **Files changed:** `src/store/appStore.ts`, `src/screens/LogOutputScreen.tsx`, `skillforge-audit-report.md`
- **Build:** 0 TS errors. Clean build via FUSE workaround (`/tmp/sf_s18` → `/tmp/sf_dist_s18`). Bundles: `App-BN8Rudk8.js` (565KB), `index-DxXzNGaH.js` (329KB). Server live at http://192.168.123.37:8083 (HTTP 200 verified).
- **Production-readiness verdict:** 8/10 overall — ship-ready for closed pilot. All blocking state bugs resolved. Remaining items (A11Y, PERF, OPS) are quality-of-life improvements for public launch.
- **Next sprint recommendation:** **UX-015 — Post-onboarding welcome moment** — highest D1 activation impact of remaining items. After first output is logged in onboarding step 4, show a brief animated "Welcome to MaglakbAI 🚀 — you earned 50 XP!" card before navigating to Dashboard.

### 2026-05-29 (sprint 17)
- Improvement made: **Skill progress bars on LogOutputScreen** — added inline progress indicators on every built-in skill option in the Log Output form.
- **Problem**: The skill picker in LogOutputScreen showed skill name only — no progress, no urgency. A user with `4/5` outputs done on REST APIs had no visible signal they were one output away from completing the skill (and earning its XP bonus). The "🎯 Final push!" hint in `buildTodayChallenge` (Dashboard) and the XP preview at the bottom of the form were doing this job at the extremes, but the actual skill selection row — the most-seen UI element in the core loop — was completely silent about progress state.
- **Fix**: Updated the `allOptions.map()` render block in `LogOutputScreen`. Each built-in skill option now renders: (1) a 3px progress bar (`rgba(255,255,255,0.07)` background, filled proportionally with path-responsive color), (2) an `N/M outputs · +XP on complete` meta line in gold for the XP hint, (3) a `🎯 Final push!` gold pill badge when `outputCount + 1 >= requiredOutputs` (exactly one away), and (4) a gold border + `goldDim` background on the skill card itself in the final-push state. Selected state overrides: bar turns `primaryLight`, label tints purple. Custom path skills retain their existing `pathLabel` meta text without a progress bar (no fixed `requiredOutputs`). Added 11 new StyleSheet entries: `skillOptionFinalPush`, `skillOptionNameRow`, `finalPushBadge`, `finalPushBadgeText`, `skillProgressArea`, `skillProgressBg`, `skillProgressFill`, `skillProgressFillSelected`, `skillProgressFillFinalPush`, `skillProgressLabel`, `skillProgressLabelSelected`, `skillXpHint`.
- Files changed: `src/screens/LogOutputScreen.tsx`, `skillforge-audit-report.md`
- Build: 549 modules, 0 TS errors. ✓ built in 2.36s. Server live at http://192.168.123.37:8083 (HTTP 200 verified).
- Notes: No open bugs found. All 16 previous sprints verified stable. Next highest-value item: **Onboarding post-completion welcome moment** — after the first output is logged in step 4 of onboarding, the user silently lands on the Dashboard with no celebration for their very first XP earn. A brief animated "Welcome to MaglakbAI — you earned 75 XP!" card before the main tabs appear would meaningfully improve D1 activation.

### 2026-05-28 (sprint 16)
- Improvement made: **Comment feature on Feed posts** — users can now add comments to any community post.
- **Problem**: The FeedCard component only showed existing comments as read-only text. There was no way for users to add a comment, even though the `Comment` type and `comments[]` array already existed on `FeedPost`. This left a visible social engagement gap — the community page had reactions but no conversation.
- **Fix**: Added `addComment(postId, text)` action to the Zustand store. The action creates a `Comment` object attributed to the current user, appends it to the matching post in `communityFeed`, and fires a `comment_posted` analytics event. In `FeedCard`, added `onComment` optional prop, local `showCommentInput` state, and a conditional render: a "💬 Comment" prompt that expands to a `TextInput` + send button on tap. `FeedScreen` reads `addComment` from the store and passes it down as `onComment`. The prop-optional design keeps `FeedCard` backwards compatible for any future read-only uses.
- Files changed: `src/store/appStore.ts`, `src/components/FeedCard.tsx`, `src/screens/FeedScreen.tsx`, `skillforge-audit-report.md`
- Build: 0 TS errors. Browser verified: comment prompt visible, input expands on tap, send button styled correctly.
- Notes: Comments are currently ephemeral in-memory (reset on reload) — they will persist once Supabase is integrated. Next highest-value item: **Supabase integration** (the only remaining pilot blocker), or **Sprint 17: Onboarding XP preview** to improve the first-output activation rate.

### 2026-05-28 (sprint 15)
- Improvement made: **Streak-risk notification badge on Log tab** — pulsing red dot on the + tab when streak is at risk.
- **Problem**: The "Today's Challenge" card on the Home screen gave users a daily directive, but only when they were already on the Home tab. A user who opened the app directly on the Feed or Evolve tab had no tab-level signal that their streak was at risk. The tab badge is the standard mobile pattern for ambient notifications — Duolingo uses it, Strava uses it, and it's the first thing users glance at when opening an app.
- **Fix**: In `AppNavigator.tsx`, `MainTabs()` now reads `user.lastActiveDate` from Zustand and computes `isStreakAtRisk = !hasLoggedToday && user.streak > 0`. The `LogTabIcon` component accepts `isStreakAtRisk` as a prop. When true, an `Animated.View` (11px red dot, `#EF4444`, `1.5px #0A0A0F` border) renders at `top:1, right:1` with a `Animated.loop(scale 1→1.5→0.85)` pulse. The animation cleans up via `useEffect` return to avoid memory leaks when the component unmounts.
- Files changed: `src/navigation/AppNavigator.tsx`, `skillforge-audit-report.md`
- Build: 0 TS errors. Browser verified: red dot appears correctly at top-right of + button when streak=5, lastActiveDate=yesterday; no dot when streak=0.

### 2026-05-28 (sprint 14)
- Improvement made: **"Today's Challenge" card on Dashboard** — personalized daily CTA card with 5 context-aware states.
- **Problem**: The Dashboard gave users passive status information (path progress, XP, streak count) but no personalized daily directive. A user who opened the app at 8am had to mentally figure out what to do next — "I see I'm at 2/5 on REST APIs, my streak is 4 days…I guess I should log something?" The core addiction loop of habit-formation apps depends on a clear, time-sensitive call to action surfaced immediately on the home screen.
- **Fix**: Added `buildTodayChallenge()` pure helper that evaluates 5 prioritized scenarios in order: (1) streak at risk (urgent gold card), (2) exactly 1 output from completing a skill (green "final push" card), (3) 2–3 outputs away + hasn't logged today (purple "almost there"), (4) any unlogged skill + no logs today (default "daily start"), (5) already logged today but more to do (softer "keep going" card). Each variant has distinct `borderColor`, `boxShadow` glow, tag label color, and CTA button color to visually reinforce urgency. The card always routes to the Log screen. Positioned after the NEXT MILESTONE card so the user sees skill context first, then the specific daily action.
- Files changed: `src/screens/DashboardScreen.tsx`, `skillforge-audit-report.md`
- Build: 549 modules, 0 TS errors. ✓ built in 2.72s. Server live at http://192.168.123.37:8083 (HTTP 200 verified).
- Notes: No open bugs. All previously fixed items verified stable. Next highest-value client-side item: **Notification dot / badge on Log tab** when user hasn't logged today and streak is at risk — this reinforces the Today's Challenge nudge with a visual tab-level indicator.

### 2026-05-28 (sprint 13)
- Improvements made: **Streak Bonus XP Visibility** + **Per-Skill Streak Badges on Evolve Map**.
- **Problem 1**: The 7/14/30-day streak milestone bonuses (25/50/100 XP) were silently added to XP with no user-visible feedback. The `streakMilestoneBonus` was computed in the store but not returned to the UI layer. Users who earned the bonus had no idea it happened — a completely missed dopamine moment.
- **Fix 1**: Added `streakBonusXP?: number` and `newStreak?: number` to `LogOutputResult` interface. Returned both from `logOutput` action. In `LogOutputScreen.handleSubmit`, when `result.streakBonusXP > 0`, a dedicated `warning`-variant toast fires 1.4 s after the main output toast: `"🔥 7-Day Streak Bonus!"` with the XP amount highlighted. The delay ensures the main output feedback registers first before the bonus fires.
- **Problem 2**: The Evolve milestone map showed skill nodes with status and progress but no per-skill habit data. A user grinding the same skill for 5 consecutive days got no visible reward for that focused streak on the map — only the global streak counter in the header.
- **Fix 2**: Added `getSkillStreak(skillId, outputs)` pure helper at module level in EvolveScreen. Counts consecutive calendar days ending today that have at least one output for that skill (up to 60 days lookback). Passed as `skillStreak` prop to `CareerNode`. In `CareerNode`, a gold pill badge "🔥 N-day streak" renders between the status label and XP hint when `skillStreak >= 2` and status is `in_progress` or `completed`. Added `streakBadge` and `streakBadgeText` styles using semi-transparent gold color consistent with the existing `xpHint` gold palette.
- Files changed: `src/types/index.ts`, `src/store/appStore.ts`, `src/screens/LogOutputScreen.tsx`, `src/screens/EvolveScreen.tsx`, `src/components/CareerNode.tsx`, `skillforge-audit-report.md`
- Build: 549 modules, 0 TS errors. ✓ built in 1.43s. Browser verified: REST APIs node showed "🔥 3-day streak" pill correctly; zero new runtime errors.
- Notes: No open bugs. Next highest-value client-side item: **"Today's Challenge" card** — a daily action card on the Dashboard suggesting the single most impactful thing to do today (e.g., "Log one more output for REST APIs & Integration — you're 1 away from completing it"). Rotates based on user's in-progress skill and time since last log.

### 2026-05-28 (sprint 12)
- Improvement made: **Pace-to-completion estimate on NEXT MILESTONE card** — green pace line added to the most-viewed actionable card on the Home screen.
- **Problem**: The NEXT MILESTONE card showed "N/M outputs · +XPR XP on complete" but gave users no sense of how far away they were in time. A user with 2/5 outputs done and a strong logging habit had no idea if they were 3 days or 3 weeks from finishing. This is the kind of progress feedback that makes habit-formation apps feel personal — Strava shows "at your current pace, you'll hit 100km this month."
- **Fix**: Added `paceText` computation before the render block. Calculates `weeklyOutputRate = recentOutputCount / 2` (outputs in last 14 days ÷ 2 weeks). Then: remaining outputs ÷ weekly rate × 7 = estimated days. Displays "⚡ ~N days at your current pace" (≤7 days), "⚡ You could finish today!" (≤1 day), or "~N weeks at your current pace" (>7 days). Hidden when rate < 0.5 (inactive user) to avoid showing "~200 days." Shown in `Colors.success` green for positive framing. Style `nextActionPace` added to StyleSheet.
- Files changed: `src/screens/DashboardScreen.tsx`, `skillforge-audit-report.md`
- Build: 549 modules, 0 TS errors. ✓ built in 2.14s. Server live at http://192.168.123.37:8083 (HTTP 200 verified).
- Notes: No open bugs found. All screens clean. Next highest-value item: **"Skill streaks" on the Evolve map** — show a "🔥 N-day streak on this skill" indicator on skill nodes that have recent consecutive outputs, rewarding focused daily practice on a single skill.

### 2026-05-28 (sprint 11)
- Improvement made: **Personal Growth Insights Card on Dashboard** — "Strava-like" analytics panel surfacing weekly velocity, XP trend, 2-week consistency, and peak logging day.
- **Problem**: After 10 sprints of feature work, the Dashboard lacked any personal analytics depth. Users could see their current XP and streak but had no visibility into their own behavioural patterns (am I logging more than last week? what's my consistency rate?). This is the exact kind of data-driven feedback loop that drives daily app opens on habit-forming products like Strava and Duolingo.
- **Fix**: Added `buildInsights()` pure helper function that computes: this-week vs last-week output velocity (with delta and trend direction), XP earned this week vs last week, active days out of the last 14 (consistency %), and best-performing day of week (all-time). Card renders as a 2×2 grid with cell labels, large values, trend arrows, and meta/context text. Shows only when `hasStarted && outputs.length >= 5` to avoid surfacing meaningless data for new users. No new store selectors needed — computed from the existing `outputs` array.
- Files changed: `src/screens/DashboardScreen.tsx`, `skillforge-audit-report.md`
- Build: Vite HMR live, 0 TS errors. Card verified in browser: THIS WEEK 5↑2, XP 450↑, CONSISTENCY 8/14, PEAK DAY Sundays — all correct.
- Notes: Supabase integration remains the only true pilot blocker. Next highest-value client-side item: **Pace-to-completion estimate** — a "At your current pace, you'll complete [skill] in ~N days" line on the NEXT MILESTONE card, computed from average outputs/week.

### 2026-05-28 (sprint 10)
- Improvement made: **Skill Detail Bottom Sheet on EvolveScreen** — closes the UX gap where tapping a skill node immediately jumped to Log Output with no context.
- **Problem**: `handleNodePress` on EvolveScreen called `setSelectedSkill(skillId)` then `navigation.navigate('Log')` immediately. Users exploring their milestone map had no way to learn what a skill entails (description, progress requirements, XP reward, prerequisites) before being thrown into the log form. This created accidental navigations and missed educational moments.
- **Fix**: `handleNodePress` now resolves the full `Skill` + `UserSkill` objects and sets them in a new `detailSkill` state. A `Modal` (pageSheet) renders the detail view: large icon with path-color glow, rarity badge, status badge, description, animated progress bar, XP reward card, prerequisites list, and a deliberate "Log Work on This Skill ⚡" CTA. The CTA then does `setSelectedSkill + navigate('Log')` — same behaviour as before, just more intentional. Custom path skills handled via fallback Skill object. Added `RarityColors` and `{ Skill, UserSkill }` to imports.
- Files changed: `src/screens/EvolveScreen.tsx`, `skillforge-audit-report.md`
- Build: 549 modules, 0 TS errors. ✓ built in 2.94s. Server live at http://192.168.123.37:8083 (HTTP 200 verified).
- Notes: No open bugs found. All screens are clean. Backlog is primarily Phase 2 infrastructure (Supabase, OpenAI). Next highest-value item is an Insights card on Dashboard.

### 2026-05-27 (sprint 9)
- Improvements made: **Achievement detail modal** + **Progress share card**.
- **Achievement detail modal**: Added `getAchievementProgress()` helper (outside component) mapping all 8 achievement IDs to their progress metrics (outputs, skills completed, streak, XP). All achievements wrapped in `TouchableOpacity` in the grid. New bottom-sheet `Modal` renders icon, rarity badge, title, description, progress bar (locked only), XP reward row, and unlock status. Verified: tapping "First Steps" (unlocked) opens modal with correct icon, "COMMON" rarity, description, "+25 XP" reward, and "✓ Unlocked" tag.
- **Progress share card**: `shareProgress()` function defined post-null-guard using `navigator.share()` with `navigator.clipboard` fallback + toast. "📤 Share Progress" button added to identity section with `primaryDim` background and `primaryLight` text. Verified visible in Profile screenshot.
- Added imports: `RarityColors` from theme, `useToast` from Toast, `Achievement/Output/UserSkill/User` from types.
- Files changed: `src/screens/ProfileScreen.tsx`, `skillforge-audit-report.md`
- Build: 0 new TS errors (only pre-existing react-dom/client warning). Server live at http://localhost:8082. Both features verified live in browser preview.

### 2026-05-27 (sprint 8)
- Improvements made: **Output timestamps + type filter in Profile gallery** + **7-day activity heatmap on Dashboard**.
- **Output timestamps**: `timeAgo(output.createdAt)` added to the metadata line of every output card in ProfileScreen. Section header updated to show "YOUR OUTPUTS · N total". No new data structures needed — `createdAt` field already existed on the `Output` type and the `timeAgo()` utility was already in `theme.ts`.
- **Output type filter chips**: Horizontal `ScrollView` of filter chips renders above the output list when the user has outputs spanning 2+ types. Chips built from `Array.from(new Set(outputs.map(o => o.type)))`. Active chip highlights in `primaryDim/primaryLight`; tapping an already-active chip deselects (shows All). When a filter matches 0 outputs an inline empty-state card is shown.
- **7-day activity heatmap**: `buildWeekGrid()` helper (defined at top of DashboardScreen.tsx, outside component) maps the last 7 calendar days to `{ label, date, count, isToday }` objects. Renders as 7 rounded squares with path-color fill on days with ≥1 output, dimmed empty squares otherwise. Today's square gets a light border ring. Count badge appears inside the dot when `count > 1`. Correctly hidden for new users (`!hasStarted`).
- Files changed: `src/screens/ProfileScreen.tsx`, `src/screens/DashboardScreen.tsx`, `skillforge-audit-report.md`
- Build: Vite dev server — 0 new TS/runtime errors. All three features verified live in browser preview.

### 2026-05-27 (sprint 7)
- Improvement made: **Custom path auto-switch on creation** — fixed UX dead-end in the flagship custom roadmap feature.
- **Problem**: `handleCreate` in `AddRoadmapModal` (EvolveScreen) called `addCustomPath(newPath)` then generated `const newId = \`custom_${Date.now()}\`` but never called `switchPath(newId)`. The user would create a beautifully named roadmap, tap "Create Roadmap ⚡", and be silently returned to their previous path — their new roadmap was invisible unless they manually spotted and clicked the new tab. This is a UX dead-end on a key differentiating feature.
- **Fix**: Changed `addCustomPath` return type from `void` to `string` (returns the generated `newPathId`). In `handleCreate`, captured the return value as `const newPathId = addCustomPath(newPath)` and immediately called `switchPath(newPathId)` before `handleClose()`. Bundle-verified: minified form `const A=r(T);n(A),E()` confirms the call chain.
- Files changed: `src/store/appStore.ts`, `src/screens/EvolveScreen.tsx`
- Build: 549 modules, 0 TS errors. ✓ built in 2.11s. Server live at http://192.168.123.37:8083. Bundle analysis confirmed fix present.
- Notes: Two new backlog items surfaced during audit: output timestamps in Profile gallery and outputs filter/search. No other bugs found.

### 2026-05-27 (sprint 6)
- Improvement made: **Level-Up Overlay Animation** + **analytics improvements** (first_output_logged, log_screen_abandoned).
- **Problem**: When a user levels up via a regular (non-skill-completing) output, the existing flow only showed a generic "Output logged! Keep building." toast with no visual distinction between a routine log and a major level-up event. This was the last missing Phase 2 dopamine mechanic from the scheduled task spec.
- **Fix**: Created `src/components/LevelUpOverlay.tsx` — a full-screen overlay with spring-animated card entrance, pulsing radial glow, animated level number, title, XP earned row, and tap-to-dismiss. Shows for 3 s then auto-dismisses with a "Level N reached!" toast before navigating to Map. `LogOutputScreen.tsx` routes `leveledUp && !skillCompleted` → overlay instead of generic toast. Added `formStateRef` for accurate abandonment tracking.
- **Analytics fixes**: `first_output_logged` event with `time_to_first_output_minutes` (activation funnel metric). `log_screen_abandoned` event with fill-depth properties (form funnel drop-off metric).
- Files changed: `src/components/LevelUpOverlay.tsx` (new), `src/screens/LogOutputScreen.tsx`, `src/store/appStore.ts`, `src/utils/analytics.ts`, `skillforge-audit-report.md`
- Build: 0 TS errors. Server live at http://localhost:8082. Level-up flow verified.

### 2026-05-27 (sprint 5)
- Improvement made: "Path Complete" state on DashboardScreen.
- **Problem**: When a user finishes all skills on their current path, `nextSkill` becomes `undefined` and the "NEXT MILESTONE" action card disappears silently. No celebration, no coaching, no CTA — pure dead-end for users who actually complete a path.
- **Fix**: Added a gold path-complete card that renders when `hasStarted && !nextSkill?.skill && pathPct >= 100`. Shows "🎉 PATH COMPLETE · {Path} Mastered!" with XP earned, "Explore New Paths ⚡" CTA to the Evolve tab, and "Keep Logging Outputs" secondary CTA to the Log tab. Also updated XP bar hint to show "🎉 Path Complete!" instead of "0 XP left in path" when `pathXpRemaining === 0`.
- Files changed: `src/screens/DashboardScreen.tsx`
- Build: 548 modules, 0 TS errors. ✓ built in 2.37s. Server live at http://192.168.123.37:8083.

### 2026-05-27 (sprint 4)
- Improvements made: Confetti burst on MilestoneScreen + Name editing on Profile.
- Files changed: `src/screens/MilestoneScreen.tsx`, `src/screens/ProfileScreen.tsx`, `src/store/appStore.ts`
- Build: 548 modules, 0 TS errors.

### 2026-05-27
- Improvement made: Onboarding skip button — added skip links on steps 1 and 2.
- Files changed: `src/screens/OnboardingScreen.tsx`
- Build: 548 modules, 0 TS errors.

### 2026-05-26 (sprint 3)
- Improvement made: Pull-to-refresh on Profile screen.
- Files changed: `src/screens/ProfileScreen.tsx`
- Build: 548 modules, 0 TS errors. Server live at http://192.168.123.37:8083.

### 2026-05-26 (sprint 2 — pilot readiness push)
- Improvements made: Email capture in onboarding, pull-to-refresh on Feed, streak milestone cards for days 7-13/14-29/30+, bio editing on Profile, session duration analytics in App.tsx.
- Files changed: `src/types/index.ts`, `src/store/appStore.ts`, `src/screens/OnboardingScreen.tsx`, `src/screens/FeedScreen.tsx`, `src/screens/DashboardScreen.tsx`, `src/screens/ProfileScreen.tsx`, `App.tsx`
- Build: 548 modules, 0 TS errors. Server live at http://localhost:8083.

### 2026-05-26
- Improvement made: Feed path filter chips.
- Files changed: `src/screens/FeedScreen.tsx`

### 2026-05-25 (run 2)
- Bug fixes: P3 LogOutputScreen path filter, P5 streak freeze count display, P4 leaderboard includes current user.
- Enhancements: Avatar emoji picker, CareerNode completedAt date, character counter on description, haptic feedback.

### 2026-05-25 (run 1)
- Improvement made: Fixed MilestoneScreen blank screen for custom skill/path completions.
- Files changed: `src/screens/MilestoneScreen.tsx`

### 2026-05-24
- Improvement made: Fixed CelebrationOverlay firing on every Dashboard mount.
- Files changed: `src/store/appStore.ts`, `src/screens/DashboardScreen.tsx`
