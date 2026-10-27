#!/usr/bin/env bash
# Run as root inside a dedicated Debian/Ubuntu systemd LXC, not on the Proxmox host.
# FRONTEND_ORIGIN=https://studio.example.com bash deploy/install.sh [PORT]
set -euo pipefail
fail() { echo "Error: $*" >&2; exit 1; }
PORT="${1:-8080}"
APP_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR=/opt/comfyui-film-studio
COMFY_URL="${COMFY_URL:-http://127.0.0.1:8188}"
[[ "$PORT" =~ ^[0-9]{1,5}$ ]] && ((10#$PORT > 0 && 10#$PORT <= 65535 && 10#$PORT != 8099)) || fail 'Choose a port from 1–65535 other than 8099.'
[[ "$(id -u)" = 0 ]] || fail 'Run as root inside the container.'
command -v apt-get >/dev/null || fail 'This installer supports Debian/Ubuntu.'
command -v systemctl >/dev/null || fail 'A systemd container is required.'
[[ "$COMFY_URL" =~ ^https?://[a-zA-Z0-9.-]+(:[0-9]+)?$ ]] || fail 'COMFY_URL must be an HTTP(S) server origin without a trailing slash.'
STUDIO_IP="$(hostname -I | awk '{print $1}')"
FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-http://${STUDIO_IP}:${PORT}}"
[[ "$FRONTEND_ORIGIN" =~ ^https?://[a-zA-Z0-9.-]+(:[0-9]+)?$ ]] || fail 'Set FRONTEND_ORIGIN to the exact browser origin, without a path or trailing slash.'
[[ -f "$APP_SRC/studio-server.py" && -f "$APP_SRC/deploy/nginx-site.conf" ]] || fail 'The complete app package is required.'
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y python3 ffmpeg nginx rsync curl
if ! id comfyui-studio >/dev/null 2>&1; then
    useradd --system --no-create-home --shell /usr/sbin/nologin comfyui-studio
fi
mkdir -p "$APP_DIR"
if [[ "$APP_SRC" != "$APP_DIR" ]]; then
    rsync -a --exclude artifacts/ --exclude __pycache__/ --exclude .git/ --exclude .env --exclude shared-productions.json --exclude COMFY-MODEL-CATALOG.md --exclude node_modules/ --exclude workflows/local/ "$APP_SRC/" "$APP_DIR/"
fi
# The service needs read access; browser projects are not written here.
find "$APP_DIR" -type d -not -path "*/.git/*" -exec chmod a+rx {} +
find "$APP_DIR" -maxdepth 1 -type f \( -name "*.js" -o -name "*.css" -o -name "index.html" -o -name "studio-server.py" \) -exec chmod a+r {} +
cat > /etc/systemd/system/comfyui-studio.service <<SERVICE
[Unit]
Description=Remn@nt AI Studio and local API relay
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=comfyui-studio
Group=comfyui-studio
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/python3 $APP_DIR/studio-server.py --port 8099 --comfy-url $COMFY_URL
Environment=PYTHONUNBUFFERED=1
Environment=STUDIO_SETTINGS_FILE=/var/lib/comfyui-studio/settings.json
StateDirectory=comfyui-studio
StateDirectoryMode=0700
Restart=on-failure
RestartSec=5
PrivateTmp=true
NoNewPrivileges=true
UMask=0077

[Install]
WantedBy=multi-user.target
SERVICE
sed -e "s|{PORT}|$PORT|g" -e "s|{FRONTEND_ORIGIN}|$FRONTEND_ORIGIN|g" \
    "$APP_DIR/deploy/nginx-site.conf" > /etc/nginx/sites-available/comfyui-prompt-generator
ln -sfn /etc/nginx/sites-available/comfyui-prompt-generator /etc/nginx/sites-enabled/comfyui-prompt-generator
nginx -t
systemctl daemon-reload
systemctl enable --now comfyui-studio
# Reinstalling applies backend settings and clears temporary finishing files.
systemctl restart comfyui-studio
systemctl enable --now nginx
systemctl reload nginx
for attempt in {1..10}; do
    if curl --fail --silent http://127.0.0.1:8099/ >/dev/null; then break; fi
    sleep 1
done
curl --fail --silent http://127.0.0.1:8099/ >/dev/null || fail 'Studio failed to start; inspect journalctl -u comfyui-studio.'
echo "Installed in $APP_DIR; nginx listens on $PORT."
echo "Configured browser origin: $FRONTEND_ORIGIN"
echo 'If this is HTTPS, configure your TLS reverse proxy before opening that URL.'
echo 'Export browser projects and download finished movies before upgrading/restarting.'
