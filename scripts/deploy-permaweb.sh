#!/usr/bin/env bash
# Upload apps/web/dist to Arweave (Turbo / bundler). Does NOT change ArNS.
# Name sejire is owned in Phantom — set Target ID manually after upload.
#
# Usage (on YOUR computer — never paste wallet into chat):
#   1. Export Wander keyfile → ./wallet.json at repo root (gitignored)
#   2. npm run deploy:permaweb
#   3. Copy printed manifest TX id
#   4. Delete wallet.json
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

WALLET="${WALLET_PATH:-$ROOT/wallet.json}"
if [[ ! -f "$WALLET" ]]; then
  echo "Нет файла кошелька: $WALLET"
  echo "Экспортируйте keyfile из Wander → сохраните как wallet.json в корне репо."
  echo "Не присылайте этот файл в чат."
  exit 1
fi

echo "Building SPA for ArNS (base ./ , publish mode self)…"
cd "$ROOT/apps/web"
if [[ ! -d node_modules/vite ]]; then
  echo "Installing apps/web dependencies…"
  npm install
fi
export VITE_PUBLISH_MODE="${VITE_PUBLISH_MODE:-self}"
npm run build
cd "$ROOT"

DIST="$ROOT/apps/web/dist"
if [[ ! -f "$DIST/index.html" ]]; then
  echo "Build failed: missing $DIST/index.html"
  exit 1
fi

SIZE=$(du -sh "$DIST" | awk '{print $1}')
echo "Uploading $DIST ($SIZE)…"
echo "ArNS не обновляем автоматически (имя sejire в Phantom)."

npx permaweb-deploy upload \
  --wallet "$WALLET" \
  --deploy-folder "$DIST" \
  --sig-type arweave

echo ""
echo "Готово. Скопируйте manifest / transaction id из вывода выше."
echo "Дальше: Phantom → arns.ar.io → sejire → Target ID = этот id → Save."
echo "Затем удалите wallet.json с диска."
