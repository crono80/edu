// Product layer over the engine (app/src/engine): pareto of the exam, generic vs
// personalized coverage, display blocks (videoaula / leitura / exercícios), ICS.
// Pure functions; React only renders what these return.
import { generate, score } from "../app/src/engine/index.js";
import { sampleQuiz, scoreQuiz } from "../app/src/engine/quiz.js";
import { normalizeAvailability, buildCalendar, planMocks, estimateReserves, ALLOCATION_DEFAULTS } from "../app/src/engine/allocate.js";

export { sampleQuiz, scoreQuiz, score };

export const STRENGTHS = [
  { id: "fraco", label: "Fraco", auto: 1 },
  { id: "medio", label: "Médio", auto: 2 },
  { id: "forte", label: "Forte", auto: 3 },
];
const STRENGTH_AUTO = Object.fromEntries(STRENGTHS.map((s) => [s.id, s.auto]));

export const MODES = {
  normal: { label: "Normal", hours: { seg: 2, ter: 2, qua: 2, qui: 2, sex: 2, sab: 4, dom: 0 } },
  hard: { label: "Hard", hours: { seg: 3, ter: 3, qua: 3, qui: 3, sex: 3, sab: 6, dom: 2 } },
  super: { label: "Super hard", hours: { seg: 5, ter: 5, qua: 5, qui: 5, sex: 5, sab: 8, dom: 4 } },
};
export const DAY_KEYS = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];
export const DAY_LABEL = { seg: "Seg", ter: "Ter", qua: "Qua", qui: "Qui", sex: "Sex", sab: "Sáb", dom: "Dom" };

// Share of theory time spent on video vs reading, by topic type.
const AULA_RATIO = { lei_seca: 0.3, memorizacao: 0.3, doutrina: 0.6, jurisprudencia: 0.5, calculo: 0.6, pratica: 0.5 };
export const PARETO_TARGET = 0.8;

const pad = (n) => String(n).padStart(2, "0");
// Every date and time in the product is Brasília time (no DST since 2019: UTC−03:00).
export const TIMEZONE = "America/Sao_Paulo";
export const UTC_OFFSET_MIN = -180;
export const todayISO = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
export const addDaysISO = (iso, n) => {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
};
export const diffDaysISO = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/* ---------------- leveling input ---------------- */

export function nivelamentoInput(pack, strengths, quizScore) {
  const out = {};
  const auto = {};
  for (const a of pack.assuntos) {
    const s = strengths[a.materia_id];
    if (s && STRENGTH_AUTO[s] !== undefined) auto[a.id] = STRENGTH_AUTO[s];
  }
  if (Object.keys(auto).length) out.autoavaliacao = auto;
  if (quizScore && Object.keys(quizScore.porAssunto).length) out.simulado = quizScore.porAssunto;
  return out;
}

/* ---------------- engine call ---------------- */

export function buildPlan({ pack, nivelamento, hours, start, exam, excecoes = {}, concluidos = [] }) {
  return generate({
    pack,
    nivelamento,
    disponibilidade: { horas_por_dia_semana: hours, data_inicio: start, data_prova: exam, bloco_min_minutos: 30, bloco_max_minutos: 90, excecoes },
    options: { allocate: { leftover: "second_pass", accept_cut: true, concluidos } },
  });
}

/* ---------------- expected points and pareto ---------------- */

const materiaPoints = (m) => m.questoes * (m.peso ?? 1);

/** Expected points per topic: matéria points split by the student-independent priority (edital + history). */
export function expectedPoints(pack, scores) {
  const base = (id) => scores.byId[id].base * scores.byId[id].multiplicadores.volatil;
  const sumByMateria = {};
  for (const a of pack.assuntos) sumByMateria[a.materia_id] = (sumByMateria[a.materia_id] ?? 0) + base(a.id);
  const pts = {};
  for (const m of pack.estrutura_prova.materias) {
    for (const a of pack.assuntos.filter((x) => x.materia_id === m.id)) {
      pts[a.id] = sumByMateria[m.id] > 0 ? (materiaPoints(m) * base(a.id)) / sumByMateria[m.id] : 0;
    }
  }
  return pts;
}

