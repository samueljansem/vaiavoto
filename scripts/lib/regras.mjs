// Regras públicas e mecânicas do Vai a Voto.
// Nada aqui depende de opinião: cada texto sai da situação oficial da proposta.
// Mudou alguma regra? Atualize também a página /regras.

/** Tipos de proposta que entram no site (podem virar lei ou mudar a Constituição). */
export const TIPOS = new Set(['PL', 'PLP', 'PEC', 'MPV', 'PLV', 'PDL']);

export const NOME_TIPO = {
  PL: 'Projeto de lei',
  PLP: 'Projeto de lei complementar',
  PEC: 'Mudança na Constituição',
  MPV: 'Medida provisória',
  PLV: 'Projeto de lei de conversão',
  PDL: 'Projeto de decreto legislativo',
};

// Situações oficiais da Câmara (códigos de /referencias/situacoesProposicao) agrupadas por etapa.
const SITUACOES_CAMARA = {
  senado: [926, 1293, 1303],
  presidente: [1150, 1160, 1070],
  veto: [939, 937],
  promulgacao: [1294],
  lei: [1140],
  encerrada: [923, 930, 931, 941, 950, 1120, 1222, 1230, 1285, 1292],
};

export function etapaCamara(codSituacao) {
  for (const [etapa, cods] of Object.entries(SITUACOES_CAMARA)) {
    if (cods.includes(Number(codSituacao))) return etapa;
  }
  return 'camara';
}

export function etapaSenado(descricao = '', tramitando = true) {
  const d = descricao.toUpperCase();
  if (/NORMA JUR[IÍ]DICA/.test(d)) return 'lei';
  if (/PROMULGA/.test(d)) return 'promulgacao';
  if (/SAN[CÇ][AÃ]O/.test(d)) return 'presidente';
  if (/VETO/.test(d)) return 'veto';
  if (/C[AÂ]MARA DOS DEPUTADOS/.test(d) && /REMETID|ENVIAD/.test(d)) return 'camara';
  if (/ARQUIVAD|PREJUDICAD|RETIRAD|PERDA DE EFIC|REJEITAD/.test(d)) return 'encerrada';
  return tramitando ? 'senado' : 'encerrada';
}

// Marcos da linha do tempo: tipos de tramitação da Câmara (/referencias/tiposTramitacao).
const MARCOS = {
  100: 'Proposta apresentada na Câmara',
  196: 'Aprovado o pedido de urgência: pode ir direto ao Plenário',
  237: 'Aprovada pelos deputados em 1º turno',
  238: 'Aprovada pelos deputados em 1º turno',
  244: 'Aprovada pelos deputados',
  1235: 'Aprovada pelos deputados',
  197: 'Rejeitada',
  1236: 'Rejeitada pelos deputados',
  234: 'Votação adiada',
  250: 'Retirada da pauta de votação',
  128: 'Enviada ao Senado',
  1518: 'Aprovada pelo Senado',
  1519: 'Aprovada pelo Senado com mudanças: voltou para os deputados',
  127: 'Enviada ao Presidente para sancionar ou vetar',
  609: 'Enviada ao Presidente para sancionar ou vetar',
  137: 'Enviada ao Presidente para sancionar ou vetar',
  126: 'Enviada à promulgação',
  608: 'Enviada à promulgação',
  251: 'Virou lei',
  1012: 'Virou lei, com partes vetadas',
  1013: 'Vetada totalmente pelo Presidente',
  134: 'Arquivada',
  502: 'Arquivada',
  1024: 'Arquivada',
  620: 'Perdeu a validade',
  200: 'Retirada pelo autor',
  1241: 'Retirada pelo autor',
  1025: 'Retirada pelo autor',
};

export function marco(t) {
  const cod = Number(t.codTipoTramitacao);
  if (cod === 336 || cod === 240) {
    if (t.siglaOrgao === 'PLEN') return 'Aprovada pelos deputados';
    return `Aprovada na comissão ${t.siglaOrgao}`;
  }
  return MARCOS[cod] || null;
}

