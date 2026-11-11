// Run work after the page has loaded and the browser has a quiet moment, so it never competes with
// the first paint. Falls back to a short timeout where requestIdleCallback is missing (Safari).
export function afterLoadIdle(fn: () => void, timeout = 2000) {
  const idle = () => ('requestIdleCallback' in window ? requestIdleCallback(() => fn(), { timeout }) : setTimeout(fn, 200));
  if (document.readyState === 'complete') idle();
  else addEventListener('load', idle, { once: true });
}

// Run `fn` once `el` comes within `margin` of the screen, in the browser's next quiet moment.
// Nothing is set up, drawn or measured for a part of the page nobody has scrolled near yet.
export function whenNear(el: Element, fn: () => void, margin = '400px') {
  const run = () => ('requestIdleCallback' in window ? requestIdleCallback(() => fn(), { timeout: 600 }) : setTimeout(fn, 50));
  if (!('IntersectionObserver' in window)) return run();
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      run();
    },
    { rootMargin: `${margin} 0px` },
  );
  io.observe(el);
}
