---
title: Little Explorer Swim Intake and Reports
short: Swim intake system
type: software
tags: [software]
featured: false
order: 12
period: { start: "2026-06" }
status: live
summary: A daily health intake and auto-generated lesson reports for my dad's Infant Swimming Resource instruction business, built entirely on free Google tools.
# TODO(ave): check wording (Nov 16: the social card line, cut from the summary).
cardLine: A daily health intake and auto-generated lesson reports.
outcome: Replaced a paper weekly interview sheet with forms and reports that fill themselves in.
role: Solo. I designed the form, wrote the Apps Script, and wrote the instructor's one-page guide.
keywords: ["swim", "ISR", "forms", "Apps Script", "Google Sheets", "reports", "intake"]
stack: [Google Apps Script, Google Forms, Google Sheets, Google Drive]
threads: [family, web]
# TODO(ave): check wording (Nov 15: restructured for the business owner; the technical details moved to Under the hood).
---

## What Little Explorer Swim needed

Infant Swimming Resource (ISR) lessons start with a check-in on how the child ate, slept and felt that day, because it changes what's safe in the water. My dad became an ISR instructor and a Red Cross CPR instructor in 2020, after my little brother's accident. My dad's ISR business, Little Explorer Swim, tracked that on a paper weekly interview sheet. Paper gets lost, it's hard to read across weeks, and it can't be in two places at once.

## What I built

**A form each family fills in.** Each family gets a personal form link with their child's name already filled in, so there are no typos to reconcile later.

**A control panel anyone can run.** One tab in the sheet is the whole interface. Adding a child is typing a name and picking Active. Archiving is picking Archived, and the report moves to an archive folder without anything being deleted.

**Reports that look like the paper.** One landscape PDF per child, grouped into the same sections as the original sheet (bowel and urine, diet, sleep, activity, health and notes), with one dated column per session.

**A guide, not code.** I wrote a plain-language, one-page guide so the instructor never has to touch code.

## What changed for the business

The paper weekly interview sheet is gone: forms and reports fill themselves in, and everything stays current on its own.

## Privacy

This system handles children's health information, so it was designed around keeping that data out of reach. Real data lives only in the instructor's private Google account. The repository holds code and docs only, ships with a placeholder form ID, and ignores data file types by default. There are no screenshots here on purpose.

## Under the hood

- Google Forms, Google Sheets and Google Drive, tied together with Google Apps Script, all free Google tools.
- The control panel is the sheet's Children tab. Apps Script builds the PDFs.
- Three triggers keep everything current: one on each form submission, one on sheet edits, and a nightly refresh. They all run under the owner's account, so the instructor never has to authorize anything.

## What I'd do next

A short weekly summary for parents, generated from the same responses.
