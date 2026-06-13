// ─── Edge Function: delete-account (COMP-001) ─────────────────────────────────
// Permanently delete the CALLING user's account and ALL of their cloud data —
// the GDPR Art.17 / PH Data Privacy Act "right to erasure", self-served.
//
// How the erasure is total: `profiles.id` references `auth.users(id) ON DELETE
// CASCADE`, and every data table (`outputs`, `skill_progress`, `milestones`,
// `market_signals`, and the Phase-2 feed tables) references `profiles(id) ON
// DELETE CASCADE`. So deleting the single `auth.users` row cascades to wipe the
// profile and every owned row — including the email held in `auth.users`.
//
// Security:
//   • The service-role key lives ONLY here (server-side) — never in the client.
//   • The caller is authenticated by their own JWT (Supabase verifies it before
//     this runs because verify_jwt defaults to true). We re-derive the user id
//     from that token and delete ONLY that user — a caller can never delete
//     anyone else's account.
//
// Deploy (owner step — see ./README.md):
//   supabase functions deploy delete-account --project-ref wovceouygyobczkkeyxy
//
// Invoked from the client via `supabase.functions.invoke('delete-account')`
// (see `deleteAccount()` in src/lib/auth.ts). The endpoint lives under
// *.supabase.co, already allowed by the app's CSP connect-src.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!jwt) return json({ error: 'Missing authorization' }, 401);

    const url = Deno.env.get('SUPABASE_URL');
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceRole) return json({ error: 'Server misconfigured' }, 500);

    const admin = createClient(url, serviceRole, { auth: { persistSession: false } });

    // Identify the caller from their own token — we only ever delete this user.
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: 'Invalid session' }, 401);

    // Delete the auth user → ON DELETE CASCADE wipes the profile and every owned row.
    const { error: delErr } = await admin.auth.admin.deleteUser(userData.user.id);
    if (delErr) return json({ error: delErr.message }, 500);

    return json({ ok: true }, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
