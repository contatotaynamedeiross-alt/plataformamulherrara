// Lógica pura da integração Greenn: sem rede, sem banco, testável no Node e no Deno.
// Documentação da Greenn: https://ajuda.greenn.com.br/pt-br/article/documentacao-webhook-greenn-cbbxsl/

export type GreennEventType = "contract" | "sale";

export interface ParsedGreennEvent {
  eventType: GreennEventType;
  providerStatus: string;
  providerRef: string;
  email: string;
  productId: string | null;
  periodEnd: string | null;
  providerUpdatedAt: string | null;
}

const MAX_EMAIL = 254;

function str(v: unknown, max = 200): string | null {
  if (typeof v === "string") return v.trim().slice(0, max) || null;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

// A Greenn envia datas como "AAAA-MM-DD HH:MM:SS" (horário de Brasília) ou ISO.
export function toIso(v: unknown): string | null {
  const s = str(v, 40);
  if (!s) return null;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/);
  const candidate = m ? `${m[1]}T${m[2]}-03:00` : s;
  const d = new Date(candidate);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Extrai só o que o sistema precisa. Retorna null se o payload não serve. */
export function parseGreennPayload(body: unknown): ParsedGreennEvent | null {
  const b = obj(body);
  const type = str(b.type, 20);
  if (type !== "contract" && type !== "sale") return null;

  const status = str(b.currentStatus, 40);
  const client = obj(b.client);
  const email = str(client.email, MAX_EMAIL)?.toLowerCase() ?? null;
  const product = obj(b.product);

  let ref: string | null;
  let updatedAt: string | null;
  let periodEnd: string | null = null;
  if (type === "contract") {
    const contract = obj(b.contract);
    ref = str(contract.id, 64);
    updatedAt = toIso(contract.updated_at) ?? toIso(obj(b.currentSale).updated_at);
    periodEnd = toIso(contract.current_period_end);
  } else {
    const sale = obj(b.sale);
    ref = str(sale.id, 64);
    updatedAt = toIso(sale.updated_at);
  }

  if (!status || !email || !ref) return null;
  return {
    eventType: type,
    providerStatus: status,
    providerRef: `${type}:${ref}`,
    email,
    productId: str(product.id, 64),
    periodEnd,
    providerUpdatedAt: updatedAt,
  };
}

/**
 * Cópia mínima para auditoria (LGPD art. 6º, III — necessidade).
 * Nunca guarda CPF, endereço, telefone, nome ou e-mail do cliente.
 */
export function redactGreennPayload(body: unknown): Record<string, unknown> {
  const b = obj(body);
  const product = obj(b.product);
  const contract = obj(b.contract);
  const sale = obj(b.sale ?? b.currentSale);
  return {
    type: str(b.type, 20),
    event: str(b.event, 40),
    oldStatus: str(b.oldStatus, 40),
    currentStatus: str(b.currentStatus, 40),
    product: { id: str(product.id, 64), name: str(product.name, 120) },
    contract: Object.keys(contract).length
      ? { id: str(contract.id, 64), status: str(contract.status, 40), current_period_end: str(contract.current_period_end, 40) }
      : undefined,
    sale: Object.keys(sale).length
      ? { id: str(sale.id, 64), status: str(sale.status, 40), method: str(sale.method, 30), amount: sale.amount ?? null }
      : undefined,
  };
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** A Greenn não envia id de evento; a chave é derivada do conteúdo que importa. */
export function idempotencyKey(e: ParsedGreennEvent): Promise<string> {
  return sha256Hex([e.providerRef, e.providerStatus, e.providerUpdatedAt ?? "", e.periodEnd ?? ""].join("|"));
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
