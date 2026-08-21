const root = document.getElementById("app");
let currentState = null;
let lastError = null;

// Voice notes: the native-language transcript isn't reflected anywhere in
// the visible DOM (only the English text goes in the textarea), so it's
// tracked here as a side-channel and sent along with the "next" action.
// Reset whenever the person moves to a different section.
let pendingNativeText = "";
let lastVoiceSectionIndex = null;
let activeRecorder = null;
let recordingTimer = null;

const MASCOT_DIR = "/images";

function mascotSrc(name) {
  return `${MASCOT_DIR}/${name}.png`;
}

function esc(str) {
  const d = document.createElement("div");
  d.textContent = str ?? "";
  return d.innerHTML;
}

// ---------------------------------------------------------------------
// UI chrome strings (buttons, labels, hints) — separate from the CSV/JSON
// content pipeline since these are fixed app "chrome" rather than
// clinical/conversational content. Best-effort translations; flag for a
// native-speaker review same as the rest of the Kannada content.
// ---------------------------------------------------------------------

const UI_STRINGS = {
  en: {
    continue: "Continue",
    next: "Next",
    finish: "Finish",
    back: "← Back",
    yes: "Yes",
    no: "No",
    begin: "Begin",
    pause: "Pause",
    stop: "Stop",
    resume: "Resume",
    yourNamePlaceholder: "Your name",
    noDistress: "No distress",
    extremeDistress: "Extreme distress",
    sectionOf: (i, n) => `Section ${i} of ${n}`,
    markAllApply: "Mark all that apply. Tap the 💡 next to an item for an example of what someone experiencing this might say.",
    recordVoiceNote: "🎙️ Record voice note",
    stopRecordingBtn: "⏹ Stop recording",
    listening: "Listening… tap again to stop.",
    transcribing: "Transcribing…",
    addedToNote: "Added to your note below — feel free to edit it.",
    didntCatch: "Didn't catch that clearly. Please try again or type your note.",
    micError: "Couldn't access the microphone. You can still type your note.",
    transcribeFailed: "Couldn't transcribe that. Please try again or type your note.",
    exampleCaption: "Example of what someone experiencing this might say:",
    noExample: "No example is available for this item.",
    noConcerns: "No concerns noted here today.",
    quickLookBack: "A quick look back at today",
    headerSubtitle: "A supportive check-in tool for women receiving cancer care",
    helloImBraveEve: "🌸 Hello! I'm BraveEve",
    reassurance: (name) =>
      `${name}, please don't get scared by the list of items. Most people face most of these in their everyday life. This is a small reminder that you matter, what you feel matter and most importantly you are not alone.`,
  },
  kn: {
    continue: "ಮುಂದುವರಿಸಿ",
    next: "ಮುಂದೆ",
    finish: "ಮುಗಿಸಿ",
    back: "← ಹಿಂದೆ",
    yes: "ಹೌದು",
    no: "ಇಲ್ಲ",
    begin: "ಪ್ರಾರಂಭಿಸಿ",
    pause: "ವಿರಾಮ",
    stop: "ನಿಲ್ಲಿಸಿ",
    resume: "ಮುಂದುವರಿಸಿ",
    yourNamePlaceholder: "ನಿಮ್ಮ ಹೆಸರು",
    noDistress: "ಯಾವುದೇ ತೊಂದರೆ ಇಲ್ಲ",
    extremeDistress: "ತೀವ್ರ ತೊಂದರೆ",
    sectionOf: (i, n) => `ವಿಭಾಗ ${i} / ${n}`,
    markAllApply: "ಅನ್ವಯಿಸುವ ಎಲ್ಲವನ್ನೂ ಗುರುತಿಸಿ. ಇದನ್ನು ಅನುಭವಿಸುತ್ತಿರುವ ಯಾರಾದರೂ ಏನು ಹೇಳಬಹುದು ಎಂಬುದರ ಉದಾಹರಣೆಗಾಗಿ 💡 ಅನ್ನು ಟ್ಯಾಪ್ ಮಾಡಿ.",
    recordVoiceNote: "🎙️ ಧ್ವನಿ ಟಿಪ್ಪಣಿ ರೆಕಾರ್ಡ್ ಮಾಡಿ",
    stopRecordingBtn: "⏹ ರೆಕಾರ್ಡಿಂಗ್ ನಿಲ್ಲಿಸಿ",
    listening: "ಕೇಳುತ್ತಿದೆ… ನಿಲ್ಲಿಸಲು ಮತ್ತೆ ಟ್ಯಾಪ್ ಮಾಡಿ.",
    transcribing: "ಪ್ರತಿಲೇಖನ ಮಾಡಲಾಗುತ್ತಿದೆ…",
    addedToNote: "ನಿಮ್ಮ ಟಿಪ್ಪಣಿಗೆ ಸೇರಿಸಲಾಗಿದೆ — ಬೇಕಿದ್ದರೆ ಸಂಪಾದಿಸಿ.",
    didntCatch: "ಸ್ಪಷ್ಟವಾಗಿ ಕೇಳಿಸಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ ಅಥವಾ ಟೈಪ್ ಮಾಡಿ.",
    micError: "ಮೈಕ್ರೊಫೋನ್ ಪ್ರವೇಶಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ನೀವು ಇನ್ನೂ ಟೈಪ್ ಮಾಡಬಹುದು.",
    transcribeFailed: "ಪ್ರತಿಲೇಖಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ ಅಥವಾ ಟೈಪ್ ಮಾಡಿ.",
    exampleCaption: "ಇದನ್ನು ಅನುಭವಿಸುತ್ತಿರುವ ಯಾರಾದರೂ ಏನು ಹೇಳಬಹುದು ಎಂಬುದರ ಉದಾಹರಣೆ:",
    noExample: "ಈ ವಿಷಯಕ್ಕೆ ಯಾವುದೇ ಉದಾಹರಣೆ ಲಭ್ಯವಿಲ್ಲ.",
    noConcerns: "ಇಂದು ಇಲ್ಲಿ ಯಾವುದೇ ಕಾಳಜಿಗಳು ಕಂಡುಬಂದಿಲ್ಲ.",
    quickLookBack: "ಇಂದಿನ ಒಂದು ಸಣ್ಣ ಹಿನ್ನೋಟ",
    headerSubtitle: "ಕ್ಯಾನ್ಸರ್ ಆರೈಕೆ ಪಡೆಯುತ್ತಿರುವ ಮಹಿಳೆಯರಿಗಾಗಿ ಒಂದು ಬೆಂಬಲ ಪರಿಶೀಲನಾ ಸಾಧನ",
    helloImBraveEve: "🌸 ನಮಸ್ಕಾರ! ನಾನು BraveEve",
    reassurance: (name) =>
      `${name}, ಈ ಪಟ್ಟಿಯ ವಿಷಯಗಳಿಂದ ದಯವಿಟ್ಟು ಹೆದರಬೇಡಿ. ಹೆಚ್ಚಿನ ಜನರು ತಮ್ಮ ದೈನಂದಿನ ಜೀವನದಲ್ಲಿ ಇವುಗಳಲ್ಲಿ ಹೆಚ್ಚಿನವನ್ನು ಎದುರಿಸುತ್ತಾರೆ. ನೀವು ಮುಖ್ಯರು, ನೀವು ಅನುಭವಿಸುವುದು ಮುಖ್ಯ, ಮತ್ತು ಎಲ್ಲಕ್ಕಿಂತ ಮುಖ್ಯವಾಗಿ ನೀವು ಒಬ್ಬಂಟಿಗರಲ್ಲ ಎಂಬುದನ್ನು ನೆನಪಿಸುವ ಒಂದು ಸಣ್ಣ ಜ್ಞಾಪನೆ ಇದು.`,
  },
};

