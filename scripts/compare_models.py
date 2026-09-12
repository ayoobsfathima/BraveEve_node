import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, f1_score

# 1. Load and clean the data (identical to train_model.py, so the split matches)
df = pd.read_csv("server/data/BraveEve_NLP_dataset.csv")
df["label"] = df["label"].str.strip()
df = df.dropna(subset=["text", "label"])

X_train, X_test, y_train, y_test = train_test_split(
    df["text"], df["label"], test_size=0.2, random_state=42, stratify=df["label"]
)

# 2. Define the model variants we want to compare.
#    Every one uses the SAME train/test split above, so the comparison is fair.
variants = {
    "Baseline: unigrams + LogisticRegression": Pipeline([
        ("tfidf", TfidfVectorizer()),
        ("classifier", LogisticRegression(max_iter=1000)),
    ]),
    "Bigrams + LogisticRegression": Pipeline([
        ("tfidf", TfidfVectorizer(ngram_range=(1, 2))),
        ("classifier", LogisticRegression(max_iter=1000)),
    ]),
    "Unigrams + Naive Bayes": Pipeline([
        ("tfidf", TfidfVectorizer()),
        ("classifier", MultinomialNB()),
    ]),
    "Bigrams + Naive Bayes": Pipeline([
        ("tfidf", TfidfVectorizer(ngram_range=(1, 2))),
        ("classifier", MultinomialNB()),
    ]),
}

# 3. Train and evaluate each variant, collect results
results = []
for name, pipeline in variants.items():
    pipeline.fit(X_train, y_train)
    y_pred = pipeline.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred, pos_label="YES")
    results.append({"model": name, "accuracy": acc, "f1_YES": f1})
    print(f"{name:45s}  accuracy={acc:.4f}  f1(YES)={f1:.4f}")

# 4. Show a clean summary sorted by accuracy, best first
print("\n=== SUMMARY (sorted by accuracy) ===")
results_df = pd.DataFrame(results).sort_values("accuracy", ascending=False)
print(results_df.to_string(index=False))