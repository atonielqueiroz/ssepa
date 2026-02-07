#!/usr/bin/env bash
set -euo pipefail

cd /root/.openclaw/workspace/ssepa

git fetch origin
BRANCH="${1:-main}"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

npm ci
npm run build

pm2 restart ssepa --update-env
pm2 save

echo "DEPLOY OK: $(git rev-parse --short HEAD)"
