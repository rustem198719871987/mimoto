#!/usr/bin/env bash
# Установщик магазина MiMoto для Ubuntu 22.04/24.04 и Debian 12.
# Запуск на сервере от root:  bash mimoto-install.sh
# Без вопросов:  bash mimoto-install.sh --domain mimoto.ru --seed --autodeploy --yes
# Повторный запуск обновляет сайт; база, фото и .env сохраняются.
# Без домена сайт работает по IP (http://IP). Подключить домен позже:  bash mimoto-install.sh --domain mimoto.ru --yes
set -euo pipefail

INSTALL_DIR="${MIMOTO_DIR:-/opt/mimoto}"
# Репозиторий GitHub, откуда брать обновления; подставляется при сборке (installer/build.sh)
MIMOTO_REPO="${MIMOTO_REPO:-__MIMOTO_REPO__}"
case "$MIMOTO_REPO" in *__*) MIMOTO_REPO="" ;; esac
TEST_MODE="${MIMOTO_TEST:-0}"   # 1 = только распаковка и настройки, без apt/Docker (для проверки)

DOMAIN="" ADMIN_PASSWORD="" SEED="" ASSUME_YES=0 AUTODEPLOY=""
while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --password) ADMIN_PASSWORD="$2"; shift 2 ;;
    --seed) SEED=yes; shift ;;
    --no-seed) SEED=no; shift ;;
    --autodeploy) AUTODEPLOY=yes; shift ;;
    --no-autodeploy) AUTODEPLOY=no; shift ;;
    --yes|-y) ASSUME_YES=1; shift ;;
    -h|--help) sed -n '2,6p' "$0"; exit 0 ;;
    *) echo "Неизвестный параметр: $1" >&2; exit 1 ;;
  esac
done

Y=$'\033[1;33m' G=$'\033[1;32m' R=$'\033[1;31m' N=$'\033[0m'
say()  { printf '%s▶ %s%s\n' "$Y" "$*" "$N"; }
ok()   { printf '%s✓ %s%s\n' "$G" "$*" "$N"; }
warn() { printf '%s! %s%s\n' "$R" "$*" "$N"; }
die()  { printf '%s✗ %s%s\n' "$R" "$*" "$N" >&2; exit 1; }
ask()  { # ask "Вопрос" ПЕРЕМЕННАЯ [по умолчанию]
  local q="$1" var="$2" def="${3:-}" ans=""
  if [ "$ASSUME_YES" = 1 ] || [ ! -r /dev/tty ]; then printf -v "$var" '%s' "$def"; return; fi
  read -r -p "$q${def:+ [$def]}: " ans </dev/tty || true
  printf -v "$var" '%s' "${ans:-$def}"
}
rand() { tr -dc "$1" </dev/urandom | head -c "$2" || true; }

printf '\n%s MiMoto — установка интернет-магазина %s\n\n' "$Y" "$N"

if [ "$TEST_MODE" != 1 ]; then
  [ "$(id -u)" = 0 ] || die "Запустите от root: sudo bash $0"
  command -v apt-get >/dev/null || die "Нужен Ubuntu или Debian (нет apt-get)."
fi

UPDATE=0
[ -f "$INSTALL_DIR/.env" ] && UPDATE=1

# Домен приводим к виду mimoto.ru; пустой домен = сайт по IP без HTTPS
check_domain() {
  DOMAIN=$(printf '%s' "$DOMAIN" | tr 'A-Z' 'a-z' | sed -E 's#^https?://##; s#/.*$##; s#^www\.##')
  [ -z "$DOMAIN" ] && return 0
  printf '%s' "$DOMAIN" | grep -Eq '^([a-z0-9-]+\.)+[a-z]{2,}$|^([a-z0-9-]+\.)+xn--[a-z0-9-]+$' \
    || die "Домен «$DOMAIN» выглядит неверно. Для кириллических доменов укажите punycode (xn--...)."
}
site_address() { if [ -n "$DOMAIN" ]; then printf '%s, www.%s' "$DOMAIN" "$DOMAIN"; else printf ':80'; fi; }

