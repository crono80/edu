// Student progress in Supabase (supabase/migrations/2026-11-24-student-progress.sql).
// localStorage stays the working copy: without login (or without the tables) the app runs on it alone.
// Signed in: the state goes up 3 s after the last change; at login the most recent copy wins (local vs server).
import { useEffect, useRef } from "react";
import { supabase } from "./access.js";
import { EVENT_TYPES, isMissingTable, resolveOnLogin, SYNC_DEBOUNCE_MS } from "./sync-rules.js";

// one session context for events, set by useCloudState
const cloud = { userId: null, concurso: null, stateOff: false, eventsOff: false, queue: [], timer: null };

async function flushEvents() {
  clearTimeout(cloud.timer);
  cloud.timer = null;
  if (!supabase || !cloud.userId || cloud.eventsOff || !cloud.queue.length) return;
  const rows = cloud.queue.splice(0).map((e) => ({ user_id: cloud.userId, concurso: cloud.concurso, ...e }));
  const { error } = await supabase.from("student_events").insert(rows);
  if (error) {
    if (isMissingTable(error)) cloud.eventsOff = true;
    console.warn("student_events:", error.message);
  }
}

/** Records a usage event (signed-in students only; dropped otherwise). Sent in batches. */
export function track(type, payload = {}) {
  if (!EVENT_TYPES.includes(type) || !supabase || !cloud.userId || cloud.eventsOff) return;
  cloud.queue.push({ type, payload, created_at: new Date().toISOString() });
  if (!cloud.timer) cloud.timer = setTimeout(flushEvents, SYNC_DEBOUNCE_MS);
}

function readJSON(key) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}
function writeJSON(key, v) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
}

/**
 * Keeps `state` in localStorage (`storeKey`) and, with `userId`, in student_state.
 * replaceState(raw | null) receives the server copy (null = start from defaults: the local copy was another account's).
 */
export function useCloudState({ userId, concurso, storeKey, state, replaceState }) {
  const metaKey = `${storeKey}:sync`;
  const hasLocal = useRef(null);
  if (hasLocal.current === null) {
    try {
      hasLocal.current = localStorage.getItem(storeKey) != null;
    } catch {
      hasLocal.current = false;
    }
  }
  const latest = useRef(state);
  latest.current = state;
  const seen = useRef(state); // last state handled (StrictMode runs effects twice on mount)
  const fromServer = useRef(false);
  const ready = useRef(false); // login resolved: writes may go up
  const timer = useRef(null);

  const push = async () => {
    clearTimeout(timer.current);
    timer.current = null;
    if (!supabase || !userId || !ready.current || cloud.stateOff) return;
    const meta = readJSON(metaKey) ?? {};
    const { error } = await supabase
      .from("student_state")
      .upsert({ user_id: userId, concurso, state: latest.current, updated_at: meta.updatedAt ?? new Date().toISOString() }, { onConflict: "user_id,concurso" });
    if (error) {
      if (isMissingTable(error)) cloud.stateOff = true;
      console.warn("student_state:", error.message);
    }
  };
  const pushRef = useRef(push);
  pushRef.current = push;

  // every change: local copy + timestamp, then the server 3 s later
  useEffect(() => {
    writeJSON(storeKey, state);
    if (seen.current === state) return;
    seen.current = state;
    if (fromServer.current) {
      fromServer.current = false;
      return;
    }
    writeJSON(metaKey, { ...(readJSON(metaKey) ?? {}), updatedAt: new Date().toISOString() });
    hasLocal.current = true;
    if (!userId || !ready.current || cloud.stateOff) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => pushRef.current(), SYNC_DEBOUNCE_MS);
  }, [state]);

  // login: load from the server, or send the local copy up
  useEffect(() => {
    if (cloud.userId !== (userId ?? null)) cloud.queue.length = 0; // never send one account's events as another's
    cloud.userId = userId ?? null;
    cloud.concurso = concurso;
    ready.current = false;
    if (!supabase || !userId) return undefined;
    let alive = true;
    (async () => {
      if (!cloud.stateOff) {
        const { data, error } = await supabase.from("student_state").select("state, updated_at").eq("user_id", userId).eq("concurso", concurso).maybeSingle();
        if (!alive) return;
        if (error) {
          // missing table: local only for this session; other errors: no writes, so a newer server copy is not overwritten
          if (isMissingTable(error)) cloud.stateOff = true;
          console.warn("student_state:", error.message);
        } else {
          const d = resolveOnLogin({ meta: readJSON(metaKey) ?? {}, hasLocal: hasLocal.current, server: data, userId });
          writeJSON(metaKey, d.meta);
          if (d.action === "download" || d.action === "reset") {
            fromServer.current = true;
            replaceState(d.action === "download" ? d.state : null);
          }
          ready.current = true;
          if (d.action === "upload") pushRef.current();
        }
      }
      flushEvents();
    })();
    const onHide = () => {
      if (document.visibilityState !== "hidden") return;
      if (timer.current) pushRef.current();
      flushEvents();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      alive = false;
      clearTimeout(timer.current);
      timer.current = null;
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [userId, concurso]);
}
