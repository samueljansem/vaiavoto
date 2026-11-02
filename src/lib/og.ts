// Imagens de compartilhamento (og:image), geradas no build: layout em "HTML" -> SVG (Satori) -> PNG (resvg).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import type { Proposta } from './site';
import { num, pctTexto, podeAgir, site } from './site';

const require = createRequire(import.meta.url);
const fonte = (arquivo: string) => readFileSync(require.resolve(arquivo));
const FONTES = [
  { name: 'Atkinson', weight: 400 as const, data: fonte('@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff') },
  { name: 'Atkinson', weight: 700 as const, data: fonte('@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-700-normal.woff') },
  { name: 'Atkinson', weight: 400 as const, data: fonte('@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-ext-400-normal.woff') },
  { name: 'Atkinson', weight: 700 as const, data: fonte('@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-ext-700-normal.woff') },
  { name: 'Bricolage', weight: 800 as const, data: fonte('@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff') },
].map((f) => ({ ...f, style: 'normal' as const }));

// Elementos no formato que o Satori entende (sem React).
type No = { type: string; props: Record<string, unknown> };
const el = (type: string, style: Record<string, unknown>, ...children: unknown[]): No => ({
  type,
  props: { style: { display: 'flex', ...style }, children: children.length === 1 ? children[0] : children },
});
const img = (src: string, w: number, h: number): No => ({ type: 'img', props: { src, width: w, height: h } });
const svg = (s: string) => `data:image/svg+xml;base64,${Buffer.from(s).toString('base64')}`;

const LOGO = (corUrna: string, corCheck: string) =>
  svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><rect x="3" y="12" width="22" height="13" rx="2.5" fill="${corUrna}"/><rect x="8" y="10.5" width="12" height="3" rx="1.5" fill="#111827"/><path d="M9 6.5l3.2 3.2L19.5 2.5" fill="none" stroke="${corCheck}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
const RELOGIO = (cor: string) =>
  svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${cor}" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/></svg>`);
const CHECK = (cor: string) =>
  svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${cor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`);
const SETA = svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`);

const marca = (claro = false) =>
  el('div', { alignItems: 'center', gap: 12 },
    img(LOGO(claro ? '#FFFFFF' : '#1D4ED8', claro ? '#FFFFFF' : '#1D4ED8'), 46, 46),
    el('span', { fontFamily: 'Bricolage', fontWeight: 800, fontSize: 36, letterSpacing: -0.7, color: claro ? '#FFFFFF' : '#111827' }, 'Vai a Voto'),
  );

/** Título que cabe em até 3 linhas: a fonte diminui conforme o tamanho do texto. */
function titulo(texto: string) {
  const t = texto.length > 125 ? `${texto.slice(0, texto.lastIndexOf(' ', 122))}…` : texto;
  const tamanho = t.length <= 32 ? 84 : t.length <= 60 ? 70 : t.length <= 90 ? 60 : 52;
  return el('div', { fontFamily: 'Bricolage', fontWeight: 800, fontSize: tamanho, lineHeight: 1.05, letterSpacing: -tamanho * 0.025, color: '#111827', maxHeight: tamanho * 1.05 * 3, overflow: 'hidden' }, t);
}

function selo(p: Proposta) {
  const estilos: Record<string, [string, string]> = {
    votacao: ['#1D4ED8', '#FFFFFF'],
    veto: ['#FDF0E3', '#9A3412'],
    lei: ['#E7F6EF', '#065F46'],
    encerrada: ['#EEF1F5', '#374151'],
    padrao: ['#EAF0FF', '#1E3A8A'],
  };
  const tipo = p.votacao ? 'votacao' : p.etapa === 'veto' ? 'veto' : p.etapa === 'lei' ? 'lei' : p.etapa === 'encerrada' ? 'encerrada' : 'padrao';
  const [fundo, cor] = estilos[tipo];
  const texto = p.votacao || tipo !== 'padrao' ? p.chip : `${p.chip} · sem data de votação`;
  const icone = p.votacao ? img(RELOGIO(cor), 30, 30) : tipo === 'lei' ? img(CHECK(cor), 30, 30) : null;
  return el('div', { alignItems: 'center', gap: 12, padding: '12px 26px', borderRadius: 999, background: fundo, color: cor, fontSize: 32, fontWeight: 700 }, ...(icone ? [icone] : []), texto);
}

