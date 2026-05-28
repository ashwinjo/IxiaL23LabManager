# IxiaL23LabManager

Unified lab management shell for Ixia/Keysight L2–L3 lab tools. One URL, four embedded tools, shared chassis onboarding.

## Quick start

**Prerequisites:** Docker, Docker Compose, Node.js 18+, git

```bash
git clone https://github.com/ashwinjo/IxiaL23LabManager.git
cd IxiaL23LabManager
chmod +x start_IxiaL23LabManager.sh stop_IxiaL23LabManager.sh
./start_IxiaL23LabManager.sh
```

Open **http://localhost:9000**

## What it does

| Feature | Description |
|---------|-------------|
| Bootstrap | Clones and starts all four tools + shell |
| Navigation | Sidebar + iframe for each tool |
| Health | Header polls each tool every 30s |
| Config | Manual entry and CSV bulk upload for T1 + T2 |

## Ports

| Service | Port |
|---------|------|
| **IxiaL23LabManager shell** | **9000** |
| IxiaInventoryExplorer UI / API | 5174 / 3001 |
| IxNetworkSessionsExplorer UI / API | 3000 / 8080 |
| IxPortUtilizationAuditor | 8675 |
| IxOSMonitoring (Grafana) | 3005 |

Override shell port: `IXIA_SHELL_PORT=9001 ./start_IxiaL23LabManager.sh`

Tool clone directory: `IXIA_TOOLS_DIR=~/lab-tools ./start_IxiaL23LabManager.sh`

## Stop

```bash
./stop_IxiaL23LabManager.sh
```

## Development (shell only)

```bash
cd shell
npm install
npm run dev
```

Ensure underlying tools are running on their native ports.

## Documentation

- [Product requirements](docs/prd.md)
- [Architecture & API contracts](docs/architecture.md)

## macOS notes

Docker Desktop must be running before bootstrap. Docker auto-install is Linux-only.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Port in use | `lsof -i :9000` — stop process or set `IXIA_SHELL_PORT` |
| iframe blank | Open tool URL directly; check `X-Frame-Options` on tool |
| Config CORS error | Ensure T1/T2 backends allow `http://localhost:9000` |
| T1 slow start | First run uses `docker-rebuild.sh` (full image build); later runs skip if already healthy |
| T3 not on 8675 | Set `API_PORT=8675` or map `8675:8890` in compose |

## License

Open source — see individual tool repos for their licenses.
