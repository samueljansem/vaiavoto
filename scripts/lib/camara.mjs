// Dados da Câmara dos Deputados: API oficial (dadosabertos.camara.leg.br) e página de enquetes.
import { emLotes, html, json, numeroBR, textoDoHtml } from './http.mjs';
import { TIPOS, marco } from './regras.mjs';

const API = 'https://dadosabertos.camara.leg.br/api/v2';
const ID_PLENARIO = 180;

export const urlEnquete = (id) => `https://www.camara.leg.br/enquetes/${id}`;
export const urlFicha = (id) => `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${id}`;

/** Votações marcadas no Plenário entre `inicio` e `fim` (AAAA-MM-DD). */
export async function pautaPlenario(inicio, fim) {
  const r = await json(
    `${API}/eventos?idOrgao=${ID_PLENARIO}&dataInicio=${inicio}&dataFim=${fim}&itens=100&ordem=ASC&ordenarPor=dataHoraInicio`,
  );
  const sessoes = (r?.dados || []).filter(
    (e) => /deliberativa/i.test(e.descricaoTipo) && !/não deliberativa/i.test(e.descricaoTipo) && !/cancelad/i.test(e.situacao),
  );
  const itens = [];
  for (const s of sessoes) {
    const p = await json(`${API}/eventos/${s.id}/pauta`);
    for (const it of p?.dados || []) {
      const prop = it.proposicao_;
      if (!prop || !TIPOS.has(prop.siglaTipo)) continue;
      itens.push({ id: prop.id, data: s.dataHoraInicio, regime: it.regime || '' });
    }
  }
  // A mesma proposta pode aparecer em mais de uma sessão: fica a primeira data.
  const porId = new Map();
  for (const it of itens) if (!porId.has(it.id)) porId.set(it.id, it);
  return { sessoes: sessoes.length, itens: [...porId.values()] };
}

/** Detalhes, origem e marcos da linha do tempo de uma proposta. */
export async function proposicao(id) {
  const r = await json(`${API}/proposicoes/${id}`);
  const d = r?.dados;
  if (!d) return null;
  const [autores, tram] = await Promise.all([
    json(`${API}/proposicoes/${id}/autores`).catch(() => null),
    json(`${API}/proposicoes/${id}/tramitacoes`).catch(() => null),
  ]);
  const doSenado = (autores?.dados || []).some((a) => /senado federal/i.test(a.nome));

  const linhaDoTempo = [];
  for (const t of tram?.dados || []) {
    const texto = marco(t);
    if (!texto) continue;
    const data = t.dataHora.slice(0, 10);
    const ultimo = linhaDoTempo[linhaDoTempo.length - 1];
    if (ultimo && ultimo.texto === texto && ultimo.data === data) continue;
    linhaDoTempo.push({ data, texto });
  }
  linhaDoTempo.reverse();

  return {
    casa: 'camara',
    id: d.id,
    sigla: d.siglaTipo,
    numero: d.numero,
    ano: d.ano,
    ementa: (d.ementa || '').trim(),
    origem: doSenado ? 'senado' : 'camara',
    codSituacao: d.statusProposicao?.codSituacao,
    situacaoOficial: d.statusProposicao?.descricaoSituacao || '',
    linhaDoTempo: linhaDoTempo.slice(0, 8),
    urlOficial: urlFicha(d.id),
  };
}

/**
 * Placar da enquete oficial. A Câmara tem 5 opções; aqui viram 3 grupos:
 * a favor (concordo totalmente + na maior parte), indecisos, contra (discordo + discordo totalmente).
 */
