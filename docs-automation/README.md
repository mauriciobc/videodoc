# Docs Automation — Tutorial Auth Flow (Mealtime)

Exemplo de vídeo tutorial do fluxo de login usando [mealtime.app.br](https://mealtime.app.br/) como alvo.

## Estrutura

- **journeys/auth-flow.spec.js** — Playwright: navega no site, captura landing, tela de login e formulário preenchido.
- **compositions/AuthFlow.jsx** — Remotion: monta o vídeo (Intro, ScreenFrames, Captions, Outro).
- **fixtures/seed-data.js** — Dados usados para preencher e-mail/senha no journey.
- **render.mjs** — Script de render via SSR API (contorna conflito de alias webpack no monorepo).
- **video-config.js** — Constantes de vídeo (FPS, WIDTH, HEIGHT) — separadas do `remotion.config.js`.

## Comandos (na raiz do repositório)

| Script | Descrição |
|--------|-----------|
| `npm run docs:screenshots` | Roda o journey Playwright e gera screenshots em `docs-output/screenshots/auth-flow/` |
| `npm run docs:preview` | Abre o Remotion Studio para pré-visualizar a composition |
| `npm run docs:render` | Renderiza a composition AuthFlow em `docs-output/AuthFlow.mp4` |
| `npm run docs:generate` | Screenshots + render em sequência |

## Pré-requisitos

- `npm install` na raiz (inclui `@playwright/test`, `@remotion/cli`, `remotion`, `react`, `react-dom`).
- Chromium para Playwright: `npx playwright install chromium`.

### Credenciais para voiceover (opcional)

Para gerar narração em pt-BR com Google Cloud TTS, crie um arquivo **`.env` na raiz do repositório** (ao lado de `package.json`):

```bash
cp .env.example .env
# Edite .env e preencha uma das opções:
#   GOOGLE_APPLICATION_CREDENTIALS=/caminho/absoluto/para/service-account.json
#   GOOGLE_TTS_API_KEY=sua-api-key
```

O `dotenv` é carregado por `render.mjs` e pelo `voiceover-pipeline.js`; como os comandos são executados a partir da raiz, o `.env` deve ficar na raiz. Sem credenciais, o render continua funcionando — o vídeo é gerado sem áudio.

## Detalhes técnicos

### Por que `render.mjs` em vez de `npx remotion render`?

O `@remotion/bundler` define internamente um alias webpack:
```
'@remotion/studio' → dist/index.js
```

Em um monorepo npm workspaces, esse alias "engole" subpath imports como `@remotion/studio/renderEntry` porque o webpack concatena o arquivo alvo com o subpath (`dist/index.js/renderEntry`), ignorando o campo `exports` do package.json.

O `render.mjs` usa a **SSR API** (`bundle()` + `renderMedia()`) e injeta um `webpackOverride` que:
1. Remove o alias genérico `@remotion/studio`
2. Adiciona um alias **exact-match** `@remotion/studio$` para preservar o import direto do pacote
3. Aponta `@remotion/studio/renderEntry` para o arquivo ESM correto (`dist/esm/renderEntry.mjs`)

### Por que `video-config.js` separado do `remotion.config.js`?

O `remotion.config.js` importa `@remotion/cli/config`, que puxa `@remotion/studio-server` → `@remotion/bundler`. Se importado pela composition (via `Root.jsx`), o webpack tenta empacotar código Node.js dentro do bundle do browser — causando falhas de resolução de módulos como `path` e `fs`.

A solução é nunca importar `remotion.config.js` nas compositions. Use `video-config.js` para constantes de vídeo.
