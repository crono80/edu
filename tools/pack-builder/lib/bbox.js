// Reading-order text from word boxes (pdftotext -bbox): words grouped into lines per column,
// left column before right column. Fixes multi-column cadernos where item numbers and their
// text land in different text blocks (Cebraspe certo/errado booklets).
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/** Words per page: [{ page, width, height, words: [{ x0, y0, x1, y1, t }] }] */
export async function readWords(pdfPath) {
  const { stdout } = await exec("pdftotext", ["-bbox", "-enc", "UTF-8", pdfPath, "-"], { maxBuffer: 128 * 1024 * 1024 });
  const pages = [];
  const pageRe = /<page width="([\d.]+)" height="([\d.]+)">([\s\S]*?)<\/page>/g;
  const wordRe = /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([\s\S]*?)<\/word>/g;
  let pm;
  let n = 0;
  while ((pm = pageRe.exec(stdout))) {
    n += 1;
    const words = [];
    let wm;
    while ((wm = wordRe.exec(pm[3]))) words.push({ x0: +wm[1], y0: +wm[2], x1: +wm[3], y1: +wm[4], t: decode(wm[5]) });
    pages.push({ page: n, width: +pm[1], height: +pm[2], words });
  }
  return pages;
}

/**
 * Lines in reading order. Each line: { page, col, x0, y0, text, words }.
 * `columns`: number of equal-width columns; a word belongs to the column of its left edge.
 */
export function wordsToLines(pages, { columns = 2, tolerance = 2.5 } = {}) {
  const out = [];
  for (const p of pages) {
    const colW = p.width / columns;
    for (let c = 0; c < columns; c++) {
      const ws = p.words.filter((w) => Math.min(columns - 1, Math.floor(w.x0 / colW)) === c).sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
      const lines = [];
      for (const w of ws) {
        const line = lines.find((l) => Math.abs(l.y0 - w.y0) <= tolerance);
        if (line) line.words.push(w);
        else lines.push({ y0: w.y0, words: [w] });
      }
      lines.sort((a, b) => a.y0 - b.y0);
      for (const l of lines) {
        l.words.sort((a, b) => a.x0 - b.x0);
        out.push({ page: p.page, col: c, x0: l.words[0].x0, y0: l.y0, text: l.words.map((w) => w.t).join(" "), words: l.words });
      }
    }
  }
  return out;
}
