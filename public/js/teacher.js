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
  grade: document.getElementById('grade'),
  academicYear: document.getElementById('academic-year'),
  scheduledDate: document.getElementById('scheduled-date'),
  duration: document.getElementById('duration'),
  published: document.getElementById('published'),
  filterTerm: document.getElementById('filter-term'),
  filterGrade: document.getElementById('filter-grade'),
  filterYear: document.getElementById('filter-year'),
  viewListBtn: document.getElementById('view-list-btn'),
  viewCalendarBtn: document.getElementById('view-calendar-btn'),
  calendarView: document.getElementById('calendar-view'),
  reportCardView: document.getElementById('report-card-view'),
  reportCardSummary: document.getElementById('report-card-summary'),
  reportCardBody: document.getElementById('report-card-body'),
  reportCardBack: document.getElementById('report-card-back'),
  reportCardPrint: document.getElementById('report-card-print'),
  studentsBtn: document.getElementById('students-btn'),
  studentsView: document.getElementById('students-view'),
  studentsList: document.getElementById('students-list'),
  studentsBack: document.getElementById('students-back'),
  progressView: document.getElementById('student-progress-view'),
  progressTitle: document.getElementById('progress-title'),
  progressBack: document.getElementById('progress-back'),
  progressExcel: document.getElementById('progress-excel'),
  progressWord: document.getElementById('progress-word'),
  progressTerm: document.getElementById('progress-term'),
  progressYear: document.getElementById('progress-year'),
  progressLang: document.getElementById('progress-lang'),
  progressBody: document.getElementById('progress-body'),
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

  topbarLang: document.getElementById('topbar-lang'),

  subject: document.getElementById('subject'),
  assessmentLanguage: document.getElementById('assessment-language'),

  templatePicker: document.getElementById('template-picker'),
  templateBack: document.getElementById('template-back'),
  templateBlank: document.getElementById('template-blank'),
  templateGrid: document.getElementById('template-grid'),

  classSwitcher: document.getElementById('class-switcher'),
  classCount: document.getElementById('class-count'),
  manageClassesBtn: document.getElementById('manage-classes-btn'),
  classesPanel: document.getElementById('classes-panel'),
  classesClose: document.getElementById('classes-close'),
  classesList: document.getElementById('classes-list'),
  classesStatus: document.getElementById('classes-status'),
  newClassName: document.getElementById('new-class-name'),
  addClassBtn: document.getElementById('add-class-btn'),
  builderClass: document.getElementById('builder-class'),
};

// ----- Class state (loaded from server) -----
let classes = [];
const ACTIVE_CLASS_KEY = 'classcurio.activeClassId';
function getActiveClassId() {
  return localStorage.getItem(ACTIVE_CLASS_KEY) || (classes[0] && classes[0].id) || null;
}
function setActiveClassId(id) {
  if (id) localStorage.setItem(ACTIVE_CLASS_KEY, id);
  else localStorage.removeItem(ACTIVE_CLASS_KEY);
}
async function loadClasses() {
  try {
    classes = await api('/api/classes');
  } catch (e) {
    console.error('loadClasses failed', e);
    classes = [];
  }
  renderClassSwitcher();
  renderBuilderClassDropdown();
}
function renderClassSwitcher() {
  if (!els.classSwitcher) return;
  const active = getActiveClassId();
  els.classSwitcher.innerHTML = classes
    .map((c) => `<option value="${c.id}" ${c.id === active ? 'selected' : ''}>${escapeHtml(c.name)}</option>`)
    .join('');
  // Default to first class if no active
  if (!classes.find((c) => c.id === active) && classes[0]) {
    setActiveClassId(classes[0].id);
    els.classSwitcher.value = classes[0].id;
  }
}
function renderBuilderClassDropdown() {
  if (!els.builderClass) return;
  els.builderClass.innerHTML = classes
    .map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
    .join('');
}

if (els.classSwitcher) {
  els.classSwitcher.onchange = () => {
    setActiveClassId(els.classSwitcher.value);
    loadAssessments();
  };
}

