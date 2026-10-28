---
title: PLV Abstract Builder
short: Abstract Builder
type: software
tags: [software, client-site]
featured: false
order: 7
period: { start: "2026-10" }
status: live
summary: A private tool that turns a parcel's recorded documents into a run sheet, an Ownership Report and one finished abstract PDF with every document attached and linked.
outcome: A stack of county records becomes a linked abstract in six steps, with the examiner checking every row.
role: Design, build, tests and deployment.
keywords: ["land", "title", "abstract", "run sheet", "ownership report", "OCR", "PDF", "oil and gas"]
stack: [JavaScript, pdf.js, pdf-lib, Tesseract OCR, docx, IndexedDB, Cloudflare Workers, Cloudflare Access, Playwright]
coverAlt: Drawing of a stack of documents, then a run sheet grid with check marks, then a finished abstract whose references are boxed as links.
gallery:
  - src: ../../assets/projects/plv-abstract-builder/run-sheet.png
    alt: The run sheet step. A table lists six documents with grantor, grantee, book and page, type and status, above a check asking about a pipeline right of way. The document's scanned page shows on the right.
    caption: The run sheet. One row per document in the firm's wording, with chain checks marked by how serious they are.
  - src: ../../assets/projects/plv-abstract-builder/documents.png
    alt: The documents step with five PDFs named by book and page. County and state are filled in, with a note that they came from a vote of the documents.
    caption: Drop the parcel's PDFs. County and state are filled by a vote of the documents, and a scan with no text is read in the browser.
  - src: ../../assets/projects/plv-abstract-builder/read-results.png
    alt: The read step. An open-end mortgage's fields (type, dates, book, page, instrument number, grantors, grantee, acres, county) sit beside the document's page.
    caption: Each document becomes a card of fields to confirm, next to the page it came from.
  - src: ../../assets/projects/plv-abstract-builder/ownership-report.png
    alt: The Ownership Report form, with sections for unreleased leases, easements, unreleased mortgages, judgments and a disclaimer. The mortgage line has a DATE placeholder in brackets.
    caption: The report form is prefilled from the rows. A gap stays a placeholder like [DATE] instead of a guess.
  - src: ../../assets/projects/plv-abstract-builder/report-pages.png
    alt: The printed Ownership Report page with the tax parcel ID, the examination period and the tract description.
    caption: The Pages view shows the report as it will print.
  - src: ../../assets/projects/plv-abstract-builder/finished-abstract.png
    alt: The build step, with a confirmation checkbox and buttons to build the linked PDF, preview pages, download a Word copy and file as final. A message says the practice abstract was built with 5 attachments and 14 links.
    caption: The build. The examiner confirms they checked every row, then one PDF comes out with the documents attached and linked.
metrics:
  - { label: Version, value: "0.3" }
  - { label: Unit test checks, value: "950" }
  - { label: Browser test files, value: "126" }
  - { label: Practice tour cards, value: "39" }
client:
  name: Petro Land Ventures, Inc.
  kind: Land services firm, Duncansville, PA
  permission: true
---

## Context

A land abstract is slow, manual work, and it's easy to get wrong. Someone pulls every recorded deed, mortgage, lease and easement for a parcel, types each one into a run sheet, writes the Ownership Report, then assembles a PDF where every book and page reference opens its document. [Petro Land Ventures](/work/petro-land-ventures/) needed a faster way to go from a stack of county records to a finished abstract, built the way their abstracts already are. I also do contract land work for the firm, and I'd already built [Landspace](/work/landspace/) for my own title work, so I knew the steps.

## Approach

**Six steps, and a person checks each one.** Documents, Read, Run sheet, Ownership Report, Links and Build sit on a rail on the left. The tool does the first draft; the examiner confirms every row, and the build won't run until they tick a box saying they checked each row against its document. A gap in the report stays a placeholder such as [DATE] instead of a guess.

**Everything runs in the browser.** PDF reading, OCR for scans with no text layer, the run sheet checks, the report, Excel and Word output, and the linked PDF are all built on the person's computer. Jobs live in the browser's own storage, with no cloud copy.

**One optional step leaves the computer.** An optional AI reading step can turn each document into fields. It's off every time the page opens. When it's on, a small server passes each document through and stores nothing, and its logs never include names, file names or document text. With it off, the server is never called.

**A login in front of everything.** The whole site sits behind a login with a one-time code sent to an approved email address, and the list of who can sign in changes without a code change.

**A free practice tour.** A 39-card tour walks a practice job of five made-up documents through all six steps. Each document shows one feature, like a blank date line or an upside-down scan to turn, and nothing is sent or saved while it's open. The screenshots here use that practice job, so every name and record in them is made up.

**Tests on fictional documents.** 41 unit test files with 950 checks, and 126 browser test files that replay recorded reads of 12 fictional documents, so the tests never spend anything or touch a real record.

## Outcome

It's live at a private address behind the login. It produces the Excel run sheet, the Ownership Report as PDF and Word, and one abstract PDF with every document attached and linked. A second mode adds the attachments and links to an abstract that was already finished in Word.
