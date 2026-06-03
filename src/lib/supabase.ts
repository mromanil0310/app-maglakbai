// ─── Supabase client singleton ────────────────────────────────────────────────
// Single import point for all Supabase access in the app.
// The client is created once and reused — never call createClient() elsewhere.
//
// When VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are absent (CI, local dev
// without .env) `isSupabaseEnabled` is false and all sync helpers no-op
// gracefully, keeping the localStorage fallback fully functional.

import { createClient, type SupabaseClient, type Session, type User } from '@supabase/supabase-js';

// Vite exposes env vars on import.meta.env — fall back to {} in Node.js (tests/CI)
// so isSupabaseEnabled is false and all helpers no-op cleanly.
const env: Record<string, string | undefined> =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const supabaseUrl  = env.VITE_SUPABASE_URL;
const supabaseKey  = env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseEnabled = !!(supabaseUrl && supabaseKey);

// Typed client — exported as `supabase`; screens/slices never import createClient directly.
export const supabase: SupabaseClient = isSupabaseEnabled
  ? createClient(supabaseUrl!, supabaseKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,   // picks up the Magic Link token from the URL hash
      },
    })
  : (null as unknown as SupabaseClient); // guarded by isSupabaseEnabled at every callsite

// Re-export auth types so the rest of the app only needs to import from here
export type { Session, User };
