#!/usr/bin/env bash
# Smoke test for the plain-Java container.
# Usage: ./smoke-test.sh [base-url]   (default: http://localhost:8080)
set -euo pipefail

BASE_URL="${1:-http://localhost:8080}"

echo "==> GET ${BASE_URL}/"
GET_BODY="$(curl -fsS --connect-timeout 5 --max-time 30 "${BASE_URL}/")"
echo "${GET_BODY}"
if echo "${GET_BODY}" | grep -q '"runtime":"java-httpserver"'; then
  echo "PASS: GET / reports java-httpserver runtime"
else
  echo "FAIL: GET /"; exit 1
fi

echo
echo "==> POST ${BASE_URL}/echo"
POST_BODY="$(curl -fsS --connect-timeout 5 --max-time 30 -X POST "${BASE_URL}/echo" \
  -H 'Content-Type: application/json' -d '{"hello":"vercel","n":1}')"
echo "${POST_BODY}"
if echo "${POST_BODY}" | grep -q '"ok":true' && echo "${POST_BODY}" | grep -q 'hello'; then
  echo "PASS: POST /echo echoed the body"
else
  echo "FAIL: POST /echo"; exit 1
fi

echo
echo "All smoke checks passed."
