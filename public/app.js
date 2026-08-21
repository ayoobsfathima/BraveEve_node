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
  return `<button class="back-link" id="back-btn">← Back</button>`;
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

function screenName(state) {
  root.innerHTML = `
    <div class="logo-mark">
      <img src="${mascotSrc("header")}" alt="BraveEve" onerror="this.style.display='none'"/>
    </div>
    <p class="header-sub">A supportive check-in tool for women receiving cancer care</p>
    <hr class="divider"/>
    ${errorBanner()}
    ${card({ text: state.message, mascot: "BraveEve_waving", title: "🌸 Hello! I'm BraveEve", side: "right", cardColor: "#fff" })}
    <input type="text" id="name-input" placeholder="Your name" autofocus />
    <div class="btn-row">
      <button class="pill" id="continue-btn">Continue</button>
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
    <div class="btn-row"><button class="pill" id="next-btn">Next</button></div>
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
    <div class="btn-row"><button class="pill" id="continue-btn">Continue</button></div>
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
    <div class="btn-row"><button class="pill" id="continue-btn">Continue</button></div>
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
      <button class="pill" id="yes-btn">Yes</button>
      <button class="pill secondary" id="no-btn">No</button>
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
      <button class="pill" id="yes-btn">Yes</button>
      <button class="pill secondary" id="no-btn">No</button>
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
      <button class="pill" id="yes-btn">Yes</button>
      <button class="pill secondary" id="no-btn">No</button>
    </div>
    ${state.showHelp ? `
      <div class="alert-warning">${esc(state.helpText)}</div>
      <div class="btn-row"><button class="pill" id="help-continue-btn">Continue</button></div>
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
      <span>No distress</span>
      <span>Extreme distress</span>
    </div>
    <div class="btn-row"><button class="pill" id="continue-btn">Continue</button></div>
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
    <div class="btn-row"><button class="pill" id="continue-btn">Continue</button></div>
  `;
  document.getElementById("continue-btn").onclick = () => sendAction("next");
}

function screenQuestionTransition(state) {
  root.innerHTML = `
    ${errorBanner()}
    ${backLink()}
    ${card({ text: state.text, mascot: "BraveEve_few_questions", side: "right", cardColor: "#faf6ff" })}
    <div class="btn-row three">
      <button class="pill" id="begin-btn">Begin</button>
      <button class="pill secondary" id="pause-btn">Pause</button>
      <button class="pill secondary" id="stop-btn">Stop</button>
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
      ? `<div class="caption">Example of what someone experiencing this might say:</div><blockquote>${esc(row.verbatim)}</blockquote>`
      : `<div class="caption">No example is available for this item.</div>`;

    const affirmationHtml = row.checked && row.affirmation && row.affirmation.trim() && row.affirmation.toLowerCase() !== "nan"
      ? `<div class="affirmation">${esc(row.affirmation)}</div>`
      : "";

    return `
      <div class="item-card">
        <div class="item-row">
          <input type="checkbox" id="chk-${idx}" data-item="${esc(row.item)}" ${row.checked ? "checked" : ""}/>
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
      <strong>Section ${state.sectionIndex + 1} of ${state.totalSections}</strong>
      <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${Math.round(state.progress * 100)}%"></div></div>
    </div>
    <h3 class="section-intro">${esc(state.introText)}</h3>
    <div class="section-hint">Mark all that apply. Tap the 💡 next to an item for an example of what someone experiencing this might say.</div>

    ${itemsHtml}

    <hr class="divider"/>

    <div class="note-prompt-label">${esc(state.notePrompt)}</div>
    ${voiceSupported ? `
      <button class="mic-btn" id="mic-btn" type="button" ${state.awaitingContinue ? "disabled" : ""}>🎙️ Record voice note</button>
      <div class="mic-status" id="mic-status"></div>
    ` : ""}
    <textarea id="note-input" ${state.awaitingContinue ? "disabled" : ""}></textarea>

    ${state.awaitingContinue ? `
      <div class="note-box">${esc(state.pendingMessage)}</div>
      <div class="btn-row"><button class="pill" id="continue-note-btn">${state.isLastSection ? "Finish" : "Continue"}</button></div>
    ` : `
      <div class="btn-row"><button class="pill" id="next-btn">${state.isLastSection ? "Finish" : "Next"}</button></div>
    `}

    <hr class="divider"/>
    <div class="btn-row two">
      <button class="pill secondary" id="pause-btn">Pause</button>
      <button class="pill secondary" id="stop-btn">Stop</button>
    </div>
  `;

  // Checkbox toggles round-trip to the server and re-render this whole
  // screen from scratch — preserve whatever's currently in the notes box
  // (typed or transcribed) across that re-render instead of losing it.
  root.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", async () => {
      const noteBox = document.getElementById("note-input");
      const preserved = noteBox ? noteBox.value : "";
      await sendAction("toggle_check", { item: cb.dataset.item, checked: cb.checked });
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
    micStatus.textContent = "Couldn't access the microphone. You can still type your note.";
    return;
  }

  const chunks = [];
  const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
  activeRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

  activeRecorder.addEventListener("dataavailable", (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  });

  activeRecorder.addEventListener("stop", async () => {
    stream.getTracks().forEach((t) => t.stop());
    clearTimeout(recordingTimer);
    micBtn.textContent = "🎙️ Record voice note";
    micBtn.classList.remove("recording");
    micBtn.disabled = true;
    micStatus.textContent = "Transcribing…";

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

      micStatus.textContent = data.englishText
        ? "Added to your note below — feel free to edit it."
        : "Didn't catch that clearly. Please try again or type your note.";
    } catch (err) {
      micStatus.textContent = "Couldn't transcribe that. Please try again or type your note.";
    } finally {
      micBtn.disabled = false;
      activeRecorder = null;
    }
  });

  activeRecorder.start();
  micBtn.textContent = "⏹ Stop recording";
  micBtn.classList.add("recording");
  micStatus.textContent = "Listening… tap again to stop.";

  recordingTimer = setTimeout(() => {
    if (activeRecorder && activeRecorder.state === "recording") activeRecorder.stop();
  }, MAX_RECORDING_MS);
}

