"""
Trains the ML risk-classification layer and picks between RandomForest and XGBoost —
both named on the Technical Approach slide — by comparing cross-validated F1 on the
seed dataset in risk_seed_data.py. Whichever wins is what actually ships.

Run from ai-service/:
    python3 scripts/train_risk_classifier.py

Output:
    app/models/risk_classifier.joblib   — {"vectorizer":..., "model":..., "label_encoder":...}
    app/models/risk_classifier_meta.json — which algorithm won, its metrics, dataset size

Re-run this whenever risk_seed_data.py grows (it should — see the warning in that file).
"""

import json
import sys
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import classification_report, f1_score
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder
from xgboost import XGBClassifier

sys.path.insert(0, str(Path(__file__).parent))
from risk_seed_data import CRITICAL_EXAMPLES, MEDIUM_EXAMPLES, NONE_EXAMPLES  # noqa: E402

OUT_DIR = Path(__file__).parent.parent / "app" / "models"
OUT_DIR.mkdir(parents=True, exist_ok=True)

texts = NONE_EXAMPLES + MEDIUM_EXAMPLES + CRITICAL_EXAMPLES
labels = (
    ["none"] * len(NONE_EXAMPLES)
    + ["medium"] * len(MEDIUM_EXAMPLES)
    + ["critical"] * len(CRITICAL_EXAMPLES)
)
print(f"Dataset: {len(texts)} examples — none={len(NONE_EXAMPLES)}, "
      f"medium={len(MEDIUM_EXAMPLES)}, critical={len(CRITICAL_EXAMPLES)}")

label_encoder = LabelEncoder()
y = label_encoder.fit_transform(labels)

X_train, X_test, y_train, y_test = train_test_split(
    texts, y, test_size=0.2, random_state=42, stratify=y
)

vectorizer = TfidfVectorizer(ngram_range=(1, 2), min_df=1, sublinear_tf=True)
X_train_vec = vectorizer.fit_transform(X_train)
X_test_vec = vectorizer.transform(X_test)

candidates = {
    "random_forest": RandomForestClassifier(
        n_estimators=200, max_depth=8, class_weight="balanced", random_state=42
    ),
    "xgboost": XGBClassifier(
        n_estimators=200, max_depth=4, learning_rate=0.2, eval_metric="mlogloss", random_state=42
    ),
}

cv = StratifiedKFold(n_splits=3, shuffle=True, random_state=42)
results = {}
for name, model in candidates.items():
    scores = cross_val_score(model, X_train_vec, y_train, cv=cv, scoring="f1_macro")
    results[name] = {"cv_f1_macro_mean": float(scores.mean()), "cv_f1_macro_std": float(scores.std())}
    print(f"{name}: CV macro-F1 = {scores.mean():.3f} (+/- {scores.std():.3f})")

winner_name = max(results, key=lambda n: results[n]["cv_f1_macro_mean"])
winner_model = candidates[winner_name]
winner_model.fit(X_train_vec, y_train)

y_pred = winner_model.predict(X_test_vec)
test_f1 = f1_score(y_test, y_pred, average="macro")
report = classification_report(y_test, y_pred, target_names=label_encoder.classes_, output_dict=True)

print(f"\nWinner: {winner_name} (held-out test macro-F1 = {test_f1:.3f})")
print(classification_report(y_test, y_pred, target_names=label_encoder.classes_))

joblib.dump(
    {"vectorizer": vectorizer, "model": winner_model, "label_encoder": label_encoder},
    OUT_DIR / "risk_classifier.joblib",
)

meta = {
    "algorithm": winner_name,
    "candidates_evaluated": list(candidates.keys()),
    "cv_results": results,
    "held_out_test_macro_f1": float(test_f1),
    "held_out_test_report": report,
    "dataset_size": len(texts),
    "classes": list(label_encoder.classes_),
    "warning": (
        "Trained on a ~180-example hand-written seed dataset (scripts/risk_seed_data.py), "
        "NOT a validated clinical dataset. This is a bootstrap/demo classifier — a third, "
        "advisory signal alongside the deterministic keyword screen and the LLM's own "
        "self-reported risk level. Do not treat its output as clinically meaningful without "
        "retraining on a much larger, properly sourced and reviewed dataset."
    ),
}
with open(OUT_DIR / "risk_classifier_meta.json", "w") as f:
    json.dump(meta, f, indent=2)

print(f"\nSaved {winner_name} model + vectorizer to {OUT_DIR / 'risk_classifier.joblib'}")
print(f"Saved metadata to {OUT_DIR / 'risk_classifier_meta.json'}")
