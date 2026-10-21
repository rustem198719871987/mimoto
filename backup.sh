#!/bin/sh
# Резервная копия базы и фото: ./backup.sh  ->  backups/mimoto-ГГГГ-ММ-ДД_ЧЧММ.tar.gz
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
# Храним последние 30 копий
ls -1t backups/mimoto-*.tar.gz | tail -n +31 | xargs -r rm -f
echo "Готово: $OUT"