function screenPause() {
  root.innerHTML = `
    ${errorBanner()}
    ${card({ text: `🌿 ${currentState.text || ""}`, mascot: "BraveEve_deep_breath", side: "right", cardColor: "#fffdf8" })}
    <div class="btn-row two">
      <button class="pill" id="resume-btn">Resume</button>
      <button class="pill secondary" id="stop-btn">Stop</button>
    </div>
  `;
  document.getElementById("resume-btn").onclick = () => sendAction("resume");
  document.getElementById("stop-btn").onclick = () => sendAction("stop");
}

function screenResume(state) {
  root.innerHTML = `
    ${errorBanner()}
    ${card({ text: state.text, mascot: "BraveEve_excited", side: "right", cardColor: "#fff5f8" })}
    <div class="btn-row"><button class="pill" id="continue-btn">Continue</button></div>
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
          : `<div class="summary-empty">No concerns noted here today.</div>`
        }
        
      </div>
    `;
  }).join("");

  return `
    <div class="summary-card">
      <div class="summary-title">A quick look back at today</div>
      ${summary.distressScore !== null ? `
        <div class="summary-score-row">
          <div class="summary-score-value" style="color:${bandColor}">${summary.distressScore}<span class="summary-score-max">/10</span></div>
        </div>
        ${summary.scoreReflection ? `<div class="summary-score-reflection">${esc(summary.scoreReflection)}</div>` : ""}
      ` : ""}
      <div class="summary-sections">${sectionsHtml}</div>
      <div class="summary-reassurance">${esc(name)}, please don't get scared by the list of items. Most people face most of these in their everyday life. This is a small reminder that you matter, what you feel matter and most importantly you are not alone.</div>
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
