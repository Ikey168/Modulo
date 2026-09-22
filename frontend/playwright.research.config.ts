import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: '**/noesis-research.spec.ts', workers: 1, timeout: 90000, expect: { timeout: 30000 },
  use: { baseURL: 'http://127.0.0.1:5194', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }, { name: 'firefox', use: { ...devices['Desktop Firefox'] } }],
  webServer: { command: 'VITE_DEV_BYPASS_AUTH=true npm run dev -- --host 127.0.0.1 --port 5194 --strictPort', url: 'http://127.0.0.1:5194', reuseExistingServer: false },
});
