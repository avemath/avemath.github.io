# Plan and roadmap

## The idea

One person, one story: I engineer systems and I build the web. The research, the engineering, the client sites, the nonprofit and the land work all show up as evidence for that, not as separate identities. The "I'm here to..." switcher reorders the same page for employers, research labs and website clients instead of splitting the site.

## Audiences

| Audience | Looking for | Where the site answers |
|---|---|---|
| Recruiters and hiring managers | current role, degree, dates, skills, shipped work, résumé | hero, Now strip, timeline, résumé in the nav |
| Research labs and faculty | research area, advisor, methods, outputs | Research section, case studies, résumé |
| Website clients | live examples, process, how to reach me | Websites section, /services, contact form |
| Nonprofit partners | mission and credibility | Because of ADAM case study, About |

## Sitemap

```
/                 home, one long page with anchored sections
/work/            every project, filterable
/work/<slug>/     case studies
/resume/          HTML résumé + one-page PDF
/services/        offer, process, FAQ
/about/           longer story
/contact/         form, email, socials
/404              custom
```

## Phases

| Phase | Scope | Status |
|---|---|---|
| 0. Setup | repo, Astro, Tailwind, TypeScript, deploy workflow | done |
| 1. Design system | tokens, light and dark themes, layout, nav, footer, SEO, fonts | done |
| 2. Content model | collection schema, data files, 10 projects, /work grid, case study layout | done |
| 3. Core pages | home, résumé (HTML + PDF), services, about, contact, 404 | done |
| 4. Signature interactions | sonar hero, audience switcher, bento, timeline, command palette, field notes, reveals, three project demos | done |
| 5. Polish and QA | image optimization, Lighthouse, axe, social images, sitemap, JSON-LD | done |
| 6. Launch | Web3Forms key, analytics, Search Console, headshot, LinkedIn post | in progress |
| 7. Maintain | see the checklist in CONTENT-GUIDE.md | ongoing |

## Before launch

- [ ] Web3Forms access key in `src/data/site.json` (the form falls back to email until then)
- [ ] Cloudflare Web Analytics token in `src/data/site.json`
- [ ] Google Search Console verification token in `src/data/site.json`
- [ ] Headshot for About
- [ ] Written OK on research and internship wording
- [ ] Owner OK for each client site and quote
- [ ] Recommendation quotes approved by the writers (`src/data/testimonials.json`)

## Later

- Live GitHub stats, fetched at build time only
- A short write-up per demo on how it was ported
- Before and after shots for any future redesign work
