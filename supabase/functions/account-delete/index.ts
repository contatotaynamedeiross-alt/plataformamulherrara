/**
 * account-delete — Permite à usuária autenticada excluir a própria conta
 *
 * LGPD art. 18, VI: direito ao apagamento.
 * Chama a RPC delete_my_account() que remove dados em cascata.
 * Deploy: supabase functions deploy account-delete  (JWT obrigatório)
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY         = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

serve(async (req) => {
  if (req.method !== "DELETE" && req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { error } = await supabase.rpc("delete_my_account");
  if (error) {
    console.error("[account-delete] erro:", error.message);
    return new Response("Internal Server Error", { status: 500 });
  }

  return new Response(JSON.stringify({ deleted: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});
