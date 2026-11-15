---
title: Petro Land Ventures
short: plvinc.com
type: client-site
tags: [client-site]
featured: true
order: 7
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
  - { label: Service pages, value: "6" }
  - { label: Regions mapped, value: "5" }
client:
  name: Petro Land Ventures, Inc.
  kind: Land services firm, Duncansville, PA
  permission: true
threads: [web, land]
# TODO(ave): check wording (Nov 15: restructured for the business owner; the technical details moved to Under the hood).
---

## What the firm needed

A lot of the people who find Petro Land Ventures are landowners and heirs holding a letter about minerals they didn't know they owned. The firm's clients are energy companies. It does title research, leasing and due diligence across the Appalachian, Gulf Coast, Permian and Michigan basins, plus solar and wind land work in the Pacific Northwest.

Those two visitors want completely different things. I also do contract land work for the firm, so I knew the questions both sides ask.

## What I built

**Two doors from the first screen.** The hero offers "I own land or minerals" and "I represent a company," and each path leads to pages written for that reader. The contact form branches the same way: a short form for landowners and a project form for companies.

**Show the work.** A sample work page walks through fictional versions of real deliverables (an ownership report, a runsheet, a lease acquisition report, an ownership tree) with numbered reader's notes. Clients can judge the quality before they pick up the phone.

**A coverage map.** Six service pages and a map of where the firm works, across five regions. A state can belong to more than one basin, and the map works from the keyboard as well as the mouse.

**A site the owners edit.** The owners edit the site themselves. Saving rebuilds the site in a minute or two, I wrote a plain-English editing guide for every page, and sections hide themselves when their content is empty, so nothing ever shows up half-finished.

## What changed for the firm

Two audiences, one site, and an owner who edits it without me. The site is live at plvinc.com.

## Under the hood

- The stack: Astro, Sveltia CMS, Cloudflare Pages, Cloudflare Workers, Web3Forms and GitHub Actions.
- Sveltia CMS sits at /studio behind GitHub sign-in through a small Cloudflare Worker.
- The coverage map is hand-built Scalable Vector Graphics (SVG). The basin tabs are a proper Accessible Rich Internet Applications (ARIA) tablist with arrow, Home and End keys, and each state is a focusable button.
- Scroll reveals stagger by visual row so a grid animates left to right whatever the Document Object Model (DOM) order, and the hiding class is only added by JavaScript so no-JS visitors still get the whole page. Count-up stats keep the final number in the HyperText Markup Language (HTML) and hide the animation from screen readers.
- Photos are washed and compressed at build time from 6 MB of originals down to about 160 KB.
- Structured data for search: ProfessionalService, Person with credentials, FAQPage.
- When a leftover Cloudflare Worker custom domain hijacked the hostname, I traced it, fixed it, and added a read-only "domain doctor" workflow that audits DNS, routes and cache settings on demand.

## What I'd do next

Turn on the Insights section with a few articles landowners actually search for, like what a lease offer letter means, and measure which door visitors choose.
