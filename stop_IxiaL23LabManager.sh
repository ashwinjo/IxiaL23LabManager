#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IXIA_TOOLS_DIR="${IXIA_TOOLS_DIR:-${SCRIPT_DIR}/../tools}"
SHELL_PID_FILE="${SCRIPT_DIR}/.shell.pid"

CYAN='\033[0;36m'; GREEN='\033[0;32m'; NC='\033[0m'
info() { echo -e "${CYAN}[INFO]${NC} $*"; }
ok()   { echo -e "${GREEN}[ OK ]${NC} $*"; }

if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  COMPOSE=""
fi

stop_shell() {
  if [[ -f "${SHELL_PID_FILE}" ]]; then
    local pid
    pid="$(cat "${SHELL_PID_FILE}")"
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      ok "Stopped shell (pid ${pid})"
    fi
    rm -f "${SHELL_PID_FILE}"
  fi
  pkill -f "vite.*IxiaL23LabManager/shell" 2>/dev/null || true
}

stop_tool() {
  local dir=$1
  local compose_file=${2:-docker-compose.yml}
  [[ -d "$dir" ]] || return 0
  if [[ -n "$COMPOSE" && -f "${dir}/${compose_file}" ]]; then
    info "Stopping $(basename "$dir")..."
    (cd "$dir" && $COMPOSE -f "$compose_file" down 2>/dev/null) || true
  fi
}

main() {
  info "Stopping IxiaL23LabManager stack..."
  stop_shell
  stop_tool "${IXIA_TOOLS_DIR}/ixiaInventoryExplorer" "docker-compose.separate.yml"
  stop_tool "${IXIA_TOOLS_DIR}/IxNetworkSessionExplorer"
  stop_tool "${IXIA_TOOLS_DIR}/IxPortUtilizationAuditor"
  stop_tool "${IXIA_TOOLS_DIR}/IxOSMonitoring"
  ok "Teardown complete"
}

main "$@"
