#!/usr/bin/env bash
# Smoke test for ms-reviews. Usage: ./smoke-test.sh [base-url]
set -euo pipefail
BASE_URL="${1:-http://localhost:8083}"

echo "==> GET ${BASE_URL}/health"
curl -fsS --max-time 30 "${BASE_URL}/health" | grep -q '"service":"reviews"' \
  && echo "PASS: health" || { echo "FAIL: health"; exit 1; }

echo "==> GET ${BASE_URL}/ratings?ids=1"
BODY="$(curl -fsS --max-time 30 "${BASE_URL}/ratings?ids=1")"
echo "${BODY}" | grep -q '"avg":4.5' && echo "${BODY}" | grep -q '"count":128' \
  && echo "PASS: ratings lookup" || { echo "FAIL: ratings lookup"; exit 1; }

echo "All reviews smoke checks passed."
