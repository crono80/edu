# CLAUDE.md

Guia para sessões do Claude Code neste repositório. Texto em PT-BR; código e identificadores em inglês.

## Produto

**Cronograma Personalizado para Você**: cronograma de estudos para concursos públicos que começa pelo que
mais cai na prova (edital + provas anteriores), ajustado às horas e ao nível do aluno, e mostra a vantagem
sobre um cronograma genérico (ordem do edital, mesma carga para todos).

- **Concurso:** INSS · Técnico do Seguro Social, pré-edital (pack `inss-tecnico-pre`, único no catálogo).
  O catálogo aceita outros packs; o seletor de concurso no topo só aparece com dois ou mais.
- **Endereço:** https://crono80.github.io/edu/ (MVP) · `/edu/vendas/` (página de vendas). Domínio próprio
  `cronograma80.com.br` (Registro.br, DNS com A/AAAA do GitHub Pages e `www` → `crono80.github.io`; verificado
  na organização). O projeto veio de `thiago-harry/web` (arquivado; o site antigo só redireciona para cá).
- **Venda (decidida em 20/11/2026):** pagamento único na Kiwify, garantia de 7 dias (CDC art. 49), acesso até a
  data da prova, atualização do pack quando o edital sair (mesmo cargo) nos dois planos. Sem preço "de".
  - **Essencial R$ 37:** agenda completa, nível declarado por matéria, PDF (o aluno gera uma vez por carga:
    Normal, Hard, Super hard).
  - **Completo R$ 97:** tudo do Essencial + simulado de nivelamento, progresso (✓), "Reorganizar agenda",
    Google Agenda e `.ics`.
  - **Upgrade R$ 60:** Essencial → Completo pela diferença.
  - **Demonstração (sem compra):** como funciona, vantagem, seu tempo, top 80%, dossiê e só a 1ª semana da agenda.

## Arquitetura

| Caminho | Papel |
|---|---|
| `src/` | MVP: React 18 + Vite 6 + Tailwind v4 + lucide-react |
| `src/App.jsx` | UI inteira (arquivo único) |
| `src/plan.js` | Camada de produto sobre o engine: pontos esperados, top 80%, genérico × personalizado, capacidade, blocos, `.ics`, eventos do Google |
| `src/gcal.js` | Google Calendar API v3 direto do navegador (token GIS, cria agenda, sincroniza) |
| `src/pdf.js` | PDF A4 (jsPDF + autotable, carregado só no clique) |
| `src/packs.js` | Catálogo de concursos: pack + textos específicos (dossiê, unidade "itens"/"questões") |
| `src/config.js` | `GOOGLE_CLIENT_ID`, `SUPABASE_URL`/`SUPABASE_KEY` (publishable), `CHECKOUT` (links da Kiwify), `SALES_URL`, `SUPPORT_EMAIL`; nada secreto |
| `src/access.js` | Login Google (botão GIS → `signInWithIdToken` no Supabase) e `useAccess()` → plano via RPC `my_plan` |
| `src/access-rules.js` | **O que cada plano libera** (`capabilities`), puro e testado em `src/access.test.js` |
| `src/gis.js` | Carrega o Google Identity Services uma vez (login e Google Agenda) |
| `supabase/schema.sql` | Tabelas `products` (produto Kiwify → plano/concurso) e `purchases`, RLS, função `my_plan()` |
| `supabase/functions/kiwify-webhook/` | Edge Function do webhook da Kiwify (assinatura HMAC-SHA1 em `?signature=`) |
| `src/palette.js` | **Fonte única das cores** (temas claro e escuro, cores das matérias); `theme.js` e `pdf.js` leem daqui |
| `src/plan.test.js` | Testes da camada de produto (`.ics`, fuso, ids do Google, pré-requisitos) |
| `engine/` | Engine determinístico, puro, sem DOM (schema, score, allocate, revision, explain, quiz, dates) + `engine.test.js`. O MVP importa daqui |
| `packs/*.json` | Content packs **gerados** pelo pack builder; `_schema.json` gerado de `PACK_SCHEMA` (teste garante sincronia); `_fixture.json` sintético (testes) |
| `packs-src/<concurso>/` | Fontes curadas: `config.json`, `overrides.json` (cargas, tipos, pré-requisitos, materiais), `work/assuntos.json`, `work/classification.json`, `review.md` |
| `tools/pack-builder/` | CLI offline: `init → extract → parse → classify → assemble` gera `packs/<id>.json` (detalhes no README da pasta) |
| `tools/engine-report.js` | Tabela de prioridades + primeiras semanas do pack sintético |
| `public/vendas/` | Página de vendas estática (HTML com CSS inline + `img/*.webp`); o Vite copia `public/` para `dist/` |
| `tools/vendas-shots.cjs` | Recaptura as telas do MVP usadas na página de vendas e atualiza `width`/`height` dos `<img>` |

