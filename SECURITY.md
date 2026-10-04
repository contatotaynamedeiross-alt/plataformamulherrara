# Rara IA — Guia de Segurança

## Regras que nunca se quebram

| # | Regra |
|---|-------|
| 1 | Toda tabela pública tem RLS habilitado. `anon` nunca lê nada. |
| 2 | Escritas sensíveis (pontos, assinaturas, medalhas) só via RPC `SECURITY DEFINER set search_path = ''`. |
| 3 | A `service_role` key nunca vai para: front-end, Lovable, logs, Git ou ambiente do usuário. |
| 4 | Nunca salvar CPF, endereço ou telefone. Do payload da Greenn, guardar apenas: nome, e-mail, status, ID do pedido. |
| 5 | Nenhum dado pessoal em logs (nem `audit_log`, nem `console.log`). |
| 6 | Antes de qualquer ação irreversível (db push em produção, deploy, apagar dados), explique e espere "ok". |
| 7 | Migrações: nunca edite um arquivo existente. Crie uma nova migração numerada. |
| 8 | Segredos nunca no histórico do terminal: use `read -s` ou arquivo `.env` local. |

---

## Autenticação

- Magic link por e-mail (sem senha).
- Cadastro desligado no Supabase Auth (`enable_signup = false`).
- Acesso por convite automático enviado após pagamento confirmado.
- JWT expira em 1 hora; refresh token em 7 dias.

---

## Webhook Greenn

**Risco conhecido:** A Greenn não assina os eventos com HMAC.

**Mitigação implementada:**
- Header `X-Greenn-Token` com valor de 64 caracteres (hex) gerado com `openssl rand -hex 32`.
- Token armazenado apenas como segredo Supabase (`supabase secrets set`), nunca no Git.
- Idempotência: tabela `private.processed_events` garante que evento duplicado é ignorado.
- Filtragem: somente eventos do produto `GREENN_PRODUCT_ID` são processados.
- Retorna `200 OK` para eventos de outros produtos (evita retentativas desnecessárias).

**Como monitorar:**
- Logs da função `greenn-webhook` no painel Supabase → Functions → Logs.
- Alertas de falha: configure alerta em Supabase → Monitoring.

---

## Dado sensível (LGPD art. 11)

A pergunta sobre crença/fé no diagnóstico revela convicção religiosa.

- O banco recusa inserção com `contains_sensitive = true` e `consent_id = null` (trigger).
- O consentimento é registrado via RPC `record_consent` com `purpose`, `version` e timestamp.
- O front-end (Lovable) deve chamar `record_consent` antes de `save-diagnostic`.

---

## Rotação de segredos

Se `GREENN_WEBHOOK_TOKEN` for comprometido:
1. Gere novo token: `openssl rand -hex 32`
2. `supabase secrets set GREENN_WEBHOOK_TOKEN=<novo>`
3. Atualize o valor no painel da Greenn imediatamente
4. O token antigo para de funcionar no próximo request

---

## Incidente de segurança

1. Notifique a responsável imediatamente.
2. Revogue os segredos comprometidos.
3. Avalie se dados pessoais foram expostos.
4. Se sim, notifique a ANPD em até 72 horas: https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis
5. Notifique as usuárias afetadas.

---

## Checklist de segurança antes do lançamento

- [ ] Política de privacidade revisada por advogado
- [ ] Termos de uso revisados por advogado
- [ ] DPO (encarregado de dados) nomeado
- [ ] Backups automáticos habilitados no Supabase (Point-in-Time Recovery)
- [ ] Alertas de uso configurados
- [ ] `GREENN_WEBHOOK_TOKEN` gerado e cadastrado
- [ ] `enable_signup = false` no Auth
- [ ] E-mail SMTP próprio configurado (não usar o padrão do Supabase em produção)
