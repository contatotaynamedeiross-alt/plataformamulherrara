#!/usr/bin/env bash
# ============================================================
# Rara IA — Roda testes de banco com Supabase local
# ============================================================
# Pré-requisito: supabase start (Docker rodando)
# Uso: bash tests/db/run.sh
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Cor para output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo "=================================================="
echo " Rara IA — Testes de Banco"
echo "=================================================="

# Verifica se Supabase está rodando
if ! supabase status &>/dev/null; then
  echo -e "${RED}Supabase local não está rodando. Execute: supabase start${NC}"
  exit 1
fi

# Pega a URL do banco local
DB_URL=$(supabase status --output json 2>/dev/null | grep -o '"DB URL":"[^"]*"' | cut -d'"' -f4 || true)
if [ -z "$DB_URL" ]; then
  # Fallback para porta padrão
  DB_URL="postgresql://postgres:postgres@localhost:54322/postgres"
fi

echo "Banco: $DB_URL"
echo ""

PASS=0
FAIL=0

for sql_file in "$SCRIPT_DIR"/*.sql; do
  echo "── Rodando: $(basename "$sql_file")"
  if psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$sql_file" 2>&1; then
    echo -e "${GREEN}✓ Passou${NC}"
    PASS=$((PASS + 1))
  else
    echo -e "${RED}✗ Falhou${NC}"
    FAIL=$((FAIL + 1))
  fi
  echo ""
done

echo "=================================================="
echo -e "Resultado: ${GREEN}${PASS} passou(ram)${NC}  ${RED}${FAIL} falhou(ram)${NC}"
echo "=================================================="

[ "$FAIL" -eq 0 ] || exit 1
