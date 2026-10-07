-- =====================================================================
-- Sprint 4 · Mentoras de IA
-- Tabela de controle de uso diário da IA por usuária.
-- A edge function (service_role) incrementa; a usuária só lê a própria.
-- =====================================================================

create table public.mentora_uso (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  data       date        not null default current_date,
  contagem   integer     not null default 0 check (contagem >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, data)
);
alter table public.mentora_uso enable row level security;

-- Leitura da própria linha; escrita só via service_role (função do servidor)
create policy "mentora_uso_owner_select" on public.mentora_uso
  for select to authenticated
  using (user_id = (select auth.uid()));
