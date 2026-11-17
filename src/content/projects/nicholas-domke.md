---
title: Nicholas Domke
short: Nicholas's portfolio
type: client-site
tags: [client-site]
featured: false
order: 9
period: { start: "2026-10" }
status: live
summary: A portfolio and long-form résumé for a senior in mechanical engineering at LSU, styled like an engineering drawing, with a 3D model from his real computer-aided design (CAD) files.
# TODO(ave): check wording (Nov 16: the social card line, cut from the summary).
cardLine: A portfolio and résumé styled like an engineering drawing.
outcome: A portfolio drawn like an engineering sheet, with no build step and one file to edit.
role: Design, build, content, 3D model pipeline, hosting.
keywords: ["mechanical engineering", "portfolio", "three.js", "CAD", "dot matrix", "LSU"]
stack: [HTML, CSS, JavaScript, three.js, GitHub Pages]
links:
  # Once the repo moves to Nicholas's GitHub, update the live link; the label can stay.
  live: https://nmdomke.github.io/
linkLabel: Visit Nicholas's site
cover: ../../assets/projects/nicholas-domke/desktop.png
mobile: ../../assets/projects/nicholas-domke/mobile.png
coverAlt: Nicholas Domke's home page. A black hero with a faint dot grid shows his name in large dot-matrix letters, a one-line tagline, and buttons to email him, open LinkedIn, or get his résumé.
gallery:
  - src: ../../assets/projects/nicholas-domke/welding-arm.png
    alt: The mock welding robotic arm project card. On the left, a line-drawn 3D model of the arm with the end effector shaded blue; on the right, the project description, bullets and tool tags.
    caption: The welding arm card. The 3D model comes from his CAD, and hovering pulls the end effector apart like an exploded view.
  - src: ../../assets/projects/nicholas-domke/resume.png
    alt: The top of the résumé page, a black-on-white serif document with his name, location, email and links, then his LSU education, minors, coursework and graduate study plans, under Print and Download PDF buttons.
    caption: The printable résumé page, built from the same data file as the main page. The contact line has no phone number.
  - src: ../../assets/projects/nicholas-domke/title-block.png
    alt: The footer drawn as an engineering title block, with cells for title, engineer, discipline, date, scale, units, sheet and revision letter D.
    caption: The footer is a drawing title block. The revision letter goes up with each real update.
metrics:
  - { label: 3D model file, value: "174 KB" }
  - { label: Build step, value: "None" }
client:
  name: Nicholas Domke
  kind: Portfolio for a senior in mechanical engineering at LSU
  permission: true
draft: false
threads: [web]
# TODO(ave): check wording (Nov 15: restructured for the reader; the technical details moved to Under the hood).
---

## What Nicholas needed

Nicholas is a senior in mechanical engineering at LSU applying to graduate programs for fall 2027. He needed a portfolio and a long-form résumé to send with his applications. I did the design, build and content, and I host it.

## What I built

**A portfolio drawn like an engineering sheet.** Dot-matrix lettering, a black hero, and grey sections with a faint dot grid like a drafting table, where the cards sit like sheets of paper. The footer is a title block with a revision letter. A gear in the top bar turns as you scroll, and the bar shows which section you're in, like a sheet label. On a computer, the pointer in the hero becomes a crosshair that snaps to the dot grid and shows its coordinates in inches.

**His real CAD.** The welding arm card shows a 3D model made from his own design files, drawn in the same line style. Hovering (or tapping on a phone) pulls the tool at the end of the arm apart like an assembly drawing.

**One file to edit.** Every word and link lives in one file that Nicholas can edit on github.com, and a saved edit is live in about a minute.

**A résumé that prints.** The résumé page is built from the same words and styled like his PDF, so it prints cleanly. It leaves his phone number off on purpose, since the repo is public.

## What changed for Nicholas

He has a portfolio drawn like an engineering sheet to send with his applications, with no build step and one file to edit.

## Under the hood

- Plain HTML, CSS and JavaScript on GitHub Pages, with no build step. The words and links live in content.js.
- The look is based on nothing.tech.
- The 3D model is converted from his CAD files: a 174 KB model shown with three.js, which only loads when the card is about to scroll into view. Hovering explodes the end effector, and if a browser can't show 3D, the card keeps its line drawing.

## What I'd do next

Move the repo to Nicholas's GitHub account, and add photos of his lab work as he sends them.
