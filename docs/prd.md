# IxiaL23LabManager — Product Requirements Document

## 1. Executive Summary

We're building **IxiaL23LabManager** — an open-source, unified lab management shell for network test engineers and lab administrators — to solve the problem of fragmented tooling across Ixia/Keysight chassis infrastructure. Today, operators must context-switch across four separate portals (inventory, sessions, port utilization, and monitoring) on different localhost ports with no shared entry point, no unified onboarding, and no at-a-glance lab health view. IxiaL23LabManager eliminates that friction by providing a single-URL React shell that bootstraps all four tools via one script, surfaces live service health, and provides a unified chassis configuration form — while keeping each underlying tool fully standalone and independently deployable. The result is a polished, customer-facing open-source project that compresses new lab admin setup time from 30+ minutes to under 10.

---

## 2. Problem Statement

### Who has this problem?
Network test lab administrators and Solutions Engineers at hyperscalers, enterprises, and Keysight field teams who operate Ixia/Keysight chassis infrastructure running IxOS and IxNetwork.

### What is the problem?
The four tools that collectively manage an Ixia L2–L3 lab exist as independent applications on separate ports with no shared entry point, no unified configuration surface, and no cross-tool health visibility. Administrators must:
- Manually start each tool independently (no single bootstrap)
- Navigate between `localhost:5174`, `localhost:3000`, `localhost:8675`, and `localhost:3005` in separate browser tabs
- Enter chassis IPs and credentials redundantly in Tool 1 and Tool 2 (and soon Tool 4)
- Mentally correlate health signals across four disconnected dashboards

### Why is it painful?
- **Onboarding friction:** New lab admins face a multi-step setup with no single guide — cloning four repos, running four setup scripts, opening four tabs
- **Cognitive overhead:** No unified view of "is my lab healthy right now" without tabbing through all four tools
- **Credential duplication:** Same chassis credentials entered multiple times across tools with no shared config surface
- **Demo friction for SEs:** Showing the full lab management stack requires managing four browser windows in a customer call

### Evidence
- Four existing tools are live in production across multiple GitHub repos with no launcher or aggregating shell
- MCP integrations exist for Tools 1 & 2 but no unified entry point to leverage them
- SE demos of the full stack currently require manual multi-tab orchestration

---

## 3. Target Users & Personas

### Primary Persona: Lab Administrator (Customer)
- **Role:** Network test lab admin at a hyperscaler or enterprise running Keysight chassis infrastructure
- **Environment:** Linux lab server, Docker pre-installed or installable, internal network
- **Goals:** Get the full lab management stack running quickly, maintain visibility into chassis health, configure multiple chassis at once (bulk), not repeat themselves across tools
- **Pain points:** No single entry point, setup requires tribal knowledge, redundant credential entry
- **Success looks like:** One command → all tools up → one URL → full lab visibility in under 10 minutes

### Secondary Persona: Solutions Engineer (Internal — Keysight)
- **Role:** SE running a demo of the Keysight lab management story on a laptop or demo environment
- **Environment:** macOS (best-effort), Docker Desktop, customer-facing demo
- **Goals:** Stand up the full stack cleanly before a customer call, navigate the tools fluidly during a demo without changing tabs
- **Pain points:** Multi-tab demo is disjointed, setup steps are manual and error-prone under time pressure
- **Success looks like:** `./start_IxiaL23LabManager.sh` → polished single-URL demo ready in minutes

### Jobs to Be Done
- *"When I'm onboarding a new lab, I want to configure all chassis in one place so I don't have to repeat myself."*
- *"When something's wrong in the lab, I want to know immediately which service is down without opening four tabs."*
- *"When I'm demoing to a customer, I want to show a unified product story, not a collection of scripts."*

---

## 4. Strategic Context

### Why This Project?
The four individual tools (IxiaInventoryExplorer, IxNetworkSessionsExplorer, IxPortUtilizationAuditor, IxOSMonitoring) represent a coherent, complete lab management stack. Today they are useful independently but tell no unified story. IxiaL23LabManager closes that gap without disrupting the modularity of each tool — it is additive, not replacement.

### Why Open Source?
- Consistent with the four underlying tools (all public GitHub repos)
- Lowers adoption barrier for hyperscaler and enterprise lab teams
- Creates a community contribution surface (additional tools can be plugged in)
- Serves as a credible SE demo asset and customer accelerator without requiring a licensing conversation

