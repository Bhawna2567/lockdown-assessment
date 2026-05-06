// Student lockdown client. Handles UI + all browser-level lockdown behaviors.
// NOTE: Browser-level enforcement is a best-effort deterrent. True lockdown
// requires the Electron desktop wrapper (see electron/main.js).

// v3: webcam proctoring on, identity watermark on, aggressive blur+pause on focus loss.
const FEATURES = {
  webcam: true,
  vmDetection: false,
};

const els = {
  listView: document.getElementById('list-view'),
  consentView: document.getElementById('consent-view'),
  assessmentView: document.getElementById('assessment-view'),
  doneView: document.getElementById('done-view'),
  assessments: document.getElementById('assessments'),
  who: document.getElementById('who'),
  logout: document.getElementById('logout'),

  consentTitle: document.getElementById('consent-title'),
  consentDesc: document.getElementById('consent-desc'),
  consentDuration: document.getElementById('consent-duration'),
  consentBack: document.getElementById('consent-back'),
  consentStart: document.getElementById('consent-start'),
  envCheck: document.getElementById('env-check'),

  assessTitle: document.getElementById('assess-title'),
  timer: document.getElementById('timer'),
  questions: document.getElementById('questions'),
  submitBtn: document.getElementById('submit-btn'),
  violationBanner: document.getElementById('violation-banner'),

  webcamWrap: document.getElementById('webcam-wrap'),
  webcam: document.getElementById('webcam'),
  webcamCanvas: document.getElementById('webcam-canvas'),
  webcamStatus: document.getElementById('webcam-status'),

  doneMsg: document.getElementById('done-msg'),
  doneBack: document.getElementById('done-back'),
  doneReview: document.getElementById('done-review'),

  pastResults: document.getElementById('past-results'),
  reviewView: document.getElementById('review-view'),
  reviewTitle: document.getElementById('review-title'),
  reviewSummary: document.getElementById('review-summary'),
  reviewBody: document.getElementById('review-body'),
  reviewBack: document.getElementById('review-back'),

  passagePanel: document.getElementById('passage-panel'),
  passageText: document.getElementById('passage-text'),

  watermark: document.getElementById('anti-cheat-watermark'),
};

let currentUser = null;
let lastResultId = null;

let currentAssessment = null;
let answers = {};
let violations = [];
const MAX_VIOLATIONS = 3;
let startedAt = null;
let endAt = null;
let timerInterval = null;
let submitted = false;
let lockdownActive = false;

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// ---------- Anti-cheat watermark ----------
function showWatermark() {
  if (!els.watermark || !currentUser) return;
  const text = `${currentUser.email} · ${new Date().toLocaleString()}`;
  // Tile enough copies to fill a rotated grid covering the viewport.
  const cells = 120;
  els.watermark.innerHTML = Array(cells)
    .fill(0)
    .map(() => `<span>${escapeHtml(text)}</span>`)
    .join('');
  els.watermark.classList.add('active');
}

function hideWatermark() {
  if (!els.watermark) return;
  els.watermark.classList.remove('active');
  els.watermark.innerHTML = '';
}

// ---------- Init ----------
(async () => {
  const { user } = await api('/api/me');
  if (!user || user.role !== 'student') {
    location.href = '/';
    return;
  }
  currentUser = user;
  els.who.textContent = `${user.name} (${user.email})`;
  await loadAssessments();
  await loadPastResults();

  const m = /^#take=(.+)$/.exec(location.hash || '');
  if (m) {
    const id = decodeURIComponent(m[1]);
    history.replaceState(null, '', '/student.html');
    openConsent(id);
  }
})();

els.logout.onclick = async () => {
  if (lockdownActive) {
    alert('You cannot sign out during an active assessment.');
    return;
  }
  try { window.lockdown && window.lockdown.forceUnlock && window.lockdown.forceUnlock(); } catch {}
  try { await document.exitFullscreen?.(); } catch {}
  await api('/api/logout', { method: 'POST' });
  location.href = '/';
};