// ----- Manage classes panel -----
function openClassesPanel() {
  if (!els.classesPanel) return;
  els.classesPanel.style.display = 'block';
  renderClassesList();
}
function closeClassesPanel() {
  if (els.classesPanel) els.classesPanel.style.display = 'none';
}
function renderClassesList() {
  if (!els.classesList) return;
  if (!classes.length) {
    els.classesList.innerHTML = `<div class="muted">No classes yet. Add one above.</div>`;
    return;
  }
  els.classesList.innerHTML = classes.map((c) => `
    <div class="row" data-class-row="${c.id}" style="padding: 8px 10px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 6px;">
      <input type="text" data-class-name="${c.id}" value="${escapeAttr(c.name)}" style="flex: 1;" />
      <button class="btn" data-class-rename="${c.id}">Rename</button>
      <button class="btn danger" data-class-delete="${c.id}">Delete</button>
    </div>
  `).join('');
  els.classesList.querySelectorAll('[data-class-rename]').forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.classRename;
      const input = els.classesList.querySelector(`[data-class-name="${id}"]`);
      const name = (input.value || '').trim();
      if (!name) return;
      try {
        els.classesStatus.textContent = 'Saving…';
        await api(`/api/classes/${id}`, { method: 'PUT', body: { name } });
        await loadClasses();
        renderClassesList();
        els.classesStatus.textContent = 'Saved.';
        setTimeout(() => { els.classesStatus.textContent = ''; }, 1500);
      } catch (e) {
        els.classesStatus.textContent = 'Error: ' + e.message;
      }
    };
  });
  els.classesList.querySelectorAll('[data-class-delete]').forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.classDelete;
      const cls = classes.find((c) => c.id === id);
      if (!cls) return;
      if (!confirm(`Delete the class "${cls.name}"?\n\nThis only works if the class has no assessments. If it does, move or delete those first.`)) return;
      try {
        els.classesStatus.textContent = 'Deleting…';
        await api(`/api/classes/${id}`, { method: 'DELETE' });
        await loadClasses();
        renderClassesList();
        loadAssessments();
        els.classesStatus.textContent = 'Deleted.';
        setTimeout(() => { els.classesStatus.textContent = ''; }, 1500);
      } catch (e) {
        els.classesStatus.textContent = 'Error: ' + e.message;
      }
    };
  });
}
if (els.manageClassesBtn) els.manageClassesBtn.onclick = openClassesPanel;
if (els.classesClose) els.classesClose.onclick = closeClassesPanel;
if (els.addClassBtn) {
  els.addClassBtn.onclick = async () => {
    const name = (els.newClassName.value || '').trim();
    if (!name) return;
    try {
      els.classesStatus.textContent = 'Adding…';
      const { class: added } = await api('/api/classes', { method: 'POST', body: { name } });
      els.newClassName.value = '';
      await loadClasses();
      renderClassesList();
      // Make the new class active so the dashboard shows it.
      if (added && added.id) {
        setActiveClassId(added.id);
        if (els.classSwitcher) els.classSwitcher.value = added.id;
        loadAssessments();
      }
      els.classesStatus.textContent = 'Added.';
      setTimeout(() => { els.classesStatus.textContent = ''; }, 1500);
    } catch (e) {
      els.classesStatus.textContent = 'Error: ' + e.message;
    }
  };
}

// Subject templates — empty (just pre-set the subject + suggest question
// types). Teachers add all the actual questions themselves.
const SUBJECT_TEMPLATES = [
  { id: 'math', subject: 'Math', icon: '🔢',
    blurb: 'Multiple choice, short answer, and long answer for problem-solving steps.' },
  { id: 'physics', subject: 'Physics', icon: '⚛️',
    blurb: 'MCQs for concepts, long answers for derivations, short answers for unit-conversion.' },
  { id: 'chemistry', subject: 'Chemistry', icon: '🧪',
    blurb: 'MCQs for periodic-table facts, short answers for balanced equations, long answers for mechanisms.' },
  { id: 'biology', subject: 'Biology', icon: '🧬',
    blurb: 'MCQs, True/False/Not Given on diagrams, long answers on processes (photosynthesis, respiration).' },
  { id: 'health', subject: 'Health Science', icon: '🩺',
    blurb: 'Mix of MCQs, True/False, and short essays on case studies and ethics.' },
  { id: 'islamic', subject: 'Islamic Studies', icon: '☪️',
    blurb: 'Short answers on key terms, long answers on hadith / surah interpretation, essays on ethics.' },
  { id: 'social', subject: 'Social Studies', icon: '🌍',
    blurb: 'MCQs on dates and figures, True/False/Not Given on source extracts, essays on causation.' },
  { id: 'french', subject: 'French', icon: '🇫🇷',
    blurb: 'MCQs for vocabulary, short answers for translation, essay for composition (auto-graded with rubric).' },
];

