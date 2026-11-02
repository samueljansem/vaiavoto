import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://vaiavoto.samueljansem.dev',
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
});
