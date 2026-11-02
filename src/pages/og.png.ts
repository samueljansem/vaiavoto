import type { APIRoute } from 'astro';
import { imagemInicio } from '../lib/og';

export const GET: APIRoute = async () => {
  const imagem = await imagemInicio();
  return new Response(new Uint8Array(imagem), { headers: { 'Content-Type': 'image/png' } });
};
