/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// base './' so the same build works at /local/kitchen/ on Home Assistant and at / locally.
export default defineConfig({
  base: './',
  plugins: [preact()],
  build: { target: 'es2020', assetsInlineLimit: 0 },
  test: { include: ['src/**/*.test.ts'] },
});