function t(key, ...args) {
  const lang = (currentState && currentState.language) || "en";
  const dict = UI_STRINGS[lang] || UI_STRINGS.en;
  const entry = dict[key] ?? UI_STRINGS.en[key];
  return typeof entry === "function" ? entry(...args) : entry;
}

// ---------------------------------------------------------------------
// networking
// ---------------------------------------------------------------------

async function startSession() {
  const res = await fetch("/api/session/start", { method: "POST" });
  const state = await res.json();
  localStorage.setItem("braveeve_session_id", state.sessionId);
  return state;
}

async function resumeSession(sessionId) {
  const res = await fetch(`/api/session/${sessionId}`);
  if (!res.ok) return null;
  return res.json();
}

async function sendAction(type, payload = {}) {
  const sessionId = currentState.sessionId;
  const res = await fetch(`/api/session/${sessionId}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, ...payload }),
  });
  const data = await res.json();
  if (!res.ok) {
    lastError = data.error || "Something went wrong. Please try again.";
    render(currentState);
    return;
  }
  lastError = null;
  const shouldScrollTop = type === "back" || !currentState || significantChange(currentState, data);
  currentState = data;
  render(currentState);
  if (shouldScrollTop) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

// Small, deliberately understated link — Back is a secondary action and
// shouldn't visually compete with the primary choice on each screen.
function backLink() {
  return `<button class="back-link" id="back-btn">${esc(t("back"))}</button>`;
}

// True when the new state represents a genuinely new "page" the user should
// see from the top (a different screen, a new section, or the note-response
// card appearing) — as opposed to an in-place tweak like ticking a checkbox.
function significantChange(prev, next) {
  if (prev.screen !== next.screen) return true;
  if (next.screen === "question_loop") {
    return prev.sectionIndex !== next.sectionIndex;
  }
  return false;
}

// ---------------------------------------------------------------------
// small building blocks
// ---------------------------------------------------------------------

function card({ text, mascot, title, side = "right", cardColor = "#fff", extraClass = "" }) {
  const padClass = side === "right" ? "pad-right" : "pad-left";
  const mascotHtml = mascot
    ? `<img class="card-mascot ${side}" src="${mascotSrc(mascot)}" onerror="this.style.display='none'"/>`
    : "";
  const titleHtml = title ? `<h2 class="${mascot ? padClass : ""}">${esc(title)}</h2>` : "";
  return `
    <div class="card ${extraClass}" style="background:${cardColor}">
      ${mascotHtml}
      ${titleHtml}
      <div class="card-text ${padClass}">${esc(text)}</div>
    </div>
  `;
}

function errorBanner() {
  if (!lastError) return "";
  return `<div class="error-banner">${esc(lastError)}</div>`;
}

// ---------------------------------------------------------------------
// screens
// ---------------------------------------------------------------------

function screenLanguageChoice() {
  // Shown before any language is chosen, so both languages appear
  // simultaneously rather than relying on t() / currentState.language.
  root.innerHTML = `
    <div class="logo-mark">
      <img src="${mascotSrc("header")}" alt="BraveEve" onerror="this.style.display='none'"/>
    </div>
    <div class="card">
      <div class="card-text" style="text-align:center">
        Choose your language<br/>ನಿಮ್ಮ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ
      </div>
    </div>
    <div class="btn-row two">
      <button class="pill" id="lang-en-btn">English</button>
      <button class="pill" id="lang-kn-btn">ಕನ್ನಡ</button>
    </div>
  `;
  document.getElementById("lang-en-btn").onclick = () => sendAction("set_language", { lang: "en" });
  document.getElementById("lang-kn-btn").onclick = () => sendAction("set_language", { lang: "kn" });
}

function screenName(state) {
  root.innerHTML = `
    <div class="logo-mark">
      <img src="${mascotSrc("header")}" alt="BraveEve" onerror="this.style.display='none'"/>
    </div>
    <p class="header-sub">${esc(t("headerSubtitle"))}</p>
    <hr class="divider"/>
    ${errorBanner()}
    ${backLink()}
    ${card({ text: state.message, mascot: "BraveEve_waving", title: t("helloImBraveEve"), side: "right", cardColor: "#fff" })}
    <input type="text" id="name-input" placeholder="${esc(t("yourNamePlaceholder"))}" autofocus />
    <div class="btn-row">
      <button class="pill" id="continue-btn">${esc(t("continue"))}</button>
    </div>
  `;
  const input = document.getElementById("name-input");
  const submit = () => sendAction("submit_name", { name: input.value });
  document.getElementById("continue-btn").onclick = submit;
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
}

function screenNameAffirmation(state) {
  root.innerHTML = `
    ${errorBanner()}
    ${backLink()}
    ${card({ text: state.text, mascot: "BraveEve_grateful", side: "right", cardColor: "#fff5f8" })}
    <div class="btn-row"><button class="pill" id="next-btn">${esc(t("next"))}</button></div>
  `;
  document.getElementById("next-btn").onclick = () => sendAction("next");
}

function screenDayFeeling(state) {
  root.innerHTML = `
    ${errorBanner()}
    ${backLink()}
    <p>${esc(state.message)}</p>
    <div class="radio-group" id="day-options">
      ${state.options.map((o, i) => `
        <label><input type="radio" name="day" value="${esc(o)}" ${i === 0 ? "checked" : ""}/> ${esc(o)}</label>
      `).join("")}
    </div>
    <div class="btn-row"><button class="pill" id="continue-btn">${esc(t("continue"))}</button></div>
  `;
  document.getElementById("continue-btn").onclick = () => {
    const choice = document.querySelector('input[name="day"]:checked').value;
    sendAction("submit_day_feeling", { choice });
  };
}

function screenDayFeelingResponse(state) {
  root.innerHTML = `
    ${errorBanner()}
    ${backLink()}
    ${card({ text: state.text, mascot: "BraveEve_proud", side: "right" })}
    <div class="btn-row"><button class="pill" id="continue-btn">${esc(t("continue"))}</button></div>
  `;
  document.getElementById("continue-btn").onclick = () => sendAction("next");
}

function yesNoScreen({ text, mascot, side, cardColor, question }, onAnswer) {
  root.innerHTML = `
    ${errorBanner()}
    ${backLink()}
    ${card({ text, mascot, side, cardColor })}
    ${question ? `<p>${esc(question)}</p>` : ""}
    <div class="btn-row two">
      <button class="pill" id="yes-btn">${esc(t("yes"))}</button>
      <button class="pill secondary" id="no-btn">${esc(t("no"))}</button>
    </div>
  `;
  document.getElementById("yes-btn").onclick = () => onAnswer("yes");
  document.getElementById("no-btn").onclick = () => onAnswer("no");
}

function screenDistressAwareness(state) {
  yesNoScreen(
    { text: state.message, mascot: "BraveEve_thoughtful", side: "left", cardColor: "#fffdf8" },
    (value) => sendAction("answer", { value })
  );
}

function screenDistressExplain(state) {
  root.innerHTML = `
    ${errorBanner()}
    ${backLink()}
    ${card({ text: state.text, mascot: "BraveEve_pointing_up", side: "right", cardColor: "#faf6ff" })}
    <p>${esc(state.question)}</p>
    <div class="btn-row two">
      <button class="pill" id="yes-btn">${esc(t("yes"))}</button>
      <button class="pill secondary" id="no-btn">${esc(t("no"))}</button>
    </div>
  `;
  document.getElementById("yes-btn").onclick = () => sendAction("answer", { value: "yes" });
  document.getElementById("no-btn").onclick = () => sendAction("answer", { value: "no" });
}

function screenDistressReexplain(state) {
  root.innerHTML = `
    ${errorBanner()}
    ${backLink()}
    ${card({ text: state.text, mascot: "BraveEve_pointing_up", side: "left", cardColor: "#feedfd" })}
    <p>${esc(state.question)}</p>
    <div class="btn-row two">
      <button class="pill" id="yes-btn">${esc(t("yes"))}</button>
      <button class="pill secondary" id="no-btn">${esc(t("no"))}</button>
    </div>
    ${state.showHelp ? `
      <div class="alert-warning">${esc(state.helpText)}</div>
      <div class="btn-row"><button class="pill" id="help-continue-btn">${esc(t("continue"))}</button></div>
    ` : ""}
  `;
  document.getElementById("yes-btn").onclick = () => sendAction("answer", { value: "yes" });
  document.getElementById("no-btn").onclick = () => sendAction("answer", { value: "no" });
  const helpBtn = document.getElementById("help-continue-btn");
  if (helpBtn) helpBtn.onclick = () => sendAction("help_continue");
}

const SCORE_BAND_COLORS = { low: "#4caf7d", moderate: "#e0a531", high: "#e0574a" };

function bandForScore(score) {
  if (score <= 3) return "low";
  if (score <= 6) return "moderate";
  return "high";
}

function screenDistressScore(state) {
  root.innerHTML = `
    ${errorBanner()}
    ${backLink()}
    <p>${esc(state.message)}</p>
    <div class="score-value" id="score-display">5</div>
    <input type="range" min="0" max="10" value="5" id="score-slider" class="distress-slider" />
    <div class="score-anchors">
      <span>${esc(t("noDistress"))}</span>
      <span>${esc(t("extremeDistress"))}</span>
    </div>
    <div class="btn-row"><button class="pill" id="continue-btn">${esc(t("continue"))}</button></div>
  `;
  const slider = document.getElementById("score-slider");
  const display = document.getElementById("score-display");
  const updateColor = () => {
    display.textContent = slider.value;
    display.style.color = SCORE_BAND_COLORS[bandForScore(Number(slider.value))];
  };
  updateColor();
  slider.addEventListener("input", updateColor);
  document.getElementById("continue-btn").onclick = () => sendAction("submit_score", { score: Number(slider.value) });
}

function screenScoreResponse(state) {
  root.innerHTML = `
    ${errorBanner()}
    ${backLink()}
    <div class="note-box">${esc(state.text)}</div>
    <div class="btn-row"><button class="pill" id="continue-btn">${esc(t("continue"))}</button></div>
  `;
  document.getElementById("continue-btn").onclick = () => sendAction("next");
}

function screenQuestionTransition(state) {
  root.innerHTML = `
    ${errorBanner()}
    ${backLink()}
    ${card({ text: state.text, mascot: "BraveEve_few_questions", side: "right", cardColor: "#faf6ff" })}
    <div class="btn-row three">
      <button class="pill" id="begin-btn">${esc(t("begin"))}</button>
      <button class="pill secondary" id="pause-btn">${esc(t("pause"))}</button>
      <button class="pill secondary" id="stop-btn">${esc(t("stop"))}</button>
    </div>
  `;
  document.getElementById("begin-btn").onclick = () => sendAction("begin");
  document.getElementById("pause-btn").onclick = () => sendAction("pause");
  document.getElementById("stop-btn").onclick = () => sendAction("stop");
}

function screenQuestionLoop(state) {
  if (state.sectionIndex !== lastVoiceSectionIndex) {
    pendingNativeText = "";
    lastVoiceSectionIndex = state.sectionIndex;
  }

  const mascotHtml = state.sectionMascot
    ? `<img src="${mascotSrc(state.sectionMascot)}" onerror="this.style.display='none'"/>`
    : "";

  const itemsHtml = state.items.map((row, idx) => {
    const verbatimHtml = row.verbatim && row.verbatim.trim() && row.verbatim.toLowerCase() !== "nan"
      ? `<div class="caption">${esc(t("exampleCaption"))}</div><blockquote>${esc(row.verbatim)}</blockquote>`
      : `<div class="caption">${esc(t("noExample"))}</div>`;

    const affirmationHtml = row.checked && row.affirmation && row.affirmation.trim() && row.affirmation.toLowerCase() !== "nan"
      ? `<div class="affirmation">${esc(row.affirmation)}</div>`
      : "";

    return `
      <div class="item-card">
        <div class="item-row">
          <input type="checkbox" id="chk-${idx}" data-key="${esc(row.key)}" ${row.checked ? "checked" : ""}/>
          <label for="chk-${idx}"><strong>${esc(row.item)}:</strong> ${esc(row.question)}</label>
        </div>
        <button class="hint-btn" data-hint="${idx}" type="button">💡</button>
        <div class="hint-popover" id="hint-${idx}">${verbatimHtml}</div>
        ${affirmationHtml}
      </div>
    `;
  }).join("");

  const voiceSupported = !!(navigator.mediaDevices && window.MediaRecorder);

  root.innerHTML = `
    ${errorBanner()}
    ${backLink()}
    <div class="section-header">
      <span class="section-badge">${esc(state.sectionName)}</span>
      ${mascotHtml}
    </div>
    <div class="progress-wrap">
      <strong>${esc(t("sectionOf", state.sectionIndex + 1, state.totalSections))}</strong>
      <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${Math.round(state.progress * 100)}%"></div></div>
    </div>
    <h3 class="section-intro">${esc(state.introText)}</h3>
    <div class="section-hint">${esc(t("markAllApply"))}</div>

    ${itemsHtml}

    <hr class="divider"/>

    <div class="note-prompt-label">${esc(state.notePrompt)}</div>
    ${voiceSupported ? `
      <button class="mic-btn" id="mic-btn" type="button" ${state.awaitingContinue ? "disabled" : ""}>${esc(t("recordVoiceNote"))}</button>
      <div class="mic-status" id="mic-status"></div>
    ` : ""}
    <textarea id="note-input" ${state.awaitingContinue ? "disabled" : ""}></textarea>

    ${state.awaitingContinue ? `
      <div class="note-box">${esc(state.pendingMessage)}</div>
      <div class="btn-row"><button class="pill" id="continue-note-btn">${state.isLastSection ? esc(t("finish")) : esc(t("continue"))}</button></div>
    ` : `
      <div class="btn-row"><button class="pill" id="next-btn">${state.isLastSection ? esc(t("finish")) : esc(t("next"))}</button></div>
    `}

    <hr class="divider"/>
    <div class="btn-row two">
      <button class="pill secondary" id="pause-btn">${esc(t("pause"))}</button>
      <button class="pill secondary" id="stop-btn">${esc(t("stop"))}</button>
    </div>
  `;

  // Checkbox toggles round-trip to the server and re-render this whole
  // screen from scratch — preserve whatever's currently in the notes box
  // (typed or transcribed) across that re-render instead of losing it.
  root.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", async () => {
      const noteBox = document.getElementById("note-input");
      const preserved = noteBox ? noteBox.value : "";
      await sendAction("toggle_check", { item: cb.dataset.key, checked: cb.checked });
      const newNoteBox = document.getElementById("note-input");
      if (newNoteBox) newNoteBox.value = preserved;
    });
  });

  root.querySelectorAll(".hint-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById(`hint-${btn.dataset.hint}`).classList.toggle("open");
    });
  });

  wireMicButton();

  const nextBtn = document.getElementById("next-btn");
  if (nextBtn) {
    nextBtn.onclick = () => {
      const note = document.getElementById("note-input").value;
      sendAction("next", { note, nativeNote: pendingNativeText });
    };
  }

  const continueNoteBtn = document.getElementById("continue-note-btn");
  if (continueNoteBtn) continueNoteBtn.onclick = () => sendAction("continue_after_note");

  document.getElementById("pause-btn").onclick = () => sendAction("pause");
  document.getElementById("stop-btn").onclick = () => sendAction("stop");
}

const MAX_RECORDING_MS = 28000; // Sarvam's sync endpoint caps at 30s

function wireMicButton() {
  const micBtn = document.getElementById("mic-btn");
  const micStatus = document.getElementById("mic-status");
  if (!micBtn) return;

  micBtn.onclick = async () => {
    if (activeRecorder && activeRecorder.state === "recording") {
      activeRecorder.stop();
      return;
    }
    await startRecording(micBtn, micStatus);
  };
}

async function startRecording(micBtn, micStatus) {
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    micStatus.textContent = t("micError");
    return;
  }

  const chunks = [];
  const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
  activeRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

  activeRecorder.addEventListener("dataavailable", (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  });

  activeRecorder.addEventListener("stop", async () => {
    stream.getTracks().forEach((tr) => tr.stop());
    clearTimeout(recordingTimer);
    micBtn.textContent = t("recordVoiceNote");
    micBtn.classList.remove("recording");
    micBtn.disabled = true;
    micStatus.textContent = t("transcribing");

    const blobType = activeRecorder.mimeType || "audio/webm";
    const blob = new Blob(chunks, { type: blobType });

    try {
      const res = await fetch(`/api/session/${currentState.sessionId}/transcribe`, {
        method: "POST",
        headers: { "Content-Type": blobType },
        body: blob,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transcription failed");

      const noteBox = document.getElementById("note-input");
      if (noteBox) {
        const existing = noteBox.value.trim();
        noteBox.value = existing ? `${existing} ${data.englishText}`.trim() : (data.englishText || "");
      }
      pendingNativeText = pendingNativeText
        ? `${pendingNativeText} ${data.nativeText || ""}`.trim()
        : (data.nativeText || "");

      micStatus.textContent = data.englishText ? t("addedToNote") : t("didntCatch");
    } catch (err) {
      micStatus.textContent = t("transcribeFailed");
    } finally {
      micBtn.disabled = false;
      activeRecorder = null;
    }
  });

  activeRecorder.start();
  micBtn.textContent = t("stopRecordingBtn");
  micBtn.classList.add("recording");
  micStatus.textContent = t("listening");

  recordingTimer = setTimeout(() => {
    if (activeRecorder && activeRecorder.state === "recording") activeRecorder.stop();
  }, MAX_RECORDING_MS);
}

function screenPause() {
  root.innerHTML = `
    ${errorBanner()}
    ${card({ text: `🌿 ${currentState.text || ""}`, mascot: "BraveEve_deep_breath", side: "right", cardColor: "#fffdf8" })}
    <div class="btn-row two">
      <button class="pill" id="resume-btn">${esc(t("resume"))}</button>
      <button class="pill secondary" id="stop-btn">${esc(t("stop"))}</button>
    </div>
  `;
  document.getElementById("resume-btn").onclick = () => sendAction("resume");
  document.getElementById("stop-btn").onclick = () => sendAction("stop");
}

function screenResume(state) {
  root.innerHTML = `
    ${errorBanner()}
    ${card({ text: state.text, mascot: "BraveEve_excited", side: "right", cardColor: "#fff5f8" })}
    <div class="btn-row"><button class="pill" id="continue-btn">${esc(t("continue"))}</button></div>
  `;
  document.getElementById("continue-btn").onclick = () => sendAction("continue");
}

function summaryCard(summary, name) {
  if (!summary) return "";
  const band = summary.scoreBand;
  const bandColor = band ? SCORE_BAND_COLORS[band.key] : "#999";

  const sectionsHtml = summary.sections.map((s) => {
    const hasItems = s.items && s.items.length > 0;
    return `
      <div class="summary-section">
        <div class="summary-section-name">${esc(s.name)}</div>
        ${hasItems
          ? `<ul class="summary-item-list">${s.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`
          : `<div class="summary-empty">${esc(t("noConcerns"))}</div>`
        }
      </div>
    `;
  }).join("");

  return `
    <div class="summary-card">
      <div class="summary-title">${esc(t("quickLookBack"))}</div>
      ${summary.distressScore !== null ? `
        <div class="summary-score-row">
          <div class="summary-score-value" style="color:${bandColor}">${summary.distressScore}<span class="summary-score-max">/10</span></div>
        </div>
        ${summary.scoreReflection ? `<div class="summary-score-reflection">${esc(summary.scoreReflection)}</div>` : ""}
      ` : ""}
      <div class="summary-sections">${sectionsHtml}</div>
      <div class="summary-reassurance">${esc(t("reassurance", name))}</div>
    </div>
  `;
}

function screenEnd(state) {
  root.innerHTML = `
    ${errorBanner()}
    <div class="closing-box">${esc(state.closingAcknowledgment)}</div>
    ${card({ text: state.endMessage, mascot: "BraveEve_thank_you", side: "right", cardColor: "#fff8fb" })}
    <div class="mascot-center"><img src="${mascotSrc("heart_bubble")}" width="55" onerror="this.style.display='none'"/></div>
    ${state.showDistressAlert ? `<div class="alert-warning">${esc(state.distressAlert)}</div>` : ""}
    ${summaryCard(state.summary, state.name)}
    <hr class="divider"/>
    <div class="caption">${esc(state.disclaimer)}</div>
  `;
}

// ---------------------------------------------------------------------
// dispatch
// ---------------------------------------------------------------------

const SCREENS = {
  language_choice: screenLanguageChoice,
  name: screenName,
  name_affirmation: screenNameAffirmation,
  day_feeling: screenDayFeeling,
  day_feeling_response: screenDayFeelingResponse,
  distress_awareness: screenDistressAwareness,
  distress_explain: screenDistressExplain,
  distress_reexplain: screenDistressReexplain,
  distress_score: screenDistressScore,
  score_response: screenScoreResponse,
  question_transition: screenQuestionTransition,
  question_loop: screenQuestionLoop,
  pause: screenPause,
  resume: screenResume,
  end: screenEnd,
};

function render(state) {
  const fn = SCREENS[state.screen];
  if (!fn) {
    root.innerHTML = `<p>Unknown screen: ${esc(state.screen)}</p>`;
    return;
  }
  fn(state);

  const backBtn = document.getElementById("back-btn");
  if (backBtn) backBtn.onclick = () => sendAction("back");
}

// ---------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------

(async function init() {
  root.innerHTML = `<p>Loading...</p>`;
  const savedId = localStorage.getItem("braveeve_session_id");
  let state = savedId ? await resumeSession(savedId) : null;
  if (!state) state = await startSession();
  currentState = state;
  render(state);
})();
