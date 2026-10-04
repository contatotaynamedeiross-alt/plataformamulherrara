#!/usr/bin/env bash
# Roda as migrações e os testes de segurança num Postgres limpo.
# Uso: DATABASE_URL=postgres://user:pass@host:5432/postgres tests/db/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

: "${DATABASE_URL:?defina DATABASE_URL apontando para um Postgres de teste (NUNCA o de produção)}"
DB="rara_test_$$"
ADMIN_URL="$DATABASE_URL"

psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -q -c "drop database if exists $DB" -c "create database $DB"
trap 'psql "$ADMIN_URL" -q -c "drop database if exists '"$DB"'" >/dev/null 2>&1 || true' EXIT

TEST_URL="${ADMIN_URL%/*}/$DB"
psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f tests/db/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do
  echo "migração: $f"
  psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done
psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -o /dev/null -f tests/db/10_security_test.sql
