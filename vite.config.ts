import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the site under /<repo>/ ; local dev uses /.
const base = process.env.GITHUB_PAGES_BASE ?? '/';

export default defineConfig({
  plugins: [react()],
  base,
  build: { target: 'es2020', sourcemap: false },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
