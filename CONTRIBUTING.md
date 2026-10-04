# Como contribuir com o Rara IA

Obrigada por contribuir! Leia antes de enviar qualquer mudança.

---

## Regras inegociáveis

1. **Nunca edite uma migração existente.** Crie um novo arquivo `002_...sql`, `003_...sql` etc.
2. **Toda nova tabela precisa de RLS.** Teste em `tests/db/`.
3. **Segredos nunca no código.** Nem em comentários. Nem em mensagens de commit.
4. **Sem CPF, endereço ou telefone** em nenhuma tabela ou log.
5. **A `service_role` key nunca sai do servidor.** Nunca passa para o front.

---

## Fluxo de trabalho

```
main (protegida)
  └── sprint-N/nome-da-feature   ← seu branch
```

1. Crie um branch a partir de `main`.
2. Faça as alterações.
3. Rode os testes localmente (veja README).
4. Abra um Pull Request para `main`.
5. O CI precisa passar antes do merge.

---

## Convenção de commits

```
tipo(escopo): descrição curta em português

Exemplos:
feat(webhook): adiciona suporte a evento chargeback
fix(rls): corrige policy de leitura em missions
test(db): adiciona teste de isolamento para medals
docs(lgpd): atualiza mapa de dados do diagnóstico
```

Tipos: `feat`, `fix`, `test`, `docs`, `refactor`, `chore`

---

## Adicionando uma nova migração

```bash
# Nome obrigatório: NNN_descricao_curta.sql (NNN = próximo número)
touch supabase/migrations/002_nova_tabela.sql

# Depois, adicione um teste correspondente:
touch tests/db/20_nova_tabela_test.sql
```

A migração deve incluir:
- `alter table ... enable row level security;`
- Políticas RLS explícitas
- Comentário explicando o propósito da tabela

---

## Adicionando uma Edge Function

```bash
supabase functions new nome-da-funcao
```

A função deve:
- Validar o JWT (exceto webhooks externos: `--no-verify-jwt`)
- Nunca logar e-mail, nome ou qualquer dado pessoal
- Usar `SUPABASE_SERVICE_ROLE_KEY` apenas server-side, nunca expor ao cliente

---

## CI

O workflow `.github/workflows/ci.yml` roda automaticamente em todo PR:
- `deno check` nas funções
- Testes unitários com Deno
- Verificação de segredos vazados (gitleaks)
