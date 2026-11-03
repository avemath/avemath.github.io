# Content guide

How to add work and keep the site current, plus the rules every page follows.

## Add a project

1. Create `src/content/projects/<slug>.md`. The slug becomes the URL: `/work/<slug>/`.
2. Fill in the frontmatter. The schema in `src/content.config.ts` checks it at build time.

   ```yaml
   ---
   title: Grace Mae Alterations
   short: gracemaealterations.com      # used in the command palette
   type: client-site                    # research | engineering | client-site | software | nonprofit
   tags: [client-site, software]        # same vocabulary, drives the /work filters
   featured: false
   order: 5                             # lower comes first
   period: { start: "2026-04", end: "2026-09" }   # YYYY or YYYY-MM, leave end off if ongoing
   status: live                         # live | ongoing | complete | archived
   summary: One sentence, under 200 characters, shown on cards.
   outcome: One line on what came of it.
   seoTitle: Short title for search results     # optional, when the title runs past about 43 characters
   seoDescription: Under 160 characters.        # optional, when the summary runs long
   keywords: [radio, SDR]                        # optional extra search terms for the command palette
   role: What I did.
   team: Who else, if anyone.
   stack: [Next.js, Sanity, Playwright]
   links:
     live: https://example.com
     repo: https://github.com/avemath/example
   linkLabel: Visit Example Co.'s site  # optional, replaces "Visit <host>" when the host doesn't say whose site it is
   cover: ../../assets/projects/<slug>/desktop.png
   mobile: ../../assets/projects/<slug>/mobile.png
   coverAlt: Describe what the screenshot shows.
   gallery:
     - src: ../../assets/projects/<slug>/feature.png
       alt: What it shows.
       caption: Why it matters.
   metrics:
     - { label: Commits, value: "106" }
   confidentiality: public              # limited hides gallery, metrics and repo
   client: { name: Example Co., kind: "Bakery, Baton Rouge, LA", permission: true }
   ---
   ```

3. Write the body with these sections: **Context**, **Approach**, **Outcome**, **What I'd do next**. Add **My role** after Context only when there was a team and the split matters; for solo work, one sentence at the end of Context is enough (the role line in the frontmatter already shows in the header). Bold the first words of each approach paragraph.
4. Screenshots: capture at 1440×900 for desktop and 390×844 for mobile with reduced motion on, then save them as PNG in `src/assets/projects/<slug>/`. Astro converts them to WebP at build time, so the source size doesn't matter.
5. The home page shows three projects as figure cards and three as small cards, set by hand in `src/pages/index.astro`. Every project is on /work/, in three sections (engineering, research, websites) set by `workSection` in `src/lib/projects.ts`; that order is also the case studies' previous and next.
6. Run `npm run verify`, then `npm run assets` to make its social card. Commit and push.

## Update the rest

| What | Where |
|---|---|
| Portrait (home page About teaser) | `src/assets/portrait.jpg` (square, at least 800px). Replace the file to change it. |
| Graduation pair on About | `src/assets/about/grad-taylor-hall.jpg` and `grad-tiger.jpg`, 4:5 crops shown as square Polaroids, referenced in `src/pages/about.astro` |
| Gallery clips | an mp4 and a WebVTT captions file in `public/media/`, a poster image beside the project's photos, and a `video:` entry in the project's `gallery` (see `rampage.md`). Transcode to H.264 at 720p or less, strip audio unless it matters, and keep each clip under about 5 MB. Clips never autoplay. |
| Wiring photos | skip any where the wiring looks messy. A close-up of a board with its leads is fine; a tangle inside a chassis or sprawled across a bench is not. |
| About: datasheet pins, characteristics, Integer feature | `src/data/about.json`. Pin photos go in `src/assets/offclock/`, named in the pin's `photo` as a path under `src/assets/`, with an `alt` and a short marker `caption`. A pin with no photo shows its line drawing (`art`). Pin text can link with `[words](/path/)`. |
| Right now, Research, Open to (home) | `src/components/StatusStrip.astro` |
| Experience, education, résumé | `src/data/experience.json` (the HTML résumé and PDF both read it) |
| Skills | `src/data/skills.json` |
| Field notes | `src/data/facts.json`. Each note has a `where`: the research band (`below`, `onr`, `bellhop`, `pool-alarm`) or `signals` for the home page Signals card. One note per place. |
| Website facts and client quotes | `src/data/sites.json`: `pagespeedMobile`, `accessibility`, `pageWeightKb` (home page, transferred), `liveSince`, `ownerEdits`, `measuredOn`, and `quote` / `quoteBy`, shown only when filled, with the owner's OK. No commit counts or file counts: only facts a visitor can judge. |
| Toolbox (home) | `toolbox` in `src/lib/skills.ts`: each chip's rows, the project it links to and one real file per project, taken from `usedIn` |
| Quotes | `src/data/testimonials.json` (only entries with `"approved": true` render) |
| Email, socials, form key, analytics token | `src/data/site.json` |

After changing experience data, run `npm run build && npm run assets` so the PDF matches.

## Writing rules

- Plain, direct and first person, with short sentences.
- **No em dashes or en dashes.** Use periods, commas, colons or parentheses, and "to" for ranges ("2024 to 2025"). CI fails the build if one slips in.
- No filler: "passionate about," "leveraging," "cutting-edge," "seamless," "in today's fast-paced world," "I'm excited to," "delve." The linter catches these too. <!-- lint-copy-ignore -->
- Every claim gets a concrete noun: a site, a number, a tool, a result.
- Never invent facts. If a number wasn't measured, don't print one.
- **Research and the Integer internship:** use only wording from the public announcements until I have written clearance. That means no methods, results, figures, code, vehicle or sensor details.
- **Children and families:** no real names, photos or health details of other families, or of children from Because of ADAM or Little Explorer Swim. Use site screenshots or drawn art instead. The one exception is my own family's story, which I share on purpose: my brother Adam drowned in our backyard pool at 14 months old and survived. That sentence, and the name Adam, may appear in my words. Still no photos of him. My sisters' first names are approved to show too, for example the LED board's boot scroll. First names only: no middle or last names, photos or health details of them. Other families' children are never named.
- Client sites need the owner's OK before they're named or quoted.

## Upkeep checklist

- [ ] New client site goes up within a week of launch
- [ ] "Now" strip and the home status strip refreshed each semester
- [ ] Résumé PDF regenerated after any experience change
- [ ] Commit counts and Lighthouse numbers in case studies rechecked twice a year
- [ ] `npm run verify` and `npm run test:a11y` pass before every push
