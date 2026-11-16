// Wide figures on narrow screens. A figure marked data-hscroll="<name>" keeps its drawing at full
// size on a phone (see [data-hscroll] in global.css) and scrolls sideways inside its frame instead
// of shrinking its labels below 13px. Only while it really overflows does the frame become a
// focusable, labelled region with a visible hint, so wide screens get no extra tab stop.
export function initHScroll() {
  const frames = [...document.querySelectorAll<HTMLElement>('[data-hscroll]')];

  const update = (el: HTMLElement) => {
    // A frame in a hidden tab has no size yet. It starts out focusable, so the moment its tab opens
    // on a phone it can already be reached by keyboard; the observer settles it once it has a size.
    const scrolls = el.clientWidth === 0 || el.scrollWidth > el.clientWidth + 1;
    el.toggleAttribute('data-scrolls', scrolls && el.clientWidth > 0);
    if (scrolls) {
      el.tabIndex = 0;
      el.setAttribute('role', 'region');
      el.setAttribute('aria-label', `${el.dataset.hscroll}, scrolls sideways`);
    } else {
      el.removeAttribute('tabindex');
      el.removeAttribute('role');
      el.removeAttribute('aria-label');
    }
  };

  const ro = new ResizeObserver((entries) => entries.forEach((e) => update(e.target as HTMLElement)));
  const watch = (el: HTMLElement) => {
    if (!(el.nextElementSibling instanceof HTMLElement && el.nextElementSibling.classList.contains('hscroll-hint'))) {
      const hint = document.createElement('p');
      hint.className = 'hscroll-hint';
      hint.setAttribute('aria-hidden', 'true');
      hint.textContent = 'Scroll sideways to see all of it.';
      el.after(hint);
    }
    // The observer's first report sets it up, so starting up forces no layout of its own.
    ro.observe(el);
  };
  frames.forEach(watch);
  // A frame built later (a deferred tab view) is set up the moment it exists: focusable straight
  // away, as a frame in a hidden tab is at load, and the observer settles it once it has a size.
  document.addEventListener('panel:stamped', (e) =>
    (e.target as Element).querySelectorAll<HTMLElement>('[data-hscroll]').forEach((el) => {
      el.tabIndex = 0;
      el.setAttribute('role', 'region');
      el.setAttribute('aria-label', `${el.dataset.hscroll}, scrolls sideways`);
      watch(el);
    }),
  );
}