/** Hours this student needs for a topic: base load scaled by the gap (1× when there is no leveling). */
export function neededHours(assunto, sc) {
  const f = sc.gap_source === "nenhum" ? 1 : 0.6 + 0.8 * sc.G;
  return assunto.carga_horaria_base * f;
}

/** Topics by expected points per hour this student needs (best return first). */
function efficiencyOrder(pack, scores, pts) {
  const byId = Object.fromEntries(pack.assuntos.map((a) => [a.id, a]));
  const rate = (id) => pts[id] / Math.max(0.25, neededHours(byId[id], scores.byId[id]));
  return pack.assuntos.map((a) => a.id).sort((x, y) => rate(y) - rate(x) || pts[y] - pts[x] || (x < y ? -1 : 1));
}

/**
 * Top of the exam: the smallest study load that reaches `target` of the expected points.
 * Greedy by points per hour, so a cheap law worth half a question beats a long chapter worth one.
 */
export function pareto(pack, scores, target = PARETO_TARGET) {
  const pts = expectedPoints(pack, scores);
  const total = Object.values(pts).reduce((s, v) => s + v, 0);
  const byId = Object.fromEntries(pack.assuntos.map((a) => [a.id, a]));
  const order = efficiencyOrder(pack, scores, pts);
  let cum = 0;
  let cumHours = 0;
  let topCount = 0;
  let topHours = 0;
  const items = order.map((id) => {
    const a = byId[id];
    const sc = scores.byId[id];
    const horas = neededHours(a, sc);
    const inTop = cum / total < target - 1e-9;
    cum += pts[id];
    cumHours += horas;
    if (inTop) {
      topCount += 1;
      topHours += horas;
    }
    return { id, assunto: a, score: sc, pts: pts[id], cumPct: cum / total, horas, cumHours, inTop };
  });
  const top = new Set(items.filter((x) => x.inTop).map((x) => x.id));
  const topPts = items.filter((x) => x.inTop).reduce((s, x) => s + x.pts, 0);
  return { items, total, top, topPts, topCount, topHours, totalHours: cumHours };
}

/* ---------------- generic vs personalized ---------------- */

function curve(steps, total) {
  let h = 0;
  let got = 0;
  const pointsOut = [{ h: 0, pct: 0 }];
  for (const s of steps) {
    h += s.alloc;
    got += s.pts * Math.min(1, s.alloc / s.need);
    pointsOut.push({ h, pct: got / total });
  }
  return pointsOut;
}

export function coverageAt(points, hours) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (hours <= b.h) return a.pct + ((b.pct - a.pct) * (hours - a.h)) / Math.max(b.h - a.h, 1e-9);
  }
  return points[points.length - 1].pct;
}

export function hoursTo(points, pct) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (b.pct >= pct - 1e-9) return a.h + ((b.h - a.h) * (pct - a.pct)) / Math.max(b.pct - a.pct, 1e-9);
  }
  return null;
}

/**
 * Generic plan: edital order, the same base hours for every topic (ignores banca, history and the
 * student). Personalized: best points per hour first (pareto order), each topic gets the hours this student needs.
 * Both are credited against what the student actually needs, so the generic plan wastes time on
 * mastered topics and underserves weak ones.
 */
export function compare(pack, scores) {
  const pts = expectedPoints(pack, scores);
  const total = Object.values(pts).reduce((s, v) => s + v, 0);
  const byId = Object.fromEntries(pack.assuntos.map((a) => [a.id, a]));
  const need = (id) => neededHours(byId[id], scores.byId[id]);
  const generic = curve(pack.assuntos.map((a) => ({ pts: pts[a.id], alloc: a.carga_horaria_base, need: need(a.id) })), total);
  const order = efficiencyOrder(pack, scores, pts);
  const personalized = curve(order.map((id) => ({ pts: pts[id], alloc: need(id), need: need(id) })), total);
  return { generic, personalized, total };
}

