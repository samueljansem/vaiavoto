// Opcional: avisa num canal do Telegram cada votação nova que entrou em "Vem aí".
// Só roda se TELEGRAM_TOKEN (token do bot) e TELEGRAM_CANAL (ex.: @vaiavoto) estiverem definidos.
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';

const { TELEGRAM_TOKEN: token, TELEGRAM_CANAL: canal } = process.env;
if (!token || !canal) {
  console.log('Telegram não configurado; nada a fazer.');
  process.exit(0);
}

const raiz = new URL('../', import.meta.url);
const site = JSON.parse(await readFile(new URL('src/data/site.json', raiz), 'utf8'));
const arqEnviados = new URL('dados/telegram-enviados.json', raiz);
const enviados = existsSync(arqEnviados) ? JSON.parse(await readFile(arqEnviados, 'utf8')) : {};

for (const slug of site.vemAi) {
  const p = site.propostas[slug];
  const chave = `${p.chave}@${p.votacao.data.slice(0, 10)}`;
  if (enviados[chave]) continue;
  const texto = [`🗳️ ${p.chip}`, '', p.titulo, p.resumo || p.agora, '', `Veja como participar: https://vaiavoto.samueljansem.dev/${slug}/`].join('\n');
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: canal, text: texto, disable_web_page_preview: false }),
  });
  if (!r.ok) {
    console.warn(`! ${slug}: ${r.status} ${await r.text()}`);
    continue;
  }
  enviados[chave] = new Date().toISOString();
  console.log(`✓ ${slug}`);
}

await writeFile(arqEnviados, JSON.stringify(enviados, null, 2) + '\n');
