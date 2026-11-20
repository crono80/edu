import { test } from "node:test";
import assert from "node:assert/strict";
import { capabilities, allowedLeveling, devPlanOverride } from "./access-rules.js";

test("demo: só a primeira semana, sem nível, sem PDF", () => {
  const c = capabilities(null);
  assert.equal(c.plan, null);
  for (const k of ["fullAgenda", "level", "pdf", "quiz", "progress", "calendar"]) assert.equal(c[k], false, k);
});

test("essencial: agenda completa, nível declarado e PDF; sem simulado, progresso ou agenda externa", () => {
  const c = capabilities("essencial");
  assert.deepEqual([c.fullAgenda, c.level, c.pdf], [true, true, true]);
  assert.deepEqual([c.quiz, c.progress, c.calendar], [false, false, false]);
});

test("completo: tudo", () => {
  const c = capabilities("completo");
  for (const k of ["fullAgenda", "level", "pdf", "quiz", "progress", "calendar"]) assert.equal(c[k], true, k);
});

test("plano desconhecido vale como demonstração", () => {
  assert.equal(capabilities("premium").plan, null);
});

test("nivelamento: demo ignora, essencial descarta o simulado, completo usa tudo", () => {
  const applied = { strengths: { port: "forte" }, q: { attempt: 1, answers: { a: 0 } } };
  assert.equal(allowedLeveling(applied, capabilities(null)), null);
  assert.deepEqual(allowedLeveling(applied, capabilities("essencial")), { strengths: { port: "forte" }, q: null });
  assert.equal(allowedLeveling(applied, capabilities("completo")), applied);
  assert.equal(allowedLeveling(null, capabilities("completo")), null);
});

test("?plano= só vale em desenvolvimento", () => {
  assert.equal(devPlanOverride("?plano=completo", false), undefined);
  assert.equal(devPlanOverride("?plano=completo", true), "completo");
  assert.equal(devPlanOverride("?plano=demo", true), null);
  assert.equal(devPlanOverride("?plano=xyz", true), undefined);
});
