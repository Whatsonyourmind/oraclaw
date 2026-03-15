#!/bin/bash
# =============================================================================
# ORACLE Database Initialization Script
# Runs schema.sql and any migrations against PostgreSQL
# =============================================================================

set -e

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-oracle_db}"
DB_USER="${DB_USER:-oracle}"
DB_PASSWORD="${DB_PASSWORD:-oracle_dev}"

SCHEMA_FILE="$(dirname "$0")/../apps/api/database/schema.sql"

echo "[init-db] Starting database initialization..."
echo "[init-db] Host: $DB_HOST:$DB_PORT"
echo "[init-db] Database: $DB_NAME"

# Wait for PostgreSQL to be ready
echo "[init-db] Waiting for PostgreSQL..."
for i in $(seq 1 30); do
  if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1; then
    echo "[init-db] PostgreSQL is ready!"
    break
  fi
  echo "[init-db] Waiting... ($i/30)"
  sleep 2
done

# Check if schema file exists
if [ ! -f "$SCHEMA_FILE" ]; then
  echo "[init-db] ERROR: Schema file not found at $SCHEMA_FILE"
  exit 1
fi

# Apply schema (idempotent - uses IF NOT EXISTS)
echo "[init-db] Applying schema from $SCHEMA_FILE..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCHEMA_FILE" 2>&1 || {
  echo "[init-db] WARNING: Some schema statements may have failed (tables may already exist)"
}

# Run any migration files in order
MIGRATIONS_DIR="$(dirname "$0")/../apps/api/database/migrations"
if [ -d "$MIGRATIONS_DIR" ]; then
  echo "[init-db] Running migrations..."
  for migration in "$MIGRATIONS_DIR"/*.sql; do
    if [ -f "$migration" ]; then
      echo "[init-db] Running migration: $(basename "$migration")"
      PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$migration" 2>&1 || {
        echo "[init-db] WARNING: Migration $(basename "$migration") may have partially failed"
      }
    fi
  done
else
  echo "[init-db] No migrations directory found, skipping"
fi

echo "[init-db] Database initialization complete!"
