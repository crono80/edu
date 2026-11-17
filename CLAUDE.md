# CLAUDE.md

Guia para sessões do Claude Code neste repositório. Texto em PT-BR; código e identificadores em inglês.

## Produto

**Cronograma Personalizado para Você**: cronograma de estudos para concursos públicos que começa pelo que
mais cai na prova (edital + provas anteriores), ajustado às horas e ao nível do aluno, e mostra a vantagem
sobre um cronograma genérico (ordem do edital, mesma carga para todos).

- **Caso principal:** INSS · Técnico do Seguro Social, pré-edital (pack `inss-tecnico-pre`, padrão).
  **Caso de estudo:** PMSC 2026 · Soldado (`pmsc-2026-soldado`).
- **No ar:** https://thiago-harry.github.io/web/ (MVP) · `/web/vendas/` (página de vendas, protótipo) ·
  `/web/app/` (app vanilla de próxima geração).
- **Venda (sugerida, não confirmada):** Essencial R$ 37 (de R$ 47), Completo R$ 97, checkout Kiwify ou
  Hotmart, garantia de 7 dias (CDC art. 49).

## Arquitetura

| Caminho | Papel |
|---|---|
| `src/` | MVP no ar: React 18 + Vite 6 + Tailwind v4 + lucide-react |
| `src/App.jsx` | UI inteira (arquivo único) |
| `src/plan.js` | Camada de produto sobre o engine: pontos esperados, top 80%, genérico × personalizado, capacidade, blocos, `.ics`, eventos do Google |
| `src/gcal.js` | Google Calendar API v3 direto do navegador (token GIS, cria agenda, sincroniza) |
| `src/pdf.js` | PDF A4 (jsPDF + autotable, carregado só no clique) |
| `src/packs.js` | Catálogo de concursos: pack + textos específicos (dossiê, unidade "itens"/"questões") |
| `src/config.js` | `GOOGLE_CLIENT_ID` (público) e `GOOGLE_SYNC_DAYS` (`null` = até a prova) |
| `src/plan.test.js` | Testes da camada de produto (`.ics`, fuso, ids do Google) |
| `app/src/engine/` | Engine determinístico, puro, sem DOM (schema, score, allocate, revision, explain, quiz, dates). O MVP importa daqui |
| `app/packs/*.json` | Content packs **gerados** pelo pack builder; `_schema.json` gerado de `PACK_SCHEMA` (teste garante sincronia); `_fixture.json` sintético |
| `app/index.html`, `app/src/ui/` | App vanilla sem build step, publicado em `/app/` (detalhes em `app/README.md`) |
| `packs-src/<concurso>/` | Fontes curadas: `config.json`, `overrides.json` (cargas, tipos, pré-requisitos, materiais), `work/assuntos.json`, `work/classification.json`, `review.md` |
| `tools/pack-builder/` | CLI offline: `init → extract → parse → classify → assemble` gera `app/packs/<id>.json` (detalhes no README da pasta) |
| `public/vendas/` | Página de vendas estática (HTML com CSS inline + `img/*.webp`); o Vite copia `public/` para `dist/` |

Fora do git: `packs-src/*/input/` (PDFs de edital e provas), `work/*.txt`, `work/*.lines.json`, `dist/`.

## Comandos

```bash
npm ci                    # dependências (Node 22)
npm run dev               # http://localhost:5173
npm run build             # dist/
npm run preview           # serve dist/ em http://localhost:4173 (página de vendas em /vendas/)
npm test                  # engine (24) + pack builder (10) + app (4)
npm run test:engine       # node --test app/tests/engine.test.js
npm run test:builder      # node --test tools/pack-builder/test/builder.test.js
npm run test:app          # TZ=UTC node --test src/plan.test.js
npm run report:engine     # tabela de prioridades + primeiras semanas
node tools/pack-builder/cli.js assemble packs-src/inss-tecnico   # regenera o pack depois de editar packs-src
```

`extract` usa `pdftotext` (poppler) por padrão; `classify` usa `ANTHROPIC_API_KEY` e é opcional
(a classificação pode ser escrita à mão em `work/classification.json`).

## Publicação

1. Push em `main` dispara `.github/workflows/publish.yml`. Ele só roda se mudar `app/**`, `src/**`,
   `public/**`, `index.html`, `vite.config.js`, `package*.json` ou o próprio workflow; também tem
   `workflow_dispatch`. Pasta nova fora dessa lista não publica: inclua no filtro `paths`.
