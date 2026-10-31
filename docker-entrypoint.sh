#!/bin/sh
set -e

case "${1:-http}" in
  http)
    exec node /app/dist/http.js
    ;;
  stdio)
    exec node /app/dist/stdio.js
    ;;
  *)
    exec "$@"
    ;;
esac
