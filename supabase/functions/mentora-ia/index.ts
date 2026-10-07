import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verificarAcesso, type RegistroAssinante } from '../_shared/acesso.ts';
import {
  getSystemPrompt,
  podeUsarMentora,
  usoRestante,
  validarInput,
  type RegistroUso,
} from '../_shared/mentora.ts';

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

  // Valida input antes de qualquer consulta ao banco
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

  const { mentora, mensagem } = body as { mentora: string; mensagem: string };

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Verifica acesso ativo (assinatura)
  const { data: assinante } = await admin
    .from('assinantes')
    .select('plano, status, data_fim')
    .eq('user_id', user.id)
    .single();

  const acesso = verificarAcesso(assinante as RegistroAssinante | null);
  if (!acesso.tem_acesso) {
    return new Response(JSON.stringify({ error: 'acesso_negado', motivo: 'assinatura_inativa' }), {
      status: 403, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  // Verifica limite diário
  const hoje = new Date().toISOString().slice(0, 10); // YYYY-MM-DD no UTC
  const { data: uso } = await admin
    .from('mentora_uso')
    .select('contagem')
    .eq('user_id', user.id)
    .eq('data', hoje)
    .single();

  if (!podeUsarMentora(uso as RegistroUso | null)) {
    return new Response(
      JSON.stringify({ error: 'limite_atingido', mensagens_restantes: 0 }),
      { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }

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
      messages: [
        { role: 'system', content: getSystemPrompt(mentora) },
        { role: 'user',   content: mensagem },
      ],
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

  // Registra uso (upsert atômico no Postgres)
  const { error: errUso } = await admin.rpc('incrementar_uso_mentora', {
    p_user_id: user.id,
    p_data:    hoje,
  });

  if (errUso) {
    console.error('erro ao registrar uso', errUso);
  }

  const restante = usoRestante(uso as RegistroUso | null) - 1;

  return new Response(
    JSON.stringify({ resposta, mensagens_restantes: Math.max(0, restante) }),
    { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
  );
});