2. O workflow faz `npm ci && npm run build`, copia `dist/` para a raiz de `docs/` (e para `docs/mvp/`),
   `app/` para `docs/app/`, e faz commit `Publish from main <sha7>` no branch `SITE_BRANCH`
   (`gh-pages`).
3. O GitHub Pages serve `/docs` desse branch em https://thiago-harry.github.io/web/ (Vite com `base: "./"`).

Para confirmar uma publicação: o commit `Publish from main <sha7>` aparece no `SITE_BRANCH` e o run
"pages build and deployment" termina com `success`. O ambiente cloud não acessa `github.io`.

## Decisões tomadas

**Metodologia**
- Prioridade `P = (0,35·F + 0,20·B + 0,45·E) · (1 + G) · M`: F = histórico do cargo, B = banca,
  E = peso no edital, G = lacuna do aluno.
- **Top 80%:** guloso por pontos esperados por hora no nível do aluno; horas = base · (0,6 + 0,8·G).
  **Genérico:** ordem do edital com a mesma carga por assunto.
- **Ordem da agenda:** topológica por pré-requisitos, empate por P, alternando matérias. Cada assunto:
  videoaula → leitura → exercícios. Revisões em 1/7/21/60 dias, folga de 10% por semana, reta final nos
  últimos 15% dos dias, simulados com a duração da prova.
- **Carga:** padrão Hard (23h/sem). "Reajustar" aplica o nivelamento e sugere a menor carga que cobre o
  top 80% até a prova, se couber em Hard; 45h/sem aparece só como referência. Modos do MVP: Normal 14h,
  Hard 23h, Super hard 37h.
- **Cebraspe certo/errado:** erro anula acerto, nota líquida, opção "deixar em branco".
- **Progresso** só na plataforma (✓ por bloco). "Reorganizar agenda" tira o estudado e redistribui o
  resto de hoje até a prova.

**MVP**
- Ordem da página: Como funciona → Vantagem → Seu tempo → Agenda → Nível + simulado → Top 80% → Dossiê.
- Estado no `localStorage` (`cpv:<packId>:v1`); concurso por `?concurso=<id>`, depois `cpv:concurso`,
  depois o padrão (INSS).
- **Fuso:** sempre horário de Brasília (`America/Sao_Paulo`). O `.ics` grava UTC calculado a partir de
  −03:00 fixo, com `X-WR-TIMEZONE:America/Sao_Paulo`.
- **Google Agenda:** token client do Google Identity Services, escopo `calendar.app.created`. Os ids dos
  eventos são determinísticos (base32hex), com `extendedProperties.private.cpv = "1"`. Envia os blocos
  planejados de hoje até a prova e, no passado, só os estudados (✓, verde).
  - O client ID é público e fica em `src/config.js`. A chave secreta nunca é usada nem pedida.
  - O app está em modo Teste no Google Cloud: só usuários de teste conseguem logar. Produção exige a
    verificação do Google (e, provavelmente, domínio próprio).
  - A origem autorizada é `https://thiago-harry.github.io`. Renomear o repositório só muda o caminho e não
    exige mudança; domínio próprio exige cadastrar a nova origem no Google Cloud.

**Conteúdo e vendas**
- Nada de depoimentos inventados nem de preço "de" que não foi praticado.
- A página de vendas fica `noindex` enquanto for protótipo.
- Avisos obrigatórios: pré-edital, sem afiliação com INSS ou Cebraspe, sem garantia de aprovação.
- Números da página de vendas vêm de telas reais do MVP (10h/sem, Português forte, Seguridade fraca,
  após "Reajustar"). Se o engine mudar, recapture as telas.
- Provas e gabaritos do Cebraspe vêm do CDN público (`cdn.cebraspe.org.br`). Não contornar bloqueios de
  acesso.

## Como trabalhar aqui

- `main` só recebe mudanças por PR, a partir de branches `claude/...`. Sem force-push.
- Antes de abrir PR: `npm test` e `npm run build`.
- Pack muda em `packs-src/` + `assemble`; nunca edite `app/packs/*.json` à mão.
- PDFs nunca vão para o git.
- Commits e PRs em PT-BR.

## Em aberto

- Ordenação do básico ao avançado: completar o grafo de pré-requisitos, puxar pré-requisitos para o top
  80%, exigir a teoria do pré-requisito concluída, usar a ordem do edital como desempate (aguardando ok).
- Renomear o repositório `web` → `crono` (ou usar domínio próprio).
- Verificação do Google, checkout, preços finais, atualização do pack INSS quando o edital sair.
