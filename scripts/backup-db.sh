#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# scripts/backup-db.sh
#
# Independent, off-platform nightly export of the Supabase Postgres database.
#
# Why this exists (see the engineering review, finding H3): Supabase's own
# backups live inside Supabase and protect against database-level failure,
# but not against an accidentally-deleted project, a lapsed/downgraded
# subscription, a revoked account, or a mistake made through the Supabase
# dashboard itself. A copy that lives somewhere else (a CI artifact, S3, or
# your own machine) is the only thing that survives all of those. As of this
# writing Supabase's plan-based retention is: Free — no automatic backups
# (Supabase's own guidance is to export regularly via the CLI/pg_dump, which
# is exactly what this script does); Pro — daily, 7 days; Team — daily, 14
# days; Enterprise — daily, 30 days. Point-in-time recovery (PITR) is a paid
# add-on on Pro+ and, when enabled, REPLACES daily backups rather than
# running alongside them. Check your own project's Database > Backups page
# to see what you're actually covered by today.
#
# What this script does:
#   1. pg_dump's the whole database in Postgres "custom" format (-Fc): a
#      single compressed, binary file that pg_restore can replay selectively
#      or in full, and that is portable across minor Postgres versions.
#   2. Writes it to BACKUP_DIR (default ./backups, already gitignored) named
#      with a UTC timestamp.
#   3. If BACKUP_S3_BUCKET is set and the `aws` CLI is available, also
#      uploads it there — this is what makes the backup "off-platform": nights
#      it runs from a developer machine or from CI, the file can still end up
#      somewhere that isn't Supabase and isn't this git repo.
#   4. Prunes local dumps older than BACKUP_RETENTION_DAYS (default 14) so a
#      cron job doesn't fill the disk it runs on. Remote (S3) retention is
#      not pruned by this script — set an S3 lifecycle rule for that instead.
#
# Usage:
#   SUPABASE_DB_URL="postgresql://postgres:<password>@<host>:5432/postgres" \
#     ./scripts/backup-db.sh
#
# Where to get SUPABASE_DB_URL: Supabase dashboard → Project Settings →
# Database → "Connection string" → URI. Use the "Session pooler" connection
# string if your network can't reach the direct connection (e.g. IPv4-only,
# which is common for CI runners) — the direct connection is IPv6-only unless
# you've paid for the IPv4 add-on.
#
# This script is run automatically by .github/workflows/nightly-backup.yml —
# see that file and the "Backups" section in PROJECT_OVERVIEW.md for the full
# setup (which GitHub secrets to add, and how to restore from a dump).
# -----------------------------------------------------------------------------
set -euo pipefail

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "error: SUPABASE_DB_URL is not set. See the header of this script for where to get it." >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "error: pg_dump not found. Install the postgresql-client package (the" >&2
  echo "       nightly-backup.yml workflow already does this)." >&2
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
FILENAME="oksy-academy-finance-${TIMESTAMP}.dump"
DEST="${BACKUP_DIR}/${FILENAME}"

mkdir -p "$BACKUP_DIR"

echo "Dumping database to ${DEST} ..."
# --no-owner/--no-privileges: makes the dump restorable into a project whose
# role names differ (e.g. a throwaway Supabase project used to test a
# restore), rather than binding it to this project's exact role layout.
pg_dump "$SUPABASE_DB_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="$DEST"

SIZE_HUMAN="$(du -h "$DEST" | cut -f1)"
echo "Wrote ${DEST} (${SIZE_HUMAN})."

if [[ -n "${BACKUP_S3_BUCKET:-}" ]]; then
  if command -v aws >/dev/null 2>&1; then
    S3_PREFIX="${BACKUP_S3_PREFIX:-oksy-academy-finance}"
    S3_PATH="s3://${BACKUP_S3_BUCKET}/${S3_PREFIX}/${FILENAME}"
    echo "Uploading to ${S3_PATH} ..."
    aws s3 cp "$DEST" "$S3_PATH"
    echo "Uploaded."
  else
    echo "warning: BACKUP_S3_BUCKET is set but the aws CLI is not installed — skipping upload." >&2
  fi
fi

echo "Pruning local dumps older than ${BACKUP_RETENTION_DAYS} days in ${BACKUP_DIR} ..."
find "$BACKUP_DIR" -name 'oksy-academy-finance-*.dump' -type f -mtime "+${BACKUP_RETENTION_DAYS}" -print -delete

echo "Backup complete."
