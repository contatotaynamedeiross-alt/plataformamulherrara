# Como contribuir

## Fluxo

1. Crie um branch a partir de `main` (`feat/...`, `fix/...`).
2. Faça a mudança com teste.
3. Abra um pull request. A esteira precisa estar verde e alguém precisa revisar.
4. `main` é protegido: sem push direto.

## Banco de dados

- Toda mudança é uma **nova** migração em `supabase/migrations/` com prefixo de data e hora
  (`AAAAMMDDHHMMSS_descricao.sql`). Nunca edite uma migração que já foi aplicada em produção.
- Tabela nova: `enable row level security`, `revoke` de `anon`/`authenticated`, `grant` só do
  necessário e políticas por `auth.uid()`.
- Função `security definer`: sempre `set search_path = ''`, nomes de objetos com schema
  (`public.tabela`), checagem de `auth.uid()` e de `private.has_active_access`.
- Acrescente casos em `tests/db/10_security_test.sql`: o caminho certo e a tentativa de abuso.

## Funções do servidor

- Lógica pura em `supabase/functions/_shared/` com teste em `tests/unit/`.
- Segredos só por `Deno.env`. Nunca registre e-mail, nome ou documento em log.
- Entrada externa: limite de tamanho, validação de tipo e resposta genérica de erro.

## Commits

Mensagens curtas no imperativo: `feat: diagnóstico salva consentimento`, `fix: carência da assinatura`.
