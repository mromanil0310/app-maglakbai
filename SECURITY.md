# Security Policy

## Reporting a vulnerability

If you discover a security or privacy issue in SkillForge, please report it privately — do **not** open a public GitHub issue.

- **Contact:** `marlo.romanillos@gmail.com`

Please include: what you found, steps to reproduce, and the impact. We'll acknowledge the report and keep you updated on the fix.

## Scope & current posture (web/PWA pilot)

- **No backend.** All user data lives in the browser's `localStorage` on the device — there is no server to breach and no central store of user data. (Migrating to Supabase is planned for Phase 2; this policy will expand then.)
- **Analytics is opt-in and PII-free.** Nothing is sent until the user consents; names, emails, handles, and free text are never transmitted (see `docs/PRIVACY.md`).
- **Client headers.** `vercel.json` sets `X-Content-Type-Options`, `X-Frame-Options`, and `X-XSS-Protection`.

## Known limitations (not vulnerabilities, but worth knowing)

- Device-local data is only as protected as the user's browser/device; clearing browser data loses progress (mitigated by Settings → Export Data).
- There is no auth in the pilot — the app is single-user per browser.
