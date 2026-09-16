import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, f1_score

df = pd.read_csv("server/data/BraveEve_NLP_dataset.csv")
df["label"] = df["label"].str.strip()
df = df.dropna(subset=["text", "label"])

X_train, X_test, y_train, y_test = train_test_split(
    df["text"], df["label"], test_size=0.2, random_state=42, stratify=df["label"]
)

configs = []
for min_df in [1, 2, 3, 5]:
    configs.append((f"Bigrams(min_df={min_df}) + LogisticRegression", Pipeline([
        ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=min_df)),
        ("classifier", LogisticRegression(max_iter=1000)),
    ])))
    configs.append((f"Bigrams(min_df={min_df}) + NaiveBayes", Pipeline([
        ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=min_df)),
        ("classifier", MultinomialNB()),
    ])))

results = []
for name, pipeline in configs:
    pipeline.fit(X_train, y_train)
    y_pred = pipeline.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred, pos_label="YES")
    results.append({"model": name, "accuracy": acc, "f1_YES": f1})
    print(f"{name:45s}  accuracy={acc:.4f}  f1(YES)={f1:.4f}")

print("\n=== SUMMARY (sorted by accuracy) ===")
results_df = pd.DataFrame(results).sort_values("accuracy", ascending=False)
print(results_df.to_string(index=False))
print(f"\n(For reference: original baseline unigrams+LogReg = 0.9302, unigrams+NaiveBayes = 0.9341)")