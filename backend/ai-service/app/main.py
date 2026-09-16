"""
Nea's Python service — as of the Node.js migration, this is now JUST the ML risk
classifier (a scikit-learn/XGBoost model with no practical Node.js equivalent to
load without retraining). Chat/Groq, TTS/STT, and memory consolidation all moved
to node-api (Node.js) — see backend/CLAUDE.md for the full architecture and why.
"""

import logging

from fastapi import FastAPI

from app.routes import risk

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("nea.risk-service")

app = FastAPI(title="Nea Risk Classifier Service", version="0.2.0")

app.include_router(risk.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "nea-risk-service"}
