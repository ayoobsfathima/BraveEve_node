// Ported verbatim from chatbot.py

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_JSON_PATH = path.join(__dirname, "..", "data", "content_en.json");

// Longer-form conversational copy (section intros, the notes-response
// bank, closing messages, etc.) lives in server/data/content_en.json
// rather than as hardcoded arrays here, so it goes through the same
// translation pipeline as the CSVs (see scripts/translate_to_kannada.js)
// instead of being a one-off exception.
const _content = JSON.parse(fs.readFileSync(CONTENT_JSON_PATH, "utf8"));

export const SECTION_INTROS = _content.sectionIntros;
export const NOTES_RESPONSE_YES = _content.notesResponseYes;
export const NOTES_RESPONSE_NO = _content.notesResponseNo;
export const NOTES_BOX_PROMPTS = _content.notesBoxPrompts;
export const CLOSING_ACKNOWLEDGMENTS = _content.closingAcknowledgments;

export const QUESTION_MASCOTS = {
  Pain: "BraveEve_check_in",
  Sleep: "BraveEve_deep_breath",
  "Tobacco use": "BraveEve_pointing_up",
  "Memory/Concentration": "BraveEve_thoughtful",
  "Sexual health": "holding_heart",
  "Loss or change of physical abilities": "BraveEve_encouraging",
  "Worry/Anxiety": "BraveEve_thoughtful",
  "Sadness/Depression": "holding_heart",
  "Loss of interest or enjoyment": "BraveEve_encouraging",
  "Grief or loss": "holding_heart",
  Loneliness: "BraveEve_hearts",
  Anger: "BraveEve_deep_breath",
  "Changes in appearance": "BraveEve_hearts",
  "Feelings of worthlessness or being a burden": "holding_heart",
  "Relationship with Spouse/Partner": "holding_heart",
  "Relationship with children": "BraveEve_hearts",
  "Relationship with Friends/Coworkers": "BraveEve_hearts",
  "Ability to have children": "holding_heart",
  "Prejudice or discrimination": "BraveEve_encouraging",
  "Taking care of myself": "BraveEve_check_in",
  "Taking care of others": "BraveEve_hearts",
  Safety: "BraveEve_pointing_up",
  Work: "BraveEve_encouraging",
  School: "BraveEve_encouraging",
  "Housing/Utilities": "BraveEve_thoughtful",
  Finances: "BraveEve_thoughtful",
  Transportation: "BraveEve_pointing_up",
  "Child care": "BraveEve_hearts",
  "Having enough food": "BraveEve_check_in",
  "Access to medicine": "BraveEve_pointing_up",
  "Treatment decisions": "BraveEve_pointing_up",
  "Sense of meaning or purpose": "BraveEve_proud",
  "Death, dying, or afterlife": "holding_heart",
  "Relationship with the sacred": "BraveEve_proud",
  "Ritual or dietary needs": "BraveEve_proud",
};

export const HIGH_RISK_PHRASES = [
  // Sleep
  "cannot sleep",
  "can't sleep",
  "sleep not coming",
  "unable to sleep",
  "barely get any rest",
  "whole night awake",
  "not sleeping properly",
  "sleep problem",
  // Mental distress
  "not been okay",
  "have not been okay",
  "nothing feels enjoyable",
  "do not enjoy anything",
  "no hope",
  "cry every day",
  "cry everyday",
  "crying every day",
  "i feel broken",
  "i feel empty",
  "do not feel like myself",
  // Eating
  "don't feel like eating",
  "dont feel like eating",
  "not eating much",
  "lost appetite",
  // Pain
  "whole body hurts",
  "pain every day",
  "pain everyday",
  "severe pain",
  "constant pain",
  // Fatigue
  "tired all the time",
  "always tired",
  "no energy",
  "completely exhausted",
  // Smoking / Alcohol
  "smoking every day",
  "still smoking",
  "drink alcohol daily",
  // Anxiety
  "keep worrying",
  "worry every night",
  "always worried",
  "constant worry",
  // Financial / Social
  "cannot go to work",
  "struggling financially",
  "cannot afford treatment",
  "miss appointments",
  // Transport
  "no transport",
  "cannot travel to hospital",
  // Relationships
  "family not supporting",
  "feeling lonely",
  // Worthlessness
  "feel like a burden",
  "worthless",
];

export function personalize(text, name) {
  if (text === null || text === undefined) return "";
  return String(text).replace(/\[Name\]/g, name || "");
}

export function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function shuffled(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
