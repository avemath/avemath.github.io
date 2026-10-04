// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://avemath.github.io',
  trailingSlash: 'ignore',
  // Keep HTML-aware whitespace so spaces between inline links and tags survive.
  compressHTML: true,
  // Inline CSS so first paint never waits on a stylesheet request.
  build: { inlineStylesheets: 'always' },
  integrations: [sitemap({ filter: (page) => !page.includes('/404') && !page.includes('/styleguide') })],
  vite: { plugins: [tailwindcss()] },
  image: { responsiveStyles: true },
});
