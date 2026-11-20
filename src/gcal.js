// Google Agenda sync from the browser: Google Identity Services token + Calendar API v3.
// Scope calendar.app.created: the app can create its own calendar and manage only the events in it.
import { TIMEZONE, planSync } from "./plan.js";

const GIS_SRC = "https://accounts.google.com/gsi/client";
const API = "https://www.googleapis.com/calendar/v3";
export const SCOPE = "https://www.googleapis.com/auth/calendar.app.created";

let tokenClient = null;
let pending = null;

/** Loads Google's login script and prepares the token client (call on page load, not on click). */
export function prepare(clientId) {
  if (tokenClient || typeof window === "undefined") return;
  const init = () => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (r) => {
        if (!pending) return;
        if (r.error) pending.reject(new Error(r.error_description || r.error));
        else pending.resolve(r.access_token);
        pending = null;
      },
      error_callback: (e) => {
        if (!pending) return;
        pending.reject(new Error(e?.type === "popup_closed" ? "Login cancelado." : e?.message || "Falha no login do Google."));
        pending = null;
      },
    });
  };
  if (window.google?.accounts?.oauth2) return init();
  const s = document.createElement("script");
  s.src = GIS_SRC;
  s.async = true;
  s.onload = init;
  document.head.append(s);
}

/** Opens Google's consent popup. Must run inside the click handler (popups need the user gesture). */
export function requestToken() {
  if (!tokenClient) return Promise.reject(new Error("O login do Google ainda está carregando. Tente de novo em alguns segundos."));
  return new Promise((resolve, reject) => {
    pending = { resolve, reject };
    tokenClient.requestAccessToken({ prompt: "" });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(token, method, path, body) {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(API + path, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.status === 204) return null;
    if (r.ok) return r.json();
    const text = await r.text();
    const retry = r.status === 429 || r.status >= 500 || (r.status === 403 && /rateLimit/i.test(text));
    if (retry && attempt < 5) {
      await sleep(400 * 2 ** attempt);
      continue;
    }
    const err = new Error(`Google Agenda respondeu ${r.status}`);
    err.status = r.status;
    err.detail = text.slice(0, 300);
    throw err;
  }
}

async function pool(jobs, size, onDone) {
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      await job();
      done += 1;
      onDone(done);
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, jobs.length) }, worker));
}

/**
 * Makes the app calendar hold exactly `desired` (Calendar API event bodies with fixed ids).
 * Creates the calendar when `calendarId` is empty or gone. Returns { calendarId, inserted, updated, removed }.
 */
export async function syncCalendar({ token, calendarId, calendarName, description, desired, onProgress = () => {} }) {
  let id = calendarId;
  if (id) {
    try {
      await api(token, "GET", `/calendars/${encodeURIComponent(id)}`);
    } catch (err) {
      if (err.status === 404 || err.status === 403) id = null;
      else throw err;
    }
  }
  if (!id) id = (await api(token, "POST", "/calendars", { summary: calendarName, description, timeZone: TIMEZONE })).id;
  const cal = encodeURIComponent(id);

  const existing = [];
  let pageToken = "";
  do {
    const q = new URLSearchParams({ privateExtendedProperty: "cpv=1", maxResults: "2500", singleEvents: "true", ...(pageToken ? { pageToken } : {}) });
    const page = await api(token, "GET", `/calendars/${cal}/events?${q}`);
    existing.push(...(page.items ?? []));
    pageToken = page.nextPageToken ?? "";
  } while (pageToken);

  const { insert, update, remove } = planSync(existing, desired);
  const jobs = [
    ...insert.map((e) => () => api(token, "POST", `/calendars/${cal}/events`, e).catch((err) => (err.status === 409 ? api(token, "PUT", `/calendars/${cal}/events/${e.id}`, { ...e, status: "confirmed" }) : Promise.reject(err)))),
    ...update.map((e) => () => api(token, "PUT", `/calendars/${cal}/events/${e.id}`, e)),
    ...remove.map((eid) => () => api(token, "DELETE", `/calendars/${cal}/events/${eid}`).catch((err) => (err.status === 404 || err.status === 410 ? null : Promise.reject(err)))),
  ];
  onProgress(0, jobs.length);
  await pool(jobs, 3, (n) => onProgress(n, jobs.length)); // gentle on Google's per-user rate limit
  return { calendarId: id, inserted: insert.length, updated: update.length, removed: remove.length };
}
