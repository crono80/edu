// Product-layer tests (ICS export). Run with: TZ=America/Sao_Paulo node --test src/plan.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as P from "./plan.js";

const pack = JSON.parse(readFileSync(new URL("../app/packs/inss-tecnico-pre.json", import.meta.url), "utf8"));

test("foldLine: no line above 75 octets, never splits a UTF-8 character, unfolds to the original", () => {
  const line = "DESCRIPTION:" + "Organização do Estado e Administração Pública — benefícios ".repeat(5);
  const folded = P.foldLine(line);
  const parts = folded.split("\r\n");
  for (const p of parts) assert.ok(new TextEncoder().encode(p).length <= 75, `linha com ${new TextEncoder().encode(p).length} octetos`);
  assert.equal(parts.map((p, i) => (i ? p.slice(1) : p)).join(""), line);
});

test("icsUtc: horário local de Brasília vira UTC (+3h), inclusive passando da meia-noite", () => {
  assert.equal(P.icsUtc("2026-11-16", 19 * 60), "20261116T220000Z");
  assert.equal(P.icsUtc("2026-11-16", 23 * 60 + 30), "20261117T023000Z");
});

test("toICS: só de hoje em diante, sem blocos estudados, UIDs únicos e CRLF", () => {
  const res = P.buildPlan({ pack, nivelamento: {}, hours: P.MODES.hard.hours, start: "2026-11-16", exam: "2027-02-01" });
  const weeks = P.displayWeeks(res, pack);
  const all = weeks.flatMap((w) => w.dias.flatMap((d) => d.blocks.map((b, i) => ({ d, b, i }))));
  const first = all.find((x) => x.d.data >= "2026-11-18");
  const done = new Set([P.blockKey(first.d.data, first.b, first.i)]);
  const { text, eventos } = P.toICS({
    weeks,
    pack,
    materias: {},
    appName: "Teste",
    from: "2026-11-18",
    isDone: (d, b, i) => done.has(P.blockKey(d.data, b, i)),
    planStart: "2026-11-16",
    unidade: "itens",
  });
  const expected = all.filter((x) => x.d.data >= "2026-11-18").length - 1;
  assert.equal(eventos, expected);
  assert.equal((text.match(/BEGIN:VEVENT/g) ?? []).length, expected);
  assert.ok(!/DTSTART:2026111[67]/.test(text), "nada antes de 18/11");
  const uids = [...text.matchAll(/^UID:(.+)$/gm)].map((m) => m[1]);
  assert.equal(new Set(uids).size, uids.length);
  assert.ok(text.endsWith("END:VCALENDAR\r\n"));
  assert.ok(!/[^\r]\n/.test(text), "somente CRLF");
  if (/Simulado completo/.test(text)) assert.match(text, /Simulado completo \(120 itens\)/);
});
