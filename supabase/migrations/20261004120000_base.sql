-- =====================================================================
-- Rara IA · Base do banco
-- Princípios:
--   1. Toda tabela nasce com RLS ligada e sem acesso; liberamos o mínimo.
--   2. Escritas sensíveis (pontos, assinatura, diagnóstico) só por funções
--      do servidor (SECURITY DEFINER com search_path vazio).
--   3. Dados mínimos (LGPD art. 6, III): nada de CPF, endereço ou telefone.
-- =====================================================================

create schema if not exists private;
revoke all on schema private from public;
-- anon/authenticated não enxergam o schema private (não exposto na API).

-- ---------------------------------------------------------------------
-- Utilitários
-- ---------------------------------------------------------------------
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Dia corrente no fuso da usuária-padrão (Brasília).
create or replace function private.today_br()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

-- Administradora: definido só pelo servidor em app_metadata.role = 'admin'.
-- app_metadata não pode ser alterado pela própria usuária.
create or replace function private.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$$;

-- ---------------------------------------------------------------------
-- Auditoria (sem dados pessoais em texto aberto)
-- ---------------------------------------------------------------------
create table private.audit_log (
  id          bigint generated always as identity primary key,
  actor       uuid,
  action      text not null check (char_length(action) <= 60),
  subject     text,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index audit_log_created_at_idx on private.audit_log (created_at);

create or replace function private.audit(p_action text, p_subject text, p_meta jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.audit_log (actor, action, subject, meta)
  values (auth.uid(), p_action, p_subject, coalesce(p_meta, '{}'::jsonb));
$$;
revoke all on function private.audit(text, text, jsonb) from public;

-- Hash irreversível para guardar referência a e-mail sem guardar o e-mail.
create or replace function private.hash_text(p text)
returns text
language sql
immutable
set search_path = ''
as $$ select encode(sha256(convert_to(lower(coalesce(p, '')), 'UTF8')), 'hex') $$;

-- ---------------------------------------------------------------------
-- Conteúdo do método (leitura para assinantes; escrita só por migração)
-- ---------------------------------------------------------------------
create table public.stages (
  id          smallint primary key check (id between 1 and 6),
  slug        text not null unique,
  name        text not null,
  short_name  text not null
);

create table public.diagnostic_questions (
  id            smallint primary key check (id between 1 and 12),
  stage_id      smallint not null references public.stages (id),
  position      smallint not null check (position between 1 and 2),
  statement     text not null,
  is_sensitive  boolean not null default false,
  unique (stage_id, position)
);

create table public.plan_tasks (
  id           text primary key,
  stage_id     smallint not null references public.stages (id),
  week         smallint not null check (week between 1 and 4),
  week_title   text not null,
  position     smallint not null check (position between 1 and 3),
  description  text not null,
  points       smallint not null default 10 check (points between 0 and 100),
  unique (stage_id, week, position)
);

create table public.archetypes (
  stage_id     smallint primary key references public.stages (id),
  name         text not null,
  description  text not null,
  next_leap    text not null,
  tay_message  text not null
);

create table public.daily_offerings (
  weekday  smallint primary key check (weekday between 0 and 6),
  text     text not null
);

create table public.levels (
  min_points  integer primary key check (min_points >= 0),
  name        text not null unique
);

-- ---------------------------------------------------------------------
-- Perfil (1:1 com auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id                      uuid primary key references auth.users (id) on delete cascade,
  display_name            text check (char_length(display_name) <= 80),
  business                text check (char_length(business) <= 120),
  revenue_now             text check (revenue_now in ('nao_fatura','ate_5k','5k_20k','20k_50k','acima_50k')),
  revenue_goal            text check (revenue_goal in ('20k','50k','100k','acima_100k')),
  blockers                text[] not null default '{}'
                          check (cardinality(blockers) <= 2
                             and blockers <@ array['conteudo_que_vende','so_indicacao','nao_sabe_vender',
                                                   'cobrar_valor','sem_tempo','sem_foco','nao_se_sente_pronta']),
  time_per_day            text check (time_per_day in ('15min','30min','1h')),
  onboarding_completed_at timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------
-- Consentimentos (LGPD art. 7 e 11) — somente acréscimo, nunca edição
-- ---------------------------------------------------------------------
create table public.consents (
  id                bigint generated always as identity primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  purpose           text not null check (purpose in ('termos_uso','politica_privacidade','dados_sensiveis','comunicacoes')),
  document_version  text not null check (char_length(document_version) between 1 and 20),
  granted           boolean not null,
  created_at        timestamptz not null default now()
);
create index consents_user_purpose_idx on public.consents (user_id, purpose, created_at desc);

create or replace function private.has_consent(p_user uuid, p_purpose text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select c.granted from public.consents c
    where c.user_id = p_user and c.purpose = p_purpose
    order by c.created_at desc, c.id desc
    limit 1
  ), false)
$$;
revoke all on function private.has_consent(uuid, text) from public;

-- ---------------------------------------------------------------------
-- Assinaturas (escritas só pelo webhook, via service_role)
-- ---------------------------------------------------------------------
create table public.subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid references auth.users (id) on delete set null,
  email                text not null check (email = lower(email) and char_length(email) <= 254),
  provider             text not null default 'greenn' check (provider in ('greenn')),
  provider_ref         text not null check (char_length(provider_ref) <= 64),
  status               text not null check (status in ('trialing','active','past_due','canceled','refunded','chargedback')),
  current_period_end   timestamptz,
  provider_updated_at  timestamptz,
  status_changed_at    timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (provider, provider_ref)
);
create index subscriptions_email_idx on public.subscriptions (email);
create index subscriptions_user_idx on public.subscriptions (user_id);
create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function private.touch_updated_at();

-- A carência conta a partir da MUDANÇA de status, não de qualquer edição.
create or replace function private.track_status_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  return new;
end;
$$;
create trigger subscriptions_status_change before update on public.subscriptions
  for each row execute function private.track_status_change();

-- Acesso liberado: ativa, em teste, ou inadimplente há no máximo 3 dias (carência).
create or replace function private.has_active_access(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = p_user
      and (
        s.status in ('active','trialing')
        or (s.status = 'past_due' and s.status_changed_at > now() - interval '3 days')
      )
  )
$$;
revoke all on function private.has_active_access(uuid) from public;

-- Eventos recebidos do provedor: idempotência + trilha de auditoria.
-- payload_redacted nunca contém CPF, endereço, telefone ou e-mail em texto.
create table private.provider_events (
  id                bigint generated always as identity primary key,
  provider          text not null,
  idempotency_key   text not null unique check (char_length(idempotency_key) = 64),
  event_type        text not null,
  provider_status   text,
  outcome           text not null default 'received'
                    check (outcome in ('received','applied','ignored_stale','ignored_status','error')),
  payload_redacted  jsonb not null default '{}'::jsonb,
  received_at       timestamptz not null default now()
);
create index provider_events_received_idx on private.provider_events (received_at);

-- ---------------------------------------------------------------------
-- Jornada: diagnóstico, missões e entrega do dia
-- ---------------------------------------------------------------------
create table public.diagnostic_results (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  answers         smallint[] not null
                  check (cardinality(answers) = 12 and 1 <= all (answers) and 5 >= all (answers)),
  scores          smallint[] not null check (cardinality(scores) = 6),
  focus_stage     smallint not null references public.stages (id),
  strength_stage  smallint not null references public.stages (id),
  consent_id      bigint not null references public.consents (id),
  created_at      timestamptz not null default now()
);
create index diagnostic_results_user_idx on public.diagnostic_results (user_id, created_at desc);

create table public.task_completions (
  user_id        uuid not null references auth.users (id) on delete cascade,
  diagnostic_id  uuid not null references public.diagnostic_results (id) on delete cascade,
  task_id        text not null references public.plan_tasks (id),
  completed_at   timestamptz not null default now(),
  primary key (user_id, diagnostic_id, task_id)
);

create table public.daily_offering_log (
  user_id  uuid not null references auth.users (id) on delete cascade,
  day      date not null,
  primary key (user_id, day)
);

-- ---------------------------------------------------------------------
-- RLS: liga em tudo; nenhuma política = nenhum acesso
-- ---------------------------------------------------------------------
alter table public.stages               enable row level security;
alter table public.diagnostic_questions enable row level security;
alter table public.plan_tasks           enable row level security;
alter table public.archetypes           enable row level security;
alter table public.daily_offerings      enable row level security;
alter table public.levels               enable row level security;
alter table public.profiles             enable row level security;
alter table public.consents             enable row level security;
alter table public.subscriptions        enable row level security;
alter table public.diagnostic_results   enable row level security;
alter table public.task_completions     enable row level security;
alter table public.daily_offering_log   enable row level security;
alter table private.audit_log           enable row level security;
alter table private.provider_events     enable row level security;

-- O Supabase concede privilégios amplos por padrão no schema public.
-- Revogamos tudo e concedemos só o necessário, coluna por coluna.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all tables in schema private from anon, authenticated;

-- Conteúdo: leitura para usuárias logadas (o conteúdo não é segredo,
-- mas não é público para robôs anônimos).
grant select on public.stages, public.diagnostic_questions, public.plan_tasks,
                public.archetypes, public.daily_offerings, public.levels to authenticated;
create policy content_read on public.stages               for select to authenticated using (true);
create policy content_read on public.diagnostic_questions for select to authenticated using (true);
create policy content_read on public.plan_tasks           for select to authenticated using (true);
create policy content_read on public.archetypes           for select to authenticated using (true);
create policy content_read on public.daily_offerings      for select to authenticated using (true);
create policy content_read on public.levels               for select to authenticated using (true);

-- Perfil: a dona lê e edita só os campos de perfil.
grant select on public.profiles to authenticated;
grant update (display_name, business, revenue_now, revenue_goal, blockers, time_per_day)
  on public.profiles to authenticated;
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Consentimentos: a dona lê e acrescenta; não edita nem apaga (histórico legal).
grant select on public.consents to authenticated;
grant insert (purpose, document_version, granted) on public.consents to authenticated;
create policy consents_select_own on public.consents for select to authenticated
  using (user_id = (select auth.uid()));
create policy consents_insert_own on public.consents for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Assinatura: a dona só lê.
grant select on public.subscriptions to authenticated;
create policy subscriptions_select_own on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

-- Jornada: a dona só lê; escrita pelas funções abaixo.
grant select on public.diagnostic_results, public.task_completions, public.daily_offering_log to authenticated;
create policy diagnostic_select_own on public.diagnostic_results for select to authenticated
  using (user_id = (select auth.uid()));
create policy completions_select_own on public.task_completions for select to authenticated
  using (user_id = (select auth.uid()));
create policy offerings_select_own on public.daily_offering_log for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Novo cadastro: cria perfil e liga assinaturas pelo e-mail
-- ---------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  update public.subscriptions
     set user_id = new.id
   where email = lower(new.email) and user_id is null;
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
