// Dados do Senado Federal: API oficial (legis.senado.leg.br/dadosabertos) e e-Cidadania.
import { html, json, numeroBR, textoDoHtml } from './http.mjs';
import { TIPOS } from './regras.mjs';

const API = 'https://legis.senado.leg.br/dadosabertos';
const ECIDADANIA = 'https://www12.senado.leg.br/ecidadania';

export const urlConsulta = (codigo) => `${ECIDADANIA}/visualizacaomateria?id=${codigo}`;
export const urlMateria = (codigo) => `https://www25.senado.leg.br/web/atividade/materias/-/materia/${codigo}`;

const lista = (x) => (Array.isArray(x) ? x : x ? [x] : []);

/** Votações marcadas no Plenário do Senado entre `inicio` e `fim` (AAAA-MM-DD). */
export async function pautaPlenario(inicio, fim) {
  const meses = new Set([inicio.slice(0, 7), fim.slice(0, 7)]);
  const itens = new Map();
  let sessoes = 0;
  for (const mes of meses) {
    const r = await json(`${API}/plenario/agenda/mes/${mes.replace('-', '')}01`).catch(() => null);
    for (const s of lista(r?.AgendaPlenario?.Sessoes?.Sessao)) {
      if (s.Data < inicio || s.Data > fim) continue;
      if (!/DELIBERATIVA/i.test(s.TipoSessao) || /NÃO DELIBERATIVA/i.test(s.TipoSessao)) continue;
      sessoes++;
      for (const m of lista(s.Materias?.Materia)) {
        if (!TIPOS.has(m.SiglaMateria)) continue;
        const codigo = Number(m.CodigoMateria);
        if (itens.has(codigo)) continue;
        itens.set(codigo, {
          codigo,
          data: `${s.Data}T${(s.Hora || '00:00').slice(0, 5)}`,
          sigla: m.SiglaMateria,
          numero: Number(m.NumeroMateria),
          ano: Number(m.AnoMateria),
          ementa: (m.Ementa || '').trim(),
          origem: m.SiglaCasaIniciadora === 'CD' ? 'camara' : 'senado',
        });
      }
    }
  }
  return { sessoes, itens: [...itens.values()] };
}

/** Detalhes básicos e situação atual de uma matéria. */
export async function materia(codigo) {
  const [det, sit] = await Promise.all([
    json(`${API}/materia/${codigo}`).catch(() => null),
    json(`${API}/materia/situacaoatual/${codigo}`).catch(() => null),
  ]);
  const m = det?.DetalheMateria?.Materia;
  if (!m) return null;
  const id = m.IdentificacaoMateria || {};
  const basicos = m.DadosBasicosMateria || {};
  const atual = lista(sit?.SituacaoAtualMateria?.Materias?.Materia)[0]?.SituacaoAtual;
  const situacao = lista(lista(atual?.Autuacoes?.Autuacao)[0]?.Situacoes?.Situacao)[0];
  return {
    casa: 'senado',
    id: Number(codigo),
    sigla: id.SiglaSubtipoMateria,
    numero: Number(id.NumeroMateria),
    ano: Number(id.AnoMateria),
    ementa: (basicos.EmentaMateria || '').trim(),
    apelido: (basicos.ApelidoMateria || '').trim(),
    origem: /revisora/i.test(id.DescricaoObjetivoProcesso || '') ? 'camara' : 'senado',
    tramitando: id.IndicadorTramitando !== 'Não',
    situacaoOficial: situacao?.DescricaoSituacao || '',
    linhaDoTempo: [],
    urlOficial: urlMateria(codigo),
  };
}

/** Placar da consulta pública do e-Cidadania (Sim / Não). */
export async function consulta(codigo) {
  const pagina = await html(urlConsulta(codigo)).catch(() => null);
  if (!pagina) return null;
  const linhas = textoDoHtml(pagina);
  const i = linhas.findIndex((l) => /^Votos apurados até/i.test(l));
  if (i < 2) return null;
  const nums = linhas.slice(Math.max(0, i - 4), i).filter((l) => /^\d{1,3}(\.\d{3})*$/.test(l));
  if (nums.length < 2) return null;
  const favor = numeroBR(nums[nums.length - 2]);
  const contra = numeroBR(nums[nums.length - 1]);
  return {
    favor,
    contra,
    indecisos: 0,
    total: favor + contra,
    aberta: true,
    url: urlConsulta(codigo),
    pergunta: linhas.find((l) => /^Você apoia essa proposição\?/i.test(l)) || 'Você apoia essa proposição?',
    opcoes: ['Sim', 'Não'],
    explicacao: explicacao(pagina, codigo),
  };
}

const limpar = (s) =>
  s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

/** Bloco "Entenda a proposta" do e-Cidadania (texto do próprio Senado), quando existe. */
function explicacao(pagina, codigo) {
  const i = pagina.indexOf('id="collapseEntendaProposta"');
  if (i < 0) return null;
  const bloco = pagina.slice(i, i + 20000);
  const spans = [...bloco.matchAll(/<span>([\s\S]*?)<\/span>/g)].map((m) => limpar(m[1]));
  const oQueE = spans[0] || [];
  if (!oQueE.length) return null;
  // O texto do autor às vezes começa com um resto de rótulo ("tor:"); linhas curtas terminadas em ":" são descartadas.
  const autor = (spans[1] || []).filter((l, k) => !(k === 0 && l.length < 8 && l.endsWith(':')));
  const pontos = autor.filter((l) => /^[-•]/.test(l)).map((l) => l.replace(/^[-•]\s*/, ''));
  const intro = autor.filter((l) => !/^[-•]/.test(l)).join(' ');
  const nota = (textoDoHtml(pagina).find((l) => /gerado por intelig[eê]ncia artificial/i.test(l)) || '').replace(/^\*\s*/, '');
  return {
    fonte: 'senado',
    texto: oQueE.join(' '),
    pontos,
    introPontos: intro,
    aviso: nota || 'Explicação publicada pelo Senado no e-Cidadania.',
    url: urlConsulta(codigo),
  };
}

/** Matérias mais votadas no dia, segundo o e-Cidadania. */
export async function rankingConsultas() {
  const pagina = await html(`${ECIDADANIA}/principalmateria`).catch(() => null);
  if (!pagina) return [];
  const i = pagina.search(/mais votadas no dia/i);
  const trecho = i >= 0 ? pagina.slice(i, i + 30000) : pagina;
  return [...new Set([...trecho.matchAll(/visualizacaomateria\?id=(\d+)/g)].map((m) => Number(m[1])))].slice(0, 10);
}

/** Contatos oficiais dos senadores em exercício. */
export async function senadores() {
  const r = await json(`${API}/senador/lista/atual`);
  return lista(r?.ListaParlamentarEmExercicio?.Parlamentares?.Parlamentar).map((p) => {
    const i = p.IdentificacaoParlamentar;
    const tel = lista(i.Telefones?.Telefone).find((t) => t.IndicadorFax !== 'Sim')?.NumeroTelefone;
    return {
      id: Number(i.CodigoParlamentar),
      nome: i.NomeParlamentar,
      partido: i.SiglaPartidoParlamentar,
      uf: i.UfParlamentar,
      email: i.EmailParlamentar || null,
      telefone: tel ? `(61) ${tel.replace(/^(\d{4})(\d{4})$/, '$1-$2')}` : null,
      pagina: i.UrlPaginaParlamentar,
    };
  });
}
