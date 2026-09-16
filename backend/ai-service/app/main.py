"""
Nea's Python service — as of the Node.js migration, this is now JUST the ML risk
classifier (a scikit-learn/XGBoost model with no practical Node.js equivalent to
load without retraining). Chat/Groq, TTS/STT, and memory consolidation all moved
to node-api (Node.js) — see backend/CLAUDE.md for the full architecture and why.
"""

import logging
import time

from fastapi import FastAPI, Request
from starlette.middleware.base import BaseHTTPMiddleware

from app.routes import risk

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("nea.risk-service")

app = FastAPI(title="Nea Risk Classifier Service", version="0.2.0")


class RequestLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        started = time.perf_counter()
        response = await call_next(request)
        ms = int((time.perf_counter() - started) * 1000)
        status = response.status_code
        summary = f"{request.method} {request.url.path} → {status} ({ms}ms)"
        if status >= 500:
            logger.error("api fail  %s", summary)
        elif status >= 400:
            logger.warning("api fail  %s", summary)
        else:
            logger.info("api ok    %s", summary)
        return response


app.add_middleware(RequestLogMiddleware)
app.include_router(risk.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "nea-risk-service"}
