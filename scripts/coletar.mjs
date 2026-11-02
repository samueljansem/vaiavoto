// Coleta os dados oficiais e gera src/data/site.json (usado pelo site) e public/contatos.json.
// Roda na GitHub Action algumas vezes por dia. Uso local: npm run coletar
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import * as camara from './lib/camara.mjs';
import { emLotes } from './lib/http.mjs';
import { NOME_TIPO, TIPOS, acoes, etapaCamara, etapaSenado, passos, situacao, slugDe } from './lib/regras.mjs';
import * as senado from './lib/senado.mjs';

const raiz = new URL('../', import.meta.url);
const caminho = (p) => new URL(p, raiz);
const lerJson = async (p, padrao) => (existsSync(caminho(p)) ? JSON.parse(await readFile(caminho(p), 'utf8')) : padrao);
const salvarJson = async (p, dados) => {
  await mkdir(new URL('.', caminho(p)), { recursive: true });
  await writeFile(caminho(p), JSON.stringify(dados, null, 2) + '\n');
};

const fuso = 'America/Sao_Paulo';
const diaISO = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: fuso }).format(d);
const somaDias = (iso, n) => diaISO(new Date(new Date(`${iso}T12:00:00-03:00`).getTime() + n * 86400000));
const hoje = diaISO(new Date());
const fim = somaDias(hoje, 7);

console.log(`Coletando de ${hoje} a ${fim}`);

// 1. Pautas dos Plenários
const [pautaCamara, pautaSenado] = await Promise.all([
  camara.pautaPlenario(hoje, fim).catch((e) => (console.warn('pauta Câmara:', e.message), { sessoes: 0, itens: [] })),
  senado.pautaPlenario(hoje, fim).catch((e) => (console.warn('pauta Senado:', e.message), { sessoes: 0, itens: [] })),
]);
console.log(`Pauta: Câmara ${pautaCamara.itens.length} propostas, Senado ${pautaSenado.itens.length}`);

// 2. Rankings oficiais de participação (para descobrir o que está mobilizando as pessoas)
const [rankCamara, rankSenado] = await Promise.all([
  camara.rankingEnquetes().catch(() => ({ semana: [], mes: [] })),
  senado.rankingConsultas().catch(() => []),
]);

// 3. Detalhes de cada proposta candidata
const idsCamara = [...new Set([...pautaCamara.itens.map((i) => i.id), ...rankCamara.semana.slice(0, 10), ...rankCamara.mes.slice(0, 10)])];
const idsSenado = [...new Set([...pautaSenado.itens.map((i) => i.codigo), ...rankSenado])];

const detCamara = await emLotes(idsCamara, 4, async (id) => {
  const p = await camara.proposicao(id);
  if (!p || !TIPOS.has(p.sigla)) return null;
  const e = await camara.enquete(id);
  if (!e) return { ...p, enquete: null, explicacao: null };
  const { capa, ...enquete } = e;
  return { ...p, enquete, explicacao: camara.explicacao(capa, p.ementa) };
});
const detSenado = await emLotes(idsSenado, 4, async (codigo) => {
  const daPauta = pautaSenado.itens.find((i) => i.codigo === codigo);
  const m = (await senado.materia(codigo)) || (daPauta && {
    casa: 'senado', id: codigo, sigla: daPauta.sigla, numero: daPauta.numero, ano: daPauta.ano,
    ementa: daPauta.ementa, apelido: '', origem: daPauta.origem, tramitando: true, situacaoOficial: '',
    linhaDoTempo: [], urlOficial: senado.urlMateria(codigo),
  });
  if (!m || !TIPOS.has(m.sigla)) return null;
  const c = await senado.consulta(codigo);
  if (!c) return { ...m, enquete: null, explicacao: null };
  const { explicacao, ...enquete } = c;
  return { ...m, enquete, explicacao };
});

// 4. Textos: só o que as Casas publicam (apelido oficial, ementa e explicações das páginas oficiais).
const encurta = (s, n = 150) => {
  const limpo = s.replace(/\s+/g, ' ').trim();
  if (limpo.length <= n) return limpo;
  return limpo.slice(0, limpo.lastIndexOf(' ', n)) + '…';
};

// 5. Fotos das enquetes, para calcular votos por período
const pastaFotos = 'dados/enquetes/';
await mkdir(caminho(pastaFotos), { recursive: true });
const fotoHoje = {};
const todas = [...detCamara, ...detSenado].filter(Boolean);
for (const p of todas) if (p.enquete) fotoHoje[`${p.casa}-${p.id}`] = p.enquete.total;
const fotoAnterior = await lerJson(`${pastaFotos}${hoje}.json`, {});
await salvarJson(`${pastaFotos}${hoje}.json`, { ...fotoAnterior, ...fotoHoje });

