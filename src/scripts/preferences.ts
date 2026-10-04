// Theme and motion preferences. The initial values are applied by an inline
// script in the <head> before first paint; this module handles changes.

type Theme = 'light' | 'dark';

const root = document.documentElement;

function store(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the choice just won't persist.
  }
}

export const currentTheme = (): Theme => (root.dataset.theme === 'dark' ? 'dark' : 'light');

export function setTheme(theme: Theme) {
  root.dataset.theme = theme;
  store('theme', theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b1220' : '#f6f8fb');
  window.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
}

export const toggleTheme = () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark');

/** True when the visitor asked for less motion, in the OS or with the site toggle. */
export const prefersReducedMotion = () =>
  root.dataset.motion === 'reduce' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function setReducedMotion(reduce: boolean) {
  if (reduce) root.dataset.motion = 'reduce';
  else delete root.dataset.motion;
  store('motion', reduce ? 'reduce' : null);
  syncMotionButtons();
  window.dispatchEvent(new CustomEvent('motionchange', { detail: reduce }));
}

export const toggleReducedMotion = () => setReducedMotion(root.dataset.motion !== 'reduce');

function syncMotionButtons() {
  const on = root.dataset.motion === 'reduce';
  document.querySelectorAll('[data-motion-toggle]').forEach((b) => b.setAttribute('aria-pressed', String(on)));
}

export function initPreferenceControls() {
  syncMotionButtons();
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-theme-toggle]')) toggleTheme();
    if (target.closest('[data-motion-toggle]')) toggleReducedMotion();
  });

  // Follow the OS theme live unless the visitor picked one here.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem('theme');
    } catch {}
    if (!saved) {
      root.dataset.theme = e.matches ? 'dark' : 'light';
      window.dispatchEvent(new CustomEvent('themechange', { detail: root.dataset.theme }));
    }
  });
}
