// A tiny JSX factory that builds SVG elements directly, so the Grace Mae bustle drawing (written
// for React) runs here unchanged. Components are called with their props; React's camelCase SVG
// props become the attributes they stand for.
type Child = Node | string | number | boolean | null | undefined | Child[];
type Props = Record<string, unknown> & { children?: Child };

const NS = 'http://www.w3.org/2000/svg';
const KEEP = new Set(['viewBox', 'markerWidth', 'markerHeight', 'refX', 'refY', 'patternUnits', 'patternTransform', 'gradientTransform', 'gradientUnits']);
const attr = (k: string) => (KEEP.has(k) ? k : k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`));

function append(parent: Node, child: Child) {
  if (child == null || child === false || child === true) return;
  if (Array.isArray(child)) child.forEach((c) => append(parent, c));
  else parent.appendChild(typeof child === 'object' ? child : document.createTextNode(String(child)));
}

export function Fragment({ children }: { children?: Child }) {
  const frag = document.createDocumentFragment();
  append(frag, children);
  return frag;
}

export function h(type: string | ((p: any) => Node | null), props: Props | null, ...children: Child[]): Node | null {
  const p = { ...(props ?? {}) };
  if (children.length) p.children = children.length === 1 ? children[0] : children;
  if (typeof type === 'function') return type(p);
  const el = document.createElementNS(NS, type);
  for (const [k, v] of Object.entries(p)) {
    if (k === 'children' || k === 'key' || v == null || v === false) continue;
    el.setAttribute(attr(k), String(v));
  }
  append(el, p.children);
  return el;
}
