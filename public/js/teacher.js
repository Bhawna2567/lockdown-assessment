// Teacher dashboard: list/create/edit assessments and view results.
const els = {
  listView: document.getElementById('list-view'),
  builderView: document.getElementById('builder-view'),
  resultsView: document.getElementById('results-view'),
  assessments: document.getElementById('assessments'),
  newBtn: document.getElementById('new-btn'),
  backBtn: document.getElementById('back-btn'),
  saveBtn: document.getElementById('save-btn'),
  saveStatus: document.getElementById('save-status'),
  who: document.getElementById('who'),
  logout: document.getElementById('logout'),
  title: document.getElementById('title'),
  description: document.getElementById('description'),
  passage: document.getElementById('passage'),
  rubricStage: document.getElementById('rubric-stage'),
  term: document.getElementById('term'),
  academicYear: document.getElementById('academic-year'),
  scheduledDate: document.getElementById('scheduled-date'),
  duration: document.getElementById('duration'),
  published: document.getElementById('published'),
  filterTerm: document.getElementById('filter-term'),
  filterYear: document.getElementById('filter-year'),
  viewListBtn: document.getElementById('view-list-btn'),
  viewCalendarBtn: document.getElementById('view-calendar-btn'),
  calendarView: document.getElementById('calendar-view'),
  questions: document.getElementById('questions'),
  builderTitle: document.getElementById('builder-title'),
  resultsBack: document.getElementById('results-back'),
  resultsTitle: document.getElementById('results-title'),
  resultsBody: document.getElementById('results-body'),
  importBtn: document.getElementById('import-btn'),
  importPanel: document.getElementById('import-panel'),
  importDrop: document.getElementById('import-drop'),
  importFile: document.getElementById('import-file'),
  importStatus: document.getElementById('import-status'),
  importClose: document.getElementById('import-close'),

  essayQueueBtn: document.getElementById('essay-queue-btn'),
  essayQueueView: document.getElementById('essay-queue-view'),
  queueBody: document.getElementById('queue-body'),
  queueBack: document.getElementById('queue-back'),
  queueCount: document.getElementById('queue-count'),

  downloadXlsx: document.getElementById('download-xlsx'),

  settingsBtn: document.getElementById('settings-btn'),
  settingsPanel: document.getElementById('settings-panel'),
  settingsClose: document.getElementById('settings-close'),
  settingsSave: document.getElementById('settings-save'),
  settingsClear: document.getElementById('settings-clear'),
  settingsStatus: document.getElementById('settings-status'),
  apiKeyInput: document.getElementById('api-key-input'),
  apiKeyState: document.getElementById('api-key-state'),
};

let currentResultsAssessmentId = null;

let editingId = null;
let questions = [];

// All assessments (unfiltered) cached after each load. The filter dropdowns
// narrow this list down for display in either the list or calendar view.
let allAssessments = [];
let activeView = 'list'; // 'list' or 'calendar'
let calendarMonth = new Date(); // first of currently-visible month

function uid() { return Math.random().toString(36).slice(2, 10); }

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

async function loadMe() {
  const { user } = await api('/api/me');
  if (!user || user.role !== 'teacher') {
    location.href = '/';
    return;
  }
  els.who.textContent = `${user.name} (${user.email})`;
}

els.logout.onclick = async () => {
  // Defensive: clear any leftover kiosk/fullscreen state before navigating
  // to the sign-in page. This is what was leaving the teacher's window
  // stuck in a locked state on logout.
  try { window.lockdown && window.lockdown.forceUnlock && window.lockdown.forceUnlock(); } catch {}
  try { await document.exitFullscreen?.(); } catch {}
  await api('/api/logout', { method: 'POST' });
  location.href = '/';
};

// ---------- Quick Import (PDF / DOCX / TXT) ----------
els.importBtn.onclick = () => {
  els.importPanel.style.display = 'block';
  els.importStatus.textContent = '';
  els.importFile.value = '';
};
els.importClose.onclick = () => { els.importPanel.style.display = 'none'; };

els.importFile.onchange = () => {
  if (els.importFile.files && els.importFile.files[0]) runImport(els.importFile.files[0]);
};

['dragenter', 'dragover'].forEach((ev) =>
  els.importDrop.addEventListener(ev, (e) => { e.preventDefault(); els.importDrop.classList.add('drag'); })
);
['dragleave', 'drop'].forEach((ev) =>
  els.importDrop.addEventListener(ev, (e) => { e.preventDefault(); els.importDrop.classList.remove('drag'); })
);
els.importDrop.addEventListener('drop', (e) => {
  if (e.dataTransfer.files && e.dataTransfer.files[0]) runImport(e.dataTransfer.files[0]);
});

