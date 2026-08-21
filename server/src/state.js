import { v4 as uuidv4 } from "uuid";
import {
  getMessage,
  getNameAffirmations,
  getContent,
  displayForItem,
  sectionDisplayLabel,
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
} from "./dataLoader.js";
import { personalize, pickRandom, shuffled, QUESTION_MASCOTS } from "./content.js";
import { classifyNote } from "./classify.js";
import { processTypedNote } from "./typedNotePipeline.js";
import { saveResponses } from "./sheets.js";

// sessionId -> session object. In-memory store: fine for a ~30-person pilot.
// (Swap for a real store like Redis if this grows beyond a pilot.)
const sessions = new Map();

function fmtDateTime(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

export function createSession(appData) {
  const sessionId = `${fmtDateTime(new Date()).slice(0, 10).replace(/-/g, "")}_${uuidv4().slice(0, 6)}`;

  const session = {
    sessionId,
    step: -1, // -1 = language choice, the very first screen
    language: DEFAULT_LANGUAGE,
    name: "",
    q2Phrase: "",
    dayFeeling: "",
    dayReply: "",
    explainText: "",
    transitionText: "",
    distressScore: null,
    scoreReply: "",
    sectionIndex: 0,
    sectionChecks: {},
    sectionSummaries: {}, // sectionName -> array of canonical item keys, captured as each section finishes
    notePromptOrder: [], // set once language is chosen (see case -1)
    awaitingContinue: false,
    pendingMessage: "",
    showDistressHelp: false,
    resumeText: "",
    sessionStartTime: null,
    pauseStartTime: null,
    totalPausedSeconds: 0,
    history: [], // stack of prior session snapshots, for the "Back" action
  };

  sessions.set(sessionId, session);
  return session;
}

export function getSession(sessionId) {
  return sessions.get(sessionId);
}

function scoreBand(score) {
  if (score === null || score === undefined) return null;
  if (score <= 3) return { key: "low", label: "Low" };
  if (score <= 6) return { key: "moderate", label: "Moderate" };
  return { key: "high", label: "High" };
}

function computeDuration(session) {
  if (!session.sessionStartTime) return { seconds: null, minutes: null };
  const elapsedMs =
    Date.now() - session.sessionStartTime - session.totalPausedSeconds * 1000;
  const seconds = elapsedMs / 1000;
  return {
    seconds: Math.round(seconds * 100) / 100,
    minutes: Math.round((seconds / 60) * 100) / 100,
  };
}

/**
 * Builds one response row, matching the columns written in chatbot.py.
 * category/problemItem are always the canonical ENGLISH identifiers,
 * regardless of the session's display language — keeps the Sheet
 * consistent and analyzable rather than fragmented by language.
 */
function makeEntry(session, { questionNumber, category, problemItem, answer, source, freeText, nativeText }) {
  const { seconds, minutes } = computeDuration(session);
  return {
    session_id: session.sessionId,
    timestamp: fmtDateTime(new Date()),
    name: session.name,
    distress_score: session.distressScore,
    question_number: questionNumber,
    category,
    problem_item: problemItem,
    answer,
    response_source: source,
    free_text: freeText || "",
    native_text: nativeText || "", // spoken/typed-native-language text, if applicable
    completed_at: fmtDateTime(new Date()),
    session_duration_seconds: seconds,
    session_duration_minutes: minutes,
  };
}

/** Snapshots which items are checked in the current section, keyed by the
 * canonical English item key (not the display label) so the summary
 * renders correctly regardless of which language was active when checked. */
function captureSectionSummary(session, appData) {
  const sectionName = appData.sections[session.sectionIndex];
  const items = appData.sectionItems[sectionName];
  session.sectionSummaries[sectionName] = items
    .filter((row) => !!session.sectionChecks[row.key])
    .map((row) => row.key);
}

const MAX_HISTORY = 100;

/** Deep clone of everything in the session except the history stack itself. */
function snapshotSession(session) {
  const { history, ...rest } = session;
  return JSON.parse(JSON.stringify(rest));
}

async function persist(entries) {
  if (!entries || entries.length === 0) return;
  try {
    await saveResponses(entries);
  } catch (err) {
    // Don't crash the check-in over a sheet-write error; log so it can be
    // reconciled, and let the person continue their session.
    console.error("[state] failed to save responses to Google Sheets:", err);
  }
}

/**
 * Applies a user action to a session, mutating it, and (for step 7)
 * persisting response rows. Mirrors the big if/elif step machine in
 * chatbot.py, extended with a language-choice step at the very front.
 */
export async function applyAction(session, appData, action, payload = {}) {
  const msg = (key) => getMessage(appData, key, session.language);

  // "Back" restores the session to exactly how it was right before the
  // previous action ran — including any answers/checks that were entered,
  // not just moving the step pointer. Works from any screen, uniformly.
  if (action === "back") {
    if (session.history.length > 0) {
      const previous = session.history.pop();
      Object.assign(session, previous);
    }
    return { ok: true };
  }

  // Snapshot state before applying this action (skip for toggle_check,
  // which is many small in-place edits within the same screen, not a
  // screen-to-screen transition worth being able to undo one-by-one).
  if (action !== "toggle_check") {
    session.history.push(snapshotSession(session));
    if (session.history.length > MAX_HISTORY) session.history.shift();
  }

  switch (session.step) {
    case -1: {
      if (action === "set_language") {
        const lang = SUPPORTED_LANGUAGES.includes(payload.lang) ? payload.lang : DEFAULT_LANGUAGE;
        session.language = lang;
        session.notePromptOrder = shuffled(getContent(appData, lang).notesBoxPrompts);
        session.step = 0;
      }
      break;
    }

    case 0: {
      if (action === "submit_name") {
        const name = (payload.name || "").trim();
        if (!name) return { error: "Name is required." };
        session.name = name;
        session.sessionStartTime = Date.now();
        session.q2Phrase = pickRandom(getNameAffirmations(appData, session.language));
        session.step = 1;
      }
      break;
    }

    case 1: {
      if (action === "next") session.step = 2;
      break;
    }

    case 2: {
      if (action === "submit_day_feeling") {
        const choice = payload.choice;
        session.dayFeeling = choice;
        if (choice === "It's been good") {
          session.dayReply = msg("DAY_FEELING_GOOD");
        } else if (choice === "I'm just okay") {
          session.dayReply = msg("DAY_FEELING_OKAY");
        } else {
          session.dayReply = msg("DAY_FEELING_STRUGGLE");
        }
        session.step = 21;
      }
      break;
    }

    case 21: {
      if (action === "next") session.step = 3;
      break;
    }

    case 3: {
      if (action === "answer") session.step = 4; // yes or no -> same next step
      break;
    }

    case 4: {
      if (action === "answer") {
        session.step = payload.value === "yes" ? 5 : 41;
      }
      break;
    }

    case 41: {
      if (action === "answer") {
        if (payload.value === "yes") {
          session.step = 5;
          session.showDistressHelp = false;
        } else {
          session.showDistressHelp = true;
        }
      } else if (action === "help_continue") {
        session.showDistressHelp = false;
        session.step = 5;
      }
      break;
    }

    case 5: {
      if (action === "submit_score") {
        const score = Math.max(0, Math.min(10, Number(payload.score)));
        session.distressScore = score;
        if (score <= 3) {
          session.scoreReply = pickRandom([msg("SCORE_RESPONSE_LOW"), msg("SCORE_RESPONSE_LOW_2")]);
        } else if (score <= 6) {
          session.scoreReply = pickRandom([msg("SCORE_RESPONSE_MODERATE"), msg("SCORE_RESPONSE_MODERATE_2")]);
        } else {
          session.scoreReply = pickRandom([msg("SCORE_RESPONSE_HIGH"), msg("SCORE_RESPONSE_HIGH_2")]);
        }
        session.step = 51;
      }
      break;
    }

    case 51: {
      if (action === "next") session.step = 6;
      break;
    }

    case 6: {
      if (action === "begin") session.step = 7;
      if (action === "pause") {
        session.pauseStartTime = Date.now();
        session.step = 888;
      }
      if (action === "stop") session.step = 999;
      break;
    }

    case 7: {
      const { sections, sectionItems, itemQuestionNumber, sectionNotesQuestionNumber } = appData;

      if (action === "toggle_check") {
        session.sectionChecks[payload.item] = !!payload.checked;
      }

      if (action === "pause") {
        session.pauseStartTime = Date.now();
        session.step = 888;
        break;
      }

      if (action === "stop") {
        captureSectionSummary(session, appData);
        session.step = 999;
        break;
      }

      if (action === "continue_after_note" && session.awaitingContinue) {
        captureSectionSummary(session, appData);
        session.awaitingContinue = false;
        session.pendingMessage = "";
        session.sectionChecks = {};
        session.sectionIndex += 1;
        if (session.sectionIndex >= sections.length) session.step = 999;
        break;
      }

      if (action === "next" && !session.awaitingContinue) {
        const sectionName = sections[session.sectionIndex];
        const items = sectionItems[sectionName];
        const newEntries = [];

        for (const row of items) {
          const isChecked = !!session.sectionChecks[row.key];
          newEntries.push(
            makeEntry(session, {
              questionNumber: itemQuestionNumber[row.key],
              category: row.category,
              problemItem: row.key,
              answer: isChecked ? "YES" : "NO",
              source: "CHECKBOX",
            })
          );
        }

        const rawNote = (payload.note || "").trim();
        let nativeNoteText = (payload.nativeNote || "").trim();
        let noteForClassification = rawNote;

        // If this note didn't come from voice (voice already provides
        // English + native text via Sarvam STT), run it through the typed
        // note pipeline: detect language/script, transliterate romanized
        // ("Kanglish") input to proper script if needed, then translate to
        // English for the classifier. Runs off what was actually typed,
        // independent of the session's display language.
        if (rawNote !== "" && !nativeNoteText) {
          const result = await processTypedNote(rawNote);
          noteForClassification = result.englishText || rawNote;
          nativeNoteText = result.nativeText;
        }

        let prediction = "";
        if (noteForClassification !== "") {
          const result = await classifyNote(noteForClassification);
          prediction = result.prediction;
        }

        newEntries.push(
          makeEntry(session, {
            questionNumber: sectionNotesQuestionNumber[sectionName],
            category: sectionName,
            problemItem: "Section Notes",
            answer: prediction,
            source: noteForClassification !== "" ? "NLP" : "NONE",
            freeText: noteForClassification,
            nativeText: nativeNoteText,
          })
        );

        await persist(newEntries);

        const noteGiven = noteForClassification !== "";
        const predClean = String(prediction).trim().toLowerCase();

        if (noteGiven && (predClean === "yes" || predClean === "no")) {
          const content = getContent(appData, session.language);
          const bank = predClean === "yes" ? content.notesResponseYes : content.notesResponseNo;
          session.pendingMessage = personalize(pickRandom(bank), session.name);
          session.awaitingContinue = true;
        } else {
          captureSectionSummary(session, appData);
          session.sectionChecks = {};
          session.sectionIndex += 1;
          if (session.sectionIndex >= sections.length) session.step = 999;
        }
      }
      break;
    }

    case 888: {
      if (action === "resume") {
        if (session.pauseStartTime !== null) {
          session.totalPausedSeconds += (Date.now() - session.pauseStartTime) / 1000;
          session.pauseStartTime = null;
        }
        session.resumeText = personalize(msg("RESUME_MESSAGE"), session.name);
        session.step = 889;
      }
      if (action === "stop") {
        if (session.pauseStartTime !== null) {
          session.totalPausedSeconds += (Date.now() - session.pauseStartTime) / 1000;
          session.pauseStartTime = null;
        }
        session.step = 999;
      }
      break;
    }

    case 889: {
      if (action === "continue") session.step = 7;
      break;
    }

    case 999:
      // terminal
      break;

    default:
      break;
  }

  return { ok: true };
}

/**
 * Builds the JSON payload the frontend renders for the session's current
 * step. This is the Node equivalent of "what Streamlit would draw".
 */
export function renderState(session, appData) {
  const { sections, sectionItems } = appData;
  const msg = (key) => getMessage(appData, key, session.language);

  const base = {
    sessionId: session.sessionId,
    step: session.step,
    name: session.name,
    language: session.language,
  };

  switch (session.step) {
    case -1:
      return { ...base, screen: "language_choice" };

    case 0:
      return { ...base, screen: "name", message: msg("ASK_NAME") };

    case 1:
      return {
        ...base,
        screen: "name_affirmation",
        text: personalize(session.q2Phrase, session.name),
      };

    case 2:
      return {
        ...base,
        screen: "day_feeling",
        message: msg("ASK_DAY_FEELING"),
        options: ["It's been good", "It's been a little difficult", "I'm just okay"],
      };

    case 21:
      return { ...base, screen: "day_feeling_response", text: session.dayReply };

    case 3:
      return { ...base, screen: "distress_awareness", message: msg("ASK_DISTRESS_AWARENESS") };

    case 4:
      if (!session.explainText) {
        session.explainText = pickRandom([msg("EXPLAIN_DISTRESS_1"), msg("EXPLAIN_DISTRESS_2")]);
      }
      return {
        ...base,
        screen: "distress_explain",
        text: session.explainText,
        question: msg("DISTRESS_UNDERSTOOD"),
      };

    case 41:
      return {
        ...base,
        screen: "distress_reexplain",
        text: msg("DISTRESS_REEXPLAIN"),
        question: msg("DISTRESS_REEXPLAIN_CHECK"),
        showHelp: session.showDistressHelp,
        helpText: msg("DISTRESS_NOT_UNDERSTOOD_HELP"),
      };

    case 5:
      return { ...base, screen: "distress_score", message: msg("ASK_DISTRESS_SCORE") };

    case 51:
      return { ...base, screen: "score_response", text: session.scoreReply };

    case 6:
      if (!session.transitionText) {
        session.transitionText = personalize(
          pickRandom([msg("QUESTION_TRANSITION"), msg("QUESTION_TRANSITION_2")]),
          session.name
        );
      }
      return { ...base, screen: "question_transition", text: session.transitionText };

    case 7: {
      const sectionName = sections[Math.min(session.sectionIndex, sections.length - 1)];
      const items = (sectionItems[sectionName] || []).map((row) => {
        const display = displayForItem(row, session.language);
        return {
          key: row.key, // canonical English identifier — used for toggle_check payloads
          item: personalize(display.item, session.name), // display label
          question: personalize(display.question, session.name),
          verbatim: personalize(display.verbatim, session.name),
          affirmation: personalize(display.yes, session.name),
          checked: !!session.sectionChecks[row.key],
        };
      });

      let sectionMascot = null;
      for (const row of sectionItems[sectionName] || []) {
        if (QUESTION_MASCOTS[row.key]) {
          sectionMascot = QUESTION_MASCOTS[row.key];
          break;
        }
      }

      const content = getContent(appData, session.language);
      const introText = personalize(
        session.sectionIndex < content.sectionIntros.length
          ? content.sectionIntros[session.sectionIndex]
          : "Have you had concerns about any of these, in the past week including today?",
        session.name
      );

      const notePrompt =
        session.notePromptOrder.length > 0
          ? session.notePromptOrder[session.sectionIndex % session.notePromptOrder.length]
          : content.notesBoxPrompts[session.sectionIndex % content.notesBoxPrompts.length];

      return {
        ...base,
        screen: "question_loop",
        sectionName: sectionDisplayLabel(appData, sectionName, session.language),
        sectionMascot,
        sectionIndex: session.sectionIndex,
        totalSections: sections.length,
        progress: (session.sectionIndex + 1) / sections.length,
        introText,
        items,
        notePrompt,
        isLastSection: session.sectionIndex === sections.length - 1,
        awaitingContinue: session.awaitingContinue,
        pendingMessage: session.pendingMessage,
      };
    }

    case 888:
      return { ...base, screen: "pause", text: msg("PAUSE_MESSAGE") };

    case 889:
      return { ...base, screen: "resume", text: session.resumeText };

    case 999: {
      const content = getContent(appData, session.language);
      if (!session.closingAcknowledgment) {
        session.closingAcknowledgment = personalize(pickRandom(content.closingAcknowledgments), session.name);
        session.endMessage = personalize(pickRandom([msg("END_MESSAGE"), msg("END_MESSAGE_2")]), session.name);
      }

      const summarySections = sections.map((sectionName) => {
        const keys = session.sectionSummaries[sectionName] || [];
        const items = (sectionItems[sectionName] || [])
          .filter((row) => keys.includes(row.key))
          .map((row) => displayForItem(row, session.language).item);
        return { name: sectionDisplayLabel(appData, sectionName, session.language), items };
      });

      return {
        ...base,
        screen: "end",
        closingAcknowledgment: session.closingAcknowledgment,
        endMessage: session.endMessage,
        showDistressAlert: session.distressScore !== null && session.distressScore >= 4,
        distressAlert: msg("DISTRESS_ALERT"),
        disclaimer: msg("DISCLAIMER"),
        summary: {
          distressScore: session.distressScore,
          scoreBand: scoreBand(session.distressScore),
          scoreReflection: session.scoreReply,
          sections: summarySections,
        },
      };
    }

    default:
      return { ...base, screen: "unknown" };
  }
}
