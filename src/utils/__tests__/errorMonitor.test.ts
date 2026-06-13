import { describe, it, expect } from 'vitest';
import {
  sanitizeErrorMessage,
  sanitizeStack,
  buildErrorEvent,
  errorSignature,
} from '../errorMonitor';

// OPS-001: the value of error monitoring is only as good as its privacy
// guarantees. These tests pin the PII-defensive sanitizing and the non-PII
// shape of the event — nothing here should ever ship a user's email, input,
// or auth token to the analytics sink.
describe('sanitizeErrorMessage', () => {
  it('redacts email addresses', () => {
    expect(sanitizeErrorMessage('save failed for juan@example.com while syncing')).toBe(
      'save failed for [redacted] while syncing',
    );
  });

  it('collapses whitespace and trims', () => {
    expect(sanitizeErrorMessage('  line one\n\n  line two\t')).toBe('line one line two');
  });

  it('bounds the length to 300 chars', () => {
    const long = 'x'.repeat(1000);
    expect(sanitizeErrorMessage(long).length).toBe(300);
  });

  it('handles null/undefined safely', () => {
    expect(sanitizeErrorMessage(undefined as unknown as string)).toBe('');
  });
});

describe('sanitizeStack', () => {
  it('keeps only the top frames', () => {
    const stack = Array.from({ length: 20 }, (_, i) => `at frame${i} (app.js:${i}:1)`).join('\n');
    expect(sanitizeStack(stack).split('\n').length).toBe(6);
  });

  it('strips URL query/hash (where tokens/PII can ride)', () => {
    const stack = 'at x (https://app/assets/App.js?token=secret123:10:5)';
    const out = sanitizeStack(stack);
    expect(out).not.toContain('secret123');
    expect(out).toContain('[stripped]');
  });

  it('returns empty string for missing stack', () => {
    expect(sanitizeStack(undefined)).toBe('');
  });
});

describe('buildErrorEvent', () => {
  it('produces a non-PII payload with name/message/stack/source + context', () => {
    const err = new Error('boom for nina@test.io');
    err.name = 'TypeError';
    const evt = buildErrorEvent(err, { source: 'screen_boundary', screen: 'Profile' });
    expect(evt.error_name).toBe('TypeError');
    expect(evt.error_message).toBe('boom for [redacted]');
    expect(evt.source).toBe('screen_boundary');
    expect(evt.screen).toBe('Profile');
    // no raw email anywhere in the serialized event
    expect(JSON.stringify(evt)).not.toContain('nina@test.io');
  });

  it('falls back gracefully for non-Error values', () => {
    const evt = buildErrorEvent('plain string failure', { source: 'window_onerror' });
    expect(evt.error_name).toBe('Error');
    expect(evt.error_message).toBe('plain string failure');
    expect(evt.error_stack).toBe('');
  });
});

describe('errorSignature', () => {
  it('is stable for identical errors (enables dedupe)', () => {
    const a = buildErrorEvent(new Error('same'), { source: 'root_boundary' });
    const b = buildErrorEvent(new Error('same'), { source: 'root_boundary' });
    expect(errorSignature(a)).toBe(errorSignature(b));
  });

  it('differs by source', () => {
    const a = buildErrorEvent(new Error('same'), { source: 'root_boundary' });
    const b = buildErrorEvent(new Error('same'), { source: 'screen_boundary' });
    expect(errorSignature(a)).not.toBe(errorSignature(b));
  });
});