/** Passos na ordem em que a proposta percorre o Congresso. */
export function passos({ origem, sigla, etapa }) {
  const primeira = origem === 'senado' ? 'Senadores' : 'Deputados';
  const segunda = origem === 'senado' ? 'Deputados' : 'Senadores';
  const terceira = sigla === 'PEC' ? 'Promulgação' : 'Presidente';
  const rotulos = [primeira, segunda, terceira, sigla === 'PEC' ? 'Na Constituição' : 'Vira lei'];
  let atual;
  if (etapa === 'camara') atual = origem === 'senado' ? 1 : 0;
  else if (etapa === 'senado') atual = origem === 'senado' ? 0 : 1;
  else if (['presidente', 'veto', 'promulgacao'].includes(etapa)) atual = 2;
  else if (etapa === 'lei') atual = 4;
  else atual = -1;
  return rotulos.map((rotulo, i) => ({
    rotulo,
    estado: atual === -1 ? 'falta' : i < atual ? 'feito' : i === atual ? 'atual' : 'falta',
  }));
}

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export function diaPorExtenso(iso) {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  return `${DIAS[dt.getUTCDay()]}, ${d}/${m}`;
}

/** Selo curto e frase "E agora?" de cada proposta. */
export function situacao({ etapa, origem, sigla, votacao, situacaoOficial }) {
  const pec = sigla === 'PEC';
  const final = pec ? 'a promulgação' : 'o Presidente';
  if (votacao) {
    const quem = votacao.quem === 'deputados' ? 'Deputados' : 'Senadores';
    const chip = `${quem} votam ${diaPorExtenso(votacao.data)}`;
    let agora;
    if (sigla === 'MPV') agora = 'Já está valendo, mas perde a validade se não for aprovada a tempo pela Câmara e pelo Senado.';
    else if (votacao.quem === 'deputados')
      agora = origem === 'senado'
        ? `Já passou pelo Senado. Se os deputados aprovarem sem mudanças, falta só ${final}.`
        : `Se os deputados aprovarem, ainda não está decidido: depois vêm o Senado e ${final}.`;
    else
      agora = origem === 'senado'
        ? `Se os senadores aprovarem, ainda não está decidido: depois vêm a Câmara e ${final}.`
        : `Já passou pela Câmara. Se o Senado aprovar sem mudanças, falta só ${final}.`;
    return { chip, agora };
  }
  switch (etapa) {
    case 'camara':
      return { chip: 'Na Câmara', agora: 'Ainda está sendo analisada pelos deputados. Sem data de votação marcada.' };
    case 'senado':
      return { chip: 'No Senado', agora: 'Ainda está sendo analisada pelos senadores. Sem data de votação marcada.' };
    case 'presidente':
      return { chip: 'Com o Presidente', agora: 'Aprovada pelo Congresso. O Presidente tem 15 dias úteis para aprovar ou vetar.' };
    case 'veto':
      return { chip: 'Vetada · o Congresso decide', agora: 'Deputados e senadores vão decidir se o veto fica ou cai.' };
    case 'promulgacao':
      return { chip: 'Aprovada · falta promulgar', agora: 'Mudanças na Constituição não passam pelo Presidente: o Congresso promulga.' };
    case 'lei':
      return { chip: pec ? 'Entrou na Constituição' : 'Virou lei', agora: 'Já foi decidido.' };
    default:
      return { chip: 'Encerrada', agora: `Não está mais em análise (${(situacaoOficial || 'encerrada').toLowerCase()}).` };
  }
}

/** O que o cidadão ainda pode fazer, conforme a etapa. */
export function acoes(etapa, temEnqueteAberta) {
  if (etapa === 'camara') return { enquete: temEnqueteAberta, falarCom: 'deputados' };
  if (etapa === 'senado') return { enquete: temEnqueteAberta, falarCom: 'senadores' };
  if (etapa === 'veto') return { enquete: false, falarCom: 'ambos' };
  return { enquete: false, falarCom: null };
}

export function slugDe(casa, sigla, numero, ano) {
  return `${casa}/${sigla.toLowerCase()}-${Number(numero)}-${ano}`;
}
