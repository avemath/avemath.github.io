// Wide figures on narrow screens. A figure marked data-hscroll="<name>" keeps its drawing at full
// size on a phone (see [data-hscroll] in global.css) and scrolls sideways inside its frame instead
// of shrinking its labels below 13px. Only while it really overflows does the frame become a
// focusable, labelled region with a visible hint, so wide screens get no extra tab stop.
export function initHScroll() {
  const frames = [...document.querySelectorAll<HTMLElement>('[data-hscroll]')];
  if (!frames.length) return;

  const update = (el: HTMLElement) => {
    const scrolls = el.scrollWidth > el.clientWidth + 1;
    el.toggleAttribute('data-scrolls', scrolls);
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
  for (const el of frames) {
    if (!(el.nextElementSibling instanceof HTMLElement && el.nextElementSibling.classList.contains('hscroll-hint'))) {
      const hint = document.createElement('p');
      hint.className = 'hscroll-hint';
      hint.setAttribute('aria-hidden', 'true');
      hint.textContent = 'Scroll sideways to see all of it.';
      el.after(hint);
    }
    ro.observe(el);
    update(el);
  }
}