### Why Now?
- MCPs for Tools 1 & 2 already exist — the integration surface is ready
- Tools 3 & 4 MCPs are in progress — timing aligns with a unified shell becoming the natural home for them
- The SE AI Champion charter creates a forcing function: this project demonstrates MCP-driven agentic lab ops end-to-end

---

## 5. Solution Overview

### What We're Building
A lightweight React web application (`IxiaL23LabManager`) served on `localhost:9000` that:

1. **Bootstraps the full stack** via a single shell script (`start_IxiaL23LabManager.sh`)
2. **Provides a sidebar navigation shell** with iframe-embedded views of each of the four tools
3. **Surfaces live service health** for all four tools in a persistent header bar
4. **Provides a unified chassis onboarding form** (manual entry + CSV bulk upload) that configures Tool 1 and Tool 2 in a single operation

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│              IxiaL23LabManager  (localhost:9000)         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Header: [T1 ●] [T2 ●] [T3 ●] [T4 ●]  ↻ 30s   │   │
│  ├────────────┬─────────────────────────────────────┤   │
│  │  Sidebar   │         iframe viewport              │   │
│  │            │                                      │   │
│  │ ▸ Home     │   <active tool renders here>         │   │
│  │ ▸ Tool 1   │                                      │   │
│  │ ▸ Tool 2   │                                      │   │
│  │ ▸ Tool 3   │                                      │   │
│  │ ▸ Tool 4   │                                      │   │
│  │ ▸ Config   │                                      │   │
│  └────────────┴─────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
         │            │            │            │
    :5174          :3000        :8675        :3005   (iframe / UI ports)
    :3001          :8080          —          :3005   (API / backend — T3 is combined)
  Tool 1          Tool 2       Tool 3       Tool 4
```

**Per-tool frontend vs backend:**

| Tool | UI (iframe) | Backend / API | Notes |
|---|---|---|---|
| IxiaInventoryExplorer (T1) | 5174 | 3001 | Separate frontend and backend services |
| IxNetworkSessionsExplorer (T2) | 3000 | 8080 | Separate frontend and backend services |
| IxPortUtilizationAuditor (T3) | 8675 | 8675 | Single Docker container (combined backend + frontend) |
| IxOSMonitoring (T4) | 3005 | 3005 | Grafana |

### Bootstrap Script (`start_IxiaL23LabManager.sh`)

**Responsibilities (in order):**
1. Preflight: Check for Docker + Docker Compose; install if missing (Linux only)
2. Preflight: Check that ports 3000, 3001, 5174, 8675, 3005, 8080, 9000 are available; fail fast with clear error if not (9000 = shell; 8080 = T2 backend only)
3. Clone each of the four tool repos (skip if already present)
4. Execute each tool's `startup.sh` to bring up its Docker infrastructure
5. Start the IxiaL23LabManager React shell on port 9000 (`IXIA_SHELL_PORT`)
6. Print a single URL to the terminal: `http://localhost:9000`

### Unified Configuration Surface (Home / Config view)

**Manual Entry:**
- Form fields: Chassis IP, Username, Password, Label (optional)
- "Test Connection" button: POSTs to Tool 1 API and Tool 2 API, returns per-tool pass/fail indicator
- Save button: persists config to each tool's own storage (IxiaL23LabManager stores nothing sensitive)

**Bulk Upload:**
- Tool selector dropdown (Tool 1 or Tool 2)
- "Download Template" link (serves the correct CSV schema per tool)
- CSV file upload input
- Preview table: parsed rows with per-row field validation (IP format, required fields)
- "Apply All" button: POSTs each row to the selected tool's config endpoint
- Results table: per-row connection test result (✅ / ❌ / ⏳)

### Service Health Header

- Four indicators, one per tool: tool name + colored dot (green/yellow/red)
- Polls each tool's health endpoint every 30 seconds
- Last-checked timestamp displayed per indicator
- Manual "Refresh All" button
- Clicking an indicator navigates to that tool's iframe view

---

## 6. Success Metrics

| Metric | Target |
|---|---|
| Time from `git clone` to all tools running | < 10 minutes on a clean Linux host |
| Chassis configuration time (bulk, 20 chassis) | < 5 minutes via CSV upload |
| GitHub stars / forks at 3 months post-launch | Community signal (no hard target for v1) |
| SE demo setup time reduction | Anecdotal: from ~30 min to < 10 min |
| iframe embedding compatibility | All 4 tools render correctly in iframe (no X-Frame-Options blocking) |

---

## 7. User Stories & Requirements

