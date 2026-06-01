import { defineConfig } from 'vitest/config';

// Unit tests run in a plain Node environment against the pure domain logic in
// src/domain/ (and the pure helpers in src/utils/theme.ts). No DOM/React Native
// runtime is required for these — keep them fast and dependency-free.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
  },
});
