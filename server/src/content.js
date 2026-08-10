// Ported verbatim from chatbot.py

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

export const SECTION_INTROS = [
  "[Name], let's start with how your body has been feeling. " +
    "Have you had any of these concerns in the past week, including today?",

  "Now, [Name], I'd like to check in on how you've been feeling inside. " +
    "Have any of these been on your mind this past week, including today?",

  "Next, [Name], let's talk about the people around you. " +
    "Have you had any of these concerns in the past week, including today?",

  "[Name], now I'd like to ask about some everyday things in your life. " +
    "Take your time — you can always pause if you need to. " +
    "Have you noticed any of these in the past week, including today?",

  "Lastly, [Name], I'd like to ask about your faith and beliefs. " +
    "Have any of these been on your mind this past week, including today?",
];

export const NOTES_RESPONSE_YES = [
  "I can truly feel how much you're carrying right now, [Name], and I am " +
    "so deeply sorry that things are this heavy. Please know you don't have " +
    "to navigate this overwhelming weight all by yourself.",

  "Hearing you talk about this, [Name], it's completely clear how " +
    "exhausting and intense everything is for you right now. I'm right " +
    "here with you, and we can take this as slowly as you need.",

  "I'm so sorry, [Name]. I can hear the immense weight in your voice " +
    "right now, and it makes complete sense that you feel entirely " +
    "overwhelmed by all of this.",

  "Thank you for being so open with me, [Name]. I can hear how " +
    "incredibly painful and chaotic things feel right now. Let's take a " +
    "deep breath together.",

  "It sounds like you are being pushed to your absolute limit right " +
    "now, [Name], and I am so incredibly sorry. No one should have to " +
    "bear this kind of distress alone.",

  "I can hear how entirely drained and overwhelmed you feel, [Name]. " +
    "I'm so sorry things are this hard.",

  "I am listening closely, [Name], and I can hear just how heavy, raw, " +
    "and overwhelming this moment is for you. I'm so sorry you are going " +
    "through this, but I'm glad you're telling me.",

  "Everything you're describing sounds incredibly heavy and " +
    "overwhelming, [Name]. I'm so sorry it's reached this point.",
];

export const NOTES_RESPONSE_NO = [
  "It brings me so much joy to hear that you're in a really good, " +
    "steady space right now, [Name]! I'm so glad to hear that things are " +
    "feeling manageable.",

  "I am incredibly glad to hear that you are feeling steady and doing " +
    "well today, [Name]. It sounds like you've found a really good " +
    "balance right now.",

  "That is wonderful to hear, [Name]! I'm so glad you're feeling good " +
    "and that things are going smoothly for you today.",

  "I'm so happy you're feeling well and steady right now, [Name]. " +
    "It is so refreshing to hear that you're doing well and feeling " +
    "peaceful today, [Name]. I'm truly glad to know that things are " +
    "feeling lighter for you.",

  "I love hearing that, [Name]! It sounds like you're in a really " +
    "steady place today, which is fantastic news.",

  "I'm so glad to hear you're doing well, [Name]. " +
    "Thank you for sharing that, [Name] — I'm truly happy to hear that " +
    "you're feeling well and that life feels manageable and stable for " +
    "you right now.",
];

export const NOTES_BOX_PROMPTS = [
  "If you have any other concerns or feel like there's something else " +
    "you need to get off your chest, this is a safe space to do so.",

  "If there's anything else on your mind or something you're currently " +
    "struggling with, please feel free to share it here. I'm listening.",

  "Is there anything else you'd like to talk about? If something has " +
    "been particularly challenging or troubling lately, you can always " +
    "share it here.",

  "Please feel free to share any other concerns, or anything else " +
    "that might be bothering you, right here.",

  "If you just need a moment to share what's happening, feel free to " +
    "write it down here.",
];

export const CLOSING_ACKNOWLEDGMENTS = [
  "That's the last of it, [Name] — you've made it through. Answering " +
    "these honestly isn't easy, and it took real courage to sit with " +
    "these questions today. Thank you for trusting me with this.",

  "That's the final question, [Name] — you did it. Opening up " +
    "honestly like this isn't easy, and it takes real strength to get " +
    "through it all. Thank you for trusting me with your story today.",

  "We're all done, [Name]. I know looking closely at these things can " +
    "be tough, and I'm so glad you stayed with it. Thank you for your " +
    "honesty and for sharing this space with me.",

  "That's the last of it, [Name]. Being vulnerable takes a lot of " +
    "courage, and you did incredibly well today. Thank you for placing " +
    "your trust in me.",

  "You've officially made it through, [Name]. Reflecting on these " +
    "questions takes a lot of emotional energy, and you showed real " +
    "bravery by facing them. Thank you for trusting me.",

  "And that brings us to the end, [Name]. I truly appreciate how open " +
    "you've been. It's never easy to sit with these kinds of questions, " +
    "and I'm incredibly grateful for your trust.",

  "That's everything, [Name] — you made it to the finish line. It " +
    "takes massive courage to be this honest, even when it feels heavy. " +
    "Thank you for letting me in and sharing this.",

  "We've covered it all, [Name]. Thank you for being so deeply honest " +
    "today. It isn't easy to face these thoughts head-on, and I hold " +
    "your trust with a lot of respect.",

  "That wraps things up, [Name]. You can take a deep breath — you " +
    "made it through. Sitting with these questions takes genuine " +
    "courage, and I appreciate you trusting me with your answers.",

  "That's the last one, [Name]. You made it through a tough process " +
    "with total honesty, and that takes real bravery. Thank you for " +
    "trusting me.",

  "You've made it through the whole way, [Name]. I know this wasn't a " +
    "simple walk in the park, and your courage to speak your truth " +
    "today means a lot. Thank you for your trust.",
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
