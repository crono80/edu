-- Acesso pago: quem comprou (webhook da Kiwify) e qual plano cada produto libera.
-- Rodar no SQL Editor do projeto Supabase. Idempotente: pode rodar de novo.

-- Produtos da Kiwify -> plano e concurso. Só o webhook (service role) lê: sem policies.
create table if not exists public.products (
  provider   text not null default 'kiwify',
  product_id text not null,
  plan       text not null check (plan in ('essencial', 'completo')),
  concurso   text not null,
  label      text,
  primary key (provider, product_id)
);
alter table public.products enable row level security;

-- Um registro por pedido. Reembolso e chargeback são finais (o webhook não volta para "approved").
create table if not exists public.purchases (
  id         bigint generated always as identity primary key,
  provider   text not null default 'kiwify',
  order_id   text not null,
  product_id text,
  email      text not null,
  name       text,
  plan       text check (plan in ('essencial', 'completo')),
  concurso   text,
  status     text not null check (status in ('approved', 'refunded', 'chargeback')),
  event      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, order_id)
);
create index if not exists purchases_email_idx on public.purchases (lower(email));
alter table public.purchases enable row level security;

-- O usuário logado (Google, e-mail verificado) vê só as próprias compras.
drop policy if exists purchases_select_own on public.purchases;
create policy purchases_select_own on public.purchases
  for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Plano ativo do usuário logado: 'completo', 'essencial' ou null. Roda com as permissões de quem chama (RLS vale).
create or replace function public.my_plan(p_concurso text default null)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when bool_or(plan = 'completo') then 'completo'
    when bool_or(plan = 'essencial') then 'essencial'
  end
  from public.purchases
  where status = 'approved'
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and (p_concurso is null or concurso = p_concurso);
$$;
revoke all on function public.my_plan(text) from public, anon;
grant execute on function public.my_plan(text) to authenticated;
