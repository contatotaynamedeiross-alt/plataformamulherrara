# Rara IA — Back-end

Plataforma de mentoria feminina com IA.
**Stack:** Supabase (banco + funções) · Lovable (front-end) · Greenn (pagamentos)

---

## Estrutura do projeto

```
supabase/
  config.toml              # Configuração do projeto Supabase
  migrations/              # Migrações do banco (nunca edite; crie uma nova)
  functions/
    greenn-webhook/        # Recebe notificações de pagamento
    save-diagnostic/       # Salva diagnóstico (com verificação LGPD)
    account-delete/        # Exclui conta da usuária
tests/
  db/
    run.sh                 # Roda testes de banco localmente
    10_security_test.sql   # Testes de isolamento e RLS
  unit/
    greenn-webhook.test.ts # Testes unitários do webhook
docs/
  ARQUITETURA.md           # Como o sistema funciona
  LGPD.md                  # Mapa de dados pessoais e direitos
  LOVABLE.md               # Guia para o Lovable (front-end)
.env.example               # Variáveis de ambiente (copie para .env)
SECURITY.md                # Regras de segurança
CONTRIBUTING.md            # Como contribuir
```

---

## Como rodar localmente

### Pré-requisitos
- Docker Desktop
- Supabase CLI: `npm install -g supabase`
- Deno: https://deno.land

### 1. Copiar variáveis de ambiente
```bash
cp .env.example .env
# Preencha SUPABASE_URL, SUPABASE_ANON_KEY etc.
```

### 2. Subir Supabase local
```bash
supabase start
```

### 3. Aplicar migrações
```bash
supabase db push
```

### 4. Rodar testes
```bash
# Testes de banco
bash tests/db/run.sh

# Testes unitários
deno test --allow-env tests/unit/
```

### 5. Verificar funções
```bash
deno check supabase/functions/*/index.ts
```

---

## Deploy (produção)

Veja o checklist em `docs/ARQUITETURA.md#checklist-de-producao`.

> **Nunca** rode `supabase db push` em produção sem o "ok" da responsável.