Fora do git: `packs-src/*/input/` (PDFs de edital e provas), `work/*.lines.json`, `dist/`. O texto
extraído do edital e dos gabaritos do INSS (`work/*.txt`) está versionado.

## Comandos

```bash
npm ci                    # dependências (Node 22)
npm run dev               # http://localhost:5173
npm run build             # dist/
npm run preview           # serve dist/ em http://localhost:4173 (página de vendas em /vendas/)
npm test                  # engine (24) + pack builder (10) + app (11)
npm run test:engine       # node --test engine/engine.test.js
npm run test:builder      # node --test tools/pack-builder/test/builder.test.js (precisa de pdftotext)
npm run test:app          # TZ=UTC node --test src/plan.test.js src/access.test.js
npm run report:engine     # tabela de prioridades + primeiras semanas
npm run shots:vendas      # refaz public/vendas/img/*.webp (precisa de npm run build + npm run preview rodando)
node tools/pack-builder/cli.js assemble packs-src/inss-tecnico   # regenera o pack depois de editar packs-src
```

`extract` usa `pdftotext` (poppler) por padrão; `classify` usa `ANTHROPIC_API_KEY` e é opcional
(a classificação pode ser escrita à mão em `work/classification.json`).

## Publicação

1. Push em `main` dispara `.github/workflows/publish.yml`. Ele só roda se mudar `engine/**`, `packs/**`,
   `src/**`, `public/**`, `index.html`, `vite.config.js`, `package*.json` ou o próprio workflow; também tem
   `workflow_dispatch`. Pasta nova fora dessa lista não publica: inclua no filtro `paths`.
2. Job `build`: `npm ci`, `npm run test:engine && npm run test:app`, `npm run build`, envia `dist/` como
   artefato do Pages. Job `deploy`: `actions/deploy-pages` no ambiente `github-pages`.
3. Exige Settings → Pages → Build and deployment → Source: **GitHub Actions** (só o dono do repositório
   altera). Vite com `base: "./"`: o build funciona em qualquer caminho.

Para confirmar uma publicação: o run "Publish to GitHub Pages" do commit no `main` termina com `success`
nos dois jobs. O ambiente cloud não acessa `github.io`.

## Decisões tomadas

**Metodologia**
- Prioridade `P = (0,35·F + 0,20·B + 0,45·E) · (1 + G) · M`: F = histórico do cargo, B = banca,
  E = peso no edital, G = lacuna do aluno.
- **Top 80%:** guloso por pontos esperados por hora no nível do aluno; horas = base · (0,6 + 0,8·G).
  Um assunto entra junto com os pré-requisitos que faltam (vale a taxa do grupo), então o top é fechado
  por pré-requisitos; no dossiê, o assunto puxado mostra "base para X" (`plan.studyGroups`).
  **Genérico:** ordem do edital com a mesma carga por assunto.
- **Ordem da agenda:** topológica por pré-requisitos, empate por P e depois pela ordem do edital,
  alternando matérias. Um assunto só abre depois que a teoria dos pré-requisitos termina. O grafo é curado
  em `packs-src/<concurso>/overrides.json`, do básico ao avançado (ex.: classes → sintaxe → regência →
  crase; segurados → filiação → carência → benefícios). Cada assunto:
  videoaula → leitura → exercícios. Revisões em 1/7/21/60 dias, folga de 10% por semana, reta final nos
  últimos 15% dos dias, simulados com a duração da prova.
- **Carga:** padrão Hard (23h/sem). "Reajustar" aplica o nivelamento e sugere a menor carga que cobre o
  top 80% até a prova, se couber em Hard; 45h/sem aparece só como referência. Modos do MVP: Normal 14h,
  Hard 23h, Super hard 37h.
- **Cebraspe certo/errado:** erro anula acerto, nota líquida, opção "deixar em branco".
- **Progresso** só na plataforma (✓ por bloco). "Reorganizar agenda" tira o estudado e redistribui o
  resto de hoje até a prova.

**Visual**
- Paleta **Índigo e âmbar**: acento `#4338ca`, fundo `#f4f4f9`, âmbar `#ffd166` só como destaque atrás do
  texto. Valores em `src/palette.js`; a página de vendas repete os do tema claro à mão.
- Gráficos: "seu cronograma" na cor da marca (`--series-mine`), "genérico" em cinza (`--series-generic`).
- Não mudam com a marca: cores de estado (verde = estudado/100%, vermelho = atrasado/reta final,
  âmbar = revisão) e as 9 cores das matérias (`--s1`…`--s9`, testadas para daltonismo).
- Contraste WCAG AA nos dois temas: texto ≥ 4,5:1, linhas e contornos ≥ 3:1.

