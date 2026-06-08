#!/usr/bin/env bash
# Bootstrap all four lab tools + IxiaL23LabManager shell.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHELL_DIR="${SCRIPT_DIR}/shell"
IXIA_TOOLS_DIR="${IXIA_TOOLS_DIR:-${SCRIPT_DIR}/../tools}"
IXIA_SHELL_PORT="${IXIA_SHELL_PORT:-9000}"
BRIAN_PORT="${BRIAN_PORT:-9010}"
SHELL_PID_FILE="${SCRIPT_DIR}/.shell.pid"
LAB_ASSISTANT_DIR="${SCRIPT_DIR}/lab-assistant"
UPDATE=false

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[ OK ]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
die()   { err "$*"; exit 1; }

PORTS=(3000 3001 5174 8890 8080 8888 8889 "${BRIAN_PORT}" "${IXIA_SHELL_PORT}")
# PORTS=(3000 3001 5174 8675 3005 8080 8888 8889 "${BRIAN_PORT}" "${IXIA_SHELL_PORT}")  # 3005 removed

REPOS=(
  "ixiaInventoryExplorer|https://github.com/ashwinjo/ixiaInventoryExplorer.git"
  "IxNetworkSessionExplorer|https://github.com/ashwinjo/IxNetworkSessionExplorer.git"
  "IxPortUtilizationAuditor|https://github.com/ashwinjo/IxPortUtilizationAuditor.git"
  "ixia-inventory-management-mcp|https://github.com/ashwinjo/ixia-inventory-management-mcp.git"
  # "IxOSMonitoring|https://github.com/Keysight/IxOSMonitoring.git"
)

for arg in "$@"; do
  case "$arg" in
    --update) UPDATE=true ;;
    -h|--help)
      echo "Usage: $0 [--update]"
      echo "  IXIA_TOOLS_DIR   Clone location (default: ../tools)"
      echo "  IXIA_SHELL_PORT  Shell port (default: 9000)"
      echo "  BRIAN_PORT       Brian backend port (default: 9010)"
      exit 0
      ;;
    *) die "Unknown option: $arg" ;;
  esac
done

port_in_use() {
  local port=$1
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"${port}" -sTCP:LISTEN -t >/dev/null 2>&1
  elif command -v ss >/dev/null 2>&1; then
    ss -ltn | grep -q ":${port} "
  else
    return 1
  fi
}

