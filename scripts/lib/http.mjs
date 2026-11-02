// Acesso HTTP educado: timeout, novas tentativas e limite de requisições simultâneas.

const UA = 'VaiAVoto/0.1 (+https://vaiavoto.samueljansem.dev; projeto cívico de código aberto)';

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function buscar(url, { tipo = 'json', tentativas = 3, timeout = 30000 } = {}) {
  let ultimoErro;
  for (let i = 0; i < tentativas; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { 'User-Agent': UA, Accept: tipo === 'json' ? 'application/json' : 'text/html' },
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
      return tipo === 'json' ? await res.json() : await res.text();
    } catch (e) {
      ultimoErro = e;
      await espera(1000 * (i + 1) ** 2);
    } finally {
      clearTimeout(t);
    }
  }
  throw ultimoErro;
}

export const json = (url, opts) => buscar(url, { ...opts, tipo: 'json' });
export const html = (url, opts) => buscar(url, { ...opts, tipo: 'html' });

/** Executa `fn` sobre cada item com no máximo `limite` chamadas ao mesmo tempo. */
export async function emLotes(itens, limite, fn) {
  const resultados = new Array(itens.length);
  let proximo = 0;
  async function trabalhador() {
    while (proximo < itens.length) {
      const i = proximo++;
      try {
        resultados[i] = await fn(itens[i], i);
      } catch (e) {
        console.warn(`  ! falhou (${e.message})`);
        resultados[i] = null;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, trabalhador));
  return resultados;
}

/** Converte HTML em linhas de texto limpas (para extrair números de páginas sem API). */
export function textoDoHtml(h) {
  return h
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

export const numeroBR = (s) => Number(String(s).replace(/\./g, '').replace(',', '.'));
