#!/bin/sh
set -eu

cat <<EOF >/usr/share/nginx/html/env.js
window.__ENV = {
  VITE_SUPABASE_URL: "${VITE_SUPABASE_URL:-}",
  VITE_SUPABASE_PUBLISHABLE_KEY: "${VITE_SUPABASE_PUBLISHABLE_KEY:-}"
};
EOF
