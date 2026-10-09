#!/usr/bin/env bash
# =============================================================================
# One-time setup of a fresh AWS Lightsail Ubuntu 24.04 instance (run as root):
#     sudo DOMAIN=shop.example.com REPO_URL=git@github.com:org/drift-commerce.git \
#          bash provision-ubuntu.sh
#
# Installs Node.js 22, PostgreSQL 16, Redis 7, Nginx, Certbot, PM2, AWS CLI
# (for R2 backups) and hardens the box (UFW, fail2ban, unattended upgrades).
# Generated database / Redis passwords are written to /srv/drift/shared/*.env
# (mode 600) — nothing is printed. Review before running; re-running is safe.
# =============================================================================
set -Eeuo pipefail

DOMAIN="${DOMAIN:?set DOMAIN=shop.example.com}"
REPO_URL="${REPO_URL:?set REPO_URL to the git clone URL}"
APP_USER=drift
BASE=/srv/drift
SHARED="$BASE/shared"

[[ $EUID -eq 0 ]] || { echo "run as root" >&2; exit 1; }
export DEBIAN_FRONTEND=noninteractive
rand() { openssl rand -base64 48 | tr -d '\n/+=' | cut -c1-"${1:-40}"; }

echo "== packages"
apt-get update -q
apt-get upgrade -yq
apt-get install -yq curl ca-certificates gnupg git unzip jq nginx postgresql postgresql-contrib redis-server \
  certbot python3-certbot-nginx ufw fail2ban unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades

