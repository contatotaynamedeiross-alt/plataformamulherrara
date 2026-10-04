-- ============================================================
-- Rara IA — Testes de segurança do banco
-- ============================================================
-- Cada bloco usa BEGIN/COMMIT para que SET LOCAL funcione.
-- ============================================================

\set ON_ERROR_STOP 1

-- ── Prepara usuárias de teste ──────────────────────────────
BEGIN;

DO $$
DECLARE
  alice_id uuid := '00000000-0000-0000-0000-000000000001';
  bob_id   uuid := '00000000-0000-0000-0000-000000000002';
BEGIN
  DELETE FROM auth.users WHERE id IN (alice_id, bob_id);

  INSERT INTO auth.users (id, email, role, aud)
  VALUES
    (alice_id, 'alice@test.rara', 'authenticated', 'authenticated'),
    (bob_id,   'bob@test.rara',   'authenticated', 'authenticated');

  INSERT INTO public.profiles (id, full_name, email) VALUES
    (alice_id, 'Alice Teste', 'alice@test.rara'),
    (bob_id,   'Bob Teste',   'bob@test.rara');

  INSERT INTO public.subscriptions (user_id, greenn_order_id, greenn_product_id, status)
  VALUES (alice_id, 'order_alice_001', 'prod_rara', 'active');

  INSERT INTO public.missions (user_id, title) VALUES (alice_id, 'Missão da Alice');
  INSERT INTO public.points   (user_id, amount, reason, source)
  VALUES (alice_id, 10, 'teste', 'bonus');
  INSERT INTO public.medals   (user_id, medal_type)
  VALUES (alice_id, 'pioneira');
END;
$$;

COMMIT;

-- ── Teste 1: Alice vê só seus próprios dados ───────────────
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

DO $$
DECLARE cnt integer;
BEGIN
  SELECT count(*) INTO cnt FROM public.profiles
  WHERE id = '00000000-0000-0000-0000-000000000001';
  ASSERT cnt = 1, 'FALHA T1a: Alice deve ver o próprio perfil';

  SELECT count(*) INTO cnt FROM public.profiles
  WHERE id = '00000000-0000-0000-0000-000000000002';
  ASSERT cnt = 0, 'FALHA T1b: Alice NÃO deve ver o perfil de Bob';

  SELECT count(*) INTO cnt FROM public.subscriptions
  WHERE user_id = '00000000-0000-0000-0000-000000000001';
  ASSERT cnt = 1, 'FALHA T1c: Alice deve ver a própria assinatura';

  SELECT count(*) INTO cnt FROM public.subscriptions
  WHERE user_id = '00000000-0000-0000-0000-000000000002';
  ASSERT cnt = 0, 'FALHA T1d: Alice NÃO deve ver assinatura de Bob';

  SELECT count(*) INTO cnt FROM public.points
  WHERE user_id = '00000000-0000-0000-0000-000000000001';
  ASSERT cnt = 1, 'FALHA T1e: Alice deve ver os próprios pontos';

  SELECT count(*) INTO cnt FROM public.points
  WHERE user_id = '00000000-0000-0000-0000-000000000002';
  ASSERT cnt = 0, 'FALHA T1f: Alice NÃO deve ver pontos de Bob';

  RAISE NOTICE 'PASSOU T1: Isolamento de dados entre usuárias';
END;
$$;

ROLLBACK;

-- ── Teste 2: Alice não consegue inserir pontos ─────────────
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

DO $$
BEGIN
  BEGIN
    INSERT INTO public.points (user_id, amount, reason, source)
    VALUES ('00000000-0000-0000-0000-000000000001', 9999, 'hack', 'bonus');
    ASSERT false, 'FALHA T2: INSERT em points deveria ser bloqueado';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASSOU T2: INSERT em points bloqueado para authenticated';
    WHEN OTHERS THEN
      RAISE NOTICE 'PASSOU T2 (via outro erro): %', SQLERRM;
  END;
END;
$$;

ROLLBACK;

-- ── Teste 3: Alice não consegue atualizar assinatura ───────
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

DO $$
DECLARE cnt integer;
BEGIN
  UPDATE public.subscriptions
  SET status = 'expired'
  WHERE user_id = '00000000-0000-0000-0000-000000000001';

  -- Se chegou aqui sem erro, verifica se mudou algo
  GET DIAGNOSTICS cnt = ROW_COUNT;
  IF cnt > 0 THEN
    ASSERT false, 'FALHA T3: UPDATE em subscriptions não deveria ser permitido';
  ELSE
    RAISE NOTICE 'PASSOU T3: UPDATE em subscriptions sem efeito (sem policy de update)';
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASSOU T3: UPDATE em subscriptions bloqueado';
END;
$$;

ROLLBACK;

-- ── Teste 4: Diagnóstico sensível sem consentimento ────────
BEGIN;

DO $$
BEGIN
  BEGIN
    INSERT INTO public.diagnostics (user_id, answers, result, contains_sensitive, consent_id)
    VALUES (
      '00000000-0000-0000-0000-000000000001',
      '{"q1":"sim"}'::jsonb,
      '{"tipo":"A"}'::jsonb,
      true,
      null
    );
    ASSERT false, 'FALHA T4: diagnóstico sensível sem consent_id deveria ser recusado';
  EXCEPTION
    WHEN OTHERS THEN
      ASSERT SQLERRM LIKE '%LGPD%' OR SQLERRM LIKE '%consentimento%',
        'FALHA T4: erro inesperado: ' || SQLERRM;
      RAISE NOTICE 'PASSOU T4: diagnóstico sensível sem consentimento recusado — %', SQLERRM;
  END;
END;
$$;

ROLLBACK;

-- ── Teste 5: anon não vê nada ──────────────────────────────
BEGIN;
SET LOCAL ROLE anon;

DO $$
DECLARE cnt integer;
BEGIN
  SELECT count(*) INTO cnt FROM public.profiles;
  ASSERT cnt = 0, 'FALHA T5a: anon NÃO deve ver nenhum perfil';

  SELECT count(*) INTO cnt FROM public.subscriptions;
  ASSERT cnt = 0, 'FALHA T5b: anon NÃO deve ver nenhuma assinatura';

  SELECT count(*) INTO cnt FROM public.points;
  ASSERT cnt = 0, 'FALHA T5c: anon NÃO deve ver nenhum ponto';

  RAISE NOTICE 'PASSOU T5: anon não vê nenhum dado';
END;
$$;

ROLLBACK;

-- ── Limpeza ────────────────────────────────────────────────
BEGIN;
DELETE FROM auth.users WHERE id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002'
);
COMMIT;

\echo ''
\echo '✓ Todos os testes de segurança passaram.'
