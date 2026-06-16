#!/usr/bin/env bash
# RevenuePilot AI — one-command deploy to the production server.
#
#   ./deploy.sh
#
# What it does:
#   1. rsync the repo to the server (keeps backend/.env, skips junk)
#   2. installs Docker (+ compose plugin) on the server if missing
#   3. builds & (re)starts the stack: Postgres + FastAPI + frontend + Caddy
#   4. registers the Telegram webhook against the public domain
#
# Override defaults via env vars, e.g.  SERVER_IP=1.2.3.4 ./deploy.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load saved server connection details (gitignored).
if [ -f deploy/server.env ]; then
  set -a; . deploy/server.env; set +a
fi

SERVER_IP="${SERVER_IP:-2.26.124.28}"
SERVER_USER="${SERVER_USER:-root}"
REMOTE_DIR="${REMOTE_DIR:-/opt/revenue}"
DOMAIN="${DOMAIN:-revenue.makhkets.ru}"
SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=20"

say() { printf "\n\033[1;36m== %s\033[0m\n" "$*"; }

# ── 1. Sync code to the server ────────────────────────────────────────
say "Syncing code to ${SERVER_USER}@${SERVER_IP}:${REMOTE_DIR}"
ssh $SSH_OPTS "${SERVER_USER}@${SERVER_IP}" "mkdir -p '${REMOTE_DIR}'"
rsync -az --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.venv' \
  --exclude 'dist' \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  --exclude '.pytest_cache' \
  --exclude '.ruff_cache' \
  --exclude 'frontend/screenshots' \
  -e "ssh $SSH_OPTS" \
  ./ "${SERVER_USER}@${SERVER_IP}:${REMOTE_DIR}/"

# ── 2. Ensure Docker is installed, then bring the stack up ─────────────
say "Installing Docker (if needed) and starting the stack"
ssh $SSH_OPTS "${SERVER_USER}@${SERVER_IP}" bash -s <<REMOTE
set -euo pipefail
cd "${REMOTE_DIR}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker >/dev/null 2>&1 || true

echo "Building and starting containers..."
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans

echo "Pruning dangling build cache..."
docker image prune -f >/dev/null 2>&1 || true

echo "--- container status ---"
docker compose -f docker-compose.prod.yml ps
REMOTE

# ── 3. Register the Telegram webhook ──────────────────────────────────
say "Registering Telegram webhook"
# Read token + secret from backend/.env.
TG_TOKEN="$(grep -E '^TELEGRAM_BOT_TOKEN=' backend/.env | cut -d= -f2-)"
TG_SECRET="$(grep -E '^TELEGRAM_WEBHOOK_SECRET=' backend/.env | cut -d= -f2-)"
WEBHOOK_URL="https://${DOMAIN}/api/v1/telegram/webhook"

if [ -n "${TG_TOKEN}" ]; then
  curl -s -X POST "https://api.telegram.org/bot${TG_TOKEN}/setWebhook" \
    -d "url=${WEBHOOK_URL}" \
    -d "secret_token=${TG_SECRET}" \
    -d "drop_pending_updates=false" \
    -d 'allowed_updates=["message","edited_message","my_chat_member"]'
  echo
  curl -s "https://api.telegram.org/bot${TG_TOKEN}/getWebhookInfo"; echo
else
  echo "TELEGRAM_BOT_TOKEN not set in backend/.env — skipping webhook."
fi

say "Done. Site: https://${DOMAIN}  ·  API docs: https://${DOMAIN}/api/v1/docs"
