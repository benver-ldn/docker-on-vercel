#!/usr/bin/env bash
# Smoke test for the Spring Boot container.
# Usage: ./smoke-test.sh [base-url]   (default: http://localhost:8080)
set -euo pipefail

BASE_URL="${1:-http://localhost:8080}"

echo "==> GET ${BASE_URL}/"
GET_BODY="$(curl -fsS --connect-timeout 5 --max-time 30 "${BASE_URL}/")"
echo "${GET_BODY}"
if echo "${GET_BODY}" | grep -q '"runtime":"spring-boot"'; then
  echo "PASS: GET / reports spring-boot runtime"
else
  echo "FAIL: GET / did not report spring-boot runtime"; exit 1
fi

echo
echo "==> POST ${BASE_URL}/echo"
POST_BODY="$(curl -fsS --connect-timeout 5 --max-time 30 -X POST "${BASE_URL}/echo" \
  -H 'Content-Type: application/json' \
  -d '{"hello":"vercel","n":1}')"
echo "${POST_BODY}"
if echo "${POST_BODY}" | grep -q '"hello":"vercel"' && echo "${POST_BODY}" | grep -q '"ok":true'; then
  echo "PASS: POST /echo echoed the body"
else
  echo "FAIL: POST /echo did not echo the body"; exit 1
fi

echo
echo "All smoke checks passed."