async function loadAssessments() {
  const list = await api('/api/assessments');
  if (!list.length) {
    els.assessments.innerHTML = `<div class="panel muted">No assessments are currently available.</div>`;
    return;
  }
  els.assessments.innerHTML = list
    .map((a) => `
      <div class="card" style="background:#1a1e33; color:#fff; border-color:#2b3152;">
        <div class="row">
          <div>
            <div class="card-title">${escapeHtml(a.title)}</div>
            <div class="muted" style="color:#9ba0bd;">${a.questionCount} questions · ${a.durationMinutes} min · by ${escapeHtml(a.teacherName)}</div>
            ${a.description ? `<div style="margin-top:6px;">${escapeHtml(a.description)}</div>` : ''}
          </div>
          <div class="spacer"></div>
          <button class="btn primary" data-id="${a.id}">Take assessment</button>
        </div>
      </div>
    `).join('');
  els.assessments.querySelectorAll('button[data-id]').forEach((b) => {
    b.onclick = () => openConsent(b.dataset.id);
  });
}

// ---------- Consent ----------
let envBlocked = false;
let envReport = null;

async function openConsent(id) {
  try {
    const { assessment } = await api(`/api/assessments/${id}/take`);
    currentAssessment = assessment;
  } catch (e) {
    alert(e.message);
    return;
  }
  els.listView.style.display = 'none';
  els.consentView.style.display = 'block';
  els.consentTitle.textContent = currentAssessment.title;
  els.consentDesc.textContent = currentAssessment.description || '';
  els.consentDuration.textContent = `${currentAssessment.durationMinutes} minutes · ${currentAssessment.questions.length} questions`;

  await runEnvironmentCheck();
}

async function runEnvironmentCheck() {
  envBlocked = false;
  envReport = null;

  if (!FEATURES.vmDetection) {
    els.envCheck.innerHTML = `
      <div class="env-ok">
        Ready to start. The screen will go fullscreen and disable tab-switching,
        copy/paste, right-click, and common keyboard shortcuts during the assessment.
        Webcam access will be requested when you click Start.
      </div>`;
    els.consentStart.disabled = false;
    return;
  }

  els.envCheck.innerHTML = '<em>Running environment check…</em>';

  if (!window.lockdown || !window.lockdown.isElectron) {
    els.envCheck.innerHTML = `
      <div class="env-warn">
        <strong>Heads up:</strong> you are taking this in a regular browser, so we cannot
        check for virtual machines. Your teacher will see this in the results.
      </div>`;
    return;
  }

  try {
    const report = await window.lockdown.detectVm();
    envReport = report;
    try {
      await api('/api/proctor/environment', {
        method: 'POST',
        body: { assessmentId: currentAssessment.id, report },
      });
    } catch {}
    if (report.isVm || report.confidence >= 0.5) {
      envBlocked = true;
      els.envCheck.innerHTML = `
        <div class="env-block">
          <strong>Blocked:</strong> this device appears to be a virtual machine
          (confidence ${Math.round(report.confidence * 100)}%).
          Please take this assessment on a physical device.
          <div style="margin-top:6px; font-size:12px; opacity:0.85;">${report.reasons.map(escapeHtml).join('<br/>')}</div>
        </div>`;
      els.consentStart.disabled = true;
      els.consentStart.textContent = 'Cannot start (VM detected)';
    } else {
      els.envCheck.innerHTML = `<div class="env-ok">Environment check passed (physical device).</div>`;
      els.consentStart.disabled = false;
    }
  } catch (e) {
    els.envCheck.innerHTML = `<div class="env-warn">Environment check failed: ${escapeHtml(e.message)}. Proceeding with caution.</div>`;
  }
}

els.consentBack.onclick = () => {
  els.consentView.style.display = 'none';
  els.listView.style.display = 'block';
  currentAssessment = null;
};

els.consentStart.onclick = async () => {
  if (envBlocked) return;
  if (FEATURES.webcam) {
    try {
      await startWebcam();
    } catch (e) {
      alert(
        'Webcam access is required for this assessment.\n\n' +
        e.message +
        '\n\nPlease allow camera access in your browser/OS settings and try again.'
      );
      return;
    }
  }
  try {
    await enterFullscreen();
  } catch (e) {
    alert('Fullscreen is required to start. ' + e.message);
    return;
  }
  startAssessment();
};

