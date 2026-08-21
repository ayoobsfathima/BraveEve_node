import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

export const SUPPORTED_LANGUAGES = ["en", "kn"];
export const DEFAULT_LANGUAGE = "en";

function fileExists(filename) {
  return fs.existsSync(path.join(DATA_DIR, filename));
}

function readCsv(filename) {
  const raw = fs.readFileSync(path.join(DATA_DIR, filename), "utf8");
  const cleaned = raw.replace(/^\uFEFF/, "");
  return parse(cleaned, { columns: true, skip_empty_lines: true, trim: false });
}

function readJsonIfExists(filename) {
  if (!fileExists(filename)) return null;
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, filename), "utf8"));
}

/**
 * Loads and shapes all static content the app needs at runtime, in every
 * available language.
 *
 * IMPORTANT: English is always the permanent internal identifier for every
 * section and question-bank item — checkbox tracking, mascot lookup,
 * question numbering, and the summary card all key off the English
 * "Problem List Item" / "Category" text, forever, regardless of which
 * language is being displayed. Kannada (server/data/*_kn.*) is a pure
 * display-text overlay, matched to the English rows by position, and
 * falls back to English automatically for anything not yet translated (or
 * if the _kn files don't exist at all).
 */
export function loadAppData() {
  // ---- static messages (Key -> Message), per language ----
  const staticRowsEn = readCsv("BraveEve_static_messages.csv");
  const staticMessages = { en: {} };
  for (const row of staticRowsEn) staticMessages.en[row.Key] = row.Message ?? "";

  if (fileExists("BraveEve_static_messages_kn.csv")) {
    const staticRowsKn = readCsv("BraveEve_static_messages_kn.csv");
    staticMessages.kn = {};
    for (const row of staticRowsKn) staticMessages.kn[row.Key] = row.Message ?? "";
  }

  // ---- name affirmations, per language ----
  const nameRowsEn = readCsv("BraveEve_name_affirmations.csv");
  const nameAffirmations = {
    en: nameRowsEn.map((r) => r.Messages).filter((v) => v && v.trim() !== ""),
  };
  if (fileExists("BraveEve_name_affirmations_kn.csv")) {
    const nameRowsKn = readCsv("BraveEve_name_affirmations_kn.csv");
    nameAffirmations.kn = nameRowsKn.map((r) => r.Messages).filter((v) => v && v.trim() !== "");
  }

  // ---- longer-form content (section intros, notes responses, closing ----
  // ---- lines), per language ----
  const content = { en: readJsonIfExists("content_en.json") || {} };
  const knContent = readJsonIfExists("content_kn.json");
  if (knContent) content.kn = knContent;

  // ---- question bank: built from the English file, which is the ----
  // ---- permanent structural source of truth (order, identity, ----
  // ---- section grouping). Introduction/Distress Level rows have an ----
  // ---- empty Problem List Item and are excluded, same as the ----
  // ---- original pandas dropna(). ----
  const enRawRows = readCsv("BraveEve_variables.csv");
  const knRawRows = fileExists("BraveEve_variables_kn.csv")
    ? readCsv("BraveEve_variables_kn.csv")
    : null;

  if (knRawRows && knRawRows.length !== enRawRows.length) {
    console.warn(
      `[data] BraveEve_variables_kn.csv has ${knRawRows.length} rows but the ` +
        `English source has ${enRawRows.length} rows — row-position matching ` +
        `will be unreliable. Re-run the translation script against the ` +
        `current English file.`
    );
  }

  const seen = new Set();
  const questionBank = [];
  enRawRows.forEach((row, idx) => {
    const item = (row["Problem List Item"] || "").trim();
    if (!item || seen.has(item)) return;
    seen.add(item);

    const knRow = knRawRows ? knRawRows[idx] : null;

    questionBank.push({
      key: item, // permanent internal identifier — never displayed when translated
      category: row["Category"], // permanent internal identifier
      display: {
        en: {
          category: row["Category"],
          item,
          question: row["BraveEve's Conversational Question"] || "",
          verbatim: row["Verbatim"] || "",
          yes: row["Yes"] || "",
          no: row["No"] || "",
        },
        kn: knRow
          ? {
              category: knRow["Category"],
              item: knRow["Problem List Item"],
              question: knRow["BraveEve's Conversational Question"] || "",
              verbatim: knRow["Verbatim"] || "",
              yes: knRow["Yes"] || "",
              no: knRow["No"] || "",
            }
          : null,
      },
    });
  });

  // ---- sections, in first-seen order (canonical English names) ----
  const sections = [];
  for (const q of questionBank) {
    if (!sections.includes(q.category)) sections.push(q.category);
  }

  // section display label per language: derived from the first item in
  // that section (translation caching guarantees every item in a section
  // translates "Category" to the same Kannada string, so any item's value
  // is representative).
  const sectionLabel = { en: {} };
  for (const s of sections) sectionLabel.en[s] = s;
  if (knRawRows) {
    sectionLabel.kn = {};
    for (const s of sections) {
      const firstItem = questionBank.find((q) => q.category === s);
      sectionLabel.kn[s] = firstItem?.display.kn?.category || s;
    }
  }

  // question_number: stable 1-based index over the question bank,
  // matching ITEM_QUESTION_NUMBER in the original app. Keyed by the
  // permanent English item key.
  const itemQuestionNumber = {};
  questionBank.forEach((q, idx) => {
    itemQuestionNumber[q.key] = idx + 1;
  });

  // section notes use 1000 + section index, matching
  // SECTION_NOTES_QUESTION_NUMBER. Keyed by the permanent English section name.
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
    content,
    questionBank,
    sections,
    sectionLabel,
    sectionItems,
    itemQuestionNumber,
    sectionNotesQuestionNumber,
    hasKannada: !!knRawRows,
  };
}