/** Raw hours until `exam` and the hours the engine leaves for new content (after buffer, final stretch, mocks, revisions). */
export function capacity(pack, hours, start, exam, nTopics = pack.assuntos.length, excecoes = {}) {
  const cfg = { ...ALLOCATION_DEFAULTS };
  const input = normalizeAvailability({ horas_por_dia_semana: hours, data_inicio: start, data_prova: exam, excecoes }, pack);
  if (!input.ok) return { raw: 0, content: 0 };
  const cal = buildCalendar(input, cfg);
  const mocks = planMocks(cal, cfg, input, pack.estrutura_prova.total_questoes, pack.estrutura_prova.duracao_minutos ?? null);
  return { raw: cal.rawMin / 60, content: estimateReserves(cal, cfg, input, mocks, nTopics).content_min / 60 };
}

export const contentHours = (pack, hours, start, exam, nTopics, excecoes) => capacity(pack, hours, start, exam, nTopics, excecoes).content;

/* ---------------- progress (what the student already studied) ---------------- */

export const CONTENT_ACTIVITIES = new Set(["videoaula", "leitura", "exercicios"]);
export const blockKey = (data, b, i) => `${data}|${b.assunto?.id ?? "simulado"}|${b.atividade}|${i}`;

/** Studied minutes (content only) and last study date per topic, from log entries. */
export function progressOf(entries) {
  const out = {};
  for (const e of entries) {
    if (!e.assunto_id || !CONTENT_ACTIVITIES.has(e.atividade)) continue;
    const p = (out[e.assunto_id] ??= { min: 0, video: 0, theory: 0, last: e.data });
    p.min += e.minutos;
    if (e.atividade === "videoaula") p.video += e.minutos;
    if (e.atividade !== "exercicios") p.theory += e.minutos;
    if (e.data > p.last) p.last = e.data;
  }
  return out;
}

/**
 * The pack the engine should plan after progress: topics in `keep`, loads reduced by what was studied,
 * finished topics (≥ 95% of the hours this student needs) moved to `finished` (revisions only).
 */
export function remainingPack(pack, scores, keep, progress) {
  const finished = [];
  const left = [];
  for (const a of pack.assuntos) {
    if (!keep.has(a.id)) continue;
    const p = progress[a.id];
    const r = p ? Math.max(0, 1 - p.min / 60 / neededHours(a, scores.byId[a.id])) : 1;
    if (r <= 0.05) finished.push({ id: a.id, materia_id: a.materia_id, nome: a.nome, data: p.last });
    else left.push({ ...a, carga_horaria_base: r < 1 ? Math.max(0.5, Math.round(a.carga_horaria_base * r * 4) / 4) : a.carga_horaria_base });
  }
  const ids = new Set(left.map((a) => a.id));
  return {
    pack: {
      ...pack,
      assuntos: left.map((a) => ({ ...a, prereq: a.prereq.filter((x) => ids.has(x)) })),
      nivelamento: { ...pack.nivelamento, itens: pack.nivelamento.itens.filter((it) => ids.has(it.assunto_id)) },
    },
    finished,
  };
}

/**
 * Share of the top 80% covered by what was already studied plus `contentH` hours of new content
 * spent on what is left, best return first (points-weighted).
 */
