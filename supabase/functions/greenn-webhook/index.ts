// Webhook da Greenn → assinatura da Rara IA.
//
// Segurança (a Greenn não assina os webhooks):
//  - URL com token secreto longo (?token=...), comparado em tempo constante;
//  - só produtos da lista GREENN_PRODUCT_IDS liberam acesso;
//  - corpo limitado a 64 KB; só POST com JSON;
//  - idempotência e eventos fora de ordem tratados no banco;
//  - nada de CPF/endereço/telefone é salvo; logs sem e-mail.
// Deploy: supabase functions deploy greenn-webhook --no-verify-jwt
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { idempotencyKey, parseGreennPayload, redactGreennPayload, timingSafeEqual } from "../_shared/greenn.ts";
import { env, json, log, readLimited } from "../_shared/http.ts";

const MAX_BODY = 64 * 1024;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "metodo_nao_permitido" });

  const token = new URL(req.url).searchParams.get("token") ?? "";
  const expected = env("GREENN_WEBHOOK_TOKEN");
  if (expected.length < 32 || !timingSafeEqual(token, expected)) {
    log("greenn.unauthorized");
    return json(401, { error: "nao_autorizado" });
  }

  const raw = await readLimited(req, MAX_BODY);
  if (raw === null) return json(413, { error: "payload_grande_demais" });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: "json_invalido" });
  }

  const event = parseGreennPayload(body);
  if (!event) {
    log("greenn.ignored_shape");
    return json(200, { ok: true, outcome: "ignorado" });
  }

  const allowedProducts = env("GREENN_PRODUCT_IDS").split(",").map((s) => s.trim()).filter(Boolean);
  if (!event.productId || !allowedProducts.includes(event.productId)) {
    log("greenn.ignored_product", { product: event.productId });
    return json(200, { ok: true, outcome: "produto_ignorado" });
  }

  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.rpc("apply_greenn_event", {
    p_idempotency_key: await idempotencyKey(event),
    p_event_type: event.eventType,
    p_provider_status: event.providerStatus,
    p_provider_ref: event.providerRef,
    p_email: event.email,
    p_period_end: event.periodEnd,
    p_provider_updated_at: event.providerUpdatedAt,
    p_payload_redacted: redactGreennPayload(body),
  });

  if (error) {
    // 500 faz a Greenn reenviar; a idempotência garante que não duplica.
    log("greenn.db_error", { ref: event.providerRef, code: error.code });
    return json(500, { error: "erro_interno" });
  }

  if (data?.needs_invite) {
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(event.email, {
      redirectTo: env("APP_URL"),
    });
    if (inviteError) log("greenn.invite_error", { ref: event.providerRef, status: inviteError.status });
  }

  log("greenn.processed", { ref: event.providerRef, outcome: data?.outcome, status: data?.status });
  return json(200, { ok: true, outcome: data?.outcome ?? "desconhecido" });
});
