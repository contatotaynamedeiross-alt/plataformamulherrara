-- =====================================================================
-- Sprint 5 · webhook_log — grants
-- Tabela de auditoria interna: nenhum acesso para usuárias.
-- =====================================================================

revoke all on public.webhook_log from anon, authenticated;
-- service_role tem ALL implicitamente (edge function usa service_role_key).
