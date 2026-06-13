/**
 * MaglakbAI Error Monitor (OPS-001).
 *
 * Lightweight client crash reporting that reuses the existing analytics
 * pipeline instead of shipping a heavyweight vendor SDK:
 *   • Errors are sent as a `client_error` event via track(), so they inherit
 *     the SAME privacy posture — OPT-IN only (no consent → no report) and
 *     PII-scrubbed. Users who never opted into analytics send nothing.
 *   • Messages/stacks are additionally sanitized here (emails redacted, URL
 *     query/hash stripped, truncated) so user input or auth tokens that may
 *     have landed in an error string never leave the device.
 *   • Per-session dedupe + hard cap so a repeating render error can't flood.
 *
 * Wire-up (see App.tsx / AppNavigator.tsx):
 *   • Root + per-screen ErrorBoundary.componentDidCatch → captureError(...)
 *   • installGlobalErrorHandlers() catches window 'error' + 'unhandledrejection'
 *
 * PostHog (or any compatible sink) can then alert on `client_error` volume.
 */

import { track } from './analytics';

declare const __DEV__: boolean;
const IS_DEV = typeof __DEV__ !== 'undefined' && __DEV__;

export type ErrorSource =
  | 'root_boundary'
  | 'screen_boundary'
  | 'window_onerror'
  | 'unhandledrejection';

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const URL_QUERY_RE = /([?#])[^\s)'"]*/g; // tokens/PII can ride in query/hash

const MAX_MESSAGE_LEN = 300;
const MAX_STACK_LEN = 800;
const MAX_STACK_FRAMES = 6;

/** Pure: redact emails, strip whitespace runs, bound length. */
export function sanitizeErrorMessage(raw: string): string {
  return String(raw ?? '')
    .replace(EMAIL_RE, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_MESSAGE_LEN);
}

/** Pure: keep the top frames, strip URL query/hash, bound length. */
export function sanitizeStack(stack?: string): string {
  if (!stack) return '';
  return stack
    .split('\n')
    .slice(0, MAX_STACK_FRAMES)
    .join('\n')
    .replace(EMAIL_RE, '[redacted]')
    .replace(URL_QUERY_RE, '$1[stripped]')
    .slice(0, MAX_STACK_LEN);
}

export interface ClientErrorEvent {
  error_name: string;
  error_message: string;
  error_stack: string;
  source: ErrorSource;
  [key: string]: unknown;
}

/** Pure: build the non-PII event payload from an error + context. */
export function buildErrorEvent(
  error: unknown,
  context: { source: ErrorSource; [key: string]: unknown },
): ClientErrorEvent {
  const err = error as { name?: string; message?: string; stack?: string } | undefined;
  const { source, ...extra } = context;
  return {
    error_name: (err && err.name) || 'Error',
    error_message: sanitizeErrorMessage(err?.message ?? String(error)),
    error_stack: sanitizeStack(err?.stack),
    source,
    ...extra,
  };
}

/** Stable signature for dedupe (source + name + leading message). */
export function errorSignature(evt: ClientErrorEvent): string {
  return `${evt.source}|${evt.error_name}|${String(evt.error_message).slice(0, 80)}`;
}

// ─── Send (consent-gated via track) ──────────────────────────────────────────

const MAX_ERRORS_PER_SESSION = 25;
const _seen = new Set<string>();
let _sent = 0;

export function captureError(
  error: unknown,
  context: { source: ErrorSource; [key: string]: unknown },
): void {
  try {
    const evt = buildErrorEvent(error, context);
    const sig = errorSignature(evt);
    if (_seen.has(sig)) return;          // identical error already reported this session
    if (_sent >= MAX_ERRORS_PER_SESSION) return;
    _seen.add(sig);
    _sent += 1;
    if (IS_DEV) console.error('[client_error]', evt); // visible locally; track() no-ops in dev
    track('client_error', evt);          // opt-in + PII-scrubbed inside analytics.ts
  } catch {
    // never let the monitor itself throw
  }
}

// Test-only reset for the session dedupe/cap state.
export function _resetForTest(): void {
  _seen.clear();
  _sent = 0;
}

// ─── Global handlers (web) ───────────────────────────────────────────────────

let _installed = false;

export function installGlobalErrorHandlers(): void {
  if (_installed || typeof window === 'undefined') return;
  _installed = true;

  window.addEventListener('error', (e: ErrorEvent) => {
    if (e?.error) captureError(e.error, { source: 'window_onerror' });
    else if (e?.message) captureError(new Error(String(e.message)), { source: 'window_onerror' });
  });

  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    const reason = e?.reason;
    const err =
      reason instanceof Error
        ? reason
        : new Error(typeof reason === 'string' ? reason : 'Unhandled promise rejection');
    captureError(err, { source: 'unhandledrejection' });
  });
}
