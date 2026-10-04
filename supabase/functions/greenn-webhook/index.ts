/**
 * greenn-webhook — Recebe notificações de pagamento da Greenn
 *
 * Segurança:
 *   - Valida token secreto no header X-Greenn-Token
 *   - Idempotente: eventos já processados são ignorados
 *   - Aceita somente o produto configurado (GREENN_PRODUCT_ID)
 *   - CPF, endereço e telefone são descartados antes de salvar
 *   - Deploy: supabase functions deploy greenn-webhook --no-verify-jwt
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REQUIRED_PRODUCT_ID = Deno.env.get("GREENN_PRODUCT_ID") ?? "";
const WEBHOOK_TOKEN       = Deno.env.get("GREENN_WEBHOOK_TOKEN") ?? "";
const SUPABASE_URL        = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Status Greenn → status interno
const STATUS_MAP: Record<string, string> = {
  approved:    "active",
  trialing:    "trial",
  cancelled:   "cancelled",
  refunded:    "cancelled",
  chargeback:  "cancelled",
  expired:     "expired",
};

serve(async (req) => {
  // 1. Só aceita POST
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // 2. Valida token secreto
  const incomingToken = req.headers.get("x-greenn-token") ?? "";
  if (!WEBHOOK_TOKEN || incomingToken !== WEBHOOK_TOKEN) {
    console.error("[webhook] token inválido");
    return new Response("Unauthorized", { status: 401 });
  }

  // 3. Parse do body
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const eventId   = String(payload.id ?? "");
  const productId = String((payload.product as Record<string,unknown>)?.id ?? "");
  const status    = String(payload.status ?? "");
  const email     = String((payload.customer as Record<string,unknown>)?.email ?? "").toLowerCase().trim();
  const name      = String((payload.customer as Record<string,unknown>)?.name ?? "").trim();
  const orderId   = String(payload.order_id ?? eventId);

  // 4. Valida produto
  if (REQUIRED_PRODUCT_ID && productId !== REQUIRED_PRODUCT_ID) {
    console.warn(`[webhook] produto ignorado: ${productId}`);
    return new Response("OK", { status: 200 }); // Retorna 200 para a Greenn não retentar
  }

  // 5. Valida dados mínimos
  if (!email || !orderId || !status) {
    console.error("[webhook] payload incompleto", { email: !!email, orderId: !!orderId, status });
    return new Response("Bad Request", { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // 6. Idempotência: já processou este evento?
  const { data: existing } = await supabase
    .from("private.processed_events")
    .select("event_id")
    .eq("event_id", eventId)
    .single();

  if (existing) {
    console.info(`[webhook] evento ${eventId} já processado`);
    return new Response("OK", { status: 200 });
  }

  // 7. Mapeia status
  const internalStatus = STATUS_MAP[status];
  if (!internalStatus) {
    console.warn(`[webhook] status desconhecido: ${status}`);
    return new Response("OK", { status: 200 });
  }

  // 8. Fluxo principal
  try {
    // 8a. Busca ou cria usuário na auth
    let userId: string;

    const { data: existingUser } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single();

    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Cria usuário sem senha (magic link)
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email,
        email_confirm: false,
        user_metadata: { full_name: name },
      });
      if (createErr || !newUser.user) throw createErr ?? new Error("Falha ao criar usuário");

      userId = newUser.user.id;

      // Cria perfil (dados mínimos — sem CPF, endereço, telefone)
      await supabase.from("profiles").insert({ id: userId, full_name: name, email });

      // Gera convite por e-mail
      const { error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${Deno.env.get("SITE_URL") ?? ""}/boas-vindas`,
      });
      if (inviteErr) console.error("[webhook] erro ao enviar convite:", inviteErr.message);
    }

    // 8b. Upsert assinatura
    const trialEndsAt =
      internalStatus === "trial"
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : null;

    await supabase.from("subscriptions").upsert(
      {
        user_id:            userId,
        greenn_order_id:    orderId,
        greenn_product_id:  productId,
        status:             internalStatus,
        trial_ends_at:      trialEndsAt,
        current_period_end: trialEndsAt,
      },
      { onConflict: "greenn_order_id" }
    );

    // 8c. Marca evento como processado
    await supabase
      .from("private.processed_events")
      .insert({ event_id: eventId });

    console.info(`[webhook] ok — user=${userId} status=${internalStatus}`);
    return new Response("OK", { status: 200 });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[webhook] erro:", msg);
    // Retorna 500 para a Greenn retentar
    return new Response("Internal Server Error", { status: 500 });
  }
});
