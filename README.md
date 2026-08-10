# BraveEve — Node/Express port

This replaces the Streamlit app with a Node/Express backend + a plain
HTML/CSS/JS frontend (no React build step, so it's simple to run and host
for a small pilot). The trained distress classifier (`sentiment_model.pkl`
+ sentence-transformers) is unchanged — it now runs behind a small Python
"sidecar" service that Node calls over HTTP, so nothing about the model's
behavior changes.

```
braveeve-app/
  server/
    data/            CSV content (question bank, static messages, etc.)
    src/
      dataLoader.js  loads the CSVs at startup
      content.js     ported constants (mascots, high-risk phrases, etc.)
      classify.js     keyword override + calls the NLP sidecar
      sheets.js       Google Sheets read/write (upsert by session+question)
      state.js        the full step-by-step conversation logic
      server.js       Express routes
  sidecar/
    app.py            Flask service wrapping sentiment_model.pkl
    requirements.txt
  public/
    index.html, app.js, style.css, images/   the frontend
  .env.example
```

## How it works

The original Streamlit app was a big "rerun on every click" script with
`st.session_state`. Here, the *server* owns that same state machine
(`server/src/state.js`) per session, and the frontend is a thin renderer:
it asks the server "what should I show now?" and posts back whatever the
person clicks or types. This keeps all the conversation logic in one
place instead of duplicating it in JS on the client.

## Running it locally

You'll run two processes: the Node app, and the Python NLP sidecar.

### 1. NLP sidecar (Python)

```bash
cd sidecar
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python app.py
# -> listening on http://localhost:5001
```

The first run will download the `all-MiniLM-L6-v2` sentence-transformer
model from Hugging Face (needs internet access once; it's cached after
that).

### 2. Node app

```bash
cp .env.example .env
# fill in GOOGLE_SHEET_ID and the service account credentials, see below
npm install
npm start
# -> http://localhost:3000
```

Open `http://localhost:3000` in a browser.

## Setting up Google Sheets storage

1. Create a new Google Sheet, e.g. "BraveEve Pilot Responses". Add a tab
   named `responses` (matches `GOOGLE_SHEET_TAB` in `.env`).
2. In Google Cloud Console: create a project (or use an existing one),
   enable the **Google Sheets API**, then create a **Service Account**
   and download its JSON key.
3. Share the Google Sheet with the service account's email address
   (looks like `something@project-id.iam.gserviceaccount.com`) with
   **Editor** access.
4. Save the downloaded key as `service-account.json` in the project root
   (or set `GOOGLE_SERVICE_ACCOUNT_JSON` to the key's JSON contents if
   you're deploying somewhere that only accepts env vars).
5. Set `GOOGLE_SHEET_ID` in `.env` — it's the long ID in the sheet's URL:
   `https://docs.google.com/spreadsheets/d/<THIS_PART>/edit`.

The app writes a header row automatically on first save, and updates a
row in place (rather than duplicating it) whenever the same
`session_id` + `question_number` is saved again — the same behavior as
the original `ON CONFLICT ... DO UPDATE` in Postgres.

## What's different from the Streamlit version

- **Storage**: Postgres → Google Sheets (upsert emulated via row lookup).
- **Frontend**: Streamlit widgets → plain HTML/CSS/JS talking to a JSON API.
- **Everything else** (question flow, wording, mascots, the clinical
  keyword override, the trained classifier, section order, pause/resume,
  distress-score banding) is a direct port — nothing about the clinical
  content or logic was changed.

## Not yet implemented (by design, for this pass)

- **Voice notes**: a disabled placeholder button is in the notes section
  of each screen (`public/app.js`, `.mic-btn`) so it's easy to wire in
  once you've picked a speech-to-text approach.
- **Kannada translation**: out of scope for this pass, per your last
  message. The static content all flows through one place
  (`server/data/BraveEve_static_messages.csv`, `content.js`,
  `BraveEve_16th june.csv`/`BraveEve_variables.csv`), so adding a
  language toggle later mainly means adding a `lang` field to the
  session and a Kannada column/file alongside the English one.

## Deploying for the 30-person pilot

Simplest path: one small VM (or a platform like Render/Railway) running
both `npm start` and `python sidecar/app.py`, with `NLP_SIDECAR_URL`
pointed at the sidecar's internal address. In-memory session storage
(`server/src/state.js`) is fine at this scale — sessions live as long as
the Node process stays up. If the server restarts mid-pilot, in-progress
(unfinished) sessions are lost, but everything already answered has
already been written to the Sheet.