# ---------- 1. Настройки ----------
if [ "$UPDATE" = 1 ]; then
  ok "Найдена установка в $INSTALL_DIR — обновляю сайт, настройки и данные сохраняются."
  # автообновление остаётся включённым, если было включено (в том числе старым способом через SSH-ключ)
  if [ -z "$AUTODEPLOY" ] && { [ -f /etc/cron.d/mimoto-autoupdate ] || grep -qs 'mimoto-github-deploy' /root/.ssh/authorized_keys; }; then
    AUTODEPLOY=yes
  fi
  if [ -n "$DOMAIN" ]; then
    check_domain
    sed -i -E "/^(DOMAIN|SITE_ADDRESS)=/d" "$INSTALL_DIR/.env"
    printf 'DOMAIN=%s\nSITE_ADDRESS="%s"\n' "$DOMAIN" "$(site_address)" >>"$INSTALL_DIR/.env"
    ok "Подключаю домен $DOMAIN"
  else
    DOMAIN=$(grep -E '^DOMAIN=' "$INSTALL_DIR/.env" | cut -d= -f2- | tr -d '"')
    grep -q '^SITE_ADDRESS=' "$INSTALL_DIR/.env" || printf 'SITE_ADDRESS="%s"\n' "$(site_address)" >>"$INSTALL_DIR/.env"
  fi
else
  [ -n "$DOMAIN" ] || ask "Домен сайта, например mimoto.ru (Enter — пока без домена, сайт откроется по IP)" DOMAIN ""
  check_domain
  if [ -z "$ADMIN_PASSWORD" ]; then
    ask "Пароль для админки (Enter — сгенерировать)" ADMIN_PASSWORD ""
    [ -n "$ADMIN_PASSWORD" ] || ADMIN_PASSWORD="$(rand 'A-HJ-NP-Za-km-z2-9' 16)"
  fi
  [ ${#ADMIN_PASSWORD} -ge 10 ] || die "Пароль админки должен быть не короче 10 символов."
  [ -n "$SEED" ] || { ask "Добавить 20 примеров товаров? (y/n)" SEED "n"; }
  [ -n "$AUTODEPLOY" ] || { ask "Включить автообновление сайта из GitHub? (y/n)" AUTODEPLOY "y"; }
fi
case "$SEED" in y|Y|yes|д|Д|да) SEED=yes ;; *) SEED=no ;; esac
case "$AUTODEPLOY" in y|Y|yes|д|Д|да) AUTODEPLOY=yes ;; *) AUTODEPLOY=no ;; esac

# ---------- 2. Проверка DNS ----------
if [ "$TEST_MODE" != 1 ]; then
  MY_IP=$(curl -4fsS --max-time 8 https://ifconfig.me 2>/dev/null || curl -4fsS --max-time 8 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
fi
if [ "$TEST_MODE" != 1 ] && [ -n "$DOMAIN" ]; then
  say "Проверяю, что домен указывает на этот сервер"
  DNS_IP=$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk 'NR==1{print $1}')
  if [ -z "$DNS_IP" ]; then
    warn "Домен $DOMAIN пока никуда не указывает. Добавьте A-запись $DOMAIN → $MY_IP (и www → $MY_IP)."
    warn "Сайт запустится, а HTTPS-сертификат появится сам, как только запись заработает."
  elif [ "$DNS_IP" != "$MY_IP" ]; then
    warn "Домен $DOMAIN указывает на $DNS_IP, а у этого сервера IP $MY_IP. Исправьте A-запись у регистратора."
  else
    ok "DNS в порядке: $DOMAIN → $MY_IP"
  fi
fi

