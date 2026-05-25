# FreshFridge Load Tests

Locust tests target the Nginx load balancer address, not an individual backend container.

## Environment

Set one of these auth options:

- `AUTH_TOKEN` - ready Bearer token for protected endpoints.
- `LOGIN_EMAIL` and `LOGIN_PASSWORD` - Locust logs in and reuses the returned access token.
- `IOT_API_KEY` - optional device key for `/api/iot/telemetry`.

Optional:

- `FRIDGE_ID` or `IOT_FRIDGE_ID` - fridge used for telemetry payloads.

## Run

Install Locust locally:

```bash
pip install locust
```

Run the web UI:

```bash
locust -f load-tests/locustfile.py --host http://localhost:3001
```

Run headless:

```bash
locust -f load-tests/locustfile.py --host http://localhost:3001 --headless -u 50 -r 5 -t 2m
```

Ready profiles from the backend repository root:

```bat
scripts\loadtest-low.bat
scripts\loadtest-medium.bat
scripts\loadtest-high.bat
```

```bash
sh scripts/loadtest-low.sh
sh scripts/loadtest-medium.sh
sh scripts/loadtest-high.sh
```

For the lab report, run the same scenario with 1, 2, and 3 backend instances and record requests per second, average response time, failure rate, CPU/RAM usage, and backend instance count.
