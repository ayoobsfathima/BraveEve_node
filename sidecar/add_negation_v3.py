import pandas as pd

# Small, TIGHTLY targeted batch -- short "not [positive word]" phrases.
# Unlike the earlier casual/slang batch (which hurt accuracy), these are
# kept short, plain, and stylistically consistent with the existing
# dataset's short direct-answer entries (e.g. "not really", "i am not okay").
#
# Goal: reinforce that "not" + a positive-state word (okay/fine/well/good)
# should flip the label to YES, even in very short sentences with little
# other context for the model to rely on.

new_examples = [
    # YES: short, bare negation of a positive state
    ("I am not okay", "YES"),
    ("I'm not okay", "YES"),
    ("I am not fine", "YES"),
    ("I'm not fine", "YES"),
    ("I am not doing okay", "YES"),
    ("I'm not doing well", "YES"),
    ("not okay at all", "YES"),
    ("not really okay", "YES"),
    ("I don't feel okay", "YES"),
    ("I don't feel fine", "YES"),
    ("I really am not okay", "YES"),
    ("honestly not okay", "YES"),
    ("I am not well", "YES"),
    ("not feeling well at all", "YES"),
    ("I'm definitely not fine", "YES"),

    # NO: short, plain confirmations of a positive state
    ("I am okay", "NO"),
    ("I'm okay", "NO"),
    ("I am fine", "NO"),
    ("I'm fine", "NO"),
    ("I am doing okay", "NO"),
    ("I'm doing well", "NO"),
    ("okay, all good", "NO"),
    ("pretty okay actually", "NO"),
    ("I feel okay", "NO"),
    ("I feel fine", "NO"),
    ("I really am okay", "NO"),
    ("honestly I'm okay", "NO"),
    ("I am well", "NO"),
    ("feeling well today", "NO"),
    ("I'm definitely fine", "NO"),
]

print(f"New examples to add: {len(new_examples)}")
new_df = pd.DataFrame(new_examples, columns=["text", "label"])
print(new_df["label"].value_counts())

# Build on the CLEANED dataset (the best-performing base), not the earlier
# casual-augmented v2 version.
existing_df = pd.read_csv("BraveEve_NLP_dataset_clean.csv")

existing_texts = set(existing_df["text"].str.strip().str.lower())
overlap = [t for t, _ in new_examples if t.strip().lower() in existing_texts]
if overlap:
    print(f"\n{len(overlap)} already exist and will be skipped:")
    for t in overlap:
        print(f"  '{t}'")
    new_df = new_df[~new_df["text"].str.strip().str.lower().isin(existing_texts)]

combined_df = pd.concat([existing_df, new_df], ignore_index=True)
combined_df.to_csv("BraveEve_NLP_dataset_v3.csv", index=False)
print(f"\nSaved: {len(combined_df)} total rows "
      f"({len(existing_df)} previous + {len(new_df)} newly added)")
print("-> sidecar/BraveEve_NLP_dataset_v3.csv")