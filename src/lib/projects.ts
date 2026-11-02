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
  { id: 'websites', label: 'Websites', intro: 'Sites I built for small businesses, a nonprofit and one engineer, each still live.' },
];
export const workSection = (p: Project): WorkSection => (isWebsite(p) ? 'websites' : p.data.type === 'research' ? 'research' : 'engineering');

/** Every project in /work/ order: engineering, then research, then websites. */
export async function getWorkOrder() {
  const all = await getProjects();
  return workSections.flatMap((s) => all.filter((p) => workSection(p) === s.id));
}

/** Projects with a schematic drawing on the site (src/components/drawings). */
export const drawn = new Set(['rampage', 'v2v-bsm-ofdm', 'led-audio-spectrum', 'signals-playground', 'bellhop-sim', 'acoustic-pool-alarm']);

/** What a project's card offers: a live version, a drawing, the code. Quiet labels, in that order. */
export function offers(p: Project) {
  const out: string[] = [];
  if (p.data.demo || p.data.links.live) out.push('Live');
  if (drawn.has(p.id)) out.push('Drawing');
  if (p.data.links.repo && p.data.confidentiality !== 'limited') out.push('Code');
  return out;
}
