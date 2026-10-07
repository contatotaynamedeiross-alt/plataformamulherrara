-- =====================================================================
-- Sprint 4 · Mentoras de IA — grants
-- =====================================================================

-- Revoga privilégios padrão (anon e authenticated não devem herdar PUBLIC)
revoke all on public.mentora_uso from anon, authenticated;

-- Authenticated: só leitura (a RLS restringe para a própria linha)
grant select on public.mentora_uso to authenticated;

-- service_role já tem ALL implicitamente; não precisa grant explícito.
