// Roda com: node --experimental-strip-types --test tests/unit/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  idempotencyKey,
  mapStatus,
  parseAsaasPayload,
  redactAsaasPayload,
  timingSafeEqual,
  toIso,
} from "../../supabase/functions/_shared/asaas.ts";

const paymentConfirmed = {
  event: "PAYMENT_CONFIRMED",
  payment: {
    id: "pay_abc123",
    status: "CONFIRMED",
    dueDate: "2026-11-04",
    confirmedDate: "2026-10-04",
    value: 97.0,
    billingType: "PIX",
    subscription: "sub_xyz789",
    customerEmail: " Ana@Exemplo.com ",
    customer: { id: "cus_111", cpfCnpj: "123.456.789-00", address: { street: "Rua X" } },
  },
};

const subscriptionInactivated = {
  event: "SUBSCRIPTION_INACTIVATED",
  subscription: {
    id: "sub_xyz789",
    status: "INACTIVE",
    nextDueDate: "2026-11-04",
    customerEmail: "beatriz@exemplo.com",
    customer: "cus_222",
    dateUpdated: "2026-10-04T12:00:00Z",
  },
};

test("extrai campos necessarios de PAYMENT_CONFIRMED", () => {
  const e = parseAsaasPayload(paymentConfirmed);
  assert.ok(e);
  assert.equal(e.eventType, "PAYMENT_CONFIRMED");
  assert.equal(e.providerStatus, "CONFIRMED");
  assert.equal(e.providerRef, "payment:pay_abc123");
  assert.equal(e.email, "ana@exemplo.com");
  assert.equal(e.subscriptionId, "sub_xyz789");
  // periodEnd = dueDate (2026-11-04) + 7 days = 2026-11-11
  assert.ok(e.periodEnd?.startsWith("2026-11-11"), `periodEnd inesperado: ${e.periodEnd}`);
});

test("extrai campos necessarios de SUBSCRIPTION_INACTIVATED", () => {
  const e = parseAsaasPayload(subscriptionInactivated);
  assert.ok(e);
  assert.equal(e.eventType, "SUBSCRIPTION_INACTIVATED");
  assert.equal(e.providerRef, "subscription:sub_xyz789");
  assert.equal(e.email, "beatriz@exemplo.com");
  assert.equal(e.subscriptionId, "sub_xyz789");
  assert.ok(e.periodEnd?.startsWith("2026-11-11"), `periodEnd inesperado: ${e.periodEnd}`);
});

test("retorna null para evento desconhecido", () => {
  assert.equal(parseAsaasPayload({ event: "PAYMENT_PENDING", payment: paymentConfirmed.payment }), null);
  assert.equal(parseAsaasPayload({ event: "UNKNOWN_EVENT" }), null);
  assert.equal(parseAsaasPayload(null), null);
  assert.equal(parseAsaasPayload("texto"), null);
  assert.equal(parseAsaasPayload({}), null);
});

test("retorna null se email ausente", () => {
  const sem = structuredClone(paymentConfirmed) as Record<string, unknown>;
  (sem.payment as Record<string, unknown>).customerEmail = undefined;
  (sem.payment as Record<string, unknown>).customer = { id: "cus_x" }; // sem email
  assert.equal(parseAsaasPayload(sem), null);
});

test("redact remove cpfCnpj e address do customer", () => {
  const r = JSON.stringify(redactAsaasPayload(paymentConfirmed));
  assert.ok(!r.includes("123.456.789-00"), "cpfCnpj vazou");
  assert.ok(!r.includes("Rua X"), "address vazou");
  assert.ok(!r.includes("Ana@Exemplo"), "email vazou");
  assert.ok(r.includes("pay_abc123"), "id do pagamento sumiu");
  assert.ok(r.includes("PAYMENT_CONFIRMED"), "event sumiu");
});

test("mapStatus retorna o status interno correto", () => {
  assert.equal(mapStatus("PAYMENT_CONFIRMED"), "active");
  assert.equal(mapStatus("PAYMENT_RECEIVED"), "active");
  assert.equal(mapStatus("PAYMENT_REFUNDED"), "cancelled");
  assert.equal(mapStatus("PAYMENT_CHARGEBACK_REQUESTED"), "cancelled");
  assert.equal(mapStatus("PAYMENT_DELETED"), "cancelled");
  assert.equal(mapStatus("SUBSCRIPTION_INACTIVATED"), "cancelled");
  assert.equal(mapStatus("SUBSCRIPTION_DELETED"), "cancelled");
  assert.equal(mapStatus("PAYMENT_OVERDUE"), "past_due");
});

test("chave de idempotencia e estavel e muda com o evento", async () => {
  const e = parseAsaasPayload(paymentConfirmed)!;
  const k1 = await idempotencyKey(e);
  const k2 = await idempotencyKey({ ...e });
  const k3 = await idempotencyKey({ ...e, eventType: "PAYMENT_REFUNDED" as typeof e.eventType });
  assert.equal(k1.length, 64);
  assert.equal(k1, k2);
  assert.notEqual(k1, k3);
});

test("comparacao de token em tempo constante", () => {
  assert.ok(timingSafeEqual("abc", "abc"));
  assert.ok(!timingSafeEqual("abc", "abd"));
  assert.ok(!timingSafeEqual("abc", "abcd"));
  assert.ok(!timingSafeEqual("", "x"));
});

test("toIso interpreta datas da Asaas", () => {
  assert.equal(toIso("2026-11-04"), "2026-11-04T00:00:00.000Z");
  assert.equal(toIso("2026-10-04T12:00:00Z"), "2026-10-04T12:00:00.000Z");
  assert.equal(toIso("lixo"), null);
  assert.equal(toIso(""), null);
  assert.equal(toIso(null), null);
});