export function coverageNow(par, cmp, contentH, progress = {}) {
  let studiedPts = 0;
  let studiedH = 0;
  let credited = 0;
  let left = contentH;
  for (const x of par.items) {
    if (!x.inTop) continue;
    const done = Math.min(x.horas, (progress[x.id]?.min ?? 0) / 60);
    studiedPts += (x.pts * done) / x.horas;
    studiedH += done;
    const rem = x.horas - done;
    if (rem > 0 && left > 0) {
      const alloc = Math.min(rem, left);
      credited += (x.pts * alloc) / x.horas;
      left -= alloc;
    }
  }
  const cov = Math.min(1, (studiedPts + credited) / par.topPts);
  const share = par.total > 0 ? par.topPts / par.total : 1;
  return {
    cov,
    pts: cov * par.topPts,
    hours: Math.min(par.topHours, studiedH + contentH),
    studiedH,
    remainingH: Math.max(0, par.topHours - studiedH),
    examPct: Math.max(coverageAt(cmp.personalized, contentH + studiedH), cov * share),
  };
}

// Ceiling for suggestions: 6h on weekdays, 10h on Saturday, 6h on Sunday.
export const LOAD_CAP = Object.freeze({ weekday: 6, sab: 10, dom: 6 });
const halfStep = (x) => Math.round(x * 2) / 2;
const loadPattern = (x, dom) => ({ seg: x, ter: x, qua: x, qui: x, sex: x, sab: Math.min(LOAD_CAP.sab, halfStep(x * 1.5)), dom });
export const weeklyOf = (hours) => DAY_KEYS.reduce((s, k) => s + (hours[k] ?? 0), 0);

/**
 * Lightest weekly load (weekdays x, Saturday 1.5x, Sunday off; Sunday only after weekdays hit the cap)
 * whose content hours cover the whole top 80% by `exam`. When even the cap falls short, returns the cap
 * with feasible = false and the coverage it reaches.
 */
export function suggestLoad({ pack, par, cmp, start, exam, nTopics, excecoes = {}, progress = {} }) {
  const candidates = [];
  for (let x = 0.5; x <= LOAD_CAP.weekday + 1e-9; x += 0.5) candidates.push(loadPattern(x, 0));
  for (let dom = 1; dom <= LOAD_CAP.dom; dom += 1) candidates.push(loadPattern(LOAD_CAP.weekday, dom));
  let pick = null;
  for (const hours of candidates) {
    const cap = capacity(pack, hours, start, exam, nTopics, excecoes);
    const cov = coverageNow(par, cmp, cap.content, progress);
    pick = { hours, weekly: weeklyOf(hours), raw: cap.raw, content: cap.content, cov: cov.cov, feasible: cov.cov >= 0.999 };
    if (pick.feasible) break;
  }
  return pick;
}

/** Earliest exam date whose content hours reach `needH` (binary search, up to 3 years). */
export function dateToCover(pack, hours, start, needH, nTopics, excecoes = {}) {
  const weekly = DAY_KEYS.reduce((s, k) => s + (hours[k] ?? 0), 0);
  if (weekly <= 0 || needH <= 0) return null;
  let lo = 7;
  let hi = 1095;
  if (contentHours(pack, hours, start, addDaysISO(start, hi), nTopics, excecoes) < needH) return null;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (contentHours(pack, hours, start, addDaysISO(start, mid), nTopics, excecoes) >= needH) hi = mid;
    else lo = mid + 1;
  }
  return addDaysISO(start, lo);
}

/* ---------------- display blocks ---------------- */

const parseClock = (s) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : 19 * 60;
};
export const fmtClock = (min) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};
export const fmtMin = (min) => {
  const h = Math.floor(min / 60);
  const r = min % 60;
  if (!h) return `${r}min`;
  return r ? `${h}h${pad(r)}` : `${h}h`;
};

function videoFor(assunto) {
  const list = assunto?.materiais ?? [];
  return list.find((m) => m.tipo === "video") ?? list.find((m) => m.tipo === "busca_video") ?? null;
}