# ---------- 3. Подкачка, Docker и защита сервера ----------
if [ "$TEST_MODE" != 1 ]; then
  export DEBIAN_FRONTEND=noninteractive
  # На серверах с 1 ГБ памяти сборке Docker может не хватить памяти — добавляем файл подкачки 2 ГБ
  MEM_MB=$(awk '/MemTotal/{print int($2/1024)}' /proc/meminfo)
  if [ "$MEM_MB" -lt 1900 ] && [ -z "$(swapon --noheadings 2>/dev/null)" ]; then
    say "Памяти ${MEM_MB} МБ — добавляю файл подкачки 2 ГБ"
    fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
    chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
    grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
    echo 'vm.swappiness=10' >/etc/sysctl.d/99-mimoto.conf && sysctl -q -p /etc/sysctl.d/99-mimoto.conf
    ok "Подкачка включена"
  fi
  FREE_GB=$(df -BG --output=avail / | tail -1 | tr -dc '0-9')
  [ "${FREE_GB:-0}" -ge 3 ] || warn "На диске свободно всего ${FREE_GB} ГБ — для установки нужно хотя бы 3 ГБ."
  if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
    say "Устанавливаю Docker (2–3 минуты)"
    apt-get update -qq && apt-get install -y -qq curl ca-certificates >/dev/null
    curl -fsSL https://get.docker.com | sh >/dev/null
    systemctl enable --now docker >/dev/null 2>&1 || true
  fi
  docker compose version >/dev/null 2>&1 || die "Docker Compose не установился. Пришлите вывод команды: docker compose version"
  ok "Docker готов"

  say "Настраиваю брандмауэр: открыты только SSH, 80 и 443"
  command -v ufw >/dev/null || apt-get install -y -qq ufw >/dev/null
  ufw allow OpenSSH >/dev/null && ufw allow 80/tcp >/dev/null && ufw allow 443 >/dev/null
  ufw --force enable >/dev/null
  ok "Брандмауэр включён"
fi

# ---------- 4. Файлы сайта ----------
say "Распаковываю сайт в $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
LINE=$(awk '/^__MIMOTO_PAYLOAD__$/{print NR+1; exit}' "$0")
[ -n "$LINE" ] || die "Файл установщика повреждён: нет архива внутри. Скачайте его заново."
tail -n +"$LINE" "$0" | base64 -d | tar -xz -C "$INSTALL_DIR" --strip-components=1 --no-same-owner
chmod +x "$INSTALL_DIR/backup.sh"
ok "Файлы на месте"

if [ "$UPDATE" != 1 ]; then
  umask 077
  cat >"$INSTALL_DIR/.env" <<EOF
DOMAIN=$DOMAIN
SITE_ADDRESS="$(site_address)"
ADMIN_PASSWORD=$ADMIN_PASSWORD
SESSION_SECRET=$(rand 'a-f0-9' 64)
EOF
  umask 022
  ok "Настройки сохранены в $INSTALL_DIR/.env"
fi

if [ "$TEST_MODE" = 1 ]; then ok "Тестовый режим: Docker не запускаю."; exit 0; fi

# ---------- 5. Запуск ----------
say "Собираю и запускаю сайт (первый раз 2–4 минуты)"
cd "$INSTALL_DIR"
docker compose up -d --build --remove-orphans
docker image prune -f >/dev/null 2>&1 || true   # старые версии образа после обновления занимают место
say "Жду, пока сервер ответит"
for _ in $(seq 1 60); do
  if docker compose exec -T shop wget -qO- http://127.0.0.1:3000/api/products >/dev/null 2>&1; then READY=1; break; fi
  sleep 2
done
[ "${READY:-0}" = 1 ] || die "Сервер не запустился. Журнал: cd $INSTALL_DIR && docker compose logs shop"
ok "Сайт работает"

if [ "$SEED" = yes ]; then docker compose exec -T shop npm run -s seed || warn "Не удалось добавить примеры товаров."; fi

