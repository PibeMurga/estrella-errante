import { defineConfig, devices } from '@playwright/test';

const gpuArgs = ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11'];

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  outputDir: 'test-results',
  use: { baseURL: 'http://localhost:5174' },
  webServer: {
    command: 'npm run dev:web',
    url: 'http://localhost:5174',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    {
      name: 'web',
      testIgnore: /(bench|electron|shots)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 }, launchOptions: { args: gpuArgs } },
    },
    {
      name: 'shots',
      testMatch: /shots\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 }, launchOptions: { args: gpuArgs } },
    },
    {
      name: 'bench',
      testMatch: /bench\.spec\.ts/,
      timeout: 150_000,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 }, launchOptions: { args: gpuArgs } },
    },
    { name: 'electron', testMatch: /electron\.spec\.ts/ },
  ],
});
