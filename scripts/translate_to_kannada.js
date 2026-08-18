/**
 * Translates BraveEve's live content CSVs to Kannada using Sarvam AI's
 * translation API, and writes parallel *_kn.csv files alongside the
 * English originals.
 *
 * Usage:
 *   export SARVAM_API_KEY=your_key_here
 *   node scripts/translate_to_kannada.js
 *
 * What this does and doesn't translate:
 *   - BraveEve_static_messages.csv: translates "Message", leaves "Key" as-is
 *     (Key is an internal lookup id used throughout the code, e.g. ASK_NAME).
 *   - BraveEve_name_affirmations.csv: translates the single "Messages" column.
 *   - BraveEve_variables.csv: translates every column (Category, Problem
 *     List Item, Question, Verbatim, Yes, No). The output file keeps rows
 *     in EXACTLY the same order as the English source, so the app can pair
 *     English row N with Kannada row N later (English stays the internal
 *     key for section/mascot/checkbox-state logic; Kannada is display-only).
 *
 * Content that lives in server/src/content.js (SECTION_INTROS,
 * NOTES_RESPONSE_YES/NO, NOTES_BOX_PROMPTS, CLOSING_ACKNOWLEDGMENTS) is NOT
 * covered by this script — see the README note below for why, and what to
 * do about it.
 *
 * Safe to re-run: translated strings are cached in
 * scripts/.translation-cache.json, keyed by the exact source string, so a
 * crash partway through (or a second run after editing the English source)
 * only pays for what's new.
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";
import { toCsv } from "./csvUtil.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "server", "data");
const CACHE_PATH = path.join(__dirname, ".translation-cache.json");

const API_KEY = process.env.SARVAM_API_KEY;
if (!API_KEY) {
  console.error("Missing SARVAM_API_KEY environment variable.");
  process.exit(1);
}

// --- tune these if you want a different register or you're translating a
// --- different language later ---
const SOURCE_LANG = "en-IN";
const TARGET_LANG = "kn-IN";
const MODEL = "mayura:v1";
const MODE = "classic-colloquial"; // try "modern-colloquial" too and compare
const NUMERALS_FORMAT = "international";
const DELAY_MS = 250; // be gentle on rate limits across ~150+ calls

function readCsv(filename) {
  const raw = fs.readFileSync(path.join(DATA_DIR, filename), "utf8").replace(/^\uFEFF/, "");
  return parse(raw, { columns: true, skip_empty_lines: true, trim: false });
}

function loadCache() {
  if (!fs.existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
  } catch {
    return {};
  }
}

function saveCache(cache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function translateOne(text, cache, { retries = 3 } = {}) {
  const trimmed = (text || "").trim();
  if (trimmed === "" || trimmed.toLowerCase() === "nan") return text || "";

  if (cache[trimmed]) return cache[trimmed];

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch("https://api.sarvam.ai/translate", {
        method: "POST",
        headers: {
          "api-subscription-key": API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: trimmed,
          source_language_code: SOURCE_LANG,
          target_language_code: TARGET_LANG,
          model: MODEL,
          mode: MODE,
          numerals_format: NUMERALS_FORMAT,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body}`);
      }

      const data = await res.json();
      const translated = data.translated_text;
      cache[trimmed] = translated;
      return translated;
    } catch (err) {
      console.warn(`  [attempt ${attempt}/${retries}] failed for "${trimmed.slice(0, 40)}...": ${err.message}`);
      if (attempt === retries) throw err;
      await sleep(1000 * attempt);
    }
  }
}

async function translateColumn(rows, column, cache, label) {
  for (let i = 0; i < rows.length; i++) {
    const original = rows[i][column];
    process.stdout.write(`\r  [${label}] ${i + 1}/${rows.length}`.padEnd(60));
    rows[i][column] = await translateOne(original, cache);
    await sleep(DELAY_MS);
  }
  process.stdout.write("\n");
}

function writeCsv(filename, rows, columns) {
  // Prepend a UTF-8 BOM so Excel (especially on Windows) reliably detects
  // the encoding and renders Kannada correctly instead of showing garbled
  // characters. Our own app strips this BOM automatically when reading, so
  // it's safe either way.
  fs.writeFileSync(path.join(DATA_DIR, filename), "\uFEFF" + toCsv(rows, columns));
}

async function main() {
  const cache = loadCache();

  // --- 1. static messages: translate Message, keep Key ---
  console.log("Translating BraveEve_static_messages.csv ...");
  const staticRows = readCsv("BraveEve_static_messages.csv");
  await translateColumn(staticRows, "Message", cache, "static_messages");
  writeCsv("BraveEve_static_messages_kn.csv", staticRows, ["Key", "Message"]);
  saveCache(cache);

  // --- 2. name affirmations: translate the single column ---
  console.log("Translating BraveEve_name_affirmations.csv ...");
  const nameRows = readCsv("BraveEve_name_affirmations.csv");
  await translateColumn(nameRows, "Messages", cache, "name_affirmations");
  writeCsv("BraveEve_name_affirmations_kn.csv", nameRows, ["Messages"]);
  saveCache(cache);

  // --- 3. variables (question bank): translate every column, same row order ---
  console.log("Translating BraveEve_variables.csv ...");
  const varColumns = [
    "Category",
    "Problem List Item",
    "BraveEve's Conversational Question",
    "Verbatim",
    "Yes",
    "No",
  ];
  const varRows = readCsv("BraveEve_variables.csv");
  for (const col of varColumns) {
    await translateColumn(varRows, col, cache, `variables:${col}`);
    saveCache(cache); // checkpoint after each column, not just each file
  }
  writeCsv("BraveEve_variables_kn.csv", varRows, varColumns);

  // --- 4. content_en.json: section intros, notes responses, closing lines ---
  console.log("Translating content_en.json ...");
  const contentPath = path.join(DATA_DIR, "content_en.json");
  const content = JSON.parse(fs.readFileSync(contentPath, "utf8"));
  const translatedContent = {};
  for (const [key, arr] of Object.entries(content)) {
    translatedContent[key] = [];
    for (let i = 0; i < arr.length; i++) {
      process.stdout.write(`\r  [content_en.json:${key}] ${i + 1}/${arr.length}`.padEnd(60));
      translatedContent[key][i] = await translateOne(arr[i], cache);
      await sleep(DELAY_MS);
    }
    process.stdout.write("\n");
    saveCache(cache); // checkpoint after each array
  }
  fs.writeFileSync(path.join(DATA_DIR, "content_kn.json"), JSON.stringify(translatedContent, null, 2));

  console.log("\nDone. Wrote:");
  console.log("  server/data/BraveEve_static_messages_kn.csv");
  console.log("  server/data/BraveEve_name_affirmations_kn.csv");
  console.log("  server/data/BraveEve_variables_kn.csv");
  console.log("  server/data/content_kn.json");
  console.log(
    "\nThese are machine-translated first drafts — have a native Kannada " +
      "speaker (ideally with clinical/psychosocial background) review them " +
      "before they go anywhere near a patient."
  );
}

main().catch((err) => {
  console.error("\nTranslation run failed:", err);
  process.exit(1);
});