async function runImport(file) {
  els.importStatus.innerHTML = `<em>Parsing ${escapeHtml(file.name)}…</em>`;
  const fd = new FormData();
  fd.append('file', file);
  try {
    const res = await fetch('/api/import', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) {
      els.importStatus.innerHTML =
        `<span style="color:#d63939;">${escapeHtml(data.error || 'Import failed')}</span>` +
        (data.rawTextPreview ? `<pre style="margin-top:8px; font-size:11px; text-align:left; white-space:pre-wrap;">${escapeHtml(data.rawTextPreview)}</pre>` : '');
      return;
    }
    // Pre-populate the builder with the parsed draft.
    els.importPanel.style.display = 'none';
    openBuilder(null);
    els.title.value = data.title || `Imported — ${file.name}`;
    els.description.value = `Imported from ${file.name} on ${new Date().toLocaleDateString()}. Review each question and mark correct answers before publishing.`;
    if (els.passage) els.passage.value = data.passage || '';
    questions = data.questions.map((q) => ({ ...q, id: uid() }));
    renderQuestions();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    els.importStatus.innerHTML = `<span style="color:#d63939;">${escapeHtml(e.message)}</span>`;
  }
}

// ---------- List view ----------
async function loadAssessments() {
  allAssessments = await api('/api/assessments');
  refreshYearFilterOptions();
  render();
}

// Build the academic-year dropdown from the years that actually appear in
// the loaded assessments. Adds a stable "All years" option at the top.
function refreshYearFilterOptions() {
  if (!els.filterYear) return;
  const years = Array.from(new Set(
    allAssessments.map((a) => a.academicYear).filter(Boolean)
  )).sort();
  const current = els.filterYear.value;
  els.filterYear.innerHTML =
    `<option value="">All years</option>` +
    years.map((y) => `<option value="${escapeAttr(y)}">${escapeHtml(y)}</option>`).join('');
  // Restore the previously-selected year if it still exists.
  if (years.includes(current)) els.filterYear.value = current;
}

function filteredAssessments() {
  const term = els.filterTerm ? els.filterTerm.value : '';
  const year = els.filterYear ? els.filterYear.value : '';
  return allAssessments.filter((a) => {
    if (term && a.term !== term) return false;
    if (year && a.academicYear !== year) return false;
    return true;
  });
}

function render() {
  if (activeView === 'calendar') {
    els.assessments.style.display = 'none';
    els.calendarView.style.display = 'block';
    renderCalendar();
  } else {
    els.assessments.style.display = 'block';
    els.calendarView.style.display = 'none';
    renderList();
  }
}

function renderList() {
  const list = filteredAssessments();
  if (!list.length) {
    if (!allAssessments.length) {
      els.assessments.innerHTML = `<div class="panel muted">No assessments yet. Click "+ New assessment" to create one.</div>`;
    } else {
      els.assessments.innerHTML = `<div class="panel muted">No assessments match the current filter. Choose "All terms" / "All years" to see everything.</div>`;
    }
    return;
  }
  els.assessments.innerHTML = list
    .map((a) => {
      const meta = [
        `${a.questions.length} questions`,
        `${a.durationMinutes} min`,
        a.term ? `Term ${a.term}` : null,
        a.academicYear ? a.academicYear : null,
        a.scheduledDate ? `📅 ${a.scheduledDate}` : null,
      ].filter(Boolean).join(' · ');
      return `
      <div class="card">
        <div class="row">
          <div>
            <div class="card-title">${escapeHtml(a.title)}
              <span class="badge ${a.published ? 'green' : ''}">${a.published ? 'Published' : 'Draft'}</span>
            </div>
            <div class="muted">${meta}</div>
          </div>
          <div class="spacer"></div>
          ${a.published ? `<button class="btn primary" data-act="share" data-id="${a.id}">🔗 Share</button>` : ''}
          <button class="btn" data-act="results" data-id="${a.id}">Results</button>
          <button class="btn" data-act="edit" data-id="${a.id}">Edit</button>
          <button class="btn" data-act="duplicate" data-id="${a.id}" title="Make a copy for a new batch of students">⎘ Duplicate</button>
          <button class="btn danger" data-act="delete" data-id="${a.id}">Delete</button>
        </div>
        <div id="share-${a.id}" class="share-panel" style="display:none;"></div>
      </div>`;
    })
    .join('');
  els.assessments.querySelectorAll('button[data-act]').forEach((btn) => {
    btn.onclick = () => handleAction(btn.dataset.act, btn.dataset.id);
  });
}

