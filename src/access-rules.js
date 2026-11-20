// What each plan unlocks. Pure: no DOM, no network (tested in src/access.test.js).
//
//  Demonstração (sem compra)  como funciona, vantagem, seu tempo, top 80%, dossiê e só a 1ª semana da agenda
//  Essencial (R$ 37)         + agenda completa, nível declarado por matéria, PDF (uma vez por carga: Normal/Hard/Super hard)
//  Completo (R$ 97)          + simulado de nivelamento, progresso (✓), reorganizar, Google Agenda e .ics
// Os dois planos recebem a atualização do pack quando o edital sair (o app lê o pack publicado).

export const PLANS = ["essencial", "completo"];

export function capabilities(plan) {
  const paid = plan === "essencial" || plan === "completo";
  const full = plan === "completo";
  return {
    plan: paid ? plan : null,
    fullAgenda: paid,
    level: paid,
    pdf: paid,
    quiz: full,
    progress: full,
    calendar: full,
  };
}

/** The leveling the plan may use: no leveling in the demo; no quiz without the Completo. */
export function allowedLeveling(applied, can) {
  if (!applied || !can.level) return null;
  return can.quiz ? applied : { ...applied, q: null };
}

/** Plan forced by ?plano= in local development only (never in the published build). */
export function devPlanOverride(search, isDev) {
  if (!isDev) return undefined;
  const v = new URLSearchParams(search).get("plano");
  if (v === "demo") return null;
  return PLANS.includes(v) ? v : undefined;
}
