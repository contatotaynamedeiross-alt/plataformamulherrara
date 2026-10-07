-- =====================================================================
-- Sprint 2 · Jornada Rara — 5 módulos com agentes de IA por pilar
-- =====================================================================

-- -------------------------------------------------------------------
-- Tabelas
-- -------------------------------------------------------------------

create table public.jornada_sessoes (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  pilar      text        not null check (pilar in ('identidade','posicionamento','produto','marketing','marca')),
  status     text        not null default 'ativa' check (status in ('ativa','concluida','arquivada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.jornada_sessoes enable row level security;
create policy "sessoes_owner" on public.jornada_sessoes
  for all to authenticated
  using  (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- -------------------------------------------------------------------

create table public.jornada_mensagens (
  id         uuid        primary key default gen_random_uuid(),
  sessao_id  uuid        not null references public.jornada_sessoes(id) on delete cascade,
  role       text        not null check (role in ('user','assistant')),
  conteudo   text        not null,
  created_at timestamptz not null default now()
);
alter table public.jornada_mensagens enable row level security;
create policy "mensagens_owner" on public.jornada_mensagens
  for all to authenticated
  using (exists (
    select 1 from public.jornada_sessoes s
    where s.id = sessao_id and s.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.jornada_sessoes s
    where s.id = sessao_id and s.user_id = (select auth.uid())
  ));

-- -------------------------------------------------------------------

create table public.jornada_entregas (
  id         uuid        primary key default gen_random_uuid(),
  sessao_id  uuid        not null references public.jornada_sessoes(id) on delete cascade,
  tipo       text        not null,
  conteudo   jsonb       not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.jornada_entregas enable row level security;
create policy "entregas_owner" on public.jornada_entregas
  for select to authenticated
  using (exists (
    select 1 from public.jornada_sessoes s
    where s.id = sessao_id and s.user_id = (select auth.uid())
  ));
