import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

# 1. Load and clean the data (same as train_model.py)
df = pd.read_csv("server/data/BraveEve_NLP_dataset.csv")
df["label"] = df["label"].str.strip()
df = df.dropna(subset=["text", "label"])

# 2. Same split as before (same random_state=42, so it's the same test set)
X_train, X_test, y_train, y_test = train_test_split(
    df["text"], df["label"], test_size=0.2, random_state=42, stratify=df["label"]
)

# 3. Train the same baseline model
pipeline = Pipeline([
    ("tfidf", TfidfVectorizer()),
    ("classifier", LogisticRegression(max_iter=1000)),
])
pipeline.fit(X_train, y_train)

# 4. Predict on the test set, and get confidence scores too
y_pred = pipeline.predict(X_test)
probs = pipeline.predict_proba(X_test)
classes = pipeline.named_steps["classifier"].classes_

# 5. Build a results table so we can inspect mistakes
results = pd.DataFrame({
    "text": X_test.values,
    "true_label": y_test.values,
    "predicted_label": y_pred,
})
for i, c in enumerate(classes):
    results[f"confidence_{c}"] = probs[:, i]

# 6. Filter to only the WRONG predictions
mistakes = results[results["true_label"] != results["predicted_label"]].copy()

print(f"Total test examples: {len(results)}")
print(f"Total mistakes: {len(mistakes)} ({len(mistakes)/len(results):.1%} of test set)\n")

# 7. Flag "low confidence" correct predictions -- got it right, but unsure
results["max_confidence"] = results[[f"confidence_{c}" for c in classes]].max(axis=1)
low_confidence_correct = results[
    (results["true_label"] == results["predicted_label"]) & (results["max_confidence"] < 0.65)
]

pd.set_option("display.max_colwidth", 100)
pd.set_option("display.width", 140)

print("=== MISCLASSIFIED EXAMPLES (model got these wrong) ===\n")
print(mistakes[["text", "true_label", "predicted_label"]].to_string(index=False))

print(f"\n\n=== LOW-CONFIDENCE CORRECT PREDICTIONS ({len(low_confidence_correct)}) ===")
print("(model got these right, but was unsure -- worth reviewing too)\n")
print(low_confidence_correct[["text", "true_label", "max_confidence"]].head(20).to_string(index=False))

# 8. Save full results to a CSV so you can scroll through everything comfortably
mistakes.to_csv("scripts/misclassified_examples.csv", index=False)
print("\n\nFull list of mistakes saved to scripts/misclassified_examples.csv")