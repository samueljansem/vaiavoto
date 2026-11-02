import dados from '../data/site.json';

export type Passo = { rotulo: string; estado: 'feito' | 'atual' | 'falta' };
export type Enquete = {
  favor: number;
  contra: number;
  indecisos: number;
  total: number;
  aberta: boolean;
  participavel: boolean;
  url: string;
  pergunta: string;
  opcoes: string[];
};
/** Explicação publicada pela própria Casa (Agência Câmara ou e-Cidadania do Senado). */
export type Explicacao = {
  fonte: 'camara' | 'senado';
  texto: string;
  pontos: string[];
  introPontos: string;
  aviso: string;
  url: string;
};
export type Proposta = {
  slug: string;
  chave: string;
  casa: 'camara' | 'senado';
  rotulo: string;
  tipo: string;
  sigla: string;
  titulo: string;
  tituloCompleto: boolean;
  explicacao: Explicacao | null;
  ementa: string;
  origem: 'camara' | 'senado';
  etapa: string;
  situacaoOficial: string;
  votacao: { data: string; quem: 'deputados' | 'senadores' } | null;
  chip: string;
  agora: string;
  passos: Passo[];
  enquete: Enquete | null;
  acoes: { enquete: boolean; falarCom: 'deputados' | 'senadores' | 'ambos' | null };
  linhaDoTempo: { data: string; texto: string }[];
  urlOficial: string;
  votosPeriodo: { semana: number | null };
};

type Site = {
  atualizadoEm: string;
  hoje: string;
  pautaCamaraPublicada: boolean;
  pautaSenadoPublicada: boolean;
  vemAi: string[];
  emAlta: { porSemana: boolean; itens: string[] };
  propostas: Record<string, Proposta>;
};

export const site = dados as unknown as Site;
export const SITE_URL = 'https://vaiavoto.samueljansem.dev';

export const proposta = (slug: string) => site.propostas[slug];
export const todas = () => Object.values(site.propostas);

const nf = new Intl.NumberFormat('pt-BR');
export const num = (n: number) => nf.format(n);
export const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

/** Porcentagem para exibir: o arredondamento nunca esconde votos ("0%" com votos, "100%" sem ser unânime). */
export function pctTexto(n: number, total: number) {
  const p = pct(n, total);
  if (p === 0 && n > 0) return 'Menos de 1%';
  if (p === 100 && n < total) return 'Mais de 99%';
  return `${p}%`;
}

const MESES = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
export function dataCurta(iso: string) {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} de ${MESES[m - 1]} ${a}`;
}

export function atualizado() {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(site.atualizadoEm));
}

export const urlProposta = (p: Proposta) => `/${p.slug}/`;

/** Linha do placar para mensagens: prova social, sem tomar partido. */
function linhaPlacar(p: Proposta) {
  const e = p.enquete;
  if (!e || e.total < 50) return null;
  return `Na enquete oficial, ${pctTexto(e.favor, e.total).toLowerCase()} são a favor e ${pctTexto(e.contra, e.total).toLowerCase()} são contra (${num(e.total)} votos).`;
}

/** Mensagem pronta para o WhatsApp: o que está em jogo, quando, e um convite claro para agir. */
export function textoWhatsApp(p: Proposta) {
  const url = `${SITE_URL}${urlProposta(p)}`;
  const placar = linhaPlacar(p);
  let linhas: (string | null)[];
  if (p.votacao) {
    linhas = [
      `🗳️ *${p.chip}:*`,
      p.titulo,
      '',
      placar,
      placar && '',
      'Ainda dá tempo de dizer o que você pensa. Leva 1 minuto 👇',
      url,
    ];
  } else if (podeAgir(p)) {
    linhas = [`📣 *${p.titulo}*`, p.agora, '', placar, placar && '', 'Dê sua opinião e fale com quem vota por você 👇', url];
  } else {
    linhas = [`📌 *${p.titulo}*`, `${p.chip}. ${p.agora}`, '', 'Veja o que foi decidido 👇', url];
  }
  return `https://wa.me/?text=${encodeURIComponent(linhas.filter((l) => l !== null).join('\n'))}`;
}

/** Texto do card de prévia (quando o link é colado no WhatsApp ou em redes sociais). */
export function descricaoProposta(p: Proposta) {
  if (p.votacao) return `${p.chip}. Veja o que está em jogo e diga o que você pensa antes da votação.`;
  if (podeAgir(p)) return `${p.agora} Veja o que está em jogo e diga o que você pensa.`;
  return `${p.chip}. ${p.agora}`;
}

export const quemFalar = {
  deputados: 'Falar com meus deputados',
  senadores: 'Falar com meus senadores',
  ambos: 'Falar com deputados e senadores',
} as const;

// Textos longos: dividir em parágrafos curtos e mostrar o começo.
const FRASES = /(?<=[.!?…])\s+(?=["“(]?[A-ZÀ-Ý0-9])/;

/** Agrupa frases em parágrafos de até ~`alvo` caracteres. */
export function paragrafos(texto: string, alvo = 360) {
  const frases = texto.replace(/\s+/g, ' ').trim().split(FRASES);
  const saida: string[] = [];
  let atual = '';
  for (const f of frases) {
    if (atual && atual.length + f.length > alvo) {
      saida.push(atual);
      atual = f;
    } else atual = atual ? `${atual} ${f}` : f;
  }
  if (atual) saida.push(atual);
  return saida;
}

/** Primeira frase (para os cards), cortada com reticências se for longa demais. */
export function primeiraFrase(texto: string, max = 200) {
  const f = texto.replace(/\s+/g, ' ').trim().split(FRASES)[0];
  return f.length <= max ? f : `${f.slice(0, f.lastIndexOf(' ', max - 1))}…`;
}

/** "PRONTO PARA DELIBERAÇÃO DO PLENÁRIO" → "Pronto para deliberação do plenário". */
export function semCaixaAlta(s: string) {
  const letras = s.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (!letras || letras !== letras.toUpperCase()) return s;
  const minusc = s.toLowerCase();
  return minusc.charAt(0).toUpperCase() + minusc.slice(1);
}

export const decidido = (p: Proposta) => ['lei', 'encerrada'].includes(p.etapa);
export const podeAgir = (p: Proposta) => p.acoes.enquete || !!p.acoes.falarCom;
