# Rara IA · Back-end

Plataforma de alta performance feminina com inteligência artificial, criada por Tayna Medeiros.
Este repositório guarda o back-end (Supabase) e as regras de segurança. As telas são feitas no
Lovable, no mesmo repositório.

| Peça | Tecnologia | Onde |
| --- | --- | --- |
| Banco, login e regras de acesso | Supabase (Postgres 15, região São Paulo) | `supabase/migrations/` |
| Funções do servidor | Supabase Edge Functions (Deno) | `supabase/functions/` |
| Telas | Lovable (React + Vite) | `src/` (gerado pelo Lovable) |
| Cobrança | Greenn (webhook de assinatura) | `supabase/functions/greenn-webhook/` |
| Testes | Postgres real + Node test runner | `tests/` |

Leitura obrigatória antes de mexer: [Arquitetura](docs/ARQUITETURA.md), [Segurança](SECURITY.md),
[LGPD](docs/LGPD.md), [Como contribuir](CONTRIBUTING.md) e [Guia do Lovable](docs/LOVABLE.md).

## Estrutura

```
supabase/
  migrations/            # banco: tabelas, RLS, funções, conteúdo (nunca editar uma já aplicada)
  functions/
    _shared/             # lógica pura e utilitários HTTP
    greenn-webhook/      # Greenn → assinatura → convite por e-mail
    account-delete/      # exclusão de conta pela titular (LGPD)
  config.toml
tests/
  db/                    # testes de segurança do banco (RLS, permissões, regras)
  unit/                  # testes da lógica do webhook
docs/                    # arquitetura, LGPD, guia do Lovable
```

## Rodar os testes

Requisitos: `psql`, um Postgres de teste (nunca o de produção), Node 22 e Deno 2.

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres tests/db/run.sh
node --experimental-strip-types --test 'tests/unit/*.test.ts'
deno check --node-modules-dir=none supabase/functions/*/index.ts
```

A esteira do GitHub (`.github/workflows/ci.yml`) roda os três em todo push e pull request, e procura
chaves vazadas no código.

## Colocar no ar (primeira vez)

1. **Supabase:** crie o projeto na região **South America (São Paulo)**. Ative backups diários
   (plano Pro) antes do lançamento.
2. **Banco:** `supabase link --project-ref <ref>` e depois `supabase db push`.
3. **Login** (Authentication → Providers / URL Configuration):
   - desligue "Allow new users to sign up" (só entra quem a Greenn liberou, por convite);
   - use e-mail com link mágico; defina Site URL e Redirect URLs com o domínio do app;
   - configure um **SMTP próprio** (Resend, Brevo ou Amazon SES). O SMTP padrão do Supabase
     envia poucos e-mails por hora e não serve para lançamento.
4. **Segredos das funções** (`supabase secrets set`), conforme `.env.example`:
   `GREENN_WEBHOOK_TOKEN` (64 caracteres aleatórios: `openssl rand -hex 32`),
   `GREENN_PRODUCT_IDS`, `APP_URL`, `ALLOWED_ORIGINS`.
5. **Funções:**
   ```bash
   supabase functions deploy greenn-webhook --no-verify-jwt
   supabase functions deploy account-delete
   ```
6. **Greenn:** no produto da Rara IA, cadastre o webhook de **Assinatura** com a URL
   `https://<ref>.supabase.co/functions/v1/greenn-webhook?token=<GREENN_WEBHOOK_TOKEN>`.
7. **Retenção (LGPD):** em Database → Extensions ative `pg_cron` e agende
   `select private.purge_old_events();` uma vez por dia.
8. **Admin:** para dar acesso ao painel, defina `app_metadata.role = "admin"` na usuária pelo
   painel do Supabase (nunca pelo app).

## Regras que não se quebram

- Toda tabela nova nasce com RLS ligada e um teste em `tests/db/` provando o isolamento.
- A chave `service_role` só existe nas funções do servidor. Nunca no Lovable, no navegador ou no Git.
- Pontos, assinatura e diagnóstico só mudam por funções do servidor.
- Dado pessoal novo só entra com finalidade e base legal registradas em `docs/LGPD.md`.
