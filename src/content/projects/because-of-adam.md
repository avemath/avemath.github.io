---
title: Because of ADAM
short: becauseofadam.org
type: nonprofit
tags: [nonprofit, client-site]
featured: true
order: 2
period: { start: "2026-09" }
status: live
summary: The website for my family's drowning awareness nonprofit, built so a scared parent can find the facts fast and act on them tonight.
outcome: 30+ pages, every statistic sourced, and an editor my family runs on their own.
role: Co-founder of the organization. I designed and built the site, wrote the content plan, and set up the editor and publishing pipeline.
keywords: ["nonprofit", "drowning", "water safety", "family", "Pagefind", "Pages CMS"]
stack: [Astro, TypeScript, Pages CMS, Pagefind, GitHub Actions, GitHub Pages]
links:
  live: https://becauseofadam.org
  repo: https://github.com/avemath/BcofADAM
cover: ../../assets/projects/because-of-adam/desktop.png
mobile: ../../assets/projects/because-of-adam/mobile.png
coverAlt: Because of ADAM home page. A deep teal hero reads "Drowning is silent. We won't be." with buttons for five things to do tonight and Adam's story.
gallery:
  - src: ../../assets/projects/because-of-adam/layers-builder.png
    alt: An interactive top-down backyard. Six switches add a door alarm, pool fence, self-latching gate, pool alarm, safety cover and a Water Watcher, and each one draws a stop on the path from the back door to the pool.
    caption: The layers builder. Each switch draws one layer of protection into the yard.
  - src: ../../assets/projects/because-of-adam/water-safety.png
    alt: Water safety page header reading "No single layer is enough. Stack them."
    caption: Long-form pages use the same deep-water palette, from surface light down to the deep end.
metrics:
  - { label: Commits, value: "260" }
  - { label: Pages, value: "30+" }
  - { label: Hosting cost, value: "$0" }
client:
  name: Because of ADAM
  kind: 501(c)(3) nonprofit, Blair County, PA
  permission: true
---

## Context

On June 5, 2017, my little brother Adam drowned in our backyard pool. He was 14 months old, and the house was full of family. He survived. In 2020 my siblings and I turned what we learned into a nonprofit: Because of ADAM, Allies in the Drowning Awareness Movement.

For years the organization lived on a Facebook page. Facebook is good for events and bad for anything a parent needs to find again. We needed a home for the facts, one that would still be correct a year from now and that my family could keep up without me.

## My role

I co-founded the organization, and I designed and built the site end to end: content plan, brand, every page, the editor, and the publishing pipeline. The voice comes from 113 Facebook posts my mom wrote over nine years, so the site sounds like us.

## Approach

**Facts first, and every one sourced.** Drowning is the leading cause of death for kids ages 1 to 4, and parents don't believe it until they see the source. Every number on the site links to where it came from, and a monthly link check runs over the whole build so a dead source gets caught.

**Show, don't lecture.** The water safety page has a layers builder: a top-down backyard where each switch draws a door alarm, a fence, a gate, a pool alarm, a cover or a Water Watcher into the scene, and each one puts a stop on the path from the back door to the pool. Another component turns a statistic into a row of children with Adam among them. Everything respects reduced motion and works by keyboard.

**Tools people keep.** A Water Watcher pledge with a printable card, a printable home safety checklist, a flyer for daycares and doctors' offices, a quiz, and calendar files for every event.

**Built to be run by a family.** Content lives in plain files that Pages CMS edits through a friendly "Family Studio," so my parents and siblings can add an event or a news post without touching code. A post-build launch guard fails the build if a page still has a placeholder, missing alt text or a "family, please review" box, and a daily rebuild moves past events off the calendar on its own.

**Fast for free.** It's a static Astro site on GitHub Pages. A post-build step turns every uploaded photo into AVIF and WebP at several sizes, and Pagefind gives the site full-text search with no server.

## Outcome

The site is live at becauseofadam.org, and my family is reviewing the last few pages before we announce it. It has more than 30 pages, costs nothing to host, and the people who run the organization can update it themselves.

## What I'd do next

Announce it publicly, connect a donation provider, and track pledge sign-ups so we can see whether the site changes what families do.
