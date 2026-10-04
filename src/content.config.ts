import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

export const projectTypes = ['research', 'engineering', 'client-site', 'software', 'nonprofit'] as const;

const month = z.string().regex(/^\d{4}(-\d{2})?$/, 'Use YYYY or YYYY-MM');

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      // Short name for cards and the command palette.
      short: z.string().optional(),
      type: z.enum(projectTypes),
      tags: z.array(z.enum(projectTypes)).default([]),
      featured: z.boolean().default(false),
      // Lower numbers come first.
      order: z.number().default(100),
      period: z.object({ start: month, end: month.optional() }),
      status: z.enum(['live', 'ongoing', 'complete', 'archived']),
      summary: z.string().max(200),
      // One line for bento tiles: what came of it.
      outcome: z.string().optional(),
      role: z.string(),
      team: z.string().optional(),
      stack: z.array(z.string()),
      links: z
        .object({
          live: z.url().optional(),
          repo: z.url().optional(),
          writeup: z.url().optional(),
        })
        .default({}),
      cover: image().optional(),
      mobile: image().optional(),
      coverAlt: z.string().optional(),
      gallery: z.array(z.object({ src: image(), alt: z.string(), caption: z.string().optional() })).optional(),
      metrics: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
      confidentiality: z.enum(['public', 'limited']).default('public'),
      client: z
        .object({
          name: z.string(),
          kind: z.string(),
          quote: z.string().optional(),
          permission: z.boolean().default(false),
        })
        .optional(),
      // Overrides for the <title> and meta description when the title or summary runs long.
      // Search results cut titles near 60 characters, and the site name suffix takes 17 of them.
      seoTitle: z.string().max(43).optional(),
      seoDescription: z.string().max(160).optional(),
      // Extra search terms for the command palette.
      keywords: z.array(z.string()).default([]),
      // Which interactive demo to mount on the case study page, if any.
      demo: z.enum(['spectrum', 'weapon-logic', 'ofdm']).optional(),
      draft: z.boolean().default(false),
    })
    .refine((p) => p.confidentiality === 'public' || (!p.gallery && !p.metrics && !p.links.repo), {
      message: 'Limited entries cannot carry a gallery, metrics or a repo link.',
    }),
});

export const collections = { projects };
