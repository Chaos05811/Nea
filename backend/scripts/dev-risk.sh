#!/usr/bin/env bash
# Start the ML risk classifier using RISK_SERVICE_PORT from backend/.env
#
# Uses `python`, not `python3`: on Windows, `python3` is often a non-functional
# Microsoft Store app-execution-alias stub that prints an install nag and exits,
# even when a real Python (e.g. via python.org's installer) is on PATH as `python`.
# `command -v` picks whichever actually resolves to a real interpreter.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/ai-service"
PY=python
if ! python -c "" >/dev/null 2>&1; then
  PY=python3
fi
PORT="$(PYTHONPATH=. "$PY" -c "from app.core.config import get_settings; print(get_settings().risk_service_port)")"
exec "$PY" -m uvicorn app.main:app --reload --port "${PORT:-8000}"