// ---------- Assessment ----------
function startAssessment() {
  els.consentView.style.display = 'none';
  els.assessmentView.style.display = 'block';
  els.assessTitle.textContent = currentAssessment.title;
  startedAt = new Date().toISOString();
  endAt = Date.now() + currentAssessment.durationMinutes * 60 * 1000;
  answers = {};
  violations = [];
  submitted = false;

  if (els.passagePanel && els.passageText) {
    if (currentAssessment.passage && currentAssessment.passage.trim()) {
      els.passageText.textContent = currentAssessment.passage;
      els.passagePanel.style.display = 'block';
    } else {
      els.passagePanel.style.display = 'none';
    }
  }

  showWatermark();
  renderQuestions();
  installLockdown();
  startTimer();
  if (FEATURES.webcam) {
    startProctorInterval();
    captureAndUpload('start');
  } else if (els.webcamWrap) {
    els.webcamWrap.style.display = 'none';
  }
}

function renderQuestions() {
  els.questions.innerHTML = currentAssessment.questions
    .map((q, i) => {
      let body = '';
      if (q.type === 'mc') {
        body = q.options.map((opt, oi) => `
          <label style="display:block; padding:8px; border:1px solid #2b3152; border-radius:6px; margin-bottom:6px; cursor:pointer;">
            <input type="radio" name="q-${q.id}" value="${oi}" /> ${escapeHtml(opt)}
          </label>
        `).join('');
      } else if (q.type === 'tf') {
        body = `
          <label style="display:block; padding:8px;"><input type="radio" name="q-${q.id}" value="true" /> True</label>
          <label style="display:block; padding:8px;"><input type="radio" name="q-${q.id}" value="false" /> False</label>
        `;
      } else if (q.type === 'short') {
        body = `<input type="text" data-q="${q.id}" placeholder="Your answer" />`;
      } else if (q.type === 'essay' || q.type === 'writing') {
        const rows = q.type === 'writing' ? 14 : 6;
        body = `<textarea data-q="${q.id}" rows="${rows}" placeholder="Write your answer here. Take your time, plan your structure, and proofread before submitting."></textarea>`;
      }
      return `
        <div class="panel">
          <div class="muted" style="margin-bottom: 4px;">Question ${i + 1} of ${currentAssessment.questions.length} · ${q.points} point${q.points === 1 ? '' : 's'}</div>
          <div style="font-size: 16px; margin-bottom: 12px;">${escapeHtml(q.prompt)}</div>
          ${body}
        </div>
      `;
    })
    .join('');

  currentAssessment.questions.forEach((q) => {
    if (q.type === 'mc' || q.type === 'tf') {
      document.getElementsByName(`q-${q.id}`).forEach((r) => {
        r.addEventListener('change', (e) => {
          answers[q.id] = q.type === 'mc' ? Number(e.target.value) : e.target.value === 'true';
        });
      });
    } else if (q.type === 'short' || q.type === 'essay' || q.type === 'writing') {
      const input = document.querySelector(`[data-q="${q.id}"]`);
      input.addEventListener('input', (e) => { answers[q.id] = e.target.value; });
    }
  });
}

els.submitBtn.onclick = () => {
  if (confirm('Submit your assessment? You cannot change answers afterward.')) {
    submit('manual');
  }
};

