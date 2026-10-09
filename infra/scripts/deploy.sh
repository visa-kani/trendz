#!/usr/bin/env bash
# =============================================================================
# Zero-surprise deploy for a single Lightsail instance. Run as the `drift` user:
#     /srv/drift/bin/deploy.sh <git-sha-or-ref>
#
#  1. export the commit into /srv/drift/releases/<timestamp>-<sha>
#  2. link the shared env files (secrets never live in the repo)
#  3. npm ci, prisma generate, build
#  4. back up the database, then `prisma migrate deploy` (applies committed
#     migrations only — it never resets, drops or "pushes" the schema)
#  5. switch the `current` symlink and reload PM2 (API reloads with zero downtime)
#  6. health-check; on failure switch back to the previous release
#
# Migrations must be backward compatible with the previous release
# (expand → deploy → contract), because a rollback does not undo them.
# =============================================================================
set -Eeuo pipefail

REF="${1:?usage: deploy.sh <git-sha-or-ref>}"
BASE=/srv/drift
REPO="$BASE/repo.git"
SHARED="$BASE/shared"
RELEASES="$BASE/releases"
KEEP_RELEASES=5
export DRIFT_ROOT="$BASE/current"
export NEXT_TELEMETRY_DISABLED=1

log() { printf '\n[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

for f in "$SHARED/api.env" "$SHARED/web.env"; do
  [[ -f "$f" ]] || { echo "missing $f — see DEPLOYMENT.md" >&2; exit 1; }
done

log "fetching $REF"
git --git-dir="$REPO" fetch --quiet --prune origin '+refs/heads/*:refs/heads/*' '+refs/tags/*:refs/tags/*'
SHA="$(git --git-dir="$REPO" rev-parse --verify "$REF^{commit}")"
RELEASE="$RELEASES/$(date -u +%Y%m%d%H%M%S)-${SHA:0:8}"
PREVIOUS="$(readlink -f "$BASE/current" 2>/dev/null || true)"

mkdir -p "$RELEASE"
git --git-dir="$REPO" archive "$SHA" | tar -x -C "$RELEASE"
echo "$SHA" > "$RELEASE/REVISION"
ln -sfn "$SHARED/api.env" "$RELEASE/apps/api/.env"
ln -sfn "$SHARED/web.env" "$RELEASE/apps/web/.env.production.local"

log "installing dependencies"
cd "$RELEASE"
npm ci --no-audit --no-fund
npm run db:generate --workspace apps/api

log "building"
npm run build

log "backing up the database before migrating"
bash "$RELEASE/infra/scripts/backup-postgres.sh" "pre-deploy-${SHA:0:8}"

log "applying migrations (prisma migrate deploy)"
npm run db:deploy --workspace apps/api

activate() {
  ln -sfn "$1" "$BASE/current.tmp" && mv -Tf "$BASE/current.tmp" "$BASE/current"
  pm2 startOrReload "$BASE/current/infra/pm2/ecosystem.config.cjs" --update-env
}

healthy() {
  for _ in $(seq 1 30); do
    if curl -fsS http://127.0.0.1:4100/api/health/ready >/dev/null && curl -fsS -o /dev/null http://127.0.0.1:3100/; then return 0; fi
    sleep 2
  done
  return 1
}

log "activating $RELEASE"
activate "$RELEASE"

if ! healthy; then
  log "HEALTH CHECK FAILED"
  if [[ -n "$PREVIOUS" && -d "$PREVIOUS" ]]; then
    log "rolling back to $PREVIOUS"
    activate "$PREVIOUS"
    healthy || log "previous release is unhealthy too — check: pm2 logs"
  fi
  exit 1
fi

pm2 save --force >/dev/null
# Keep the deploy script itself current for the next run.
install -m 755 "$RELEASE/infra/scripts/deploy.sh" "$BASE/bin/deploy.sh"

log "pruning old releases"
ls -1dt "$RELEASES"/*/ | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf

log "deployed ${SHA:0:8}"