### Epic Hypothesis
If lab administrators have a single entry point that bootstraps, navigates, and configures all four Ixia lab management tools, then they will spend less time on setup and context-switching and more time on actual lab work — measurable by setup time reduction and reduction in "how do I get this running" support questions.

---

### Story 1: Bootstrap the full stack
**As a** lab admin,
**I want to** run a single script that gets all four tools and the management shell running,
**so that** I don't need to manually clone, configure, and start each tool.

**Acceptance Criteria:**
- [ ] `start_IxiaL23LabManager.sh` detects Docker; installs it on Linux if missing
- [ ] Script detects Docker Compose; installs if missing
- [ ] Script checks ports 3000, 3001, 5174, 8675, 3005, 8080, 9000; exits with clear error message if any are in use
- [ ] Script clones all four tool repos if not already present locally
- [ ] Script runs each tool's `startup.sh` in sequence
- [ ] Script starts IxiaL23LabManager on port 9000
- [ ] Terminal output ends with `IxiaL23LabManager running at http://localhost:9000`
- [ ] Script is idempotent: running it twice does not duplicate containers or fail

---

### Story 2: Navigate between tools without changing tabs
**As a** lab admin,
**I want to** switch between the four tools from a persistent sidebar,
**so that** I never have to manage multiple browser tabs or remember port numbers.

**Acceptance Criteria:**
- [ ] Sidebar is always visible regardless of which tool is active
- [ ] Clicking a sidebar item loads that tool in the iframe viewport
- [ ] Active tool is visually highlighted in the sidebar
- [ ] Each tool has a "Pop out" icon that opens it in a new tab at its native port (fallback)
- [ ] Sidebar includes a "Home / Config" entry that loads the configuration view

---

### Story 3: View live service health at a glance
**As a** lab admin,
**I want to** see whether each tool is up or down in the header,
**so that** I know immediately if something needs attention without opening each tool.

**Acceptance Criteria:**
- [ ] Header shows one indicator per tool (name + colored dot)
- [ ] Green = tool health endpoint returns 200; Red = non-200 or timeout; Yellow = polling in progress
- [ ] Indicators update automatically every 30 seconds
- [ ] Last-checked timestamp is shown per indicator
- [ ] "Refresh All" button triggers an immediate poll cycle
- [ ] Clicking an indicator navigates to that tool's iframe view

---

### Story 4: Configure chassis via manual entry
**As a** lab admin,
**I want to** enter chassis IPs and credentials once and have them applied to Tool 1 and Tool 2,
**so that** I don't have to configure the same chassis in multiple tools separately.

**Acceptance Criteria:**
- [ ] Config view has a form: Chassis IP, Username, Password, Label (optional)
- [ ] "Test Connection" button calls Tool 1 and Tool 2 config/health APIs with provided credentials
- [ ] Per-tool test result (✅ / ❌) is displayed before saving
- [ ] "Save" button POSTs config to Tool 1 and Tool 2 endpoints
- [ ] IxiaL23LabManager does not persist credentials locally (no local storage of passwords)
- [ ] Form validates IP format and required fields before allowing submission

---

### Story 5: Bulk configure chassis via CSV upload
**As a** lab admin managing a large chassis fleet,
**I want to** upload a CSV file to configure multiple chassis at once,
**so that** I don't have to fill out a form for each chassis individually.

**Acceptance Criteria:**
- [ ] Tool selector dropdown (Tool 1 or Tool 2) determines which CSV schema applies
- [ ] "Download Template" provides the correct CSV template for the selected tool
- [ ] Uploaded CSV is parsed client-side and displayed as a preview table
- [ ] Per-row validation highlights rows with missing required fields or malformed IPs before submission
- [ ] "Apply All" button POSTs each valid row to the selected tool's config endpoint
- [ ] Results table shows per-row outcome (✅ success / ❌ error + reason / ⏳ pending)
- [ ] Partial success is handled gracefully: successful rows are applied, failed rows are flagged for retry

---

## 8. Out of Scope (v1)

| Feature | Rationale |
|---|---|
| Data aggregation / cross-tool analytics views | Tools 3 & 4 already do this at the backend; IxiaL23LabManager is a nav shell, not a data layer |
| User authentication / login to the shell itself | Lab environments are typically trusted networks; add auth in v2 if demand exists |
| Tool 3 & Tool 4 MCP integration from the shell | MCPs for these tools are in progress; integrate when available in v2 |
| macOS Docker install automation | macOS Docker install requires GUI interaction; document manual prereq instead |
| Reverse proxy / custom domain / TLS | Out of scope for local lab tooling; users can layer nginx in front if needed |
| Mobile-responsive layout | Lab admin tooling is desktop-only |
| Plugin/extension API for third-party tools | Design for it architecturally but don't build in v1 |

