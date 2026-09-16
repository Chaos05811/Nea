#!/usr/bin/env bash
# Start the ML risk classifier using RISK_SERVICE_PORT from backend/.env
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/ai-service"
PORT="$(PYTHONPATH=. python3 -c "from app.core.config import get_settings; print(get_settings().risk_service_port)")"
exec python3 -m uvicorn app.main:app --reload --port "${PORT:-8000}"
