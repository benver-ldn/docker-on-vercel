#!/usr/bin/env bash
# Smoke test for the Next.js container.
# Usage: ./smoke-test.sh [base-url]   (default: http://localhost:8080)
set -euo pipefail

BASE_URL="${1:-http://localhost:8080}"

echo "==> GET ${BASE_URL}/"
PAGE="$(curl -fsS --connect-timeout 5 --max-time 30 "${BASE_URL}/")"
if echo "${PAGE}" | grep -qi "Next.js"; then
  echo "PASS: home page rendered"
else
  echo "FAIL: home page missing 'Next.js' marker"; exit 1
fi

echo
echo "==> GET ${BASE_URL}/api/echo"
API="$(curl -fsS --connect-timeout 5 --max-time 30 "${BASE_URL}/api/echo")"
echo "${API}"
if echo "${API}" | grep -q '"runtime":"nextjs"'; then
  echo "PASS: GET /api/echo reports nextjs runtime"
else
  echo "FAIL: GET /api/echo"; exit 1
fi

echo
echo "==> POST ${BASE_URL}/api/echo"
POST="$(curl -fsS --connect-timeout 5 --max-time 30 -X POST "${BASE_URL}/api/echo" \
  -H 'Content-Type: application/json' -d '{"hello":"vercel","n":1}')"
echo "${POST}"
if echo "${POST}" | grep -q '"hello":"vercel"' && echo "${POST}" | grep -q '"ok":true'; then
  echo "PASS: POST /api/echo echoed the body"
else
  echo "FAIL: POST /api/echo"; exit 1
fi

echo
echo "All smoke checks passed."
