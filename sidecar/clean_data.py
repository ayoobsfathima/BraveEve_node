import pandas as pd

pd.set_option("display.max_colwidth", 100)

# 1. Load the original data
df = pd.read_csv("../server/data/BraveEve_NLP_dataset.csv")
df["label"] = df["label"].str.strip()
df = df.dropna(subset=["text", "label"])
df["text_clean"] = df["text"].str.strip().str.lower()

print(f"Original rows: {len(df)}")

# 2. Resolve conflicting labels using MAJORITY VOTE
#    For each unique text, find which label appears more often.
#    If it's a tie, we can't safely decide automatically -- flag it instead.
label_counts = df.groupby(["text_clean", "label"]).size().unstack(fill_value=0)

resolved_labels = {}
tied_texts = []
for text_clean, row in label_counts.iterrows():
    yes_count = row.get("YES", 0)
    no_count = row.get("NO", 0)
    if yes_count == no_count:
        tied_texts.append(text_clean)
    else:
        resolved_labels[text_clean] = "YES" if yes_count > no_count else "NO"

print(f"Texts with a genuine tie (can't auto-resolve): {len(tied_texts)}")
if tied_texts:
    print("\nTied texts -- these need a manual decision:")
    for t in tied_texts:
        print(f"  '{t}'")

# 3. Drop the tied/ambiguous texts entirely (safer than guessing)
df = df[~df["text_clean"].isin(tied_texts)].copy()

# 4. Apply the resolved (majority-vote) label to every row of that text
df["label"] = df["text_clean"].map(lambda t: resolved_labels.get(t, None)).fillna(df["label"])

# 5. Now remove exact duplicates -- keep just the FIRST occurrence of each
#    unique text, since after step 4 all copies of the same text now
#    agree on the label anyway.
before_dedup = len(df)
df_clean = df.drop_duplicates(subset=["text_clean"], keep="first").copy()
after_dedup = len(df_clean)

print(f"\nRows before dedup: {before_dedup}")
print(f"Rows after dedup:  {after_dedup}  (removed {before_dedup - after_dedup} duplicate rows)")

# 6. Final class balance check
print(f"\nFinal class balance:")
print(df_clean["label"].value_counts().to_string())

# 7. Save the cleaned dataset as a NEW file (never overwrite the original --
#    keep it as a safety net / reference)
output_cols = ["text", "label"]
df_clean[output_cols].to_csv("BraveEve_NLP_dataset_clean.csv", index=False)
print(f"\nCleaned dataset saved to sidecar/BraveEve_NLP_dataset_clean.csv "
      f"({len(df_clean)} rows)")