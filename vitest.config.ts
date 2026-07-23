import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Même alias que tsconfig (`@/*` → racine du projet)
    alias: { '@': path.resolve(__dirname) },
  },
  test: {
    environment: 'node',
  },
});