// ----- Global report-language preference (persisted to localStorage) -----
const LANG_KEY = 'classcurio.reportLang';
function getReportLang() {
  return localStorage.getItem(LANG_KEY) || '';
}
function setReportLang(v) {
  if (v) localStorage.setItem(LANG_KEY, v);
  else localStorage.removeItem(LANG_KEY);
  // Keep the per-student dropdown in sync if it's mounted.
  if (els.progressLang) els.progressLang.value = v;
  if (els.topbarLang) els.topbarLang.value = v;
}
if (els.topbarLang) {
  els.topbarLang.value = getReportLang();
  els.topbarLang.onchange = () => setReportLang(els.topbarLang.value);
}

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
  const grade = els.filterGrade ? els.filterGrade.value : '';
  const year = els.filterYear ? els.filterYear.value : '';
  const activeClass = getActiveClassId();
  const filtered = allAssessments.filter((a) => {
    // Always scope to the active class — assessments without a classId
    // (legacy data) are still hidden until the next migration assigns them.
    if (activeClass && a.classId !== activeClass) return false;
    if (term && a.term !== term) return false;
    if (grade && a.grade !== grade) return false;
    if (year && a.academicYear !== year) return false;
    return true;
  });
  if (els.classCount) {
    const cls = classes.find((c) => c.id === activeClass);
    els.classCount.textContent = `${filtered.length} assessment${filtered.length === 1 ? '' : 's'} in ${cls ? cls.name : 'this class'}`;
  }
  return filtered;
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
        a.subject ? `📚 ${a.subject}` : null,
        a.assessmentLanguage ? `🌐 ${a.assessmentLanguage}` : null,
        a.grade ? `Grade ${a.grade}` : null,
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
// "+ New assessment" now goes to the template picker first, where the user
// chooses to start blank or pre-set a subject. Editing an existing assessment
// skips the picker.
els.newBtn.onclick = () => openTemplatePicker();
els.backBtn.onclick = () => {
  els.builderView.style.display = 'none';
  els.listView.style.display = 'block';
  loadAssessments();
};

// ----- Template picker -----
function openTemplatePicker() {
  els.listView.style.display = 'none';
  els.resultsView.style.display = 'none';
  els.builderView.style.display = 'none';
  if (!els.templatePicker) return openBuilder(null);
  els.templatePicker.style.display = 'block';
  renderTemplateGrid();
}
function closeTemplatePicker() {
  if (els.templatePicker) els.templatePicker.style.display = 'none';
}
function renderTemplateGrid() {
  if (!els.templateGrid) return;
  els.templateGrid.innerHTML = SUBJECT_TEMPLATES.map((t) => `
    <button class="btn" data-tmpl-id="${t.id}" style="display:flex; flex-direction:column; align-items:flex-start; text-align:left; padding: 14px; height: auto; line-height: 1.4; gap: 6px;">
      <div style="font-size: 28px;">${t.icon}</div>
      <div style="font-weight: 600; font-size: 15px;">${t.subject}</div>
      <div class="muted" style="font-size: 12px;">${t.blurb}</div>
    </button>
  `).join('');
  els.templateGrid.querySelectorAll('[data-tmpl-id]').forEach((btn) => {
    btn.onclick = () => {
      const tmpl = SUBJECT_TEMPLATES.find((x) => x.id === btn.dataset.tmplId);
      closeTemplatePicker();
      openBuilder(null, { subject: tmpl ? tmpl.subject : '' });
    };
  });
}
if (els.templateBack) els.templateBack.onclick = () => {
  closeTemplatePicker();
  els.listView.style.display = 'block';
};
if (els.templateBlank) els.templateBlank.onclick = () => {
  closeTemplatePicker();
  openBuilder(null);
};

function openBuilder(a, presets) {
  els.listView.style.display = 'none';
  els.resultsView.style.display = 'none';
  closeTemplatePicker();
  els.builderView.style.display = 'block';
  editingId = a ? a.id : null;
  els.builderTitle.textContent = a ? 'Edit assessment' : 'New assessment';
  els.title.value = a ? a.title : '';
  els.description.value = a ? a.description : '';
  if (els.passage) els.passage.value = a && a.passage ? a.passage : '';
  if (els.rubricStage) els.rubricStage.value = a && a.rubricStage ? a.rubricStage : '';
  if (els.term) els.term.value = a && a.term ? a.term : '';
  if (els.grade) els.grade.value = a && a.grade ? a.grade : '';
  if (els.academicYear) els.academicYear.value = a && a.academicYear ? a.academicYear : defaultAcademicYear();
  if (els.scheduledDate) els.scheduledDate.value = a && a.scheduledDate ? a.scheduledDate : '';
  if (els.subject) {
    els.subject.value = a && a.subject ? a.subject : (presets && presets.subject) || '';
  }
  if (els.assessmentLanguage) {
    els.assessmentLanguage.value = a && a.assessmentLanguage ? a.assessmentLanguage : '';
  }
  // Builder class dropdown — for new assessments default to the active class;
  // for edits use the assessment's stored classId.
  renderBuilderClassDropdown();
  if (els.builderClass) {
    els.builderClass.value = a && a.classId
      ? a.classId
      : (getActiveClassId() || (classes[0] && classes[0].id) || '');
  }
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
    if (type === 'tfng') { q.correctAnswer = 'true'; }
    if (type === 'short') { q.correctAnswer = ''; }
    if (type === 'long') { q.points = 5; }
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
    if (q.type === 'tfng') {
      root.querySelector('[data-tfng]').onchange = (e) => {
        q.correctAnswer = e.target.value;
      };
    }
    if (q.type === 'short') {
      root.querySelector('[data-f=correct]').oninput = (e) => { q.correctAnswer = e.target.value; };
    }
  });
}

