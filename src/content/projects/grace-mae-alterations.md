---
title: Grace Mae Alterations
short: gracemaealterations.com
type: client-site
tags: [client-site, software]
featured: true
order: 8
period: { start: "2026-04", end: "2026-09" }
status: live
summary: A bridal alterations studio site with interactive guides that explain bustles and hems better than words can, and inquiry forms that arrive ready to quote.
# TODO(ave): check wording (Nov 16: the social card line, cut from the summary).
cardLine: A bridal alterations studio site with guides to bustles and hems.
outcome: PageSpeed Insights 100 for accessibility and search engine optimization (SEO), inquiries that arrive ready to quote, and about 435 fields the owner edits herself.
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
  - { label: PageSpeed accessibility, value: "100" }
  - { label: Fields the owner edits, value: "~435" }
client:
  name: Grace Mae Alterations
  kind: Bridal and tailoring studio, Pittsburgh, PA
  permission: true
threads: [web]
# TODO(ave): check wording (Nov 15: restructured for the business owner; the technical details moved to Under the hood).
---

## What Grace needed

Grace is my sister, a formally trained designer and a former lead alterations specialist at David's Bridal, now running her own studio in Pittsburgh. Her site had three jobs: explain bustles, timelines and fittings to brides before they walk in; collect inquiries with the details she needs to quote; and let her switch bridal booking between open and waitlist herself.

## What I built

**Guides that show instead of tell.** The bustle explorer is an animated gown. Pick American, French, Austrian, ballroom or a detachable train, pick a sweep, chapel or cathedral length, then press "Bustle it" to watch the pickup points travel in back and side views. A matching hem explorer shows trouser breaks across shoes and leg cuts.

**Inquiries that arrive complete.** The contact form changes with the request: tailoring, the bridal waitlist or a bridal party. Clients can attach up to five photos, and an optional photo check tells them right away whether their pictures show what Grace needs. Grace gets a formatted inquiry by email, and the client gets a confirmation with prep instructions for their service.

**After the fitting.** Each finished dress can get a printable care card with a QR code that opens a private page: care notes, before and after photos, and how to bustle that exact dress.

**A thread you can follow.** The steps of the process are stitched together: a running stitch follows the scroll with a needle leading it, and each step's dot fills as the thread passes.

## What changed for Grace

Inquiries arrive ready to quote, and Grace edits about 435 text fields of the site herself. PageSpeed Insights scores the home page 100 for accessibility and search engine optimization (SEO).

## Under the hood

- The stack: Next.js, React, TypeScript, Sanity, Tailwind CSS, Framer Motion, Resend, Playwright and Vercel.
- The bustle and hem explorers are drawn in Scalable Vector Graphics (SVG). Both have accessible names and step-by-step captions, and both hold still under reduced motion. The process thread is a hand-authored cubic SVG path.
- Photos are compressed in the browser to stay under the server's upload limit. Resend sends the emails.
- Sanity Studio is embedded at /studio, with the text fields generated from shared specs, and a test checks the specs, the site and the seed data never drift apart.
- CI runs lint, build, and 16 Playwright suites with axe accessibility checks on every push.
- Structured data covers the business, the founder's credentials and priced services, with an image sitemap for the portfolio.
- Mobile performance scored 98 on PageSpeed Insights on Nov 1, 2026, with 100 for accessibility, best practices and SEO; desktop scored 100 across the board. Earlier runs scored lower on mobile, mostly from the hero imagery and the Studio bundle.
