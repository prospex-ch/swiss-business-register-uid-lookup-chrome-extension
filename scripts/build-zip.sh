#!/usr/bin/env bash
# Packages the extension for upload to the Chrome Web Store: dist/<name>-<version>.zip
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION=$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")
OUT="dist/swiss-business-register-uid-lookup-${VERSION}.zip"
mkdir -p dist
rm -f "$OUT"
zip -qr "$OUT" manifest.json _locales icons/*.png src -x '*.DS_Store'
echo "$OUT"
