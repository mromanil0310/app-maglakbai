import { describe, it, expect } from 'vitest';
import { loadFromStorage, SCHEMA_VERSION } from '../persistence';

// ARCH-003: schema-versioned persistence with migration + validation.
// loadFromStorage reads localStorage at call time, so we stub a minimal
// localStorage before each assertion.

const KEY = 'skillforge_v1';
function setStored(raw: string | null): void {
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (k === KEY ? raw : null),
    setItem: () => {},
    removeItem: () => {},
  };
}

describe('loadFromStorage (ARCH-003 versioning)', () => {
  it('returns null when nothing is stored', () => {
    setStored(null);
    expect(loadFromStorage()).toBeNull();
  });

  it('reads a current versioned envelope', () => {
    setStored(JSON.stringify({ v: SCHEMA_VERSION, data: { hasOnboarded: true, savedPostIds: ['p1'] } }));
    const r = loadFromStorage();
    expect(r!.hasOnboarded).toBe(true);
    expect(r!.savedPostIds).toEqual(['p1']);
  });

  it('migrates a legacy unversioned (v0) flat object', () => {
    // Pre-ARCH-003 saves had no envelope — the whole object was the data.
    setStored(JSON.stringify({ hasOnboarded: true, colorScheme: 'light' }));
    const r = loadFromStorage();
    expect(r!.hasOnboarded).toBe(true);
    expect(r!.colorScheme).toBe('light');
  });

  it('returns null on corrupt JSON', () => {
    setStored('not valid json{');
    expect(loadFromStorage()).toBeNull();
  });

  it('returns null on a non-object payload (array / primitive)', () => {
    setStored(JSON.stringify([1, 2, 3]));
    expect(loadFromStorage()).toBeNull();
    setStored(JSON.stringify(42));
    expect(loadFromStorage()).toBeNull();
  });

  it('returns null when the envelope data is not an object', () => {
    setStored(JSON.stringify({ v: SCHEMA_VERSION, data: 'oops' }));
    expect(loadFromStorage()).toBeNull();
  });

  it('returns null when stored by a newer schema version (no downgrade crash)', () => {
    setStored(JSON.stringify({ v: SCHEMA_VERSION + 1, data: { hasOnboarded: true } }));
    expect(loadFromStorage()).toBeNull();
  });
});
