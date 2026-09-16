import aiClient from "../lib/aiClient";

// The ML risk classifier (trained RandomForest/XGBoost, see ai-service/app/services/ml_risk.py)
// is the one piece staying in Python — no practical Node equivalent to load a scikit-learn
// joblib bundle without retraining. This calls it over HTTP the same way node-api already
// calls every other internal-key-protected ai-service route. Advisory only: see chat.ts for
// the severity-merge logic (never downgrades, never triggers the crisis-bridge reply by itself).
export interface MlRiskResult {
  level: string;
  confidence: number;
  available: boolean;
}

export async function classifyRisk(text: string): Promise<MlRiskResult> {
  try {
    const response = await aiClient.post<MlRiskResult>("/risk/classify", { text });
    return response.data;
  } catch (err) {
    console.error("risk-classifier /risk/classify call failed:", (err as Error).message);
    return { level: "none", confidence: 0, available: false };
  }
}
