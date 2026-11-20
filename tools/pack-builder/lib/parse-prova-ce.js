// Cebraspe certo/errado caderno -> items, from reading-order lines (lib/bbox.js).
// Layout facts used: an item starts at the column margin with its number (or, in older
// booklets, a number glyph with no extractable text); its continuation lines are indented;
// commands ("… julgue os itens a seguir.") and passages sit at the margin without a number.
import { collapse } from "./text.js";

const NOISE = [
  /CEBRASPE\s*[–|-]/i,
  /^\s*-{2,}|-{2,}\s*$/,
  /^\s*[0-9A-Z]{3,}_\d{2}N\d+\s*$/,
  /^\s*\d{6}_\d{2}N\d+/,
  /^\s*Espa[çc]o livre\s*$/i,
  /^\s*RASCUNHO\s*$/i,
];
const isGarbage = (t) => (t.match(/[%#]/g) ?? []).length >= 2 || /&apos;/.test(t);
const isNoise = (t) => !t.trim() || NOISE.some((re) => re.test(t)) || isGarbage(t);
const TEXT_LABEL = /^\s*Texto\s+([A-Z]{0,3}\d*[A-Z]?\d*(?:-[IVX]+)?|[IVX]+)\s*$/i;
const TEXT_REF = /\btextos?\s+([A-Z]{2,3}\d[A-Z0-9]*(?:-[IVX]+)?|[IVX]+)\b/i;
const COMMAND = /julgu?e|julgamento|julgar/i;
// older booklets draw item numbers with a font whose digits extract as control characters (0x12 = "0")
const decodeNumber = (t) => (/^[\x12-\x1b]+$/.test(t) ? [...t].map((c) => c.charCodeAt(0) - 0x12).join("") : t);

/**
 * parseProvaCE(lines, { inicio, total, numerado }) -> { questoes, anomalias, textos }
 *   lines: [{ page, col, x0, text, words }]
 */
export function parseProvaCE(lines, { inicio = 1, total = 120 } = {}) {
  const clean = lines.filter((l) => !isNoise(l.text));
  // column margin = smallest x among lines of that page/column that start an item or command
  const margins = new Map();
  for (const l of clean) {
    const k = `${l.page}.${l.col}`;
    margins.set(k, Math.min(margins.get(k) ?? Infinity, l.x0));
  }
  const fim = inicio + total - 1;
  // booklets with glyph digits: only glyph numbers start items (plain digits are passage line numbers)
  const glyphMode = clean.some((l) => /^[\x12-\x1b]+$/.test(l.words[0]?.t ?? ""));
  // passage line-number gutter ("1", "4", "7" …) set apart from the text
  const lineText = (l) => {
    const w = l.words;
    const gutter = w.length > 1 && /^\d{1,2}$/.test(w[0].t) && w[1].x0 - w[0].x1 > 6;
    return (gutter ? w.slice(1) : w).map((x) => x.t).join(" ").replace(/[ŌŏŐ]+/g, "").trim();
  };
  const questoes = [];
  const anomalias = [];
  const textos = {}; // label -> passage
  let expected = inicio;
  let cur = null;
  let block = []; // lines of the current non-item block (passage and/or command)
  let blockText = "";
  let lastLabel = null;

  const closeItem = () => {
    if (!cur) return;
    cur.enunciado = collapse(cur.enunciado);
    if (!cur.enunciado) anomalias.push({ numero: cur.numero, tipo: "enunciado_vazio", detalhe: "" });
    questoes.push(cur);
    cur = null;
  };
  const contextNow = () => {
    let ctx = collapse(block.join(" "));
    const ref = TEXT_REF.exec(ctx);
    if (ref) {
      const label = ref[1].toUpperCase();
      const passage = textos[label];
      if (passage && !ctx.includes(passage.slice(0, 60))) ctx = `${passage}\n\n${ctx}`;
    }
    return ctx;
  };

  for (const l of clean) {
    const margin = margins.get(`${l.page}.${l.col}`);
    const atMargin = l.x0 <= margin + 6;
    const raw = l.words[0]?.t ?? "";
    const first = decodeNumber(raw);
    const startsItem = expected <= fim && atMargin && l.words.length > 1 && first === String(expected) && (!glyphMode || raw !== first);
    if (startsItem) {
      closeItem();
      blockText = contextNow();
      cur = { numero: expected, materia_id: null, contexto: blockText || null, enunciado: l.words.slice(1).map((w) => w.t).join(" ").replace(/[ŌŏŐ]+/g, ""), alternativas: ["Certo", "Errado"], completa: true };
      expected += 1;
      continue;
    }
    if (cur && !atMargin) {
      cur.enunciado += " " + lineText(l);
      continue;
    }
    // non-indented, no number: a new block (passage or command) begins after an item
    if (cur) {
      closeItem();
      block = [];
    }
    const label = TEXT_LABEL.exec(l.text);
    if (label) {
      lastLabel = label[1].toUpperCase();
      block = [];
      continue;
    }
    const t = lineText(l);
    block.push(t);
    if (lastLabel && !COMMAND.test(l.text)) textos[lastLabel] = collapse((textos[lastLabel] ? textos[lastLabel] + " " : "") + t);
    if (COMMAND.test(l.text)) lastLabel = null;
  }
  closeItem();
  if (questoes.length !== total) anomalias.push({ numero: null, tipo: "contagem", detalhe: `${questoes.length} de ${total} itens` });
  return { questoes, anomalias, textos, total: questoes.length };
}