/** Engine blocks -> display blocks with exact times; first-pass theory starts with videoaula, then leitura. */
export function displayWeeks(result, pack, { inicio = "19:00", inicioFds = "09:00", studied = {} } = {}) {
  if (!result?.cronograma) return [];
  const byId = Object.fromEntries(pack.assuntos.map((a) => [a.id, a]));
  // Video budget per topic: a share of its first-pass theory, watched first; the rest is reading.
  const theory = {};
  for (const w of result.cronograma)
    for (const d of w.dias)
      for (const b of d.blocos) if (b.atividade === "teoria" && (b.passada ?? 1) < 2) theory[b.assunto_id] = (theory[b.assunto_id] ?? 0) + b.minutos;
  const videoLeft = {};
  for (const [id, min] of Object.entries(theory)) {
    const ratio = AULA_RATIO[byId[id]?.tipo] ?? 0.5;
    const done = studied[id];
    // video already watched counts against the topic's video share (planned theory + theory already done)
    const total = min + (done?.theory ?? 0);
    videoLeft[id] = total >= 30 ? Math.max(0, Math.max(15, Math.round((total * ratio) / 15) * 15) - (done?.video ?? 0)) : 0;
  }
  return result.cronograma.map((w) => ({
    ...w,
    dias: w.dias.map((d) => {
      const used = d.blocos.reduce((s, b) => s + b.minutos, 0);
      let cursor = Math.max(0, Math.min(parseClock(d.dia_semana === "sab" || d.dia_semana === "dom" ? inicioFds : inicio), 1440 - used));
      const blocks = [];
      const push = (b) => {
        blocks.push({ ...b, start: cursor, end: cursor + b.minutos });
        cursor += b.minutos;
      };
      for (const b of d.blocos) {
        const a = b.assunto_id ? byId[b.assunto_id] : null;
        const common = { assunto: a, materia_id: b.materia_id, motivo: b.motivo, passada: b.passada };
        if (b.atividade === "teoria" && (b.passada ?? 1) < 2 && videoLeft[b.assunto_id] > 0) {
          const aula = Math.min(videoLeft[b.assunto_id], b.minutos);
          videoLeft[b.assunto_id] -= aula;
          push({ ...common, atividade: "videoaula", minutos: aula, video: videoFor(a) });
          if (b.minutos > aula) push({ ...common, atividade: "leitura", minutos: b.minutos - aula });
        } else if (b.atividade === "teoria") push({ ...common, atividade: "leitura", minutos: b.minutos });
        else if (b.atividade === "questoes") push({ ...common, atividade: "exercicios", minutos: b.minutos });
        else push({ ...common, atividade: b.atividade, minutos: b.minutos, intervalo_dias: b.intervalo_dias });
      }
      return { ...d, blocks };
    }),
  }));
}

export const ACTIVITY_LABEL = { videoaula: "Videoaula", leitura: "Leitura", exercicios: "Exercícios", revisao: "Revisão", simulado: "Simulado" };

/* ---------------- ICS (Google Agenda / Apple / Outlook) ---------------- */

const icsEscape = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Brasília wall-clock time -> UTC "YYYYMMDDTHHMMSSZ", whatever the viewer's device time zone is. */
export function icsUtc(iso, minOfDay) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, 0, minOfDay - UTC_OFFSET_MIN, 0));
  return t.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Brasília wall-clock time -> "YYYY-MM-DDTHH:MM:00" for APIs that take { dateTime, timeZone }. */
export function localDateTime(iso, minOfDay) {
  const day = addDaysISO(iso, Math.floor(minOfDay / 1440));
  const mm = ((minOfDay % 1440) + 1440) % 1440;
  return `${day}T${pad(Math.floor(mm / 60))}:${pad(mm % 60)}:00`;
}

/** RFC 5545 line folding: at most 75 octets per line, never splitting a UTF-8 character. */
export function foldLine(line) {
  const enc = new TextEncoder();
  const out = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // continuation lines start with one space
    if (bytes + b > limit) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}

const hash = (str) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
};

