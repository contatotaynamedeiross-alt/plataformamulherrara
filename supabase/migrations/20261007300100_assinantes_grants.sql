-- =====================================================================
-- Corrige privilégios da tabela assinantes (Sprint 3).
-- O stub de teste concede ALL a anon/authenticated por padrão;
-- revogamos explicitamente e concedemos apenas o mínimo necessário.
-- =====================================================================

revoke all on public.assinantes from anon, authenticated;

-- Autenticada só lê a própria linha (RLS garante o filtro)
grant select on public.assinantes to authenticated;

-- service_role: acesso total para o webhook Asaas
grant all on public.assinantes to service_role;
