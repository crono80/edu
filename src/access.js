// Login (Google, via Supabase Auth) and the plan the student bought (Kiwify webhook -> purchases -> my_plan()).
// The Google button gives an ID token; Supabase verifies it (provider "google", client id configured in the project).
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { GOOGLE_CLIENT_ID, SUPABASE_KEY, SUPABASE_URL } from "./config.js";
import { loadGis } from "./gis.js";
import { devPlanOverride } from "./access-rules.js";

export const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } }) : null;

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

function randomNonce() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Renders Google's "Sign in" button in `el`. Resolves when the button is on screen. */
export async function renderGoogleButton(el, { onError } = {}) {
  if (!supabase || !GOOGLE_CLIENT_ID || !el) return;
  const google = await loadGis();
  const raw = randomNonce();
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    nonce: await sha256Hex(raw), // Google signs the hash; Supabase checks it against the raw value
    use_fedcm_for_prompt: true,
    callback: async ({ credential }) => {
      const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: credential, nonce: raw });
      if (error) onError?.(error.message);
    },
  });
  el.innerHTML = "";
  google.accounts.id.renderButton(el, { type: "standard", theme: "outline", size: "medium", text: "signin_with", shape: "pill", locale: "pt-BR" });
}

export async function signOut() {
  await supabase?.auth.signOut();
  try {
    window.google?.accounts?.id?.disableAutoSelect();
  } catch {
    /* ignore */
  }
}

/**
 * { status: "loading" | "anon" | "signed", email, plan: null | "essencial" | "completo", error }
 * In local development, ?plano=demo|essencial|completo forces the plan (never in the published build).
 */
export function useAccess(concursoId) {
  const forced = typeof window === "undefined" ? undefined : devPlanOverride(window.location.search, import.meta.env.DEV);
  const [access, setAccess] = useState(() =>
    forced !== undefined ? { status: "signed", email: "dev@local", plan: forced, error: null } : { status: supabase ? "loading" : "anon", email: null, plan: null, error: null }
  );

  useEffect(() => {
    if (forced !== undefined || !supabase) return undefined;
    let alive = true;
    const load = async (session) => {
      if (!alive) return;
      if (!session) return setAccess({ status: "anon", email: null, plan: null, error: null });
      const email = session.user?.email ?? null;
      setAccess((a) => ({ ...a, status: "signed", email }));
      const { data, error } = await supabase.rpc("my_plan", { p_concurso: concursoId });
      if (!alive) return;
      setAccess({ status: "signed", email, plan: error ? null : (data ?? null), error: error ? "Não foi possível verificar sua compra agora. Recarregue a página." : null });
    };
    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") load(session);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [concursoId]);

  return access;
}
