-- =====================================================================
-- Sprint 4 · Mentoras de IA — RPC de incremento atômico
-- Chamada apenas pela edge function (service_role).
-- =====================================================================

-- Incrementa (ou cria) o contador de uso da mentora para a usuária no dia.
-- SECURITY DEFINER + search_path fixo para evitar privilege escalation.
create or replace function public.incrementar_uso_mentora(
  p_user_id uuid,
  p_data    date
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.mentora_uso (user_id, data, contagem, updated_at)
  values (p_user_id, p_data, 1, now())
  on conflict (user_id, data)
  do update set
    contagem   = mentora_uso.contagem + 1,
    updated_at = now();
end;
$$;

-- Só service_role pode chamar; authenticated não tem execute direto
revoke execute on function public.incrementar_uso_mentora(uuid, date) from anon, authenticated;
