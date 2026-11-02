# Como ajudar

- **Achou um erro?** Abra uma issue dizendo a página, o que aparece e o que deveria aparecer.
- **Regras:** o que entra no site, a ordem, as etapas e as ações sugeridas ficam em `scripts/lib/regras.mjs`. Mudou uma regra? Atualize também `src/pages/regras.astro`, para a regra pública continuar igual à que o código aplica.
- **Textos:** o site não escreve resumos próprios. Ele usa o que a Câmara e o Senado publicam (veja o README).

## Código

- `scripts/coletar.mjs`: coleta os dados oficiais.
- `scripts/lib/`: acesso às APIs e páginas da Câmara e do Senado, e as regras públicas.
- `src/`: o site (Astro), incluindo as imagens de compartilhamento (`src/lib/og.ts`).
