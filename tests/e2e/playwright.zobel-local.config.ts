import { defineConfig, devices } from '@playwright/test';

/**
 * Runs end-to-end tests without Docker, against a homeserver you started yourself:
 *
 *   pnpm exec playwright test -c tests/e2e/playwright.zobel-local.config.ts zobel-seen
 *
 * The homeserver is a Continuwuity set up like `fixtures/continuwuity.ts` sets up its
 * container (server name `test.local`, registration token `sable-e2e`) and listening on
 * `ZOBEL_E2E_HOMESERVER`, by default http://127.0.0.1:18008. The app comes from a dev
 * server on port 4177, which is started if it is not running. That needs the core built
 * once with `pnpm wasm:dev`.
 */
const origin = 'http://127.0.0.1:4177';

export default defineConfig({
  testDir: '.',
  workers: 1,
  timeout: 120_000,
  reporter: 'list',
  use: {
    baseURL: origin,
    trace: 'retain-on-failure',
    contextOptions: { reducedMotion: 'reduce' },
  },
  projects: [
    { name: 'setup', testMatch: 'zobel-local.setup.ts' },
    { name: 'warmup', testMatch: 'dev-server.warmup.ts', use: devices['Desktop Chrome'] },
    {
      name: 'chromium',
      dependencies: ['setup', 'warmup'],
      testMatch: /\.spec\.ts$/,
      use: devices['Desktop Chrome'],
    },
  ],
  webServer: {
    cwd: '../..',
    command: `pnpm exec vite dev --host 127.0.0.1 --port 4177 --strictPort`,
    url: origin,
    env: { SVELTE_INSPECTOR_OPTIONS: 'false' },
    reuseExistingServer: true,
    timeout: 300_000,
  },
});
