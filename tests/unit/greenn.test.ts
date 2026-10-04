// Roda com: node --experimental-strip-types --test tests/unit/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  idempotencyKey,
  parseGreennPayload,
  redactGreennPayload,
  timingSafeEqual,
  toIso,
} from "../../supabase/functions/_shared/greenn.ts";

const contrato = {
  oldStatus: "trialing",
  currentStatus: "paid",
  type: "contract",
  event: "contractUpdated",
  product: { id: 4242, name: "Rara IA", amount: 97 },
  currentSale: { id: 9, status: "paid", updated_at: "2026-10-04 10:00:00", amount: 1, method: "PIX" },
  contract: { id: 777, status: "paid", start_date: "2026-10-04", current_period_end: "2026-11-04 10:00:00", updated_at: "2026-10-04 10:00:01" },
  client: { name: "Ana", email: " Ana@Exemplo.com ", cpf_cnpj: "123.456.789-00", cellphone: "+5511999999999", street: "Rua X", zipcode: "07000-000" },
};

test("extrai os campos necessarios do contrato", () => {
  const e = parseGreennPayload(contrato);
  assert.ok(e);
  assert.equal(e.eventType, "contract");
  assert.equal(e.providerStatus, "paid");
  assert.equal(e.providerRef, "contract:777");
  assert.equal(e.email, "ana@exemplo.com");
  assert.equal(e.productId, "4242");
  assert.equal(e.periodEnd, "2026-11-04T13:00:00.000Z");
  assert.equal(e.providerUpdatedAt, "2026-10-04T13:00:01.000Z");
});

test("payload sem e-mail, status ou tipo e ignorado", () => {
  assert.equal(parseGreennPayload({ ...contrato, client: {} }), null);
  assert.equal(parseGreennPayload({ ...contrato, type: "lead" }), null);
  assert.equal(parseGreennPayload({ ...contrato, currentStatus: "" }), null);
  assert.equal(parseGreennPayload(null), null);
  assert.equal(parseGreennPayload("texto"), null);
});

test("copia de auditoria nao guarda dados pessoais", () => {
  const r = JSON.stringify(redactGreennPayload(contrato));
  for (const proibido of ["123.456.789-00", "99999", "Rua X", "07000", "exemplo.com", "Ana@"]) {
    assert.ok(!r.includes(proibido), `vazou: ${proibido}`);
  }
  assert.ok(r.includes("777"));
});

test("chave de idempotencia e estavel e muda com o status", async () => {
  const e = parseGreennPayload(contrato)!;
  const k1 = await idempotencyKey(e);
  const k2 = await idempotencyKey({ ...e });
  const k3 = await idempotencyKey({ ...e, providerStatus: "canceled" });
  assert.equal(k1.length, 64);
  assert.equal(k1, k2);
  assert.notEqual(k1, k3);
});

test("comparacao de token", () => {
  assert.ok(timingSafeEqual("abc", "abc"));
  assert.ok(!timingSafeEqual("abc", "abd"));
  assert.ok(!timingSafeEqual("abc", "abcd"));
  assert.ok(!timingSafeEqual("", "x"));
});

test("datas da Greenn viram ISO", () => {
  assert.equal(toIso("2026-10-04 00:00:00"), "2026-10-04T03:00:00.000Z");
  assert.equal(toIso("2026-10-04T03:00:00Z"), "2026-10-04T03:00:00.000Z");
  assert.equal(toIso("lixo"), null);
  assert.equal(toIso(""), null);
});
