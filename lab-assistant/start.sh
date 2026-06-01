#!/usr/bin/env bash
# Start Brian (LabAssistant) backend on BRIAN_PORT (default 9010).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

BRIAN_PORT="${BRIAN_PORT:-9010}"
PID_FILE="${SCRIPT_DIR}/.brian.pid"
VENV="${SCRIPT_DIR}/.venv"

if [[ -f "${PID_FILE}" ]] && kill -0 "$(cat "${PID_FILE}")" 2>/dev/null; then
  echo "Brian already running (pid $(cat "${PID_FILE}"))"
  exit 0
fi

if [[ ! -d "$VENV" ]]; then
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install -q -r requirements.txt
fi

if [[ -f "${SCRIPT_DIR}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${SCRIPT_DIR}/.env"
  set +a
fi

export BRIAN_PORT
nohup "$VENV/bin/python" main.py > "${SCRIPT_DIR}/brian.log" 2>&1 &
echo $! > "${PID_FILE}"
sleep 2

if curl -sf --max-time 3 "http://127.0.0.1:${BRIAN_PORT}/health" >/dev/null 2>&1; then
  echo "Brian ready at http://127.0.0.1:${BRIAN_PORT}"
else
  echo "Brian may still be starting — see lab-assistant/brian.log"
fi
