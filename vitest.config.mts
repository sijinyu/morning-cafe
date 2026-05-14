import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vitest configuration.
 *
 * - Uses the `node` environment (no DOM needed for pure utility tests).
 * - Resolves the `@/*` path alias to match tsconfig.json `paths`.
 * - No React plugin required: the crawl tests are plain TypeScript.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    globals: false,
  },
});
