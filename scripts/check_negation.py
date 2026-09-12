import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

df = pd.read_csv("server/data/BraveEve_NLP_dataset.csv")
df["label"] = df["label"].str.strip()
df = df.dropna(subset=["text", "label"])

X_train, X_test, y_train, y_test = train_test_split(
    df["text"], df["label"], test_size=0.2, random_state=42, stratify=df["label"]
)

baseline = Pipeline([
    ("tfidf", TfidfVectorizer()),
    ("classifier", LogisticRegression(max_iter=1000)),
])
baseline.fit(X_train, y_train)

bigram_model = Pipeline([
    ("tfidf", TfidfVectorizer(ngram_range=(1, 2))),
    ("classifier", LogisticRegression(max_iter=1000)),
])
bigram_model.fit(X_train, y_train)

pred_baseline = baseline.predict(X_test)
pred_bigram = bigram_model.predict(X_test)

results = pd.DataFrame({
    "text": X_test.values,
    "true_label": y_test.values,
    "baseline_pred": pred_baseline,
    "bigram_pred": pred_bigram,
})

negation_words = ["not", "n't", "no ", "never", "dont", "don't"]
def has_negation(text):
    t = text.lower()
    return any(neg in t for neg in negation_words)

results["has_negation"] = results["text"].apply(has_negation)
negation_cases = results[results["has_negation"]].copy()

negation_cases["baseline_correct"] = negation_cases["baseline_pred"] == negation_cases["true_label"]
negation_cases["bigram_correct"] = negation_cases["bigram_pred"] == negation_cases["true_label"]

print(f"Total negation-containing examples in test set: {len(negation_cases)}\n")

baseline_acc = negation_cases["baseline_correct"].mean()
bigram_acc = negation_cases["bigram_correct"].mean()
print(f"Baseline accuracy on negation examples: {baseline_acc:.4f}")
print(f"Bigram accuracy on negation examples:   {bigram_acc:.4f}\n")

fixed_by_bigrams = negation_cases[~negation_cases["baseline_correct"] & negation_cases["bigram_correct"]]
broken_by_bigrams = negation_cases[negation_cases["baseline_correct"] & ~negation_cases["bigram_correct"]]

print(f"Fixed by bigrams (baseline wrong -> bigram right): {len(fixed_by_bigrams)}")
print(f"Broken by bigrams (baseline right -> bigram wrong): {len(broken_by_bigrams)}\n")

pd.set_option("display.max_colwidth", 90)

if len(fixed_by_bigrams) > 0:
    print("=== FIXED by bigrams ===")
    print(fixed_by_bigrams[["text", "true_label", "baseline_pred", "bigram_pred"]].to_string(index=False))

if len(broken_by_bigrams) > 0:
    print("\n=== BROKEN by bigrams ===")
    print(broken_by_bigrams[["text", "true_label", "baseline_pred", "bigram_pred"]].to_string(index=False))
