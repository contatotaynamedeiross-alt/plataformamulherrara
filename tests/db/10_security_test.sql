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
  perform public.apply_greenn_event(repeat('a',64), 'contract', 'paid', 'c1', 'ana@exemplo.com', null, now(), '{}');
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
  r := public.apply_greenn_event(repeat('1',64), 'contract', 'paid', 'contrato-ana', 'ANA@exemplo.com',
                                 now() + interval '30 days', '2026-10-04 10:00+00', '{"type":"contract"}');
  assert r->>'outcome' = 'applied', 'evento deveria ser aplicado: ' || r::text;
  assert (r->>'needs_invite')::boolean = false, 'ana ja tem conta, nao precisa convite';

  r := public.apply_greenn_event(repeat('1',64), 'contract', 'paid', 'contrato-ana', 'ana@exemplo.com', null, now(), '{}');
  assert r->>'outcome' = 'duplicate', 'evento repetido deveria ser ignorado';

  r := public.apply_greenn_event(repeat('2',64), 'contract', 'canceled', 'contrato-ana', 'ana@exemplo.com',
                                 null, '2026-10-01 10:00+00', '{}');
  assert r->>'outcome' = 'ignored_stale', 'evento antigo nao pode cancelar assinatura nova';

  r := public.apply_greenn_event(repeat('3',64), 'contract', 'paid', 'contrato-nova', 'nova@exemplo.com',
                                 null, now(), '{}');
  assert (r->>'needs_invite')::boolean, 'compradora sem conta precisa de convite';

  r := public.apply_greenn_event(repeat('4',64), 'sale', 'waiting_payment', 'venda-x', 'ana@exemplo.com', null, now(), '{}');
  assert r->>'outcome' = 'ignored_status', 'status sem efeito deve ser ignorado';

  r := public.apply_greenn_event(repeat('5',64), 'contract', 'paid', 'contrato-bia', 'bia@exemplo.com', null, now(), '{}');
  assert r->>'outcome' = 'applied';
end $$;
reset role;

do $$ begin
  assert (select status from public.subscriptions where provider_ref = 'contrato-ana') = 'active';
  assert (select user_id from public.subscriptions where provider_ref = 'contrato-ana') = '00000000-0000-0000-0000-00000000000a';
  assert (select email from public.subscriptions where provider_ref = 'contrato-ana') = 'ana@exemplo.com', 'email salvo em minusculas';
end $$;

-- Cadastro posterior liga a assinatura pelo e-mail
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000d', 'Nova@Exemplo.com');
do $$ begin
  assert (select user_id from public.subscriptions where provider_ref = 'contrato-nova') = '00000000-0000-0000-0000-00000000000d',
    'assinatura deveria ser ligada no cadastro';
end $$;

-- ---------------------------------------------------------------------
-- Isolamento entre usuárias (RLS)
-- ---------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', false);
do $$ begin
  assert (select count(*) from public.profiles) = 1, 'ana so pode ver o proprio perfil';
  assert (select count(*) from public.subscriptions) = 1, 'ana so pode ver a propria assinatura';
end $$;

