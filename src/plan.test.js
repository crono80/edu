// Product-layer tests (calendar export and sync). Run with: TZ=UTC node --test src/plan.test.js
// (TZ=UTC on purpose: times must come out in Brasília whatever the machine's zone is)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as P from "./plan.js";

const pack = JSON.parse(readFileSync(new URL("../app/packs/inss-tecnico-pre.json", import.meta.url), "utf8"));
const plano = () => P.displayWeeks(P.buildPlan({ pack, nivelamento: {}, hours: P.MODES.hard.hours, start: "2026-11-16", exam: "2027-02-01" }), pack);

test("foldLine: no line above 75 octets, never splits a UTF-8 character, unfolds to the original", () => {
  const line = "DESCRIPTION:" + "Organização do Estado e Administração Pública — benefícios ".repeat(5);
  const parts = P.foldLine(line).split("\r\n");
  for (const p of parts) assert.ok(new TextEncoder().encode(p).length <= 75);
  assert.equal(parts.map((p, i) => (i ? p.slice(1) : p)).join(""), line);
});

test("horário de Brasília em qualquer fuso da máquina", () => {
  assert.equal(P.icsUtc("2026-11-16", 19 * 60), "20261116T220000Z");
  assert.equal(P.icsUtc("2026-11-16", 23 * 60 + 30), "20261117T023000Z");
  assert.equal(P.localDateTime("2026-11-16", 24 * 60 + 15), "2026-11-17T00:15:00");
  assert.equal(P.todayISO(new Date("2026-11-17T02:30:00Z")), "2026-11-16"); // 23:30 em Brasília
});

test("entradas da agenda: futuro planejado + estudado no passado; passado não estudado fica fora", () => {
  const weeks = plano();
  const all = weeks.flatMap((w) => w.dias.flatMap((d) => d.blocks.map((b, i) => ({ d, b, i }))));
  const past = all.find((x) => x.d.data === "2026-11-16");
  const key = P.blockKey(past.d.data, past.b, past.i);
  const log = { [key]: { data: past.d.data, assunto_id: past.b.assunto?.id ?? null, materia_id: past.b.materia_id, atividade: past.b.atividade, minutos: past.b.minutos, inicio: past.b.start, fim: past.b.end } };
  const doneSet = new Set([key]);
  const entries = P.calendarEntries({ weeks, pack, log, today: "2026-11-18", isDone: (d, b, i) => doneSet.has(P.blockKey(d.data, b, i)) });
  const futuro = all.filter((x) => x.d.data >= "2026-11-18").length;
  assert.equal(entries.length, futuro + 1);
  assert.equal(entries.filter((e) => e.estudado).length, 1);
  assert.ok(entries.every((e) => e.estudado || e.data >= "2026-11-18"));
  const { text, eventos } = P.toICS({ entries, pack, appName: "Teste", planStart: "2026-11-16", unidade: "itens" });
  assert.equal(eventos, entries.length);
  assert.match(text, /SUMMARY:✓ \[/);
  assert.match(text, /X-WR-TIMEZONE:America\/Sao_Paulo/);
  const uids = [...text.matchAll(/^UID:(.+)$/gm)].map((m) => m[1]);
  assert.equal(new Set(uids).size, uids.length);
  assert.ok(text.endsWith("END:VCALENDAR\r\n") && !/[^\r]\n/.test(text));
});

test("Google: ids no alfabeto base32hex, fuso de Brasília, estudado em verde e plano de sincronização", () => {
  const weeks = plano();
  const entries = P.calendarEntries({ weeks, pack, log: {}, today: "2026-11-16", horizonDays: 14 });
  assert.ok(entries.every((e) => e.data <= "2026-11-30"));
  const evs = entries.map((e) => P.gcalEvent(e, { pack, planStart: "2026-11-16", unidade: "itens" }));
  for (const e of evs) {
    assert.match(e.id, /^[0-9a-v]{5,1024}$/);
    assert.equal(e.start.timeZone, "America/Sao_Paulo");
  }
  assert.equal(new Set(evs.map((e) => e.id)).size, evs.length);
  const studied = P.gcalEvent({ ...entries[0], estudado: true, key: "feito:x" }, { pack });
  assert.equal(studied.colorId, "10");
  // existing: first unchanged, second with another title, plus one orphan from an old plan
  const existing = [
    { ...evs[0], start: { dateTime: evs[0].start.dateTime + "-03:00" }, end: { dateTime: evs[0].end.dateTime + "-03:00" } },
    { ...evs[1], summary: "antigo" },
    { id: "cpvorfao0000000", summary: "x", start: { dateTime: "2026-11-01T19:00:00-03:00" }, end: { dateTime: "2026-11-01T20:00:00-03:00" } },
  ];
  const plan = P.planSync(existing, evs);
  assert.equal(plan.insert.length, evs.length - 2);
  assert.deepEqual(plan.update.map((e) => e.id), [evs[1].id]);
  assert.deepEqual(plan.remove, ["cpvorfao0000000"]);
});

test("top 80% inclui os pré-requisitos e a agenda só abre um assunto depois da teoria deles", () => {
  for (const nivelamento of [{}, P.nivelamentoInput(pack, { port: "forte", seg: "fraco" }, null)]) {
    const scores = P.score({ pack, nivelamento });
    const par = P.pareto(pack, scores);
    const byId = Object.fromEntries(pack.assuntos.map((a) => [a.id, a]));
    const pos = new Map(par.items.map((x, i) => [x.id, i]));
    for (const x of par.items) {
      for (const p of byId[x.id].prereq) {
        assert.ok(pos.get(p) < pos.get(x.id), `${p} deveria vir antes de ${x.id}`);
        if (par.top.has(x.id)) assert.ok(par.top.has(p), `${x.id} no top sem o pré-requisito ${p}`);
      }
    }
    for (const [p, head] of par.baseFor) assert.ok(par.top.has(head) === par.top.has(p), `${p} entrou por ${head}`);
    // personalized curve follows the same order: 80% of the points at the top's hours
    const cmp = P.compare(pack, scores);
    assert.ok(Math.abs(P.coverageAt(cmp.personalized, par.topHours) - par.topPts / par.total) < 1e-9);
  }
  const r = P.buildPlan({ pack, nivelamento: {}, hours: P.MODES.hard.hours, start: "2026-11-16", exam: "2027-07-18" });
  const opened = Object.fromEntries(r.resumo.por_assunto.map((a) => [a.assunto_id, a.aberto_em]));
  const lastTheory = {};
  for (const w of r.cronograma) for (const d of w.dias) for (const b of d.blocos) if (b.atividade === "teoria" && b.passada === 1) lastTheory[b.assunto_id] = d.data;
  for (const a of pack.assuntos) {
    if (!opened[a.id]) continue;
    for (const p of a.prereq) if (lastTheory[p]) assert.ok(lastTheory[p] <= opened[a.id], `${a.id} abriu em ${opened[a.id]}; teoria de ${p} terminou em ${lastTheory[p]}`);
  }
  assert.deepEqual(r.resumo.assuntos_nao_iniciados, []);
});
