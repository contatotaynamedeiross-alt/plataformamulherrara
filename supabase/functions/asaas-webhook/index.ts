// Webhook da Asaas → atualiza assinantes da Rara IA.
//
// Segurança:
//  - Header "asaas-access-token" comparado em tempo constante;
//  - corpo limitado a 64 KB; só POST com JSON;
//  - idempotência via webhook_log (chave SHA-256 de providerRef+eventType);
//  - externalReference é o user_id do Supabase — não aceita e-mail como identificador;
//  - nenhum CPF/endereço/nome é salvo; e-mail nunca entra em log.
// Deploy: supabase functions deploy asaas-webhook --no-verify-jwt
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import {
  idempotencyKey,
  mapPlano,
  mapStatusAssinante,
  parseAsaasPayload,
  redactAsaasPayload,
  timingSafeEqual,
} from "../_shared/asaas.ts";
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

  const novoStatus = mapStatusAssinante(event.eventType);
  if (!novoStatus) {
    log("asaas.ignored_status", { event: event.eventType });
    return json(200, { ok: true, outcome: "ignorado" });
  }

  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const ikey = await idempotencyKey(event);
  const payload = redactAsaasPayload(body);

  // Idempotência: verifica se já processamos este evento
  const { data: existente } = await admin
    .from("webhook_log")
    .select("outcome")
    .eq("idempotency_key", ikey)
    .maybeSingle();

  if (existente) {
    log("asaas.duplicate", { ref: event.providerRef });
    return json(200, { ok: true, outcome: "duplicate" });
  }

  // Identifica a assinante pelo externalReference (user_id) ou falha
  const userId = event.externalReference;
  if (!userId) {
    log("asaas.no_external_reference", { ref: event.providerRef, event: event.eventType });
    await admin.from("webhook_log").insert({
      idempotency_key: ikey,
      event_type: event.eventType,
      user_id: null,
      provider_ref: event.providerRef,
      outcome: "ignored",
      payload_redacted: payload,
    });
    return json(200, { ok: true, outcome: "sem_referencia_externa" });
  }

  if (novoStatus === "ativo") {
    // Pagamento confirmado: upsert com data_fim = agora + 30 dias
    const dataFim = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const plano = mapPlano(event.billingCycle);

    const { error: upsertErr } = await admin.from("assinantes").upsert(
      {
        user_id: userId,
        status: "ativo",
        plano,
        data_fim: dataFim,
        asaas_subscription_id: event.subscriptionId ?? undefined,
      },
      { onConflict: "user_id" },
    );

    if (upsertErr) {
      log("asaas.upsert_error", { ref: event.providerRef, code: upsertErr.code });
      return json(500, { error: "erro_interno" });
    }
  } else {
    // Pagamento vencido ou cancelamento: atualiza só o status
    const { error: updateErr } = await admin
      .from("assinantes")
      .update({ status: novoStatus })
      .eq("user_id", userId);

    if (updateErr) {
      log("asaas.update_error", { ref: event.providerRef, code: updateErr.code });
      return json(500, { error: "erro_interno" });
    }
  }

  // Registra no log de auditoria
  const { error: logErr } = await admin.from("webhook_log").insert({
    idempotency_key: ikey,
    event_type: event.eventType,
    user_id: userId,
    provider_ref: event.providerRef,
    outcome: "applied",
    payload_redacted: payload,
  });

  if (logErr) {
    log("asaas.log_error", { ref: event.providerRef, code: logErr.code });
  }

  log("asaas.processed", { ref: event.providerRef, status: novoStatus, user: userId });
  return json(200, { ok: true, outcome: "applied", status: novoStatus });
});
