// Lógica pura da integração Asaas: sem rede, sem banco, testável no Node e no Deno.
// Documentação: https://docs.asaas.com/reference/webhook

export type AsaasEventType =
  | "PAYMENT_CONFIRMED"
  | "PAYMENT_RECEIVED"
  | "PAYMENT_REFUNDED"
  | "PAYMENT_CHARGEBACK_REQUESTED"
  | "PAYMENT_DELETED"
  | "PAYMENT_OVERDUE"
  | "SUBSCRIPTION_INACTIVATED"
  | "SUBSCRIPTION_DELETED";

export interface ParsedAsaasEvent {
  eventType: AsaasEventType;
  providerStatus: string;
  providerRef: string;
  email: string;
  subscriptionId: string | null;
  periodEnd: string | null;
  providerUpdatedAt: string | null;
}

const KNOWN_EVENTS = new Set<string>([
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
  "PAYMENT_REFUNDED",
  "PAYMENT_CHARGEBACK_REQUESTED",
  "PAYMENT_DELETED",
  "PAYMENT_OVERDUE",
  "SUBSCRIPTION_INACTIVATED",
  "SUBSCRIPTION_DELETED",
]);

const MAX_EMAIL = 254;

function str(v: unknown, max = 200): string | null {
  if (typeof v === "string") return v.trim().slice(0, max) || null;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

// Asaas envia datas como "YYYY-MM-DD" ou ISO.
export function toIso(v: unknown): string | null {
  const s = str(v, 40);
  if (!s) return null;
  // Date-only: "YYYY-MM-DD" → treat as midnight UTC
  const dateOnly = s.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (dateOnly) {
    const d = new Date(s + "T00:00:00Z");
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/);
  const candidate = m ? `${m[1]}T${m[2]}Z` : s;
  const d = new Date(candidate);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function addDays(iso: string | null, days: number): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

/** Extrai só o que o sistema precisa. Retorna null se o payload não serve. */
export function parseAsaasPayload(body: unknown): ParsedAsaasEvent | null {
  const b = obj(body);
  const eventRaw = str(b.event, 60);
  if (!eventRaw || !KNOWN_EVENTS.has(eventRaw)) return null;
  const eventType = eventRaw as AsaasEventType;

  const isSubscriptionEvent =
    eventType === "SUBSCRIPTION_INACTIVATED" || eventType === "SUBSCRIPTION_DELETED";

  if (isSubscriptionEvent) {
    const sub = obj(b.subscription);
    const ref = str(sub.id, 64);
    if (!ref) return null;

    // For subscription events, email comes from subscription.customer (object) or customerEmail
    const email =
      str(sub.customerEmail, MAX_EMAIL)?.toLowerCase() ??
      str(obj(sub.customer).email, MAX_EMAIL)?.toLowerCase() ??
      null;
    if (!email) return null;

    const periodEnd = addDays(toIso(sub.nextDueDate), 7);
    return {
      eventType,
      providerStatus: str(sub.status, 40) ?? eventType,
      providerRef: `subscription:${ref}`,
      email,
      subscriptionId: ref,
      periodEnd,
      providerUpdatedAt: toIso(sub.dateUpdated) ?? toIso(sub.dateCreated),
    };
  }

  // Payment events
  const payment = obj(b.payment);
  const ref = str(payment.id, 64);
  if (!ref) return null;

  // Email: try payment.customerEmail first, then customer.email if embedded
  const email =
    str(payment.customerEmail, MAX_EMAIL)?.toLowerCase() ??
    str(obj(payment.customer).email, MAX_EMAIL)?.toLowerCase() ??
    null;
  if (!email) return null;

  const subscriptionId = str(payment.subscription, 64);
  const dueDateIso = toIso(payment.dueDate);
  const confirmedDateIso = toIso(payment.confirmedDate);

  // Status mapping to internal
  let periodEnd: string | null;
  if (
    eventType === "PAYMENT_CONFIRMED" ||
    eventType === "PAYMENT_RECEIVED"
  ) {
    // Grace period: dueDate + 7 days
    periodEnd = addDays(dueDateIso, 7);
  } else {
    periodEnd = dueDateIso;
  }

  const providerUpdatedAt = confirmedDateIso ?? dueDateIso;

  return {
    eventType,
    providerStatus: str(payment.status, 40) ?? eventType,
    providerRef: `payment:${ref}`,
    email,
    subscriptionId,
    periodEnd,
    providerUpdatedAt,
  };
}

/**
 * Mapeamento de evento Asaas → status interno.
 */
export function mapStatus(eventType: AsaasEventType): "active" | "cancelled" | "past_due" | null {
  switch (eventType) {
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED":
      return "active";
    case "PAYMENT_REFUNDED":
    case "PAYMENT_CHARGEBACK_REQUESTED":
    case "PAYMENT_DELETED":
    case "SUBSCRIPTION_INACTIVATED":
    case "SUBSCRIPTION_DELETED":
      return "cancelled";
    case "PAYMENT_OVERDUE":
      return "past_due";
    default:
      return null;
  }
}

/**
 * Cópia mínima para auditoria (LGPD art. 6º, III — necessidade).
 * Remove cpfCnpj e endereço se presentes; nunca guarda dados pessoais.
 */
export function redactAsaasPayload(body: unknown): Record<string, unknown> {
  const b = obj(body);
  const payment = obj(b.payment);
  const subscription = obj(b.subscription);

  // Strip sensitive customer fields from payment
  const { cpfCnpj: _pc, address: _pa, email: _pe, name: _pn, phone: _ph, mobilePhone: _pm, ...safeCustomer } =
    obj(payment.customer) as Record<string, unknown>;

  const safePayment = Object.keys(payment).length
    ? {
        id: str(payment.id, 64),
        status: str(payment.status, 40),
        dueDate: str(payment.dueDate, 20),
        confirmedDate: str(payment.confirmedDate, 20),
        value: payment.value ?? null,
        billingType: str(payment.billingType, 30),
        subscription: str(payment.subscription, 64),
        customer: Object.keys(safeCustomer).length ? { id: str(safeCustomer.id, 64) } : undefined,
      }
    : undefined;

  const { cpfCnpj: _sc, address: _sa, email: _se, name: _sn, ...safeSub } =
    subscription as Record<string, unknown>;

  const safeSub2 = Object.keys(subscription).length
    ? {
        id: str(subscription.id, 64),
        status: str(subscription.status, 40),
        nextDueDate: str(subscription.nextDueDate, 20),
        customer: typeof safeSub.customer === "string" ? safeSub.customer : undefined,
      }
    : undefined;

  return {
    event: str(b.event, 60),
    payment: safePayment,
    subscription: safeSub2,
  };
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Chave derivada de providerRef + eventType para idempotência. */
export function idempotencyKey(e: ParsedAsaasEvent): Promise<string> {
  return sha256Hex([e.providerRef, e.eventType].join("|"));
}

/** Comparação em tempo constante (evita descobrir o token por medição de tempo). */
export function timingSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  const len = Math.max(ea.length, eb.length);
  for (let i = 0; i < len; i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}
