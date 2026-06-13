/**
 * MaglakbAI Analytics — PostHog-compatible event tracking.
 *
 * Privacy posture (web pilot):
 *   • OPT-IN ONLY. No event is sent until the user explicitly grants consent.
 *     Until then track()/identify() are hard no-ops. Consent is persisted in
 *     localStorage and can be revoked anytime from Settings.
 *   • NO PII. Names, emails, handles, and bios are never sent. Users are
 *     identified by an anonymous random id only. A defensive scrub strips
 *     `name`/`email` keys from any event payload as a backstop.
 *
 * Sends events to PostHog via the /capture API. Also requires
 * VITE_POSTHOG_API_KEY to be configured — otherwise it no-ops (offline dev).
 *
 * PostHog setup: https://posthog.com — create a project, copy the API key,
 * add it to a .env file as VITE_POSTHOG_API_KEY.
 *
 * Events tracked:
 *   onboarding_started, onboarding_step_completed, onboarding_completed,
 *   first_output_logged, output_logged, skill_completed, level_up,
 *   achievement_unlocked, streak_milestone, post_reacted,
 *   milestone_screen_viewed, path_switched, custom_path_created,
 *   screen_viewed, log_screen_abandoned, retention_d1, retention_d7,
 *   retention_d30, client_error (OPS-001 — see errorMonitor.ts)
 *
 * Retention semantics: retention_dN fires ONCE, on the first session that
 * occurs on or after N calendar days since the user joined (see
 * trackRetention). This measures "still active at the N-day mark" and is
 * driven by app opens — NOT by logging an output — so a returning user is
 * counted whether or not they happen to log on the exact Nth day.
 */

// `||` (not `??`) so an EMPTY-string env var still falls back to the default —
// with `??`, VITE_POSTHOG_HOST="" would make HOST '' and post() would hit the
// app's own origin (OPS-002). The ingest host must also be allowed by the CSP
// connect-src in netlify.toml — keep the two in sync.
const API_KEY: string = ((typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_POSTHOG_API_KEY) || '') as string;
const HOST: string    = ((typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_POSTHOG_HOST) || 'https://us.i.posthog.com') as string;

const CONSENT_KEY = 'sf_analytics_consent'; // 'granted' | 'denied' (absent → undecided)
const CONSENT_EVENT = 'maglakbai:consent-changed';

export type ConsentStatus = 'granted' | 'denied' | 'undecided';

// ─── Consent ───────────────────────────────────────────────────────────────────

export function getConsentStatus(): ConsentStatus {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    if (v === 'granted' || v === 'denied') return v;
  } catch {}
  return 'undecided';
}

export function hasConsentDecision(): boolean {
  return getConsentStatus() !== 'undecided';
}

export function setConsent(granted: boolean): void {
  try {
    localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied');
  } catch {}
  if (!granted) {
    // Revoking → forget the anonymous id too.
    reset();
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: { granted } }));
  }
}

// ─── PII scrub ───────────────────────────────────────────────────────────────
// Exact-key blocklist. Behavioral keys like skill_name / path_name are kept.
const PII_KEYS = new Set(['name', 'email', 'handle', 'bio', 'full_name']);

function scrubPII(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(props)) {
    if (!PII_KEYS.has(k)) out[k] = props[k];
  }
  return out;
}

// ─── Distinct id ───────────────────────────────────────────────────────────────

let _distinctId: string = '';

function getDistinctId(): string {
  if (_distinctId) return _distinctId;
  try {
    const stored = localStorage.getItem('sf_analytics_id');
    if (stored) { _distinctId = stored; return stored; }
  } catch {}
  const id = `sf_anon_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  _distinctId = id;
  try { localStorage.setItem('sf_analytics_id', id); } catch {}
  return id;
}

function post(payload: object): void {
  if (!API_KEY) return;                          // not configured
  if (getConsentStatus() !== 'granted') return;  // opt-in gate
  try {
    fetch(`${HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true, // survive page unload
    }).catch(() => {});
  } catch {}
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function track(event: string, properties: Record<string, unknown> = {}): void {
  post({
    api_key: API_KEY,
    event,
    distinct_id: getDistinctId(),
    properties: {
      ...scrubPII(properties),
      $current_url: typeof window !== 'undefined' ? window.location.href : '',
      platform: 'web',
    },
    timestamp: new Date().toISOString(),
  });
}

export function identify(userId: string, traits: Record<string, unknown> = {}): void {
  // Keep an anonymous-but-stable id for funnels; never store PII against it.
  _distinctId = userId;
  try { localStorage.setItem('sf_analytics_id', userId); } catch {}
  post({
    api_key: API_KEY,
    event: '$identify',
    distinct_id: userId,
    properties: {
      $set: scrubPII(traits),
    },
    timestamp: new Date().toISOString(),
  });
}

export function reset(): void {
  _distinctId = '';
  try {
    localStorage.removeItem('sf_analytics_id');
    localStorage.removeItem(RETENTION_KEY); // re-evaluate retention if the user re-consents / resets
  } catch {}
}

// ─── Retention (session-based) ───────────────────────────────────────────────
// retention_dN = the user was active (opened the app) on or after N calendar
// days since joining. Fired once per milestone, driven by app opens rather than
// by logging an output, so genuine returns aren't missed.

export const RETENTION_MILESTONES = [1, 7, 30] as const;
const RETENTION_KEY = 'sf_retention_fired';

/**
 * Pure: which retention milestones should fire given the user's age (in whole
 * days since join) and the milestones already fired. Uses `>=` so a user whose
 * first return is on day 10 still counts toward d1/d7 — they are demonstrably
 * retained past those marks. Monotonic and dedup-safe.
 */
export function pendingRetentionMilestones(
  daysSinceJoin: number,
  alreadyFired: readonly number[],
): number[] {
  return RETENTION_MILESTONES.filter(
    (m) => daysSinceJoin >= m && !alreadyFired.includes(m),
  );
}

function readFiredMilestones(): number[] {
  try {
    const raw = localStorage.getItem(RETENTION_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((n): n is number => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

/**
 * Call on every session start (app open / resume), passing the user's joinedAt.
 * Fires any not-yet-fired retention milestones the user has reached. No-op
 * until analytics consent is granted, so the guard isn't burned before opt-in.
 */
export function trackRetention(joinedAtISO: string | null | undefined): void {
  if (!joinedAtISO) return;
  if (getConsentStatus() !== 'granted') return;
  const joined = new Date(joinedAtISO).getTime();
  if (Number.isNaN(joined)) return;
  const daysSinceJoin = Math.floor((Date.now() - joined) / 86_400_000);
  if (daysSinceJoin < RETENTION_MILESTONES[0]) return;
  const fired = readFiredMilestones();
  const pending = pendingRetentionMilestones(daysSinceJoin, fired);
  if (pending.length === 0) return;
  for (const m of pending) {
    track(`retention_d${m}`, { days_since_join: daysSinceJoin });
  }
  try {
    localStorage.setItem(RETENTION_KEY, JSON.stringify([...fired, ...pending]));
  } catch {}
}

export function sessionStarted(properties: Record<string, unknown> = {}): void {
  track('session_started', {
    ...properties,
    referrer: typeof document !== 'undefined' ? document.referrer : '',
  });
}

export function page(name: string, properties: Record<string, unknown> = {}): void {
  track('screen_viewed', { screen: name, ...properties });
}
