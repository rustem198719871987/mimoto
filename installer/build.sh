#!/usr/bin/env bash
# Собирает один файл-установщик dist/mimoto-install.sh: скрипт + весь сайт внутри.
# Запуск из корня проекта: ./installer/build.sh
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist
OUT=dist/mimoto-install.sh
NAME=$(basename "$PWD")
cp installer/install.sh "$OUT"
tar -czf - -C .. \
  --exclude="$NAME/node_modules" --exclude="$NAME/data" --exclude="$NAME/dist" \
  --exclude="$NAME/backups" --exclude="$NAME/.env" --exclude="$NAME/*.zip" --exclude="$NAME/mimoto-install.sh" --exclude="$NAME/.git" \
  "$NAME" | base64 >>"$OUT"
chmod +x "$OUT"
echo "Готово: $OUT ($(du -h "$OUT" | cut -f1))"