// ---------- Timer ----------
function startTimer() {
  updateTimer();
  timerInterval = setInterval(updateTimer, 500);
}
function updateTimer() {
  const remaining = Math.max(0, endAt - Date.now());
  const m = Math.floor(remaining / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  els.timer.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  els.timer.classList.toggle('warn', remaining < 5 * 60000 && remaining >= 60000);
  els.timer.classList.toggle('danger', remaining < 60000);
  if (remaining <= 0) submit('time');
}

// ---------- Submission ----------
async function submit(reason) {
  if (submitted) return;
  submitted = true;
  clearInterval(timerInterval);
  if (FEATURES.webcam) {
    stopProctorInterval();
    await captureAndUpload(`submit-${reason}`).catch(() => {});
    stopWebcam();
  }
  uninstallLockdown();
  hideWatermark();
  try { await document.exitFullscreen?.(); } catch {}

  try {
    const { result } = await api(`/api/assessments/${currentAssessment.id}/submit`, {
      method: 'POST',
      body: { answers, violations, startedAt },
    });
    lastResultId = result.id;
    els.assessmentView.style.display = 'none';
    els.doneView.style.display = 'block';
    els.doneMsg.innerHTML = `
      Your assessment has been submitted (reason: ${reason}).<br/>
      Auto-graded score (multiple choice / true-false / short answer with expected value):
      <strong>${result.autoScore} / ${result.autoMax}</strong>.<br/>
      Essay and writing questions will appear with feedback once grading is complete.
      ${violations.length ? `<br/><br/><span style="color:#ff6b6b;">${violations.length} lockdown violation(s) were recorded.</span>` : ''}
    `;
  } catch (e) {
    alert('Submission error: ' + e.message);
  }
}

// ---------- Past results + feedback view ----------
async function loadPastResults() {
  try {
    const { results } = await api('/api/results/mine');
    if (!results.length) {
      els.pastResults.innerHTML = '';
      return;
    }
    els.pastResults.innerHTML = `
      <h2 style="color:#fff;">Your past assessments</h2>
      <div>${results.map((r) => `
        <div class="card" style="background:#1a1e33; color:#fff; border-color:#2b3152;">
          <div class="row">
            <div>
              <div class="card-title">${escapeHtml(r.assessmentTitle)}</div>
              <div class="muted" style="color:#9ba0bd;">
                Submitted ${new Date(r.submittedAt).toLocaleString()} ·
                Auto-graded: ${r.autoScore} / ${r.autoMax}
              </div>
            </div>
            <div class="spacer"></div>
            <button class="btn primary" data-review="${r.id}">View feedback</button>
          </div>
        </div>
      `).join('')}</div>
    `;
    els.pastResults.querySelectorAll('button[data-review]').forEach((b) => {
      b.onclick = () => openReview(b.dataset.review);
    });
  } catch {
    els.pastResults.innerHTML = '';
  }
}

if (els.doneReview) {
  els.doneReview.onclick = () => {
    if (lastResultId) openReview(lastResultId);
  };
}
if (els.reviewBack) {
  els.reviewBack.onclick = () => {
    els.reviewView.style.display = 'none';
    els.listView.style.display = 'block';
    loadPastResults();
  };
}

async function openReview(resultId) {
  try {
    const data = await api(`/api/results/student/${resultId}`);
    els.doneView.style.display = 'none';
    els.listView.style.display = 'none';
    els.reviewView.style.display = 'block';
    els.reviewTitle.textContent = data.assessmentTitle;
    els.reviewSummary.innerHTML = `
      <div style="font-size: 18px; margin-bottom: 6px;">
        <strong>Total:</strong> ${data.totalScore} / ${data.totalMax}
        (Auto-graded: ${data.autoScore}/${data.autoMax}, Teacher-graded: ${data.manualScore}/${data.manualMax})
      </div>
      <div class="muted">Submitted ${new Date(data.submittedAt).toLocaleString()}</div>
      ${data.awaitingReview ? `
        <div class="env-warn" style="margin-top: 10px;">
          Your essay / long-answer questions are still awaiting teacher review.
          Their scores will appear here once graded.
        </div>` : ''}
    `;
    els.reviewBody.innerHTML = data.review.map((q, i) => renderReviewQuestion(q, i)).join('');
  } catch (e) {
    alert('Could not load feedback: ' + e.message);
  }
}

function renderReviewQuestion(q, i) {
  const statusBadge =
    q.correct === true ? '<span class="badge green">Correct</span>' :
    q.correct === false ? '<span class="badge red">Incorrect</span>' :
    q.manualGrade ? `<span class="badge green">Graded: ${q.manualGrade.score}/${q.manualGrade.maxScore}</span>` :
    '<span class="badge">Awaiting teacher review</span>';

  let givenDisplay = '<em>(no answer)</em>';
  if (q.given !== null && q.given !== undefined) {
    if (q.type === 'mc') givenDisplay = escapeHtml(String(q.options[q.given] ?? q.given));
    else if (q.type === 'tf') givenDisplay = q.given ? 'True' : 'False';
    else givenDisplay = escapeHtml(String(q.given));
  }

  let correctDisplay = '';
  if (q.correct === false && q.correctAnswer !== null) {
    let text = '';
    if (q.type === 'mc') text = String(q.options[q.correctAnswer] ?? q.correctAnswer);
    else if (q.type === 'tf') text = q.correctAnswer ? 'True' : 'False';
    else text = String(q.correctAnswer);
    correctDisplay = `<div class="success" style="margin-top: 6px;">
      <strong>Correct answer:</strong> ${escapeHtml(text)}
    </div>`;
  }

  const feedback = q.manualGrade && q.manualGrade.feedback
    ? `<div style="margin-top: 6px; padding: 8px; background: #f1f5ff; border-radius: 6px; white-space: pre-wrap;">
         <strong>Feedback:</strong>
${escapeHtml(q.manualGrade.feedback)}
       </div>`
    : '';

  const explanation = q.explanation
    ? `<div class="muted" style="margin-top: 6px;"><em>${escapeHtml(q.explanation)}</em></div>`
    : '';

  return `
    <div class="panel">
      <div class="muted" style="margin-bottom: 4px;">Question ${i + 1} · ${q.points} point${q.points === 1 ? '' : 's'} ${statusBadge}</div>
      <div style="font-size: 16px; margin-bottom: 10px;">${escapeHtml(q.prompt)}</div>
      <div><strong>Your answer:</strong> ${givenDisplay}</div>
      ${correctDisplay}
      ${feedback}
      ${explanation}
    </div>
  `;
}

els.doneBack.onclick = () => location.reload();

// ========== LOCKDOWN LAYER ==========

function addViolation(reason) {
  if (!lockdownActive || submitted) return;
  violations.push(`${new Date().toLocaleTimeString()} - ${reason}`);
  els.violationBanner.style.display = 'block';
  els.violationBanner.textContent =
    `Lockdown violation detected: ${reason}. Violation ${violations.length} of ${MAX_VIOLATIONS}.` +
    (violations.length >= MAX_VIOLATIONS ? ' Auto-submitting now.' : '');
  if (violations.length >= MAX_VIOLATIONS) {
    submit('violations-exceeded');
  }
}

async function enterFullscreen() {
  const el = document.documentElement;
  if (el.requestFullscreen) await el.requestFullscreen();
  else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
  else throw new Error('Fullscreen API not supported');
}
function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

const handlers = {
  visibilitychange: () => {
    if (document.hidden) addViolation('Switched tab or minimized window');
  },
  blur: () => addViolation('Window lost focus'),
  focus: () => {},
  fullscreenchange: () => {
    if (!isFullscreen()) {
      addViolation('Exited fullscreen');
      enterFullscreen().catch(() => {});
    }
  },
  keydown: (e) => {
    const key = (e.key || '').toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey;
    const block =
      (e.key === 'F12') ||
      (ctrl && e.shiftKey && ['i', 'j', 'c'].includes(key)) ||
      (ctrl && key === 'u') ||
      (ctrl && ['s', 'p', 'f', 'g'].includes(key)) ||
      (ctrl && ['c', 'v', 'x'].includes(key)) ||
      (ctrl && ['t', 'n', 'w'].includes(key)) ||
      (ctrl && ['r'].includes(key)) || e.key === 'F5' ||
      e.key === 'PrintScreen' ||
      (ctrl && e.shiftKey && ['3', '4', '5'].includes(key)) ||
      (e.altKey && e.key === 'Tab');
    if (block) {
      e.preventDefault();
      e.stopPropagation();
      addViolation(`Blocked shortcut: ${describeShortcut(e)}`);
      return false;
    }
  },
  copy: (e) => { e.preventDefault(); addViolation('Copy attempted'); },
  cut:  (e) => { e.preventDefault(); addViolation('Cut attempted'); },
  paste: (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement)) {
      e.preventDefault();
      addViolation('Paste outside answer field');
    }
  },
  contextmenu: (e) => { e.preventDefault(); },
  dragstart: (e) => { e.preventDefault(); },
  selectstart: (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement)) {
      e.preventDefault();
    }
  },
  beforeunload: (e) => {
    if (!submitted && lockdownActive) {
      e.preventDefault();
      e.returnValue = 'Leaving will forfeit your assessment.';
      return e.returnValue;
    }
  },
};

