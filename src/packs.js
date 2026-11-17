// Concursos available in the app: the content pack plus the copy that is specific to each one.
import inss from "../app/packs/inss-tecnico-pre.json";

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
