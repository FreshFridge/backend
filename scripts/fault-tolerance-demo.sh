#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
URL="${URL:-http://localhost:3001}"
echo "Current containers:"
docker compose -f docker-compose.scaling.yml ps
echo "Health before stopping one backend:"
curl -s "$URL/health"
echo
echo "Stopping freshfridge-scaling-backend-1"
docker stop freshfridge-scaling-backend-1
echo "Health after stopping one backend:"
curl -s "$URL/health"
echo
echo "Restoring backend scale to 3"
docker start freshfridge-scaling-backend-1
docker restart freshfridge-scaling-nginx-1
docker ps --filter "name=freshfridge-scaling"
