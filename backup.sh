#!/bin/sh
# Резервная копия базы и фото: ./backup.sh  ->  backups/mimoto-ГГГГ-ММ-ДД_ЧЧММ.tar.gz (хранятся последние 7)
# Ежедневная копия в 03:15 — добавьте строку в crontab (команда crontab -e):
#   15 3 * * * cd /opt/mimoto && ./backup.sh >/dev/null 2>&1
set -e
cd "$(dirname "$0")"
mkdir -p backups
STAMP=$(date +%Y-%m-%d_%H%M)
OUT="backups/mimoto-$STAMP.tar.gz"
# Согласованный снимок базы средствами SQLite — можно делать, пока сайт работает
docker compose exec -T shop node --disable-warning=ExperimentalWarning -e "
const {DatabaseSync}=require('node:sqlite');
new DatabaseSync('/app/data/shop.db').exec(\"VACUUM INTO '/tmp/shop.db'\");"
docker compose exec -T shop tar -czf - -C /tmp shop.db -C /app/data uploads > "$OUT"
docker compose exec -T shop rm -f /tmp/shop.db
# Храним последние 7 копий: на маленьком диске фото в копиях быстро занимают место
ls -1t backups/mimoto-*.tar.gz | tail -n +8 | xargs -r rm -f
USED=$(df --output=pcent . | tail -1 | tr -dc '0-9')
[ "${USED:-0}" -lt 85 ] || echo "ВНИМАНИЕ: диск заполнен на ${USED}%. Скачайте старые копии из backups/ к себе и удалите их с сервера."
echo "Готово: $OUT"
