// Webhook da Asaas → assinatura da Rara IA.
//
// Segurança:
//  - Header "asaas-access-token" com token secreto longo, comparado em tempo constante;
//  - filtro opcional por ASAAS_SUBSCRIPTION_IDS (deixe em branco para aceitar todos);
//  - corpo limitado a 64 KB; só POST com JSON;
//  - idempotência e eventos fora de ordem tratados no banco;
//  - nada de CPF/endereço/nome é salvo; logs sem e-mail.
// Deploy: supabase functions deploy asaas-webhook --no-verify-jwt
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { idempotencyKey, parseAsaasPayload, redactAsaasPayload, timingSafeEqual } from "../_shared/asaas.ts";
import { env, json, log, readLimited } from "../_shared/http.ts";

const MAX_BODY = 64 * 1024;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "metodo_nao_permitido" });

  const token = req.headers.get("asaas-access-token") ?? "";
  const expected = env("ASAAS_WEBHOOK_TOKEN");
  if (expected.length < 32 || !timingSafeEqual(token, expected)) {
    log("asaas.unauthorized");
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

  const event = parseAsaasPayload(body);
  if (!event) {
    log("asaas.ignored_shape");
    return json(200, { ok: true, outcome: "ignorado" });
  }

  // Filtragem por subscription IDs (opcional — deixe ASAAS_SUBSCRIPTION_IDS vazio para aceitar todos)
  const allowedSubs = env("ASAAS_SUBSCRIPTION_IDS").split(",").map((s) => s.trim()).filter(Boolean);
  if (allowedSubs.length > 0 && (!event.subscriptionId || !allowedSubs.includes(event.subscriptionId))) {
    log("asaas.ignored_subscription", { subscription: event.subscriptionId });
    return json(200, { ok: true, outcome: "assinatura_ignorada" });
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
    p_payload_redacted: redactAsaasPayload(body),
  });

  if (error) {
    // 500 faz a Asaas reenviar; a idempotência garante que não duplica.
    log("asaas.db_error", { ref: event.providerRef, code: error.code });
    return json(500, { error: "erro_interno" });
  }

  if (data?.needs_invite) {
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(event.email, {
      redirectTo: env("APP_URL"),
    });
    if (inviteError) log("asaas.invite_error", { ref: event.providerRef, status: inviteError.status });
  }

  log("asaas.processed", { ref: event.providerRef, outcome: data?.outcome, status: data?.status });
  return json(200, { ok: true, outcome: data?.outcome ?? "desconhecido" });
});
