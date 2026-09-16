import pandas as pd

df = pd.read_csv("server/data/BraveEve_NLP_dataset.csv")
print(df.head())
print(df["label"].value_counts())