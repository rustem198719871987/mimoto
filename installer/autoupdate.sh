#!/usr/bin/env bash
# Автообновление сайта: раз в 5 минут (cron) проверяет, опубликовал ли GitHub новый установщик,
# и если да — скачивает его и обновляет сайт. Установщик публикуется только после прохождения тестов.
# Журнал: /var/log/mimoto-update.log
set -euo pipefail

REPO=$(cat /etc/mimoto-repo 2>/dev/null || true)
[ -n "$REPO" ] || exit 0
STATE=/var/lib/mimoto/installer-version

exec 9>/var/lock/mimoto-deploy.lock
flock -n 9 || exit 0   # обновление уже идёт

# Версия = время загрузки файла установщика в релиз «installer»
INFO=$(curl -fsS --max-time 20 -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$REPO/releases/tags/installer") || exit 0
VER=$(printf '%s' "$INFO" | grep -o '"updated_at": *"[^"]*"' | tail -1 | cut -d'"' -f4)
[ -n "$VER" ] || exit 0

mkdir -p "$(dirname "$STATE")"
if [ ! -s "$STATE" ]; then
  # Первый запуск после ручной установки: сайт уже свежий, просто запоминаем версию
  echo "$VER" >"$STATE"; exit 0
fi
[ "$VER" = "$(cat "$STATE")" ] && exit 0

TMP=$(mktemp /tmp/mimoto-update.XXXXXX)
trap 'rm -f "$TMP"' EXIT
curl -fsSL --max-time 300 -o "$TMP" "https://github.com/$REPO/releases/download/installer/mimoto-install.sh"
head -n1 "$TMP" | grep -q '^#!/usr/bin/env bash' && grep -q '^__MIMOTO_PAYLOAD__$' "$TMP" \
  || { echo "$(date '+%F %T') скачан не установщик MiMoto — пропускаю"; exit 1; }

echo "$(date '+%F %T') обновляю сайт до версии $VER"
bash "$TMP" --yes
echo "$VER" >"$STATE"
echo "$(date '+%F %T') готово"
