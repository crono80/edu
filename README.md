# Cronograma Personalizado para Você

MVP do produto com dois concursos (seletor no topo, `?concurso=<id>` na URL):

- **INSS · Técnico do Seguro Social (pré-edital)** — padrão. Edital 2022 e provas Cebraspe de 2016 e 2022, 120 itens certo/errado com penalidade.
- **PMSC 2026 · Soldado** (Instituto AOCP) — caso de estudo com edital real.
 SPA em React 18 + Tailwind CSS + lucide-react, sobre o engine determinístico de `app/src/engine`.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # gera dist/
npm test         # engine + pack builder
```

**No ar:** https://thiago-harry.github.io/web/ (vira `/crono/` quando o repositório for renomeado)

**Página de vendas (protótipo):** https://thiago-harry.github.io/web/vendas/ (HTML estático em `public/vendas/`; preços e checkout em definição)

O GitHub Pages deste repositório publica a pasta `/docs` do branch `gh-pages`.
A cada push no `main`, `.github/workflows/publish.yml` reconstrói o MVP e o publica na raiz do site
(também em `/mvp/`, para links antigos) e copia `app/` para `/app/`. Nenhuma configuração manual do
Pages é necessária.

## Arquivos

| Arquivo | Papel |
|---|---|
| `src/App.jsx` | UI: dossiê, top 80%, nivelamento + simulado, prazo, agenda, comparativo |
| `src/plan.js` | Camada de produto sobre o engine: pontos esperados, top 80%, genérico × personalizado, capacidade por data, blocos de videoaula/leitura/exercícios, `.ics` |
| `src/pdf.js` | PDF A4 completo (jsPDF, carregado só no clique) |
| `src/palette.js` | Paleta "Índigo e âmbar": fonte única das cores (claro, escuro, matérias), usada por `theme.js` e `pdf.js` |
| `src/theme.js` | CSS e classes `cg-*` (cores vêm de `palette.js`) |
| `src/packs.js` | Catálogo de concursos: pack + textos específicos (dossiê, siglas, unidade "questões"/"itens") |
| `app/packs/inss-tecnico-pre.json` | Pack INSS gerado de `packs-src/inss-tecnico/` (pré-edital) |
| `app/packs/pmsc-2026-soldado.json` | Pack PMSC gerado de `packs-src/pmsc-2026/` |
| `public/vendas/index.html` | Protótipo da página de vendas do INSS; o Vite copia `public/` para o build, e ela sai em `/vendas/` |
| `public/vendas/img/` | Telas do MVP em WebP (estado: 10h/semana, Português forte, Seguridade fraca, após "Reajustar"); refeitas com `npm run shots:vendas` |
| `tools/vendas-shots.cjs` | Script da recaptura (Playwright); exige `npm run build` + `npm run preview` rodando |

## Fluxo

Ordem da página: **como funciona** → **vantagem** (genérico × personalizado, com a curva) → **seu tempo** (horas e data) → **agenda preenchida** (mão na massa) → nível e simulado → top 80% → dossiê.

| Etapa | Entrada | Cálculo |
|---|---|---|
| 1 · Dossiê | Edital 2026 + prova PMSC 2023 (Cebraspe) + prova AOCP PM-PE 2024 | Prioridade P = (0,35·cargo + 0,20·banca + 0,45·edital) · (1+lacuna) · M; níveis 1–5 |
| Top 80% | Pontos esperados por assunto ÷ horas no nível do aluno | Assuntos em ordem de pontos por hora até somar 80% da prova |
| 2 · Nivelamento | Fraco/Médio/Forte por matéria + simulado de 40 questões (reais + geradas por IA, marcadas) | Lacuna por assunto (autoavaliação e simulado com encolhimento) |
| Reajustar | Botão no fim do nivelamento | Aplica o nivelamento e calcula a **carga sugerida** (menor carga que cobre 100% do top 80% até a prova). Padrão: a sugestão se couber em Hard (23h/sem); senão, Hard, com a sugestão como referência (teto 45h/sem) |
| 3 · Carga | Sugestão, Normal/Hard/Super hard ou horas por dia; data do edital ou simulada | Capacidade do engine (folga 10%, reta final, revisões, simulados); **% do top 80% coberto** ao vivo e diferença contra a sugestão |
| 4 · Agenda | Escopo top 80% ou edital completo; −/+ 30 min em qualquer dia | Engine aloca semanas (exceções por data); teoria começa com videoaula e segue com leitura; depois exercícios; revisões 1/7/21/60 dias |
| Progresso | ✓ por bloco estudado (também em dias passados) | Atrasados = blocos de dias passados sem ✓. **Reorganizar agenda**: o estudado sai da carga dos assuntos (concluídos ficam só com revisões) e o que falta é redistribuído de hoje até a prova |
| 5 · Resultado | — | No topo: questões no alcance e horas para 80% (genérico × seu). Na seção: três motivos + curva completa |

Exporta **PDF** (parâmetros, prioridades, comparativo, semanas com caixa "Feito", lista de videoaulas) e
**.ics** (Google Agenda › Configurações › Importar e exportar). Estado salvo no `localStorage` do navegador.

## Premissas

- Só prova objetiva (sem redação e sem TAF).
- Penal Militar, Legislação Especial e Trânsito não têm prova anterior no histórico: prioridade só pelo edital.
- Datas e conteúdo seguem o edital curado em 14/11/2026; confira atualizações no edital.

## Próxima geração: `app/`

`app/` é o **Cronograma Personalizado para Você**: content packs por concurso, scoring em três quadros,
alocação determinística e UI em 5 telas, sem build step. No ar em
https://thiago-harry.github.io/web/app/ · detalhes em `app/README.md`.

## Google Agenda

- **Fuso:** tudo em horário de Brasília (`America/Sao_Paulo`), independentemente do fuso do aparelho.
- **Progresso:** marcado só na plataforma. Para o Google vão os blocos de hoje em diante ainda não estudados e, no passado, só os que o aluno marcou como estudados (título com ✓, cor verde).
- **.ics:** mesma regra, para importar numa agenda nova.
- **Sincronização direta** (`src/gcal.js`): login Google Identity Services, escopo `calendar.app.created` (o app só enxerga a agenda que ele mesmo cria). Ids fixos por evento: sincronizar de novo só insere, altera ou remove o que mudou. Envia a agenda até a prova (`GOOGLE_SYNC_DAYS = null`; um número limita a janela de dias) + tudo que foi estudado.
- **Ativar:** colocar o ID do cliente OAuth em `src/config.js` (`GOOGLE_CLIENT_ID`); vazio = botão oculto. O ID é público; a chave secreta não é usada.
