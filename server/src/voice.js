/**
 * Wraps Sarvam AI's /speech-to-text endpoint (Saaras v3).
 *
 * For every voice note we make two calls on the same audio clip:
 *   - mode="transcribe" -> text in whatever language was spoken (native script)
 *   - mode="translate"  -> the same content, in English
 *
 * The native-language text is kept purely for the record (so what's saved
 * matches what was actually said); only the English text is ever fed into
 * the distress classifier, same as a typed note.
 *
 * Sarvam's synchronous REST endpoint only accepts clips under 30 seconds —
 * this module doesn't enforce that itself, the frontend caps recording
 * length before it ever gets here.
 */

const SARVAM_STT_URL = "https://api.sarvam.ai/speech-to-text";
const SARVAM_MODEL = "saaras:v3";

async function callSarvamSTT(audioBuffer, mimeType, mode) {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    throw new Error("SARVAM_API_KEY is not set");
  }

  const extension = (mimeType || "").includes("mp4")
    ? "mp4"
    : (mimeType || "").includes("ogg")
    ? "ogg"
    : "webm";

  const form = new FormData();
  let normalizedMimeType = mimeType || "audio/webm";

  // Remove codec information such as ";codecs=opus"
  normalizedMimeType = normalizedMimeType.split(";")[0];

  const blob = new Blob([audioBuffer], {
  type: normalizedMimeType
  });
  form.append("file", blob, `note.${extension}`);
  form.append("model", SARVAM_MODEL);
  form.append("mode", mode);

  const res = await fetch(SARVAM_STT_URL, {
    method: "POST",
    headers: { "api-subscription-key": apiKey },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Sarvam STT (${mode}) failed: HTTP ${res.status} ${body}`);
  }

  const data = await res.json();
  return (data.transcript || "").trim();
}

/**
 * Returns { nativeText, englishText } for one audio clip.
 * The two Sarvam calls run in parallel since they're independent.
 */
export async function transcribeAndTranslate(audioBuffer, mimeType) {
  const [nativeText, englishText] = await Promise.all([
    callSarvamSTT(audioBuffer, mimeType, "transcribe"),
    callSarvamSTT(audioBuffer, mimeType, "translate"),
  ]);
  return { nativeText, englishText };
}
