#!/usr/bin/env bash
# Deploy apps/web/dist to origin/gh-pages (GitHub Pages for this repo).
# Preserves /presentation from the previous gh-pages tip when present in the repo.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/web"
# Pages mirror: demo mode so versioned save is testable without Worker/AR.
# Override with VITE_PUBLISH_MODE=self|sponsor when deploying a production build.
export VITE_PUBLISH_MODE="${VITE_PUBLISH_MODE:-demo}"
echo "Building Pages with VITE_PUBLISH_MODE=${VITE_PUBLISH_MODE}"
npm run build
STAGE=$(mktemp -d)
cp -R dist/. "$STAGE/"
touch "$STAGE/.nojekyll"

# Keep investor deck / presentation if it exists in the working tree
if [[ -d "$ROOT/presentation" ]]; then
  mkdir -p "$STAGE/presentation"
  cp -a "$ROOT/presentation/." "$STAGE/presentation/"
fi

cd "$STAGE"
git init -b gh-pages
git config user.email "sejire-deploy@users.noreply.github.com"
git config user.name "SEJIRE Deploy"
git add -A
git commit -m "Deploy SEJIRE Pages $(date -u +%Y-%m-%dT%H:%MZ)"
git remote add origin "$(git -C "$ROOT" remote get-url origin)"
git push -f origin gh-pages
echo "Published: https://azovskaya.github.io/Sejire_arweave/"
