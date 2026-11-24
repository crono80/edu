// Pure rules of the progress sync (src/sync.js); tested in src/sync.test.js.

export const SYNC_DEBOUNCE_MS = 3000;
export const EVENT_TYPES = ["progress_check", "progress_uncheck", "reorganize", "quiz_finished", "quiz_answer", "self_level_set", "pdf", "ics", "gcal_sync"];

/**
 * What to do when `userId` signs in. Pure.
 * meta: { userId, updatedAt } kept next to the local state; hasLocal: there is a local state (also from before this sync existed);
 * server: { state, updated_at } | null.
 * -> { action: "download" | "upload" | "reset" | "none", state?, meta }
 */
export function resolveOnLogin({ meta = {}, hasLocal = false, server = null, userId, now = new Date().toISOString() }) {
  const foreign = Boolean(meta.userId) && meta.userId !== userId; // local copy belongs to another account on this browser
  const localT = meta.updatedAt && !foreign ? Date.parse(meta.updatedAt) : null;
  if (server) {
    const serverT = Date.parse(server.updated_at);
    if (localT == null || serverT > localT) return { action: "download", state: server.state, meta: { userId, updatedAt: server.updated_at } };
    if (localT > serverT) return { action: "upload", meta: { userId, updatedAt: meta.updatedAt } };
    return { action: "none", meta: { userId, updatedAt: meta.updatedAt } };
  }
  if (foreign) return { action: "reset", meta: { userId, updatedAt: null } };
  if (localT != null || hasLocal) return { action: "upload", meta: { userId, updatedAt: meta.updatedAt ?? now } };
  return { action: "none", meta: { userId, updatedAt: null } };
}

/** PostgREST / Postgres error for a table that does not exist yet (migration not applied). */
export function isMissingTable(error) {
  if (!error) return false;
  return ["PGRST205", "PGRST204", "42P01"].includes(error.code) || /does not exist|schema cache/i.test(error.message ?? "");
}
