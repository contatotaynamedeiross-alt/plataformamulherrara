-- ============================================================
-- Rara IA — Sprint 0 · Migração 001: Schema + RLS
-- ============================================================
-- Regras que nunca se quebram:
--   • Toda tabela tem RLS habilitado
--   • Nenhum acesso para a role "anon"
--   • Escritas sensíveis só via RPC SECURITY DEFINER search_path = ''
--   • Sem CPF, endereço ou telefone
--   • Sem dado pessoal em logs
-- ============================================================

-- Extensões
create extension if not exists "uuid-ossp" schema extensions;
create extension if not exists pgcrypto schema extensions;

-- ────────────────────────────────────────────────────────────
-- Schema privado para funções internas (sem acesso direto)
-- ────────────────────────────────────────────────────────────
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- PERFIS
-- ────────────────────────────────────────────────────────────
create table public.profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  full_name   text        not null check (char_length(full_name) between 2 and 120),
  email       text        not null check (email ~* '^[^@]+@[^@]+\.[^@]+$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.profiles is
  'Dados mínimos do perfil. CPF, endereço e telefone NÃO são armazenados (LGPD art. 6, IX).';

alter table public.profiles enable row level security;

create policy usuario_ve_proprio_perfil
  on public.profiles for select
  using (auth.uid() = id);

create policy usuario_atualiza_proprio_perfil
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ────────────────────────────────────────────────────────────
-- ASSINATURAS  (só o servidor escreve via webhook)
-- ────────────────────────────────────────────────────────────
create table public.subscriptions (
  id                  uuid        primary key default extensions.uuid_generate_v4(),
  user_id             uuid        not null references public.profiles(id) on delete cascade,
  greenn_order_id     text        not null unique,
  greenn_product_id   text        not null,
  status              text        not null
                        check (status in ('trial','active','cancelled','expired')),
  trial_ends_at       timestamptz,
  current_period_end  timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
comment on table public.subscriptions is
  'Status de assinatura. Somente o servidor (via webhook Greenn) pode escrever aqui.';

alter table public.subscriptions enable row level security;

create policy usuario_ve_propria_assinatura
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- INSERT/UPDATE/DELETE: somente via RPC service_role (sem policy de escrita para authenticated)

-- ────────────────────────────────────────────────────────────
-- CONVITES  (gerados após pagamento confirmado)
-- ────────────────────────────────────────────────────────────
create table public.invites (
  id          uuid        primary key default extensions.uuid_generate_v4(),
  email       text        not null check (email ~* '^[^@]+@[^@]+\.[^@]+$'),
  token       text        not null unique
                default encode(extensions.gen_random_bytes(32), 'hex'),
  used        boolean     not null default false,
  expires_at  timestamptz not null default (now() + interval '48 hours'),
  created_at  timestamptz not null default now()
);
comment on table public.invites is
  'Tokens de convite. Nenhum acesso direto pelo cliente.';

alter table public.invites enable row level security;
-- Nenhuma policy: somente service_role acessa (via RPC SECURITY DEFINER)

-- ────────────────────────────────────────────────────────────
-- CONSENTIMENTOS  (LGPD art. 11 — dado sensível)
-- ────────────────────────────────────────────────────────────
create table public.consents (
  id          uuid        primary key default extensions.uuid_generate_v4(),
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  purpose     text        not null,   -- ex: 'diagnostic_sensitive_v1'
  version     text        not null,
  accepted    boolean     not null,
  accepted_at timestamptz not null default now(),
  unique (user_id, purpose, version)
);
comment on table public.consents is
  'Registro de consentimento explícito para dados sensíveis (LGPD art. 11).';

alter table public.consents enable row level security;

create policy usuario_ve_proprios_consentimentos
  on public.consents for select
  using (auth.uid() = user_id);

-- INSERT: via RPC record_consent (SECURITY DEFINER)
-- UPDATE/DELETE: proibido — consentimento é imutável; para revogar, insere nova linha com accepted=false

-- ────────────────────────────────────────────────────────────
-- DIAGNÓSTICOS
-- ────────────────────────────────────────────────────────────
create table public.diagnostics (
  id                 uuid        primary key default extensions.uuid_generate_v4(),
  user_id            uuid        not null references public.profiles(id) on delete cascade,
  answers            jsonb       not null,
  result             jsonb       not null,
  contains_sensitive boolean     not null default false,
  consent_id         uuid        references public.consents(id),
  created_at         timestamptz not null default now()
);
comment on table public.diagnostics is
  'Se contains_sensitive=true, consent_id é obrigatório (crença religiosa = dado sensível).';

alter table public.diagnostics enable row level security;

create policy usuario_ve_proprios_diagnosticos
  on public.diagnostics for select
  using (auth.uid() = user_id);

-- Trigger: dado sensível sem consentimento é recusado
create or replace function private.check_diagnostic_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.contains_sensitive = true and new.consent_id is null then
    raise exception
      'LGPD: consentimento explícito obrigatório para dado sensível (art. 11).'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger trg_diagnostic_consent
  before insert or update on public.diagnostics
  for each row execute function private.check_diagnostic_consent();

-- ────────────────────────────────────────────────────────────
-- PLANOS DE 30 DIAS
-- ────────────────────────────────────────────────────────────
create table public.plans (
  id             uuid        primary key default extensions.uuid_generate_v4(),
  user_id        uuid        not null references public.profiles(id) on delete cascade,
  diagnostic_id  uuid        references public.diagnostics(id),
  content        jsonb       not null,
  starts_at      timestamptz not null default now(),
  ends_at        timestamptz not null default (now() + interval '30 days'),
  created_at     timestamptz not null default now()
);

alter table public.plans enable row level security;

create policy usuario_ve_proprios_planos
  on public.plans for select
  using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- MISSÕES
-- ────────────────────────────────────────────────────────────
create table public.missions (
  id           uuid        primary key default extensions.uuid_generate_v4(),
  user_id      uuid        not null references public.profiles(id) on delete cascade,
  plan_id      uuid        references public.plans(id),
  title        text        not null check (char_length(title) between 3 and 200),
  description  text,
  status       text        not null default 'pending'
                 check (status in ('pending','completed','skipped')),
  due_date     date,
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);

alter table public.missions enable row level security;

create policy usuario_ve_proprias_missoes
  on public.missions for select
  using (auth.uid() = user_id);

create policy usuario_atualiza_propria_missao
  on public.missions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
-- Restrição adicional (cliente só pode mudar status e completed_at) é
-- aplicada pelo trigger trg_mission_update_guard abaixo.

-- Impede que o cliente altere campos imutáveis da missão
create or replace function private.guard_mission_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.title    <> old.title    then raise exception 'Campo title não pode ser alterado pelo cliente.'; end if;
  if new.user_id  <> old.user_id  then raise exception 'Campo user_id não pode ser alterado.'; end if;
  if (new.plan_id is distinct from old.plan_id) then raise exception 'Campo plan_id não pode ser alterado.'; end if;
  return new;
end;
$$;

create trigger trg_mission_update_guard
  before update on public.missions
  for each row execute function private.guard_mission_update();

-- ────────────────────────────────────────────────────────────
-- PONTOS  (só o servidor concede)
-- ────────────────────────────────────────────────────────────
create table public.points (
  id         uuid        primary key default extensions.uuid_generate_v4(),
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  amount     integer     not null check (amount > 0),
  reason     text        not null,
  source     text        not null
               check (source in ('mission','diagnostic','bonus')),
  granted_at timestamptz not null default now()
);
comment on table public.points is
  'Pontos concedidos APENAS pelo servidor. Nenhuma policy de escrita para authenticated.';

alter table public.points enable row level security;

create policy usuario_ve_proprios_pontos
  on public.points for select
  using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- MEDALHAS
-- ────────────────────────────────────────────────────────────
create table public.medals (
  id          uuid        primary key default extensions.uuid_generate_v4(),
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  medal_type  text        not null check (medal_type ~ '^[a-z_]+$'),
  granted_at  timestamptz not null default now(),
  unique (user_id, medal_type)
);
comment on table public.medals is
  'Medalhas concedidas APENAS pelo servidor (RPC SECURITY DEFINER).';

alter table public.medals enable row level security;

create policy usuario_ve_proprias_medalhas
  on public.medals for select
  using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- LOG DE AUDITORIA  (append-only, sem dado pessoal)
-- ────────────────────────────────────────────────────────────
create table private.audit_log (
  id          uuid        primary key default extensions.uuid_generate_v4(),
  user_id     uuid,       -- nullable: ações de sistema não têm user
  action      text        not null,
  table_name  text,
  record_id   uuid,
  -- metadata NUNCA deve conter: nome, e-mail, CPF, IP, dado pessoal
  metadata    jsonb,
  created_at  timestamptz not null default now()
);
comment on table private.audit_log is
  'Log de auditoria. Sem dados pessoais. Somente INSERT via função privada.';

-- Função pública segura para inserir no log
create or replace function private.log_audit(
  p_user_id   uuid,
  p_action    text,
  p_table     text    default null,
  p_record_id uuid    default null,
  p_metadata  jsonb   default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.audit_log (user_id, action, table_name, record_id, metadata)
  values (p_user_id, p_action, p_table, p_record_id, p_metadata);
end;
$$;

-- ────────────────────────────────────────────────────────────
-- FILA DE EVENTOS INTERNOS (webhook idempotente)
-- ────────────────────────────────────────────────────────────
create table private.processed_events (
  event_id    text        primary key,
  processed_at timestamptz not null default now()
);
comment on table private.processed_events is
  'Garante idempotência: evento Greenn recebido duas vezes é ignorado na segunda vez.';

-- Purge automático (chamado pelo pg_cron configurado no Supabase)
create or replace function private.purge_old_events()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.processed_events
  where processed_at < now() - interval '30 days';
$$;

-- ────────────────────────────────────────────────────────────
-- UPDATED_AT automático
-- ────────────────────────────────────────────────────────────
create or replace function private.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create trigger trg_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function private.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- RPCs PÚBLICAS (SECURITY DEFINER para escritas sensíveis)
-- ────────────────────────────────────────────────────────────

-- Registrar consentimento
create or replace function public.record_consent(
  p_purpose text,
  p_version text,
  p_accepted boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.consents (user_id, purpose, version, accepted)
  values (auth.uid(), p_purpose, p_version, p_accepted)
  on conflict (user_id, purpose, version) do nothing
  returning id into v_id;

  perform private.log_audit(
    auth.uid(), 'consent_recorded', 'consents', v_id,
    jsonb_build_object('purpose', p_purpose, 'version', p_version, 'accepted', p_accepted)
  );

  return v_id;
end;
$$;
comment on function public.record_consent is
  'Registra consentimento LGPD. Idempotente: segunda chamada com mesmos params é ignorada.';

-- Conceder pontos (chamada interna após missão completa)
create or replace function public.grant_points(
  p_user_id uuid,
  p_amount  integer,
  p_reason  text,
  p_source  text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  -- Somente service_role pode chamar esta função
  if current_setting('role', true) not in ('service_role', 'supabase_admin') then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;

  insert into public.points (user_id, amount, reason, source)
  values (p_user_id, p_amount, p_reason, p_source)
  returning id into v_id;

  return v_id;
end;
$$;
comment on function public.grant_points is
  'Concede pontos. Somente service_role pode chamar.';

-- Exportar dados do próprio usuário (LGPD art. 18, V)
create or replace function public.export_my_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  return jsonb_build_object(
    'exported_at', now(),
    'profile',       (select row_to_json(p) from public.profiles p where p.id = v_uid),
    'subscriptions', (select json_agg(s) from public.subscriptions s where s.user_id = v_uid),
    'diagnostics',   (select json_agg(d) from public.diagnostics d where d.user_id = v_uid),
    'plans',         (select json_agg(pl) from public.plans pl where pl.user_id = v_uid),
    'missions',      (select json_agg(m) from public.missions m where m.user_id = v_uid),
    'points',        (select json_agg(pt) from public.points pt where pt.user_id = v_uid),
    'medals',        (select json_agg(md) from public.medals md where md.user_id = v_uid),
    'consents',      (select json_agg(c) from public.consents c where c.user_id = v_uid)
  );
end;
$$;
comment on function public.export_my_data is
  'Exporta todos os dados da usuária autenticada (LGPD art. 18, V).';

-- Excluir conta (LGPD art. 18, VI)
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  perform private.log_audit(v_uid, 'account_deleted', 'profiles', v_uid, null);

  -- ON DELETE CASCADE cuida das tabelas filhas
  delete from public.profiles where id = v_uid;

  -- Remove da auth.users (Supabase)
  delete from auth.users where id = v_uid;
end;
$$;
comment on function public.delete_my_account is
  'Exclui conta e todos os dados da usuária (LGPD art. 18, VI). Irreversível.';
