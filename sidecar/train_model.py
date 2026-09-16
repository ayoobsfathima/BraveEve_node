import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, classification_report

# 1. Load and clean the data
df = pd.read_csv("server/data/BraveEve_NLP_dataset.csv")
df["label"] = df["label"].str.strip()  # remove stray whitespace like "YES "
df = df.dropna(subset=["text", "label"])

print(f"Total examples: {len(df)}")
print(df["label"].value_counts())

# 2. Split into train (80%) and test (20%) sets
X_train, X_test, y_train, y_test = train_test_split(
    df["text"], df["label"], test_size=0.2, random_state=42, stratify=df["label"]
)

# 3. Build and train the baseline pipeline (same style as current model)
pipeline = Pipeline([
    ("tfidf", TfidfVectorizer()),
    ("classifier", LogisticRegression(max_iter=1000)),
])
pipeline.fit(X_train, y_train)

# 4. Evaluate honestly on the held-out test set
y_pred = pipeline.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)

print(f"\nBaseline accuracy: {accuracy:.4f}")
print("\nDetailed report:")
print(classification_report(y_test, y_pred))