// ---------- Calendar view ----------
function renderCalendar() {
  const list = filteredAssessments().filter((a) => a.scheduledDate);
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = firstDay.getDay();

  const monthName = firstDay.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  let cells = '';
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach((n) => {
    cells += `<div class="calendar-day-name">${n}</div>`;
  });
  // Leading blanks
  for (let i = 0; i < startWeekday; i++) {
    cells += `<div class="calendar-day outside"></div>`;
  }
  // Real days
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const events = list.filter((a) => a.scheduledDate === dateStr);
    const isToday = dateStr === todayKey;
    cells += `
      <div class="calendar-day ${isToday ? 'today' : ''}">
        <div class="calendar-day-num">${day}</div>
        ${events.map((e) => `<div class="calendar-event" data-act="edit" data-id="${e.id}" title="${escapeAttr(e.title)}">${escapeHtml(e.title)}</div>`).join('')}
      </div>
    `;
  }
  // Trailing blanks
  const totalCells = startWeekday + lastDay.getDate();
  const trailing = (7 - (totalCells % 7)) % 7;
  for (let i = 0; i < trailing; i++) {
    cells += `<div class="calendar-day outside"></div>`;
  }

  els.calendarView.innerHTML = `
    <div class="calendar-wrapper">
      <div class="calendar-header">
        <button id="cal-prev" class="btn">‹ Prev</button>
        <strong>${escapeHtml(monthName)}</strong>
        <button id="cal-next" class="btn">Next ›</button>
        <div class="spacer"></div>
        <button id="cal-today" class="btn">Today</button>
      </div>
      <div class="calendar-grid">${cells}</div>
    </div>
  `;
  document.getElementById('cal-prev').onclick = () => {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
    renderCalendar();
  };
  document.getElementById('cal-next').onclick = () => {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
    renderCalendar();
  };
  document.getElementById('cal-today').onclick = () => {
    calendarMonth = new Date();
    renderCalendar();
  };
  els.calendarView.querySelectorAll('.calendar-event').forEach((el) => {
    el.onclick = () => handleAction(el.dataset.act, el.dataset.id);
  });
}

async function handleAction(act, id) {
  if (act === 'delete') {
    if (!confirm('Delete this assessment? Student results will remain but become orphaned.')) return;
    await api(`/api/assessments/${id}`, { method: 'DELETE' });
    loadAssessments();
    return;
  }
  if (act === 'edit') {
    const list = await api('/api/assessments');
    const a = list.find((x) => x.id === id);
    if (!a) return;
    openBuilder(a);
    return;
  }
  if (act === 'results') {
    openResults(id);
    return;
  }
  if (act === 'share') {
    toggleShare(id);
    return;
  }
  if (act === 'duplicate') {
    if (!confirm('Make a duplicate of this assessment? The copy starts as a draft so you can update the term/year/date for the new batch before publishing.')) return;
    try {
      const { assessment } = await api(`/api/assessments/${id}/duplicate`, { method: 'POST' });
      await loadAssessments();
      // Open the new copy in the builder so the teacher can update term/year/date.
      openBuilder(assessment);
    } catch (e) {
      alert('Could not duplicate: ' + e.message);
    }
    return;
  }
}

function toggleShare(id) {
  const panel = document.getElementById(`share-${id}`);
  if (!panel) return;
  if (panel.style.display === 'block') { panel.style.display = 'none'; return; }
  const url = `${location.origin}/take/${id}`;
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(url);
  panel.innerHTML = `
    <div style="margin-top:10px; padding:12px; background:#f1f5ff; border:1px solid #cdd5ee; border-radius:8px;">
      <div style="margin-bottom:6px;"><strong>Share this assessment with students:</strong></div>
      <div class="row" style="gap:6px;">
        <input type="text" id="share-url-${id}" readonly value="${escapeAttr(url)}" style="flex:1; font-family: monospace;" />
        <button class="btn primary" data-copy="${id}">Copy link</button>
      </div>
      ${isLocal ? `
        <div class="muted" style="margin-top:8px; color:#8a4b00;">
          ⚠️ This link only works on <em>your</em> computer right now.
          To send it to students, you need to deploy the app to the internet first —
          see <strong>CLOUD-DEPLOY.md</strong> in your project folder.
        </div>` : `
        <div class="muted" style="margin-top:8px;">
          Students who open this link will be asked to sign in (or register), then go straight into the assessment.
        </div>`}
    </div>`;
  panel.style.display = 'block';
  panel.querySelector(`button[data-copy="${id}"]`).onclick = async () => {
    const input = document.getElementById(`share-url-${id}`);
    input.select();
    try {
      await navigator.clipboard.writeText(input.value);
      const btn = panel.querySelector(`button[data-copy="${id}"]`);
      btn.textContent = '✓ Copied';
      setTimeout(() => { btn.textContent = 'Copy link'; }, 1500);
    } catch {
      document.execCommand('copy');
    }
  };
}

