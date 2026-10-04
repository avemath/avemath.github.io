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
5. To feature it on the home page, add it to the `bento` list in `src/pages/index.astro`.
6. Run `npm run verify`, then `npm run assets` to make its social card. Commit and push.

## Update the rest

| What | Where |
|---|---|
| Portrait on About | drop a photo at `src/assets/portrait.jpg` (or .png/.webp), square, at least 800px. It replaces the scope automatically. |
| "Off the clock" on About | `src/data/offclock.json` for the words. Photos go in `src/assets/offclock/`, named in each entry's `photo`, with an `alt`. Entries without a photo render as text cards. |
| "Now" strip | `src/data/now.json` |
| Experience, education, résumé | `src/data/experience.json` (the HTML résumé and PDF both read it) |
| Skills | `src/data/skills.json` |
| Field notes | `src/data/facts.json` (six facts whose stories are not already told elsewhere on the home page; keep the count at six so the ledger rows stay full) |
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
- **Children and families:** no real names, photos or health details from Because of ADAM or Little Explorer Swim. Use site screenshots or drawn art instead.
- Client sites need the owner's OK before they're named or quoted.

## Upkeep checklist

- [ ] New client site goes up within a week of launch
- [ ] "Now" strip refreshed each semester
- [ ] Résumé PDF regenerated after any experience change
- [ ] Commit counts and Lighthouse numbers in case studies rechecked twice a year
- [ ] `npm run verify` and `npm run test:a11y` pass before every push
