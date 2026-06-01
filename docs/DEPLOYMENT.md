# SkillForge — Deployment

SkillForge ships as a **web/PWA** app (Vite build → static `dist/`). There is no native build in the pilot. This doc covers local build, production deploy (Vercel), the user-guide page (GitHub Pages), environment variables, and the sandbox build workaround.

---

## Prerequisites

- Node 18+ and npm
- `npm install` once to populate `node_modules`
- Optional: `.env` from `.env.example` (analytics / Phase-2 vars — all optional)

## Scripts (`package.json`)

| Script | Command | Purpose |
|--------|---------|---------|
| `npm run dev` | `vite --port 8082` | Local dev server (fast HMR) |
| `npm run build` | `vite build --outDir dist` | Production build → `dist/` |
| `npm run serve` | `http.server 8083 --directory dist` | Serve a built `dist/` locally |
| `npm run build:serve` | build + serve | One-shot preview of the production bundle |
| `npm test` | `vitest run` | Unit + integration tests (run before deploy) |

A production build emits hashed assets into `dist/`:
- `dist/index.html`, `dist/assets/*` (vendor / navigation / app chunks)
- Everything in `public/` is copied to `dist/` root — PWA `manifest.json`, icons, `_redirects`, and `USER_GUIDE.html`.

---

## Production deploy — Vercel (recommended)

`vercel.json` is committed: SPA rewrite (`/(.*) → /index.html`) + security headers (`X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`) + long-cache headers for `/assets/*`.

> Note: static files in the output are matched **before** the SPA rewrite, so real files like `/USER_GUIDE.html` and `/manifest.json` are served directly. (`public/_redirects` is a Netlify convention and is ignored by Vercel.)

**First-time setup (one time, requires your Vercel login):**
```bash
npm i -g vercel
vercel            # links/creates the project → gives a *.vercel.app domain
```

**Each release:**
```bash
npm test          # green first
npm run build     # produces dist/
vercel --prod     # deploy dist/ to production
```

Set any env vars (e.g. `VITE_POSTHOG_API_KEY`) in the Vercel project's Environment Variables, or in a local `.env` before `npm run build`. Vite inlines `VITE_*` vars at build time.

### Alternatives
- **Netlify Drop** — drag the built `dist/` folder onto app.netlify.com/drop for an instant URL (no account).
- Any static host works — just serve `dist/` with the SPA fallback to `index.html`.

---

## User guide page — GitHub Pages

The how-to guide (`docs/USER_GUIDE.html`, also copied to `public/USER_GUIDE.html`) is published via GitHub Pages from the repo `mromanil0310/skillforge`:

- **Repo → Settings → Pages → Deploy from a branch → `main` / `/docs`.**
- Live at: `https://mromanil0310.github.io/skillforge/USER_GUIDE.html`

`docs/USER_GUIDE.html` is the source of truth; `public/USER_GUIDE.html` is the copy that ships inside the app build. Keep them in sync when editing.

---

## Sandbox / FUSE build workaround

In the agent sandbox, the workspace is a FUSE mount where Vite's in-place `dist/` cleanup can fail with an unlink error. Two ways around it:

1. **Build to a non-FUSE outDir:**
   ```bash
   node node_modules/.bin/vite build --outDir /tmp/sf_dist --emptyOutDir
   ```
   then copy `/tmp/sf_dist/*` back over `dist/` (overwrite works; deletes don't).

2. **Build from a /tmp copy of the source** (see the daily-QA skill `docs/skillforge-daily-qa.md` for the full copy-and-symlink-`node_modules` recipe), then sync `dist/` back.

On a normal machine (your Mac), `npm run build` works directly — the workaround is only needed inside the sandbox.

---

## Pre-deploy checklist

- [ ] `npm test` green
- [ ] `npm run build` succeeds (no TS/Vite errors)
- [ ] Spot-check the built bundle via `npm run serve`
- [ ] Env vars set in the host (if using analytics/Phase 2)
- [ ] `USER_GUIDE.html` updated in **both** `docs/` and `public/` if changed
