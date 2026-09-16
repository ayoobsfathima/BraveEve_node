import pandas as pd

pd.set_option("display.max_colwidth", 100)
pd.set_option("display.width", 140)

df = pd.read_csv("../server/data/BraveEve_NLP_dataset.csv")
df["label"] = df["label"].str.strip()
df = df.dropna(subset=["text", "label"])
df["text_clean"] = df["text"].str.strip().str.lower()

print("=" * 70)
print(f"TOTAL ROWS: {len(df)}")
print("=" * 70)

exact_dupes = df[df.duplicated(subset=["text_clean", "label"], keep=False)]
print(f"\n1. EXACT DUPLICATES (same text + same label): {len(exact_dupes)} rows")
print("   (these don't hurt correctness, but inflate the dataset with redundant signal)")
if len(exact_dupes) > 0:
    top_dupes = exact_dupes["text_clean"].value_counts().head(10)
    print("\n   Most repeated exact texts:")
    print(top_dupes.to_string())

conflict_check = df.groupby("text_clean")["label"].nunique()
conflicting_texts = conflict_check[conflict_check > 1].index
conflicts = df[df["text_clean"].isin(conflicting_texts)].sort_values("text_clean")
print(f"\n2. CONFLICTING LABELS (same text labeled BOTH YES and NO): {len(conflicting_texts)} unique texts")
print("   (this is a genuine data quality problem -- the model gets contradictory signal)")
if len(conflicting_texts) > 0:
    print("\n   Examples:")
    print(conflicts[["text", "label"]].head(20).to_string(index=False))

df["word_count"] = df["text_clean"].str.split().str.len()
very_short = df[df["word_count"] <= 2].copy()
print(f"\n3. VERY SHORT ENTRIES (<=2 words): {len(very_short)} rows ({len(very_short)/len(df):.1%} of data)")
print("   (these often lack enough context to be reliably classified -- even by a human)")
if len(very_short) > 0:
    print("\n   Sample:")
    print(very_short[["text", "label"]].sample(min(15, len(very_short)), random_state=1).to_string(index=False))

print(f"\n4. CLASS BALANCE:")
print(df["label"].value_counts().to_string())

print(f"\n5. TEXT LENGTH STATS BY LABEL (word count):")
print(df.groupby("label")["word_count"].describe().to_string())

review_df = pd.concat([
    conflicts.assign(issue="conflicting_label"),
    very_short.assign(issue="very_short"),
]).drop(columns=["text_clean", "word_count"], errors="ignore")
review_df.to_csv("data_quality_flags.csv", index=False)
print(f"\n\nFlagged rows saved to sidecar/data_quality_flags.csv for manual review "
      f"({len(review_df)} total flagged rows)")