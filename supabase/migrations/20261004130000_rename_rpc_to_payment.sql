-- Renomeia apply_greenn_event → apply_payment_event para ficar agnóstico ao provedor.
-- Mantém compatibilidade: cria alias + revoga o nome antigo.

alter function public.apply_greenn_event(text, text, text, text, text, timestamptz, timestamptz, jsonb)
  rename to apply_payment_event;

-- Ajusta permissões (o RENAME mantém os grants, mas declaramos explicitamente)
revoke all on function public.apply_payment_event(text, text, text, text, text, timestamptz, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_payment_event(text, text, text, text, text, timestamptz, timestamptz, jsonb)
  to service_role;