// ---------- Builder view ----------
els.newBtn.onclick = () => openBuilder(null);
els.backBtn.onclick = () => {
  els.builderView.style.display = 'none';
  els.listView.style.display = 'block';
  loadAssessments();
};

function openBuilder(a) {
  els.listView.style.display = 'none';
  els.resultsView.style.display = 'none';
  els.builderView.style.display = 'block';
  editingId = a ? a.id : null;
  els.builderTitle.textContent = a ? 'Edit assessment' : 'New assessment';
  els.title.value = a ? a.title : '';
  els.description.value = a ? a.description : '';
  if (els.passage) els.passage.value = a && a.passage ? a.passage : '';
  if (els.rubricStage) els.rubricStage.value = a && a.rubricStage ? a.rubricStage : '';
  if (els.term) els.term.value = a && a.term ? a.term : '';
  if (els.academicYear) els.academicYear.value = a && a.academicYear ? a.academicYear : defaultAcademicYear();
  if (els.scheduledDate) els.scheduledDate.value = a && a.scheduledDate ? a.scheduledDate : '';
  els.duration.value = a ? a.durationMinutes : 30;
  els.published.value = a ? String(a.published) : 'false';
  questions = a ? JSON.parse(JSON.stringify(a.questions)) : [];
  renderQuestions();
}

document.querySelectorAll('button[data-add]').forEach((b) => {
  b.onclick = () => {
    const type = b.dataset.add;
    const q = { id: uid(), type, prompt: '', points: 1 };
    if (type === 'mc') { q.options = ['', '']; q.correctAnswer = 0; }
    if (type === 'tf') { q.correctAnswer = true; }
    if (type === 'short') { q.correctAnswer = ''; }
    if (type === 'essay') { q.points = 5; }
    if (type === 'writing') { q.points = 12; } // 4 criteria x 3 marks (CEFR rubric)
    questions.push(q);
    renderQuestions();
  };
});

function renderQuestions() {
  if (!questions.length) {
    els.questions.innerHTML = `<div class="muted">Add a question using the buttons above.</div>`;
    return;
  }
  els.questions.innerHTML = questions.map((q, idx) => renderQuestion(q, idx)).join('');
  // Wire up inputs
  questions.forEach((q, idx) => {
    const root = document.getElementById(`q-${q.id}`);
    root.querySelector('[data-f=prompt]').oninput = (e) => { q.prompt = e.target.value; };
    root.querySelector('[data-f=points]').oninput = (e) => { q.points = Number(e.target.value) || 1; };
    root.querySelector('[data-act=remove]').onclick = () => {
      questions.splice(idx, 1);
      renderQuestions();
    };
    root.querySelector('[data-act=up]').onclick = () => {
      if (idx > 0) { [questions[idx-1], questions[idx]] = [questions[idx], questions[idx-1]]; renderQuestions(); }
    };
    root.querySelector('[data-act=down]').onclick = () => {
      if (idx < questions.length - 1) { [questions[idx+1], questions[idx]] = [questions[idx], questions[idx+1]]; renderQuestions(); }
    };

    if (q.type === 'mc') {
      q.options.forEach((_, oi) => {
        root.querySelector(`[data-oi="${oi}"]`).oninput = (e) => { q.options[oi] = e.target.value; };
        root.querySelector(`[data-correct="${oi}"]`).onchange = (e) => {
          if (e.target.checked) q.correctAnswer = oi;
        };
        const rm = root.querySelector(`[data-rmop="${oi}"]`);
        if (rm) rm.onclick = () => {
          q.options.splice(oi, 1);
          if (q.correctAnswer >= q.options.length) q.correctAnswer = 0;
          renderQuestions();
        };
      });
      root.querySelector('[data-act=addopt]').onclick = () => {
        q.options.push('');
        renderQuestions();
      };
    }
    if (q.type === 'tf') {
      root.querySelector('[data-tf]').onchange = (e) => {
        q.correctAnswer = e.target.value === 'true';
      };
    }
    if (q.type === 'short') {
      root.querySelector('[data-f=correct]').oninput = (e) => { q.correctAnswer = e.target.value; };
    }
  });
}