function describeShortcut(e) {
  const parts = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.metaKey) parts.push('Cmd');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  parts.push(e.key);
  return parts.join('+');
}

function installLockdown() {
  lockdownActive = true;
  document.addEventListener('visibilitychange', handlers.visibilitychange);
  window.addEventListener('blur', handlers.blur);
  window.addEventListener('focus', handlers.focus);
  document.addEventListener('fullscreenchange', handlers.fullscreenchange);
  document.addEventListener('webkitfullscreenchange', handlers.fullscreenchange);
  window.addEventListener('keydown', handlers.keydown, true);
  document.addEventListener('copy', handlers.copy);
  document.addEventListener('cut', handlers.cut);
  document.addEventListener('paste', handlers.paste);
  document.addEventListener('contextmenu', handlers.contextmenu);
  document.addEventListener('dragstart', handlers.dragstart);
  document.addEventListener('selectstart', handlers.selectstart);
  window.addEventListener('beforeunload', handlers.beforeunload);

  window.addEventListener('blur', () => document.body.classList.add('lockdown-blur'));
  window.addEventListener('focus', () => document.body.classList.remove('lockdown-blur'));

  if (window.lockdown && typeof window.lockdown.enterKiosk === 'function') {
    try { window.lockdown.enterKiosk(); } catch {}
  }
}

