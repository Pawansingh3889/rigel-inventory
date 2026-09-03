import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

// Test credentials live in .env.local (gitignored), never in the repo.
if (existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
}

const PORT = 8080;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // These drive real Supabase edge functions, whose cold starts run to ~10s.
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Boots `npm run dev` automatically, or reuses a dev server you already have running.
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
