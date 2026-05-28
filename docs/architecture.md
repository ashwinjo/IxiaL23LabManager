# IxiaL23LabManager — Architecture

## Shell

| Property | Value |
|----------|-------|
| URL | `http://localhost:9000` (env: `IXIA_SHELL_PORT`) |
| Stack | Vite + React, no shell backend in v1 |
| Role | Navigation shell, health aggregation, unified T1/T2 config |

## Tool integration matrix

| Tool | UI (iframe) | Backend | Health check | iframe notes |
|------|-------------|---------|--------------|--------------|
| IxiaInventoryExplorer (T1) | 5174 | 3001 | `GET /health` → 200 | Vite/nginx default; no `X-Frame-Options: DENY` expected |
| IxNetworkSessionsExplorer (T2) | 3000 | 8080 | `GET /health/` → 200 | nginx static frontend |
| IxPortUtilizationAuditor (T3) | 8675 | 8675 (combined) | `GET /` → 200 | Map host `8675` → container `8890` if needed |
| IxOSMonitoring (T4) | 3005 | 3005 | `GET /api/health` (Grafana) | External repo |

## Bootstrap scripts (per tool)

| Tool | Repo | Start script | Notes |
|------|------|--------------|-------|
| T1 | `github.com/ashwinjo/ixiaInventoryExplorer` | `./docker-rebuild.sh` | Rebuilds and starts `docker-compose.separate.yml` (5174 + 3001) |
| T2 | `github.com/ashwinjo/IxNetworkSessionExplorer` | `./start.sh` | Also `docker compose up` |
| T3 | `github.com/ashwinjo/IxPortUtilizationAuditor` | `./start.sh` | Default container port 8890; expose as 8675 via `API_PORT` / compose override |
| T4 | `github.com/Keysight/IxOSMonitoring` | `startup.sh` if present, else compose | Clone-only if script missing |

Clone target: `$IXIA_TOOLS_DIR` (default: `../tools` relative to this repo).

## T1 — IxiaInventoryExplorer APIs (backend :3001)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Service health |
| GET | `/api/config/chassis` | List configured chassis (no passwords) |
| POST | `/api/config/upload` | Add/delete chassis via CSV text body |

**CSV format (chassis):** `operation,ip,username,password` per line. Operations: `ADD`, `DELETE`, `UPDATE`.

**Example:**
```
ADD,10.36.65.163,admin,password
```

**Test connection:** No dedicated probe endpoint. Shell validates format client-side; save/test uses `POST /api/config/upload` with a single `ADD,...` line (persists credentials in T1 DB).

CORS: `CORS_ORIGINS=*` by default in compose.

## T2 — IxNetworkSessionsExplorer APIs (backend :8080)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health/` | Fleet health |
| POST | `/servers/probe` | Test credentials without saving |
| POST | `/servers` | Add server (201) |
| POST | `/servers/bulk` | Bulk upsert |

**Probe / create body:**
```json
{
  "host": "10.36.65.163",
  "username": "admin",
  "password": "secret",
  "rest_port": 443
}
```

**Create server (POST /servers):** adds `name` (use label or IP), same fields as probe.

**Bulk CSV columns:** `name,host,username,password,rest_port,tags` (rest_port optional, default 443; tags optional comma-separated).

CORS: enabled on FastAPI app for browser calls from shell origin.

## T3 — IxPortUtilizationAuditor

Combined FastAPI + HTML dashboard on one port. Health: `GET /` returns dashboard HTML (200).

Upstream depends on T1/T2 URLs via `INVENTORY_EXPLORER_URL` and `SESSION_EXPLORER_URL` env vars in compose.

## T4 — IxOSMonitoring

Grafana on port 3005. Health: `GET /api/health`. iframe: Grafana may need `allow_embedding` in config (verify on deploy).

## CORS

Shell at `http://localhost:9000` calls T1/T2 backends directly. Ensure tool backends allow origin `http://localhost:9000` or `*` (T1/T2 already support `*` in dev compose).

## Security

- Shell does **not** store passwords in localStorage/sessionStorage.
- Credentials only forwarded to T1/T2 APIs over POST.

## Open items

- T1 has no non-persisting probe; test-before-save for T1 is format validation + optional upload on explicit Save.
- T3 upstream port mapping (8675 vs 8890) handled in bootstrap via `API_PORT` / compose port mapping.
- T4 startup script may vary; bootstrap attempts `startup.sh` then `docker compose up -d`.
