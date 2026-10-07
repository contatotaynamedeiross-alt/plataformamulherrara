import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getSystemPrompt, isPilar, validarInput } from '../_shared/jornada.ts';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map(s => s.trim()).filter(Boolean);

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : (ALLOWED_ORIGINS[0] ?? '*');
  return {
    'Access-Control-Allow-Origin':  allow,
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const cors   = corsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  // Identifica usuária pelo JWT (nunca aceita user_id no body)
  const jwt = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!jwt) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } },
  );

  const { data: { user }, error: authError } = await anonClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const erros = validarInput(body);
  if (erros.length > 0) {
    return new Response(JSON.stringify({ error: 'input_invalido', detalhes: erros }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const { sessao_id, mensagem } = body as { sessao_id: string; mensagem: string };

  // Admin client para operações que precisam bypassar RLS
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Busca sessão verificando que pertence à usuária autenticada
  const { data: sessao, error: errSessao } = await admin
    .from('jornada_sessoes')
    .select('id, pilar, status')
    .eq('id', sessao_id)
    .eq('user_id', user.id)
    .single();

  if (errSessao || !sessao) {
    return new Response(JSON.stringify({ error: 'sessao_nao_encontrada' }), {
      status: 404, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  if (!isPilar(sessao.pilar)) {
    return new Response(JSON.stringify({ error: 'pilar_invalido' }), {
      status: 422, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  // Histórico da sessão (últimas 10 mensagens)
  const { data: historico } = await admin
    .from('jornada_mensagens')
    .select('role, conteudo')
    .eq('sessao_id', sessao_id)
    .order('created_at', { ascending: true })
    .limit(10);

  const messages = [
    { role: 'system' as const,    content: getSystemPrompt(sessao.pilar) },
    ...(historico ?? []).map((m: { role: string; conteudo: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.conteudo,
    })),
    { role: 'user' as const, content: mensagem },
  ];

  // Chama a API via OpenRouter
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) {
    console.error('OPENROUTER_API_KEY não configurada');
    return new Response(JSON.stringify({ error: 'configuracao_incompleta' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer':  'https://app.raraia.com.br',
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model:      'meta-llama/llama-3.1-8b-instruct:free',
      max_tokens: 1024,
      messages,
    }),
  });

  if (!aiRes.ok) {
    const detail = await aiRes.text();
    console.error('erro openrouter', aiRes.status, detail);
    return new Response(JSON.stringify({ error: 'ai_error' }), {
      status: 502, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const aiData = await aiRes.json();
  const resposta: string = aiData.choices?.[0]?.message?.content ?? '';

  // Persiste mensagem da usuária e resposta do assistente
  const { error: errMsg } = await admin
    .from('jornada_mensagens')
    .insert([
      { sessao_id, role: 'user',      conteudo: mensagem },
      { sessao_id, role: 'assistant', conteudo: resposta },
    ]);

  if (errMsg) {
    console.error('erro ao salvar mensagens', errMsg);
  }

  // Atualiza timestamp da sessão
  await admin
    .from('jornada_sessoes')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', sessao_id);

  return new Response(JSON.stringify({ resposta, sessao_id }), {
    status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
