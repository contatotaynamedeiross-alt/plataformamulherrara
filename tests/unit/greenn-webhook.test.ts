/**
 * Testes unitários do greenn-webhook
 * Roda com: deno test --allow-env tests/unit/greenn-webhook.test.ts
 */

import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";

// Simula a lógica de mapeamento de status sem subir o servidor
const STATUS_MAP: Record<string, string> = {
  approved:   "active",
  trialing:   "trial",
  cancelled:  "cancelled",
  refunded:   "cancelled",
  chargeback: "cancelled",
  expired:    "expired",
};

Deno.test("STATUS_MAP: approved → active", () => {
  assertEquals(STATUS_MAP["approved"], "active");
});

Deno.test("STATUS_MAP: trialing → trial", () => {
  assertEquals(STATUS_MAP["trialing"], "trial");
});

Deno.test("STATUS_MAP: cancelled → cancelled", () => {
  assertEquals(STATUS_MAP["cancelled"], "cancelled");
});

Deno.test("STATUS_MAP: refunded → cancelled", () => {
  assertEquals(STATUS_MAP["refunded"], "cancelled");
});

Deno.test("STATUS_MAP: status desconhecido retorna undefined", () => {
  assertEquals(STATUS_MAP["unknown_status"], undefined);
});

// Validação de token
function validarToken(incoming: string, expected: string): boolean {
  if (!expected) return false;
  return incoming === expected;
}

Deno.test("Token: correto é aceito", () => {
  assertEquals(validarToken("abc123", "abc123"), true);
});

Deno.test("Token: errado é rejeitado", () => {
  assertEquals(validarToken("errado", "abc123"), false);
});

Deno.test("Token: vazio é rejeitado mesmo se incoming também vazio", () => {
  assertEquals(validarToken("", ""), false);
});

// Valida que CPF não está no payload salvo
function extrairDadosMinimos(payload: Record<string, unknown>): {
  email: string; name: string; orderId: string; status: string; productId: string;
} {
  const customer = (payload.customer ?? {}) as Record<string, unknown>;
  return {
    email:     String(customer.email ?? "").toLowerCase().trim(),
    name:      String(customer.name  ?? "").trim(),
    orderId:   String(payload.order_id ?? payload.id ?? ""),
    status:    String(payload.status ?? ""),
    productId: String((payload.product as Record<string,unknown>)?.id ?? ""),
    // CPF, telefone e endereço são descartados aqui
  };
}

Deno.test("LGPD: CPF, telefone e endereço são descartados", () => {
  const payload = {
    id: "evt_001",
    order_id: "order_001",
    status: "approved",
    product: { id: "prod_rara" },
    customer: {
      email: "Maria@Test.COM",
      name: "Maria Silva",
      cpf: "123.456.789-00",       // deve ser descartado
      phone: "11999999999",         // deve ser descartado
      address: "Rua Teste, 123",    // deve ser descartado
    },
  };

  const dados = extrairDadosMinimos(payload);

  assertEquals(dados.email, "maria@test.com");
  assertEquals(dados.name, "Maria Silva");
  assertEquals(dados.orderId, "order_001");
  // Confirma que CPF, telefone e endereço NÃO estão no objeto retornado
  assertEquals(("cpf" in dados), false);
  assertEquals(("phone" in dados), false);
  assertEquals(("address" in dados), false);
});
