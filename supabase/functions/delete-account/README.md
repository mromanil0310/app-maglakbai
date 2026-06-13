# `delete-account` Edge Function (COMP-001)

Self-serve account + cloud-data deletion — the right-to-erasure path wired to
**Settings → Delete Account** in the app.

## What it does

Verifies the caller's JWT, then uses the **service-role** key to call
`auth.admin.deleteUser(userId)`. Because `profiles.id → auth.users(id) ON DELETE
CASCADE` and every data table references `profiles(id) ON DELETE CASCADE`,
deleting that one `auth.users` row erases the profile **and** every owned row
(`outputs`, `skill_progress`, `milestones`, `market_signals`, feed tables) —
including the email stored in `auth.users`.

The service-role key never leaves the server; the client only ever holds the
anon key.

## Deploy (one-time owner step)

Requires the [Supabase CLI](https://supabase.com/docs/guides/cli) and being
logged in to the project owner account.

```bash
# 1. Log in (opens a browser) — once per machine
supabase login

# 2. Link the local repo to the live project — once per clone
supabase link --project-ref wovceouygyobczkkeyxy

# 3. Deploy the function
supabase functions deploy delete-account --project-ref wovceouygyobczkkeyxy
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by the
Supabase runtime — **do not** set them manually and never commit the service
key. `verify_jwt` defaults to **true**, so unauthenticated calls are rejected by
the platform before the function runs.

## Verify after deploy

1. In the app, sign in via **Settings → Cloud Backup** (Magic Link).
2. Log at least one output so a row exists in `outputs` / `skill_progress`.
3. **Settings → Delete Account → confirm.** The app should sign out and return
   to onboarding.
4. In the Supabase dashboard, confirm the user is gone from **Authentication →
   Users** and that their rows are gone from `profiles` / `outputs` /
   `skill_progress`.

## Rollback

`supabase functions delete delete-account --project-ref wovceouygyobczkkeyxy`
removes it; the in-app button then surfaces a friendly "couldn't reach the
server" error and no data is touched.