/**
 * What goes to an external calendar: studied blocks (from the progress log, any date, marked done)
 * plus what is still planned from today on. Past blocks that were not studied are left out.
 *   log: { key: { data, assunto_id, materia_id, atividade, minutos, inicio?, fim? } }
 *   horizonDays: limit planned blocks to this many days ahead (null = until the exam)
 */
export function calendarEntries({ weeks, pack, log = {}, today, isDone = () => false, horizonDays = null, inicio = "19:00", inicioFds = "09:00" }) {
  const byId = Object.fromEntries(pack.assuntos.map((a) => [a.id, a]));
  const until = horizonDays === null ? null : addDaysISO(today, horizonDays);
  const out = [];
  // studied, from the log: times kept when the block was marked; older entries get stacked from the day's start
  const cursor = {};
  const entries = Object.entries(log).sort((a, b) => (a[1].data < b[1].data ? -1 : a[1].data > b[1].data ? 1 : (a[1].inicio ?? 0) - (b[1].inicio ?? 0)));
  for (const [key, e] of entries) {
    const weekend = ["sab", "dom"].includes(["dom", "seg", "ter", "qua", "qui", "sex", "sab"][new Date(`${e.data}T12:00:00Z`).getUTCDay()]);
    let start = e.inicio;
    if (!Number.isFinite(start)) {
      start = cursor[e.data] ?? parseClock(weekend ? inicioFds : inicio);
      cursor[e.data] = start + e.minutos;
    }
    const a = e.assunto_id ? byId[e.assunto_id] : null;
    out.push({ key: `feito:${key}`, data: e.data, start, end: Number.isFinite(e.fim) ? e.fim : start + e.minutos, atividade: e.atividade, assunto: a, materia_id: e.materia_id, video: a ? videoFor(a) : null, motivo: null, estudado: true });
  }
  for (const w of weeks) {
    for (const d of w.dias) {
      if (d.data < today || (until && d.data > until)) continue;
      d.blocks.forEach((b, i) => {
        if (isDone(d, b, i)) return;
        out.push({ key: `plano:${blockKey(d.data, b, i)}`, data: d.data, start: b.start, end: b.end, atividade: b.atividade, assunto: b.assunto, materia_id: b.materia_id, video: b.video, motivo: b.motivo, estudado: false });
      });
    }
  }
  return out.sort((x, y) => (x.data < y.data ? -1 : x.data > y.data ? 1 : x.start - y.start));
}

