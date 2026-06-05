/**
 * LakbAI Analytics — PostHog-compatible event tracking.
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
 *   screen_viewed, log_screen_abandoned, retention_d1_activated,
 *   retention_d7, retention_d30
 */

const API_KEY: string = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_POSTHOG_API_KEY) ?? '';
const HOST: string    = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_POSTHOG_HOST) ?? 'https://us.i.posthog.com';

const CONSENT_KEY = 'sf_analytics_consent'; // 'granted' | 'denied' (absent → undecided)
const CONSENT_EVENT = 'skillforge:consent-changed';

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
  try { localStorage.removeItem('sf_analytics_id'); } catch {}
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
