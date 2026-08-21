import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { loadAppData } from "./dataLoader.js";
import { createSession, getSession, applyAction, renderState } from "./state.js";
import { transcribeAndTranslate } from "./voice.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "..", "public");

const appData = loadAppData();
console.log(
  `[data] loaded ${appData.questionBank.length} question-bank items across ${appData.sections.length} sections`
);

const app = express();
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

function requireSession(req, res, next) {
  const session = getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: "Session not found or expired." });
  req.session = session;
  next();
}

app.post("/api/session/start", (req, res) => {
  const session = createSession(appData);
  res.json(renderState(session, appData));
});

app.get("/api/session/:sessionId", requireSession, (req, res) => {
  res.json(renderState(req.session, appData));
});

app.post("/api/session/:sessionId/action", requireSession, async (req, res) => {
  const { type, ...payload } = req.body || {};
  if (!type) return res.status(400).json({ error: "Missing action type" });

  const result = await applyAction(req.session, appData, type, payload);
  if (result && result.error) {
    return res.status(400).json({ error: result.error });
  }
  res.json(renderState(req.session, appData));
});

// Voice note: raw audio bytes in, { nativeText, englishText } out. This is
// pure speech-to-text — no classification and nothing saved here. The
// browser drops englishText into the (still editable) notes textarea, same
// as if the person had typed it; classification + saving only happens when
// they click Next, exactly like a typed note.
app.post(
  "/api/session/:sessionId/transcribe",
  express.raw({ type: "*/*", limit: "10mb" }),
  requireSession,
  async (req, res) => {
    if (!req.body || !Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: "No audio received." });
    }
    try {
      const mimeType = req.headers["content-type"] || "audio/webm";
      const { nativeText, englishText } = await transcribeAndTranslate(req.body, mimeType);
      res.json({ nativeText, englishText });
    } catch (err) {
      console.error("[transcribe] failed:", err);
      res.status(502).json({
        error: "Couldn't transcribe that. Please try again, or type your note instead.",
      });
    }
  }
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`BraveEve server listening on http://localhost:${PORT}`);
});