function renderQuestion(q, idx) {
  const typeLabel = { mc: 'Multiple choice', tf: 'True/False', short: 'Short answer', essay: 'Essay', writing: 'Writing (auto-graded)' }[q.type];
  let body = '';
  if (q.type === 'mc') {
    body = `
      <div class="field">
        <label>Options (check the correct one)</label>
        ${q.options.map((opt, oi) => `
          <div class="row" style="margin-bottom: 6px;">
            <input type="radio" name="correct-${q.id}" data-correct="${oi}" ${q.correctAnswer === oi ? 'checked' : ''} />
            <input type="text" data-oi="${oi}" value="${escapeAttr(opt)}" placeholder="Option ${oi + 1}" />
            ${q.options.length > 2 ? `<button class="btn ghost" data-rmop="${oi}">✕</button>` : ''}
          </div>
        `).join('')}
        <button class="btn" data-act="addopt">+ Add option</button>
      </div>
    `;
  } else if (q.type === 'tf') {
    body = `
      <div class="field">
        <label>Correct answer</label>
        <select data-tf>
          <option value="true" ${q.correctAnswer === true ? 'selected' : ''}>True</option>
          <option value="false" ${q.correctAnswer === false ? 'selected' : ''}>False</option>
        </select>
      </div>
    `;
  } else if (q.type === 'short') {
    body = `
      <div class="field">
        <label>Expected answer (optional, auto-graded as case-insensitive exact match)</label>
        <input type="text" data-f="correct" value="${escapeAttr(q.correctAnswer || '')}" />
      </div>
    `;
  } else if (q.type === 'essay') {
    body = `<div class="muted">Essay questions are graded manually by the teacher in the Results view.</div>`;
  } else if (q.type === 'writing') {
    body = `<div class="muted">Writing questions are auto-graded against the Stage 7/8 rubric you select for the assessment (4 criteria × 3 marks = 12 points). You can review and override the AI grade in the essay queue.</div>`;
  }
  return `
    <div class="q-row" id="q-${q.id}">
      <div class="row" style="margin-bottom: 8px;">
        <strong>Q${idx + 1}</strong>
        <span class="badge">${typeLabel}</span>
        <div class="spacer"></div>
        <button class="btn ghost" data-act="up">↑</button>
        <button class="btn ghost" data-act="down">↓</button>
        <button class="btn danger" data-act="remove">Remove</button>
      </div>
      <div class="field">
        <label>Prompt</label>
        <textarea data-f="prompt">${escapeHtml(q.prompt || '')}</textarea>
      </div>
      <div class="field">
        <label>Points</label>
        <input type="number" min="1" data-f="points" value="${q.points || 1}" style="width: 80px;" />
      </div>
      ${body}
    </div>
  `;
}

els.saveBtn.onclick = async () => {
  els.saveStatus.textContent = 'Saving…';
  try {
    const payload = {
      title: els.title.value.trim(),
      description: els.description.value.trim(),
      passage: els.passage ? els.passage.value : '',
      rubricStage: els.rubricStage ? els.rubricStage.value || null : null,
      term: els.term ? els.term.value || null : null,
      academicYear: els.academicYear ? (els.academicYear.value || '').trim() || null : null,
      scheduledDate: els.scheduledDate ? els.scheduledDate.value || null : null,
      durationMinutes: Number(els.duration.value) || 30,
      published: els.published.value === 'true',
      questions,
    };
    if (!payload.title) throw new Error('Title is required');
    if (!payload.questions.length) throw new Error('Add at least one question');
    for (const q of payload.questions) {
      if (!q.prompt || !q.prompt.trim()) throw new Error('All questions need a prompt');
    }
    if (editingId) {
      await api(`/api/assessments/${editingId}`, { method: 'PUT', body: payload });
    } else {
      await api('/api/assessments', { method: 'POST', body: payload });
    }
    els.saveStatus.textContent = 'Saved.';
    setTimeout(() => {
      els.builderView.style.display = 'none';
      els.listView.style.display = 'block';
      els.saveStatus.textContent = '';
      loadAssessments();
    }, 400);
  } catch (e) {
    els.saveStatus.textContent = '';
    alert(e.message);
  }
};

