import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

function readCsv(filename) {
  const raw = fs.readFileSync(path.join(DATA_DIR, filename), "utf8");
  // Strip BOM if present (the source CSVs were exported with a UTF-8 BOM).
  const cleaned = raw.replace(/^\uFEFF/, "");
  return parse(cleaned, {
    columns: true,
    skip_empty_lines: true,
    trim: false,
  });
}

/**
 * Loads and shapes all static content the app needs at runtime.
 * Mirrors the Streamlit app's load_data() + create_question_bank().
 */
export function loadAppData() {
  const variableRows = readCsv("BraveEve_variables.csv");
  const staticRows = readCsv("BraveEve_static_messages.csv");
  const nameRows = readCsv("BraveEve_name_affirmations.csv");

  // ---- static messages: Key -> Message ----
  const staticMessages = {};
  for (const row of staticRows) {
    staticMessages[row.Key] = row.Message ?? "";
  }

  // ---- name affirmations: list of strings ----
  const nameAffirmations = nameRows
    .map((r) => r.Messages)
    .filter((v) => v && v.trim() !== "");

  // ---- question bank: one row per Problem List Item (Introduction / ----
  // ---- Distress Level rows have an empty Problem List Item and are   ----
  // ---- excluded, same as dropna() in the original pandas code).      ----
  const seen = new Set();
  const questionBank = [];
  for (const row of variableRows) {
    const item = (row["Problem List Item"] || "").trim();
    if (!item || seen.has(item)) continue;
    seen.add(item);
    questionBank.push({
      category: row["Category"],
      item,
      question: row["BraveEve's Conversational Question"] || "",
      verbatim: row["Verbatim"] || "",
      yes: row["Yes"] || "",
      no: row["No"] || "",
    });
  }

  // ---- sections, in first-seen order (Physical, Emotional, Social, ----
  // ---- Practical, Spiritual or Religious Concern) ----
  const sections = [];
  for (const q of questionBank) {
    if (!sections.includes(q.category)) sections.push(q.category);
  }

  // question_number: stable 1-based index over the question bank,
  // matching ITEM_QUESTION_NUMBER in the original app.
  const itemQuestionNumber = {};
  questionBank.forEach((q, idx) => {
    itemQuestionNumber[q.item] = idx + 1;
  });

  // section notes use 1000 + section index, matching SECTION_NOTES_QUESTION_NUMBER
  const sectionNotesQuestionNumber = {};
  sections.forEach((s, idx) => {
    sectionNotesQuestionNumber[s] = 1000 + idx;
  });

  const sectionItems = {};
  for (const s of sections) {
    sectionItems[s] = questionBank.filter((q) => q.category === s);
  }

  return {
    staticMessages,
    nameAffirmations,
    questionBank,
    sections,
    sectionItems,
    itemQuestionNumber,
    sectionNotesQuestionNumber,
  };
}

export function getMessage(appData, key) {
  return appData.staticMessages[key] ?? "";
}
