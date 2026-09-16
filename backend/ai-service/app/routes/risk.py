from fastapi import APIRouter, Depends
from pydantic import BaseModel
import logging

from app.core.security import require_internal_key
from app.services import ml_risk

logger = logging.getLogger("nea.risk-service")

router = APIRouter(prefix="/risk", tags=["risk"], dependencies=[Depends(require_internal_key)])


class ClassifyRequest(BaseModel):
    text: str


class ClassifyResponse(BaseModel):
    level: str
    confidence: float
    available: bool


@router.post("/classify", response_model=ClassifyResponse)
def classify(payload: ClassifyRequest):
    """
    The one remaining piece of this service: the trained RandomForest/XGBoost risk
    classifier (see app/services/ml_risk.py). Everything else — chat/Groq, TTS/STT,
    memory consolidation, the deterministic keyword screen — now lives in node-api
    (Node.js). This stays in Python only because the model is a scikit-learn/XGBoost
    joblib bundle with no practical Node equivalent to load it without retraining.
    """
    result = ml_risk.classify(payload.text)
    logger.info(
        "classify ok  level=%s confidence=%.3f available=%s",
        result.get("level"),
        float(result.get("confidence") or 0),
        result.get("available"),
    )
    return result