function renderQuestion(q, idx) {
  const typeLabel = {
    mc: 'Multiple choice',
    tf: 'True/False',
    tfng: 'True/False/Not Given',
    short: 'Short answer',
    long: 'Long answer (manual)',
    essay: 'Essay (manual)',
    writing: 'Essay (auto-graded)',
  }[q.type];
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
  } else if (q.type === 'tfng') {
    body = `
      <div class="field">
        <label>Correct answer</label>
        <select data-tfng>
          <option value="true" ${q.correctAnswer === 'true' ? 'selected' : ''}>True</option>
          <option value="false" ${q.correctAnswer === 'false' ? 'selected' : ''}>False</option>
          <option value="ng" ${q.correctAnswer === 'ng' ? 'selected' : ''}>Not Given</option>
        </select>
        <div class="muted" style="font-size: 12px; margin-top: 4px;">"Not Given" means the passage doesn't say either way.</div>
      </div>
    `;
  } else if (q.type === 'short') {
    body = `
      <div class="field">
        <label>Expected answer (optional, auto-graded as case-insensitive exact match)</label>
        <input type="text" data-f="correct" value="${escapeAttr(q.correctAnswer || '')}" />
      </div>
    `;
  } else if (q.type === 'long') {
    body = `<div class="muted">Long-answer questions are graded manually by the teacher in the Results view. Default: 5 marks — adjust as needed.</div>`;
  } else if (q.type === 'essay') {
    body = `<div class="muted">Essay questions are graded manually by the teacher in the Results view.</div>`;
  } else if (q.type === 'writing') {
    body = `<div class="muted">Auto-graded essays use the Stage 7/8 writing rubric you select for the assessment (4 criteria × 3 marks = 12 points). You can review and override the AI grade in the essay queue.</div>`;
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
      grade: els.grade ? els.grade.value || null : null,
      subject: els.subject ? els.subject.value || null : null,
      assessmentLanguage: els.assessmentLanguage ? els.assessmentLanguage.value || null : null,
      classId: els.builderClass ? els.builderClass.value || null : null,
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
  els.reportCardView.style.display = 'none';
  currentResultsAssessmentId = id;
  const { assessment, results } = await api(`/api/results/${id}`);
  els.resultsTitle.textContent = `Results — ${assessment.title}`;

  // Class analytics panel above the per-student table.
  const analyticsHtml = await renderAnalytics(id);

  if (!results.length) {
    els.resultsBody.innerHTML = analyticsHtml + `<div class="muted">No submissions yet.</div>`;
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
          <td><button class="btn primary" data-report="${r.id}">📋 Report</button></td>
        </tr>
        ${details}
      `;
    })
    .join('');

  els.resultsBody.innerHTML = analyticsHtml + `
    <table>
      <thead><tr><th></th><th>Student</th><th>Auto score</th><th>Violations</th><th>Env</th><th>Submitted</th><th></th></tr></thead>
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
  els.resultsBody.querySelectorAll('button[data-report]').forEach((btn) => {
    btn.onclick = () => openReportCard(btn.dataset.report);
  });
}

// ---------- Class analytics ----------
async function renderAnalytics(assessmentId) {
  let a;
  try {
    a = await api(`/api/assessments/${assessmentId}/analytics`);
  } catch {
    return '';
  }
  if (!a.submissionCount) {
    return `<div class="panel" style="margin-bottom: 14px;"><strong>Class analytics:</strong> no submissions yet.</div>`;
  }

  const histMax = Math.max(...a.histogram.map((b) => b.count), 1);
  const histHtml = a.histogram.map((b) => `
    <div class="hist-col" title="${escapeHtml(b.label)}: ${b.count} student${b.count === 1 ? '' : 's'}">
      <div class="hist-bar" style="height: ${(b.count / histMax) * 100}%"></div>
      <div class="hist-label">${b.rangeStart}</div>
    </div>
  `).join('');

  const qHtml = a.questions.map((q, i) => {
    const rate = q.correctRate == null ? null : Math.round(q.correctRate * 100);
    const rateClass = rate == null ? 'muted' : rate >= 70 ? 'green' : rate >= 40 ? 'amber' : 'red';
    const rateText = rate == null ? 'manual / not gradable' : `${rate}% correct`;
    const wrong = q.mostCommonWrong
      ? `<div class="muted" style="font-size: 12px; margin-top: 2px;">Most common wrong answer: "${escapeHtml(q.mostCommonWrong.optionText)}" (${q.mostCommonWrong.count} student${q.mostCommonWrong.count === 1 ? '' : 's'})</div>`
      : '';
    return `
      <div class="qd-row">
        <div class="qd-num">Q${i + 1}</div>
        <div class="qd-prompt">${escapeHtml(q.prompt.slice(0, 90))}${q.prompt.length > 90 ? '…' : ''}</div>
        <div class="qd-rate ${rateClass}">${rateText}</div>
      </div>
      ${wrong}
    `;
  }).join('');

  return `
    <div class="panel analytics-panel" style="margin-bottom: 14px;">
      <h2 style="margin-top: 0;">Class performance</h2>
      <div class="stats-grid">
        <div class="stat"><div class="stat-num">${a.submissionCount}</div><div class="stat-label">Submissions</div></div>
        <div class="stat"><div class="stat-num">${a.mean}</div><div class="stat-label">Mean</div></div>
        <div class="stat"><div class="stat-num">${a.median}</div><div class="stat-label">Median</div></div>
        <div class="stat"><div class="stat-num">${a.min}–${a.max}</div><div class="stat-label">Range</div></div>
        ${a.avgTimeMinutes != null
          ? `<div class="stat"><div class="stat-num">${a.avgTimeMinutes}m</div><div class="stat-label">Avg time</div></div>`
          : ''}
      </div>
      <h3 style="margin-top: 16px;">Score distribution</h3>
      <div class="histogram">${histHtml}</div>
      <div class="muted" style="margin-top: 4px; font-size: 12px;">Buckets are 10-percent ranges. Hover for counts.</div>
      <h3 style="margin-top: 16px;">Per-question difficulty</h3>
      <div class="question-difficulty">${qHtml}</div>
    </div>
  `;
}

// ---------- Report card view (per student) ----------
async function openReportCard(resultId) {
  hideAllViews();
  els.reportCardView.style.display = 'block';
  els.reportCardSummary.innerHTML = '<div class="muted">Loading…</div>';
  els.reportCardBody.innerHTML = '';
  try {
    const data = await api(`/api/results/teacher/${resultId}`);
    data.__resultId = resultId;
    renderReportCard({
      mountSummary: els.reportCardSummary,
      mountBody: els.reportCardBody,
      data,
      isTeacher: true,
    });
  } catch (e) {
    els.reportCardSummary.innerHTML = `<div class="error">Could not load report: ${escapeHtml(e.message)}</div>`;
  }
}

// Render the polished report card. Same layout as the one on the student
// page, with editable teacher narrative + full feedback always visible.
function renderReportCard({ mountSummary, mountBody, data, isTeacher }) {
  const pct = data.totalMax > 0 ? Math.round((data.totalScore / data.totalMax) * 100) : 0;
  const durationMins = data.startedAt && data.submittedAt
    ? Math.max(0, Math.round((new Date(data.submittedAt) - new Date(data.startedAt)) / 60000))
    : null;

  const meta = [
    data.term ? `Term ${data.term}` : null,
    data.academicYear || null,
    data.teacherName ? `Teacher: ${data.teacherName}` : null,
  ].filter(Boolean).join(' · ');

  const studentLine = isTeacher
    ? `<div><strong>Student:</strong> ${escapeHtml(data.studentName)} (${escapeHtml(data.studentEmail)})</div>`
    : '';

  mountSummary.innerHTML = `
    <div class="report-card">
      <div class="report-header">
        <div class="report-school">ClassCurio · Assessment Report</div>
        <h1 style="margin: 4px 0 8px;">${escapeHtml(data.assessmentTitle)}</h1>
        <div class="report-meta">
          ${studentLine}
          <div><strong>Submitted:</strong> ${new Date(data.submittedAt).toLocaleString()}${durationMins != null ? ` · took ${durationMins} min` : ''}</div>
          ${meta ? `<div>${escapeHtml(meta)}</div>` : ''}
        </div>
      </div>

      <div class="report-score-block">
        <div class="report-score-big">
          <span class="score-num">${data.totalScore}</span><span class="score-sep"> / </span><span class="score-max">${data.totalMax}</span>
        </div>
        <div class="report-score-bar"><div class="report-score-bar-fill" style="width: ${pct}%"></div></div>
        <div class="report-score-pct">${pct}%</div>
      </div>

      <table class="report-breakdown">
        <tr><th>Section</th><th>Score</th></tr>
        <tr><td>Auto-graded (multiple choice / true-false / short answer)</td>
            <td>${data.autoScore} / ${data.autoMax}</td></tr>
        <tr><td>Teacher-graded (essay / writing)</td>
            <td>${data.manualScore} / ${data.manualMax}</td></tr>
        <tr class="report-total"><td><strong>Total</strong></td>
            <td><strong>${data.totalScore} / ${data.totalMax}</strong></td></tr>
      </table>

      <div class="report-comment-block">
        <h2>Teacher's Comments</h2>
        ${isTeacher ? `
          <textarea id="teacher-narrative" rows="4" placeholder="Write a personalised comment for this student. This shows on their report card and on any printed/PDF version.">${escapeHtml(data.teacherComment || '')}</textarea>
          <div class="row no-print" style="margin-top: 8px;">
            <div class="spacer"></div>
            <button id="save-narrative" class="btn primary">Save comment</button>
            <span id="narrative-status" class="muted"></span>
          </div>
          <div class="report-comment-text print-only" style="display:none;">${data.teacherComment ? escapeHtml(data.teacherComment) : '<em>No comment.</em>'}</div>
        ` : `
          <div class="report-comment-text">${data.teacherComment ? escapeHtml(data.teacherComment) : '<em>No comment yet.</em>'}</div>
        `}
      </div>
    </div>
  `;

  mountBody.innerHTML = `
    <div class="report-card">
      <h2>Question by Question</h2>
      ${data.review.map((q, i) => renderReviewQuestion(q, i)).join('')}
    </div>
  `;

  if (isTeacher) {
    const ta = document.getElementById('teacher-narrative');
    const btn = document.getElementById('save-narrative');
    const status = document.getElementById('narrative-status');
    if (btn) {
      btn.onclick = async () => {
        status.textContent = 'Saving…';
        try {
          await api(`/api/results/${data.__resultId}/comment`, {
            method: 'POST',
            body: { comment: ta.value },
          });
          status.textContent = 'Saved.';
          // Mirror to the print-only div so a print right after saving
          // includes the new comment.
          const printOnly = mountSummary.querySelector('.print-only');
          if (printOnly) printOnly.innerHTML = ta.value
            ? escapeHtml(ta.value)
            : '<em>No comment.</em>';
          setTimeout(() => { status.textContent = ''; }, 2000);
        } catch (e) {
          status.textContent = 'Error: ' + e.message;
        }
      };
    }
  }
}

// Render a single question's report row. Mirrors the student-side helper.
function renderReviewQuestion(q, i) {
  const statusBadge =
    q.correct === true ? '<span class="badge green">Correct</span>' :
    q.correct === false ? '<span class="badge red">Incorrect</span>' :
    q.manualGrade ? `<span class="badge green">Graded: ${q.manualGrade.score}/${q.manualGrade.maxScore}</span>` :
    '<span class="badge">Awaiting review</span>';

  const tfngLabel = (v) => v === 'true' ? 'True' : v === 'false' ? 'False' : v === 'ng' ? 'Not Given' : String(v);

  let givenDisplay = '<em>(no answer)</em>';
  if (q.given !== null && q.given !== undefined) {
    if (q.type === 'mc') givenDisplay = escapeHtml(String(q.options[q.given] ?? q.given));
    else if (q.type === 'tf') givenDisplay = q.given ? 'True' : 'False';
    else if (q.type === 'tfng') givenDisplay = tfngLabel(q.given);
    else givenDisplay = escapeHtml(String(q.given));
  }

  let correctDisplay = '';
  if (q.correct === false && q.correctAnswer !== null) {
    let text = '';
    if (q.type === 'mc') text = String(q.options[q.correctAnswer] ?? q.correctAnswer);
    else if (q.type === 'tf') text = q.correctAnswer ? 'True' : 'False';
    else if (q.type === 'tfng') text = tfngLabel(q.correctAnswer);
    else text = String(q.correctAnswer);
    correctDisplay = `<div class="success" style="margin-top: 6px;"><strong>Correct answer:</strong> ${escapeHtml(text)}</div>`;
  }

  const feedback = q.manualGrade && q.manualGrade.feedback
    ? `<div style="margin-top: 6px; padding: 8px; background: #f1f5ff; border-radius: 6px; white-space: pre-wrap;">
         <strong>Feedback:</strong>
${escapeHtml(q.manualGrade.feedback)}
       </div>`
    : '';

  return `
    <div class="panel">
      <div class="muted" style="margin-bottom: 4px;">Question ${i + 1} · ${q.points} point${q.points === 1 ? '' : 's'} ${statusBadge}</div>
      <div style="font-size: 16px; margin-bottom: 10px;">${escapeHtml(q.prompt)}</div>
      <div><strong>Answer:</strong> ${givenDisplay}</div>
      ${correctDisplay}
      ${feedback}
    </div>
  `;
}

function hideAllViews() {
  els.listView.style.display = 'none';
  els.builderView.style.display = 'none';
  els.resultsView.style.display = 'none';
  els.essayQueueView.style.display = 'none';
  if (els.reportCardView) els.reportCardView.style.display = 'none';
  if (els.studentsView) els.studentsView.style.display = 'none';
  if (els.progressView) els.progressView.style.display = 'none';
}

// ---------- Students list + progress (Phase 2) ----------
let currentProgressStudentId = null;

if (els.studentsBtn) {
  els.studentsBtn.onclick = () => openStudentsList();
}
if (els.studentsBack) {
  els.studentsBack.onclick = () => {
    hideAllViews();
    els.listView.style.display = 'block';
    loadAssessments();
  };
}
if (els.progressBack) {
  els.progressBack.onclick = () => openStudentsList();
}

async function openStudentsList() {
  hideAllViews();
  els.studentsView.style.display = 'block';
  els.studentsList.innerHTML = '<div class="muted">Loading…</div>';
  try {
    const { students } = await api('/api/teachers/students');
    if (!students.length) {
      els.studentsList.innerHTML = `<div class="panel muted">No students have submitted any of your assessments yet.</div>`;
      return;
    }
    els.studentsList.innerHTML = students.map((s) => `
      <div class="card">
        <div class="row">
          <div>
            <div class="card-title">${escapeHtml(s.name)}</div>
            <div class="muted">${escapeHtml(s.email)} · ${s.submissions} submission${s.submissions === 1 ? '' : 's'}${s.lastSubmittedAt ? ` · last on ${new Date(s.lastSubmittedAt).toLocaleDateString()}` : ''}</div>
          </div>
          <div class="spacer"></div>
          <button class="btn primary" data-progress="${s.studentId}">View progress &amp; reports →</button>
        </div>
      </div>
    `).join('');
    els.studentsList.querySelectorAll('button[data-progress]').forEach((btn) => {
      btn.onclick = () => openStudentProgress(btn.dataset.progress);
    });
  } catch (e) {
    els.studentsList.innerHTML = `<div class="error">${escapeHtml(e.message)}</div>`;
  }
}

async function openStudentProgress(studentId) {
  hideAllViews();
  currentProgressStudentId = studentId;
  els.progressView.style.display = 'block';
  await refreshProgress();
}

async function refreshProgress() {
  if (!currentProgressStudentId) return;
  els.progressBody.innerHTML = '<div class="muted">Loading…</div>';
  const term = els.progressTerm.value || '';
  const year = (els.progressYear.value || '').trim();
  const url = `/api/students/${currentProgressStudentId}/progress?term=${encodeURIComponent(term)}&year=${encodeURIComponent(year)}`;
  try {
    const data = await api(url);
    els.progressTitle.textContent = data.studentName
      ? `${data.studentName} — progress`
      : 'Student progress';
    renderProgress(data);
  } catch (e) {
    els.progressBody.innerHTML = `<div class="error">${escapeHtml(e.message)}</div>`;
  }
}

if (els.progressTerm) els.progressTerm.onchange = refreshProgress;
if (els.progressYear) els.progressYear.onchange = refreshProgress;

if (els.progressExcel) {
  els.progressExcel.onclick = () => {
    if (!currentProgressStudentId) return;
    const term = els.progressTerm.value || '';
    const year = (els.progressYear.value || '').trim();
    const lang = (els.progressLang && els.progressLang.value) || getReportLang();
    window.location.href = `/api/students/${currentProgressStudentId}/excel-report?term=${encodeURIComponent(term)}&year=${encodeURIComponent(year)}&lang=${encodeURIComponent(lang)}`;
  };
}
if (els.progressWord) {
  els.progressWord.onclick = () => {
    if (!currentProgressStudentId) return;
    const term = els.progressTerm.value || '';
    const year = (els.progressYear.value || '').trim();
    const lang = (els.progressLang && els.progressLang.value) || getReportLang();
    window.location.href = `/api/students/${currentProgressStudentId}/word-report?term=${encodeURIComponent(term)}&year=${encodeURIComponent(year)}&lang=${encodeURIComponent(lang)}`;
  };
}
// Sync the per-student dropdown with the saved global preference whenever
// the Student Progress view opens.
if (els.progressLang) {
  els.progressLang.value = getReportLang();
  els.progressLang.onchange = () => setReportLang(els.progressLang.value);
}

function renderProgress(data) {
  if (!data.submissions.length) {
    els.progressBody.innerHTML = `<div class="panel muted">No submissions in scope. Try clearing the term/year filter.</div>`;
    return;
  }

  const overallPct = data.overall ? Math.round(data.overall.percent * 100) : 0;

  // Per-assessment bar chart with class-average overlay
  const barsHtml = data.submissions.map((s) => {
    const studentP = Math.round(s.percent * 100);
    const classP = s.classAverage != null ? Math.round(s.classAverage * 100) : null;
    return `
      <div class="progress-bar-row">
        <div class="pb-label">
          <div class="pb-title">${escapeHtml(s.title)}</div>
          <div class="muted" style="font-size: 11px;">${s.submittedAt ? new Date(s.submittedAt).toLocaleDateString() : ''}${s.term ? ` · Term ${s.term}` : ''}${s.academicYear ? ` · ${escapeHtml(s.academicYear)}` : ''}</div>
        </div>
        <div class="pb-track">
          <div class="pb-fill" style="width: ${studentP}%"></div>
          ${classP != null ? `<div class="pb-class-marker" style="left: ${classP}%" title="Class average: ${classP}%"></div>` : ''}
        </div>
        <div class="pb-score">${s.score}/${s.max} · ${studentP}%</div>
      </div>
    `;
  }).join('');

  // Rubric criterion progress (if any writing assessments)
  let rubricHtml = '';
  if (data.rubricAverages) {
    const r = data.rubricAverages;
    const criteria = [
      ['content', 'Content & Task Achievement'],
      ['organisation', 'Organisation & Cohesion'],
      ['grammar', 'Grammatical Range & Accuracy'],
      ['lexis', 'Lexical Range & Accuracy'],
    ];
    rubricHtml = `
      <div class="panel" style="margin-top: 14px;">
        <h2 style="margin-top: 0;">Writing rubric averages</h2>
        <div class="muted" style="margin-bottom: 12px;">Across ${r.submissionCount} writing assessment${r.submissionCount === 1 ? '' : 's'} in scope.</div>
        ${criteria.map(([k, name]) => {
          const v = r[k];
          const pct = (v / 3) * 100;
          let level;
          if (v >= 2.5) level = '<span class="badge green">Beyond grade level</span>';
          else if (v >= 1.5) level = '<span class="badge">At grade level</span>';
          else level = '<span class="badge red">Towards grade level</span>';
          return `
            <div class="progress-bar-row">
              <div class="pb-label">
                <div class="pb-title">${escapeHtml(name)}</div>
              </div>
              <div class="pb-track">
                <div class="pb-fill" style="width: ${pct}%; background: linear-gradient(90deg, #6c7ff2, #3b5bdb);"></div>
              </div>
              <div class="pb-score">${v.toFixed(1)} / 3 ${level}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // Submissions table
  const rowsHtml = data.submissions.map((s) => `
    <tr>
      <td>${escapeHtml(s.title)}</td>
      <td>${s.submittedAt ? new Date(s.submittedAt).toLocaleDateString() : ''}</td>
      <td>${s.term ? `Term ${s.term}` : '—'}</td>
      <td>${s.score}/${s.max} (${Math.round(s.percent * 100)}%)</td>
      <td>${s.classAverage != null ? `${Math.round(s.classAverage * 100)}%` : '—'}</td>
      <td>${s.teacherComment ? '<span class="badge green">Yes</span>' : '<span class="muted">—</span>'}</td>
      <td><button class="btn ghost" data-open-card="${s.resultId}">📋 Open report</button></td>
    </tr>
  `).join('');

  els.progressBody.innerHTML = `
    <div class="panel">
      <h2 style="margin-top: 0;">Overall</h2>
      <div class="row">
        <div class="stat" style="flex: 0 0 140px;">
          <div class="stat-num">${data.overall.score} / ${data.overall.max}</div>
          <div class="stat-label">Total points</div>
        </div>
        <div class="stat" style="flex: 0 0 140px;">
          <div class="stat-num">${overallPct}%</div>
          <div class="stat-label">Average</div>
        </div>
        <div class="stat" style="flex: 0 0 140px;">
          <div class="stat-num">${data.overall.submissionCount}</div>
          <div class="stat-label">Submissions</div>
        </div>
      </div>
    </div>

    <div class="panel">
      <h2 style="margin-top: 0;">Score trend</h2>
      <div class="muted" style="margin-bottom: 12px; font-size: 13px;">The blue bar is the student's score. The black tick on the same bar is the class average for that assessment.</div>
      <div class="progress-bars">${barsHtml}</div>
    </div>

    ${rubricHtml}

    <div class="panel">
      <h2 style="margin-top: 0;">Submissions</h2>
      <table>
        <thead><tr><th>Assessment</th><th>Date</th><th>Term</th><th>Score</th><th>Class avg</th><th>Comment</th><th></th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;

  els.progressBody.querySelectorAll('button[data-open-card]').forEach((btn) => {
    btn.onclick = () => openReportCard(btn.dataset.openCard);
  });
}

if (els.reportCardBack) {
  els.reportCardBack.onclick = () => {
    els.reportCardView.style.display = 'none';
    if (currentResultsAssessmentId) {
      openResults(currentResultsAssessmentId);
    } else {
      els.listView.style.display = 'block';
      loadAssessments();
    }
  };
}
if (els.reportCardPrint) {
  els.reportCardPrint.onclick = () => window.print();
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
if (els.filterGrade) els.filterGrade.onchange = () => render();
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
  await loadClasses();
  await loadAssessments();
  await refreshQueueCount();
  await refreshApiKeyState();
})();
