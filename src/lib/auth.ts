// ─── Auth helpers (Magic Link) ────────────────────────────────────────────────
// Wraps Supabase auth so the rest of the app never touches supabase.auth directly.
// All functions are no-ops when Supabase is disabled (returns typed null/error).

import { supabase, isSupabaseEnabled, type Session } from './supabase';
export { isSupabaseEnabled }; // re-export so callers only need to import from auth

export type AuthResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Send a Magic Link to the given email address.
 * The link redirects to the app's current origin so the session is picked up
 * automatically via `detectSessionInUrl: true` in the Supabase client config.
 */
export async function sendMagicLink(email: string): Promise<AuthResult> {
  if (!isSupabaseEnabled) return { ok: false, error: 'Backend not configured' };
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : 'maglakbai://auth',
    },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Sign the current user out and clear the local session. */
export async function signOut(): Promise<void> {
  if (!isSupabaseEnabled) return;
  await supabase.auth.signOut();
}

/** Get the current session (null if not signed in). */
export async function getSession(): Promise<Session | null> {
  if (!isSupabaseEnabled) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/**
 * Subscribe to session changes (sign-in, sign-out, token refresh).
 * Returns an unsubscribe function — call it in useEffect cleanup.
 */
export function onAuthStateChange(
  callback: (session: Session | null) => void,
): () => void {
  if (!isSupabaseEnabled) return () => {};
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => callback(session),
  );
  return () => subscription.unsubscribe();
}
