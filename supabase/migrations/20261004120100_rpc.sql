-- =====================================================================
-- Rara IA · Funções do servidor (RPC)
-- Todas: SECURITY DEFINER + search_path vazio + validação de quem chama.
-- A usuária nunca escreve direto em tabelas de jornada, pontos ou assinatura.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Diagnóstico Raro: o servidor valida, calcula e grava.
-- Exige assinatura ativa e consentimento de dados sensíveis (a pergunta
-- sobre fé revela convicção religiosa: LGPD art. 5º, II e art. 11).
-- ---------------------------------------------------------------------
create or replace function public.submit_diagnostic(p_answers smallint[])
returns public.diagnostic_results
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user      uuid := auth.uid();
  v_consent   bigint;
  v_scores    smallint[] := '{}';
  v_focus     smallint;
  v_strength  smallint;
  v_max       smallint := -1;
  v_score     smallint;
  v_row       public.diagnostic_results;
  i           int;
begin
  if v_user is null then
    raise exception 'nao_autenticada' using errcode = '28000';
  end if;
  if not private.has_active_access(v_user) then
    raise exception 'assinatura_inativa' using errcode = '42501';
  end if;
  if p_answers is null or cardinality(p_answers) <> 12
     or not (1 <= all (p_answers) and 5 >= all (p_answers)) then
    raise exception 'respostas_invalidas' using errcode = '22023';
  end if;

  select c.id into v_consent
    from public.consents c
   where c.user_id = v_user and c.purpose = 'dados_sensiveis'
   order by c.created_at desc, c.id desc
   limit 1;
  if v_consent is null or not private.has_consent(v_user, 'dados_sensiveis') then
    raise exception 'consentimento_necessario' using errcode = '42501';
  end if;

  -- Limite simples contra abuso: 10 diagnósticos por dia.
  if (select count(*) from public.diagnostic_results d
       where d.user_id = v_user and d.created_at > now() - interval '1 day') >= 10 then
    raise exception 'limite_diario' using errcode = '54000';
  end if;

  -- Nota da etapa i (1..6) = (resposta_a + resposta_b - 2) / 8 * 100
  for i in 1..6 loop
    v_score := round(((p_answers[i*2-1] + p_answers[i*2] - 2)::numeric / 8) * 100);
    v_scores := v_scores || v_score;
    if v_focus is null and v_score < 70 then
      v_focus := i;           -- primeira etapa abaixo de 70, na ordem do método
    end if;
    if v_score > v_max then
      v_max := v_score;
      v_strength := i;        -- maior nota (empate: a primeira na ordem)
    end if;
  end loop;

  if v_focus is null then
    -- todas acima de 70: foca na menor (empate: a primeira)
    select s.idx into v_focus
      from unnest(v_scores) with ordinality as s(val, idx)
     order by s.val asc, s.idx asc
     limit 1;
  end if;

  insert into public.diagnostic_results (user_id, answers, scores, focus_stage, strength_stage, consent_id)
  values (v_user, p_answers, v_scores, v_focus, v_strength, v_consent)
  returning * into v_row;

  update public.profiles set onboarding_completed_at = coalesce(onboarding_completed_at, now())
   where id = v_user;

  perform private.audit('diagnostic.submitted', v_row.id::text, '{}'::jsonb);
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------
-- Missões: marcar/desmarcar uma tarefa do plano atual.
-- ---------------------------------------------------------------------
create or replace function public.set_task_completion(p_task_id text, p_done boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := auth.uid();
  v_diag  public.diagnostic_results;
begin
  if v_user is null then
    raise exception 'nao_autenticada' using errcode = '28000';
  end if;
  if not private.has_active_access(v_user) then
    raise exception 'assinatura_inativa' using errcode = '42501';
  end if;

  select * into v_diag from public.diagnostic_results d
   where d.user_id = v_user order by d.created_at desc limit 1;
  if v_diag.id is null then
    raise exception 'sem_diagnostico' using errcode = '22023';
  end if;

  if not exists (select 1 from public.plan_tasks t
                  where t.id = p_task_id and t.stage_id = v_diag.focus_stage) then
    raise exception 'tarefa_fora_do_plano' using errcode = '22023';
  end if;

  if p_done then
    insert into public.task_completions (user_id, diagnostic_id, task_id)
    values (v_user, v_diag.id, p_task_id)
    on conflict do nothing;
  else
    delete from public.task_completions
     where user_id = v_user and diagnostic_id = v_diag.id and task_id = p_task_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Entrega do dia (uma vez por dia, no fuso de Brasília)
-- ---------------------------------------------------------------------
create or replace function public.mark_daily_offering()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'nao_autenticada' using errcode = '28000';
  end if;
  if not private.has_active_access(v_user) then
    raise exception 'assinatura_inativa' using errcode = '42501';
  end if;
  insert into public.daily_offering_log (user_id, day)
  values (v_user, private.today_br())
  on conflict do nothing;
end;
$$;

-- ---------------------------------------------------------------------
-- Progresso: pontos, título, sequência e plano atual (calculado aqui,
-- nunca guardado num campo que a usuária pudesse alterar).
-- ---------------------------------------------------------------------
create or replace function public.get_my_progress()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user       uuid := auth.uid();
  v_points     int;
  v_level      text;
  v_next_name  text;
  v_next_min   int;
  v_streak     int := 0;
  v_day        date;
  v_diag       public.diagnostic_results;
  v_done       int := 0;
begin
  if v_user is null then
    raise exception 'nao_autenticada' using errcode = '28000';
  end if;

  select coalesce(sum(t.points), 0) into v_points
    from public.task_completions c join public.plan_tasks t on t.id = c.task_id
   where c.user_id = v_user;
  v_points := v_points + 5 * (select count(*) from public.daily_offering_log o where o.user_id = v_user);

  select l.name into v_level from public.levels l where l.min_points <= v_points order by l.min_points desc limit 1;
  select l.name, l.min_points into v_next_name, v_next_min
    from public.levels l where l.min_points > v_points order by l.min_points asc limit 1;

  -- Sequência: dias seguidos com entrega, terminando hoje (ou ontem, se hoje ainda não entregou).
  v_day := private.today_br();
  if not exists (select 1 from public.daily_offering_log o where o.user_id = v_user and o.day = v_day) then
    v_day := v_day - 1;
  end if;
  while exists (select 1 from public.daily_offering_log o where o.user_id = v_user and o.day = v_day) loop
    v_streak := v_streak + 1;
    v_day := v_day - 1;
  end loop;

  select * into v_diag from public.diagnostic_results d
   where d.user_id = v_user order by d.created_at desc limit 1;
  if v_diag.id is not null then
    select count(*) into v_done from public.task_completions c
     where c.user_id = v_user and c.diagnostic_id = v_diag.id;
  end if;

  return jsonb_build_object(
    'has_access',        private.has_active_access(v_user),
    'points',            v_points,
    'level',             v_level,
    'next_level',        v_next_name,
    'points_to_next',    case when v_next_min is null then 0 else v_next_min - v_points end,
    'streak_days',       v_streak,
    'offered_today',     exists (select 1 from public.daily_offering_log o
                                  where o.user_id = v_user and o.day = private.today_br()),
    'diagnostic_id',     v_diag.id,
    'focus_stage',       v_diag.focus_stage,
    'strength_stage',    v_diag.strength_stage,
    'scores',            to_jsonb(v_diag.scores),
    'tasks_done',        v_done,
    'tasks_total',       case when v_diag.id is null then 0 else 12 end
  );
end;
$$;

-- ---------------------------------------------------------------------
-- LGPD art. 18: portabilidade — exporta todos os dados da titular.
-- ---------------------------------------------------------------------
create or replace function public.export_my_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'nao_autenticada' using errcode = '28000';
  end if;
  perform private.audit('account.exported', v_user::text, '{}'::jsonb);
  return jsonb_build_object(
    'exported_at',   now(),
    'profile',       (select to_jsonb(p) from public.profiles p where p.id = v_user),
    'consents',      coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.consents c where c.user_id = v_user), '[]'::jsonb),
    'subscriptions', coalesce((select jsonb_agg(jsonb_build_object('status', s.status, 'provider', s.provider,
                                     'current_period_end', s.current_period_end, 'created_at', s.created_at))
                               from public.subscriptions s where s.user_id = v_user), '[]'::jsonb),
    'diagnostics',   coalesce((select jsonb_agg(jsonb_build_object('created_at', d.created_at, 'answers', d.answers,
                                     'scores', d.scores, 'focus_stage', d.focus_stage, 'strength_stage', d.strength_stage)
                                     order by d.created_at)
                               from public.diagnostic_results d where d.user_id = v_user), '[]'::jsonb),
    'tasks',         coalesce((select jsonb_agg(jsonb_build_object('task_id', c.task_id, 'completed_at', c.completed_at))
                               from public.task_completions c where c.user_id = v_user), '[]'::jsonb),
    'daily_offerings', coalesce((select jsonb_agg(o.day order by o.day) from public.daily_offering_log o
                                 where o.user_id = v_user), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Webhook Greenn (chamado SÓ pela edge function, com service_role).
-- Idempotente, ignora eventos fora de ordem e status irrelevantes.
-- Retorna se é preciso enviar convite por e-mail.
-- ---------------------------------------------------------------------
create or replace function public.apply_greenn_event(
  p_idempotency_key      text,
  p_event_type           text,     -- 'contract' | 'sale'
  p_provider_status      text,     -- currentStatus da Greenn
  p_provider_ref         text,     -- id do contrato (ou da venda)
  p_email                text,
  p_period_end           timestamptz,
  p_provider_updated_at  timestamptz,
  p_payload_redacted     jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status   text;
  v_email    text := lower(trim(p_email));
  v_existing public.subscriptions;
  v_user     uuid;
  v_event_id bigint;
begin
  if p_idempotency_key is null or char_length(p_idempotency_key) <> 64 then
    raise exception 'chave_invalida' using errcode = '22023';
  end if;

  insert into private.provider_events (provider, idempotency_key, event_type, provider_status, payload_redacted)
  values ('greenn', p_idempotency_key, coalesce(p_event_type, 'desconhecido'), p_provider_status,
          coalesce(p_payload_redacted, '{}'::jsonb))
  on conflict (idempotency_key) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return jsonb_build_object('outcome', 'duplicate', 'needs_invite', false);
  end if;

  v_status := case
    when p_event_type = 'contract' then case p_provider_status
      when 'paid'            then 'active'
      when 'trialing'        then 'trialing'
      when 'pending_payment' then 'past_due'
      when 'unpaid'          then 'past_due'
      when 'canceled'        then 'canceled'
      else null end
    when p_event_type = 'sale' then case p_provider_status
      when 'paid'        then 'active'
      when 'refunded'    then 'refunded'
      when 'chargedback' then 'chargedback'
      else null end
    else null end;

  if v_status is null or v_email is null or v_email = '' or p_provider_ref is null then
    update private.provider_events set outcome = 'ignored_status' where id = v_event_id;
    return jsonb_build_object('outcome', 'ignored_status', 'needs_invite', false);
  end if;
  if char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    update private.provider_events set outcome = 'error' where id = v_event_id;
    raise exception 'email_invalido' using errcode = '22023';
  end if;

  select * into v_existing from public.subscriptions s
   where s.provider = 'greenn' and s.provider_ref = p_provider_ref
   for update;

  -- Evento mais antigo que o último aplicado: registra e ignora.
  if v_existing.id is not null and v_existing.provider_updated_at is not null
     and p_provider_updated_at is not null and p_provider_updated_at < v_existing.provider_updated_at then
    update private.provider_events set outcome = 'ignored_stale' where id = v_event_id;
    return jsonb_build_object('outcome', 'ignored_stale', 'needs_invite', false);
  end if;

  select u.id into v_user from auth.users u where lower(u.email) = v_email limit 1;

  insert into public.subscriptions (user_id, email, provider, provider_ref, status, current_period_end, provider_updated_at)
  values (v_user, v_email, 'greenn', p_provider_ref, v_status, p_period_end, p_provider_updated_at)
  on conflict (provider, provider_ref) do update
     set status              = excluded.status,
         current_period_end  = coalesce(excluded.current_period_end, public.subscriptions.current_period_end),
         provider_updated_at = coalesce(excluded.provider_updated_at, public.subscriptions.provider_updated_at),
         user_id             = coalesce(public.subscriptions.user_id, excluded.user_id),
         email               = excluded.email;

  update private.provider_events set outcome = 'applied' where id = v_event_id;
  insert into private.audit_log (actor, action, subject, meta)
  values (null, 'subscription.' || v_status, p_provider_ref, jsonb_build_object('email_hash', private.hash_text(v_email)));

  return jsonb_build_object(
    'outcome', 'applied',
    'status', v_status,
    'needs_invite', v_user is null and v_status in ('active','trialing')
  );
end;
$$;

-- ---------------------------------------------------------------------
-- LGPD art. 18, VI: exclusão. Chamada pela edge function account-delete
-- (service_role) ANTES de apagar o usuário do auth.
-- Assinaturas ficam anonimizadas (obrigação fiscal/contábil, art. 16, I).
-- ---------------------------------------------------------------------
create or replace function public.prepare_account_deletion(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.subscriptions
     set user_id = null,
         email   = 'removida+' || left(private.hash_text(email), 32) || '@anon.invalid'
   where user_id = p_user;
  insert into private.audit_log (actor, action, subject, meta)
  values (null, 'account.deleted', private.hash_text(p_user::text), '{}'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------
-- Admin (Sprint 3): visão de assinantes. Só app_metadata.role = 'admin'.
-- ---------------------------------------------------------------------
create or replace function public.admin_subscription_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;
  return coalesce((select jsonb_object_agg(status, total)
                     from (select s.status, count(*) as total from public.subscriptions s group by s.status) x),
                  '{}'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------
-- Retenção: eventos do provedor são apagados após 180 dias.
-- Agendar no Supabase com pg_cron (ver docs/LGPD.md).
-- ---------------------------------------------------------------------
create or replace function private.purge_old_events()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.provider_events where received_at < now() - interval '180 days';
  delete from private.audit_log where created_at < now() - interval '5 years';
$$;

-- ---------------------------------------------------------------------
-- Permissões de execução: nada para anon; o mínimo para cada papel.
-- ---------------------------------------------------------------------
revoke all on function public.submit_diagnostic(smallint[])    from public, anon;
revoke all on function public.set_task_completion(text, boolean) from public, anon;
revoke all on function public.mark_daily_offering()             from public, anon;
revoke all on function public.get_my_progress()                 from public, anon;
revoke all on function public.export_my_data()                  from public, anon;
revoke all on function public.admin_subscription_summary()      from public, anon;
revoke all on function public.apply_greenn_event(text, text, text, text, text, timestamptz, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.prepare_account_deletion(uuid)    from public, anon, authenticated;
revoke all on function private.purge_old_events()               from public, anon, authenticated;

grant execute on function public.submit_diagnostic(smallint[])      to authenticated;
grant execute on function public.set_task_completion(text, boolean) to authenticated;
grant execute on function public.mark_daily_offering()              to authenticated;
grant execute on function public.get_my_progress()                  to authenticated;
grant execute on function public.export_my_data()                   to authenticated;
grant execute on function public.admin_subscription_summary()       to authenticated;
grant execute on function public.apply_greenn_event(text, text, text, text, text, timestamptz, timestamptz, jsonb) to service_role;
grant execute on function public.prepare_account_deletion(uuid)     to service_role;
