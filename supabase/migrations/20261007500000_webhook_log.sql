-- =====================================================================
-- Sprint 5 · Melhoria do asaas-webhook
-- Tabela pública de auditoria de webhooks; substitui private.provider_events
-- para eventos tratados pela nova lógica de assinantes.
-- =====================================================================

create table public.webhook_log (
  id               uuid        primary key default gen_random_uuid(),
  idempotency_key  text        not null unique check (char_length(idempotency_key) = 64),
  event_type       text        not null,
  user_id          uuid,
  provider_ref     text        not null,
  outcome          text        not null
                               check (outcome in ('applied','duplicate','ignored')),
  payload_redacted jsonb       not null default '{}',
  created_at       timestamptz not null default now()
);
alter table public.webhook_log enable row level security;
create index webhook_log_created_at_idx on public.webhook_log (created_at);
