-- Acesso pago: quem comprou (webhook da Kiwify) e qual plano cada produto libera.
-- Rodar no SQL Editor do projeto Supabase. Idempotente: pode rodar de novo.

-- Produtos da Kiwify -> plano e concurso. Só o webhook (service role) lê: sem policies.
create table if not exists public.products (
  provider   text not null default 'kiwify',
  product_id text not null,
  plan       text not null check (plan in ('essencial', 'completo', 'upgrade')),
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
  plan       text check (plan in ('essencial', 'completo', 'upgrade')),
  concurso   text,
  status     text not null check (status in ('approved', 'refunded', 'chargeback')),
  event      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, order_id)
);
create index if not exists purchases_email_idx on public.purchases (lower(email));
alter table public.purchases enable row level security;

-- 'upgrade' (Essencial -> Completo pela diferença) só vale junto com um Essencial aprovado; ver my_plan().
-- Bancos criados antes de 22/11/2026: troca o check para aceitar 'upgrade'.
alter table public.products drop constraint if exists products_plan_check;
alter table public.products add constraint products_plan_check check (plan in ('essencial', 'completo', 'upgrade'));
alter table public.purchases drop constraint if exists purchases_plan_check;
alter table public.purchases add constraint purchases_plan_check check (plan in ('essencial', 'completo', 'upgrade'));

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
    -- upgrade sem Essencial não libera nada (o link do upgrade é público)
    when bool_or(plan = 'upgrade') and bool_or(plan = 'essencial') then 'completo'
    when bool_or(plan = 'essencial') then 'essencial'
  end
  from public.purchases
  where status = 'approved'
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and (p_concurso is null or concurso = p_concurso);
$$;
revoke all on function public.my_plan(text) from public, anon;
grant execute on function public.my_plan(text) to authenticated;

-- Progresso do aluno (24/11/2026). Mesmo conteúdo de supabase/migrations/2026-11-24-student-progress.sql.
-- Estado do app por aluno e concurso (o mesmo JSON do localStorage cpv:<packId>:v1).
-- updated_at vem do navegador (hora da última alteração local): no login, vence o mais recente.
create table if not exists public.student_state (
  user_id    uuid not null references auth.users (id) on delete cascade,
  concurso   text not null,
  state      jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, concurso)
);
alter table public.student_state enable row level security;

drop policy if exists student_state_select_own on public.student_state;
create policy student_state_select_own on public.student_state
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists student_state_insert_own on public.student_state;
create policy student_state_insert_own on public.student_state
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists student_state_update_own on public.student_state;
create policy student_state_update_own on public.student_state
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.student_state from anon, authenticated;
grant select, insert, update on public.student_state to authenticated;

-- Eventos de uso (só inserção pelo dono; ninguém lê pelo app).
create table if not exists public.student_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  concurso   text not null,
  type       text not null,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.student_events drop constraint if exists student_events_type_check;
alter table public.student_events add constraint student_events_type_check check (type in (
  'progress_check', 'progress_uncheck', 'reorganize', 'quiz_finished', 'quiz_answer',
  'self_level_set', 'pdf', 'ics', 'gcal_sync'
));
create index if not exists student_events_user_idx on public.student_events (user_id, concurso, created_at);
alter table public.student_events enable row level security;

drop policy if exists student_events_insert_own on public.student_events;
create policy student_events_insert_own on public.student_events
  for insert to authenticated
  with check (user_id = (select auth.uid()));

revoke all on public.student_events from anon, authenticated;
grant insert on public.student_events to authenticated;
