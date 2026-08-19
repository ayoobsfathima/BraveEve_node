/**
 * Verifies the Google Sheets connection works: writes one test row, then
 * reads it back. Run this after setting up GOOGLE_SHEET_ID and your
 * service account credentials in .env, before trusting the app's writes.
 *
 * Usage:
 *   node scripts/test_sheets_connection.js
 */

import "dotenv/config";
import { google } from "googleapis";
import { saveResponses } from "../server/src/sheets.js";

const SHEET_NAME = process.env.GOOGLE_SHEET_TAB || "responses";

function getAuth() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "./service-account.json";
  if (keyJson) {
    return new google.auth.GoogleAuth({
      credentials: JSON.parse(keyJson),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  }
  return new google.auth.GoogleAuth({
    keyFile,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

async function main() {
  console.log("1. Checking environment variables...");
  if (!process.env.GOOGLE_SHEET_ID) {
    console.error("   ✗ GOOGLE_SHEET_ID is not set in .env");
    process.exit(1);
  }
  console.log(`   ✓ GOOGLE_SHEET_ID = ${process.env.GOOGLE_SHEET_ID}`);
  console.log(`   ✓ GOOGLE_SHEET_TAB = ${SHEET_NAME}`);

  console.log("\n2. Authenticating with Google...");
  const auth = getAuth();
  let authClient;
  try {
    authClient = await auth.getClient();
    console.log("   ✓ Authenticated");
  } catch (err) {
    console.error("   ✗ Auth failed:", err.message);
    console.error(
      "   Check GOOGLE_SERVICE_ACCOUNT_FILE points to a valid key file, or\n" +
        "   GOOGLE_SERVICE_ACCOUNT_JSON contains valid JSON."
    );
    process.exit(1);
  }

  console.log("\n3. Checking access to the spreadsheet...");
  const sheets = google.sheets({ version: "v4", auth: authClient });
  let serviceAccountEmail = "(unknown)";
  try {
    const creds = JSON.parse(
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
        (await import("fs")).readFileSync(
          process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "./service-account.json",
          "utf8"
        )
    );
    serviceAccountEmail = creds.client_email;
  } catch {
    // best-effort, only used for a friendlier error message below
  }

  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID });
    console.log(`   ✓ Connected to spreadsheet: "${meta.data.properties.title}"`);
    const tabNames = meta.data.sheets.map((s) => s.properties.title);
    if (!tabNames.includes(SHEET_NAME)) {
      console.error(
        `   ✗ No tab named "${SHEET_NAME}" found. Existing tabs: ${tabNames.join(", ")}`
      );
      console.error(`   Add a tab named "${SHEET_NAME}" (or set GOOGLE_SHEET_TAB to match).`);
      process.exit(1);
    }
    console.log(`   ✓ Tab "${SHEET_NAME}" exists`);
  } catch (err) {
    console.error("   ✗ Could not access the spreadsheet:", err.message);
    console.error(
      `   Make sure the sheet is shared (Editor access) with:\n   ${serviceAccountEmail}`
    );
    process.exit(1);
  }

  console.log("\n4. Writing a test row...");
  const testSessionId = `TEST_${Date.now()}`;
  await saveResponses([
    {
      session_id: testSessionId,
      timestamp: new Date().toISOString(),
      name: "Connection Test",
      distress_score: 0,
      question_number: 0,
      category: "Test",
      problem_item: "Connectivity check",
      answer: "OK",
      response_source: "TEST_SCRIPT",
      free_text: "This row confirms the app can write to this sheet.",
      completed_at: new Date().toISOString(),
      session_duration_seconds: 0,
      session_duration_minutes: 0,
    },
  ]);
  console.log(`   ✓ Wrote a row with session_id = ${testSessionId}`);

  console.log("\n5. Reading it back to confirm...");
  const readBack = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!A:A`,
  });
  const found = (readBack.data.values || []).some((row) => row[0] === testSessionId);
  if (found) {
    console.log("   ✓ Found it in the sheet — round trip confirmed.");
  } else {
    console.error("   ✗ Wrote the row but couldn't find it on read-back. Something's off.");
    process.exit(1);
  }

  console.log(
    `\nAll checks passed. Go delete the "${testSessionId}" test row from your sheet, ` +
      "then you're good to go."
  );
}

main().catch((err) => {
  console.error("\nUnexpected error:", err);
  process.exit(1);
});
