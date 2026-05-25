#!/usr/bin/env sh
set -eu
URL="${1:-http://localhost:3001}"
echo "Checking backend instances through $URL/health"

i=1
while [ "$i" -le 12 ]; do
  headers_file="$(mktemp)"
  body="$(curl -s -D "$headers_file" "$URL/health")"
  header="$(grep -i '^X-Backend-Instance:' "$headers_file" | tr -d '\r' | cut -d' ' -f2- || true)"
  instance="$(printf '%s' "$body" | sed -n 's/.*"instanceId": "\([^"]*\)".*/\1/p')"
  hostname="$(printf '%s' "$body" | sed -n 's/.*"hostname": "\([^"]*\)".*/\1/p')"
  rm -f "$headers_file"
  echo "Request $i -> header=$header; body=$instance; host=$hostname"
  i=$((i + 1))
  sleep 1
done