-- Ana tenta editar o perfil da Bia: nenhuma linha afetada
update public.profiles set display_name = 'hack' where id = '00000000-0000-0000-0000-00000000000b';
reset role;
do $$ begin
  assert (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b') is null,
    'FALHA: ana alterou perfil da bia';
end $$;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', false);
-- Ana não pode mudar a data de onboarding (coluna sem permissão)
do $$ begin
  update public.profiles set onboarding_completed_at = now() where id = '00000000-0000-0000-0000-00000000000a';
  raise exception 'FALHA: coluna protegida foi alterada';
exception when insufficient_privilege then null;
end $$;
-- Ana não pode registrar consentimento em nome da Bia
do $$ begin
  insert into public.consents (user_id, purpose, document_version, granted)
  values ('00000000-0000-0000-0000-00000000000b', 'dados_sensiveis', 'v1', true);
  raise exception 'FALHA: consentimento em nome de outra';
exception when insufficient_privilege then null;
end $$;
-- Ana não pode apagar consentimentos (histórico legal)
do $$ begin
  delete from public.consents;
  raise exception 'FALHA: consentimento apagado';
exception when insufficient_privilege then null;
end $$;
-- Ana não pode se dar pontos escrevendo direto
do $$ begin
  insert into public.daily_offering_log (user_id, day) values ('00000000-0000-0000-0000-00000000000a', current_date - 1);
  raise exception 'FALHA: pontos inseridos direto';
exception when insufficient_privilege then null;
end $$;
-- Ana não acessa o schema privado
do $$ begin
  perform 1 from private.audit_log;
  raise exception 'FALHA: leu auditoria';
exception when insufficient_privilege then null;
end $$;
-- Ana não é admin
do $$ begin
  perform public.admin_subscription_summary();
  raise exception 'FALHA: usuaria comum viu painel admin';
exception when insufficient_privilege then null;
end $$;

-- ---------------------------------------------------------------------
-- Diagnóstico: exige consentimento de dado sensível; servidor calcula
-- ---------------------------------------------------------------------
do $$ begin
  perform public.submit_diagnostic('{5,4,3,2,5,5,3,2,3,3,2,2}'::smallint[]);
  raise exception 'FALHA: diagnostico salvo sem consentimento';
exception when insufficient_privilege then null;
end $$;

update public.profiles set display_name = 'Ana', revenue_now = '5k_20k', revenue_goal = '50k',
       blockers = '{conteudo_que_vende,so_indicacao}', time_per_day = '30min'
 where id = '00000000-0000-0000-0000-00000000000a';

insert into public.consents (purpose, document_version, granted) values ('dados_sensiveis', 'v1', true);

do $$
declare d public.diagnostic_results;
begin
  begin
    perform public.submit_diagnostic('{5,4,3,2,5,5,3,2,3,3,2,9}'::smallint[]);
    raise exception 'FALHA: resposta fora da escala aceita';
  exception when invalid_parameter_value then null;
  end;

  d := public.submit_diagnostic('{5,4,3,2,5,5,3,2,3,3,2,2}'::smallint[]);
  assert d.scores = '{88,38,100,38,50,25}'::smallint[], 'notas: ' || d.scores::text;
  assert d.focus_stage = 2, 'foco deve ser Mentalidade (primeira < 70)';
  assert d.strength_stage = 3, 'forca deve ser Proposito';
end $$;

-- Missões: só do plano atual
do $$ begin
  perform public.set_task_completion('vendas-1-1', true);
  raise exception 'FALHA: missao fora do plano aceita';
exception when invalid_parameter_value then null;
end $$;
select public.set_task_completion('mentalidade-1-1', true);
select public.set_task_completion('mentalidade-1-2', true);
select public.set_task_completion('mentalidade-1-2', true);  -- repetir não duplica
select public.mark_daily_offering();
select public.mark_daily_offering();                          -- uma vez por dia

do $$
declare p jsonb := public.get_my_progress();
begin
  assert (p->>'points')::int = 25, 'pontos: ' || p::text;
  assert p->>'level' = 'Dama';
  assert (p->>'points_to_next')::int = 55;
  assert (p->>'streak_days')::int = 1;
  assert (p->>'tasks_done')::int = 2;
  assert (p->>'focus_stage')::int = 2;
  assert (p->>'has_access')::boolean;
end $$;

-- Exportação LGPD traz os dados da Ana e só dela
do $$
declare e jsonb := public.export_my_data();
begin
  assert e->'profile'->>'display_name' = 'Ana';
  assert jsonb_array_length(e->'diagnostics') = 1;
  assert jsonb_array_length(e->'tasks') = 2;
  assert jsonb_array_length(e->'subscriptions') = 1;
end $$;

-- Bia não vê nada da Ana
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', false);
do $$ begin
  assert (select count(*) from public.diagnostic_results) = 0, 'FALHA: bia viu diagnostico da ana';
  assert (select count(*) from public.task_completions) = 0, 'FALHA: bia viu missoes da ana';
  assert (select count(*) from public.consents) = 0, 'FALHA: bia viu consentimentos da ana';
end $$;

-- Admin vê o resumo
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated","app_metadata":{"role":"admin"}}', false);
do $$ begin
  assert (public.admin_subscription_summary()->>'active')::int = 3, 'admin deveria ver 3 ativas';
end $$;
reset role;

-- ---------------------------------------------------------------------
-- Assinatura cancelada bloqueia; carência de 3 dias para inadimplência
-- ---------------------------------------------------------------------
set role service_role;
select public.apply_greenn_event(repeat('6',64), 'contract', 'canceled', 'contrato-ana', 'ana@exemplo.com', null, now() + interval '1 minute', '{}');
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', false);
do $$ begin
  perform public.mark_daily_offering();
  raise exception 'FALHA: assinatura cancelada ainda tem acesso';
exception when insufficient_privilege then null;
end $$;
reset role;

set role service_role;
select public.apply_greenn_event(repeat('7',64), 'contract', 'unpaid', 'contrato-bia', 'bia@exemplo.com', null, now() + interval '1 minute', '{}');
reset role;
do $$ begin
  assert private.has_active_access('00000000-0000-0000-0000-00000000000b'), 'inadimplente recente mantem carencia';
end $$;
update public.subscriptions set status_changed_at = now() - interval '4 days' where provider_ref = 'contrato-bia';
do $$ begin
  assert not private.has_active_access('00000000-0000-0000-0000-00000000000b'), 'carencia expirada bloqueia';
end $$;

-- ---------------------------------------------------------------------
-- Exclusão de conta: dados somem, assinatura fica anonimizada
-- ---------------------------------------------------------------------
set role service_role;
select public.prepare_account_deletion('00000000-0000-0000-0000-00000000000a');
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  assert (select count(*) from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 0;
  assert (select count(*) from public.diagnostic_results where user_id = '00000000-0000-0000-0000-00000000000a') = 0;
  assert (select count(*) from public.consents where user_id = '00000000-0000-0000-0000-00000000000a') = 0;
  assert (select count(*) from public.subscriptions where email like '%ana@%') = 0, 'email deve ser anonimizado';
  assert (select count(*) from public.subscriptions where provider_ref = 'contrato-ana' and user_id is null) = 1;
end $$;

-- Nenhuma tabela do schema public sem RLS
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

\echo 'OK: todos os testes de seguranca do banco passaram'
