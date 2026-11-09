// The figure viewer for a case study's plots (on /work/v2v-bsm-ofdm/, the real MATLAB output from
// Run 4). It gathers every image written in the Markdown (`<p><img></p>`) with the italic caption
// after it, and shows them one at a time, large, where the first one was: Previous and Next, a strip
// of thumbnails, the arrow keys, a swipe on touch, and a click that opens the figure full screen in a
// dialog (Escape closes it). Each figure keeps its caption. Where a figure used to sit in the text,
// a small button shows it in the viewer, so every step still points at its own plot.
// Without JavaScript the figures stay in the text as written.

type Slide = { src: string; alt: string; w: number; h: number; cap: string; label: string };

export function mountFigureViewer(prose: HTMLElement) {
  const imgs = [...prose.querySelectorAll<HTMLImageElement>(':scope > p > img:only-child')];
  if (imgs.length < 2) return;
  const slides: Slide[] = [];
  const spots: HTMLElement[] = [];
  for (const img of imgs) {
    const p = img.parentElement!;
    const capEl = p.nextElementSibling as HTMLElement | null;
    const isCap = !!capEl && capEl.tagName === 'P' && capEl.firstElementChild?.tagName === 'EM' && capEl.firstChild === capEl.firstElementChild;
    const label = isCap ? capEl!.firstElementChild!.textContent!.trim().replace(/\.$/, '') : img.alt;
    slides.push({ src: img.currentSrc || img.src, alt: img.alt, w: Number(img.getAttribute('width')) || img.naturalWidth, h: Number(img.getAttribute('height')) || img.naturalHeight, cap: isCap ? capEl!.innerHTML : '', label });
    spots.push(p);
    if (isCap) capEl!.remove();
  }

  // The viewer, where the first figure was.
  const root = document.createElement('section');
  root.className = 'fv';
    root.setAttribute('aria-roledescription', 'carousel');
  root.setAttribute('aria-label', `Figures, ${slides.length} in all`);
  root.dataset.fv = '';
  root.innerHTML = `
    <div class="fv__stage">
      <button type="button" class="fv__nav fv__nav--prev" data-fv-prev aria-label="Previous figure"><span aria-hidden="true">‹</span></button>
      <button type="button" class="fv__open" data-fv-open><img data-fv-img alt="" decoding="async" /></button>
      <button type="button" class="fv__nav fv__nav--next" data-fv-next aria-label="Next figure"><span aria-hidden="true">›</span></button>
    </div>
    <p class="fv__cap"><span class="fv__count mono" data-fv-count></span> <span data-fv-cap></span></p>
    <p class="fv__hint">Arrow keys or swipe to move between figures. Click a figure to open it full screen.</p>
    <div class="fv__thumbs" role="group" aria-label="All figures" data-fv-thumbs></div>
    <dialog class="fv__full" data-fv-dialog aria-label="Figure, full screen">
      <form method="dialog" class="fv__full-bar">
        <span class="mono" data-fv-full-count></span>
        <button type="button" class="btn btn--small" data-fv-full-prev>Previous</button>
        <button type="button" class="btn btn--small" data-fv-full-next>Next</button>
        <button class="btn btn--small" data-fv-close>Close</button>
      </form>
      <img data-fv-full-img alt="" />
      <p class="fv__full-cap" data-fv-full-cap></p>
    </dialog>`;
  spots[0].replaceWith(root);
  const $ = <T extends Element>(s: string) => root.querySelector<T>(s)!;
  const img = $<HTMLImageElement>('[data-fv-img]');
  const count = $<HTMLElement>('[data-fv-count]');
  const cap = $<HTMLElement>('[data-fv-cap]');
  const thumbs = $<HTMLElement>('[data-fv-thumbs]');
  const open = $<HTMLButtonElement>('[data-fv-open]');
  const dialog = $<HTMLDialogElement>('[data-fv-dialog]');
  const fullImg = $<HTMLImageElement>('[data-fv-full-img]');
  const fullCap = $<HTMLElement>('[data-fv-full-cap]');
  const fullCount = $<HTMLElement>('[data-fv-full-count]');

  const thumbBtns = slides.map((s, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fv__thumb';
    b.setAttribute('aria-label', `Show ${s.label}`);
    b.innerHTML = `<img src="${s.src}" alt="" loading="lazy" decoding="async" width="${s.w}" height="${s.h}" />`;
    b.addEventListener('click', () => show(i));
    thumbs.append(b);
    return b;
  });

  // In the text, a button where each later figure used to be.
  spots.slice(1).forEach((p, k) => {
    const i = k + 1;
    const jump = document.createElement('p');
    jump.className = 'fv-jump';
    jump.innerHTML = `<button type="button" class="link">Show ${slides[i].label} in the figure viewer</button>`;
    jump.querySelector('button')!.addEventListener('click', () => {
      show(i);
      root.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      open.focus({ preventScroll: true });
    });
    p.replaceWith(jump);
  });

  let current = 0;
  function show(i: number) {
    current = (i + slides.length) % slides.length;
    const s = slides[current];
    img.src = s.src;
    img.alt = s.alt;
    img.width = s.w;
    img.height = s.h;
    count.textContent = `${current + 1} of ${slides.length}`;
    cap.innerHTML = s.cap || s.alt;
    open.setAttribute('aria-label', `${s.label}: open full screen`);
    root.dataset.index = String(current);
    thumbBtns.forEach((b, j) => b.toggleAttribute('aria-current', j === current));
    thumbBtns[current].scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (dialog.open) fillFull();
  }
  function fillFull() {
    const s = slides[current];
    fullImg.src = s.src;
    fullImg.alt = s.alt;
    fullCap.innerHTML = s.cap || s.alt;
    fullCount.textContent = `${current + 1} of ${slides.length}`;
  }

  $<HTMLButtonElement>('[data-fv-prev]').addEventListener('click', () => show(current - 1));
  $<HTMLButtonElement>('[data-fv-next]').addEventListener('click', () => show(current + 1));
  $<HTMLButtonElement>('[data-fv-full-prev]').addEventListener('click', () => show(current - 1));
  $<HTMLButtonElement>('[data-fv-full-next]').addEventListener('click', () => show(current + 1));
  open.addEventListener('click', () => {
    fillFull();
    dialog.showModal();
  });
  dialog.addEventListener('close', () => open.focus());

  // Arrow keys, anywhere in the viewer (and in the full-screen dialog).
  const keys = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') show(current - 1);
    else if (e.key === 'ArrowRight') show(current + 1);
    else return;
    e.preventDefault();
  };
  root.addEventListener('keydown', keys);

  // A sideways swipe on the figure.
  let sx = 0;
  let sy = 0;
  let touching = false;
  const stage = $<HTMLElement>('.fv__stage');
  stage.addEventListener('touchstart', (e) => {
    touching = true;
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
  }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (!touching) return;
    touching = false;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) show(current + (dx < 0 ? 1 : -1));
  });

  show(0);
}
