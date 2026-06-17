#!/bin/sh
set -eu

SYSTEM_URL_ESCAPED=$(printf '%s' "${LANDING_SYSTEM_URL:-}" | sed "s/'/\\\\'/g")

cat > /usr/share/nginx/html/landing-config.js <<EOF
window.__KORVI_LANDING_CONFIG__ = {
  systemUrl: '${SYSTEM_URL_ESCAPED}'
};
EOF
