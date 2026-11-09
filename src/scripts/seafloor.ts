// The Research page as one continuous scene. The seafloor is a fixed canvas behind the whole page;
// the page's scroll moves the camera down from the shallow rim to the deep basin, and the content
// sits in solid panels on top. Without WebGL, or with reduced motion, the page shows a still gradient
// from shallow green to deep with a still render at the top instead (src/components/research/
// Seafloor.astro).
//
// three.js and the live scene (src/scripts/seafloor-scene.ts) load only when the browser has WebGL,
// motion is welcome, and the visitor has moved, scrolled, touched or pressed a key, so a page nobody
// is using costs nothing. `?still&depth=0.3` renders one fixed frame for render-assets.
//
// Looking around: pointer down on open water (anywhere not in a panel, link, button or field) and
// drag. On touch, a horizontal swipe turns the view and a vertical swipe scrolls as usual. The arrow
// keys turn it too, from the focusable scene control in the first panel ([data-sea-keys]).
import { prefersReducedMotion } from './preferences';

type Scene = {
  setAnimating(on: boolean): void;
  setDepth(d: number): void;
  look(dyaw: number, dpitch: number): void;
  dispose(): void;
};

const hasWebGL = () => {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
};

/** Not open water: the panels and anything you can press or type in. */
const SOLID = '[data-rpanel], a, button, input, textarea, select, label, summary, [role="button"], [tabindex]:not([tabindex="-1"]), header, footer, .site-header';

export function mountSeafloor(host: HTMLElement) {
  const params = new URLSearchParams(location.search);
  if (params.has('still')) {
    host.dataset.mode = 'still';
    const depth = Number(params.get('depth') ?? 0);
    const pitch = params.has('pitch') ? Number(params.get('pitch')) : undefined;
    const noShafts = params.has('noshafts');
    import('./seafloor-scene').then(({ mountSeafloorScene }) => mountSeafloorScene(host, { still: true, depth, pitch, noShafts }));
    return;
  }
  if (!hasWebGL()) return;

  let scene: Scene | null = null;
  let loading = false;
  let engaged = false;
  const phone = () => innerWidth < 700;

  // Depth from the scroll: 0 at the top of the page, 1 at the bottom. The page height is read on
  // resize only.
  let maxScroll = 1;
  const measure = () => (maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight));
  const depth = () => Math.min(1, Math.max(0, scrollY / maxScroll));

  const live = (on: boolean) => {
    host.toggleAttribute('data-live', on);
    document.documentElement.toggleAttribute('data-sea-live', on);
  };

  const maybeStart = () => {
    if (!engaged || prefersReducedMotion()) return;
    if (scene) {
      scene.setAnimating(true);
      live(true);
      return;
    }
    if (loading) return;
    loading = true;
    measure();
    import('./seafloor-scene')
      .then(({ mountSeafloorScene }) => {
        scene = mountSeafloorScene(host, { scale: phone() ? 0.6 : 1 });
        scene.setDepth(depth());
        if (prefersReducedMotion()) scene.setAnimating(false);
        else requestAnimationFrame(() => live(true));
      })
      .catch(() => {
        // The still gradient stays.
      });
  };

  const engage = () => {
    engaged = true;
    maybeStart();
  };
  for (const ev of ['pointermove', 'pointerdown', 'scroll', 'keydown', 'touchstart']) addEventListener(ev, engage, { once: true, passive: true });

  addEventListener('scroll', () => scene?.setDepth(depth()), { passive: true });
  addEventListener('resize', () => {
    measure();
    scene?.setDepth(depth());
  });
  new ResizeObserver(measure).observe(document.body);

  // ---- Looking around ----
  let drag: { id: number; x: number; y: number; touch: boolean; turning: boolean | null } | null = null;
  document.addEventListener('pointerdown', (e) => {
    if (!scene || !host.hasAttribute('data-live') || e.button > 0) return;
    const t = e.target as Element | null;
    if (!t || t.closest(SOLID)) return;
    const touch = e.pointerType !== 'mouse';
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, touch, turning: touch ? null : true };
    if (!touch) {
      e.preventDefault(); // no text selection while dragging the view
      document.documentElement.setAttribute('data-sea-drag', '');
    }
  });
  document.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id || !scene) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (drag.turning === null) {
      // A touch decides once it has moved: sideways turns the view, up or down scrolls the page.
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      drag.turning = Math.abs(dx) > Math.abs(dy);
      if (!drag.turning) {
        drag = null;
        return;
      }
    }
    scene.look(-dx * 0.004, drag.touch ? 0 : dy * 0.003);
    drag.x = e.clientX;
    drag.y = e.clientY;
  });
  const end = (e: PointerEvent) => {
    if (drag && e.pointerId === drag.id) {
      drag = null;
      document.documentElement.removeAttribute('data-sea-drag');
    }
  };
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);

  document.querySelector<HTMLElement>('[data-sea-keys]')?.addEventListener('keydown', (e) => {
    const k = ({ ArrowLeft: [0.08, 0], ArrowRight: [-0.08, 0], ArrowUp: [0, 0.06], ArrowDown: [0, -0.06] } as Record<string, number[]>)[e.key];
    if (!k || !scene) return;
    e.preventDefault();
    scene.look(k[0], k[1]);
  });

  // Reduced motion turned on while the page is open: back to the still gradient.
  window.addEventListener('motionchange', () => {
    if (prefersReducedMotion()) {
      scene?.setAnimating(false);
      live(false);
    } else maybeStart();
  });
}