# ---------- 6. Ежедневные резервные копии ----------
cat >/etc/cron.d/mimoto-backup <<EOF
# Резервная копия базы и фото MiMoto каждый день в 03:15
15 3 * * * root cd $INSTALL_DIR && ./backup.sh >/var/log/mimoto-backup.log 2>&1
EOF
ok "Резервные копии: каждый день в 03:15 в $INSTALL_DIR/backups"

# ---------- 7. Автообновление из GitHub ----------
# Сервер сам раз в 5 минут проверяет релиз «installer» в GitHub и ставит новую версию.
# Ключи и секреты не нужны: репозиторий публичный, установщик публикуется только после тестов.
if [ "$AUTODEPLOY" = yes ] && [ -n "$MIMOTO_REPO" ]; then
  echo "$MIMOTO_REPO" >/etc/mimoto-repo
  # через временный файл и mv: не задеваем копию, которая сейчас, возможно, выполняется
  install -m 755 "$INSTALL_DIR/installer/autoupdate.sh" /usr/local/sbin/.mimoto-autoupdate.new
  mv -f /usr/local/sbin/.mimoto-autoupdate.new /usr/local/sbin/mimoto-autoupdate
  cat >/etc/cron.d/mimoto-autoupdate <<EOF
# Проверка новой версии сайта MiMoto на GitHub каждые 5 минут
*/5 * * * * root /usr/local/sbin/mimoto-autoupdate >>/var/log/mimoto-update.log 2>&1
EOF
  ok "Автообновление включено: сервер сам проверяет GitHub ($MIMOTO_REPO) каждые 5 минут"
elif [ "$AUTODEPLOY" = yes ]; then
  warn "Не знаю адрес репозитория GitHub — автообновление не включено. Скачайте установщик из GitHub."
fi
# Старый способ выкладки по SSH-ключу больше не используется — убираем ключ, если он был
if [ -f /root/.ssh/authorized_keys ] && grep -q 'mimoto-github-deploy' /root/.ssh/authorized_keys; then
  sed -i '/mimoto-github-deploy/d' /root/.ssh/authorized_keys
  rm -f /root/.ssh/mimoto_deploy /root/.ssh/mimoto_deploy.pub /root/mimoto-github-secrets.txt /usr/local/sbin/mimoto-deploy
fi

# ---------- Итог ----------
if [ -n "$DOMAIN" ]; then SITE="https://$DOMAIN"; else SITE="http://${MY_IP:-IP_сервера}"; fi
if [ "$UPDATE" != 1 ]; then
  printf 'Сайт: %s\nАдминка: %s/admin\nПароль: %s\n' "$SITE" "$SITE" "$ADMIN_PASSWORD" >/root/mimoto-admin.txt
  chmod 600 /root/mimoto-admin.txt
fi
printf '\n%s Готово! %s\n' "$G" "$N"
printf '  Сайт:     %s\n' "$SITE"
printf '  Админка:  %s/admin\n' "$SITE"
[ "$UPDATE" = 1 ] || printf '  Пароль:   %s   (сохранён в /root/mimoto-admin.txt)\n' "$ADMIN_PASSWORD"
if [ -f /etc/cron.d/mimoto-autoupdate ]; then
  printf '\n  Автообновление включено: изменения из GitHub появятся на сайте в течение ~10 минут.\n'
  printf '  Журнал обновлений: tail /var/log/mimoto-update.log\n'
fi
if [ -n "$DOMAIN" ]; then
  printf '\n  Если сайт не открывается по https сразу — подождите 1–2 минуты, пока выпускается сертификат.\n\n'
else
  printf '\n  Сайт работает без домена и без HTTPS. Когда купите домен и направите его на %s, выполните:\n' "${MY_IP:-IP сервера}"
  printf '    bash %s --domain ваш-домен.ru --yes\n\n' "$0"
fi
exit 0
__MIMOTO_PAYLOAD__
