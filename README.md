# Vai a Voto

**O que deputados e senadores vão votar nos próximos dias, e como você pode participar antes da votação.**

🔗 https://vaiavoto.samueljansem.dev

O Vai a Voto junta, num lugar só e sem jargão:

- **Vem aí**: as votações marcadas no Plenário da Câmara e do Senado para os próximos 7 dias.
- **Em alta**: as propostas em que mais gente está opinando nas enquetes oficiais nos últimos 7 dias.
- **Faça sua parte**: em cada proposta, as ações que ainda fazem sentido naquela etapa:
  1. votar na enquete oficial,
  2. falar com os deputados ou senadores do seu estado (mensagem pronta, e-mail e telefone oficiais),
  3. chamar mais gente pelo WhatsApp.

Sem servidor, sem banco de dados, sem login e sem coleta de dados pessoais. Custo: zero.

## Como funciona

```
GitHub Action (várias vezes ao dia)
  └─ npm run coletar   → APIs da Câmara e do Senado + páginas das enquetes
       ├─ src/data/site.json       (tudo que o site mostra)
       ├─ public/contatos.json     (contatos oficiais dos parlamentares)
       └─ dados/enquetes/AAAA-MM-DD.json  (total de votos por dia → "Em alta")
  └─ npm run build     → site estático (Astro) + saída para o cf
  └─ cf deploy --prebuilt → Cloudflare (arquivos estáticos, plano gratuito)
```

- **Regras mecânicas e públicas**: o que entra, a ordem, a etapa e as ações sugeridas saem dos dados oficiais por regras fixas, sem escolha editorial. Estão em [`scripts/lib/regras.mjs`](scripts/lib/regras.mjs) e explicadas em [/regras](https://vaiavoto.samueljansem.dev/regras/).
- **Fontes**: [Dados Abertos da Câmara](https://dadosabertos.camara.leg.br), [enquetes da Câmara](https://www.camara.leg.br/enquetes), [Dados Abertos do Senado](https://legis.senado.leg.br/dadosabertos) e [e-Cidadania](https://www12.senado.leg.br/ecidadania). As enquetes não têm API: os números são lidos das páginas públicas, uma vez a cada execução.

## Rodar localmente

Requer Node.js 22.18 ou mais novo.

```sh
npm install
npm run coletar     # busca os dados (≈1 minuto; PULAR_CONTATOS=1 para pular os contatos)
npm run dev         # http://localhost:4321
```

## Publicar

```sh
npx cf login        # uma vez
npm run deploy      # gera o site e publica com cf deploy --prebuilt
```

A configuração da Cloudflare está em [`cloudflare.config.ts`](cloudflare.config.ts). O site é 100% estático: `scripts/saida-cloudflare.mjs` monta a pasta que o `cf` publica a partir do `dist/` do Astro.

### Atualização automática

A Action [`atualizar.yml`](.github/workflows/atualizar.yml) precisa de dois segredos no repositório:

| Segredo | Onde conseguir |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Painel da Cloudflare → My Profile → API Tokens → modelo “Edit Cloudflare Workers” |
| `CLOUDFLARE_ACCOUNT_ID` | Painel da Cloudflare → Workers & Pages (barra lateral) |

Opcional: `TELEGRAM_TOKEN` (segredo) e `TELEGRAM_CANAL` (variável, ex.: `@vaiavoto`) para avisar cada votação nova num canal.

## Textos das propostas

O Vai a Voto não escreve nem resume propostas: mostra o nome oficial, a ementa e as explicações que a própria Câmara (Agência Câmara, na página da enquete) e o Senado (“Entenda a proposta”, no e-Cidadania) publicam. Sem explicação oficial, aparece só a ementa.

## Como ajudar

Veja [CONTRIBUTING.md](CONTRIBUTING.md).

## Licença

[MIT](LICENSE). Os dados são públicos e pertencem às fontes oficiais.
