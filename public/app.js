const root = document.getElementById("app");
let currentState = null;
let lastError = null;

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
  const shouldScrollTop = !currentState || significantChange(currentState, data);
  currentState = data;
  render(currentState);
  if (shouldScrollTop) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  }

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
  const titleHtml = title ? `<h2>${esc(title)}</h2>` : "";
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
    <img src="${mascotSrc("header")}" style="width:100%;border-radius:12px;margin-bottom:6px" onerror="this.style.display='none'"/>
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
    ${card({ text: state.text, mascot: "BraveEve_grateful", side: "right", cardColor: "#fff5f8" })}
    <div class="btn-row"><button class="pill" id="next-btn">Next</button></div>
  `;
  document.getElementById("next-btn").onclick = () => sendAction("next");
}

function screenDayFeeling(state) {
  root.innerHTML = `
    ${errorBanner()}
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
    ${card({ text: state.text, mascot: "BraveEve_proud", side: "right" })}
    <div class="btn-row"><button class="pill" id="continue-btn">Continue</button></div>
  `;
  document.getElementById("continue-btn").onclick = () => sendAction("next");
}

function yesNoScreen({ text, mascot, side, cardColor, question }, onAnswer) {
  root.innerHTML = `
    ${errorBanner()}
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

function screenDistressScore(state) {
  root.innerHTML = `
    ${errorBanner()}
    <p>${esc(state.message)}</p>
    <div class="score-value" id="score-display">5</div>
    <input type="range" min="0" max="10" value="5" id="score-slider" />
    <div class="btn-row"><button class="pill" id="continue-btn">Continue</button></div>
  `;
  const slider = document.getElementById("score-slider");
  const display = document.getElementById("score-display");
  slider.addEventListener("input", () => { display.textContent = slider.value; });
  document.getElementById("continue-btn").onclick = () => sendAction("submit_score", { score: Number(slider.value) });
}

function screenScoreResponse(state) {
  root.innerHTML = `
    ${errorBanner()}
    <div class="note-box">${esc(state.text)}</div>
    <div class="btn-row"><button class="pill" id="continue-btn">Continue</button></div>
  `;
  document.getElementById("continue-btn").onclick = () => sendAction("next");
}

function screenQuestionTransition(state) {
  root.innerHTML = `
    ${errorBanner()}
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

  root.innerHTML = `
    ${errorBanner()}
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
    <button class="mic-btn" disabled title="Voice notes coming soon">🎙️ Voice note (coming soon)</button>
    <textarea id="note-input" ${state.awaitingContinue ? "disabled" : ""}></textarea>

    ${state.awaitingContinue ? `
      <div class="note-box">${esc(state.pendingMessage)}</div>
      <div class="btn-row"><button class="pill" id="continue-note-btn">${state.isLastSection ? "Finish" : "Continue"}</button></div>
    ` : `
      <div class="btn-row two">
        ${state.sectionIndex > 0 ? `<button class="pill secondary" id="back-btn">Back</button>` : `<div></div>`}
        <button class="pill" id="next-btn">${state.isLastSection ? "Finish" : "Next"}</button>
      </div>
    `}

    <hr class="divider"/>
    <div class="btn-row two">
      <button class="pill secondary" id="pause-btn">Pause</button>
      <button class="pill secondary" id="stop-btn">Stop</button>
    </div>
  `;

  root.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", () => {
      sendAction("toggle_check", { item: cb.dataset.item, checked: cb.checked });
    });
  });

  root.querySelectorAll(".hint-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById(`hint-${btn.dataset.hint}`).classList.toggle("open");
    });
  });

  const backBtn = document.getElementById("back-btn");
  if (backBtn) backBtn.onclick = () => sendAction("back");

  const nextBtn = document.getElementById("next-btn");
  if (nextBtn) {
    nextBtn.onclick = () => {
      const note = document.getElementById("note-input").value;
      sendAction("next", { note });
    };
  }

  const continueNoteBtn = document.getElementById("continue-note-btn");
  if (continueNoteBtn) continueNoteBtn.onclick = () => sendAction("continue_after_note");

  document.getElementById("pause-btn").onclick = () => sendAction("pause");
  document.getElementById("stop-btn").onclick = () => sendAction("stop");
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

function screenEnd(state) {
  root.innerHTML = `
    ${errorBanner()}
    <div class="closing-box">${esc(state.closingAcknowledgment)}</div>
    ${card({ text: state.endMessage, mascot: "BraveEve_thank_you", side: "right", cardColor: "#fff8fb" })}
    <div class="mascot-center"><img src="${mascotSrc("heart_bubble")}" width="55" onerror="this.style.display='none'"/></div>
    ${state.showDistressAlert ? `<div class="alert-warning">${esc(state.distressAlert)}</div>` : ""}
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
