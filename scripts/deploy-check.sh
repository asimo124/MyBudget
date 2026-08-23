#!/usr/bin/env bash
# Quick check that SPA deep links work on production (returns HTTP 200, not Apache 404).
set -euo pipefail

BASE_URL="${1:-https://mybudget.hawleywebdesign.com}"
PATHS=("/" "/loan-countdown" "/bills-admin" "/login")

echo "Checking $BASE_URL ..."
failed=0
for path in "${PATHS[@]}"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}${path}")
  if [[ "$code" == "200" ]]; then
    echo "  OK  $path -> $code"
  else
    echo "  FAIL $path -> $code (expected 200 for SPA shell)"
    failed=1
  fi
done

if [[ "$failed" -ne 0 ]]; then
  echo
  echo "Deep links are broken on the server."
  echo "1) Upload .htaccess: scp dist/.htaccess user@server:/var/www/mybudget/"
  echo "2) Or add FallbackResource /index.html in the Apache vhost (see deploy/apache-mybudget.conf.example)"
  exit 1
fi

echo "All checks passed."
