import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { calcularResultado, type Resposta } from '../_shared/diagnostico.ts';

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

  let body: { respostas: Resposta[] };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  if (!Array.isArray(body?.respostas) || body.respostas.length === 0) {
    return new Response(JSON.stringify({ error: 'respostas_obrigatorias' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  let resultado;
  try {
    resultado = calcularResultado(body.respostas);
  } catch (e) {
    return new Response(JSON.stringify({ error: 'pontuacao_invalida', detail: String(e) }), {
      status: 422, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  // Admin client (service_role) para gravar — bypassa RLS
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Salva respostas individuais (upsert — idempotente)
  const linhasRespostas = body.respostas.map(r => ({
    user_id:     user.id,
    pergunta_id: r.pergunta_id,
    pontos:      r.pontos,
  }));
  const { error: errRespostas } = await admin
    .from('diagnostico_respostas')
    .upsert(linhasRespostas, { onConflict: 'user_id,pergunta_id' });
  if (errRespostas) {
    console.error('erro ao salvar respostas', errRespostas);
    return new Response(JSON.stringify({ error: 'db_error' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  // Salva resultado via RPC SECURITY DEFINER
  const { data: saved, error: errRpc } = await admin.rpc('salvar_diagnostico', {
    p_user_id:              user.id,
    p_pts_identidade:       resultado.pts_identidade,
    p_pts_posicionamento:   resultado.pts_posicionamento,
    p_pts_produto:          resultado.pts_produto,
    p_pts_marketing:        resultado.pts_marketing,
    p_pts_marca:            resultado.pts_marca,
  });
  if (errRpc) {
    console.error('erro ao salvar resultado', errRpc);
    return new Response(JSON.stringify({ error: 'db_error' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ...resultado, ...saved }), {
    status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
