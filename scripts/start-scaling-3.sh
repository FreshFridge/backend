#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
docker compose -f docker-compose.scaling.yml up --build -d --scale backend=3
docker compose -f docker-compose.scaling.yml restart nginx
docker compose -f docker-compose.scaling.yml ps