// ========== WEBCAM PROCTORING ==========
let webcamStream = null;
let proctorIntervalId = null;
const PROCTOR_INTERVAL_MS = 15000;
let cameraOffViolationFired = false;

async function startWebcam() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Your browser does not support getUserMedia.');
  }
  webcamStream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
    audio: false,
  });
  els.webcam.srcObject = webcamStream;
  await els.webcam.play().catch(() => {});
  webcamStream.getVideoTracks().forEach((t) => {
    t.onended = () => {
      if (!submitted) {
        addViolation('Webcam stream ended');
        els.webcamStatus.textContent = 'OFF';
        els.webcamStatus.classList.add('off');
      }
    };
  });
}

function stopWebcam() {
  try {
    if (webcamStream) {
      webcamStream.getTracks().forEach((t) => t.stop());
    }
  } catch {}
  webcamStream = null;
  els.webcam.srcObject = null;
  els.webcamStatus.textContent = 'OFF';
  els.webcamStatus.classList.add('off');
}

function startProctorInterval() {
  if (proctorIntervalId) clearInterval(proctorIntervalId);
  proctorIntervalId = setInterval(() => captureAndUpload('periodic').catch(() => {}), PROCTOR_INTERVAL_MS);
}
function stopProctorInterval() {
  if (proctorIntervalId) clearInterval(proctorIntervalId);
  proctorIntervalId = null;
}

async function captureAndUpload(note) {
  if (!webcamStream || submitted || !currentAssessment) return;
  const video = els.webcam;
  const canvas = els.webcamCanvas;
  const vw = video.videoWidth || 320;
  const vh = video.videoHeight || 240;
  const targetW = 320;
  const targetH = Math.round((vh / vw) * targetW);
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, targetW, targetH);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.55);

  const sample = ctx.getImageData(0, 0, targetW, targetH).data;
  let lumaSum = 0;
  const stride = 32;
  for (let i = 0; i < sample.length; i += 4 * stride) {
    lumaSum += 0.299 * sample[i] + 0.587 * sample[i + 1] + 0.114 * sample[i + 2];
  }
  const avgLuma = lumaSum / (sample.length / (4 * stride));
  if (avgLuma < 10 && !cameraOffViolationFired) {
    cameraOffViolationFired = true;
    addViolation('Webcam appears covered or obstructed');
    els.webcamStatus.textContent = 'DARK';
    els.webcamStatus.classList.add('warn');
    setTimeout(() => { cameraOffViolationFired = false; els.webcamStatus.classList.remove('warn'); els.webcamStatus.textContent = 'REC'; }, 30000);
  }

  try {
    await api('/api/proctor/snapshot', {
      method: 'POST',
      body: { assessmentId: currentAssessment.id, dataUrl, note },
    });
  } catch {}
}

function uninstallLockdown() {
  lockdownActive = false;
  document.removeEventListener('visibilitychange', handlers.visibilitychange);
  window.removeEventListener('blur', handlers.blur);
  window.removeEventListener('focus', handlers.focus);
  document.removeEventListener('fullscreenchange', handlers.fullscreenchange);
  document.removeEventListener('webkitfullscreenchange', handlers.fullscreenchange);
  window.removeEventListener('keydown', handlers.keydown, true);
  document.removeEventListener('copy', handlers.copy);
  document.removeEventListener('cut', handlers.cut);
  document.removeEventListener('paste', handlers.paste);
  document.removeEventListener('contextmenu', handlers.contextmenu);
  document.removeEventListener('dragstart', handlers.dragstart);
  document.removeEventListener('selectstart', handlers.selectstart);
  window.removeEventListener('beforeunload', handlers.beforeunload);
  document.body.classList.remove('lockdown-blur');
  if (window.lockdown && typeof window.lockdown.exitKiosk === 'function') {
    try { window.lockdown.exitKiosk(); } catch {}
  }
}
