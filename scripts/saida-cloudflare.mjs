// Monta a "Build Output" do cf a partir do site estático gerado pelo Astro (./dist),
// para publicar com `cf deploy --prebuilt`, sem Worker e sem ferramentas extras.
// Formato: .cloudflare/output/v0/{config.json, workers/default/{worker.config.json, assets/}}
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import config from '../cloudflare.config.ts';

const saida = new URL('../.cloudflare/output/v0/', import.meta.url);
const worker = new URL('workers/default/', saida);

await rm(saida, { recursive: true, force: true });
await mkdir(worker, { recursive: true });
await writeFile(new URL('config.json', saida), JSON.stringify({ buildContext: { isPreview: false } }));
await writeFile(new URL('worker.config.json', worker), JSON.stringify(config.worker));
await cp(new URL('../dist/', import.meta.url), new URL('assets/', worker), { recursive: true });
console.log('Build Output pronta em .cloudflare/output/v0');
