import type { APIRoute } from 'astro';
import { imagemProposta } from '../../../lib/og';
import type { Proposta } from '../../../lib/site';
import { todas } from '../../../lib/site';

export function getStaticPaths() {
  return todas().map((p) => {
    const [casa, proposta] = p.slug.split('/');
    return { params: { casa, proposta }, props: { p } };
  });
}

export const GET: APIRoute = async ({ props }) => {
  const imagem = await imagemProposta((props as { p: Proposta }).p);
  return new Response(new Uint8Array(imagem), { headers: { 'Content-Type': 'image/png' } });
};
