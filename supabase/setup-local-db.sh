#!/usr/bin/env bash
# =============================================================================
# SCHOOLY — Application complète du schéma + migrations + seed sur Postgres local
# =============================================================================
# Usage : ./supabase/setup-local-db.sh [DB_URL]
#   DB_URL = connexion Postgres (défaut : instance supabase start locale)
#
# Applique dans l'ordre :
#   1. schema.sql          (tables de base + RLS)
#   2. migration-auth-roles.sql
#   3. migration-operations.sql  (enums : fee_status, document_type, …)
#   4. apply-batch-2.sql   (tables payments / fees / documents / messages)
#   5. fix-grants-and-rls.sql
#   6. supabase/migrations/*.sql (vues + fonctions intelligence — triées)
#   7. seed.sql
#
# Le tout est idempotent (IF NOT EXISTS / ON CONFLICT / DROP IF EXISTS).
# =============================================================================
set -euo pipefail

DB_URL="${1:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
SUPABASE_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "[setup-local-db] Connexion → $DB_URL"

apply() {
  local label="$1"; shift
  echo "[setup-local-db] → $label"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$1"
}

apply "schema de base (Partie 1)"        "$SUPABASE_DIR/schema.sql"
apply "rôles auth (Partie 2)"            "$SUPABASE_DIR/migration-auth-roles.sql"
apply "opérations enum (Partie 3)"       "$SUPABASE_DIR/migration-operations.sql"
apply "batch tables (Partie 4)"          "$SUPABASE_DIR/apply-batch-2.sql"
apply "correctifs grants + RLS"          "$SUPABASE_DIR/fix-grants-and-rls.sql"

# Migrations intelligence (triées par nom = ordre chronologique)
for f in "$SUPABASE_DIR"/migrations/*.sql; do
  [ -e "$f" ] || continue
  apply "migration : $(basename "$f")" "$f"
done

apply "données seed" "$SUPABASE_DIR/seed.sql"

echo "[setup-local-db] ✅ Schéma complet appliqué."
