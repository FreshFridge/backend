#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
TARGET_HOST="${TARGET_HOST:-http://localhost:3001}"
locust -f load-tests/locustfile.py --host "$TARGET_HOST" --headless -u 20 -r 2 -t 2m
