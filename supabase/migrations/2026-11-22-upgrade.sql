-- 22/11/2026: plano 'upgrade' (Essencial -> Completo pela diferença). Idempotente.
alter table public.products drop constraint if exists products_plan_check;
alter table public.products add constraint products_plan_check check (plan in ('essencial', 'completo', 'upgrade'));
alter table public.purchases drop constraint if exists purchases_plan_check;
alter table public.purchases add constraint purchases_plan_check check (plan in ('essencial', 'completo', 'upgrade'));

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

insert into public.products (provider, product_id, plan, concurso, label)
values ('kiwify', '064e6620-e641-11f1-8587-35b29347523e', 'upgrade', 'inss-tecnico-pre', 'INSS · Upgrade Essencial → Completo')
on conflict (provider, product_id) do update set plan = excluded.plan, concurso = excluded.concurso, label = excluded.label;