check_ports() {
  info "Checking required ports..."
  local blocked=()
  for p in "${PORTS[@]}"; do
    if port_in_use "$p"; then
      blocked+=("$p")
    fi
  done
  if [[ ${#blocked[@]} -gt 0 ]]; then
    warn "Ports already in use: ${blocked[*]} — assuming stack is partially up (idempotent mode)"
  else
    ok "Ports available"
  fi
}

install_docker_linux() {
  if command -v docker >/dev/null 2>&1; then
    return 0
  fi
  if [[ "$(uname -s)" != "Linux" ]]; then
    die "Docker not found. Install Docker Desktop (macOS) or Docker Engine (Linux) and retry."
  fi
  warn "Docker not found — attempting install (Ubuntu/Debian)..."
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update -qq
    sudo apt-get install -y docker.io docker-compose-plugin curl
    sudo systemctl enable --now docker 2>/dev/null || true
    ok "Docker installed"
  else
    die "Docker not installed and auto-install unsupported on this distro."
  fi
}

ensure_docker() {
  install_docker_linux
  if ! docker info >/dev/null 2>&1; then
    die "Docker is not running. Start Docker and retry."
  fi
  if docker compose version >/dev/null 2>&1; then
    COMPOSE="docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE="docker-compose"
  else
    die "Docker Compose not found."
  fi
  ok "Docker ready"
}

clone_repos() {
  mkdir -p "${IXIA_TOOLS_DIR}"
  for entry in "${REPOS[@]}"; do
    local name="${entry%%|*}"
    local url="${entry##*|}"
    local dest="${IXIA_TOOLS_DIR}/${name}"
    if [[ -d "${dest}/.git" ]]; then
      if $UPDATE; then
        info "Updating ${name}..."
        git -C "${dest}" pull --ff-only || warn "git pull failed for ${name}"
      else
        info "Skipping clone — ${name} exists"
      fi
    else
      info "Cloning ${name}..."
      git clone "${url}" "${dest}"
    fi
  done
}

wait_health() {
  local url=$1
  local label=$2
  local timeout=${3:-120}
  local i=0
  while [[ $i -lt $timeout ]]; do
    if curl -sf --max-time 3 "${url}" >/dev/null 2>&1; then
      ok "${label} healthy"
      return 0
    fi
    sleep 2
    i=$((i + 2))
  done
  warn "${label} did not respond at ${url} within ${timeout}s"
  return 1
}

start_t1() {
  local dir="${IXIA_TOOLS_DIR}/ixiaInventoryExplorer"
  [[ -d "$dir" ]] || die "Missing ${dir}"
  info "Starting IxiaInventoryExplorer..."
  if curl -sf --max-time 2 "http://127.0.0.1:3001/health" >/dev/null 2>&1; then
    ok "T1 already healthy"
    return 0
  fi
  if [[ -x "${dir}/docker-rebuild.sh" ]]; then
    info "Running docker-rebuild.sh (T1 startup)..."
    (cd "$dir" && ./docker-rebuild.sh) || die "docker-rebuild.sh failed for ixiaInventoryExplorer"
  else
    warn "docker-rebuild.sh not found — falling back to docker compose up"
    (cd "$dir" && $COMPOSE -f docker-compose.separate.yml up -d)
  fi
  wait_health "http://127.0.0.1:3001/health" "T1 backend" 180 || true
}

start_t2() {
  local dir="${IXIA_TOOLS_DIR}/IxNetworkSessionExplorer"
  [[ -d "$dir" ]] || die "Missing ${dir}"
  info "Starting IxNetworkSessionsExplorer..."
  if curl -sf --max-time 2 "http://127.0.0.1:8080/health/" >/dev/null 2>&1; then
    ok "T2 already healthy"
    return 0
  fi
  if [[ -x "${dir}/start.sh" ]]; then
    (cd "$dir" && ./start.sh) || (cd "$dir" && $COMPOSE up -d)
  else
    (cd "$dir" && $COMPOSE up -d)
  fi
  wait_health "http://127.0.0.1:8080/health/" "T2 backend" 180 || true
}

start_t3() {
  local dir="${IXIA_TOOLS_DIR}/IxPortUtilizationAuditor"
  [[ -d "$dir" ]] || die "Missing ${dir}"
  info "Starting IxPortUtilizationAuditor on port 8890..."
  if curl -sf --max-time 2 "http://127.0.0.1:8890/docs" >/dev/null 2>&1; then
    ok "T3 already running"
    return 0
  fi
  if [[ -x "${dir}/start.sh" ]]; then
    (cd "$dir" && ./start.sh)
  elif [[ -f "${dir}/docker-compose.yml" ]]; then
    (cd "$dir" && $COMPOSE -f docker-compose.yml up -d --build 2>/dev/null) || true
  fi
  wait_health "http://127.0.0.1:8890/docs" "T3" 120 || true
}

start_t1_mcp() {
  local dir="${IXIA_TOOLS_DIR}/ixia-inventory-management-mcp"
  [[ -d "$dir" ]] || { warn "T1 MCP repo missing — clone ixia-inventory-management-mcp"; return 0; }
  info "Starting T1 Inventory MCP (port 8888)..."
  if curl -sf --max-time 2 "http://127.0.0.1:8888/docs" >/dev/null 2>&1; then
    ok "T1 MCP already running"
    return 0
  fi
  if [[ ! -f "${dir}/config.json" ]]; then
    warn "T1 MCP config.json missing in ${dir} — create it with chassis credentials before using inventory tools"
  fi
  if [[ -f "${dir}/docker-compose.yml" ]]; then
    (cd "$dir" && $COMPOSE up -d --build 2>/dev/null) || (cd "$dir" && $COMPOSE up -d)
  else
    warn "No docker-compose.yml in T1 MCP repo — start manually on port 8888"
    return 0
  fi
  wait_health "http://127.0.0.1:8888/docs" "T1 MCP" 120 || true
}

start_brian() {
  [[ -d "${LAB_ASSISTANT_DIR}" ]] || die "Missing ${LAB_ASSISTANT_DIR}"
  info "Starting Brian (LabAssistant) on port ${BRIAN_PORT}..."
  local pid_file="${LAB_ASSISTANT_DIR}/.brian.pid"
  if $UPDATE && [[ -f "$pid_file" ]]; then
    info "Restarting Brian to pick up .env changes..."
    kill "$(cat "$pid_file")" 2>/dev/null || true
    rm -f "$pid_file"
    sleep 1
  fi
  if curl -sf --max-time 2 "http://127.0.0.1:${BRIAN_PORT}/health" >/dev/null 2>&1; then
    ok "Brian already healthy"
    return 0
  fi
  chmod +x "${LAB_ASSISTANT_DIR}/start.sh" 2>/dev/null || true
  (cd "${LAB_ASSISTANT_DIR}" && BRIAN_PORT="${BRIAN_PORT}" ./start.sh) || warn "Brian start.sh failed — see lab-assistant/brian.log"
  wait_health "http://127.0.0.1:${BRIAN_PORT}/health" "Brian" 60 || true
}

# start_t4() {
#   local dir="${IXIA_TOOLS_DIR}/IxOSMonitoring"
#   [[ -d "$dir" ]] || die "Missing ${dir}"
#   info "Starting IxOSMonitoring..."
#   if curl -sf --max-time 2 "http://127.0.0.1:3005/api/health" >/dev/null 2>&1; then
#     ok "T4 already healthy"
#     return 0
#   fi
#   if [[ -x "${dir}/startup.sh" ]]; then
#     (cd "$dir" && ./startup.sh) || true
#   elif [[ -f "${dir}/start.sh" ]]; then
#     (cd "$dir" && ./start.sh) || true
#   elif [[ -f "${dir}/docker-compose.yml" ]]; then
#     (cd "$dir" && $COMPOSE up -d) || true
#   else
#     warn "No startup script for IxOSMonitoring — start manually on port 3005"
#     return 0
#   fi
#   wait_health "http://127.0.0.1:3005/api/health" "T4 Grafana" 180 || true
# }

start_shell() {
  if [[ -f "${SHELL_PID_FILE}" ]] && kill -0 "$(cat "${SHELL_PID_FILE}")" 2>/dev/null; then
    ok "Shell already running (pid $(cat "${SHELL_PID_FILE}"))"
    return 0
  fi
  info "Starting IxiaL23LabManager shell on port ${IXIA_SHELL_PORT}..."
  if ! command -v npm >/dev/null 2>&1; then
    die "npm not found. Install Node.js 18+ and retry."
  fi
  (cd "${SHELL_DIR}" && npm install --silent)
  (cd "${SHELL_DIR}" && IXIA_SHELL_PORT="${IXIA_SHELL_PORT}" nohup npm run dev > "${SCRIPT_DIR}/shell.log" 2>&1) &
  echo $! > "${SHELL_PID_FILE}"
  sleep 3
  if curl -sf --max-time 5 "http://127.0.0.1:${IXIA_SHELL_PORT}/" >/dev/null 2>&1; then
    ok "Shell started"
  else
    warn "Shell may still be starting — see shell.log"
  fi
}

main() {
  echo -e "${BOLD}IxiaL23LabManager bootstrap${NC}"
  ensure_docker
  check_ports
  clone_repos
  start_t1
  start_t1_mcp
  start_t2
  start_t3
  # start_t4
  start_brian
  start_shell
  echo ""
  echo -e "${GREEN}${BOLD}IxiaL23LabManager running at http://localhost:${IXIA_SHELL_PORT}${NC}"
  echo ""
  echo -e "${BOLD}  T1 — IxiaInventoryExplorer${NC}"
  echo "    UI:       http://localhost:5174"
  echo "    Backend:  http://localhost:3001"
  echo ""
  echo -e "${BOLD}  T2 — IxNetworkSessionsExplorer${NC}"
  echo "    UI:       http://localhost:3000"
  echo "    Backend:  http://localhost:8080"
  echo ""
  echo -e "${BOLD}  T3 — IxPortUtilizationAuditor${NC}"
  echo "    UI:       http://localhost:8890"
  echo "    Backend:  http://localhost:8890"
  echo ""
  echo -e "${BOLD}  MCP — Inventory (T1)${NC}"
  echo "    MCP:      http://localhost:8888/mcp"
  echo "    Health:   http://localhost:8888/docs"
  echo ""
  echo -e "${BOLD}  MCP — Sessions (T2, via start.sh)${NC}"
  echo "    MCP:      http://localhost:8889/mcp"
  echo ""
  echo -e "${BOLD}  Brian — LabAssistant${NC}"
  echo "    Shell UI: http://localhost:${IXIA_SHELL_PORT} → Brian (LabAssistant)"
  echo "    API:      http://localhost:${BRIAN_PORT}"
  echo "    Set OPENAI_API_KEY in lab-assistant/.env for chat"
  echo ""
  # echo -e "${BOLD}  T4 — IxOSMonitoring${NC}"
  # echo "    UI:       http://localhost:3005"
  # echo "    Backend:  http://localhost:3005"
}

main "$@"