const datasFotos = (await readdir(caminho(pastaFotos))).map((f) => f.replace('.json', '')).filter((d) => d < hoje).sort();
async function fotoAte(dias) {
  const limite = somaDias(hoje, -dias);
  const data = [...datasFotos].reverse().find((d) => d <= limite);
  return data ? lerJson(`${pastaFotos}${data}.json`, {}) : null;
}
const fotosPeriodo = { semana: await fotoAte(7) };

// 6. Monta cada proposta já com tudo que a página precisa
const votacoes = new Map([
  ...pautaCamara.itens.map((i) => [`camara-${i.id}`, { data: i.data, quem: 'deputados' }]),
  ...pautaSenado.itens.map((i) => [`senado-${i.codigo}`, { data: i.data, quem: 'senadores' }]),
]);

const propostas = {};
for (const p of todas) {
  const chave = `${p.casa}-${p.id}`;
  const etapa = p.casa === 'camara' ? etapaCamara(p.codSituacao) : etapaSenado(p.situacaoOficial, p.tramitando);
  const votacao = votacoes.get(chave) || null;
  const temEnqueteAberta = !!p.enquete?.aberta && (etapa === p.casa);
  const sit = situacao({ etapa, origem: p.origem, sigla: p.sigla, votacao, situacaoOficial: p.situacaoOficial });
  const slug = slugDe(p.casa, p.sigla, p.numero, p.ano);
  const votosPeriodo = Object.fromEntries(
    Object.entries(fotosPeriodo).map(([per, foto]) => [per, foto && foto[chave] != null && p.enquete ? Math.max(0, p.enquete.total - foto[chave]) : null]),
  );
  propostas[slug] = {
    slug,
    chave,
    casa: p.casa,
    rotulo: `${p.sigla} ${p.numero}/${p.ano}`,
    tipo: NOME_TIPO[p.sigla] || p.sigla,
    sigla: p.sigla,
    titulo: p.apelido || encurta(p.ementa),
    tituloCompleto: !p.apelido && encurta(p.ementa) === p.ementa.replace(/\s+/g, ' ').trim(),
    ementa: p.ementa,
    explicacao: p.explicacao || null,
    origem: p.origem,
    etapa,
    situacaoOficial: p.situacaoOficial,
    votacao,
    chip: sit.chip,
    agora: sit.agora,
    passos: passos({ origem: p.origem, sigla: p.sigla, etapa }),
    enquete: p.enquete ? { ...p.enquete, participavel: temEnqueteAberta } : null,
    acoes: acoes(etapa, temEnqueteAberta),
    linhaDoTempo: p.linhaDoTempo,
    urlOficial: p.urlOficial,
    votosPeriodo,
  };
}

// 7. "Vem aí": votações marcadas, em ordem de data
const vemAi = Object.values(propostas)
  .filter((p) => p.votacao)
  .sort((a, b) => a.votacao.data.localeCompare(b.votacao.data))
  .map((p) => p.slug);

// 8. "Em alta": uma lista só, com as propostas que mais receberam votos nas enquetes nos últimos 7 dias
// (comparando com a foto de uma semana atrás). Sem histórico suficiente, usa os rankings oficiais
// das duas Casas e ordena pelo total de votos.
const comEnquete = Object.values(propostas).filter((p) => p.enquete);
const oficiais = new Set([
  ...rankCamara.semana.map((c) => `camara-${c}`),
  ...rankCamara.mes.map((c) => `camara-${c}`),
  ...rankSenado.map((c) => `senado-${c}`),
]);
const comHistorico = comEnquete.filter((p) => p.votosPeriodo.semana != null);
const listaAlta = comHistorico.length
  ? comHistorico.filter((p) => p.votosPeriodo.semana > 0).sort((a, b) => b.votosPeriodo.semana - a.votosPeriodo.semana)
  : comEnquete.filter((p) => oficiais.has(p.chave)).sort((a, b) => b.enquete.total - a.enquete.total);
const emAlta = { porSemana: comHistorico.length > 0, itens: listaAlta.slice(0, 10).map((p) => p.slug) };

await salvarJson('src/data/site.json', {
  atualizadoEm: new Date().toISOString(),
  hoje,
  pautaCamaraPublicada: pautaCamara.sessoes > 0,
  pautaSenadoPublicada: pautaSenado.sessoes > 0,
  vemAi,
  emAlta,
  propostas,
});
console.log(`site.json: ${Object.keys(propostas).length} propostas, ${vemAi.length} em "Vem aí"`);

// 9. Contatos oficiais (com cache dos telefones dos deputados)
if (process.env.PULAR_CONTATOS !== '1') {
  const anterior = await lerJson('public/contatos.json', { deputados: [] });
  const [deps, sens] = await Promise.all([camara.deputados(anterior.deputados), senado.senadores()]);
  await salvarJson('public/contatos.json', { atualizadoEm: new Date().toISOString(), deputados: deps, senadores: sens });
  console.log(`contatos.json: ${deps.length} deputados, ${sens.length} senadores`);
}
