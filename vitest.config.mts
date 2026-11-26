import { defineConfig } from 'vitest/config';

// La suite normal es tests/unit. El bot de balance (tests/balance) se corre aparte con `npm run balance`.
export default defineConfig({
  test: { include: process.env['BALANCE'] ? ['tests/balance/**/*.test.ts'] : ['tests/unit/**/*.test.ts'], environment: 'node' },
});
