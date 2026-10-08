-- =====================================================================
-- Corrige privilégios das tabelas do Diagnóstico Sprint 1.
-- O stub de teste concede ALL a anon/authenticated por padrão em novas
-- tabelas; precisamos revogar explicitamente, como faz a migração base.
-- =====================================================================

revoke all on public.diagnostico_perguntas  from anon, authenticated;
revoke all on public.diagnostico_respostas  from anon, authenticated;
revoke all on public.diagnostico_resultado  from anon, authenticated;

-- Perguntas: leitura pública para usuárias autenticadas
grant select on public.diagnostico_perguntas to authenticated;

-- Respostas: a usuária gerencia as próprias; RLS garante isolamento
grant select, insert, update, delete on public.diagnostico_respostas to authenticated;

-- Resultado: leitura (inserção feita pelo RPC SECURITY DEFINER)
grant select on public.diagnostico_resultado to authenticated;
