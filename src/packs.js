// Concursos available in the app: the content pack plus the copy that is specific to each one.
import inss from "../app/packs/inss-tecnico-pre.json";
import pmsc from "../app/packs/pmsc-2026-soldado.json";

const prova = (p, i = 0) => p.provas_historico[i] ?? {};

export const CATALOG = [
  {
    pack: inss,
    meta: {
      rotulo: "INSS · Técnico (pré-edital)",
      eyebrow: "Pré-edital · Cebraspe (provável)",
      subtitulo: "conteúdo do edital 2022 · 1.023.494 inscritos em 2022",
      unidade: "itens",
      sigla: "INSS",
      siglaBanca: null,
      especificas: ["seg", "rgps", "benef", "assist", "gestao"],
      dossieDesc: "Edital de 2022 cruzado com as provas de 2016 e 2022 do próprio cargo. Quando o novo edital sair, o pack é refeito.",
      notasMetodo: [
        "Pré-edital: matérias, conteúdo e distribuição de itens seguem o edital de 2022; a divisão dos 70 específicos entre as matérias foi estimada pelas provas de 2016 e 2022.",
        "Formas: círculo = conhecimentos básicos; quadrado = conhecimentos específicos.",
      ],
      curto: {
        port: "Português",
        etica: "Ética",
        dconst: "D. Constitucional",
        dadm: "D. Administrativo",
        info: "Informática",
        rlm: "Raciocínio Lógico",
        seg: "Seguridade e Custeio",
        rgps: "Segurados (RGPS)",
        benef: "Benefícios",
        assist: "Assistência e Especiais",
        gestao: "Gestão Previdenciária",
      },
      fonteItem: (it) => `Prova INSS ${it.ano ?? ""} · Cebraspe · item ${/q(\d+)$/.exec(it.id)?.[1] ?? ""}`,
      quizIntro: "Itens reais das provas do INSS de 2016 e 2022 (Cebraspe), no formato certo ou errado. Como na prova, cada erro anula um acerto: na dúvida, deixe em branco.",
      dossie: {
        banca: {
          titulo: "Cebraspe (provável)",
          linhas: [
            { rotulo: "Provas de referência", texto: "INSS 2022 · Técnico do Seguro Social", url: prova(inss, 0).fonte, extra: "e INSS 2016" },
            { rotulo: "Formato", texto: "certo ou errado; cada erro anula um acerto" },
            "situações hipotéticas aplicando a lei ao caso concreto",
            "banca não confirmada: as duas últimas provas foram do Cebraspe",
          ],
        },
        cargo: {
          titulo: "Técnico do Seguro Social",
          linhas: [
            { rotulo: "Edital 2022", texto: "120 itens: 50 básicos + 70 específicos", url: inss.concurso.fonte_edital },
            { rotulo: "Mínimo para aprovação", texto: "10 pontos em P1, 21 em P2 e 36 no total (nota líquida)" },
            { rotulo: "Remuneração (2022)", texto: "R$ 5.905,79 iniciais · nível médio" },
            "pré-edital: conteúdo e data da prova são estimativas até o novo edital",
          ],
        },
      },
    },
  },
  {
    pack: pmsc,
    meta: {
      rotulo: "PMSC 2026 · Soldado",
      eyebrow: "Caso de estudo · Instituto AOCP",
      subtitulo: `edital real, curado em ${pmsc.concurso.curado_em.split("-").reverse().join("/")}`,
      unidade: "questões",
      sigla: "PMSC",
      siglaBanca: "AOCP",
      dossieDesc: "Edital 2026 cruzado com a prova anterior do cargo e com a prova mais recente da banca para o mesmo cargo.",
      notasMetodo: ["Penal Militar, Legislação Especial e Trânsito não têm prova anterior no histórico usado: a prioridade vem só do edital."],
      curto: {
        dconst: "D. Constitucional",
        dpenal: "D. Penal",
        dpp: "Proc. Penal",
        dpm: "Penal Militar",
        legesp: "Leg. Especial",
        transito: "Trânsito",
        inst: "Leg. Institucional",
        port: "Português",
        info: "Informática",
      },
      fonteItem: (it) => {
        const n = /q(\d+)$/.exec(it.id)?.[1];
        if (it.id.startsWith("pmsc")) return `Prova PMSC ${it.ano ?? ""} · Cebraspe${n ? ` · Q${n}` : ""}`;
        return `Prova PM-PE ${it.ano ?? ""} · AOCP${n ? ` · Q${n}` : ""}`;
      },
      quizIntro: "Questões reais da PMSC 2023 e da AOCP (PM-PE 2024), mais questões geradas por IA para matérias sem prova anterior. Cada questão mostra a origem.",
      dossie: {
        banca: {
          titulo: "Instituto AOCP",
          linhas: [
            { rotulo: "Prova de referência", texto: "PM-PE 2024 · Soldado", url: pmsc.provas_banca?.[0]?.fonte, extra: `${pmsc.provas_banca?.[0]?.total_questoes ?? 60} questões` },
            { rotulo: "Formato", texto: pmsc.notas_banca?.formato_questao ?? "múltipla escolha" },
            ...(pmsc.notas_banca?.estilo ?? []),
            ...(pmsc.notas_banca?.recomendacoes_estudo ?? []),
          ],
        },
        cargo: {
          titulo: pmsc.concurso.cargo,
          linhas: [
            { rotulo: "Edital 2026", texto: `${pmsc.estrutura_prova.total_questoes} questões objetivas, ${pmsc.estrutura_prova.materias.length} matérias`, url: pmsc.concurso.fonte_edital },
            { rotulo: "Prova anterior", texto: "PMSC 2023 · Soldado", url: prova(pmsc, 0).fonte, extra: `Cebraspe · ${prova(pmsc, 0).total_questoes} questões` },
            { rotulo: "Nota de corte estimada", texto: "50% · sem penalidade por erro" },
            "considera só a prova objetiva (sem redação e sem TAF)",
          ],
        },
      },
    },
  },
];

export const DEFAULT_PACK_ID = inss.concurso.id;

/** Concurso from ?concurso=<id>, then the last one used, then the default. */
export function selectEntry() {
  let id = null;
  try {
    id = new URLSearchParams(window.location.search).get("concurso");
  } catch {
    /* no window */
  }
  if (!id) {
    try {
      id = localStorage.getItem("cpv:concurso");
    } catch {
      /* storage unavailable */
    }
  }
  const entry = CATALOG.find((e) => e.pack.concurso.id === id) ?? CATALOG.find((e) => e.pack.concurso.id === DEFAULT_PACK_ID);
  try {
    localStorage.setItem("cpv:concurso", entry.pack.concurso.id);
  } catch {
    /* storage unavailable */
  }
  return entry;
}