const entryTitle = (e, pack, unidade) => {
  const what = e.assunto ? e.assunto.nome : `Simulado completo (${pack.estrutura_prova.total_questoes} ${unidade})`;
  return `${e.estudado ? "✓ " : ""}[${ACTIVITY_LABEL[e.atividade] ?? e.atividade}] ${what}`;
};
const entryDescription = (e, materias, siteUrl) =>
  [
    e.estudado ? "Estudado (registrado na plataforma)." : "",
    e.materia_id ? materias[e.materia_id] ?? "" : "Prova completa no tempo real",
    e.video ? `${e.video.tipo === "video" ? "Aula" : "Buscar aula"}: ${e.video.url}` : "",
    e.motivo ?? "",
    siteUrl ? `Marque o progresso em ${siteUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

/**
 * toICS({ entries, pack, materias, appName, planStart, siteUrl, unidade }) -> { text, eventos }.
 * Times in Brasília (sent as UTC). Planned UIDs are stable for one plan version (planStart);
 * studied ones are stable forever, so re-importing does not duplicate them.
 */
export function toICS({ entries, pack, materias = {}, appName, planStart = "", siteUrl = "", unidade = "questões" }) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${appName}//PT-BR`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(`Cronograma · ${pack.concurso.nome}`)}`,
    `X-WR-CALDESC:${icsEscape(`${appName}. Gerado em ${todayISO().split("-").reverse().join("/")} (horário de Brasília).`)}`,
    `X-WR-TIMEZONE:${TIMEZONE}`,
  ];
  for (const e of entries) {
    const uidBase = e.estudado ? e.key : `${planStart || "plano"}|${e.key}`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${pack.concurso.id}-${hash(uidBase)}-${e.data.replace(/-/g, "")}@cronograma-personalizado`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsUtc(e.data, e.start)}`,
      `DTEND:${icsUtc(e.data, e.end)}`,
      `SUMMARY:${icsEscape(entryTitle(e, pack, unidade))}`,
      `DESCRIPTION:${icsEscape(entryDescription(e, materias, siteUrl))}`,
      `CATEGORIES:${icsEscape(e.estudado ? "Estudado" : ACTIVITY_LABEL[e.atividade] ?? e.atividade)}`,
      ...(e.video ? [`URL:${e.video.url}`] : []),
      "STATUS:CONFIRMED",
      "TRANSP:OPAQUE",
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return { text: lines.map(foldLine).join("\r\n") + "\r\n", eventos: entries.length };
}

/* ---------------- Google Agenda (Calendar API v3) ---------------- */

const B32HEX = "0123456789abcdefghijklmnopqrstuv";
/** Deterministic event id in Google's alphabet (base32hex, 5–1024 chars). */
export function gcalId(str) {
  let a = 2166136261;
  let b = 5381;
  for (let i = 0; i < str.length; i++) {
    a = Math.imul(a ^ str.charCodeAt(i), 16777619) >>> 0;
    b = (Math.imul(b, 33) ^ str.charCodeAt(i)) >>> 0;
  }
  let out = "cpv";
  for (const n of [a, b]) for (let k = 0; k < 7; k++) out += B32HEX[(n >>> (k * 5)) & 31];
  return out;
}

/** Calendar API event body for one entry (Brasília time zone, studied blocks in green). */
export function gcalEvent(e, { pack, materias = {}, siteUrl = "", unidade = "questões", planStart = "", appName = "" }) {
  // ids come from date + activity + topic + position: a day that did not change keeps its events on re-sync,
  // even after a reorganization (only the days that changed are rewritten)
  const id = gcalId(`${pack.concurso.id}|${e.key}`);
  return {
    id,
    summary: entryTitle(e, pack, unidade),
    description: entryDescription(e, materias, siteUrl),
    start: { dateTime: localDateTime(e.data, e.start), timeZone: TIMEZONE },
    end: { dateTime: localDateTime(e.data, e.end), timeZone: TIMEZONE },
    ...(e.estudado ? { colorId: "10" } : {}),
    ...(siteUrl ? { source: { title: appName || "Cronograma", url: siteUrl } } : {}),
    extendedProperties: { private: { cpv: "1", chave: e.key } },
  };
}

const sameEvent = (a, b) =>
  a.summary === b.summary &&
  (a.description ?? "") === (b.description ?? "") &&
  a.start?.dateTime?.slice(0, 16) === b.start?.dateTime?.slice(0, 16) &&
  a.end?.dateTime?.slice(0, 16) === b.end?.dateTime?.slice(0, 16) &&
  (a.colorId ?? "") === (b.colorId ?? "");

/**
 * What a sync has to do so that the app calendar holds exactly `desired`:
 * insert new events, update changed ones, delete the rest (only events this app created).
 *   existing: events listed from the app calendar (with id, summary, start, end, colorId)
 */
export function planSync(existing, desired) {
  const have = new Map(existing.filter((e) => e.status !== "cancelled").map((e) => [e.id, e]));
  const insert = [];
  const update = [];
  for (const d of desired) {
    const cur = have.get(d.id);
    if (!cur) insert.push(d);
    else if (!sameEvent(cur, { ...d, start: { dateTime: d.start.dateTime }, end: { dateTime: d.end.dateTime } })) update.push(d);
    have.delete(d.id);
  }
  return { insert, update, remove: [...have.values()].map((e) => e.id) };
}

/** Starts a download for a Blob. Returns the object URL (kept alive so a visible link can retry). */
export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.append(a);
  a.click();
  a.remove();
  return url;
}
