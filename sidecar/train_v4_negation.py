import pandas as pd
import joblib
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC
from sklearn.calibration import CalibratedClassifierCV
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, f1_score, classification_report

from negation_utils import negate_text

df = pd.read_csv("BraveEve_NLP_dataset_v3.csv")
df = df.dropna(subset=["text", "label"]).copy()
df["label"] = df["label"].str.strip()

df["text_tagged"] = df["text"].apply(negate_text)

print(f"Training on {len(df)} rows")
print("\nExample transformation:")
for original in ["I am not okay", "I am okay", "not really okay, but managing"]:
    print(f"  '{original}'  ->  '{negate_text(original)}'")

X_train, X_test, y_train, y_test = train_test_split(
    df["text_tagged"], df["label"], test_size=0.2, random_state=42, stratify=df["label"]
)

pipeline = Pipeline([
    ("tfidf", TfidfVectorizer()),
    ("classifier", CalibratedClassifierCV(LinearSVC(max_iter=5000), cv=5)),
])
pipeline.fit(X_train, y_train)
y_pred = pipeline.predict(X_test)

acc = accuracy_score(y_test, y_pred)
f1 = f1_score(y_test, y_pred, pos_label="YES")
print(f"\n=== Held-out test performance ===")
print(f"Accuracy: {acc:.4f}")
print(f"F1 (YES): {f1:.4f}")
print(classification_report(y_test, y_pred))

print("=== Targeted check ===")
test_cases = ["I am not okay", "I am okay", "not really okay", "I'm not fine",
              "I feel really anxious and scared right now", "I do not have any pain today"]
for text in test_cases:
    tagged = negate_text(text)
    pred = pipeline.predict([tagged])[0]
    probs = pipeline.predict_proba([tagged])[0]
    classes = pipeline.named_steps["classifier"].classes_
    conf = dict(zip(classes, [round(float(p), 4) for p in probs]))
    print(f"  '{text}' -> {pred}  {conf}")

final_pipeline = Pipeline([
    ("tfidf", TfidfVectorizer()),
    ("classifier", CalibratedClassifierCV(LinearSVC(max_iter=5000), cv=5)),
])
final_pipeline.fit(df["text_tagged"], df["label"])
joblib.dump(final_pipeline, "sentiment_model_v4.pkl")
print(f"\nFinal model saved to sentiment_model_v4.pkl ({len(df)} rows)")
print("IMPORTANT: app.py must apply negate_text() to incoming text before predicting")