-- 24/11/2026: progresso do aluno no Supabase (estado do app + eventos de uso). Idempotente: pode rodar de novo.
-- Rodar no SQL Editor do projeto Supabase. O app funciona sem estas tabelas (só localStorage).

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
