"""
BraveEve NLP sidecar.

Loads the trained classifier (sentiment_model.pkl, a scikit-learn Pipeline
combining a TfidfVectorizer + LogisticRegression) and exposes it over a
tiny HTTP API so the Node/Express app can call it.

This is a TF-IDF pipeline, not an embeddings model — no PyTorch or
sentence-transformers dependency, which keeps this comfortably within
free/low-tier hosting memory limits (unlike the earlier
sentence-transformers-based version, which needed the full PyTorch
runtime just to embed text).

Run with:
    pip install -r requirements.txt
    python app.py
"""

import os
import joblib
from flask import Flask, request, jsonify

MODEL_PATH = os.environ.get("SENTIMENT_MODEL_PATH", "sentiment_model.pkl")
PORT = int(os.environ.get("SIDECAR_PORT", "5001"))

app = Flask(__name__)

print(f"[sidecar] loading model pipeline from {MODEL_PATH} ...")
pipeline = joblib.load(MODEL_PATH)
print("[sidecar] ready.")


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/classify", methods=["POST"])
def classify():
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()

    if not text:
        return jsonify({"label": "", "note": "empty text"}), 200

    label = pipeline.predict([text])[0]

    response = {"label": str(label)}

    # Include confidence if the pipeline supports it (LogisticRegression does)
    if hasattr(pipeline, "predict_proba"):
        classes = pipeline.named_steps["classifier"].classes_
        probs = pipeline.predict_proba([text])[0]
        response["confidence"] = dict(zip((str(c) for c in classes), (round(float(p), 4) for p in probs)))

    return jsonify(response)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT)