function rodape(p: Proposta) {
  const e = p.enquete;
  if (e && e.total >= 50) {
    const onde = p.casa === 'camara' ? 'da Câmara' : 'do Senado';
    return el('div', { flexDirection: 'column', gap: 12 },
      el('div', { justifyContent: 'space-between', alignItems: 'flex-end', fontSize: 32, fontWeight: 700 },
        el('span', { color: '#1D4ED8' }, `${pctTexto(e.favor, e.total)} a favor`),
        el('span', { fontSize: 24, fontWeight: 400, color: '#4B5563' }, `${num(e.total)} votos na enquete ${onde}`),
        el('span', { color: '#B91C1C' }, `${pctTexto(e.contra, e.total)} contra`),
      ),
      el('div', { height: 22, borderRadius: 11, overflow: 'hidden', background: '#EEF1F5' },
        el('div', { width: `${(e.favor / e.total) * 100}%`, flexShrink: 1, minWidth: e.favor > 0 ? 12 : 0, background: '#1D4ED8' }),
        el('div', { width: `${(e.indecisos / e.total) * 100}%`, flexShrink: 1, background: '#C9CED6' }),
        // Quem tem votos sempre aparece na barra, mesmo que seja uma fatia mínima.
        el('div', { flexGrow: 1, minWidth: e.contra > 0 ? 12 : 0, background: '#DC2626', marginLeft: e.contra > 0 ? 4 : 0 }),
      ),
    );
  }
  if (podeAgir(p)) {
    return el('div', { alignItems: 'center', justifyContent: 'space-between', gap: 24, padding: '24px 28px', borderRadius: 20, background: '#F1F4FA' },
      el('span', { fontSize: 34, fontWeight: 700, color: '#1E3A8A' }, 'Ainda dá tempo de dizer o que você pensa'),
      el('div', { alignItems: 'center', gap: 10, padding: '14px 24px', borderRadius: 14, background: '#1D4ED8', color: '#FFFFFF', fontSize: 28, fontWeight: 700 }, 'Leva 1 minuto', img(SETA, 26, 26)),
    );
  }
  const frase = p.etapa === 'lei' ? 'Já foi decidido. Veja o que muda para você.' : p.agora;
  return el('div', { fontSize: 30, color: '#374151' }, frase);
}

/** Moldura de 1200×630: a caixa externa fixa o tamanho; a interna recebe o espaçamento. */
const moldura = (fundo: string, estilo: Record<string, unknown>, ...filhos: unknown[]) =>
  el('div', { width: 1200, height: 630, background: fundo },
    el('div', { flexGrow: 1, padding: '56px 64px', fontFamily: 'Atkinson', flexDirection: 'column', justifyContent: 'space-between', ...estilo }, ...filhos),
  );

async function png(arvore: No) {
  const svgTexto = await satori(arvore as never, { width: 1200, height: 630, fonts: FONTES });
  return new Resvg(svgTexto, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}

export function imagemProposta(p: Proposta) {
  return png(
    moldura('#FFFFFF', {},
      marca(),
      el('div', { flexDirection: 'column', gap: 22, alignItems: 'flex-start' }, selo(p), titulo(p.titulo)),
      rodape(p),
    ),
  );
}

export function imagemInicio() {
  const n = site.vemAi.length;
  const destaque = n > 0 ? `${n} ${n === 1 ? 'votação marcada' : 'votações marcadas'} nos próximos dias` : 'Veja o que está em alta nas enquetes oficiais';
  return png(
    moldura('#1D4ED8', { color: '#FFFFFF' },
      marca(true),
      el('div', { flexDirection: 'column', gap: 20 },
        el('div', { fontFamily: 'Bricolage', fontWeight: 800, fontSize: 76, lineHeight: 1.02, letterSpacing: -2 }, 'Veja o que vai ser votado e diga o que você pensa'),
        el('div', { fontSize: 32, lineHeight: 1.35, color: '#DBE5FF' }, 'Câmara e Senado, com o placar das enquetes oficiais e o contato de quem vota por você.'),
      ),
      el('div', { alignSelf: 'flex-start', alignItems: 'center', gap: 12, padding: '14px 26px', borderRadius: 999, background: '#FFFFFF', color: '#1E3A8A', fontSize: 30, fontWeight: 700 }, img(RELOGIO('#1E3A8A'), 28, 28), destaque),
    ),
  );
}
