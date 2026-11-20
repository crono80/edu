// Webhook de vendas da Kiwify -> tabela purchases (Supabase Edge Function, Deno).
// URL: https://<projeto>.supabase.co/functions/v1/kiwify-webhook  (verify JWT: desligado; a Kiwify não manda JWT)
// Segredo: KIWIFY_TOKEN = token do webhook na Kiwify. A Kiwify assina com ?signature=<HMAC-SHA1 hex do corpo bruto>.
// Eventos: compra_aprovada, compra_reembolsada, chargeback. Os demais são ignorados (200).
import { createClient } from "jsr:@supabase/supabase-js@2";

const TOKEN = Deno.env.get("KIWIFY_TOKEN") ?? "";
const URL_ = Deno.env.get("SUPABASE_URL") ?? "";
// Chave de serviço: nome novo (secret key) ou legado (service role), conforme a versão do Supabase.
function serviceKey(): string {
  const direct = Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (direct) return direct;
  try {
    const all = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    return all.default ?? Object.values(all)[0] ?? "";
  } catch {
    return "";
  }
}
const db = createClient(URL_, serviceKey(), { auth: { persistSession: false } });

const STATUS: Record<string, "approved" | "refunded" | "chargeback"> = {
  paid: "approved",
  approved: "approved",
  order_approved: "approved",
  compra_aprovada: "approved",
  refunded: "refunded",
  order_refunded: "refunded",
  compra_reembolsada: "refunded",
  chargedback: "chargeback",
  chargeback: "chargeback",
};

async function hmacSha1Hex(key: string, body: Uint8Array): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, body));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!TOKEN) return json({ error: "KIWIFY_TOKEN not set" }, 503);

  const raw = new Uint8Array(await req.arrayBuffer());
  const signature = (new URL(req.url).searchParams.get("signature") ?? "").toLowerCase();
  if (!signature || !sameText(signature, await hmacSha1Hex(TOKEN, raw))) return json({ error: "invalid signature" }, 401);

  let p: any;
  try {
    p = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const orderId = String(p.order_id ?? p.order_ref ?? "").trim();
  const status = STATUS[String(p.order_status ?? "").toLowerCase()] ?? STATUS[String(p.webhook_event_type ?? "").toLowerCase()];
  const customer = p.Customer ?? p.customer ?? {};
  const product = p.Product ?? p.product ?? {};
  const email = String(customer.email ?? "").trim().toLowerCase();
  const productId = String(product.product_id ?? product.id ?? p.product_id ?? "").trim();
  if (!orderId || !email || !status) return json({ ignored: true, order_status: p.order_status ?? null, event: p.webhook_event_type ?? null });

  // Reembolso e chargeback são finais: um "aprovado" atrasado ou reenviado não devolve o acesso.
  const { data: prev } = await db.from("purchases").select("status").eq("provider", "kiwify").eq("order_id", orderId).maybeSingle();
  if (prev && prev.status !== "approved" && status === "approved") return json({ kept: prev.status });

  const { data: prod } = await db.from("products").select("plan, concurso").eq("provider", "kiwify").eq("product_id", productId).maybeSingle();
  const row = {
    provider: "kiwify",
    order_id: orderId,
    product_id: productId || null,
    email,
    name: customer.full_name ?? customer.name ?? null,
    plan: prod?.plan ?? null, // produto sem mapeamento fica registrado sem plano (não libera acesso)
    concurso: prod?.concurso ?? null,
    status,
    event: String(p.webhook_event_type ?? p.order_status ?? ""),
    updated_at: new Date().toISOString(),
  };
  const { error } = await db.from("purchases").upsert(row, { onConflict: "provider,order_id" });
  if (error) {
    console.error("purchases upsert", error);
    return json({ error: "db" }, 500);
  }
  return json({ ok: true, status, plan: row.plan });
});
