// Public configuration. Nothing here is a secret: the OAuth client id and the Supabase publishable key ship in every
// page that uses them. Access is enforced by Row Level Security in Supabase (supabase/schema.sql).

// Google OAuth client (login + Google Agenda). Empty = Google buttons stay hidden.
export const GOOGLE_CLIENT_ID = "32512512170-m8ht04ls3o3mr1sfdoqiihno0c9egbv1.apps.googleusercontent.com";
// Planned blocks sent to Google per sync (studied blocks always go). null = the whole plan, until the exam.
export const GOOGLE_SYNC_DAYS = null;

// Supabase project "crono80": login (Google) and purchases (Kiwify webhook).
export const SUPABASE_URL = "https://udjeyanzghbkbvhayqgg.supabase.co";
export const SUPABASE_KEY = "sb_publishable_Rh633khUQRIwJYI7FZ8fTA_yGZ-Qq4w";

// Kiwify checkouts. Empty = the buttons point to the plans on the sales page.
export const CHECKOUT = {
  essencial: "https://pay.kiwify.com.br/hZt9oc1",
  completo: "https://pay.kiwify.com.br/edjvkE2",
  upgrade: "", // Essencial -> Completo, paying the difference
};
export const SALES_URL = "./vendas/#planos";
export const SUPPORT_EMAIL = "contato@cronograma80.com.br"; // público: aparece no app, na página de vendas e na política
