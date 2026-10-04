/**
 * save-diagnostic — Salva diagnóstico da usuária
 *
 * Se o diagnóstico contém a pergunta de fé (dado sensível — LGPD art. 11),
 * exige que o consentimento já tenha sido registrado via RPC record_consent.
 *
 * Deploy: supabase functions deploy save-diagnostic  (JWT obrigatório)
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY      = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const SENSITIVE_PURPOSE = "diagnostic_sensitive_v1";
const SENSITIVE_VERSION = "1.0";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Cliente com JWT da usuária para validar identidade
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: { answers: Record<string, unknown>; result: Record<string, unknown>; contains_sensitive?: boolean };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const { answers, result, contains_sensitive = false } = body;
  if (!answers || !result) {
    return new Response("Bad Request: answers e result são obrigatórios", { status: 400 });
  }

  // Cliente service_role para escrita (usuária não tem INSERT em diagnostics)
  const svc = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  let consentId: string | null = null;

  if (contains_sensitive) {
    // Verifica se consentimento foi registrado
    const { data: consent } = await svc
      .from("consents")
      .select("id")
      .eq("user_id", user.id)
      .eq("purpose", SENSITIVE_PURPOSE)
      .eq("version", SENSITIVE_VERSION)
      .eq("accepted", true)
      .single();

    if (!consent) {
      return new Response(
        JSON.stringify({ error: "Consentimento para dado sensível não registrado." }),
        { status: 422, headers: { "content-type": "application/json" } }
      );
    }
    consentId = consent.id;
  }

  const { data, error } = await svc
    .from("diagnostics")
    .insert({
      user_id:           user.id,
      answers,
      result,
      contains_sensitive,
      consent_id:        consentId,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[save-diagnostic] erro:", error.message);
    return new Response("Internal Server Error", { status: 500 });
  }

  return new Response(JSON.stringify({ id: data.id }), {
    status: 201,
    headers: { "content-type": "application/json" },
  });
});
