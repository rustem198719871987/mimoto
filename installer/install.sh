#!/usr/bin/env bash
# Установщик магазина MiMoto для Ubuntu 22.04/24.04 и Debian 12.
# Запуск на сервере от root:  bash mimoto-install.sh
# Без вопросов:  bash mimoto-install.sh --domain mimoto.ru --seed --autodeploy --yes
# Повторный запуск обновляет сайт; база, фото и .env сохраняются.
set -euo pipefail

INSTALL_DIR="${MIMOTO_DIR:-/opt/mimoto}"
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

# ---------- 1. Настройки ----------
if [ "$UPDATE" = 1 ]; then
  ok "Найдена установка в $INSTALL_DIR — обновляю сайт, настройки и данные сохраняются."
  DOMAIN=$(grep -E '^DOMAIN=' "$INSTALL_DIR/.env" | cut -d= -f2-)
else
  [ -n "$DOMAIN" ] || ask "Домен сайта (например, mimoto.ru)" DOMAIN
  DOMAIN=$(printf '%s' "$DOMAIN" | tr 'A-Z' 'a-z' | sed -E 's#^https?://##; s#/.*$##; s#^www\.##')
  printf '%s' "$DOMAIN" | grep -Eq '^([a-z0-9-]+\.)+[a-z]{2,}$|^([a-z0-9-]+\.)+xn--[a-z0-9-]+$' \
    || die "Домен «$DOMAIN» выглядит неверно. Для кириллических доменов укажите punycode (xn--...)."
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
  say "Проверяю, что домен указывает на этот сервер"
  MY_IP=$(curl -4fsS --max-time 8 https://ifconfig.me 2>/dev/null || curl -4fsS --max-time 8 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
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

# ---------- 3. Docker и защита сервера ----------
if [ "$TEST_MODE" != 1 ]; then
  export DEBIAN_FRONTEND=noninteractive
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
# Приёмник ставим через временный файл и mv: так не задеваем копию, которая сейчас, возможно, выполняется.
install -m 755 "$INSTALL_DIR/installer/deploy-receive.sh" /usr/local/sbin/.mimoto-deploy.new
mv -f /usr/local/sbin/.mimoto-deploy.new /usr/local/sbin/mimoto-deploy
if [ "$AUTODEPLOY" = yes ]; then
  KEY=/root/.ssh/mimoto_deploy AK=/root/.ssh/authorized_keys
  install -m 700 -d /root/.ssh; touch "$AK"; chmod 600 "$AK"
  [ -f "$KEY" ] || ssh-keygen -q -t ed25519 -N "" -C mimoto-github-deploy -f "$KEY"
  if ! grep -q 'mimoto-github-deploy' "$AK"; then
    printf 'command="/usr/local/sbin/mimoto-deploy",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty %s\n' "$(cat "$KEY.pub")" >>"$AK"
  fi
  HOST_IP="${MY_IP:-$(hostname -I | awk '{print $1}')}"
  {
    echo "Секреты для GitHub: репозиторий -> Settings -> Secrets and variables -> Actions -> New repository secret"
    echo; echo "=== SSH_HOST ==="; echo "$HOST_IP"
    echo; echo "=== SSH_KNOWN_HOSTS ==="
    for k in /etc/ssh/ssh_host_ed25519_key.pub /etc/ssh/ssh_host_ecdsa_key.pub /etc/ssh/ssh_host_rsa_key.pub; do
      [ -f "$k" ] && echo "$HOST_IP $(cut -d' ' -f1,2 "$k")"
    done
    echo; echo "=== SSH_PRIVATE_KEY ==="; cat "$KEY"
  } >/root/mimoto-github-secrets.txt
  chmod 600 /root/mimoto-github-secrets.txt
  ok "Автообновление включено. Ключ может только обновлять сайт и ничего другого на сервере не запустит."
fi

# ---------- Итог ----------
if [ "$UPDATE" != 1 ]; then
  printf 'Сайт: https://%s\nАдминка: https://%s/admin\nПароль: %s\n' "$DOMAIN" "$DOMAIN" "$ADMIN_PASSWORD" >/root/mimoto-admin.txt
  chmod 600 /root/mimoto-admin.txt
fi
printf '\n%s Готово! %s\n' "$G" "$N"
printf '  Сайт:     https://%s\n' "$DOMAIN"
printf '  Админка:  https://%s/admin\n' "$DOMAIN"
[ "$UPDATE" = 1 ] || printf '  Пароль:   %s   (сохранён в /root/mimoto-admin.txt)\n' "$ADMIN_PASSWORD"
if [ "$AUTODEPLOY" = yes ]; then
  printf '\n  Автообновление: покажите секреты командой  cat /root/mimoto-github-secrets.txt\n'
  printf '  и вставьте три значения в GitHub (инструкция в начале файла).\n'
fi
printf '\n  Если сайт не открывается по https сразу — подождите 1–2 минуты, пока выпускается сертификат.\n\n'
exit 0
__MIMOTO_PAYLOAD__
