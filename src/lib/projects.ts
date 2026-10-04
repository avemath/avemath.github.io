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
