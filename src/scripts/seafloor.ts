// Starts the Research page's seafloor. The page ships with a still image of the scene; three.js
// and the live scene (src/scripts/seafloor-scene.ts) load only when all of these hold:
//   - the browser has WebGL,
//   - motion is welcome (no reduced motion, from the system or the site's toggle),
//   - the scene is on or near the screen,
//   - the visitor has moved, scrolled, touched or pressed a key (a page nobody is using costs nothing).
// Otherwise the still stays. `?still` on the URL renders one fixed frame for render-assets.
import { prefersReducedMotion } from './preferences';

type Scene = { setAnimating(on: boolean): void; dispose(): void };

const hasWebGL = () => {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
};

export function mountSeafloor(host: HTMLElement) {
  const still = new URLSearchParams(location.search).has('still');
  if (still) {
    host.dataset.mode = 'still';
    import('./seafloor-scene').then(({ mountSeafloorScene }) => mountSeafloorScene(host, { still: true }));
    return;
  }
  if (!hasWebGL()) return;

  let scene: Scene | null = null;
  let loading = false;
  let near = false;
  let engaged = false;

  const live = (on: boolean) => {
    host.toggleAttribute('data-live', on);
    // Only a live scene takes focus: the arrow keys look around.
    if (on) host.tabIndex = 0;
    else host.removeAttribute('tabindex');
    host.setAttribute('aria-label', host.dataset[on ? 'labelLive' : 'labelStill']!);
  };

  const maybeStart = () => {
    if (!near || !engaged || prefersReducedMotion()) return;
    if (scene) {
      scene.setAnimating(true);
      live(true);
      return;
    }
    if (loading) return;
    loading = true;
    import('./seafloor-scene')
      .then(({ mountSeafloorScene }) => {
        scene = mountSeafloorScene(host);
        if (prefersReducedMotion()) scene.setAnimating(false);
        else requestAnimationFrame(() => live(true));
      })
      .catch(() => {
        // The still stays.
      });
  };

  new IntersectionObserver(
    ([e]) => {
      near = e.isIntersecting;
      maybeStart();
    },
    { rootMargin: '300px 0px' },
  ).observe(host);

  const engage = () => {
    engaged = true;
    maybeStart();
  };
  for (const ev of ['pointermove', 'pointerdown', 'scroll', 'keydown', 'touchstart']) addEventListener(ev, engage, { once: true, passive: true });

  // Reduced motion turned on while the page is open: back to the still.
  window.addEventListener('motionchange', () => {
    if (prefersReducedMotion()) {
      scene?.setAnimating(false);
      live(false);
    } else maybeStart();
  });
}
