-- =====================================================================
-- Testes de segurança e regras de negócio do banco.
-- Cada bloco falha (e derruba a execução) se a regra for violada.
-- =====================================================================
\set ON_ERROR_STOP 1
\set QUIET 1

-- Usuárias de teste (como o Supabase Auth faria)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@exemplo.com'),
  ('00000000-0000-0000-0000-00000000000b', 'bia@exemplo.com'),
  ('00000000-0000-0000-0000-00000000000c', 'admin@exemplo.com');
update auth.users set raw_app_meta_data = '{"role":"admin"}' where email = 'admin@exemplo.com';

do $$ begin
  assert (select count(*) from public.profiles) = 3, 'perfil deve ser criado no cadastro';
end $$;

-- ---------------------------------------------------------------------
-- Webhook: só service_role executa
-- ---------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', false);
do $$ begin
  perform public.apply_payment_event(repeat('a',64), 'contract', 'paid', 'c1', 'ana@exemplo.com', null, now(), '{}');
  raise exception 'FALHA: usuaria conseguiu chamar o webhook';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  insert into public.subscriptions (email, provider_ref, status) values ('ana@exemplo.com','x','active');
  raise exception 'FALHA: usuaria conseguiu criar assinatura';
exception when insufficient_privilege then null;
end $$;
reset role;

set role anon;
select set_config('request.jwt.claims', '', false);
do $$ begin
  perform 1 from public.profiles;
  raise exception 'FALHA: anonimo leu perfis';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform 1 from public.plan_tasks;
  raise exception 'FALHA: anonimo leu conteudo';
exception when insufficient_privilege then null;
end $$;
reset role;

-- ---------------------------------------------------------------------
-- Webhook pelo servidor: aplica, é idempotente e ignora fora de ordem
-- ---------------------------------------------------------------------
set role service_role;
do $$
declare r jsonb;
begin
  r := public.apply_payment_event(repeat('1',64), 'contract', 'paid', 'contrato-ana', 'ANA@exemplo.com',
                                 now() + interval '30 days', '2026-10-04 10:00+00', '{"type":"contract"}');
  assert r->>'outcome' = 'applied', 'evento deveria ser aplicado: ' || r::text;
  assert (r->>'needs_invite')::boolean = false, 'ana ja tem conta, nao precisa convite';

  r := public.apply_payment_event(repeat('1',64), 'contract', 'paid', 'contrato-ana', 'ana@exemplo.com', null, now(), '{}');
  assert r->>'outcome' = 'duplicate', 'evento repetido deveria ser ignorado';

  r := public.apply_payment_event(repeat('2',64), 'contract', 'canceled', 'contrato-ana', 'ana@exemplo.com',
                                 null, '2026-10-01 10:00+00', '{}');
  assert r->>'outcome' = 'ignored_stale', 'evento antigo nao pode cancelar assinatura nova';

  r := public.apply_payment_event(repeat('3',64), 'contract', 'paid', 'contrato-nova', 'nova@exemplo.com',
                                 null, now(), '{}');
  assert (r->>'needs_invite')::boolean, 'compradora sem conta precisa de convite';

  r := public.apply_payment_event(repeat('4',64), 'sale', 'waiting_payment', 'venda-x', 'ana@exemplo.com', null, now(), '{}');
  assert r->>'outcome' = 'ignored_status', 'status sem efeito deve ser ignorado';

  r := public.apply_payment_event(repeat('5',64), 'contract', 'paid', 'contrato-bia', 'bia@exemplo.com', null, now(), '{}');
  assert r->>'outcome' = 'applied';
end $$;
reset role;

-- ---------------------------------------------------------------------
-- Diagnóstico: só assinante ativa com consentimento
-- ---------------------------------------------------------------------
set role service_role;
do $$ begin
  -- Cria assinatura ativa para Ana
  insert into public.assinantes (user_id, plano, status)
  values ('00000000-0000-0000-0000-00000000000a', 'mensal', 'ativo');
  -- Registra consentimento para Ana
  insert into public.consents (user_id, document, version, ip_hash)
  values ('00000000-0000-0000-0000-00000000000a', 'dados_sensiveis', '2026-04', 'hash');
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', false);
do $$
declare r jsonb;
begin
  r := public.submit_diagnostic(array[3,4,3,4,3,4,3,4,3,4,3,4]::smallint[]);
  assert r is not null, 'submit_diagnostic deveria retornar resultado';
  assert r->>'foco' is not null, 'resultado deve ter foco';
  assert r->>'forca' is not null, 'resultado deve ter forca';
end $$;

-- Bia (sem assinatura) não pode enviar diagnóstico
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', false);
do $$ begin
  perform public.submit_diagnostic(array[3,4,3,4,3,4,3,4,3,4,3,4]::smallint[]);
  raise exception 'FALHA: bia sem assinatura conseguiu fazer diagnostico';
exception when raise_exception then
  assert sqlerrm like '%assinatura_ativa%' or sqlerrm like '%acesso%' or sqlerrm like '%consentimento%',
    'excecao errada: ' || sqlerrm;
