import { test } from "node:test";
import assert from "node:assert/strict";
import { EVENT_TYPES, isMissingTable, resolveOnLogin } from "./sync-rules.js";
import { addQuizStats, quizAnswerEvents, quizAssuntoStats } from "./plan.js";

const U = "user-a";
const T1 = "2026-11-24T10:00:00.000Z";
const T2 = "2026-11-24T11:00:00.000Z";

test("sync: first login with local state and nothing on the server uploads the local copy", () => {
  assert.equal(resolveOnLogin({ meta: { updatedAt: T1 }, hasLocal: true, server: null, userId: U }).action, "upload");
  // state saved before the sync existed (no timestamp) also goes up
  const d = resolveOnLogin({ meta: {}, hasLocal: true, server: null, userId: U, now: T2 });
  assert.deepEqual(d, { action: "upload", meta: { userId: U, updatedAt: T2 } });
});

test("sync: nothing local and nothing on the server does nothing", () => {
  assert.equal(resolveOnLogin({ meta: {}, hasLocal: false, server: null, userId: U }).action, "none");
});

test("sync: the most recent updated_at wins", () => {
  const server = { state: { mode: "normal" }, updated_at: "2026-11-24T10:30:00+00:00" };
  const down = resolveOnLogin({ meta: { userId: U, updatedAt: T1 }, hasLocal: true, server, userId: U });
  assert.equal(down.action, "download");
  assert.deepEqual(down.state, { mode: "normal" });
  assert.equal(down.meta.updatedAt, server.updated_at);
  assert.equal(resolveOnLogin({ meta: { userId: U, updatedAt: T2 }, hasLocal: true, server, userId: U }).action, "upload");
  assert.equal(resolveOnLogin({ meta: { userId: U, updatedAt: "2026-11-24T10:30:00.000Z" }, hasLocal: true, server, userId: U }).action, "none");
  // local copy without a timestamp loses to the server
  assert.equal(resolveOnLogin({ meta: {}, hasLocal: true, server, userId: U }).action, "download");
});

test("sync: another account's local copy is never uploaded", () => {
  assert.equal(resolveOnLogin({ meta: { userId: "user-b", updatedAt: T2 }, hasLocal: true, server: null, userId: U }).action, "reset");
  const server = { state: {}, updated_at: T1 };
  assert.equal(resolveOnLogin({ meta: { userId: "user-b", updatedAt: T2 }, hasLocal: true, server, userId: U }).action, "download");
});

test("sync: missing table is detected, other errors are not", () => {
  assert.ok(isMissingTable({ code: "PGRST205", message: "Could not find the table 'public.student_state' in the schema cache" }));
  assert.ok(isMissingTable({ code: "42P01", message: 'relation "public.student_events" does not exist' }));
  assert.ok(!isMissingTable({ code: "42501", message: "new row violates row-level security policy" }));
  assert.ok(!isMissingTable(null));
  assert.equal(EVENT_TYPES.length, 9);
});

test("quiz: stats by assunto and one event per presented item", () => {
  const itens = [
    { id: "q1", assunto_id: "a", gabarito: 0 },
    { id: "q2", assunto_id: "a", gabarito: 1 },
    { id: "q3", assunto_id: "b", gabarito: 0 },
  ];
  const answers = { q1: 0, q2: 0 };
  const st = quizAssuntoStats(itens, answers);
  assert.deepEqual(st, { a: { apresentados: 2, respondidas: 2, acertos: 1, erros: 1 }, b: { apresentados: 1, respondidas: 0, acertos: 0, erros: 0 } });
  assert.deepEqual(addQuizStats(st, st).a, { apresentados: 4, respondidas: 4, acertos: 2, erros: 2 });
  const ev = quizAnswerEvents(itens, answers, 1);
  assert.equal(ev.length, 3);
  assert.deepEqual(ev[2], { item_id: "q3", assunto_id: "b", resposta: null, correta: false, em_branco: true, attempt: 1 });
  assert.equal(ev[0].correta, true);
});
