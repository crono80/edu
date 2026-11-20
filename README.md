# Cronograma Personalizado para Você

Cronograma de estudos para concursos que começa pelo que mais cai na prova (edital + provas anteriores),
ajustado às horas e ao nível do aluno, e mostra a vantagem sobre um cronograma genérico.

Concurso atual: **INSS · Técnico do Seguro Social (pré-edital)**, edital 2022 e provas Cebraspe de 2016 e
2022, 120 itens certo/errado com penalidade. O catálogo aceita mais concursos (`src/packs.js`,
`?concurso=<id>` na URL); o seletor no topo só aparece com dois ou mais.

**Endereço:** https://crono80.github.io/edu/ · página de vendas (protótipo) em `/edu/vendas/`.

```bash
npm ci
npm run dev      # http://localhost:5173
npm test         # engine + pack builder + camada de produto
npm run build    # dist/ (inclui a página de vendas em dist/vendas/)
```

Cada push no `main` que mexe no site roda `.github/workflows/publish.yml`: testes, build e deploy no
GitHub Pages (Source: GitHub Actions).

## Estrutura

| Caminho | Papel |
|---|---|
| `src/` | MVP em React 18 + Tailwind CSS + lucide-react; `plan.js` é a camada de produto (top 80%, genérico × personalizado, blocos, `.ics`, Google Agenda) |
| `engine/` | Engine determinístico e puro: validação do pack, prioridade, alocação semana a semana, revisões, simulado |
| `packs/` | Content packs gerados (`inss-tecnico-pre.json`), schema e pack sintético dos testes |
| `packs-src/` | Fontes curadas de cada pack (assuntos, cargas, pré-requisitos, classificação das questões) |
| `tools/pack-builder/` | CLI offline que gera os packs a partir de edital, provas e gabaritos |
| `public/vendas/` | Página de vendas estática; telas refeitas com `npm run shots:vendas` |

## Como funciona

| Etapa | Entrada | Cálculo |
|---|---|---|
| Dossiê | Edital + provas anteriores do cargo e da banca | Prioridade P = (0,35·cargo + 0,20·banca + 0,45·edital) · (1+lacuna) · M |
| Top 80% | Pontos esperados por assunto ÷ horas no nível do aluno | Assuntos (com seus pré-requisitos) em ordem de pontos por hora até somar 80% da prova |
| Nivelamento | Fraco/Médio/Forte por matéria + simulado com itens reais | Lacuna por assunto |
| Carga | Sugestão, Normal/Hard/Super hard ou horas por dia; data da prova | Capacidade (folga 10%, reta final, revisões, simulados) e % do top 80% coberto |
| Agenda | Escopo top 80% ou edital completo | Do básico ao avançado: um assunto abre depois da teoria dos pré-requisitos; videoaula → leitura → exercícios; revisões 1/7/21/60 dias |
| Progresso | ✓ por bloco | "Reorganizar agenda" redistribui o que falta de hoje até a prova |

Exporta **PDF** e **.ics**, e sincroniza com o **Google Agenda** (escopo `calendar.app.created`, horário de
Brasília). Estado salvo no `localStorage` do navegador.

Decisões, publicação e pendências: `CLAUDE.md`.
