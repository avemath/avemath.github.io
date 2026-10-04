---
title: Grace Mae Alterations
short: gracemaealterations.com
type: client-site
tags: [client-site, software]
featured: true
order: 5
period: { start: "2026-04", end: "2026-09" }
status: live
summary: A bridal alterations studio site with interactive guides that explain bustles and hems better than words can, and inquiry forms that arrive ready to quote.
outcome: Lighthouse 100 for accessibility and SEO, inquiries that arrive ready to quote, and about 435 fields the owner edits herself.
role: Design, build, CMS, email, testing and launch.
keywords: ["bridal", "sewing", "alterations", "Pittsburgh", "Sanity", "Next.js", "bustle"]
stack: [Next.js, React, TypeScript, Sanity, Tailwind CSS, Framer Motion, Resend, Playwright, Vercel]
links:
  live: https://gracemaealterations.com
  repo: https://github.com/avemath/gracemaealterations
cover: ../../assets/projects/grace-mae-alterations/desktop.png
mobile: ../../assets/projects/grace-mae-alterations/mobile.png
coverAlt: Grace Mae home page. An ivory hero reads "Sewn with precision." beside a portrait of the owner, with buttons to book tailoring or join the 2027 bridal waitlist.
gallery:
  - src: ../../assets/projects/grace-mae-alterations/bustle-explorer.png
    alt: Bustle explorer showing a white gown from the back and side, with gold arrows tracing where the train is lifted, and controls for bustle style and train length.
    caption: The bustle explorer. Pick a style and a train, then press "Bustle it" to watch the pickup points travel.
metrics:
  - { label: Lighthouse accessibility, value: "100" }
  - { label: Commits, value: "106" }
  - { label: Fields the owner edits, value: "~435" }
client:
  name: Grace Mae Alterations
  kind: Bridal and tailoring studio, Pittsburgh, PA
  permission: true
---

## Context

The site had three jobs: explain bustles, timelines and fittings to brides before they walk in; collect inquiries with the details Grace needs to quote; and let her switch bridal booking between open and waitlist herself. Grace is my sister, a formally trained designer and a former lead alterations specialist at David's Bridal, now running her own studio in Pittsburgh.

## Approach

**Explain with drawings.** The bustle explorer is an animated gown drawn in SVG. Pick American, French, Austrian, ballroom or a detachable train, pick a sweep, chapel or cathedral length, then scrub or press "Bustle it" to watch the pickup points travel along gold arrows in back and side views. A matching hem explorer shows trouser breaks across shoes and leg cuts. Both have accessible names and step-by-step captions, and both hold still under reduced motion.

**A thread you can follow.** The process section is a hand-authored cubic SVG path. A running stitch follows the scroll with a needle leading it, and each step's dot fills as the thread passes.

**Inquiries that arrive complete.** The contact form branches for tailoring, the bridal waitlist and bridal parties. Clients can attach up to five photos, compressed in the browser to stay under the server's upload limit, and an optional photo check tells them right away whether their pictures show what Grace needs. Resend emails Grace a formatted inquiry and sends the client a confirmation with prep instructions for their service.

**After the fitting.** Each finished dress can get a printable care card with a QR code that opens a private page: care notes, before and after photos, and how to bustle that exact dress.

**Owner-editable, and tested.** Sanity Studio is embedded at /studio with about 435 text fields generated from shared specs, and a test checks the specs, the site and the seed data never drift apart. CI runs lint, build, and 16 Playwright suites with axe accessibility checks on every push.

## Outcome

Lighthouse scores 100 for accessibility and SEO on every page I audited, and 97 to 99 for desktop performance. Structured data covers the business, the founder's credentials and priced services, with an image sitemap for the portfolio.

## What I'd do next

Mobile performance sits at 75 to 82, mostly from hero imagery and the Studio bundle. Next I'd split the Studio out of the main bundle and serve smaller hero crops to phones.