end $$;
reset role;

-- Isolamento do diagnóstico: Ana não lê resultado de Bia
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', false);
do $$
declare cnt integer;
begin
  select count(*) into cnt from public.diagnostic_results;
  assert cnt = 1, 'ana deveria ver apenas o proprio diagnostico, viu: ' || cnt;
end $$;
reset role;

-- ---------------------------------------------------------------------
-- Jornada: só assinante ativa cria sessão
-- ---------------------------------------------------------------------
set role service_role;
do $$ begin
  insert into public.jornada_sessoes (user_id, pilar)
  values ('00000000-0000-0000-0000-00000000000a', 'identidade');
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', false);
do $$ begin
  insert into public.jornada_sessoes (user_id, pilar)
  values ('00000000-0000-0000-0000-00000000000b', 'marketing');
  raise exception 'FALHA: bia sem assinatura criou sessao de jornada';
exception when insufficient_privilege then null;
exception when raise_exception then
  assert sqlerrm like '%assinatura%' or sqlerrm like '%acesso%',
    'excecao errada: ' || sqlerrm;
end $$;
reset role;

-- Isolamento da jornada: authenticated só vê suas próprias sessões
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', false);
do $$
declare cnt integer;
begin
  select count(*) into cnt from public.jornada_sessoes;
  assert cnt = 1, 'ana deveria ver apenas a propria sessao, viu: ' || cnt;
end $$;
reset role;

-- ---------------------------------------------------------------------
-- Assinantes: isolamento e restrição de escrita
-- ---------------------------------------------------------------------
set role anon;
select set_config('request.jwt.claims', '', false);
do $$ begin
  perform 1 from public.assinantes;
  raise exception 'FALHA: anonimo leu assinantes';
exception when insufficient_privilege then null;
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', false);
do $$ begin
  insert into public.assinantes (user_id, plano, status)
  values ('00000000-0000-0000-0000-00000000000a', 'anual', 'ativo');
  raise exception 'FALHA: authenticated conseguiu inserir assinante';
exception when insufficient_privilege then null;
exception when unique_violation then null;
end $$;

-- Ana só vê a própria assinatura
do $$
declare cnt integer;
begin
  select count(*) into cnt from public.assinantes;
  assert cnt = 1, 'ana deveria ver apenas a propria assinatura, viu: ' || cnt;
end $$;
reset role;

-- ---------------------------------------------------------------------
-- Regras gerais: RLS em todas as tabelas, search_path em SECURITY DEFINER
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  select string_agg(c.relname, ', ') into t
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('public','private') and c.relkind = 'r' and not c.relrowsecurity;
  assert t is null, 'tabelas sem RLS: ' || t;
end $$;

-- Toda função SECURITY DEFINER tem search_path fixo
do $$
declare f text;
begin
  select string_agg(p.proname, ', ') into f
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public','private') and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
  assert f is null, 'funcoes sem search_path: ' || f;
end $$;

-- =====================================================================
-- Sprint 4 · Mentoras de IA — testes de segurança
-- =====================================================================

-- Anônimo não pode ler mentora_uso
set role anon;
select set_config('request.jwt.claims', '', false);
do $$ begin
  perform 1 from public.mentora_uso;
  raise exception 'FALHA: anonimo leu mentora_uso';
exception when insufficient_privilege then null;
end $$;
reset role;

-- Authenticated não pode fazer INSERT direto em mentora_uso
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', false);
do $$ begin
  insert into public.mentora_uso (user_id, data, contagem)
  values ('00000000-0000-0000-0000-00000000000a', current_date, 1);
  raise exception 'FALHA: authenticated conseguiu inserir em mentora_uso';
exception when insufficient_privilege then null;
end $$;

-- Authenticated não pode chamar incrementar_uso_mentora diretamente
do $$ begin
  perform public.incrementar_uso_mentora('00000000-0000-0000-0000-00000000000a', current_date);
  raise exception 'FALHA: authenticated conseguiu chamar incrementar_uso_mentora';
exception when insufficient_privilege then null;
end $$;
reset role;

-- Isolamento: authenticated só vê sua própria linha
set role service_role;
perform public.incrementar_uso_mentora('00000000-0000-0000-0000-00000000000a', current_date);
perform public.incrementar_uso_mentora('00000000-0000-0000-0000-00000000000b', current_date);
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', false);
do $$
declare cnt integer;
begin
  select count(*) into cnt from public.mentora_uso;
  assert cnt = 1, 'authenticated deveria ver apenas a propria linha, viu: ' || cnt;
end $$;
reset role;

-- service_role pode incrementar e o contador aumenta
set role service_role;
do $$
declare v integer;
begin
  perform public.incrementar_uso_mentora('00000000-0000-0000-0000-00000000000a', current_date);
  select contagem into v from public.mentora_uso
   where user_id = '00000000-0000-0000-0000-00000000000a' and data = current_date;
  assert v = 2, 'contagem deveria ser 2, é: ' || v;
end $$;
reset role;

\echo 'OK: todos os testes de seguranca do banco passaram'
