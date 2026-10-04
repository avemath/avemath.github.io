# avemath.github.io

My portfolio and résumé site: research, engineering projects, and the websites I've built for clients.

**Live:** [avemath.github.io](https://avemath.github.io)

## What's in it

- **Home** with a sonar-scope hero, a "Now" strip, and an "I'm here to..." switcher that reorders the page for employers, research labs or website clients. The reordering is pure CSS (`:has()` on the checked option), so it works before any JavaScript loads.
- **Work**, a filterable grid of every project, plus a case study page for each one.
- **Three in-browser demos** built from my own project code:
  - the LED spectrum visualizer's ESP32 signal chain, ported to JavaScript (same FFT size, band edges, AGC and silence detection), with an optional microphone mode
  - a line-for-line simulation of the RAMpage combat robot's weapon and E-stop firmware, including the serial console output
  - a simplified model of my V2V receiver chain, where you can switch on each sync stage and watch the constellation clean up
- **Recommendations** from the professors who advised the projects. A quote renders only once its writer has approved it (`src/data/testimonials.json`).
- **Résumé** as an HTML page and a one-page tagged PDF, both generated from the same data file.
- **Services** for website clients, **About**, **Contact** (Web3Forms with a mailto fallback), and a command palette on every page (Ctrl K or Cmd K, or press `/`). On phones the header has a native Menu disclosure, so navigation works before any JavaScript loads.

## Stack

- [Astro](https://astro.build) 7, static output, TypeScript strict
- Tailwind CSS 4, with design tokens as CSS variables (see [docs/DESIGN.md](docs/DESIGN.md))
- Self-hosted variable fonts: Space Grotesk, Inter, JetBrains Mono
- No UI framework. Interactive pieces are small vanilla TypeScript modules that load only on the pages that use them.
- Self-hosted fonts are preloaded and have metric-matched local fallbacks, so the swap to the web font does not shift the layout.
- GitHub Actions lints the copy, type checks, builds, runs axe over every page, and deploys to GitHub Pages on every push to `main`.

## Numbers

Mobile Lighthouse, October 2026: Performance 90 to 100 with zero layout shift, Accessibility 100, Best Practices 100, SEO 100 on every page tested. axe runs over every page, in both themes and at phone width, before every deploy.

## Run it

```bash
npm install
npm run dev        # http://localhost:4321
npm run verify     # copy lint + type check + build
npm run test:a11y  # after a build: axe on every page, both themes, phone and desktop
npm run assets     # after a build: regenerates the résumé PDF, social images and favicon.ico
```

`npm run assets` and `npm run test:a11y` use Playwright's Chromium (`npx playwright install chromium` the first time), or set `CHROMIUM_PATH` to another Chromium binary.

## Add a project

Add one Markdown file to `src/content/projects/`, put any images in `src/assets/projects/<slug>/`, and push. The schema in `src/content.config.ts` fails the build if a field is missing or wrong. The full checklist and writing rules are in [docs/CONTENT-GUIDE.md](docs/CONTENT-GUIDE.md).

## Layout

```
src/
  content/projects/   one Markdown file per project
  data/               site, now, experience, skills, facts, testimonials
  components/         page sections, demos/ for the interactive pieces
  layouts/            BaseLayout, CaseStudyLayout
  pages/              routes
  lib/                content helpers and date formatting
  scripts/            sonar canvas, motion, preferences, text decode
  styles/global.css   tokens and shared styles
scripts/
  lint-copy.mjs       fails CI on em dashes and filler phrases
  check-a11y.mjs      fails CI on any axe violation
  lib/serve-dist.mjs  local server for the built site, shared by the two scripts above
  render-assets.mjs   résumé PDF, social cards, touch icon, favicon.ico
docs/                 plan, design system, content guide
```

All content © Avery Matherne. Client sites belong to their owners.