---

## 9. Dependencies & Risks

### Technical Dependencies

| Dependency | Owner | Status |
|---|---|---|
| IxiaInventoryExplorer (Tool 1) repo + `docker-rebuild.sh` + health endpoint | ashwinjo | Live |
| IxNetworkSessionsExplorer (Tool 2) repo + `startup.sh` + health endpoint | ashwinjo | Live |
| Tool 1 MCP | ashwinjo | Live |
| Tool 2 MCP | ashwinjo | Live |
| IxPortUtilizationAuditor (Tool 3) repo + `startup.sh` | ashwinjo | Live (MCP in progress) |
| IxOSMonitoring (Tool 4) repo + `startup.sh` | Keysight | Live (MCP in progress) |
| All four tools allow iframe embedding (no `X-Frame-Options: DENY`) | Per-tool | **Must verify** |

### Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| One or more tools block iframe embedding via `X-Frame-Options` | Medium | Audit headers on all four tools early; patch or proxy if needed |
| Tool health endpoints don't exist yet | Medium | Define a minimal `/health` GET contract for each tool; can be as simple as HTTP 200 |
| Bootstrap script fails on non-standard Linux distros | Low | Test on Ubuntu 22.04 and 24.04; document supported distros in README |
| Port conflicts in shared lab environments | Medium | Script does preflight port check with clear error messages and suggested resolution |
| CSV schemas for Tool 1 and Tool 2 are undocumented | Low | Extract from existing tool config UIs and document as part of this project |

---

## 10. Open Questions

| Question | Owner | Target Resolution |
|---|---|---|
| Do all four tools currently expose a `/health` or equivalent endpoint? If not, what's the minimum we need to add? | ashwinjo | Before UI development starts |
| Do Tool 1 and Tool 2 have a documented REST API for POSTing chassis config, or does config currently only happen through their UI? | ashwinjo | Before Config story development |
| What are the exact CSV column schemas for Tool 1 and Tool 2 bulk import? | ashwinjo | Before Story 5 development |
| Should `start_IxiaL23LabManager.sh` support a `--update` flag to pull latest commits on all repos without full re-clone? | ashwinjo | v1 nice-to-have; decide before script finalization |
| What port should IxiaL23LabManager use if 9000 is taken? Configurable via `IXIA_SHELL_PORT`? | ashwinjo | Resolved: default 9000 |

---

## Appendix A: Tool Reference

| Tool | UI Port | Backend Port | Repo | MCP Status |
|---|---|---|---|---|
| IxiaInventoryExplorer | 5174 | 3001 | github.com/ashwinjo/ixiaInventoryExplorer | ✅ Live |
| IxNetworkSessionsExplorer | 3000 | 8080 | github.com/ashwinjo/IxNetworkSessionExplorer | ✅ Live |
| IxPortUtilizationAuditor | 8675 | 8675 (combined) | github.com/ashwinjo/IxPortUtilizationAuditor | 🔄 In Progress |
| IxOSMonitoring (Grafana) | 3005 | 3005 | github.com/Keysight/IxOSMonitoring | 🔄 In Progress |
| **IxiaL23LabManager** (this project) | **9000** | — | TBD | N/A |

**Notes:**
- T1 and T2 split frontend and backend; config/health API calls target the backend ports (3001, 8080).
- T3 runs as one Docker image serving both UI and API on 8675 (container internal port may be 8890; map via compose).
- Shell uses port 9000; T2 backend remains on 8080.

---

## Appendix B: Proposed Repo Structure

```
IxiaL23LabManager/
├── start_IxiaL23LabManager.sh   # Bootstrap: install deps, clone tools, start all
├── stop_IxiaL23LabManager.sh    # Graceful teardown
├── README.md
├── shell/                        # React app
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.jsx
│   │   │   ├── Header.jsx        # Health indicators
│   │   │   ├── IframeView.jsx
│   │   │   └── ConfigView.jsx    # Manual entry + CSV upload
│   │   ├── hooks/
│   │   │   └── useHealthPoller.js
│   │   └── App.jsx
│   ├── public/
│   │   └── templates/            # CSV templates for Tool 1 and Tool 2
│   └── package.json
└── docs/
    └── architecture.md
```