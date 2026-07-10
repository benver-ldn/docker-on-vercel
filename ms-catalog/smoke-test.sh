#!/usr/bin/env bash
# Smoke test for ms-catalog. Usage: ./smoke-test.sh [base-url]
set -euo pipefail
BASE_URL="${1:-http://localhost:8081}"

echo "==> GET ${BASE_URL}/health"
curl -fsS --max-time 30 "${BASE_URL}/health" | grep -q '"service":"catalog"' \
  && echo "PASS: health" || { echo "FAIL: health"; exit 1; }

echo "==> GET ${BASE_URL}/products?q=keyboard"
curl -fsS --max-time 30 "${BASE_URL}/products?q=keyboard" | grep -q 'Mechanical Keyboard' \
  && echo "PASS: search by q" || { echo "FAIL: search by q"; exit 1; }

echo "==> GET ${BASE_URL}/products?category=Sports"
BODY="$(curl -fsS --max-time 30 "${BASE_URL}/products?category=Sports")"
echo "${BODY}" | grep -q 'Yoga Mat' && ! echo "${BODY}" | grep -q 'Mechanical Keyboard' \
  && echo "PASS: filter by category" || { echo "FAIL: filter by category"; exit 1; }

echo "All catalog smoke checks passed."