// ---------- Results view ----------
async function openResults(id) {
  els.listView.style.display = 'none';
  els.builderView.style.display = 'none';
  els.resultsView.style.display = 'block';
  currentResultsAssessmentId = id;
  const { assessment, results } = await api(`/api/results/${id}`);
  els.resultsTitle.textContent = `Results — ${assessment.title}`;

  if (!results.length) {
    els.resultsBody.innerHTML = `<div class="muted">No submissions yet.</div>`;
    return;
  }

  const rowsHtml = results
    .map((r) => {
      const vcount = (r.violations || []).length;
      const detailsId = `d-${r.id}`;
      const proctorId = `p-${r.id}`;
      const envBadge = r.environment
        ? (r.environment.isVm || r.environment.confidence >= 0.5
            ? `<span class="badge red">VM</span>`
            : `<span class="badge green">Physical</span>`)
        : `<span class="muted">—</span>`;
      const envBlock = r.environment ? `
        <div class="${r.environment.isVm ? 'error' : 'success'}" style="margin-bottom: 8px;">
          <strong>Environment:</strong>
          ${r.environment.isVm ? 'Virtual machine detected' : 'Physical device'}
          (confidence ${Math.round((r.environment.confidence || 0) * 100)}%).
          ${r.environment.reasons?.length ? `<br/><small>${escapeHtml(r.environment.reasons.join(' · '))}</small>` : ''}
          <br/><small>Platform: ${escapeHtml(r.environment.platform || '')} · Host: ${escapeHtml(r.environment.hostname || '')}</small>
        </div>` : '';
      const details = `
        <tr>
          <td colspan="6">
            <div id="${detailsId}" style="display:none; padding: 12px; background: #fafbff; border-radius: 8px;">
              <div class="muted" style="margin-bottom: 8px;">Started: ${r.startedAt || 'n/a'} · Submitted: ${r.submittedAt}</div>
              ${envBlock}
              ${vcount ? `<div class="error" style="margin-bottom: 8px;">${vcount} lockdown violation(s):<br/>${escapeHtml((r.violations || []).join(' · '))}</div>` : ''}

              <div style="margin: 10px 0;">
                <button class="btn" data-proctor="${r.assessmentId}" data-student="${r.studentId}" data-target="${proctorId}">
                  📷 Load webcam proctor snapshots
                </button>
                <div id="${proctorId}" class="proctor-grid"></div>
              </div>

              ${assessment.questions.map((q, qi) => {
                const ans = (r.answers || []).find((a) => a.questionId === q.id) || {};
                return `
                  <div style="margin-bottom: 12px;">
                    <div><strong>Q${qi + 1} (${q.points} pt):</strong> ${escapeHtml(q.prompt)}</div>
                    <div class="muted">Student answer: <span style="color:#1a1c2b;">${renderAnswer(q, ans.given)}</span>
                      ${ans.correct === true ? '<span class="badge green">Correct</span>' : ans.correct === false ? '<span class="badge red">Incorrect</span>' : '<span class="badge">Manual grade</span>'}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </td>
        </tr>
      `;
      return `
        <tr>
          <td><button class="btn ghost" data-toggle="${detailsId}">▸</button></td>
          <td>${escapeHtml(r.studentName)}<div class="muted">${escapeHtml(r.studentEmail)}</div></td>
          <td>${r.autoScore}/${r.autoMax}</td>
          <td>${vcount ? `<span class="badge red">${vcount}</span>` : '<span class="muted">—</span>'}</td>
          <td>${envBadge}</td>
          <td class="muted">${new Date(r.submittedAt).toLocaleString()}</td>
        </tr>
        ${details}
      `;
    })
    .join('');

  els.resultsBody.innerHTML = `
    <table>
      <thead><tr><th></th><th>Student</th><th>Auto score</th><th>Violations</th><th>Env</th><th>Submitted</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;
  els.resultsBody.querySelectorAll('button[data-toggle]').forEach((btn) => {
    btn.onclick = () => {
      const el = document.getElementById(btn.dataset.toggle);
      el.style.display = el.style.display === 'none' ? 'block' : 'none';
      btn.textContent = el.style.display === 'none' ? '▸' : '▾';
    };
  });
  els.resultsBody.querySelectorAll('button[data-proctor]').forEach((btn) => {
    btn.onclick = () => loadProctor(btn.dataset.proctor, btn.dataset.student, btn.dataset.target, btn);
  });
}

async function loadProctor(assessmentId, studentId, targetId, btn) {
  btn.disabled = true;
  btn.textContent = '📷 Loading…';
  try {
    const { snapshots } = await api(`/api/proctor/${assessmentId}/${studentId}`);
    const target = document.getElementById(targetId);
    if (!snapshots.length) {
      target.innerHTML = '<div class="muted" style="padding:8px;">No webcam snapshots recorded for this submission.</div>';
    } else {
      target.innerHTML = snapshots.map((s) => `
        <a href="${s.url}" target="_blank">
          <img src="${s.url}" title="${escapeHtml(s.filename)}" loading="lazy" />
        </a>
      `).join('');
    }
    btn.textContent = `📷 ${snapshots.length} snapshot${snapshots.length === 1 ? '' : 's'}`;
  } catch (e) {
    btn.textContent = `Error: ${e.message}`;
  } finally {
    btn.disabled = false;
  }
}

els.resultsBack.onclick = () => {
  els.resultsView.style.display = 'none';
  els.listView.style.display = 'block';
  loadAssessments();
};

function renderAnswer(q, given) {
  if (given == null) return '<em>(no answer)</em>';
  if (q.type === 'mc') return escapeHtml(String(q.options[given] ?? given));
  if (q.type === 'tf') return given ? 'True' : 'False';
  return escapeHtml(String(given));
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
function escapeAttr(s) { return escapeHtml(s); }

// ---------- Essay grading queue ----------
els.essayQueueBtn.onclick = () => openEssayQueue();
els.queueBack.onclick = () => {
  els.essayQueueView.style.display = 'none';
  els.listView.style.display = 'block';
  loadAssessments();
  refreshQueueCount();
};

async function refreshQueueCount() {
  try {
    const { queue } = await api('/api/essay-queue');
    if (queue.length) {
      els.queueCount.textContent = queue.length;
      els.queueCount.style.display = 'inline-block';
    } else {
      els.queueCount.style.display = 'none';
    }
  } catch {
    els.queueCount.style.display = 'none';
  }
}

async function openEssayQueue() {
  els.listView.style.display = 'none';
  els.builderView.style.display = 'none';
  els.resultsView.style.display = 'none';
  els.essayQueueView.style.display = 'block';
  els.queueBody.innerHTML = '<div class="muted">Loading…</div>';
  try {
    const { queue } = await api('/api/essay-queue');
    if (!queue.length) {
      els.queueBody.innerHTML = '<div class="panel muted">No essays waiting for review. Nice work.</div>';
      return;
    }
    els.queueBody.innerHTML = queue.map((item) => renderQueueItem(item)).join('');
    queue.forEach((item) => wireQueueItem(item));
  } catch (e) {
    els.queueBody.innerHTML = `<div class="error">${escapeHtml(e.message)}</div>`;
  }
}

function renderQueueItem(item) {
  const typeLabel =
    item.questionType === 'essay' ? 'Essay' :
    item.questionType === 'writing' ? 'Writing (rubric)' :
    'Short answer';
  const answer = item.studentAnswer == null || item.studentAnswer === ''
    ? '<em>(no answer)</em>'
    : escapeHtml(String(item.studentAnswer));
  const rowId = `queue-${item.resultId}-${item.questionId}`;

  const ai = item.aiGrade;
  const aiBadge = ai
    ? `<span class="badge green">AI: ${ai.score}/${ai.maxScore} (Stage ${ai.rubricStage || '?'})</span>`
    : '';
  const aiBreakdown = ai && ai.breakdown
    ? `<div style="padding: 10px; background: #eef5ff; border-radius: 6px; margin-bottom: 10px;">
         <div style="margin-bottom: 6px;"><strong>AI rubric breakdown</strong> (review and override below if needed):</div>
         ${Object.values(ai.breakdown).map((b) => `
           <div style="margin-bottom: 4px;">
             <strong>${escapeHtml(b.name)}:</strong> ${b.score}/${b.max}
             <span class="muted"> — ${escapeHtml(b.comment)}</span>
           </div>`).join('')}
       </div>`
    : '';

  const initialScore = ai ? String(ai.score) : '';
  const initialFeedback = ai ? String(ai.feedback || '') : '';

  return `
    <div class="panel" id="${rowId}">
      <div class="row" style="margin-bottom: 6px;">
        <strong>${escapeHtml(item.assessmentTitle)}</strong>
        <span class="badge">${typeLabel}</span>
        <span class="badge">${item.questionPoints} pt</span>
        ${aiBadge}
        <div class="spacer"></div>
        <div class="muted">${escapeHtml(item.studentName)} · ${escapeHtml(item.studentEmail)}</div>
      </div>
      <div class="muted" style="margin-bottom: 8px;">Submitted ${new Date(item.submittedAt).toLocaleString()}</div>
      <div style="margin-bottom: 8px;"><strong>Question:</strong> ${escapeHtml(item.questionPrompt)}</div>
      <div style="padding: 10px; background: #f8f9ff; border-radius: 6px; margin-bottom: 10px; white-space: pre-wrap;">
        <strong>Student answer:</strong><br/>${answer}
      </div>
      ${aiBreakdown}
      <div class="row">
        <div class="field" style="flex: 0 0 140px;">
          <label>Score</label>
          <input type="number" data-f="score" min="0" max="${item.questionPoints}" step="0.5" value="${escapeAttr(initialScore)}" placeholder="0 to ${item.questionPoints}" />
        </div>
        <div class="field" style="flex: 1;">
          <label>Feedback (shown to student)</label>
          <textarea data-f="feedback" rows="3" placeholder="What they did well, what to improve...">${escapeHtml(initialFeedback)}</textarea>
        </div>
      </div>
      <div class="row">
        <div class="spacer"></div>
        <button class="btn primary" data-act="save">${ai ? 'Approve / save grade' : 'Save grade'}</button>
        <span class="muted" data-f="status"></span>
      </div>
    </div>
  `;
}

function wireQueueItem(item) {
  const rowId = `queue-${item.resultId}-${item.questionId}`;
  const root = document.getElementById(rowId);
  if (!root) return;
  root.querySelector('[data-act="save"]').onclick = async () => {
    const score = Number(root.querySelector('[data-f=score]').value);
    const feedback = root.querySelector('[data-f=feedback]').value;
    const status = root.querySelector('[data-f=status]');
    if (Number.isNaN(score)) { status.textContent = 'Score required'; return; }
    if (score < 0 || score > item.questionPoints) {
      status.textContent = `Must be 0–${item.questionPoints}`;
      return;
    }
    status.textContent = 'Saving…';
    try {
      await api(`/api/results/${item.resultId}/grade-question`, {
        method: 'POST',
        body: {
          questionId: item.questionId,
          score,
          maxScore: item.questionPoints,
          feedback,
        },
      });
      root.style.opacity = '0.4';
      status.textContent = 'Saved.';
      setTimeout(() => openEssayQueue(), 400);
    } catch (e) {
      status.textContent = 'Error: ' + e.message;
    }
  };
}

// ---------- Excel scoresheet download ----------
if (els.downloadXlsx) {
  els.downloadXlsx.onclick = () => {
    if (!currentResultsAssessmentId) return;
    window.location.href = `/api/assessments/${currentResultsAssessmentId}/scoresheet`;
  };
}

// ---------- Settings (API key for auto-grading) ----------
if (els.settingsBtn) {
  els.settingsBtn.onclick = async () => {
    els.settingsPanel.style.display = 'block';
    els.apiKeyInput.value = '';
    els.settingsStatus.textContent = '';
    await refreshApiKeyState();
  };
}
if (els.settingsClose) {
  els.settingsClose.onclick = () => { els.settingsPanel.style.display = 'none'; };
}
if (els.settingsSave) {
  els.settingsSave.onclick = async () => {
    const key = els.apiKeyInput.value.trim();
    if (!key) { els.settingsStatus.textContent = 'Paste a key first.'; return; }
    els.settingsStatus.textContent = 'Saving…';
    try {
      await api('/api/settings/grading', { method: 'POST', body: { anthropicApiKey: key } });
      els.settingsStatus.textContent = 'Saved.';
      els.apiKeyInput.value = '';
      await refreshApiKeyState();
    } catch (e) {
      els.settingsStatus.textContent = 'Error: ' + e.message;
    }
  };
}
if (els.settingsClear) {
  els.settingsClear.onclick = async () => {
    if (!confirm('Remove the API key? Auto-grading will stop working until you add a new one.')) return;
    els.settingsStatus.textContent = 'Removing…';
    try {
      await api('/api/settings/grading', { method: 'POST', body: { anthropicApiKey: '' } });
      els.settingsStatus.textContent = 'Removed.';
      await refreshApiKeyState();
    } catch (e) {
      els.settingsStatus.textContent = 'Error: ' + e.message;
    }
  };
}
async function refreshApiKeyState() {
  if (!els.apiKeyState) return;
  try {
    const data = await api('/api/settings/grading');
    els.apiKeyState.innerHTML = data.aiGradingEnabled
      ? '<span class="badge green">Auto-grading ON</span>'
      : '<span class="badge">Auto-grading OFF (no key)</span>';
  } catch {
    els.apiKeyState.textContent = '';
  }
}

// Compute a sensible default academic year string for new assessments.
// School year is treated as Aug → Jul, so if it's January through July
// you get e.g. "2025-2026" using last year + this year; Aug onward uses
// this year + next year.
function defaultAcademicYear() {
  const now = new Date();
  const m = now.getMonth(); // 0 = Jan
  const y = now.getFullYear();
  if (m >= 7) return `${y}-${y + 1}`; // Aug onward
  return `${y - 1}-${y}`; // Jan-Jul
}

// ---------- Filter + view toggle wiring ----------
if (els.filterTerm) els.filterTerm.onchange = () => render();
if (els.filterYear) els.filterYear.onchange = () => render();
if (els.viewListBtn) {
  els.viewListBtn.onclick = () => {
    activeView = 'list';
    els.viewListBtn.classList.add('primary');
    els.viewCalendarBtn.classList.remove('primary');
    render();
  };
}
if (els.viewCalendarBtn) {
  els.viewCalendarBtn.onclick = () => {
    activeView = 'calendar';
    els.viewCalendarBtn.classList.add('primary');
    els.viewListBtn.classList.remove('primary');
    render();
  };
}

// ---------- Init ----------
(async () => {
  await loadMe();
  await loadAssessments();
  await refreshQueueCount();
  await refreshApiKeyState();
})();
