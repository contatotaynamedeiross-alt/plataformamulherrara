-- =====================================================================
-- Sprint 3 · Painel da Assinante
-- =====================================================================

create table public.assinantes (
  id                     uuid        primary key default gen_random_uuid(),
  user_id                uuid        not null references auth.users(id) on delete cascade unique,
  plano                  text        not null default 'mensal'
                                     check (plano in ('mensal','trimestral','anual')),
  status                 text        not null default 'ativo'
                                     check (status in ('ativo','suspenso','cancelado')),
  asaas_customer_id      text,
  asaas_subscription_id  text,
  data_inicio            timestamptz not null default now(),
  data_fim               timestamptz,
  created_at             timestamptz not null default now()
);
alter table public.assinantes enable row level security;

-- Leitura da própria linha; sem INSERT/UPDATE direto (só service_role via webhook)
create policy "assinantes_owner_select" on public.assinantes
  for select to authenticated
  using (user_id = (select auth.uid()));
