#!/usr/bin/env bash
# Deploy one image tag on the server, with pre-deploy DB backup, health checks and automatic rollback.
# Usage (in DEPLOY_PATH, next to docker-compose.prod.yml and .env):  ./deploy.sh <image-tag>
# State: .current_tag (last healthy tag), .previous_tag (the one before). Re-running with the same tag is safe.
set -euo pipefail

NEW_TAG="${1:?usage: deploy.sh <image-tag>}"
cd "$(dirname "$0")"
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file .env)
BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_KEEP="${BACKUP_KEEP:-20}"            # number of backup folders kept
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-300}"     # seconds, JVMs on a small VPS start slowly
HEALTH_URLS=(
  "http://127.0.0.1:8081/actuator/health"
  "http://127.0.0.1:8082/actuator/health"
  "http://127.0.0.1:8086/actuator/health"
  "http://127.0.0.1:8088/actuator/health"
  "http://127.0.0.1:8080/actuator/health"
  "http://127.0.0.1:3000/login"
)

log() { echo "[deploy $(date -u +%H:%M:%S)] $*"; }

[ -f .env ] || { log "missing .env next to deploy.sh"; exit 1; }
exec 9>.deploy.lock
flock -n 9 || { log "another deploy is running"; exit 1; }

CURRENT_TAG="$(cat .current_tag 2>/dev/null || true)"
DB_USER="$(grep -E '^DB_USER=' .env | cut -d= -f2- | tr -d '\r')"

backup_databases() {
  if ! "${COMPOSE[@]}" ps --status running --services 2>/dev/null | grep -qx postgres; then
    log "postgres not running yet (first deploy?) - skipping backup"; return 0
  fi
  local dir="$BACKUP_DIR/$(date -u +%Y%m%d-%H%M%S)-before-${NEW_TAG:0:12}"
  mkdir -p "$dir"
  "${COMPOSE[@]}" exec -T postgres pg_dumpall -U "$DB_USER" --globals-only | gzip > "$dir/globals.sql.gz"
  local dbs
  dbs="$("${COMPOSE[@]}" exec -T postgres psql -U "$DB_USER" -d postgres -Atc \
        "SELECT datname FROM pg_database WHERE NOT datistemplate AND datname <> 'postgres'")"
  for db in $dbs; do
    db="${db//$'\r'/}"
    "${COMPOSE[@]}" exec -T postgres pg_dump -U "$DB_USER" -Fc "$db" > "$dir/$db.dump"
    log "backup $db -> $dir/$db.dump ($(du -h "$dir/$db.dump" | cut -f1))"
  done
  # keep only the newest BACKUP_KEEP backup folders
  ls -1dt "$BACKUP_DIR"/*/ 2>/dev/null | tail -n +"$((BACKUP_KEEP + 1))" | xargs -r rm -rf
}

wait_healthy() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT))
  for url in "${HEALTH_URLS[@]}"; do
    until curl -fsS -o /dev/null --max-time 5 "$url"; do
      if (( SECONDS >= deadline )); then log "UNHEALTHY: $url"; return 1; fi
      sleep 5
    done
    log "healthy: $url"
  done
}

up_with_tag() {
  IMAGE_TAG="$1" "${COMPOSE[@]}" pull --quiet
  IMAGE_TAG="$1" "${COMPOSE[@]}" up -d --remove-orphans
}

log "current=${CURRENT_TAG:-none} new=$NEW_TAG"
backup_databases
up_with_tag "$NEW_TAG"

if wait_healthy; then
  if [ "$CURRENT_TAG" != "$NEW_TAG" ]; then
    [ -n "$CURRENT_TAG" ] && echo "$CURRENT_TAG" > .previous_tag
    echo "$NEW_TAG" > .current_tag
  fi
  docker image prune -f >/dev/null || true
  log "DEPLOY OK: $NEW_TAG"
  exit 0
fi

log "health check failed for $NEW_TAG"
"${COMPOSE[@]}" ps || true
"${COMPOSE[@]}" logs --tail=80 || true
ROLLBACK_TAG="$CURRENT_TAG"
[ "$ROLLBACK_TAG" = "$NEW_TAG" ] && ROLLBACK_TAG="$(cat .previous_tag 2>/dev/null || true)"
if [ -z "$ROLLBACK_TAG" ]; then
  log "no previous tag to roll back to"; exit 1
fi
log "ROLLING BACK to $ROLLBACK_TAG"
up_with_tag "$ROLLBACK_TAG"
if wait_healthy; then
  log "rollback OK - still running $ROLLBACK_TAG. Note: DB migrations of $NEW_TAG are NOT reverted; restore from $BACKUP_DIR if needed."
else
  log "ROLLBACK ALSO UNHEALTHY - manual action required"
fi
exit 1
