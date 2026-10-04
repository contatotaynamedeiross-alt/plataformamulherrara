// Exclusão de conta pela própria titular (LGPD art. 18, VI).
// Fluxo: valida o login → anonimiza assinatura → apaga o usuário (cascata apaga o resto).
// Corpo exigido: {"confirm": "EXCLUIR"} para evitar exclusão acidental.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { corsHeaders, env, json, log, readLimited } from "../_shared/http.ts";

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "metodo_nao_permitido" }, cors);

  const authHeader = req.headers.get("authorization") ?? "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return json(401, { error: "nao_autenticada" }, cors);

  const raw = await readLimited(req, 1024);
  let confirm = "";
  try {
    confirm = raw ? String(JSON.parse(raw)?.confirm ?? "") : "";
  } catch { /* corpo inválido = sem confirmação */ }
  if (confirm !== "EXCLUIR") return json(400, { error: "confirmacao_necessaria" }, cors);

  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  const user = userData?.user;
  if (userError || !user) return json(401, { error: "nao_autenticada" }, cors);

  const { error: prepError } = await admin.rpc("prepare_account_deletion", { p_user: user.id });
  if (prepError) {
    log("account_delete.prepare_error", { code: prepError.code });
    return json(500, { error: "erro_interno" }, cors);
  }

  const { error: delError } = await admin.auth.admin.deleteUser(user.id);
  if (delError) {
    log("account_delete.delete_error", { status: delError.status });
    return json(500, { error: "erro_interno" }, cors);
  }

  log("account_delete.done");
  return json(200, {
    ok: true,
    aviso: "Seus dados foram excluídos. Se a assinatura ainda estiver ativa, cancele também na Greenn.",
  }, cors);
});
