"""
BraveEve NLP sidecar.

Loads the existing trained classifier (sentiment_model.pkl, a scikit-learn
SVC trained on sentence-transformers embeddings) and exposes it over a tiny
HTTP API so the Node/Express app can call it. This is the *only* Python
piece left in the stack — everything else has moved to Node.

Run with:
    pip install -r requirements.txt
    python app.py
"""

import os
import joblib
from flask import Flask, request, jsonify
from sentence_transformers import SentenceTransformer

MODEL_PATH = os.environ.get("SENTIMENT_MODEL_PATH", "sentiment_model.pkl")
ENCODER_NAME = os.environ.get("ENCODER_NAME", "sentence-transformers/all-MiniLM-L6-v2")
PORT = int(os.environ.get("SIDECAR_PORT", "5001"))

app = Flask(__name__)

print(f"[sidecar] loading classifier from {MODEL_PATH} ...")
classifier = joblib.load(MODEL_PATH)

print(f"[sidecar] loading sentence encoder {ENCODER_NAME} ...")
encoder = SentenceTransformer(ENCODER_NAME)

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

    embedding = encoder.encode([text])
    label = classifier.predict(embedding)[0]

    return jsonify({"label": str(label)})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT)
