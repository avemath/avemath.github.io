import type { APIRoute, GetStaticPaths } from 'astro';
import { codeFiles } from '@/lib/code-files';
import { whole } from '@/lib/excerpt';

export const getStaticPaths = (() => Object.keys(codeFiles).map((key) => ({ params: { key } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ params }) => {
  const f = codeFiles[params.key!];
  return new Response(JSON.stringify({ lines: whole(f.source, f.lang) }), { headers: { 'Content-Type': 'application/json' } });
};
