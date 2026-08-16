import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/tests/**/*.test.js'],
    env: {
      JWT_SECRET: 'test-secret-for-testing-only',
      NODE_ENV: 'test',
    },
  },
});