function normalizeLanguage(lang) {
  return SUPPORTED_LANGUAGES.includes(lang) ? lang : DEFAULT_LANGUAGE;
}

/** Static message lookup with automatic fallback to English. */
export function getMessage(appData, key, language = DEFAULT_LANGUAGE) {
  const lang = normalizeLanguage(language);
  const value = appData.staticMessages[lang]?.[key];
  if (value && value.trim() !== "") return value;
  return appData.staticMessages.en[key] ?? "";
}

/** Name affirmations array for a language, falling back to English if untranslated. */
export function getNameAffirmations(appData, language = DEFAULT_LANGUAGE) {
  const lang = normalizeLanguage(language);
  const arr = appData.nameAffirmations[lang];
  return arr && arr.length > 0 ? arr : appData.nameAffirmations.en;
}

/** Longer-form content bundle (section intros, notes responses, etc.) for a language. */
export function getContent(appData, language = DEFAULT_LANGUAGE) {
  const lang = normalizeLanguage(language);
  const en = appData.content.en || {};
  const translated = appData.content[lang] || {};
  const pick = (field) =>
    translated[field] && translated[field].length > 0 ? translated[field] : en[field];
  return {
    sectionIntros: pick("sectionIntros"),
    notesResponseYes: pick("notesResponseYes"),
    notesResponseNo: pick("notesResponseNo"),
    notesBoxPrompts: pick("notesBoxPrompts"),
    closingAcknowledgments: pick("closingAcknowledgments"),
  };
}

/** Display text for one question-bank row, falling back to English per-field. */
export function displayForItem(row, language = DEFAULT_LANGUAGE) {
  const lang = normalizeLanguage(language);
  const en = row.display.en;
  const translated = row.display[lang];
  if (!translated) return en;
  return {
    category: translated.category || en.category,
    item: translated.item || en.item,
    question: translated.question || en.question,
    verbatim: translated.verbatim || en.verbatim,
    yes: translated.yes || en.yes,
    no: translated.no || en.no,
  };
}

/** Display label for a section, falling back to English. */
export function sectionDisplayLabel(appData, sectionName, language = DEFAULT_LANGUAGE) {
  const lang = normalizeLanguage(language);
  return appData.sectionLabel[lang]?.[sectionName] || sectionName;
}
