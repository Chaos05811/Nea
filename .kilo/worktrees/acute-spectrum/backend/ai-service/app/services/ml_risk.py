"""
Third risk-detection layer: a trained RandomForest/XGBoost classifier (whichever won
cross-validation — see scripts/train_risk_classifier.py) over TF-IDF features.

Deliberately advisory, not authoritative: this is a small bootstrap model (see the
warning in risk_classifier_meta.json) with weak recall on the "critical" class in
testing. It NEVER downgrades a risk level another layer already raised, and it never
triggers the deterministic crisis-bridge reply by itself — only app/services/risk.py's
keyword screen does that. Its only job is to sometimes catch a "medium" the LLM missed,
biased toward over-flagging rather than under-flagging, per this project's core safety
principle (missing a real signal is the worst failure mode; a false positive just means
a slightly warmer reply).
"""

import json
import logging
from pathlib import Path

import joblib

logger = logging.getLogger("nea.ml_risk")

MODEL_PATH = Path(__file__).parent.parent / "models" / "risk_classifier.joblib"
META_PATH = Path(__file__).parent.parent / "models" / "risk_classifier_meta.json"

_bundle = None
_meta = None


def _load():
    global _bundle, _meta
    if _bundle is not None:
        return
    if not MODEL_PATH.exists():
        logger.warning(
            "No trained risk classifier found at %s — run `python3 scripts/train_risk_classifier.py` "
            "from ai-service/. Falling back to 'none' for this layer only; the keyword screen and "
            "LLM self-report still run normally.",
            MODEL_PATH,
        )
        return
    _bundle = joblib.load(MODEL_PATH)
    if META_PATH.exists():
        _meta = json.loads(META_PATH.read_text())
        logger.info(
            "Loaded ML risk classifier: %s (held-out macro-F1=%.2f, trained on %d seed examples)",
            _meta.get("algorithm"),
            _meta.get("held_out_test_macro_f1", 0.0),
            _meta.get("dataset_size", 0),
        )


def classify(text: str) -> dict:
    """Returns {"level": "none"|"medium"|"critical", "confidence": float, "available": bool}."""
    _load()
    if _bundle is None:
        return {"level": "none", "confidence": 0.0, "available": False}

    vectorizer = _bundle["vectorizer"]
    model = _bundle["model"]
    label_encoder = _bundle["label_encoder"]

    vec = vectorizer.transform([text])
    probs = model.predict_proba(vec)[0]
    idx = probs.argmax()
    level = str(label_encoder.inverse_transform([idx])[0])
    return {"level": level, "confidence": float(probs[idx]), "available": True}