**MVP**
- Ordem da página: Como funciona → Vantagem → Seu tempo → Agenda → Nível + simulado → Top 80% → Dossiê.
- **Vantagem** mostra tempo, não itens: horas a menos para dominar 80% da prova, semanas de antecedência
  e as datas em que cada cronograma chega a 80% (`plan.dateToCover`), com a diferença marcada no gráfico.
- Estado no `localStorage` (`cpv:<packId>:v1`); concurso por `?concurso=<id>`, depois `cpv:concurso`,
  depois o padrão (INSS). O `localStorage` é por origem: o progresso salvo no site antigo não passa para o novo.
- **Fuso:** sempre horário de Brasília (`America/Sao_Paulo`). O `.ics` grava UTC calculado a partir de
  −03:00 fixo, com `X-WR-TIMEZONE:America/Sao_Paulo`.
- **Google Agenda:** token client do Google Identity Services, escopo `calendar.app.created`. Os ids dos
  eventos são determinísticos (base32hex), com `extendedProperties.private.cpv = "1"`. Envia os blocos
  planejados de hoje até a prova e, no passado, só os estudados (✓, verde).
  - O client ID é público e fica em `src/config.js`. A chave secreta nunca é usada nem pedida.
  - Escopos declarados no Google Cloud: só não confidenciais (`openid`, `userinfo.email`, `userinfo.profile`,
    `calendar.app.created`), então publicar não exige verificação. Publicar exige página inicial e política
    de privacidade no domínio. Nome do app na tela do Google: "Cronograma Personalizado".
  - Origens autorizadas: `https://thiago-harry.github.io`, `https://crono80.github.io`, `https://cronograma80.com.br`.

**Acesso pago**
- Kiwify → webhook (`compra_aprovada`, `compra_reembolsada`, `chargeback`) → Edge Function `kiwify-webhook`
  (JWT desligado; segredo `KIWIFY_TOKEN` no Supabase) → `purchases`. Reembolso e chargeback são finais.
- Produto novo na Kiwify só libera acesso depois de mapeado em `products` (product_id → plano + concurso).
- O app chama `my_plan(concurso)`; RLS deixa cada usuário ver só as compras do próprio e-mail (Google).
  Login por e-mail/senha desligado no Supabase de propósito (ninguém cria conta com o e-mail de outro).
- O bloqueio é no navegador: o pack continua no JS público. Se aparecer cópia, servir o pack por endpoint.
- Desenvolvimento: `npm run dev` + `?plano=demo|essencial|completo` força o plano (só em dev).

**Conteúdo e vendas**
- Nada de depoimentos inventados nem de preço "de" que não foi praticado.
- A página de vendas fica `noindex` enquanto for protótipo.
- Avisos obrigatórios: pré-edital, sem afiliação com INSS ou Cebraspe, sem garantia de aprovação.
- Números da página de vendas vêm de telas reais do MVP (hoje fixo em 17/11/2026, Português forte,
  Seguridade fraca, após "Reajustar" → 13h/sem). Se o engine ou as cores mudarem, rode `npm run shots:vendas`.
- Provas e gabaritos do Cebraspe vêm do CDN público (`cdn.cebraspe.org.br`). Não contornar bloqueios de
  acesso.

## Como trabalhar aqui

- `main` só recebe mudanças por PR, a partir de branches `claude/...`. Sem force-push.
- Antes de abrir PR: `npm test` e `npm run build`.
- Pack muda em `packs-src/` + `assemble`; nunca edite `packs/*.json` à mão.
- PDFs nunca vão para o git.
- Commits e PRs em PT-BR.
- O dono do projeto não mexe no GitHub: o Claude abre o PR, faz o merge e confirma a publicação (run
  "Publish to GitHub Pages" com `success`). Só Settings do repositório e o Google Cloud ficam com o dono.
- Especificações longas viram arquivo no repositório (ex.: `docs/<tema>.md`), não só mensagem no chat.
- `npm run preview` não pega um build novo com segurança: reinicie o servidor depois de `npm run build`.

## Em aberto

- Domínio no GitHub Pages: recolocar `cronograma80.com.br` em Settings → Pages quando o DNS do Registro.br
  resolver e ativar HTTPS (removido em 20/11 porque o DNS ainda estava em transição).
- Página `/privacidade/` (aguarda nome do controlador e e-mail) → então "Publicar app" no Google Cloud.
- Kiwify: produtos (Essencial, Completo, Upgrade), mapeamento em `products`, webhook e `KIWIFY_TOKEN`;
  depois preencher `CHECKOUT` em `src/config.js` e os links da página de vendas.
- Atualização do pack INSS quando o edital sair.
- PDF: o comparativo ainda mostra "Cobertura com Xh de conteúdo" (%); alinhar ao tempo economizado se o
  dono pedir.