export async function enquete(id) {
  const pagina = await html(`${urlEnquete(id)}/resultados`).catch(() => null);
  if (!pagina || !/Concordo totalmente/.test(pagina)) return null;
  const linhas = textoDoHtml(pagina);
  const valor = (rotulo) => {
    const i = linhas.findIndex((l) => l.toLowerCase() === rotulo.toLowerCase());
    if (i < 0) return 0;
    const n = linhas.slice(i + 1, i + 3).find((l) => /^\d{1,3}(\.\d{3})*$/.test(l));
    return n ? numeroBR(n) : 0;
  };
  const favor = valor('Concordo totalmente') + valor('Concordo na maior parte');
  const indecisos = valor('Estou indeciso');
  const contra = valor('Discordo na maior parte') + valor('Discordo totalmente');
  const total = favor + indecisos + contra;
  if (!total) return null;
  const capa = await html(urlEnquete(id)).catch(() => '');
  const pergunta = decodificar((capa.match(/id="pergunta"[^>]*>([^<]+)</) || [])[1] || '');
  return {
    favor,
    contra,
    indecisos,
    total,
    // "Resultado parcial" indica que a enquete continua recebendo votos.
    aberta: linhas.some((l) => /resultado parcial/i.test(l)),
    url: urlEnquete(id),
    pergunta: pergunta || 'Qual sua opinião sobre esta proposta?',
    opcoes: ['Concordo totalmente', 'Concordo na maior parte', 'Estou indeciso', 'Discordo na maior parte', 'Discordo totalmente'],
    capa,
  };
}

const decodificar = (s) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x3D;/g, '=')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Explicação publicada pela Câmara na página da enquete (texto da Agência Câmara de Notícias),
 * quando existe. Se a página só repete a ementa, não há explicação.
 */
export function explicacao(capa, ementa) {
  const bloco = (capa.match(/class="enquete-descricao__texto">([\s\S]*?)<\/p>/) || [])[1];
  if (!bloco) return null;
  const texto = decodificar(bloco);
  const normal = (s) => s.toLowerCase().replace(/[^a-zà-ú0-9]/g, '');
  if (!texto || normal(texto) === normal(ementa) || texto.length < ementa.length + 40) return null;
  const link = (capa.match(/<a href=([^ >]+)[^>]*class="enquete-descricao__link"[^>]*>\s*Entenda a proposta/) || [])[1];
  return {
    fonte: 'camara',
    texto,
    pontos: [],
    introPontos: '',
    aviso: 'Texto da Agência Câmara de Notícias, publicado na página da enquete.',
    url: link ? decodificar(link.replace(/^["']|["']$/g, '')) : urlEnquete(Number((capa.match(/data-id-enquete="(\d+)"/) || [])[1])),
  };
}

/** Enquetes mais votadas segundo a própria Câmara (última semana e último mês). */
export async function rankingEnquetes() {
  const pagina = await html('https://www.camara.leg.br/enquetes').catch(() => null);
  if (!pagina) return { semana: [], mes: [] };
  const secao = (ancora) => {
    const i = pagina.indexOf(`id="${ancora}"`);
    if (i < 0) return [];
    const resto = pagina.slice(i + ancora.length + 5);
    const fim = resto.search(/id="(ultima-semana|ultimo-mes|seis-meses)/);
    const trecho = fim > 0 ? resto.slice(0, fim) : resto.slice(0, 20000);
    return [...new Set([...trecho.matchAll(/\/enquetes\/(\d+)/g)].map((m) => Number(m[1])))];
  };
  return { semana: secao('ultima-semana'), mes: secao('ultimo-mes') };
}

/** Contatos oficiais dos deputados em exercício. Usa o cache para não repetir 513 consultas por dia. */
export async function deputados(cache = []) {
  const r = await json(`${API}/deputados?itens=1000&ordem=ASC&ordenarPor=nome`);
  const lista = r?.dados || [];
  const anterior = new Map(cache.map((d) => [d.id, d]));
  const semanaPassada = Date.now() - 7 * 24 * 3600 * 1000;
  return emLotes(lista, 6, async (d) => {
    const c = anterior.get(d.id);
    if (c && c.telefone !== undefined && new Date(c.verificadoEm).getTime() > semanaPassada) {
      return { ...c, nome: d.nome, partido: d.siglaPartido, uf: d.siglaUf, email: d.email || c.email };
    }
    const det = await json(`${API}/deputados/${d.id}`);
    const g = det?.dados?.ultimoStatus?.gabinete || {};
    return {
      id: d.id,
      nome: d.nome,
      partido: d.siglaPartido,
      uf: d.siglaUf,
      email: d.email || g.email || null,
      telefone: g.telefone ? `(61) ${g.telefone}` : null,
      pagina: `https://www.camara.leg.br/deputados/${d.id}`,
      verificadoEm: new Date().toISOString(),
    };
  }).then((xs) => xs.filter(Boolean));
}
