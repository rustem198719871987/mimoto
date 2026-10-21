#!/usr/bin/env bash
# Собирает один файл-установщик dist/mimoto-install.sh: скрипт + весь сайт внутри.
# Запуск из корня проекта: ./installer/build.sh
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist
OUT=dist/mimoto-install.sh
NAME=$(basename "$PWD")
# Репозиторий для автообновления: в GitHub Actions — из GITHUB_REPOSITORY, локально — из git remote
REPO="${GITHUB_REPOSITORY:-$(git remote get-url origin 2>/dev/null | sed -E 's#^.*github\.com[:/]##; s#\.git$##')}"
sed "s#__MIMOTO_REPO__#${REPO:-__MIMOTO_REPO__}#" installer/install.sh >"$OUT"
tar -czf - -C .. \
  --exclude="$NAME/node_modules" --exclude="$NAME/data" --exclude="$NAME/dist" \
  --exclude="$NAME/backups" --exclude="$NAME/.env" --exclude="$NAME/*.zip" --exclude="$NAME/mimoto-install.sh" --exclude="$NAME/.git" \
  "$NAME" | base64 >>"$OUT"
chmod +x "$OUT"
echo "Готово: $OUT ($(du -h "$OUT" | cut -f1))"
