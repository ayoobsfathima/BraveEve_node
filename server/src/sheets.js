import { google } from "googleapis";

const SHEET_NAME = process.env.GOOGLE_SHEET_TAB || "responses";

// Column order — keep in sync with HEADER below and with buildRow().
const HEADER = [
  "session_id",
  "timestamp",
  "name",
  "distress_score",
  "question_number",
  "category",
  "problem_item",
  "answer",
  "response_source",
  "free_text",
  "completed_at",
  "session_duration_seconds",
  "session_duration_minutes",
];

let sheetsClient = null;
// In-memory index of "sessionId|questionNumber" -> 1-based sheet row number,
// rebuilt from the sheet on startup and kept up to date as we write.
// This is what lets us emulate ON CONFLICT (session_id, question_number)
// DO UPDATE against a plain spreadsheet.
let rowIndex = new Map();
let headerEnsured = false;

function getAuth() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;

  if (keyJson) {
    const credentials = JSON.parse(keyJson);
    return new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  }

  return new google.auth.GoogleAuth({
    keyFile: keyFile || "./service-account.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

async function getClient() {
  if (sheetsClient) return sheetsClient;
  const auth = getAuth();
  const authClient = await auth.getClient();
  sheetsClient = google.sheets({ version: "v4", auth: authClient });
  return sheetsClient;
}

function spreadsheetId() {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) {
    throw new Error(
      "GOOGLE_SHEET_ID is not set. Create a Google Sheet, share it with " +
        "the service account email, and set GOOGLE_SHEET_ID in your .env"
    );
  }
  return id;
}

async function ensureHeaderAndIndex() {
  if (headerEnsured) return;

  const sheets = await getClient();
  const id = spreadsheetId();

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: id,
    range: `${SHEET_NAME}!A1:M`,
  });

  const rows = resp.data.values || [];

  if (rows.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: id,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADER] },
    });
  } else {
    // Rebuild the session_id/question_number -> row index map from
    // whatever is already in the sheet (rows[0] is the header).
    rowIndex = new Map();
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const sessionId = row[0];
      const questionNumber = row[4];
      if (sessionId === undefined || questionNumber === undefined) continue;
      rowIndex.set(`${sessionId}|${questionNumber}`, i + 1); // 1-based sheet row
    }
  }

  headerEnsured = true;
}

function buildRow(entry) {
  return [
    entry.session_id,
    entry.timestamp,
    entry.name,
    entry.distress_score ?? "",
    entry.question_number,
    entry.category,
    entry.problem_item,
    entry.answer,
    entry.response_source,
    entry.free_text,
    entry.completed_at,
    entry.session_duration_seconds ?? "",
    entry.session_duration_minutes ?? "",
  ];
}

/**
 * Saves (upserts) a batch of response rows to Google Sheets.
 * Mirrors save_responses() in chatbot.py.
 */
export async function saveResponses(entries) {
  if (!entries || entries.length === 0) return;

  await ensureHeaderAndIndex();
  const sheets = await getClient();
  const id = spreadsheetId();

  const updates = [];
  const appends = [];

  for (const entry of entries) {
    const key = `${entry.session_id}|${entry.question_number}`;
    const row = buildRow(entry);

    if (rowIndex.has(key)) {
      updates.push({ range: `${SHEET_NAME}!A${rowIndex.get(key)}`, values: [row] });
    } else {
      appends.push({ entry, row });
    }
  }

  if (updates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: id,
      requestBody: {
        valueInputOption: "RAW",
        data: updates,
      },
    });
  }

  if (appends.length > 0) {
    // Find current row count so we can predict the row numbers the
    // appended rows will land on (append doesn't tell us row numbers
    // per-row when sending several rows in one call).
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: id,
      range: `${SHEET_NAME}!A:A`,
    });
    let nextRow = (resp.data.values || []).length + 1;

    await sheets.spreadsheets.values.append({
      spreadsheetId: id,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: appends.map((a) => a.row) },
    });

    for (const { entry } of appends) {
      const key = `${entry.session_id}|${entry.question_number}`;
      rowIndex.set(key, nextRow);
      nextRow += 1;
    }
  }
}
