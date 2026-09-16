import re

# Words that trigger "negation scope" -- everything after one of these,
# until the next punctuation mark, gets tagged with _NEG.
NEGATION_TRIGGERS = {
    "not", "no", "never", "cannot", "cant", "dont", "doesnt", "didnt",
    "isnt", "wasnt", "werent", "arent", "wont", "wouldnt", "couldnt",
    "shouldnt", "havent", "hasnt", "hadnt",
}


def negate_text(text):
    """
    Rewrites negated words so TF-IDF treats them as distinct features.
    Example: "I am not okay" -> "I am not okay_NEG"
             "I am okay"     -> "I am okay"  (unchanged)

    This lets the model learn that 'okay_NEG' predicts YES while plain
    'okay' predicts NO, instead of both sharing one confused signal.
    """
    if not isinstance(text, str):
        return text

    words = text.split()
    result = []
    negating = False

    for word in words:
        clean = re.sub(r"[^\w']", "", word.lower())
        clean_no_apostrophe = clean.replace("'", "")

        if negating:
            result.append(word + "_NEG")
        else:
            result.append(word)

        if clean in NEGATION_TRIGGERS or clean_no_apostrophe in NEGATION_TRIGGERS or clean.endswith("nt"):
            negating = True

        if re.search(r"[.,!?;:]", word):
            negating = False

    return " ".join(result)