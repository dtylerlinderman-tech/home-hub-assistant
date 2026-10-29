import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5199',
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2, // same scale as the reference PNGs in screens/
    colorScheme: 'dark',
  },
  webServer: {
    command: 'npx vite --port 5199 --strictPort',
    url: 'http://localhost:5199',
    reuseExistingServer: true,
  },
});
