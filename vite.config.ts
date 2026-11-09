import { defineConfig } from 'vitest/config';

export default defineConfig(({ command, isPreview }) => ({
  // The build is served from https://<user>.github.io/poke-fight/ (GitHub Pages, .github/workflows/pages.yml), so its
  // files are linked under /poke-fight/ (and `npm run preview` serves it there too). The dev server and the browser
  // tests keep the root.
  base: command === 'build' || isPreview ? '/poke-fight/' : '/',
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
}));
