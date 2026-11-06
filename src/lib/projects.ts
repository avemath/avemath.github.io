import { getCollection, type CollectionEntry } from 'astro:content';

export type Project = CollectionEntry<'projects'>;
export type ProjectType = Project['data']['type'];

export const typeLabels: Record<ProjectType, string> = {
  research: 'Research',
  engineering: 'Engineering',
  'client-site': 'Client site',
  software: 'Software',
  nonprofit: 'Nonprofit',
};

export const statusLabels: Record<Project['data']['status'], string> = {
  live: 'Live',
  ongoing: 'Ongoing',
  complete: 'Complete',
  archived: 'Archived',
};

/** All published projects, ordered by `order` and then newest first. */
export async function getProjects(): Promise<Project[]> {
  const all = await getCollection('projects', ({ data }) => !data.draft);
  return all.sort(
    (a, b) => a.data.order - b.data.order || b.data.period.start.localeCompare(a.data.period.start),
  );
}

export const isWebsite = (p: Project) => p.data.type === 'client-site' || p.data.tags.includes('client-site');

export const projectHref = (p: Project) => `/work/${p.id}/`;

/** Every tag a project carries, including its main type, without repeats. */
export const allTags = (p: Project) => [...new Set([p.data.type, ...p.data.tags])];

// ---- The /work/ page: three sections, in this order, and the order prev/next follow ----
export type WorkSection = 'engineering' | 'research' | 'websites';
export const workSections: { id: WorkSection; label: string; intro: string }[] = [
  { id: 'engineering', label: 'Engineering', intro: 'Hardware, radio and software I built, most with something you can run in the browser.' },
  { id: 'research', label: 'Research', intro: 'The research side: sponsored work, described in public wording only, and one question of my own.' },
  { id: 'websites', label: 'Websites and client tools', intro: 'Sites I built for small businesses, a nonprofit and a senior in mechanical engineering at LSU, each still live, and tools I built for two small businesses.' },
];
// Tools built for a client's business are filed with the websites, not with engineering.
const clientTools = new Set(['little-explorer-swim', 'plv-abstract-builder']);
export const workSection = (p: Project): WorkSection =>
  isWebsite(p) || clientTools.has(p.id) ? 'websites' : p.data.type === 'research' ? 'research' : 'engineering';

/** Every project in /work/ order: engineering, then research, then websites. */
export async function getWorkOrder() {
  const all = await getProjects();
  return workSections.flatMap((s) => all.filter((p) => workSection(p) === s.id));
}

/** Where each project's schematic drawing is: a hash naming its tab panel opens that tab. */
export const drawings: Record<string, string> = {
  rampage: '/#rampage-drawing',
  'v2v-bsm-ofdm': '/#v2v-drawing',
  'led-audio-spectrum': '/#led-drawing',
  'signals-playground': '/#sig-drawing',
  'bellhop-sim': '/research/#r2-drawing',
  'acoustic-pool-alarm': '/research/#pool-alarm',
};

/** What a project's card offers, as links: a live version, its drawing, its code. */
export function offers(p: Project) {
  const out: { label: string; href: string }[] = [];
  if (p.data.demo) out.push({ label: 'Live', href: `${projectHref(p)}#demo` });
  else if (p.data.links.live) out.push({ label: 'Live', href: p.data.links.live });
  if (drawings[p.id]) out.push({ label: 'Drawing', href: drawings[p.id] });
  if (p.data.links.repo && p.data.confidentiality !== 'limited') out.push({ label: 'Code', href: p.data.links.repo });
  return out;
}
