import { HIGH_RISK_PHRASES } from "./content.js";

const CONTRACTIONS = {
  "i'm": "i am",
  im: "i am",
  "don't": "do not",
  cant: "cannot",
  "can't": "cannot",
  "won't": "will not",
  "isn't": "is not",
  "aren't": "are not",
  "wasn't": "was not",
  "weren't": "were not",
  "haven't": "have not",
  "hasn't": "has not",
  "hadn't": "had not",
  "shouldn't": "should not",
  "wouldn't": "would not",
  "couldn't": "could not",
  "didn't": "did not",
  dont: "do not",
  doesnt: "does not",
  shouldnt: "should not",
  ik: "i know",
  theyre: "they are",
  idk: "i do not know",
  wanna: "want to",
  gonna: "going to",
  "i'll": "i will",
};

/** Mirrors clean_text() in chatbot.py */
export function cleanText(text) {
  let out = String(text).toLowerCase();
  for (const [key, value] of Object.entries(CONTRACTIONS)) {
    out = out.split(key).join(value);
  }
  out = out.replace(/[^a-zA-Z\s]/g, "");
  out = out.replace(/\s+/g, " ").trim();
  return out;
}

const SIDECAR_URL = process.env.NLP_SIDECAR_URL || "http://127.0.0.1:5001";

/**
 * Classifies a free-text note as "YES" (high distress) or "NO".
 * Mirrors the clinical-override + ML-classifier logic in chatbot.py exactly:
 * a fixed keyword/phrase check runs first and short-circuits to YES,
 * otherwise the trained SVC model (via the Python sidecar) decides.
 */
export async function classifyNote(rawText) {
  const noteText = (rawText || "").trim();
  if (noteText === "") {
    return { prediction: "", source: "NONE", cleaned: "" };
  }

  const cleaned = cleanText(noteText);
  const lower = cleaned.toLowerCase();

  const mindCalmOverride =
    lower.includes("mind") &&
    lower.includes("calm") &&
    (lower.includes("never") || lower.includes("not") || lower.includes("cannot"));

  const phraseOverride = HIGH_RISK_PHRASES.some((p) => lower.includes(p));

  if (mindCalmOverride || phraseOverride) {
    return { prediction: "YES", source: "NLP", cleaned };
  }

  try {
    const res = await fetch(`${SIDECAR_URL}/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: cleaned }),
    });

    if (!res.ok) {
      throw new Error(`sidecar responded ${res.status}`);
    }

    const data = await res.json();
    const prediction = String(data.label || "").toUpperCase();
    return { prediction, source: "NLP", cleaned };
  } catch (err) {
    console.error("[classify] NLP sidecar unavailable:", err.message);
    // Fail safe: don't lose the note, just mark it as needing manual review
    // instead of pretending we know the answer.
    return { prediction: "UNAVAILABLE", source: "NLP_ERROR", cleaned };
  }
}
