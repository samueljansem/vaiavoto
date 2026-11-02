import { defineConfig } from "cf/config";

// Configuração do Cloudflare CLI (cf).
// O site é 100% estático (gerado pelo Astro), então não há código de Worker:
// a Cloudflare só serve os arquivos de ./dist (definido em wrangler.config.ts).
export default defineConfig({
	worker: {
		name: "vaiavoto",
		compatibilityDate: "2026-11-01",
		workersDev: true,
		domains: ["vaiavoto.samueljansem.dev"],
		assets: {
			htmlHandling: "auto-trailing-slash",
			notFoundHandling: "404-page",
		},
	},
});
