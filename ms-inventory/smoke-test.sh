#!/usr/bin/env bash
# Smoke test for ms-inventory. Usage: ./smoke-test.sh [base-url]
set -euo pipefail
BASE_URL="${1:-http://localhost:8082}"

echo "==> GET ${BASE_URL}/health"
curl -fsS --max-time 30 "${BASE_URL}/health" | grep -q '"service":"inventory"' \
  && echo "PASS: health" || { echo "FAIL: health"; exit 1; }

echo "==> GET ${BASE_URL}/stock?ids=1,2"
BODY="$(curl -fsS --max-time 30 "${BASE_URL}/stock?ids=1,2")"
echo "${BODY}" | grep -q '"1":42' && echo "${BODY}" | grep -q '"2":0' \
  && echo "PASS: stock lookup" || { echo "FAIL: stock lookup"; exit 1; }

echo "All inventory smoke checks passed."