if ! command -v node >/dev/null || [[ "$(node -v)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -yq nodejs
fi
npm install -g pm2@latest >/dev/null

if ! command -v aws >/dev/null; then
  curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-$(uname -m).zip" -o /tmp/awscliv2.zip
  unzip -qo /tmp/awscliv2.zip -d /tmp && /tmp/aws/install --update && rm -rf /tmp/aws /tmp/awscliv2.zip
fi

echo "== swap (small instances need it for builds)"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "== app user and directories"
id "$APP_USER" >/dev/null 2>&1 || adduser --system --group --shell /bin/bash --home "$BASE" "$APP_USER"
install -d -o "$APP_USER" -g "$APP_USER" -m 755 "$BASE" "$BASE/releases" "$BASE/bin"
install -d -o "$APP_USER" -g "$APP_USER" -m 700 "$SHARED" "$BASE/backups"
install -d -o "$APP_USER" -g "$APP_USER" -m 755 /var/log/drift

echo "== PostgreSQL"
systemctl enable --now postgresql
if [[ ! -f "$SHARED/.db_password" ]]; then
  rand 32 > "$SHARED/.db_password"
  chmod 600 "$SHARED/.db_password" && chown "$APP_USER:$APP_USER" "$SHARED/.db_password"
fi
DB_PASSWORD="$(cat "$SHARED/.db_password")"
sudo -u postgres psql -v ON_ERROR_STOP=1 -q <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'drift') THEN
    CREATE ROLE drift LOGIN CREATEDB PASSWORD '${DB_PASSWORD}';
  END IF;
END \$\$;
SQL
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='drift'" | grep -q 1 || sudo -u postgres createdb -O drift drift
# Only local connections (default on Ubuntu: listen_addresses = 'localhost').

echo "== Redis (BullMQ needs noeviction and persistence)"
if [[ ! -f "$SHARED/.redis_password" ]]; then
  rand 32 > "$SHARED/.redis_password"
  chmod 600 "$SHARED/.redis_password" && chown "$APP_USER:$APP_USER" "$SHARED/.redis_password"
fi
REDIS_PASSWORD="$(cat "$SHARED/.redis_password")"
REDIS_CONF=/etc/redis/redis.conf
sed -i -E 's/^#? ?bind .*/bind 127.0.0.1 -::1/; s/^#? ?appendonly .*/appendonly yes/; s/^#? ?maxmemory-policy .*/maxmemory-policy noeviction/' "$REDIS_CONF"
grep -q '^requirepass ' "$REDIS_CONF" && sed -i "s/^requirepass .*/requirepass ${REDIS_PASSWORD}/" "$REDIS_CONF" || echo "requirepass ${REDIS_PASSWORD}" >> "$REDIS_CONF"
systemctl enable redis-server && systemctl restart redis-server

echo "== env file templates (fill in provider credentials afterwards)"
if [[ ! -f "$SHARED/api.env" ]]; then
  cat > "$SHARED/api.env" <<ENV
NODE_ENV=production
PORT=4100
WEB_URL=https://${DOMAIN}
CORS_ORIGINS=
TRUST_PROXY=1
LOG_LEVEL=info
DATABASE_URL=postgresql://drift:${DB_PASSWORD}@127.0.0.1:5432/drift?schema=public&connection_limit=10
REDIS_URL=redis://:${REDIS_PASSWORD}@127.0.0.1:6379/0
JWT_SECRET=$(rand 64)
OTP_SECRET=$(rand 64)
ACCESS_TOKEN_TTL_MINUTES=15
REFRESH_TOKEN_TTL_DAYS=30
COOKIE_SECURE=true
COOKIE_DOMAIN=
PAYMENT_PROVIDER=razorpay
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
R2_ACCOUNT_ID=
R2_ENDPOINT=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
R2_FORCE_PATH_STYLE=false
SMS_PROVIDER=msg91
SMS_API_KEY=
SMS_SENDER_ID=
SMS_TEMPLATE_OTP=
SMS_TEMPLATE_ORDER=
SMS_TEMPLATE_SHIPPING=
EMAIL_PROVIDER=brevo
EMAIL_API_KEY=
EMAIL_FROM_ADDRESS=orders@${DOMAIN}
EMAIL_FROM_NAME=Drift
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
SHIPPING_PROVIDER=shiprocket
SHIPPING_API_KEY=
SHIPPING_API_SECRET=
SHIPPING_PICKUP_LOCATION=Primary
SHIPPING_WEBHOOK_TOKEN=$(rand 40)
SEED_ADMIN_EMAIL=
SEED_ADMIN_PASSWORD=
ENV
fi
if [[ ! -f "$SHARED/web.env" ]]; then
  cat > "$SHARED/web.env" <<ENV
API_INTERNAL_URL=http://127.0.0.1:4100
NEXT_PUBLIC_SITE_URL=https://${DOMAIN}
NEXT_PUBLIC_MEDIA_ORIGIN=https://media.${DOMAIN}
NEXT_PUBLIC_STORE_NAME=Drift
ENV
fi
if [[ ! -f "$SHARED/backup.env" ]]; then
  cat > "$SHARED/backup.env" <<ENV
DATABASE_URL=postgresql://drift:${DB_PASSWORD}@127.0.0.1:5432/drift
BACKUP_DIR=${BASE}/backups
LOCAL_RETENTION_DAYS=7
BACKUP_BUCKET=
BACKUP_R2_ENDPOINT=
BACKUP_R2_ACCESS_KEY_ID=
BACKUP_R2_SECRET_ACCESS_KEY=
ENV
fi
chown "$APP_USER:$APP_USER" "$SHARED"/*.env && chmod 600 "$SHARED"/*.env

echo "== repository mirror (add $BASE/.ssh/id_ed25519.pub as a read-only deploy key)"
install -d -o "$APP_USER" -g "$APP_USER" -m 700 "$BASE/.ssh"
[[ -f "$BASE/.ssh/id_ed25519" ]] || sudo -u "$APP_USER" ssh-keygen -q -t ed25519 -N '' -f "$BASE/.ssh/id_ed25519" -C "drift-deploy@${DOMAIN}"
sudo -u "$APP_USER" bash -c "ssh-keyscan -t ed25519 github.com 2>/dev/null >> $BASE/.ssh/known_hosts"
[[ -d "$BASE/repo.git" ]] || sudo -u "$APP_USER" git init --bare -q "$BASE/repo.git"
sudo -u "$APP_USER" git --git-dir="$BASE/repo.git" remote remove origin 2>/dev/null || true
sudo -u "$APP_USER" git --git-dir="$BASE/repo.git" remote add origin "$REPO_URL"

echo "== PM2 on boot + log rotation"
env PATH="$PATH" pm2 startup systemd -u "$APP_USER" --hp "$BASE" >/dev/null
sudo -u "$APP_USER" -H pm2 install pm2-logrotate >/dev/null
sudo -u "$APP_USER" -H pm2 set pm2-logrotate:max_size 50M >/dev/null
sudo -u "$APP_USER" -H pm2 set pm2-logrotate:retain 14 >/dev/null

echo "== scheduled jobs"
cat > /etc/cron.d/drift <<CRON
SHELL=/bin/bash
# Nightly database backup at 02:30 server time
30 2 * * * ${APP_USER} /bin/bash ${BASE}/current/infra/scripts/backup-postgres.sh nightly >> /var/log/drift/backup.log 2>&1
# Refresh Cloudflare IP ranges monthly
15 4 1 * * root /bin/bash ${BASE}/current/infra/scripts/cloudflare-ips.sh >> /var/log/drift/cloudflare-ips.log 2>&1
CRON
cat > /etc/logrotate.d/drift <<ROT
/var/log/drift/*.log {
  weekly
  rotate 8
  compress
  missingok
  notifempty
}
ROT

echo "== firewall"
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable >/dev/null
systemctl enable --now fail2ban

echo "== nginx placeholder for the Cloudflare include"
[[ -f /etc/nginx/conf.d/cloudflare-real-ip.conf ]] || echo "# filled by cloudflare-ips.sh" > /etc/nginx/conf.d/cloudflare-real-ip.conf
rm -f /etc/nginx/sites-enabled/default
install -d /var/www/certbot

cat <<DONE

Provisioning finished. Next steps (DEPLOYMENT.md has the details):
  1. Add this deploy key to the Git repository (read-only):
       $(cat "$BASE/.ssh/id_ed25519.pub")
  2. Fill in provider credentials:  sudo -u ${APP_USER} nano ${SHARED}/api.env
  3. First deploy:  sudo -u ${APP_USER} -H bash -c 'cp <repo>/infra/scripts/deploy.sh ${BASE}/bin/ && ${BASE}/bin/deploy.sh main'
  4. Nginx + TLS:   copy infra/nginx/drift.conf, set the domain, run certbot, reload nginx
DONE
