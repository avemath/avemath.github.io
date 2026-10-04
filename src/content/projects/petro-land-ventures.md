---
title: Petro Land Ventures
short: plvinc.com
type: client-site
tags: [client-site]
featured: true
order: 4
period: { start: "2026-06", end: "2026-09" }
status: live
summary: A site for a two-person firm of Certified Professional Landmen that speaks to oil companies and confused landowners at the same time.
outcome: Two audiences, one site, and an owner who edits it without me.
role: Design, build, content structure, CMS, hosting and DNS.
keywords: ["landmen", "oil and gas", "minerals", "Cloudflare", "Sveltia", "coverage map"]
stack: [Astro, Sveltia CMS, Cloudflare Pages, Cloudflare Workers, Web3Forms, GitHub Actions]
links:
  live: https://plvinc.com
  repo: https://github.com/avemath/plvinc
cover: ../../assets/projects/petro-land-ventures/desktop.png
mobile: ../../assets/projects/petro-land-ventures/mobile.png
coverAlt: Petro Land Ventures home page. Over a photo of a desk with mapping monitors, the headline reads "Know who owns it, what the record shows, and where the risk sits."
gallery:
  - src: ../../assets/projects/petro-land-ventures/coverage-map.png
    alt: Interactive US coverage map with basin tabs. Appalachian Basin is selected, highlighting Pennsylvania, Ohio and Tennessee, with the plays worked listed beside it.
    caption: The coverage map. States can belong to several basins, and the tabs work by arrow keys.
  - src: ../../assets/projects/petro-land-ventures/sample-work.png
    alt: Sample work page showing an annotated mineral ownership report built from fictional data.
    caption: Annotated sample deliverables, so a client can see the work before they call.
metrics:
  - { label: Commits, value: "119" }
  - { label: Service pages, value: "6" }
  - { label: Basins mapped, value: "5" }
client:
  name: Petro Land Ventures, Inc.
  kind: Land services firm, Duncansville, PA
  permission: true
---

## Context

A lot of the people who find Petro Land Ventures are landowners and heirs holding a letter about minerals they didn't know they owned. The firm's clients are energy companies. It does title research, leasing and due diligence across the Appalachian, Gulf Coast, Permian and Michigan basins.

Those two visitors want completely different things. I also do contract land work for the firm, so I knew the questions both sides ask.

## My role

Everything: design, build, content structure, the editor, Cloudflare hosting and DNS. 119 commits from June to September 2026.

## Approach

**Two doors from the first screen.** The hero offers "I own land or minerals" and "I represent a company," and each path leads to pages written for that reader. The contact form branches the same way: a short form for landowners and a project form for companies.

**Show the work.** A sample work page walks through fictional versions of real deliverables (an ownership report, a runsheet, a lease acquisition report, an ownership tree) with numbered reader's notes. Clients can judge the quality before they pick up the phone.

**A map that respects the keyboard.** The coverage map is hand-built SVG. A state can belong to more than one basin, the basin tabs are a proper ARIA tablist with arrow, Home and End keys, and each state is a focusable button.

**Details that don't show.** Scroll reveals stagger by visual row so a grid animates left to right whatever the DOM order, and the hiding class is only added by JavaScript so no-JS visitors still get the whole page. Count-up stats keep the final number in the HTML and hide the animation from screen readers. Photos are washed and compressed at build time from 6 MB of originals down to about 160 KB.

**Owner-editable.** Sveltia CMS sits at /studio behind GitHub sign-in through a small Cloudflare Worker. Saving rebuilds the site in a minute or two, and I wrote a plain-English editing guide for every page. Sections hide themselves when their content is empty, so nothing ever shows up half-finished.

## Outcome

The site is live at plvinc.com with six service pages, structured data for search (ProfessionalService, Person with credentials, FAQPage), and a coverage map across five regions. When a leftover Cloudflare Worker custom domain hijacked the hostname, I traced it, fixed it, and added a read-only "domain doctor" workflow that audits DNS, routes and cache settings on demand.

## What I'd do next

Turn on the Insights section with a few articles landowners actually search for, like what a lease offer letter means, and measure which door visitors choose.
