import { v4 as uuidv4 } from "uuid";
import { getMessage } from "./dataLoader.js";
import {
  personalize,
  pickRandom,
  shuffled,
  QUESTION_MASCOTS,
  SECTION_INTROS,
  NOTES_RESPONSE_YES,
  NOTES_RESPONSE_NO,
  NOTES_BOX_PROMPTS,
  CLOSING_ACKNOWLEDGMENTS,
} from "./content.js";
import { classifyNote } from "./classify.js";
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
    step: 0,
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
    notePromptOrder: shuffled(NOTES_BOX_PROMPTS),
    awaitingContinue: false,
    pendingMessage: "",
    showDistressHelp: false,
    resumeText: "",
    sessionStartTime: null,
    pauseStartTime: null,
    totalPausedSeconds: 0,
  };

  sessions.set(sessionId, session);
  return session;
}

export function getSession(sessionId) {
  return sessions.get(sessionId);
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

/** Builds one response row, matching the columns written in chatbot.py */
function makeEntry(session, { questionNumber, category, problemItem, answer, source, freeText }) {
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
    completed_at: fmtDateTime(new Date()),
    session_duration_seconds: seconds,
    session_duration_minutes: minutes,
  };
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
 * chatbot.py.
 */
export async function applyAction(session, appData, action, payload = {}) {
  const { staticMessages } = appData;
  const msg = (key) => getMessage(appData, key);

  switch (session.step) {
    case 0: {
      if (action === "submit_name") {
        const name = (payload.name || "").trim();
        if (!name) return { error: "Name is required." };
        session.name = name;
        session.sessionStartTime = Date.now();
        session.q2Phrase = pickRandom(appData.nameAffirmations);
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
      if (!session.explainText) {
        session.explainText = pickRandom([msg("EXPLAIN_DISTRESS_1"), msg("EXPLAIN_DISTRESS_2")]);
      }
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
      if (!session.transitionText) {
        session.transitionText = personalize(
          pickRandom([msg("QUESTION_TRANSITION"), msg("QUESTION_TRANSITION_2")]),
          session.name
        );
      }
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

      if (action === "toggle_check" && !session.awaitingContinue) {
        session.sectionChecks[payload.item] = !!payload.checked;
      }

      if (action === "back" && !session.awaitingContinue) {
        if (session.sectionIndex > 0) {
          session.sectionIndex -= 1;
          session.sectionChecks = {};
        }
      }

      if (action === "pause") {
        session.pauseStartTime = Date.now();
        session.step = 888;
        break;
      }

      if (action === "stop") {
        session.step = 999;
        break;
      }

      if (action === "continue_after_note" && session.awaitingContinue) {
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
          const isChecked = !!session.sectionChecks[row.item];
          newEntries.push(
            makeEntry(session, {
              questionNumber: itemQuestionNumber[row.item],
              category: row.category,
              problemItem: row.item,
              answer: isChecked ? "YES" : "NO",
              source: "CHECKBOX",
            })
          );
        }

        const noteText = (payload.note || "").trim();
        let prediction = "";
        if (noteText !== "") {
          const result = await classifyNote(noteText);
          prediction = result.prediction;
        }

        newEntries.push(
          makeEntry(session, {
            questionNumber: sectionNotesQuestionNumber[sectionName],
            category: sectionName,
            problemItem: "Section Notes",
            answer: prediction,
            source: noteText !== "" ? "NLP" : "NONE",
            freeText: noteText,
          })
        );

        await persist(newEntries);

        const noteGiven = noteText !== "";
        const predClean = String(prediction).trim().toLowerCase();

        if (noteGiven && (predClean === "yes" || predClean === "no")) {
          const bank = predClean === "yes" ? NOTES_RESPONSE_YES : NOTES_RESPONSE_NO;
          session.pendingMessage = personalize(pickRandom(bank), session.name);
          session.awaitingContinue = true;
        } else {
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
  const msg = (key) => getMessage(appData, key);

  const base = { sessionId: session.sessionId, step: session.step, name: session.name };

  switch (session.step) {
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
      return { ...base, screen: "question_transition", text: session.transitionText };

    case 7: {
      const sectionName = sections[Math.min(session.sectionIndex, sections.length - 1)];
      const items = (sectionItems[sectionName] || []).map((row) => ({
        item: row.item,
        question: personalize(row.question, session.name),
        verbatim: personalize(row.verbatim, session.name),
        affirmation: personalize(row.yes, session.name),
        checked: !!session.sectionChecks[row.item],
      }));

      let sectionMascot = null;
      for (const row of sectionItems[sectionName] || []) {
        if (QUESTION_MASCOTS[row.item]) {
          sectionMascot = QUESTION_MASCOTS[row.item];
          break;
        }
      }

      const introText = personalize(
        session.sectionIndex < SECTION_INTROS.length
          ? SECTION_INTROS[session.sectionIndex]
          : "Have you had concerns about any of these, in the past week including today?",
        session.name
      );

      const notePrompt =
        session.notePromptOrder[session.sectionIndex % session.notePromptOrder.length];

      return {
        ...base,
        screen: "question_loop",
        sectionName,
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
      if (!session.closingAcknowledgment) {
        session.closingAcknowledgment = personalize(pickRandom(CLOSING_ACKNOWLEDGMENTS), session.name);
        session.endMessage = personalize(pickRandom([msg("END_MESSAGE"), msg("END_MESSAGE_2")]), session.name);
      }
      return {
        ...base,
        screen: "end",
        closingAcknowledgment: session.closingAcknowledgment,
        endMessage: session.endMessage,
        showDistressAlert: session.distressScore !== null && session.distressScore >= 4,
        distressAlert: msg("DISTRESS_ALERT"),
        disclaimer: msg("DISCLAIMER"),
      };
    }

    default:
      return { ...base, screen: "unknown" };
  }
}
