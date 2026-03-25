import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    alias: {
      // Ensure .js imports resolve to .ts files (NodeNext module resolution compat)
      '../../src': resolve(__dirname, 'apps/api/src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    exclude: ['**/e2e/**', '**/node_modules/**'],
    server: {
      deps: {
        // Inline all local sources so vitest transforms .ts files properly
        inline: [/apps\/api\/src/],
      },
    },
  },
});
