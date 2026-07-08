#!/usr/bin/env bash
# One-line installer for the agent mode of server-monitoring.
# Usage: curl -fsSL https://raw.githubusercontent.com/Graviton28/server-monitoring/main/install.sh | bash
set -euo pipefail

REPO_URL="https://github.com/Graviton28/server-monitoring.git"
INSTALL_DIR="${INSTALL_DIR:-$HOME/server-monitoring}"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 18+ is required but wasn't found. Install it first: https://nodejs.org" >&2
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "git is required but wasn't found. Install it first." >&2
  exit 1
fi

if [ -d "$INSTALL_DIR/.git" ]; then
  echo "Existing install found at $INSTALL_DIR, pulling latest..."
  git -C "$INSTALL_DIR" pull --ff-only
else
  echo "Cloning into $INSTALL_DIR..."
  git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"
npm install

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example."
fi

cat <<MSG

Install complete: $INSTALL_DIR

Next steps:
  1. Edit $INSTALL_DIR/.env with your Loki URL and auth.
  2. Run it:
       cd $INSTALL_DIR && npm run agent
     Or keep it running persistently with pm2:
       npm install -g pm2
       pm2 start $INSTALL_DIR/src/agent/index.js --name server-monitor
       pm2 save

MSG
