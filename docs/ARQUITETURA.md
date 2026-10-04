# Rara IA — Arquitetura

## Visão geral

```
Usuária (browser)
    │
    ▼
Lovable (front-end)
    │  JWT (magic link)
    ▼
Supabase
    ├── Auth         → magic link, sem senha, cadastro fechado
    ├── PostgREST    → API gerada automaticamente com RLS
    ├── Edge Functions:
    │     greenn-webhook   → recebe pagamentos, cria contas
    │     save-diagnostic  → salva diagnóstico com check LGPD
    │     account-delete   → exclui conta (LGPD)
    └── Storage      → (futuro: uploads de usuária)

Greenn (pagamentos)
    └── POST /functions/v1/greenn-webhook
```

---

## Fluxo de compra → acesso

```
1. Usuária compra na Greenn (R$ 1 no 1º mês, depois R$ 97)
2. Greenn dispara POST para /functions/v1/greenn-webhook
3. Webhook valida token secreto (X-Greenn-Token)
4. Webhook descarta CPF/endereço/telefone; guarda só nome + e-mail + status
5. Cria conta na auth.users (sem senha)
6. Cria perfil em public.profiles
7. Upsert em public.subscriptions
8. Supabase envia magic link de boas-vindas por e-mail
9. Usuária clica no link → entra na plataforma
```

---

## Tabelas e quem pode escrever

| Tabela                      | Cliente lê? | Cliente escreve? | Quem escreve |
|-----------------------------|-------------|------------------|--------------|
| profiles                    | ✅ próprio  | nome/email ✅    | usuária (UPDATE) |
| subscriptions               | ✅ própria  | ❌               | webhook (service_role) |
| invites                     | ❌          | ❌               | webhook (service_role) |
| consents                    | ✅ próprios | via RPC ✅       | RPC record_consent |
| diagnostics                 | ✅ próprios | via função ✅    | Edge Function save-diagnostic |
| plans                       | ✅ próprios | ❌               | servidor (futuro) |
| missions                    | ✅ próprias | status ✅        | usuária (UPDATE limitado) |
| points                      | ✅ próprios | ❌               | RPC grant_points (service_role) |
| medals                      | ✅ próprias | ❌               | servidor (service_role) |
| private.audit_log           | ❌          | ❌               | private.log_audit() |
| private.processed_events    | ❌          | ❌               | webhook (service_role) |

---

## Segredos necessários (supabase secrets set)

| Variável                   | Descrição |
|----------------------------|-----------|
| `GREENN_WEBHOOK_TOKEN`     | Token secreto para validar chamadas da Greenn (64 hex chars) |
| `GREENN_PRODUCT_ID`        | ID do produto Rara IA na Greenn |
| `SITE_URL`                 | URL do front (ex: https://rara.lovable.app) |
| `SUPABASE_URL`             | Gerado automaticamente pelo Supabase |
| `SUPABASE_ANON_KEY`        | Gerado automaticamente pelo Supabase |
| `SUPABASE_SERVICE_ROLE_KEY`| Gerado automaticamente — **nunca para o front** |

---

## Checklist de produção

Antes do primeiro lançamento:

### Auth
- [ ] `enable_signup = false` (Supabase Dashboard → Auth → Settings)
- [ ] Magic link habilitado
- [ ] URLs autorizadas: `https://seudominio.com.br/**`
- [ ] SMTP próprio configurado (Dashboard → Auth → SMTP Settings)
- [ ] JWT expiry: 3600s

### Banco
- [ ] `supabase db push` rodado (após "ok" da responsável)
- [ ] Backups automáticos: Dashboard → Database → Backups → Enable PITR
- [ ] `pg_cron` habilitado: Dashboard → Database → Extensions → pg_cron
- [ ] Job pg_cron criado:
  ```sql
  select cron.schedule(
    'purge-old-events',
    '0 3 * * *',  -- todo dia às 3h
    'select private.purge_old_events()'
  );
  ```

### Funções
- [ ] Segredos cadastrados: `supabase secrets set ...`
- [ ] Deploy: `supabase functions deploy greenn-webhook --no-verify-jwt`
- [ ] Deploy: `supabase functions deploy save-diagnostic`
- [ ] Deploy: `supabase functions deploy account-delete`

### Greenn
- [ ] URL do webhook cadastrada no painel Greenn
- [ ] Header `X-Greenn-Token` configurado com o valor do segredo

### Segurança
- [ ] Security Advisor sem alertas vermelhos (Dashboard → Security Advisor)
- [ ] Política de privacidade publicada
- [ ] Termos de uso publicados
- [ ] DPO nomeado
