-- =====================================================================
-- Corrige privilégios das tabelas da Jornada Sprint 2.
-- O stub de teste concede ALL a anon/authenticated por padrão em novas
-- tabelas; precisamos revogar explicitamente, como faz a migração base.
-- =====================================================================

revoke all on public.jornada_sessoes   from anon, authenticated;
revoke all on public.jornada_mensagens from anon, authenticated;
revoke all on public.jornada_entregas  from anon, authenticated;

-- Sessões: usuária gerencia as próprias; RLS garante isolamento
grant select, insert, update on public.jornada_sessoes   to authenticated;

-- Mensagens: usuária lê e insere nas próprias sessões (via RLS)
grant select, insert         on public.jornada_mensagens to authenticated;

-- Entregas: apenas leitura (inserção feita pela Edge Function via service_role)
grant select                 on public.jornada_entregas  to authenticated;

-- service_role: acesso total para a Edge Function
grant all on public.jornada_sessoes   to service_role;
grant all on public.jornada_mensagens to service_role;
grant all on public.jornada_entregas  to service_role;
