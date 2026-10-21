#!/usr/bin/env bash
# Приёмник автообновлений. Ключ GitHub Actions в authorized_keys может запускать ТОЛЬКО этот скрипт:
# он принимает новый установщик через stdin и запускает его в режиме обновления.
set -euo pipefail
exec 9>/var/lock/mimoto-deploy.lock
flock -n 9 || { echo "Обновление уже идёт, попробуйте позже." >&2; exit 75; }

TMP=$(mktemp /tmp/mimoto-update.XXXXXX)
trap 'rm -f "$TMP"' EXIT
head -c 50000000 >"$TMP"   # не больше 50 МБ

head -n1 "$TMP" | grep -q '^#!/usr/bin/env bash' && grep -q '^__MIMOTO_PAYLOAD__$' "$TMP" \
  || { echo "Получен не установщик MiMoto — обновление отменено." >&2; exit 65; }

echo "Обновление MiMoto: $(date '+%Y-%m-%d %H:%M:%S')"
bash "$TMP" --yes
