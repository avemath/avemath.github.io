---
title: Landspace
short: Landspace
type: software
tags: [software]
featured: true
order: 3
period: { start: "2025" }
status: live
summary: A local-first workspace for mineral title work that maps parcels, imports messy runsheets, and flags problems in the chain of title on its own.
outcome: The tool I wanted as a land agent, running on the web and the desktop.
role: Solo. I designed and built it from my own work as a land agent.
keywords: ["land", "title", "minerals", "map", "GIS", "runsheet", "Leaflet", "Electron", "local-first"]
stack: [React, Vite, Leaflet, Electron, IndexedDB, Supabase, Vercel]
links:
  live: https://landspace-app.vercel.app
cover: ../../assets/projects/landspace/overview.jpg
coverAlt: Landspace workspace. A satellite map with a parcel outlined in yellow sits beside a panel showing 159.8 mapped acres, 80 net mineral acres, the owner, the lease end date and two open title issues.
gallery:
  - src: ../../assets/projects/landspace/chain.png
    alt: Chain of title view with mineral and royalty lanes running from an 1853 patent through deeds and an affidavit of heirship, above two automatic checks for a missing probate and an unrecorded lease ratification.
    caption: Chain-of-title lanes from the patent forward. The checks above are computed, not typed in.
  - src: ../../assets/projects/landspace/import-review.png
    alt: Runsheet import review screen matching spreadsheet columns to record fields, with rejected rows listed with reasons.
    caption: Runsheet import guesses the header row and columns, then lets you review before anything is saved.
  - src: ../../assets/projects/landspace/ownership.png
    alt: Ownership calculator listing owners with fractional mineral interests and net mineral acres.
    caption: Interest math that reads fractions the way land people write them, like "1/8 of 8/8."
  - src: ../../assets/projects/landspace/offer.png
    alt: Lease offer check listing the terms of an offer and flags for a low royalty and missing clauses.
    caption: A lease offer check for owners, written in plain language and printable.
metrics:
  - { label: Commits, value: "110" }
  - { label: Instrument types, value: "~130" }
  - { label: Automated checks, value: "9 suites" }
---

## Context

Title work happens in spreadsheets, PDFs, county websites and someone's memory. A runsheet might have headers on row 4, book and page in one column as "Vol. 12, Pg. 34," and dates in three formats. The chain of title lives in your head until you draw it. I do this work as a land agent, and I wanted one place that held the map, the records and the problems together.

## My role

Solo. I designed and built all of it. The data model, import rules and title checks come from how I actually work a tract.

## Approach

**Import the runsheet you have, not the one you wish you had.** The importer scores the first 15 rows to find the header, matches columns through an alias table, splits combined book and page references, and parses messy dates. You review everything before it's saved, and rejected rows are listed with the reason. Mappings are remembered and every import can be undone.

**Let the data find the problems.** The chain-of-title view builds mineral, royalty and leasehold lanes from the patent forward. It flags gaps, over-conveyances, leases past their term with no release, estates with no probate or heirship instrument, and instruments that were never recorded. Flags are computed every time rather than stored, so they can't go stale, and any flag becomes a curative item in one click.

**Map it.** Leaflet with drawing tools, GeoJSON, KML and KMZ import, satellite and topo basemaps, PLSS overlays, and parcels colored by research status or lease expiration.

**Your data stays yours.** Landspace is local-first. Projects live in IndexedDB with versioned, additive migrations, so an old project always opens with nothing lost. The app asks the browser for persistent storage and reminds you to back up. Cloud sync through Supabase is optional and protected by row-level security, and the newer change wins on conflict. A desktop build wraps the same app in Electron with context isolation on.

**Tools for owners, too.** A lease offer check flags royalty below 3/16 and missing protective clauses, and a royalty check compares a check stub against the expected decimal.

## Outcome

Landspace runs on the web and as a desktop app, with a guided tour and a sample project. Its pure logic modules (import, chain analysis, interest math, deduplication, sync merge) each have their own test script.

## What I'd do next

OCR for scanned instruments, so a deed image can become a draft record, and shared projects for small land teams.
