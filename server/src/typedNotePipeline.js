/**
 * Handles typed free-text notes that DIDN'T come from voice (voice notes
 * already get English + native text from Sarvam's speech-to-text). Runs
 * off what was actually typed, independent of the session's UI language —
 * someone can have the interface in English but still type a note in
 * Kannada, and this still catches it.
 *
 * Pipeline:
 *   1. Language ID  (/text-lid)       -> which language, which script
 *   2. If romanized ("Kanglish", e.g. "nanage nidde barthilla") ->
 *      Transliterate (/transliterate) -> proper Kannada script first
 *   3. Translate (/translate) -> English, for the classifier
 *
 * Fails safe: any Sarvam error along the way just falls back to treating
 * the text as plain English rather than blocking the person's note.
 */

const SARVAM_BASE = "https://api.sarvam.ai";
const TRANSLATE_MODEL = "mayura:v1";
const TRANSLATE_MODE = "modern-colloquial";

function apiKey() {
  const key = process.env.SARVAM_API_KEY;
  if (!key) throw new Error("SARVAM_API_KEY is not set");
  return key;
}

async function sarvamPost(path, body) {
  const res = await fetch(`${SARVAM_BASE}${path}`, {
    method: "POST",
    headers: {
      "api-subscription-key": apiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Sarvam ${path} failed: HTTP ${res.status} ${errBody}`);
  }
  return res.json();
}

async function identifyLanguage(text) {
  const data = await sarvamPost("/text-lid", { input: text });
  return { languageCode: data.language_code, scriptCode: data.script_code };
}

async function transliterate(text, sourceLanguageCode, targetLanguageCode) {
  const data = await sarvamPost("/transliterate", {
    input: text,
    source_language_code: sourceLanguageCode,
    target_language_code: targetLanguageCode,
    numerals_format: "international",
  });
  return data.transliterated_text;
}

async function translateText(text, sourceLanguageCode, targetLanguageCode) {
  const data = await sarvamPost("/translate", {
    input: text,
    source_language_code: sourceLanguageCode,
    target_language_code: targetLanguageCode,
    model: TRANSLATE_MODEL,
    mode: TRANSLATE_MODE,
    numerals_format: "international",
  });
  return data.translated_text;
}

/**
 * Returns { englishText, nativeText } for a typed note.
 * nativeText is "" when the note was already plain English (nothing
 * separate to preserve as a native-language record).
 */
export async function processTypedNote(rawText) {
  const trimmed = (rawText || "").trim();
  if (!trimmed) return { englishText: "", nativeText: "" };

  let lid;
  try {
    lid = await identifyLanguage(trimmed);
  } catch (err) {
    console.error("[typedNotePipeline] language ID failed, treating as English:", err.message);
    return { englishText: trimmed, nativeText: "" };
  }

  // Already English -> nothing to do.
  if (!lid.languageCode || lid.languageCode === "en-IN") {
    return { englishText: trimmed, nativeText: "" };
  }

  try {
    let kannadaScriptText = trimmed;

    // Romanized/phonetic input ("Kanglish") -- convert to proper Kannada
    // script first, since translation works off actual script text.
    if (lid.scriptCode === "Latn") {
      kannadaScriptText = await transliterate(trimmed, "en-IN", "kn-IN");
    }

    const englishText = await translateText(kannadaScriptText, "kn-IN", "en-IN");
    return { englishText, nativeText: kannadaScriptText };
  } catch (err) {
    console.error("[typedNotePipeline] translation failed, using raw text as-is:", err.message);
    return { englishText: trimmed, nativeText: "" };
  }
}
