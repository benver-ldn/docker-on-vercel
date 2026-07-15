#!/usr/bin/env bash
# Smoke test for ms-gateway. Usage: ./smoke-test.sh [base-url]
set -euo pipefail
BASE_URL="${1:-http://localhost:8080}"

echo "==> GET ${BASE_URL}/health"
curl -fsS --max-time 30 "${BASE_URL}/health" | grep -q '"service":"gateway"' \
  && echo "PASS: health" || { echo "FAIL: health"; exit 1; }

echo "==> GET ${BASE_URL}/api/search?q=headphones"
BODY="$(curl -fsS --max-time 30 "${BASE_URL}/api/search?q=headphones")"
echo "${BODY}"
echo "${BODY}" | grep -q 'Wireless Headphones' \
  && echo "${BODY}" | grep -q '"stock":42' \
  && echo "${BODY}" | grep -q '"avg":4.5' \
  && echo "PASS: aggregated search" || { echo "FAIL: aggregated search"; exit 1; }

echo "==> GET ${BASE_URL}/api/product/1"
P1="$(curl -fsS --max-time 30 "${BASE_URL}/api/product/1")"
echo "${P1}"
echo "${P1}" | grep -q '"id":1' && echo "${P1}" | grep -q '"stock":42' \
  && echo "PASS: product by id" || { echo "FAIL: product by id"; exit 1; }

echo "==> GET ${BASE_URL}/api/product/999 (expect 404)"
CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "${BASE_URL}/api/product/999")"
[ "${CODE}" = "404" ] && echo "PASS: unknown product 404" || { echo "FAIL: expected 404, got ${CODE}"; exit 1; }

echo "All gateway smoke checks passed."
