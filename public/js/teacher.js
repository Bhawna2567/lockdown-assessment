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

  topbarLang: document.getElementById('topbar-lang'),  // legacy — null after html change
  uiLang: document.getElementById('ui-lang'),

  subject: document.getElementById('subject'),
  skill: document.getElementById('skill'),
  skillField: document.getElementById('skill-field'),
  listeningAudioHost: document.getElementById('listening-audio-host'),
  assessmentLanguage: document.getElementById('assessment-language'),
  deliveryMode: document.getElementById('delivery-mode'),

  templatePicker: document.getElementById('template-picker'),
  templateBack: document.getElementById('template-back'),
  templateBlank: document.getElementById('template-blank'),
  templateGrid: document.getElementById('template-grid'),

  aiSubject: document.getElementById('ai-subject'),
  aiLanguage: document.getElementById('ai-language'),
  aiSowFile: document.getElementById('ai-sow-file'),
  aiSowFilesList: document.getElementById('ai-sow-files-list'),
  aiPrompt: document.getElementById('ai-prompt'),
  aiCount: document.getElementById('ai-count'),
  aiWantGraphics: document.getElementById('ai-want-graphics'),
  aiGenerateBtn: document.getElementById('ai-generate-btn'),
  aiStatus: document.getElementById('ai-status'),

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
// Cache of teacher's known students (those who've submitted). Loaded when the
// Manage Classes panel opens so we can cross-reference roster names against
// real student accounts and link to their progress page.
let knownStudents = [];
async function loadKnownStudents() {
  try {
    const { students } = await api('/api/teachers/students');
    knownStudents = Array.isArray(students) ? students : [];
  } catch {
    knownStudents = [];
  }
}
function findStudentForRoster(entry) {
  if (!knownStudents.length) return null;
  // Exact email match (case-insensitive)
  if (entry.email) {
    const e = entry.email.toLowerCase();
    const byEmail = knownStudents.find((s) => (s.email || '').toLowerCase() === e);
    if (byEmail) return byEmail;
  }
  // Name match (case-insensitive, normalized whitespace)
  if (entry.name) {
    const n = entry.name.toLowerCase().replace(/\s+/g, ' ').trim();
    const byName = knownStudents.find((s) =>
      (s.name || '').toLowerCase().replace(/\s+/g, ' ').trim() === n
    );
    if (byName) return byName;
  }
  return null;
}

async function openClassesPanel() {
  if (!els.classesPanel) return;
  els.classesPanel.style.display = 'block';
  await loadKnownStudents();
  renderClassesList();
}
function closeClassesPanel() {
  if (els.classesPanel) els.classesPanel.style.display = 'none';
}
// ----- CSV parsing for roster upload -----
// Parses a CSV with optional 'email' and 'name' columns. Tolerant of:
//   - Just emails (one per line, no header)
//   - email,name with header
//   - name,email with header
//   - Quoted values with embedded commas
function parseRosterCSV(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const splitLine = (line) => {
    const out = [];
    let cur = '';
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') inQ = !inQ;
      else if (ch === ',' && !inQ) { out.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };

  // Detect header
  const first = splitLine(lines[0]).map((s) => s.toLowerCase());
  const hasHeader = first.some((c) =>
    c === 'email' || c === 'name' || c === 'student' || c === 'student email'
    || c === 'studentnumber' || c === 'student_number' || c === 'student number' || c === 'id'
  );
  let emailIdx = 0;
  let nameIdx = 1;
  let numberIdx = -1;
  let dataStart = 0;
  if (hasHeader) {
    dataStart = 1;
    emailIdx = first.findIndex((c) => c.includes('email'));
    nameIdx = first.findIndex((c) => c === 'name' || c.includes('student name') || c === 'student');
    numberIdx = first.findIndex((c) =>
      c === 'studentnumber' || c === 'student_number' || c === 'student number'
      || c === 'student#' || c === 'student #' || c === 'id'
    );
    if (emailIdx === -1) emailIdx = 0;
    if (nameIdx === -1) nameIdx = emailIdx === 0 ? 1 : 0;
  }

  const out = [];
  for (let i = dataStart; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    let email = (cols[emailIdx] || '').replace(/"/g, '').trim().toLowerCase();
    let name = (cols[nameIdx] || '').replace(/"/g, '').trim();
    let studentNumber = numberIdx >= 0 ? (cols[numberIdx] || '').replace(/"/g, '').trim() : '';

    // If the file is a single column, decide if it's emails or names.
    if (cols.length === 1) {
      const only = (cols[0] || '').replace(/"/g, '').trim();
      if (only.includes('@')) { email = only.toLowerCase(); name = ''; }
      else { email = ''; name = only; }
    }

    // Strip leading list numbering ("1. Alice Khan" -> "Alice Khan").
    name = name.replace(/^\s*(?:\d{1,3}[\.\)]|[•\-\*])\s+/, '').trim();

    const validEmail = email && email.includes('@');
    if (!validEmail && !name) continue; // need at least one
    out.push({ email: validEmail ? email : '', name, studentNumber });
  }
  return out;
}

function renderClassesList() {
  if (!els.classesList) return;
  if (!classes.length) {
    els.classesList.innerHTML = `<div class="muted">No classes yet. Add one above.</div>`;
    return;
  }
  els.classesList.innerHTML = classes.map((c) => {
    const rosterCount = (c.roster || []).length;
    return `
      <div data-class-row="${c.id}" style="padding: 12px 14px; border: 1px solid #e5e7eb; border-radius: 10px; margin-bottom: 10px;">
        <div class="row" style="margin-bottom: 8px;">
          <input type="text" data-class-name="${c.id}" value="${escapeAttr(c.name)}" style="flex: 1;" />
          <button class="btn" data-class-rename="${c.id}">Rename</button>
          <button class="btn danger" data-class-delete="${c.id}">Delete</button>
        </div>
        <div class="row" style="font-size: 13px; flex-wrap: wrap; gap: 6px;">
          <span class="muted">📋 Roster: <strong>${rosterCount}</strong> student${rosterCount === 1 ? '' : 's'}</span>
          <div class="spacer"></div>
          ${rosterCount ? `<button class="btn" data-class-view-roster="${c.id}">View students</button>` : ''}
          <button class="btn" data-class-add-one="${c.id}" title="Add a single student by name and email">➕ Add student</button>
          <button class="btn" data-class-download-template="${c.id}" title="Download a CSV template you can fill in">📥 Template</button>
          <button class="btn" data-class-upload-roster="${c.id}">📋 Upload class list (CSV / PDF / Word)</button>
          <button class="btn" data-class-reconcile="${c.id}" title="Scan submissions and add any student not already on the roster">♻ Sync from results</button>
          <button class="btn primary" data-class-prereg="${c.id}" title="Create accounts with temporary passwords">🔑 Pre-register students</button>
          <input type="file" accept=".csv,.txt,.pdf,.docx,.doc" data-class-roster-file="${c.id}" style="display:none;" />
          <input type="file" accept=".csv,.txt,.pdf,.docx,.doc" data-class-prereg-file="${c.id}" style="display:none;" />
        </div>
        <div data-class-roster-status="${c.id}" class="muted" style="font-size: 12px; margin-top: 6px;"></div>
        <div data-class-add-one-form="${c.id}" style="display:none; margin-top: 10px; padding: 12px 14px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;">
          <div style="font-weight: 600; color: #1e3a8a; margin-bottom: 8px;">Add one student</div>
          <div class="row" style="gap: 8px; flex-wrap: wrap; margin-bottom: 8px;">
            <div class="field" style="flex: 1; min-width: 180px;">
              <label style="font-size: 12px;">Full name</label>
              <input type="text" data-class-add-name="${c.id}" placeholder="e.g. Alice Khan" />
            </div>
            <div class="field" style="flex: 1; min-width: 220px;">
              <label style="font-size: 12px;">Email address</label>
              <input type="email" data-class-add-email="${c.id}" placeholder="alice@school.com" />
            </div>
            <div class="field" style="flex: 0 0 140px;">
              <label style="font-size: 12px;">Student # (optional)</label>
              <input type="text" data-class-add-num="${c.id}" placeholder="20001" />
            </div>
          </div>
          <div class="row" style="gap: 8px;">
            <button class="btn primary" data-class-add-save="${c.id}">Add and generate password</button>
            <button class="btn" data-class-add-cancel="${c.id}">Cancel</button>
            <div class="spacer"></div>
            <span data-class-add-status="${c.id}" class="muted" style="font-size: 12px;"></span>
          </div>
        </div>
        <div data-class-roster-view="${c.id}" style="display:none; margin-top: 10px; max-height: 240px; overflow-y: auto; background: #f9fafb; border-radius: 6px; padding: 8px;"></div>
        <div data-class-prereg-view="${c.id}" style="display:none; margin-top: 10px;"></div>
      </div>
    `;
  }).join('');

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
      if (!confirm(
        `Delete the class "${cls.name}"?\n\n` +
        `This only works if the class has no assessments. If it does, move or delete those first.\n\n` +
        `Pre-registered students who belong ONLY to this class will be permanently removed, ` +
        `so you can re-add them in a new class and they'll receive fresh temporary passwords.`
      )) return;
      try {
        els.classesStatus.textContent = 'Deleting…';
        const resp = await api(`/api/classes/${id}`, { method: 'DELETE' });
        await loadClasses();
        renderClassesList();
        loadAssessments();
        const removed = (resp && resp.removedUsers) || 0;
        els.classesStatus.textContent = removed > 0
          ? `Deleted. ${removed} student account${removed === 1 ? '' : 's'} also removed (orphaned).`
          : 'Deleted.';
        setTimeout(() => { els.classesStatus.textContent = ''; }, 3500);
      } catch (e) {
        els.classesStatus.textContent = 'Error: ' + e.message;
      }
    };
  });

  // Template download — generates a sample CSV the teacher can fill in.
  // Includes the `studentNumber` column for use with pre-registration.
  els.classesList.querySelectorAll('[data-class-download-template]').forEach((btn) => {
    btn.onclick = () => {
      const csv = [
        'email,name,studentNumber',
        'alice@school.com,Alice Khan,20001',
        'bob@school.com,Bob Singh,20002',
        'charlie@school.com,Charlie Lee,20003',
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'classcurio-roster-template.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };
  });

  // Pre-register students — opens a file picker and uploads to the server's
  // /pre-register endpoint, which creates accounts and returns temp passwords.
  els.classesList.querySelectorAll('[data-class-prereg]').forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.classPrereg;
      const fileInput = els.classesList.querySelector(`[data-class-prereg-file="${id}"]`);
      if (fileInput) fileInput.click();
    };
  });
  els.classesList.querySelectorAll('[data-class-prereg-file]').forEach((input) => {
    input.onchange = async (e) => {
      const id = input.dataset.classPreregFile;
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const status = els.classesList.querySelector(`[data-class-roster-status="${id}"]`);
      const view = els.classesList.querySelector(`[data-class-prereg-view="${id}"]`);

      // Quick sanity: same handling as the regular roster upload — CSVs and
      // plain text are parsed client-side (the server's pdf-parse/mammoth
      // helpers don't accept CSV), and only PDF/Word docs get uploaded.
      const lower = (file.name || '').toLowerCase();
      const isCsvLike = lower.endsWith('.csv') || lower.endsWith('.txt')
        || (file.type || '').startsWith('text/');

      // Confirm with the teacher first — this CREATES accounts.
      if (!confirm(
        'Pre-register the students in this file?\n\n' +
        'For every email that doesn\'t already have an account, ClassCurio will:\n' +
        '  • create a student account\n' +
        '  • generate a temporary password\n' +
        '  • add them to this class\'s roster\n\n' +
        'Students will be forced to set their own password on first sign-in.'
      )) {
        input.value = '';
        return;
      }

      try {
        if (status) {
          status.textContent = 'Reading file and creating accounts…';
          status.style.color = '';
        }
        let res, data;
        if (isCsvLike) {
          // Parse CSV/TXT in the browser. Send the parsed roster as JSON.
          const text = await file.text();
          const parsed = parseRosterCSV(text);
          if (!parsed.length) {
            throw new Error('No usable rows found in the file. Make sure the first row has headers like "email,name,studentNumber" or that each line has a valid email.');
          }
          res = await fetch(`/api/classes/${id}/pre-register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roster: parsed }),
          });
        } else {
          // PDF / Word / etc — upload the file; server extracts text.
          const fd = new FormData();
          fd.append('file', file);
          res = await fetch(`/api/classes/${id}/pre-register`, { method: 'POST', body: fd });
        }
        data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || 'Pre-registration failed');

        const { results, summary } = data;
        // Rows that carry a temp password: newly-created accounts AND
        // existing pending accounts that got their password reset.
        const withTempPw = results.filter((r) => r.tempPassword);

        if (status) {
          if (withTempPw.length === 0) {
            // Nothing got created OR reset. Be specific about why.
            const reasons = [];
            if (summary.existed) reasons.push(`${summary.existed} students already chose their own passwords (you can't reset those)`);
            if (summary.skipped) reasons.push(`${summary.skipped} rows skipped (invalid email or no email column)`);
            status.innerHTML = `⚠ No passwords generated. ${reasons.join('; ') || 'Check your file format.'}`;
            status.style.color = '#92400e';
          } else {
            const parts = [];
            if (summary.created) parts.push(`<strong>${summary.created} new</strong>`);
            if (summary.reset)   parts.push(`<strong>${summary.reset} reset</strong> (still on first login)`);
            const tail = [];
            if (summary.existed) tail.push(`${summary.existed} already chose own password`);
            if (summary.skipped) tail.push(`${summary.skipped} skipped`);
            status.innerHTML = `✓ Pre-registered: ${parts.join(', ')}` +
              (tail.length ? ` · ${tail.join('; ')}` : '') +
              `.  Save the credentials below — they're shown only this once.`;
            status.style.color = '#166534';
          }
        }

        if (view) renderCredentialsPanel(view, id, results);
        // Refresh the roster + class list (counts changed).
        await loadKnownStudents();
        await loadClasses();
        // Don't re-render — that would clobber the credentials panel.
      } catch (err) {
        if (status) {
          status.textContent = '❌ ' + err.message;
          status.style.color = '#b91c1c';
        }
      } finally {
        input.value = '';
      }
    };
  });

  // ----- "+ Add student" — manual single-student add (name + email) -----
  // Shared credentials panel renderer. Both the bulk pre-register flow and
  // the single-student form route their server responses through here so the
  // teacher always sees the same green credentials table + download button.
  function renderCredentialsPanel(view, classId, results) {
    const withTempPw = results.filter((r) => r.tempPassword);
    view.style.display = 'block';
    view.innerHTML = `
      <div class="panel" style="background: #ecfdf5; border: 2px solid #34d399; padding: 12px 14px;">
        <div class="row" style="margin-bottom: 8px;">
          <strong style="color: #065f46;">🔑 Temporary credentials (${withTempPw.length})</strong>
          <div class="spacer"></div>
          ${withTempPw.length ? `<button class="btn" data-act="download-credentials">⬇ Download as CSV</button>` : ''}
          <button class="btn ghost" data-act="hide-credentials">Hide</button>
        </div>
        <div class="muted" style="font-size: 12px; margin-bottom: 8px;">
          These passwords are <strong>shown one time only</strong>. Copy or download them, share each row privately with the right student, then they'll be forced to set their own password on first login.
        </div>
        <table style="width:100%; font-size: 12px; border-collapse: collapse;">
          <thead>
            <tr style="background:#d1fae5;">
              <th style="text-align:left; padding: 6px 8px;">Name</th>
              <th style="text-align:left; padding: 6px 8px;">Email</th>
              <th style="text-align:left; padding: 6px 8px;">Student #</th>
              <th style="text-align:left; padding: 6px 8px;">Temporary password</th>
              <th style="text-align:left; padding: 6px 8px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${results.map((r) => `
              <tr style="border-top: 1px solid #a7f3d0;">
                <td style="padding: 6px 8px;">${escapeHtml(r.name || '')}</td>
                <td style="padding: 6px 8px;">${escapeHtml(r.email)}</td>
                <td style="padding: 6px 8px;">${escapeHtml(r.studentNumber || '')}</td>
                <td style="padding: 6px 8px; font-family: ui-monospace, monospace; ${r.tempPassword ? 'background: #fef3c7; font-weight: 600;' : 'color: #6b7280;'}">${r.tempPassword ? escapeHtml(r.tempPassword) : '—'}</td>
                <td style="padding: 6px 8px; ${r.status === 'created' ? 'color: #166534; font-weight: 600;' : r.status === 'reset' ? 'color: #1d4ed8;' : r.status === 'existed' ? 'color: #92400e;' : 'color: #b91c1c;'}">${escapeHtml(r.status)}${r.reason ? ' — ' + escapeHtml(r.reason) : ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    view.querySelectorAll('[data-act=download-credentials]').forEach((b) => {
      b.onclick = () => {
        const header = 'name,email,studentNumber,tempPassword';
        const rows = results
          .filter((r) => r.tempPassword)
          .map((r) => [r.name, r.email, r.studentNumber, r.tempPassword]
            .map((v) => `"${String(v || '').replace(/"/g, '""')}"`).join(','));
        const csv = [header, ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const cls = classes.find((c) => c.id === classId);
        const safe = (cls && cls.name ? cls.name : 'class').replace(/[^a-z0-9-]+/gi, '-');
        a.href = url;
        a.download = `${safe}-credentials.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };
    });
    view.querySelectorAll('[data-act=hide-credentials]').forEach((b) => {
      b.onclick = () => {
        view.style.display = 'none';
        view.innerHTML = '';
      };
    });
  }

  // Toggle the inline form.
  els.classesList.querySelectorAll('[data-class-add-one]').forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.classAddOne;
      const form = els.classesList.querySelector(`[data-class-add-one-form="${id}"]`);
      if (!form) return;
      const showing = form.style.display !== 'none';
      form.style.display = showing ? 'none' : 'block';
      if (!showing) {
        // Focus the name field for fast entry.
        const nameInput = form.querySelector(`[data-class-add-name="${id}"]`);
        if (nameInput) setTimeout(() => nameInput.focus(), 30);
      }
    };
  });
  els.classesList.querySelectorAll('[data-class-add-cancel]').forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.classAddCancel;
      const form = els.classesList.querySelector(`[data-class-add-one-form="${id}"]`);
      if (form) form.style.display = 'none';
    };
  });

  // Save: hit /pre-register with a one-row JSON roster, show credentials.
  els.classesList.querySelectorAll('[data-class-add-save]').forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.classAddSave;
      const form = els.classesList.querySelector(`[data-class-add-one-form="${id}"]`);
      const nameEl  = form && form.querySelector(`[data-class-add-name="${id}"]`);
      const emailEl = form && form.querySelector(`[data-class-add-email="${id}"]`);
      const numEl   = form && form.querySelector(`[data-class-add-num="${id}"]`);
      const status  = form && form.querySelector(`[data-class-add-status="${id}"]`);
      const view    = els.classesList.querySelector(`[data-class-prereg-view="${id}"]`);

      const name = (nameEl?.value || '').trim();
      const email = (emailEl?.value || '').trim().toLowerCase();
      const studentNumber = (numEl?.value || '').trim();

      if (!email || !email.includes('@')) {
        if (status) { status.textContent = '⚠ Enter a valid email address.'; status.style.color = '#b91c1c'; }
        if (emailEl) emailEl.focus();
        return;
      }

      try {
        if (status) { status.textContent = 'Creating account…'; status.style.color = ''; }
        btn.disabled = true;
        const res = await fetch(`/api/classes/${id}/pre-register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roster: [{ name, email, studentNumber }] }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to add student');

        const { results, summary } = data;
        const row = (results && results[0]) || null;
        if (status) {
          if (row && row.tempPassword) {
            status.innerHTML = row.status === 'reset'
              ? `✓ Reset — temporary password regenerated.`
              : `✓ Added — temporary password generated.`;
            status.style.color = '#166534';
          } else if (row && row.status === 'existed') {
            status.innerHTML = '⚠ This email already has an account and the student chose their own password. To force a reset, delete the class first or contact support.';
            status.style.color = '#92400e';
          } else {
            status.innerHTML = '⚠ ' + (row && row.reason ? row.reason : 'No account was created.');
            status.style.color = '#b91c1c';
          }
        }

        // Render the credentials panel below — same UI as bulk pre-register.
        if (view && results && results.length) renderCredentialsPanel(view, id, results);

        // Clear the form (but leave it open so the teacher can add another).
        if (nameEl) nameEl.value = '';
        if (emailEl) emailEl.value = '';
        if (numEl) numEl.value = '';

        await loadKnownStudents();
        await loadClasses();
      } catch (e) {
        if (status) { status.textContent = '❌ ' + e.message; status.style.color = '#b91c1c'; }
      } finally {
        btn.disabled = false;
      }
    };
  });

  // Roster upload — bridge button click to hidden file input
  els.classesList.querySelectorAll('[data-class-upload-roster]').forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.classUploadRoster;
      const fileInput = els.classesList.querySelector(`[data-class-roster-file="${id}"]`);
      if (fileInput) fileInput.click();
    };
  });
  els.classesList.querySelectorAll('[data-class-roster-file]').forEach((input) => {
    input.onchange = async (e) => {
      const id = input.dataset.classRosterFile;
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const status = els.classesList.querySelector(`[data-class-roster-status="${id}"]`);
      const lower = (file.name || '').toLowerCase();
      const isCsvLike = lower.endsWith('.csv') || lower.endsWith('.txt') || (file.type || '').startsWith('text/');

      if (status) status.textContent = 'Reading file…';
      try {
        let roster = [];
        if (isCsvLike) {
          // CSV/TXT: parse client-side
          const text = await file.text();
          roster = parseRosterCSV(text);
        } else {
          // PDF / DOCX: upload to server for parsing
          if (status) status.textContent = 'Uploading and parsing…';
          const fd = new FormData();
          fd.append('file', file);
          const res = await fetch('/api/classes/parse-roster', { method: 'POST', body: fd });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'Parse failed');
          roster = Array.isArray(data.roster) ? data.roster : [];
        }

        if (!roster.length) {
          if (status) status.textContent = '⚠ No valid email rows found in this file. Make sure each student row contains an email address.';
          input.value = '';
          return;
        }
        // Preview: show first 3 names so the teacher can sanity-check what was extracted.
        const preview = roster.slice(0, 3).map((s) => s.name ? `${s.name} <${s.email}>` : s.email).join('\n');
        const more = roster.length > 3 ? `\n…and ${roster.length - 3} more` : '';
        if (!confirm(
          `Import ${roster.length} student${roster.length === 1 ? '' : 's'} into "${classes.find((c) => c.id === id).name}"?\n\n` +
          `Preview:\n${preview}${more}\n\nThis will replace any existing roster for this class.`
        )) {
          input.value = '';
          if (status) status.textContent = '';
          return;
        }
        if (status) status.textContent = 'Saving…';
        const result = await api(`/api/classes/${id}/roster`, { method: 'POST', body: { roster } });
        await loadClasses();
        renderClassesList();
        const newStatus = els.classesList.querySelector(`[data-class-roster-status="${id}"]`);
        if (newStatus) {
          newStatus.textContent = `✓ Saved ${result.count} student${result.count === 1 ? '' : 's'}.`;
          setTimeout(() => { newStatus.textContent = ''; }, 3000);
        }
      } catch (err) {
        if (status) status.textContent = 'Error: ' + err.message;
      }
    };
  });

  // Manual roster reconciliation — scan results.json and add any student
  // who has submitted to an assessment in this class but isn't on the roster.
  els.classesList.querySelectorAll('[data-class-reconcile]').forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.classReconcile;
      const status = els.classesList.querySelector(`[data-class-roster-status="${id}"]`);
      if (status) { status.textContent = 'Scanning results...'; status.style.color = ''; }
      btn.disabled = true;
      try {
        const resp = await api(`/api/classes/${id}/reconcile-roster`, { method: 'POST' });
        const n = (resp && resp.added && resp.added.length) || 0;
        if (status) {
          if (n === 0) {
            status.innerHTML = '✓ Roster is already complete - nothing to add.';
            status.style.color = '#166534';
          } else {
            const names = resp.added.map((s) => `<strong>${escapeHtml(s.name || s.email)}</strong>`).slice(0, 6).join(', ');
            const more = n > 6 ? ` + ${n - 6} more` : '';
            status.innerHTML = `✓ Added ${n} student${n === 1 ? '' : 's'} to the roster: ${names}${more}.`;
            status.style.color = '#166534';
          }
        }
        await loadClasses();
        renderClassesList();
      } catch (e) {
        if (status) { status.textContent = '\u274c ' + e.message; status.style.color = '#b91c1c'; }
      } finally {
        btn.disabled = false;
      }
    };
  });

  els.classesList.querySelectorAll('[data-class-view-roster]').forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.classViewRoster;
      const cls = classes.find((c) => c.id === id);
      const view = els.classesList.querySelector(`[data-class-roster-view="${id}"]`);
      if (!cls || !view) return;
      if (view.style.display === 'block') { view.style.display = 'none'; return; }
      view.style.display = 'block';
      view.innerHTML = `
        <table style="width:100%; font-size: 13px; border-collapse: collapse;">
          <thead>
            <tr style="background: #eef2ff;">
              <th style="text-align:left; padding: 8px; width: 28px;">
                <input type="checkbox" data-bulk-select-all="${id}" title="Select all" />
              </th>
              <th style="text-align:left; padding: 8px;">Name</th>
              <th style="text-align:left; padding: 8px;">Email</th>
              <th style="text-align:left; padding: 8px;">Status</th>
              <th style="text-align:right; padding: 8px;"></th>
            </tr>
          </thead>
          <tbody>
            ${(cls.roster || []).map((s) => {
              const matched = findStudentForRoster(s);
              const statusBadge = matched
                ? `<span class="badge green">${matched.submissions} submission${matched.submissions === 1 ? '' : 's'}</span>`
                : `<span class="badge" style="background:#fef3c7; color:#92400e;">Pending</span>`;
              // matched.studentId is set when this roster row already has an
              // account in users.json. We can only delete when there is a
              // backing account.
              const deleteBtn = matched
                ? `<button class="btn danger" data-roster-delete="${matched.studentId}" data-roster-name="${escapeAttr(s.name || s.email || '')}" style="margin-left: 6px;">Delete</button>`
                : '';
              const editBtn = s.email
                ? `<button class="btn" data-roster-edit-email="${escapeAttr(s.email)}" data-class-id="${id}" style="margin-left: 6px;">Edit</button>`
                : '';
              const moveBtn = s.email
                ? `<button class="btn" data-roster-move-email="${escapeAttr(s.email)}" data-class-id="${id}" style="margin-left: 6px;">Move/Copy</button>`
                : '';
              const actions = matched
                ? `<button class="btn primary" data-roster-progress="${matched.studentId}">View progress</button>` + editBtn + moveBtn + deleteBtn
                : `<span class="muted" style="font-size: 12px;">No assessments yet</span>` + editBtn + moveBtn + (s.email
                    ? ` <button class="btn danger" data-roster-delete-email="${escapeAttr(s.email)}" data-class-id="${id}" data-roster-name="${escapeAttr(s.name || s.email || '')}">Remove</button>`
                    : '');
              const cb = s.email
                ? `<input type="checkbox" data-bulk-row="${escapeAttr(s.email)}" data-class-id="${id}" />`
                : '<span class="muted">—</span>';
              return `
                <tr style="border-top: 1px solid #e5e7eb;">
                  <td style="padding: 8px;">${cb}</td>
                  <td style="padding: 8px;"><strong>${escapeHtml(s.name || '(no name)')}</strong></td>
                  <td style="padding: 8px;">${s.email ? escapeHtml(s.email) : `<span class="muted" style="font-size: 12px;">—</span>`}</td>
                  <td style="padding: 8px;">${statusBadge}</td>
                  <td style="padding: 8px; text-align: right;">${actions}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
      // Inject the floating bulk-action bar (hidden until any row is checked).
      const barId = 'bulk-bar-' + id;
      view.insertAdjacentHTML('beforeend', `
        <div id="${barId}" data-bulk-bar="${id}" style="display:none; position: sticky; bottom: 8px; margin-top: 12px; background: #1a1e33; color: #fff; border: 2px solid #c69214; border-radius: 10px; padding: 10px 14px; box-shadow: 0 6px 20px rgba(0,0,0,0.25);">
          <div class="row" style="gap: 8px; flex-wrap: wrap; align-items: center;">
            <strong data-bulk-count="${id}" style="color: #c69214;">0 selected</strong>
            <div class="spacer"></div>
            <select data-bulk-target="${id}" style="background:#0f1322; color:#fff; border:1px solid #2b3152; padding: 6px 10px; border-radius: 6px;"></select>
            <button class="btn primary" data-bulk-action="${id}" data-mode="move">Move selected</button>
            <button class="btn" data-bulk-action="${id}" data-mode="copy" style="background:#1f2746; color:#fff; border-color:#2b3152;">Copy selected</button>
            <button class="btn danger" data-bulk-action="${id}" data-mode="delete">Delete selected</button>
            <button class="btn ghost" data-bulk-action="${id}" data-mode="clear" style="color:#cbd5e1; background:transparent;">Clear</button>
          </div>
          <div data-bulk-status="${id}" class="muted" style="font-size: 12px; margin-top: 6px; color:#cbd5e1;"></div>
        </div>
      `);

      const bulkBar = view.querySelector(`[data-bulk-bar="${id}"]`);
      const bulkCount = view.querySelector(`[data-bulk-count="${id}"]`);
      const bulkTarget = view.querySelector(`[data-bulk-target="${id}"]`);
      const bulkStatus = view.querySelector(`[data-bulk-status="${id}"]`);
      // Populate the target-class dropdown with the teacher's OTHER classes.
      const otherClasses = classes.filter((c) => c.id !== id);
      bulkTarget.innerHTML = otherClasses.length
        ? otherClasses.map((c) => `<option value="${escapeAttr(c.id)}">${escapeHtml(c.name)} (${(c.roster || []).length} students)</option>`).join('')
        : `<option value="">No other classes — create one first</option>`;

      function selectedEmails() {
        return Array.from(view.querySelectorAll(`[data-bulk-row][data-class-id="${id}"]:checked`))
          .map((el) => el.dataset.bulkRow);
      }
      function refreshBulkBar() {
        const n = selectedEmails().length;
        bulkBar.style.display = n > 0 ? 'block' : 'none';
        bulkCount.textContent = `${n} selected`;
      }
      // Wire each row checkbox.
      view.querySelectorAll(`[data-bulk-row][data-class-id="${id}"]`).forEach((cb) => {
        cb.onchange = refreshBulkBar;
      });
      // Wire the "select all" header checkbox.
      const allCb = view.querySelector(`[data-bulk-select-all="${id}"]`);
      if (allCb) {
        allCb.onchange = () => {
          view.querySelectorAll(`[data-bulk-row][data-class-id="${id}"]`).forEach((cb) => {
            cb.checked = allCb.checked;
          });
          refreshBulkBar();
        };
      }
      // Wire the action buttons.
      view.querySelectorAll(`[data-bulk-action="${id}"]`).forEach((btn) => {
        btn.onclick = async () => {
          const mode = btn.dataset.mode;
          if (mode === 'clear') {
            view.querySelectorAll(`[data-bulk-row][data-class-id="${id}"]`).forEach((cb) => { cb.checked = false; });
            if (allCb) allCb.checked = false;
            refreshBulkBar();
            return;
          }
          const emails = selectedEmails();
          if (emails.length === 0) return;
          const n = emails.length;
          if (mode === 'delete') {
            if (!confirm(`Delete ${n} student account${n === 1 ? '' : 's'}?\n\nThis permanently removes their accounts, all submitted results, and removes them from every class roster. The emails will be freed for re-use.`)) return;
            bulkStatus.textContent = `Deleting ${n} students...`;
            try {
              const resp = await api(`/api/classes/${id}/bulk-delete`, { method: 'POST', body: { emails } });
              await loadKnownStudents();
              await loadClasses();
              const trigger = els.classesList.querySelector(`[data-class-view-roster="${id}"]`);
              if (trigger) {
                view.style.display = 'none';
                trigger.click();
              }
              els.classesStatus.innerHTML = `✓ Deleted ${resp.removedUsers || 0} student account${(resp.removedUsers || 0) === 1 ? '' : 's'}.`;
              els.classesStatus.style.color = '#166534';
              setTimeout(() => { els.classesStatus.textContent = ''; els.classesStatus.style.color = ''; }, 4000);
            } catch (e) {
              bulkStatus.textContent = '❌ ' + e.message;
            }
            return;
          }
          // move or copy
          const targetId = bulkTarget.value;
          if (!targetId) { bulkStatus.textContent = '⚠ Create another class first.'; return; }
          const verb = mode === 'move' ? 'Move' : 'Copy';
          if (!confirm(`${verb} ${n} student${n === 1 ? '' : 's'} to the target class?`)) return;
          bulkStatus.textContent = `${verb}ing ${n}...`;
          try {
            const resp = await api(`/api/classes/${id}/bulk-transfer`, {
              method: 'POST',
              body: { targetClassId: targetId, mode, emails },
            });
            await loadClasses();
            const trigger = els.classesList.querySelector(`[data-class-view-roster="${id}"]`);
            if (trigger) {
              view.style.display = 'none';
              trigger.click();
            }
            const added = (resp.outcomes || []).filter((o) => o.addedToTarget).length;
            const skipped = (resp.outcomes || []).filter((o) => o.alreadyInTarget).length;
            const target = classes.find((c) => c.id === targetId);
            const targetName = target ? target.name : 'target class';
            els.classesStatus.innerHTML = `✓ ${verb}d ${added} to ${escapeHtml(targetName)}` + (skipped > 0 ? ` (${skipped} were already there)` : '') + '.';
            els.classesStatus.style.color = '#166534';
            setTimeout(() => { els.classesStatus.textContent = ''; els.classesStatus.style.color = ''; }, 4000);
          } catch (e) {
            bulkStatus.textContent = '❌ ' + e.message;
          }
        };
      });

      view.querySelectorAll('[data-roster-progress]').forEach((b) => {
        b.onclick = () => {
          closeClassesPanel();
          openStudentProgress(b.dataset.rosterProgress);
        };
      });
      // Delete a student account (the student has an account record).
      view.querySelectorAll('[data-roster-delete]').forEach((b) => {
        b.onclick = async () => {
          const studentId = b.dataset.rosterDelete;
          const name = b.dataset.rosterName || 'this student';
          if (!confirm(
            `Delete the student account for "${name}"?\n\n` +
            `This permanently removes the account, all their submitted results, and removes them from every class roster.\n\n` +
            `You can re-add them afterwards with the +Add student form — a new temporary password will be generated.`
          )) return;
          b.disabled = true;
          try {
            const resp = await api(`/api/students/${studentId}`, { method: 'DELETE' });
            await loadKnownStudents();
            await loadClasses();
            // Re-render the View students table so the row disappears.
            const id = btn.dataset.classViewRoster;
            const trigger = els.classesList.querySelector(`[data-class-view-roster="${id}"]`);
            if (trigger) {
              const view2 = els.classesList.querySelector(`[data-class-roster-view="${id}"]`);
              if (view2) view2.style.display = 'none';
              trigger.click(); // re-open with fresh data
            }
          } catch (e) {
            alert('Could not delete: ' + e.message);
            b.disabled = false;
          }
        };
      });
      // Edit a roster row in place. Replaces the row with an inline blue
      // editor (Name, Email, Student #) with Save / Cancel buttons. Calls
      // the PUT endpoint which also updates the backing user account when
      // one exists at the old email.
      view.querySelectorAll('[data-roster-edit-email]').forEach((b) => {
        b.onclick = () => {
          const oldEmail = b.dataset.rosterEditEmail;
          const classId = b.dataset.classId;
          const cls = classes.find((c) => c.id === classId);
          const row = cls && (cls.roster || []).find((r) =>
            String(r && r.email || '').toLowerCase() === oldEmail.toLowerCase()
          );
          if (!row) return;

          // Find the <tr> containing this Edit button and replace its
          // contents with a single full-width cell holding the editor.
          const tr = b.closest('tr');
          if (!tr) return;
          const colCount = tr.children.length || 4;
          const editorId = 'edit-form-' + Math.random().toString(36).slice(2, 8);
          const safeName = escapeAttr(row.name || '');
          const safeEmail = escapeAttr(row.email || '');
          const safeNum = escapeAttr(row.studentNumber || '');
          const original = tr.innerHTML;
          tr.innerHTML = `
            <td colspan="${colCount}" style="padding: 0;">
              <div id="${editorId}" style="background:#eff6ff; border:2px solid #93c5fd; border-radius:8px; padding: 14px 16px; margin: 6px 0;">
                <div style="font-weight: 600; color:#1e3a8a; margin-bottom: 8px;">Edit student — leave a field unchanged to keep the current value.</div>
                <div class="row" style="gap: 8px; flex-wrap: wrap; margin-bottom: 8px;">
                  <div class="field" style="flex: 1; min-width: 200px;">
                    <label style="font-size: 12px;">Full name</label>
                    <input type="text" data-ef="name" value="${safeName}" />
                  </div>
                  <div class="field" style="flex: 1; min-width: 240px;">
                    <label style="font-size: 12px;">Email address</label>
                    <input type="email" data-ef="email" value="${safeEmail}" />
                  </div>
                  <div class="field" style="flex: 0 0 140px;">
                    <label style="font-size: 12px;">Student # (optional)</label>
                    <input type="text" data-ef="num" value="${safeNum}" />
                  </div>
                </div>
                <div class="row" style="gap: 8px;">
                  <button class="btn primary" data-act="ef-save">Save</button>
                  <button class="btn" data-act="ef-cancel">Cancel</button>
                  <div class="spacer"></div>
                  <span data-act="ef-status" class="muted" style="font-size: 12px;"></span>
                </div>
              </div>
            </td>
          `;
          const form = document.getElementById(editorId);
          const nameEl = form.querySelector('[data-ef=name]');
          const emailEl = form.querySelector('[data-ef=email]');
          const numEl = form.querySelector('[data-ef=num]');
          const status = form.querySelector('[data-act=ef-status]');
          nameEl.focus();

          form.querySelector('[data-act=ef-cancel]').onclick = () => {
            tr.innerHTML = original;
            // Re-wire the original buttons inside the restored row by
            // re-triggering the View students re-render.
            const trigger = els.classesList.querySelector(`[data-class-view-roster="${classId}"]`);
            if (trigger) {
              const v2 = els.classesList.querySelector(`[data-class-roster-view="${classId}"]`);
              if (v2) v2.style.display = 'none';
              trigger.click();
            }
          };

          form.querySelector('[data-act=ef-save]').onclick = async () => {
            const newName = (nameEl.value || '').trim();
            const newEmail = (emailEl.value || '').trim().toLowerCase();
            const newNum = (numEl.value || '').trim();
            if (!newEmail || !newEmail.includes('@')) {
              status.textContent = '⚠ Enter a valid email address.';
              status.style.color = '#b91c1c';
              emailEl.focus();
              return;
            }
            status.textContent = 'Saving...';
            status.style.color = '';
            try {
              await api(`/api/classes/${classId}/roster/${encodeURIComponent(oldEmail)}`, {
                method: 'PUT',
                body: { name: newName, newEmail: newEmail, studentNumber: newNum },
              });
              await loadKnownStudents();
              await loadClasses();
              const trigger = els.classesList.querySelector(`[data-class-view-roster="${classId}"]`);
              if (trigger) {
                const v2 = els.classesList.querySelector(`[data-class-roster-view="${classId}"]`);
                if (v2) v2.style.display = 'none';
                trigger.click();
              }
            } catch (e) {
              status.textContent = '❌ ' + e.message;
              status.style.color = '#b91c1c';
            }
          };
        };
      });

      // Move or copy a student to another class. Replaces the row with an
      // inline form: dropdown of OTHER classes + Move / Copy / Cancel
      // buttons. Calls /transfer with mode=move|copy.
      view.querySelectorAll('[data-roster-move-email]').forEach((b) => {
        b.onclick = () => {
          const oldEmail = b.dataset.rosterMoveEmail;
          const classId = b.dataset.classId;
          const otherClasses = classes.filter((c) => c.id !== classId);
          if (otherClasses.length === 0) {
            alert('You only have one class. Create another class first, then come back here.');
            return;
          }
          const tr = b.closest('tr');
          if (!tr) return;
          const colCount = tr.children.length || 4;
          const formId = 'mv-form-' + Math.random().toString(36).slice(2, 8);
          const original = tr.innerHTML;
          const opts = otherClasses.map((c) =>
            `<option value="${escapeAttr(c.id)}">${escapeHtml(c.name)} (${(c.roster || []).length} students)</option>`
          ).join('');
          tr.innerHTML = `
            <td colspan="${colCount}" style="padding: 0;">
              <div id="${formId}" style="background:#eff6ff; border:2px solid #93c5fd; border-radius:8px; padding: 14px 16px; margin: 6px 0;">
                <div style="font-weight: 600; color:#1e3a8a; margin-bottom: 8px;">
                  Move or copy <strong>${escapeHtml(oldEmail)}</strong> to another class
                </div>
                <div class="row" style="gap: 8px; flex-wrap: wrap; margin-bottom: 8px; align-items: end;">
                  <div class="field" style="flex: 1; min-width: 220px;">
                    <label style="font-size: 12px;">Target class</label>
                    <select data-mvf="target">${opts}</select>
                  </div>
                </div>
                <div class="row" style="gap: 8px;">
                  <button class="btn primary" data-act="mv-move">Move (remove from this class)</button>
                  <button class="btn" data-act="mv-copy">Copy (keep on both)</button>
                  <button class="btn ghost" data-act="mv-cancel">Cancel</button>
                  <div class="spacer"></div>
                  <span data-act="mv-status" class="muted" style="font-size: 12px;"></span>
                </div>
              </div>
            </td>
          `;
          const form = document.getElementById(formId);
          const sel = form.querySelector('[data-mvf=target]');
          const status = form.querySelector('[data-act=mv-status]');

          form.querySelector('[data-act=mv-cancel]').onclick = () => {
            tr.innerHTML = original;
            const trigger = els.classesList.querySelector(`[data-class-view-roster="${classId}"]`);
            if (trigger) {
              const v2 = els.classesList.querySelector(`[data-class-roster-view="${classId}"]`);
              if (v2) v2.style.display = 'none';
              trigger.click();
            }
          };

          async function run(mode) {
            const targetId = sel.value;
            if (!targetId) return;
            status.textContent = mode === 'move' ? 'Moving...' : 'Copying...';
            status.style.color = '';
            form.querySelectorAll('button').forEach((bn) => { bn.disabled = true; });
            try {
              const resp = await api(`/api/classes/${classId}/roster/${encodeURIComponent(oldEmail)}/transfer`, {
                method: 'POST',
                body: { targetClassId: targetId, mode },
              });
              await loadClasses();
              const trigger = els.classesList.querySelector(`[data-class-view-roster="${classId}"]`);
              if (trigger) {
                const v2 = els.classesList.querySelector(`[data-class-roster-view="${classId}"]`);
                if (v2) v2.style.display = 'none';
                trigger.click();
              }
              // Toast on the classesStatus line so the teacher sees what happened.
              const target = classes.find((c) => c.id === targetId);
              const targetName = target ? target.name : 'the target class';
              const verb = mode === 'move' ? 'Moved' : 'Copied';
              const where = resp.alreadyInTarget
                ? `was already on ${targetName} — no change in target`
                : `added to ${targetName}`;
              els.classesStatus.innerHTML = `✓ ${verb}: ${escapeHtml(oldEmail)} — ${where}.`;
              els.classesStatus.style.color = '#166534';
              setTimeout(() => { els.classesStatus.textContent = ''; els.classesStatus.style.color = ''; }, 5000);
            } catch (e) {
              status.textContent = '❌ ' + e.message;
              status.style.color = '#b91c1c';
              form.querySelectorAll('button').forEach((bn) => { bn.disabled = false; });
            }
          }
          form.querySelector('[data-act=mv-move]').onclick = () => run('move');
          form.querySelector('[data-act=mv-copy]').onclick = () => run('copy');
        };
      });

      // Remove a roster entry that has no backing account (just clean up).
      // We do this by replacing the class's roster minus that email.
      view.querySelectorAll('[data-roster-delete-email]').forEach((b) => {
        b.onclick = async () => {
          const email = b.dataset.rosterDeleteEmail;
          const classId = b.dataset.classId;
          const name = b.dataset.rosterName || email;
          if (!confirm(`Remove "${name}" from this class? They never created an account, so this only removes the roster entry.`)) return;
          const target = classes.find((c) => c.id === classId);
          if (!target) return;
          const newRoster = (target.roster || []).filter((r) =>
            String(r && r.email || '').toLowerCase() !== email.toLowerCase()
          );
          b.disabled = true;
          try {
            await api(`/api/classes/${classId}/roster`, { method: 'POST', body: { roster: newRoster } });
            await loadClasses();
            const trigger = els.classesList.querySelector(`[data-class-view-roster="${classId}"]`);
            if (trigger) {
              const view2 = els.classesList.querySelector(`[data-class-roster-view="${classId}"]`);
              if (view2) view2.style.display = 'none';
              trigger.click();
            }
          } catch (e) {
            alert('Could not remove: ' + e.message);
            b.disabled = false;
          }
        };
      });
    };
  });
}
if (els.manageClassesBtn) els.manageClassesBtn.onclick = openClassesPanel;
// Class Analytics — fetch + render the per-class report view.
const _claBtn = document.getElementById('class-analytics-btn');
if (_claBtn) _claBtn.onclick = openClassAnalytics;

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

// ──────────────────────────────────────────────────────────────────────────
//  Grading-framework helpers (subject-aware).
//  - Languages -> CEFR A1-C2
//  - Math / Science -> PISA Level 1-6
//  - Everything else -> Low/Medium/High only
// ──────────────────────────────────────────────────────────────────────────
const LANGUAGE_SUBJECTS = new Set([
  'english', 'arabic', 'french', 'spanish', 'german', 'italian',
  'portuguese', 'hindi', 'urdu', 'mandarin', 'japanese', 'korean', 'russian',
  'turkish', 'language', 'languages',
]);
const PISA_SUBJECTS = new Set([
  'math', 'mathematics', 'maths', 'science', 'physics', 'chemistry',
  'biology', 'general science', 'integrated science', 'earth science',
]);
function frameworkForSubject(subject) {
  const s = String(subject || '').trim().toLowerCase();
  if (!s) return 'band';
  if (LANGUAGE_SUBJECTS.has(s)) return 'cefr';
  if (PISA_SUBJECTS.has(s)) return 'pisa';
  // Heuristic catch-all: any subject that mentions a language family or the
  // word "language" → cefr; any with "math" or "science" → pisa.
  if (/\b(english|arabic|french|spanish|german|italian|portuguese|hindi|urdu|mandarin|japanese|korean|russian|turkish|language)\b/i.test(s)) return 'cefr';
  if (/\b(math|science|physics|chemistry|biology)\b/i.test(s)) return 'pisa';
  return 'band';
}
function cefrFor(pct) {
  if (pct >= 90) return 'C2';
  if (pct >= 75) return 'C1';
  if (pct >= 60) return 'B2';
  if (pct >= 45) return 'B1';
  if (pct >= 30) return 'A2';
  return 'A1';
}
function pisaFor(pct) {
  // Mirrors CEFR's 6-band split on a Level 1-6 scale.
  if (pct >= 90) return '6';
  if (pct >= 75) return '5';
  if (pct >= 60) return '4';
  if (pct >= 45) return '3';
  if (pct >= 30) return '2';
  return '1';
}
function bandFor(pct) {
  // Low / Medium / High aligned to the 6-band split:
  //   bottom two bands -> Low, middle two -> Medium, top two -> High.
  if (pct >= 75) return 'High';
  if (pct >= 45) return 'Medium';
  return 'Low';
}
function bandStyle(band) {
  if (band === 'High')   return { color: '#166534', bg: '#dcfce7' };
  if (band === 'Medium') return { color: '#92400e', bg: '#fef3c7' };
  return                       { color: '#b91c1c', bg: '#fee2e2' };
}

// Subject templates. Most are "blurb-only" and just pre-set the subject +
// suggest question types — teachers add their own questions.
//
// Templates can also carry an optional `seed` block that pre-populates the
// builder with sections + starter questions + rubric. Used by the English
// Reading Comprehension and Essay Writing templates so teachers can drop in
// their text and questions without having to set up the section structure
// from scratch.
const SUBJECT_TEMPLATES = [
  { id: 'math', subject: 'Math', icon: '🔢',
    blurb: 'Multiple choice, short answer, and long answer for problem-solving steps.' },
  { id: 'physics', subject: 'Physics', icon: '⚛️',
    blurb: 'MCQs for concepts, long answers for derivations, short answers for unit-conversion.' },
  { id: 'chemistry', subject: 'Chemistry', icon: '🧪',
    blurb: 'MCQs for periodic-table facts, short answers for balanced equations, long answers for mechanisms.' },
  { id: 'biology', subject: 'Biology', icon: '🧬',
    blurb: 'MCQs, True/False/Not Given on diagrams, long answers on processes (photosynthesis, respiration).' },
  { id: 'ai-technology', subject: 'AI & Technology', icon: '🤖',
    blurb: 'MCQs on AI concepts and e-safety, short answers on code output and algorithms, practical design questions.' },
  { id: 'business-studies', subject: 'Business Studies', icon: '💼',
    blurb: 'MCQs on key terms, short answers, data/chart questions and case-study “recommend & justify” answers.' },
  { id: 'health', subject: 'Health Science', icon: '🩺',
    blurb: 'Mix of MCQs, True/False, and short essays on case studies and ethics.' },
  { id: 'islamic', subject: 'Islamic Studies', icon: '☪️',
    blurb: 'Short answers on key terms, long answers on hadith / surah interpretation, essays on ethics.' },
  { id: 'social', subject: 'Social Studies', icon: '🌍',
    blurb: 'MCQs on dates and figures, True/False/Not Given on source extracts, essays on causation.' },
  { id: 'arabic', subject: 'Arabic', icon: '🇦🇪',
    blurb: 'Reading comprehension passages, short answers for grammar, essay (auto-graded) for composition.' },
  { id: 'french', subject: 'French', icon: '🇫🇷',
    blurb: 'MCQs for vocabulary, short answers for translation, essay for composition (auto-graded with rubric).' },

  // English Reading Comprehension — pre-seeded with the centralised exam
  // structure: Part 1 Vocabulary, Part 2 Grammar, Part 3A/3B/3C Reading
  // (working toward / at / beyond grade level).
  { id: 'english-reading', subject: 'English',
    icon: '📖',
    name: 'English — Reading Comprehension',
    blurb: 'Centralised 5-part paper: Vocabulary, Grammar, and three Reading sections (toward / at / beyond grade level).',
    seed: {
      title: 'English Reading Comprehension',
      description: 'Centralised reading-comprehension assessment with vocabulary, grammar, and three reading sections.',
      sections: [
        { title: 'Part 1: Vocabulary',
          instructions: 'Choose the correct word to complete each sentence. Working toward Grade Level Goal.',
          passage: '' },
        { title: 'Part 2: Grammar',
          instructions: 'Choose the correct option for each sentence. Working at Grade Level Goal.',
          passage: '' },
        { title: 'Part 3A: Reading',
          instructions: 'Read the passage and answer the questions. Working toward Grade Level Goal.',
          passage: '' },
        { title: 'Part 3B: Reading',
          instructions: 'Read the passage and answer the questions. Working at Grade Level Goal.',
          passage: '' },
        { title: 'Part 3C: Reading',
          instructions: 'Read the passage and answer the questions. Working beyond Grade Level Goal.',
          passage: '' },
      ],
      // Starter questions — teacher overwrites the prompts with their own.
      questions: [
        { sectionIdx: 0, type: 'mc',    prompt: '', options: ['', '', '', ''], correctAnswer: 0, points: 1 },
        { sectionIdx: 0, type: 'mc',    prompt: '', options: ['', '', '', ''], correctAnswer: 0, points: 1 },
        { sectionIdx: 1, type: 'mc',    prompt: '', options: ['', '', '', ''], correctAnswer: 0, points: 1 },
        { sectionIdx: 1, type: 'mc',    prompt: '', options: ['', '', '', ''], correctAnswer: 0, points: 1 },
        { sectionIdx: 2, type: 'mc',    prompt: '', options: ['', '', '', ''], correctAnswer: 0, points: 1 },
        { sectionIdx: 2, type: 'short', prompt: '', correctAnswer: '', points: 2 },
        { sectionIdx: 3, type: 'mc',    prompt: '', options: ['', '', '', ''], correctAnswer: 0, points: 1 },
        { sectionIdx: 3, type: 'short', prompt: '', correctAnswer: '', points: 2 },
        { sectionIdx: 4, type: 'tfng',  prompt: '', correctAnswer: 'true', points: 1 },
        { sectionIdx: 4, type: 'long',  prompt: '', points: 5 },
      ],
    },
  },

  // Essay Writing — single-section template with one auto-graded essay slot.
  { id: 'essay-writing', subject: 'English',
    icon: '✍️',
    name: 'Essay Writing',
    blurb: 'Single-section writing paper with one auto-graded essay (Stage 8 rubric by default — switch in the builder if you need 7, 3-5, or 5-9).',
    seed: {
      title: 'Essay Writing',
      description: 'A single essay-writing task graded against the chosen rubric.',
      rubricStage: '8',
      sections: [
        { title: 'Essay',
          instructions: 'Write your essay on the topic below. You may plan on a separate sheet. Spelling, grammar, and structure all count.',
          passage: '' },
      ],
      questions: [
        // points stays at 12 to match the Stage 8 default; openBuilder
        // overrides it from rubricStage when the writing question is created.
        { sectionIdx: 0, type: 'writing', prompt: '', points: 12 },
      ],
    },
  },
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

// =============================================================================
//  UI translation — full dashboard translator (like Google Translate)
// =============================================================================
// User picks a language from the small ui-lang dropdown in the topbar; we walk
// the visible DOM, extract every text label, send it to /api/translate-ui (which
// uses Claude + a server-side cache), then write the translations back into the
// DOM. Re-runs whenever new content is rendered (via MutationObserver).

const UI_LANG_KEY = 'classcurio.uiLang';
function getUiLang() { return localStorage.getItem(UI_LANG_KEY) || ''; }
function setUiLang(v) {
  if (v) localStorage.setItem(UI_LANG_KEY, v);
  else localStorage.removeItem(UI_LANG_KEY);
}

// Per-session cache of original-text → translated-text, keyed by language.
// Bigger than the server cache because we may serve the same string many times
// across re-renders.
const uiTranslateClient = new Map();
function uiCacheGet(lang, s) {
  return uiTranslateClient.get(`${lang}::${s}`);
}
function uiCacheSet(lang, s, t) {
  uiTranslateClient.set(`${lang}::${s}`, t);
}

// Tags whose text content we DO want to translate.
const TRANSLATE_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'button', 'label', 'option', 'optgroup', 'a', 'p', 'li', 'th', 'td',
  'strong', 'em', 'span', 'div', 'small', 'figcaption', 'summary',
]);
// Skip these completely (too dynamic, user data, or technical).
const SKIP_SELECTORS = [
  '[data-no-translate]',
  '[data-no-translate="1"]',
  '#ui-lang',
  '#who',
  '#queue-count',
  '#class-count',
  '#save-status',
  '#settings-status',
  '#classes-status',
  '#import-status',
  '#camera-gate-status',
  '#essay-queue-view',
  '#review-body',
  '#progress-body',
  '#progress-title',
  // NOTE: we used to skip #assessments and .card-title because those carry
  // teacher-typed titles. The teacher specifically asked for the WHOLE page
  // to translate, so those are now in scope. Student names/emails stay
  // protected via #students-list and the [data-no-translate] hook.
  '#students-list',
  'input', 'textarea', 'code', 'pre', 'script', 'style',
  '[contenteditable="true"]',
];
function shouldSkip(el) {
  if (!el) return true;
  if (el.nodeType !== Node.ELEMENT_NODE && el.nodeType !== Node.TEXT_NODE) return true;
  const target = el.nodeType === Node.TEXT_NODE ? el.parentElement : el;
  if (!target) return true;
  for (const sel of SKIP_SELECTORS) {
    if (target.closest(sel)) return true;
  }
  return false;
}
// Reasonable check — is this string worth translating?
function looksTranslatable(s) {
  const t = (s || '').trim();
  if (!t || t.length < 2) return false;
  // Pure number / percent / date / time / email / url
  if (/^\d+([.,]\d+)?(%|px|s)?$/.test(t)) return false;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return false;
  if (/^[\d:]+$/.test(t)) return false;
  if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(t)) return false;
  if (/^https?:\/\//.test(t)) return false;
  // Pure punctuation
  if (/^[\W_]+$/.test(t)) return false;
  return true;
}

// Tag a text node so we don't re-translate it on the next pass.
function markTranslated(node, original, translation) {
  try {
    node._ccOrig = original;
    node._ccLang = currentUiLang;
    node.nodeValue = translation;
  } catch {}
}

let currentUiLang = '';
let translateBusy = false;
let pendingRetranslate = false;

async function translateAllVisible() {
  if (!currentUiLang) {
    // Reset to English: restore any already-translated text node to its original.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      if (n._ccOrig && n.nodeValue !== n._ccOrig) {
        n.nodeValue = n._ccOrig;
        n._ccLang = '';
      }
    }
    return;
  }
  if (translateBusy) { pendingRetranslate = true; return; }
  translateBusy = true;
  try {
    // Walk all text nodes. Collect those that need translating (different lang
    // than current target, parent not skipped, text is non-trivial).
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    const strings = [];
    let n;
    while ((n = walker.nextNode())) {
      if (shouldSkip(n)) continue;
      const orig = n._ccOrig || n.nodeValue;
      if (!looksTranslatable(orig)) continue;
      // Already translated to current lang? Skip.
      if (n._ccLang === currentUiLang && n._ccOrig) continue;
      // Cache hit?
      const cached = uiCacheGet(currentUiLang, orig);
      if (cached) {
        markTranslated(n, orig, cached);
        continue;
      }
      nodes.push(n);
      strings.push(orig);
    }
    if (!strings.length) return;

    // Batch in chunks of 60 strings to keep request bodies reasonable.
    const CHUNK = 60;
    for (let i = 0; i < strings.length; i += CHUNK) {
      const slice = strings.slice(i, i + CHUNK);
      const sliceNodes = nodes.slice(i, i + CHUNK);
      try {
        const res = await fetch('/api/translate-ui', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetLang: currentUiLang, strings: slice }),
        });
        const data = await res.json().catch(() => ({}));
        if (!data.ok || !Array.isArray(data.translations)) continue;
        for (let j = 0; j < sliceNodes.length; j++) {
          const orig = slice[j];
          const translated = data.translations[j];
          if (typeof translated === 'string' && translated && translated !== orig) {
            uiCacheSet(currentUiLang, orig, translated);
            markTranslated(sliceNodes[j], orig, translated);
          }
        }
      } catch (e) {
        console.warn('translate-ui chunk failed', e);
      }
    }
  } finally {
    translateBusy = false;
    if (pendingRetranslate) {
      pendingRetranslate = false;
      setTimeout(() => translateAllVisible(), 50);
    }
  }
}

// Throttled watcher for new content rendered into the DOM (e.g. when
// loadAssessments() re-renders the cards).
let translateThrottleId = null;
function scheduleTranslate() {
  if (!currentUiLang) return;
  if (translateThrottleId) return;
  translateThrottleId = setTimeout(() => {
    translateThrottleId = null;
    translateAllVisible();
  }, 250);
}
const uiObserver = new MutationObserver((muts) => {
  if (!currentUiLang) return;
  // Only schedule if a mutation actually adds new visible content.
  for (const m of muts) {
    if (m.addedNodes && m.addedNodes.length) { scheduleTranslate(); return; }
    if (m.type === 'characterData') { scheduleTranslate(); return; }
  }
});
function startUiObserver() {
  try {
    uiObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
  } catch {}
}

// Default to list-only on page load. Editor views (#builder-view, etc.)
// have style="display:none" in the HTML; cc-list-only adds an !important
// override so even a re-show via inline JS can't override unless an
// open*() function explicitly removes the class.
document.body.classList.add('cc-list-only');

// Diagnostic + cleanup for ?just_saved=1 — confirms the save flow ran.
try {
  if (window.location.search.includes('just_saved=1')) {
    console.log('[ClassCurio] Page reloaded after save. Builder is hidden.');
    // Clean URL — strip the query string after we've handled it.
    history.replaceState({}, '', window.location.pathname);
  }
} catch {}

if (els.uiLang) {
  els.uiLang.value = getUiLang();
  currentUiLang = els.uiLang.value;
  els.uiLang.onchange = async () => {
    currentUiLang = els.uiLang.value;
    setUiLang(currentUiLang);
    await translateAllVisible();
  };
  // Apply on first load if a language was previously chosen.
  if (currentUiLang) {
    document.addEventListener('DOMContentLoaded', () => translateAllVisible());
    setTimeout(() => translateAllVisible(), 600);
  }
  startUiObserver();
}

let currentResultsAssessmentId = null;

let editingId = null;
    if (window.__syncAudioPanelForEdit) window.__syncAudioPanelForEdit(null);
    if (els.audioScript) els.audioScript.value = '';
let questions = [];
let sections = [];   // [{id, title, instructions, passage, order}]

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


// Sends a long AI request as a background job and polls for the result, so
// slow generations are never cut off by the network ("Failed to fetch").
// Returns { ok, status, data } like a normal fetch + json.
async function ccFetchJob(url, body, onTick) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let res;
  for (let attempt = 0; ; attempt++) {
    try { res = await fetch(url, { method: 'POST', body, headers: { 'X-CC-Async': '1' }, credentials: 'include' }); break; }
    catch (e) {
      if (attempt >= 2) throw new Error('Could not reach the server — check the internet connection and try again.');
      await sleep(2000 * (attempt + 1));
    }
  }
  let data = await res.json().catch(() => ({}));
  if (res.status !== 202 || !data.jobId) return { ok: res.ok, status: res.status, data };
  const started = Date.now(); let fails = 0;
  while (Date.now() - started < 10 * 60 * 1000) {
    await sleep(3000);
    try {
      const r = await fetch('/api/jobs/' + encodeURIComponent(data.jobId), { credentials: 'include' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw Object.assign(new Error(j.error || ('HTTP ' + r.status)), { hard: r.status === 404 || r.status === 403 });
      fails = 0;
      if (typeof onTick === 'function') onTick(j.seconds || Math.round((Date.now() - started) / 1000));
      if (j.state === 'done') { const st = j.status || 200; return { ok: st < 400, status: st, data: j.result || {} }; }
    } catch (e) {
      if (e.hard) throw e;
      if (++fails > 20) throw new Error('Lost connection to the server while waiting — please try again.');
    }
  }
  throw new Error('This is taking too long — please try again with fewer questions or smaller files.');
}

async function runImport(file) {
  els.importStatus.innerHTML = `<em>Parsing ${escapeHtml(file.name)}…</em>`;
  const fd = new FormData();
  fd.append('file', file);
  try {
    const _job = await ccFetchJob('/api/import', fd, (sec) => { els.importStatus.innerHTML = `<em>Parsing ${escapeHtml(file.name)}… (${sec}s)</em>`; });
    const res = { ok: _job.ok, status: _job.status };
    const data = _job.data || {};
    if (!res.ok) {
      els.importStatus.innerHTML =
        `<span style="color:#d63939;">${escapeHtml(data.error || 'Import failed')}</span>` +
        (data.rawTextPreview ? `<pre style="margin-top:8px; font-size:11px; text-align:left; white-space:pre-wrap;">${escapeHtml(data.rawTextPreview)}</pre>` : '');
      return;
    }
    // Pre-populate the builder with the parsed draft.
    //
    // The server returns either:
    //   • { sections: [...], questions: [...], passage } — Claude-parsed,
    //     preserves multi-passage / multi-part papers verbatim. Each question
    //     already carries a sectionId pointing to one of the returned sections.
    //   • { questions: [...], passage } — legacy regex fallback (single
    //     section). Stamp every question with the default section's id.
    els.importPanel.style.display = 'none';
    openBuilder(null);
    els.title.value = data.title || `Imported — ${file.name}`;
    els.description.value = `Imported from ${file.name} on ${new Date().toLocaleDateString()}. Review each question and mark correct answers before publishing.`;
    // Top-level legacy passage textarea is cleared — passages now live on
    // the section objects so the student renderer can show each passage with
    // its own section without any duplication.
    if (els.passage) els.passage.value = '';

    if (Array.isArray(data.sections) && data.sections.length) {
      // Claude path. Quick Import is meant to feel like Microsoft Forms — a
      // flat list of questions with the reading passage(s) above. We KEEP
      // each section's passage (because that's how the multi-passage data
      // model groups passages with their questions) but DROP the section
      // title and instructions so the orange "Section N" wrapper UI never
      // shows up. Teachers can still add real sections later via "+ Section".
      const idMap = new Map();
      sections = data.sections.map((s, i) => {
        const newId = uid();
        idMap.set(s.id || `__idx${i}`, newId);
        return {
          id: newId,
          title: '',
          instructions: '',
          passage: String(s.passage || ''),
          order: i,
        };
      });
      questions = data.questions.map((q) => {
        const newSid = idMap.get(q.sectionId) || sections[0].id;
        return { ...q, id: uid(), sectionId: newSid };
      });
      // Keep imported pictures, but shrink very large ones so saving works.
      await Promise.all(questions.map(async (q) => {
        if (q.imageUrl) q.imageUrl = await ccShrinkDataUrl(q.imageUrl);
        if (Array.isArray(q.pairs)) {
          for (const p of q.pairs) if (p.rightImageUrl) p.rightImageUrl = await ccShrinkDataUrl(p.rightImageUrl);
        }
      }));
      const _imgCount = questions.filter((q) => q.imageUrl).length;
      if (_imgCount && els.importStatus) {
        els.importStatus.insertAdjacentHTML('beforeend', `<div style="color:#059669; margin-top:4px;">🖼 ${_imgCount} picture${_imgCount === 1 ? '' : 's'} from the file attached to ${_imgCount === 1 ? 'its question' : 'their questions'} — please check each one.</div>`);
      }
    } else {
      // Regex fallback path — single section.
      if (!sections.length) {
        sections = [{ id: uid(), title: '', instructions: '', passage: '', order: 0 }];
      }
      if (data.passage) {
        sections[0].passage = data.passage;
      }
      const importSectionId = sections[0].id;
      questions = data.questions.map((q) => ({
        ...q,
        id: uid(),
        sectionId: importSectionId,
      }));
    }

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
        a.deliveryMode === 'onsite' ? '🏫 On-site' : '🌐 Online',
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
          <div style="flex:1; min-width: 0;">
            <div class="card-title">${escapeHtml(a.title)}
              <span class="badge ${a.published ? 'green' : ''}">${a.published ? 'Published' : 'Draft'}</span>
              ${a.shuffle === true ? '<span class="badge" style="background:#ede9fe; color:#5b21b6;" title="Every student gets a different order of questions and answer options">🔀 Shuffled for each student</span>' : ''}
            </div>
            <div class="muted">${meta}</div>
          </div>
        </div>
        <div class="card-actions" style="display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; margin-top: 10px;">
          ${a.published ? `<button class="btn primary" data-act="share" data-id="${a.id}" title="Copy the link your students will use to take this assessment">🔗 Share with students</button>` : ''}
          <button class="btn" data-act="results" data-id="${a.id}">Results</button>
          <button class="btn cc-admin-only" data-cc-spec="${a.id}" title="Admin: download the specification table (جدول المواصفات) as Excel">📋 Spec table</button>
          <button class="btn" data-act="print" data-id="${a.id}" title="Print or save as PDF">📄 PDF</button>
          <button class="btn" data-act="share-teacher" data-id="${a.id}" title="Copy a link another teacher can use to preview, print, or duplicate this assessment">🤝 Share with teacher</button>
          <button class="btn" data-act="preview" data-id="${a.id}" title="See the assessment exactly as a student would">👁 Preview</button>
          ${a.shuffle === true ? `<button class="btn" data-cc-shuffle-sample="${a.id}" title="See an example of how one student's shuffled paper looks">🔀 Example student version</button>` : ''}
          <button class="btn" data-act="move" data-id="${a.id}" title="Move this assessment to another folder or class">📂 Move</button>
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
  if (act === 'move') {
    showMoveAssessmentModal(id);
    return;
  }
    if (act === 'preview') {
    // Inline modal — sidesteps browser popup blockers entirely. The
    // preview page is rendered inside an iframe.
    if (document.getElementById('cc-prev-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'cc-prev-overlay';
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(11,16,32,0.65); z-index:2147483647; display:flex; flex-direction:column; padding:14px;';
    overlay.innerHTML = '' +
      '<div style="display:flex; gap:10px; align-items:center; color:#fff; margin-bottom:10px;">' +
        '<strong style="flex:1;">👁 Preview as student</strong>' +
        '<a class="btn" href="/preview.html?id=' + id + '" target="_blank" style="background:rgba(255,255,255,0.18); color:#fff; border:1px solid rgba(255,255,255,0.4);">Open in new tab ↗</a>' +
        '<button class="btn" id="cc-prev-close" style="background:#dc2626; color:#fff; border:1px solid #fecaca;">✕ Close</button>' +
      '</div>' +
      '<iframe src="/preview.html?id=' + id + '" style="flex:1; width:100%; border:0; border-radius:12px; background:#fff;"></iframe>';
    document.body.appendChild(overlay);
    document.getElementById('cc-prev-close').onclick = () => overlay.remove();
    return;
  }
  if (act === 'print') { return showExportChooser(id); }
  if (act === 'share-teacher') { return shareAssessment(id); }

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
  document.body.classList.remove('cc-builder-open');
  document.body.classList.add('cc-list-only');
  els.listView.style.display = 'block';
  loadAssessments();
};

// ----- Template picker -----
function openTemplatePicker() {
  document.body.classList.remove('cc-list-only');
  document.body.classList.remove('cc-builder-open');
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
      <div style="font-weight: 600; font-size: 15px;">${(t.name || t.subject || '').replace(/[<>&]/g, '')}</div>
      <div class="muted" style="font-size: 12px;">${(t.blurb || '').replace(/[<>&]/g, '')}</div>
    </button>
  `).join('');
  els.templateGrid.querySelectorAll('[data-tmpl-id]').forEach((btn) => {
    btn.onclick = () => {
      const tmpl = SUBJECT_TEMPLATES.find((x) => x.id === btn.dataset.tmplId);
      closeTemplatePicker();
      // Pass the whole template so openBuilder can apply any `seed` block.
      openBuilder(null, {
        subject: tmpl ? tmpl.subject : '',
        seed: tmpl && tmpl.seed ? tmpl.seed : null,
      });
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

// ----- AI assessment generator -----
// Teacher fills in prompt + optional scheme of work (up to 20 files,
// including PDFs, Word docs, and SCREENSHOTS). We POST a multipart form to
// /api/assessments/ai-generate and Claude returns a structured assessment.
// The builder opens with the questions pre-filled — teacher reviews and
// edits before saving.

// Live count + name list under the file input.
if (els.aiSowFile) {
  els.aiSowFile.onchange = () => {
    if (!els.aiSowFilesList) return;
    const list = Array.from(els.aiSowFile.files || []);
    if (!list.length) { els.aiSowFilesList.innerHTML = ''; return; }
    const tooMany = list.length > 20;
    const tooBig = list.find((f) => f.type.startsWith('image/') && f.size > 4 * 1024 * 1024);
    const summary = `${list.length} file${list.length === 1 ? '' : 's'} selected${tooMany ? ' — over the 20-file limit!' : ''}`;
    const names = list.map((f) => `<li style="margin: 0; padding: 0;">${(f.name || '').replace(/[<>&]/g, '')} <span style="opacity:0.7;">(${Math.round(f.size/1024)} KB)</span></li>`).join('');
    const warn = tooBig
      ? `<div style="color: #b91c1c; margin-top: 4px;">⚠ "${tooBig.name}" is over 4 MB — image will be skipped. Compress and re-upload.</div>`
      : '';
    els.aiSowFilesList.innerHTML = `
      <div style="margin-top: 4px; font-weight: 600;">${summary}</div>
      <ul style="margin: 4px 0 0 16px; padding: 0;">${names}</ul>
      ${warn}
    `;
  };
}

if (els.aiGenerateBtn) {
  els.aiGenerateBtn.onclick = async () => {
    const prompt = (els.aiPrompt.value || '').trim();
    const fileList = (els.aiSowFile && els.aiSowFile.files) ? Array.from(els.aiSowFile.files) : [];
    const subject = els.aiSubject ? els.aiSubject.value : '';
    if (!subject) {
      els.aiStatus.textContent = '⚠ Choose your subject first — the AI uses it to tailor question style and graphics.';
      return;
    }
    if (!prompt && fileList.length === 0) {
      els.aiStatus.textContent = '⚠ Tell the AI what to generate, or upload a scheme of work — at least one is required.';
      return;
    }
    if (fileList.length > 20) {
      els.aiStatus.textContent = '⚠ You selected more than 20 files. Keep it to 20 or fewer.';
      return;
    }
    const count = Math.max(1, Math.min(50, parseInt(els.aiCount.value, 10) || 10));
    const wantGraphics = els.aiWantGraphics ? els.aiWantGraphics.checked : true;
    const language = (els.aiLanguage && els.aiLanguage.value) || 'English';

    els.aiGenerateBtn.disabled = true;
    els.aiGenerateBtn.style.opacity = '0.6';
    const langLabel = language === 'English' ? '' : ` in ${language}`;
    const fcount = fileList.length;
    const startMsg = fcount > 0
      ? `🧠 Reading ${fcount} file${fcount === 1 ? '' : 's'} and generating ${subject} assessment${langLabel}… this can take 30-90 seconds.`
      : `🧠 Generating ${subject} assessment${langLabel}… this can take 15-30 seconds.`;
    els.aiStatus.textContent = startMsg;

    try {
      const fd = new FormData();
      fd.append('prompt', prompt);
      fd.append('count', String(count));
      fd.append('subject', subject);
      fd.append('language', language);
      fd.append('wantGraphics', wantGraphics ? '1' : '0');
      try { const _cur = ccCurriculumSelection(); if (_cur) fd.append('curriculum', JSON.stringify(_cur)); } catch (e) {}
      try { const _wd = (document.getElementById('ai-week-date') || {}).value; if (_wd) fd.append('weekDate', _wd); } catch (e) {}
      // Multipart standard: same field name repeated for each file. Multer
      // collects them as req.files = [...] on the server.
      for (const f of fileList) fd.append('schemeOfWork', f);

      const _job = await ccFetchJob('/api/assessments/ai-generate', fd, (sec) => { els.aiStatus.textContent = startMsg + `  (${sec}s)`; });
      const res = { ok: _job.ok, status: _job.status };
      const data = _job.data || {};
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Generation failed');
      }

      // Open the builder with the AI-generated content. We construct a
      // fake "assessment" object whose questions match what openBuilder
      // expects, and pass it through. Teacher then edits + saves.
      // Carry the section ids the server generated. Questions reference
      // them by id, so we must use the SAME ids in the builder.
      const aiSections = Array.isArray(data.sections) && data.sections.length
        ? data.sections.map((s) => ({
            id: s.id,
            title: String(s.title || ''),
            instructions: String(s.instructions || ''),
            passage: String(s.passage || ''),
            order: s.order || 0,
          }))
        : [{ id: uid(), title: '', instructions: '', passage: data.passage || '', order: 0 }];
      const defaultSecId = aiSections[0].id;
      const fake = {
        title: data.title || 'AI-generated assessment',
        description: data.description || '',
        passage: data.passage || '',
        subject,
        assessmentLanguage: language,
        sections: aiSections,
        questions: (data.questions || []).map((q) => ({
          id: uid(),
          type: q.type,
          prompt: q.prompt,
          options: q.options || [],
          correctAnswer: q.correctAnswer ?? null,
          points: q.points || 1,
          sectionId: q.sectionId || defaultSecId,
          imageUrl: '',
          imageDescription: q.imageDescription || '',
          skill: q.skill || '',
          explanation: q.explanation || '',
        })),
      };
      // Keep the class / grade / term chosen in the curriculum picker on the new assessment.
      try {
        const _c = ccCurriculumSelection();
        if (_c) { if (_c.classId) fake.classId = _c.classId; fake.grade = _c.grade; fake.term = _c.term; }
      } catch (e) {}
      // Build a friendly status that mentions how many files Claude actually
      // used and whether any were skipped (too big, unsupported type, etc.).
      const fp = data.filesProcessed || { text: 0, images: 0, skipped: [] };
      const usedParts = [];
      if (fp.text)   usedParts.push(`${fp.text} document${fp.text === 1 ? '' : 's'}`);
      if (fp.images) usedParts.push(`${fp.images} screenshot${fp.images === 1 ? '' : 's'}`);
      const used = usedParts.length ? ` (used ${usedParts.join(' + ')})` : '';
      const skipped = (fp.skipped && fp.skipped.length)
        ? ` · ⚠ skipped: ${fp.skipped.join('; ')}`
        : '';
      els.aiStatus.textContent = `✓ Generated ${fake.questions.length} questions${used}${skipped}. Opening builder…`;
      // Reset form for next time
      setTimeout(() => {
        els.aiPrompt.value = '';
        if (els.aiSowFile) els.aiSowFile.value = '';
        if (els.aiSowFilesList) els.aiSowFilesList.innerHTML = '';
        els.aiStatus.textContent = '';
        els.aiGenerateBtn.disabled = false;
        els.aiGenerateBtn.style.opacity = '1';
        // Open builder with fields pre-filled. We pass null (new assessment)
        // and use the fake object's data after the builder opens.
        closeTemplatePicker();
        openBuilder(null, { subject: fake.subject });
        // Now overwrite the just-cleared builder fields with our AI content.
        if (els.title) els.title.value = fake.title;
        if (els.description) els.description.value = fake.description;
        if (els.passage) els.passage.value = fake.passage;
        if (els.subject && fake.subject) els.subject.value = fake.subject;
        if (fake.classId && els.builderClass && Array.from(els.builderClass.options).some((o) => o.value === fake.classId)) els.builderClass.value = fake.classId;
        if (fake.grade && els.grade) els.grade.value = fake.grade;
        if (fake.term && els.term) els.term.value = fake.term;
        try { const _wd = (document.getElementById('ai-week-date') || {}).value; if (_wd && els.scheduledDate && !els.scheduledDate.value) { els.scheduledDate.value = _wd; ccDiffBanner(); } } catch (e) {}
        // Pre-fill the assessment language so students see the correct
        // "Please answer in: …" banner. The dropdown values match what the
        // AI panel uses (free-text language names).
        if (els.assessmentLanguage && fake.assessmentLanguage) {
          els.assessmentLanguage.value = fake.assessmentLanguage;
        }
        sections = fake.sections;
        questions = fake.questions;
        // Listening: surface AI-generated audioScript in the builder.
        if (els.audioScript) els.audioScript.value = (data.audioScript || '');
        currentAudioVoices = {};                // re-detect from scratch
        renderSpeakersPanel(data.audioScript || '');
        renderQuestions();
        if (data.audioScript && els.audioTtsStatus) {
          els.audioTtsStatus.textContent = 'AI wrote a listening script — pick a voice for each speaker, then Save the assessment.';
        }
      }, 600);
    } catch (e) {
      els.aiStatus.textContent = '❌ ' + (e.message || 'Generation failed');
      els.aiGenerateBtn.disabled = false;
      els.aiGenerateBtn.style.opacity = '1';
    }
  };
}

function openBuilder(a, presets) {
  document.body.classList.remove('cc-list-only');
  document.body.classList.add('cc-builder-open');
  els.listView.style.display = 'none';
  els.resultsView.style.display = 'none';
  closeTemplatePicker();
  els.builderView.style.display = 'block';
  editingId = a ? a.id : null;
  const seed = (!a && presets && presets.seed) ? presets.seed : null;
  els.builderTitle.textContent = a ? 'Edit assessment' : 'New assessment';
  els.title.value = a ? a.title : (seed && seed.title) || '';
  els.description.value = a ? a.description : (seed && seed.description) || '';
  if (els.passage) els.passage.value = a && a.passage ? a.passage : '';
  if (els.rubricStage) els.rubricStage.value = a && a.rubricStage
    ? a.rubricStage
    : (seed && seed.rubricStage) || '';
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
  if (els.deliveryMode) {
    // Default to 'online' for new assessments; keep whatever was saved on
    // existing ones (treats anything other than 'onsite' as 'online').
    els.deliveryMode.value = a && a.deliveryMode === 'onsite' ? 'onsite' : 'online';
  }
  if (els.skill) els.skill.value = (a && a.skill) || '';
  { const sh = document.getElementById('shuffle-toggle'); if (sh) sh.checked = a ? a.shuffle === true : true; if (typeof ccShuffleStatusUpdate === 'function') ccShuffleStatusUpdate(); }
  if (typeof _ccApplyConditionalPanels === 'function') _ccApplyConditionalPanels();
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

  // Load questions + sections. Priority:
  //   1. Editing an existing assessment → use saved data.
  //   2. New from template with seed → expand the seed into real sections/questions.
  //   3. Otherwise → empty assessment with one default section.
  if (a) {
    questions = JSON.parse(JSON.stringify(a.questions));
    sections = Array.isArray(a.sections) && a.sections.length
      ? JSON.parse(JSON.stringify(a.sections))
      : [{ id: uid(), title: '', instructions: '', passage: a.passage ? a.passage : '', order: 0 }];
  } else if (seed) {
    // Expand seed.sections (no ids yet) into real sections with ids, then
    // map seed.questions[].sectionIdx → the new section id.
    const seedSections = Array.isArray(seed.sections) && seed.sections.length
      ? seed.sections
      : [{ title: '', instructions: '', passage: '' }];
    sections = seedSections.map((s, i) => ({
      id: uid(),
      title: String(s.title || ''),
      instructions: String(s.instructions || ''),
      passage: String(s.passage || ''),
      order: i,
    }));
    const seedQuestions = Array.isArray(seed.questions) ? seed.questions : [];
    questions = seedQuestions.map((q) => {
      const sidx = Number.isFinite(q.sectionIdx) && q.sectionIdx >= 0 && q.sectionIdx < sections.length
        ? q.sectionIdx
        : 0;
      const out = {
        id: uid(),
        type: q.type || 'short',
        prompt: String(q.prompt || ''),
        options: Array.isArray(q.options) ? q.options.slice() : [],
        correctAnswer: q.correctAnswer,
        points: Number.isFinite(q.points) ? q.points : 1,
        sectionId: sections[sidx].id,
      };
      // For writing questions, sync points with the seed's rubricStage so the
      // marks add up correctly (Stage 7-8 = 12, Stage 3-5 / 5-9 = 40).
      if (out.type === 'writing') {
        const rs = seed.rubricStage || '';
        if (rs === '3-5' || rs === '5-9') out.points = 40;
        else out.points = 12;
      }
      return out;
    });
  } else {
    questions = [];
    sections = [{ id: uid(), title: '', instructions: '', passage: '', order: 0 }];
  }

  // Map any orphaned questions to the first section so they render.
  const sIds = new Set(sections.map((s) => s.id));
  for (const q of questions) {
    if (!sIds.has(q.sectionId)) q.sectionId = sections[0].id;
  }
  renderQuestions();
  // Listening: hydrate the audio script + per-speaker voices for this assessment.
  try {
    if (els.audioScript) els.audioScript.value = (a && a.audioScript) || '';
    currentAudioVoices = (a && a.audioVoices && typeof a.audioVoices === 'object') ? { ...a.audioVoices } : {};
    if (typeof renderSpeakersPanel === 'function') renderSpeakersPanel();
    if (els.audioTtsStatus) els.audioTtsStatus.textContent = '';
  } catch {}
}

document.querySelectorAll('button[data-add]').forEach((b) => {
  b.onclick = () => {
    const type = b.dataset.add;
    // Seed match defaults.
    let matchSeed = null;
    if (type === 'match') {
      matchSeed = {
        matchVariant: 'word-definition',
        pairs: [{ left: '', right: '', rightImageUrl: '' },
                { left: '', right: '', rightImageUrl: '' },
                { left: '', right: '', rightImageUrl: '' },
                { left: '', right: '', rightImageUrl: '' }],
      };
    }
    // Ensure at least one section exists.
    if (!sections.length) {
      sections.push({ id: uid(), title: '', instructions: '', passage: '', order: 0 });
    }
    // New question goes into the LAST section by default (most recent).
    const lastSection = sections[sections.length - 1];
    const q = { id: uid(), type, prompt: '', points: 1, sectionId: lastSection.id };
    if (type === 'mc') { q.options = ['', '']; q.correctAnswer = 0; }
    if (type === 'tf') { q.correctAnswer = true; }
    if (type === 'tfng') { q.correctAnswer = 'true'; }
    if (type === 'short') { q.correctAnswer = ''; }
    if (matchSeed) Object.assign(q, matchSeed);
    if (type === 'long') { q.points = 5; }
    if (type === 'essay') { q.points = 5; }
    if (type === 'writing') {
      const stage = els.rubricStage ? els.rubricStage.value : '';
      q.points = (stage === '3-5' || stage === '5-9') ? 40 : 12;
    }
    questions.push(q);
    renderQuestions();
  };
});

// Add a "+ Section" button programmatically — appended next to the existing
// question-add buttons. Lets teachers create Section A/B/C structure.
(function attachAddSectionButton() {
  const addButtonsRow = document.querySelector('button[data-add]');
  if (!addButtonsRow || !addButtonsRow.parentElement) return;
  const row = addButtonsRow.parentElement;
  // Avoid duplicating if hot-reloaded.
  if (row.querySelector('[data-act="add-section"]')) return;
  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.setAttribute('data-act', 'add-section');
  btn.textContent = '➕ Section';
  btn.style.background = '#eef2ff';
  btn.style.borderColor = '#c7d2fe';
  btn.style.color = '#312e81';
  btn.onclick = () => {
    const order = sections.length;
    sections.push({
      id: uid(),
      title: `Section ${String.fromCharCode(65 + order)}`,
      instructions: '',
      passage: '',
      order,
    });
    renderQuestions();
  };
  // Insert at the very start of the row.
  row.insertBefore(btn, row.firstChild);
})();

// Section panel HTML: editable title/instructions/passage with Move
// up/down and Remove buttons, plus a section-id->name dropdown on each
// question so teachers can reassign questions between sections.
function renderSectionPanel(s, sidx) {
  return `
    <div class="panel" data-section="${s.id}" style="background: #fff7ed; border: 2px solid #fdba74; padding: 14px 16px;">
      <div class="row" style="margin-bottom: 8px;">
        <strong style="color: #9a3412;">Section ${sidx + 1}</strong>
        <div class="spacer"></div>
        <button class="btn ghost" data-act="sec-up" data-sid="${s.id}">↑</button>
        <button class="btn ghost" data-act="sec-down" data-sid="${s.id}">↓</button>
        <button class="btn danger" data-act="sec-remove" data-sid="${s.id}">Remove section</button>
      </div>
      <div class="field" style="margin-bottom: 8px;">
        <label>Section title</label>
        <input type="text" data-sf="title" data-sid="${s.id}" value="${escapeAttr(s.title || '')}" placeholder="e.g. Section A: Reading Comprehension" />
      </div>
      <div class="field" style="margin-bottom: 8px;">
        <label>Instructions (shown to students above the questions)</label>
        <textarea data-sf="instructions" data-sid="${s.id}" rows="2" placeholder="e.g. Read the passage carefully and answer questions 1-5.">${escapeHtml(s.instructions || '')}</textarea>
      </div>
      <div class="field" style="margin-bottom: 0;">
        <label>Reading passage / source text (optional — shown before this section's questions)</label>
        <textarea data-sf="passage" data-sid="${s.id}" rows="6" placeholder="Paste a reading passage, source text, story, poem, or case study here.">${escapeHtml(s.passage || '')}</textarea>
      </div>
    </div>
  `;
}

function renderQuestions() {
  // Ensure at least one section exists.
  if (!sections.length) {
    sections = [{ id: uid(), title: '', instructions: '', passage: '', order: 0 }];
  }
  // The orange Section panel is only useful when the teacher is intentionally
  // building a multi-part paper. For Quick Import, AI generate, and the plain
  // "blank assessment" flow we hide the panel completely — the assessment
  // shows up as a flat list of questions (like Microsoft Forms), with each
  // reading passage rendered as a slim editor above its own block of
  // questions. The teacher can still create real sections later by clicking
  // the ➕ Section button (which adds a section with a title like "Section A").
  //
  // Collapse rule: EVERY section in the current draft has no title and no
  // instructions. Holds for any count of sections — multi-passage Quick
  // Imports stay collapsed too.
  const isCollapsedMode = sections.every((s) => !s.title && !s.instructions);
  function maybeSectionPanel(s, sidx) {
    if (isCollapsedMode) {
      if (!s.passage) return '';
      return `
        <div class="panel" data-section="${s.id}" style="background: #fff7ed; border: 2px solid #fdba74; padding: 14px 16px;">
          <div class="field" style="margin-bottom: 0;">
            <label>Reading passage / source text (optional — shown above the questions in this group)</label>
            <textarea data-sf="passage" data-sid="${s.id}" rows="6" placeholder="Paste a reading passage, source text, story, poem, or case study here.">${escapeHtml(s.passage || '')}</textarea>
          </div>
        </div>
      `;
    }
    return renderSectionPanel(s, sidx);
  }

  if (!questions.length && sections.every((s) => !s.title && !s.instructions && !s.passage)) {
    // First-load empty state — render hint only (no section header).
    els.questions.innerHTML = maybeSectionPanel(sections[0], 0)
      + `<div class="muted" style="margin: 10px 0 0;">Add a question using the buttons above, or click ➕ Section to start a new part.</div>`;
    wireSectionHandlers();
    return;
  }

  // Build interleaved HTML: section panel → its questions → next section → its questions...
  let html = '';
  let qIdx = 0;
  for (let si = 0; si < sections.length; si++) {
    const s = sections[si];
    html += maybeSectionPanel(s, si);
    const inSection = questions.map((q, i) => ({ q, i })).filter((p) => p.q.sectionId === s.id);
    for (const { q } of inSection) {
      html += renderQuestion(q, qIdx);
      qIdx++;
    }
  }
  els.questions.innerHTML = html;

  // Wire section + question handlers.
  wireSectionHandlers();

  // Wire question handlers (use the global index that matches qIdx ordering).
  // Build a flat array in render-order so up/down still work correctly.
  const flat = [];
  for (const s of sections) {
    for (const q of questions) if (q.sectionId === s.id) flat.push(q);
  }
  flat.forEach((q, idx) => {
    const root = document.getElementById(`q-${q.id}`);
    if (!root) return;
    root.querySelector('[data-f=prompt]').oninput = (e) => { q.prompt = e.target.value; };

    // ── Maths preview, paste-a-screenshot, tidy, clear ──────────────────
    {
      const promptEl = root.querySelector('[data-f=prompt]');
      const statusEl = root.querySelector('[data-shot-status]');
      const setStatus = (msg, isErr) => {
        if (!statusEl) return;
        statusEl.style.display = msg ? 'block' : 'none';
        statusEl.style.color = isErr ? '#b91c1c' : '#4338ca';
        statusEl.textContent = msg || '';
      };
      let pvTimer = null;
      root.addEventListener('input', () => { clearTimeout(pvTimer); pvTimer = setTimeout(() => ccRefreshMathPreview(root, q), 350); });
      ccRefreshMathPreview(root, q);
      const runImage = async (dataUrl) => {
        setStatus('🔍 Reading the screenshot and building the question…');
        promptEl.disabled = true;
        try {
          const ai = await ccQuestionFromContent({ image: dataUrl });
          await ccApplyAiQuestion(q, ai, dataUrl);
          renderQuestions();
        } catch (err) {
          promptEl.disabled = false;
          setStatus('Could not read that screenshot: ' + (err.message || err), true);
        }
      };
      const fromFile = async (file) => {
        try { await runImage(await ccFileToDataUrl(file, 1600)); } catch (err) { setStatus(err.message || String(err), true); }
      };
      promptEl.addEventListener('paste', (e) => {
        const items = e.clipboardData && e.clipboardData.items ? Array.from(e.clipboardData.items) : [];
        const imgItem = items.find((it) => it.kind === 'file' && /^image\//.test(it.type));
        if (!imgItem) return;                       // ordinary text paste
        e.preventDefault();
        const file = imgItem.getAsFile();
        if (file) fromFile(file);
      });
      promptEl.addEventListener('dragover', (e) => {
        if (e.dataTransfer && Array.from(e.dataTransfer.items || []).some((it) => it.kind === 'file')) e.preventDefault();
      });
      promptEl.addEventListener('drop', (e) => {
        const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (!file || !/^image\//.test(file.type)) return;
        e.preventDefault();
        fromFile(file);
      });
      const shotBtn = root.querySelector('[data-act=shot-upload]');
      const shotFile = root.querySelector('[data-shot-file]');
      if (shotBtn && shotFile) {
        shotBtn.onclick = () => shotFile.click();
        shotFile.onchange = (e) => { const f = e.target.files && e.target.files[0]; if (f) fromFile(f); };
      }
      const tidyBtn = root.querySelector('[data-act=ai-tidy]');
      if (tidyBtn) tidyBtn.onclick = async () => {
        const text = [q.prompt || ''].concat(q.type === 'mc' ? (q.options || []).filter(Boolean).map((o, i) => String.fromCharCode(65 + i) + ') ' + o) : []).join('\n').trim();
        if (!text) { setStatus('Type or paste a question first.', true); return; }
        setStatus('✨ Tidying the question and formatting the maths…');
        tidyBtn.disabled = true;
        try {
          const ai = await ccQuestionFromContent({ text });
          await ccApplyAiQuestion(q, ai, null);
          renderQuestions();
        } catch (err) {
          tidyBtn.disabled = false;
          setStatus('Could not tidy it: ' + (err.message || err), true);
        }
      };
      const clearBtn = root.querySelector('[data-act=clear]');
      if (clearBtn) clearBtn.onclick = () => {
        if ((q.prompt || '').trim() && !confirm('Clear this question so you can type or paste a new one?')) return;
        q.prompt = ''; q.imageUrl = ''; q.imageDescription = ''; q._aiCheck = false;
        if (q.type === 'mc') { q.options = ['', '', '', '']; q.correctAnswer = 0; }
        else if (q.type === 'short') q.correctAnswer = '';
        else if (q.type === 'match') q.pairs = [{ left: '', right: '', rightImageUrl: '' }];
        renderQuestions();
        setTimeout(() => { const el = document.querySelector('#q-' + q.id + ' [data-f=prompt]'); if (el) el.focus(); }, 50);
      };
    }
    root.querySelector('[data-f=points]').oninput = (e) => { q.points = Number(e.target.value) || 1; };
    { const sk = root.querySelector('[data-f=skill]'); if (sk) sk.oninput = (e) => { q.skill = e.target.value; }; }
    { const ex = root.querySelector('[data-f=explanation]'); if (ex) ex.oninput = (e) => { q.explanation = e.target.value; }; }
    root.querySelector('[data-act=remove]').onclick = () => {
      const ix = questions.indexOf(q);
      if (ix >= 0) questions.splice(ix, 1);
      renderQuestions();
    };
    root.querySelector('[data-act=up]').onclick = () => {
      // Swap with previous question that's in the same section.
      const here = questions.indexOf(q);
      const prevSame = (() => {
        for (let i = here - 1; i >= 0; i--) if (questions[i].sectionId === q.sectionId) return i;
        return -1;
      })();
      if (prevSame >= 0) {
        [questions[prevSame], questions[here]] = [questions[here], questions[prevSame]];
        renderQuestions();
      }
    };
    root.querySelector('[data-act=down]').onclick = () => {
      const here = questions.indexOf(q);
      const nextSame = (() => {
        for (let i = here + 1; i < questions.length; i++) if (questions[i].sectionId === q.sectionId) return i;
        return -1;
      })();
      if (nextSame >= 0) {
        [questions[nextSame], questions[here]] = [questions[here], questions[nextSame]];
        renderQuestions();
      }
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

    // ----- Image actions (manual upload / AI suggestion fulfilment) -----
    const imgFileInput = root.querySelector('[data-img-file]');
    const triggerUpload = () => imgFileInput && imgFileInput.click();
    const uploadBtn = root.querySelector('[data-act=img-upload]');
    const replaceBtn = root.querySelector('[data-act=img-replace]');
    const removeBtn = root.querySelector('[data-act=img-remove]');
    const skipBtn = root.querySelector('[data-act=img-skip]');
    if (uploadBtn) uploadBtn.onclick = triggerUpload;
    if (replaceBtn) replaceBtn.onclick = triggerUpload;
    if (removeBtn) removeBtn.onclick = () => {
      q.imageUrl = '';
      // Keep imageDescription so AI suggestion remains visible if applicable.
      renderQuestions();
    };
    if (skipBtn) skipBtn.onclick = () => {
      q.imageDescription = '';
      renderQuestions();
    };
    const aiImgBtn = root.querySelector('[data-act=img-ai]');
    if (aiImgBtn) aiImgBtn.onclick = async () => {
      if (!String(q.prompt || '').trim() && !String(q.imageDescription || '').trim()) {
        alert('Write the question first, then generate the diagram.');
        return;
      }
      const label = aiImgBtn.textContent;
      aiImgBtn.disabled = true;
      aiImgBtn.textContent = '✨ Drawing…';
      try {
        q.imageUrl = await ccGenerateDiagramImage(q, (msg) => { aiImgBtn.textContent = msg; });
        q.imageDescription = '';
        renderQuestions();
      } catch (err) {
        alert('Could not generate the diagram: ' + (err.message || err));
        aiImgBtn.disabled = false;
        aiImgBtn.textContent = label;
      }
    };
    if (imgFileInput) imgFileInput.onchange = async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (file.size > 8 * 1024 * 1024) {
        alert('Image is too large (over 8 MB). Please pick a smaller file.');
        return;
      }
      try {
        const dataUrl = await compressImageToDataUrl(file, 800);
        q.imageUrl = dataUrl;
        // Once they upload, the AI suggestion is fulfilled; clear it so the
        // teacher only sees the actual image preview.
        q.imageDescription = '';
        renderQuestions();
      } catch (err) {
        alert('Could not read that image: ' + err.message);
      }
    };
  });
}

// Wire up the section panels: title/instructions/passage edits, move
// up/down, and remove (which cascades — questions in that section move to
// the previous section, or get a new default if it was the last one).
function wireSectionHandlers() {
  document.querySelectorAll('[data-sf]').forEach((el) => {
    const sid = el.getAttribute('data-sid');
    const field = el.getAttribute('data-sf');
    const sec = sections.find((s) => s.id === sid);
    if (!sec) return;
    el.oninput = (e) => { sec[field] = e.target.value; };
  });
  document.querySelectorAll('[data-act=sec-up]').forEach((b) => {
    b.onclick = () => {
      const sid = b.getAttribute('data-sid');
      const i = sections.findIndex((s) => s.id === sid);
      if (i > 0) {
        [sections[i - 1], sections[i]] = [sections[i], sections[i - 1]];
        renderQuestions();
      }
    };
  });
  document.querySelectorAll('[data-act=sec-down]').forEach((b) => {
    b.onclick = () => {
      const sid = b.getAttribute('data-sid');
      const i = sections.findIndex((s) => s.id === sid);
      if (i >= 0 && i < sections.length - 1) {
        [sections[i + 1], sections[i]] = [sections[i], sections[i + 1]];
        renderQuestions();
      }
    };
  });
  document.querySelectorAll('[data-act=sec-remove]').forEach((b) => {
    b.onclick = () => {
      const sid = b.getAttribute('data-sid');
      const sec = sections.find((s) => s.id === sid);
      const hasQs = questions.some((q) => q.sectionId === sid);
      if (!sec) return;
      if (hasQs && !confirm(`Remove this section? Its questions will be moved to the previous section.`)) return;
      const i = sections.findIndex((s) => s.id === sid);
      sections.splice(i, 1);
      // If no sections remain, create a fresh default and reassign questions.
      if (!sections.length) {
        sections.push({ id: uid(), title: '', instructions: '', passage: '', order: 0 });
      }
      const targetId = (sections[Math.max(0, i - 1)] || sections[0]).id;
      for (const q of questions) if (q.sectionId === sid) q.sectionId = targetId;
      renderQuestions();
    };
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
    match: 'Match the following',
  }[q.type] || q.type;
  let body = '';
  if (q.type === 'mc') {
    body = `
      <div class="field">
        <label>Options (check the correct one)</label>
        ${q.options.map((opt, oi) => `
          <div class="row" style="margin-bottom: 6px;">
            <input type="radio" name="correct-${q.id}" data-correct="${oi}" ${q.correctAnswer === oi ? 'checked' : ''} />
            <input type="text" dir="auto" data-oi="${oi}" value="${escapeAttr(opt)}" placeholder="Option ${oi + 1}" />
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
    body = `<div class="muted">Auto-graded essays use the writing rubric you select at the top of this builder. Stage 7/8 = 4 criteria × 3 marks (12 total). Stage 3-5 / 5-9 = 5 criteria × 0–8 marks (40 total). You can review and override the AI grade in the essay queue.</div>`;
  }
  // Per-question image section. Three states:
  //  1. Image already uploaded → show preview + remove button
  //  2. AI suggested an image (imageDescription set, no imageUrl) → show
  //     suggestion + upload button
  //  3. Nothing → show plain "Add image" button
  let imageSection = '';
  if (q.imageUrl) {
    imageSection = `
      <div class="field">
        <label>🖼 Image attached to this question</label>
        <div style="display: flex; gap: 12px; align-items: flex-start;">
          <img src="${escapeAttr(q.imageUrl)}" alt="Question image" style="max-width: 240px; max-height: 180px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;" />
          <div>
            <button class="btn ghost" data-act="img-replace">Replace</button>
            <button class="btn ghost" data-act="img-ai" style="margin-left: 6px;">✨ Redraw with AI</button>
            <button class="btn danger" data-act="img-remove" style="margin-left: 6px;">Remove</button>
            <input type="file" accept="image/*" data-img-file style="display: none;" />
          </div>
        </div>
      </div>
    `;
  } else if (q.imageDescription) {
    imageSection = `
      <div class="field" style="background: linear-gradient(135deg, #ede9fe, #fce7f3); border: 1px dashed #c4b5fd; border-radius: 8px; padding: 12px;">
        <label>✨ AI suggests a graphic for this question</label>
        <div style="font-size: 13px; color: #6b21a8; margin-bottom: 8px;">${escapeHtml(q.imageDescription)}</div>
        <button class="btn primary" data-act="img-ai">✨ Generate with AI</button>
        <button class="btn ghost" data-act="img-upload" style="margin-left: 6px;">📎 Upload image</button>
        <button class="btn ghost" data-act="img-skip" style="margin-left: 6px;">Skip — text only</button>
        <input type="file" accept="image/*" data-img-file style="display: none;" />
      </div>
    `;
  } else {
    imageSection = `
      <div class="field">
        <button class="btn ghost" data-act="img-upload">🖼 Add image (optional)</button>
        <button class="btn ghost" data-act="img-ai" style="margin-left: 6px;">✨ Generate diagram with AI</button>
        <input type="file" accept="image/*" data-img-file style="display: none;" />
      </div>
    `;
  }

  return `
    <div class="q-row" id="q-${q.id}">
      <div class="row" style="margin-bottom: 8px;">
        <strong>Q${idx + 1}</strong>
        <span class="badge">${typeLabel}</span>
        <div class="spacer"></div>
        <button class="btn ghost" data-act="up">↑</button>
        <button class="btn ghost" data-act="down">↓</button>
        <button class="btn ghost" data-act="clear" title="Empty this question so you can type or paste a new one">🧹 Clear</button>
        <button class="btn danger" data-act="remove">Remove</button>
      </div>
      <div class="field">
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px;">
          <label style="margin:0;">Prompt</label>
          <span style="font-size:12px; color:#6b7280;">type, paste text, or paste a screenshot of a question (⌘V)</span>
          <span style="flex:1;"></span>
          <button type="button" class="btn ghost" data-act="shot-upload" style="padding:4px 10px; font-size:12px;">📷 Screenshot → question</button>
          <button type="button" class="btn ghost" data-act="ai-tidy" style="padding:4px 10px; font-size:12px;" title="Turn pasted text into a clean question with proper maths symbols">✨ Tidy with AI</button>
          <input type="file" accept="image/*" data-shot-file style="display:none;" />
        </div>
        <textarea data-f="prompt" dir="auto" placeholder="Type the question — or paste a screenshot of a question and the AI will turn it into a real question.">${escapeHtml(q.prompt || '')}</textarea>
        <div data-shot-status style="display:none; font-size:13px; color:#4338ca; margin-top:6px;"></div>
        ${q._aiCheck ? '<div style="font-size:12px; color:#92400e; background:#fef3c7; border-radius:6px; padding:6px 10px; margin-top:6px;">⚠️ Filled in by AI — please check the question and the correct answer.</div>' : ''}
        <div data-math-preview style="display:none; margin-top:8px; padding:10px 12px; background:#f8fafc; border:1px solid #e5e7eb; border-radius:8px;"></div>
      </div>
      <div class="field">
        <label>Points</label>
        <input type="number" min="1" data-f="points" value="${q.points || 1}" style="width: 80px;" />
      </div>
      <div class="row" style="gap:10px; align-items:flex-start;">
        <div class="field" style="flex:1; min-width:200px;">
          <label>🎯 Skill / outcome tested</label>
          <input type="text" data-f="skill" dir="auto" value="${escapeAttr(q.skill || '')}" placeholder="e.g. Differentiation — product rule" />
        </div>
        <div class="field" style="flex:2; min-width:260px;">
          <label>💡 Feedback students see after results are released</label>
          <textarea data-f="explanation" dir="auto" rows="2" placeholder="Why the correct answer is right, and the common mistake behind the wrong ones.">${escapeHtml(q.explanation || '')}</textarea>
        </div>
      </div>
      ${imageSection}
      ${body}
    </div>
  `;
}

// Compress + base64-encode an uploaded image so it can live inline in the
// assessment JSON. Caps at 800px wide and ~70% JPEG quality which keeps each
// image well under 250KB.
// Render an SVG string to a PNG data URL (white background) so AI diagrams
// behave exactly like uploaded images everywhere (student view, PDF, print).
function ccSvgToPngDataUrl(svg, width = 900) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const w0 = img.naturalWidth || 600, h0 = img.naturalHeight || 400;
      const scale = width / w0;
      const c = document.createElement('canvas');
      c.width = Math.round(w0 * scale); c.height = Math.round(h0 * scale);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('The diagram could not be rendered.')); };
    img.src = url;
  });
}

// Shrink a large data-URL image (e.g. a big photo inside an imported Word
// file) so the assessment stays small enough to save.
function ccShrinkDataUrl(dataUrl, maxW = 900, maxLen = 400000) {
  return new Promise((resolve) => {
    if (!dataUrl || dataUrl.length <= maxLen) return resolve(dataUrl);
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(1, maxW / img.width);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * ratio); c.height = Math.round(img.height * ratio);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function compressImageToDataUrl(file, maxW = 800) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => { img.src = reader.result; };
    reader.onerror = () => reject(new Error('Could not read image'));
    img.onerror = () => reject(new Error('Image is invalid or corrupt'));
    img.onload = () => {
      const ratio = Math.min(1, maxW / img.width);
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      // Choose JPEG for photos; PNGs (with transparency) get JPEG-ed too —
      // acceptable trade-off for keeping files small.
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    reader.readAsDataURL(file);
  });
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
      deliveryMode: els.deliveryMode ? els.deliveryMode.value : 'online',
      shuffle: !!(document.getElementById('shuffle-toggle') || {}).checked,
      skill: els.skill ? els.skill.value || null : null,
      classId: els.builderClass ? els.builderClass.value || null : null,
      academicYear: els.academicYear ? (els.academicYear.value || '').trim() || null : null,
      scheduledDate: els.scheduledDate ? els.scheduledDate.value || null : null,
      durationMinutes: Number(els.duration.value) || 30,
      audioScript: els.audioScript ? els.audioScript.value : '',
      audioVoice:  els.audioVoice  ? els.audioVoice.value  : '',
      audioVoices: currentAudioVoices || {},
      published: els.published.value === 'true',
      sections,
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
    console.log('[ClassCurio] Save succeeded. Closing builder and reloading…');
    // ── Layer 1: nuke the DOM. Remove the builder + every editor view from
    //    the document entirely. They CAN'T render if they aren't in the DOM.
    try {
      ['builder-view','results-view','template-picker','essay-queue-view',
       'report-card-view','students-view','progress-view']
        .forEach((id) => {
          const el = document.getElementById(id);
          if (el && el.parentNode) el.parentNode.removeChild(el);
        });
    } catch (e) { console.warn('[ClassCurio] DOM cleanup error:', e); }
    document.body.classList.add('cc-list-only');
    // ── Layer 2: navigate to a clean URL. location.replace removes the
    //    builder URL from history so Back doesn't return there. Adding
    //    ?just_saved=1 makes the new page able to verify the save flow.
    try {
      window.location.replace(window.location.pathname + '?just_saved=1');
    } catch {
      window.location.href = window.location.pathname + '?just_saved=1';
    }
  } catch (e) {
    els.saveStatus.textContent = '';
    alert(e.message);
  }
};

// ---------- Results view ----------
async function openResults(id) {
  document.body.classList.remove('cc-list-only');
  document.body.classList.remove('cc-builder-open');
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
    // Manual grant-re-entry panel — for students who got logged out and
  // never submitted, so they don't appear in the table below.
  const reentryPanelId = `re-panel-${currentResultsAssessmentId || 'x'}`;
  const manualReentryHtml = `
    <div class="panel" style="background:#fef3c7; border:2px solid #f59e0b; padding: 14px 16px; margin-bottom: 14px;">
      <div style="font-weight:600; color:#92400e; margin-bottom: 6px;">🔓 Grant re-entry by student email</div>
      <div class="muted" style="font-size:13px; margin-bottom: 8px;">
        If a student got logged out mid-exam and isn't showing in the table below, type their email here to grant them a re-entry. They'll be able to resume from where they left off.
      </div>
      <div class="row" style="gap: 8px;">
        <input id="manual-reentry-email" type="email" placeholder="student@school.com" style="flex: 1;" />
        <button class="btn primary" id="manual-reentry-go">Grant re-entry</button>
        <span id="manual-reentry-status" class="muted" style="font-size: 12px; align-self: center;"></span>
      </div>
    </div>
  `;
  els.resultsBody.innerHTML = analyticsHtml + manualReentryHtml + `<div class="muted">No submissions yet.</div>`;
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
          <td>${(() => {
            // Include AI-graded essay scores (stored in manualGrades with aiGrade:true)
            // so the dashboard shows the full auto-graded total, not just MC/TF.
            let aiScore = 0, aiMax = 0;
            const mg = r.manualGrades || {};
            for (const k in mg) {
              const g = mg[k];
              if (g && g.aiGrade) {
                aiScore += Number(g.score) || 0;
                aiMax   += Number(g.maxScore) || 0;
              }
            }
            const totalScore = (Number(r.autoScore) || 0) + aiScore;
            const totalMax   = (Number(r.autoMax)   || 0) + aiMax;
            const breakdown = aiMax > 0
              ? `<div class=\"muted\" style=\"font-size:11px;\">MC/TF: ${r.autoScore}/${r.autoMax} · Essay: ${aiScore}/${aiMax}</div>`
              : '';
            return `<strong>${totalScore}/${totalMax}</strong>${breakdown}`;
          })()}</td>
          <td>${vcount ? `<span class="badge red">${vcount}</span>` : '<span class="muted">—</span>'}</td>
          <td>${envBadge}</td>
          <td class="muted">${new Date(r.submittedAt).toLocaleString()}</td>
          <td>
            <button class="btn primary" data-report="${r.id}">📋 Report</button>
            ${vcount || (r.submitReason && r.submitReason !== 'manual')
              ? `<button class="btn" data-grant-reentry="${assessment.id}" data-student-id="${r.studentId}" data-student-name="${escapeAttr(r.studentName || r.studentEmail || '')}" style="margin-left: 4px;">🔓 Grant re-entry</button>`
              : ''}
          </td>
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
  // Wire the manual grant-reentry panel.
  const manualReentryGo = document.getElementById('manual-reentry-go');
  if (manualReentryGo) {
    manualReentryGo.onclick = async () => {
      const emailInput = document.getElementById('manual-reentry-email');
      const status = document.getElementById('manual-reentry-status');
      const email = (emailInput.value || '').trim().toLowerCase();
      if (!email || !email.includes('@')) {
        status.textContent = '⚠ Enter a valid email address.';
        status.style.color = '#b91c1c';
        return;
      }
      status.textContent = 'Finding student...';
      status.style.color = '';
      try {
        // Look up student id from the known-students cache.
        const matchedStudent = (knownStudents || []).find((s) =>
          String(s.email || '').toLowerCase() === email
        );
        if (!matchedStudent) {
          status.textContent = '❌ No student with that email is registered. Did they sign in at least once?';
          status.style.color = '#b91c1c';
          return;
        }
        await api(`/api/assessments/${currentResultsAssessmentId}/grant-reentry`, {
          method: 'POST',
          body: { studentId: matchedStudent.studentId || matchedStudent.id },
        });
        status.textContent = `✓ Re-entry granted to ${matchedStudent.name || email}. They can sign back in and resume.`;
        status.style.color = '#166534';
        emailInput.value = '';
      } catch (e) {
        status.textContent = '❌ ' + e.message;
        status.style.color = '#b91c1c';
      }
    };
  }
  els.resultsBody.querySelectorAll('button[data-report]').forEach((btn) => {
    btn.onclick = () => openReportCard(btn.dataset.report);
  });
  els.resultsBody.querySelectorAll('button[data-grant-reentry]').forEach((btn) => {
    btn.onclick = async () => {
      const assessmentId = btn.dataset.grantReentry;
      const studentId = btn.dataset.studentId;
      const name = btn.dataset.studentName || 'this student';
      if (!confirm(
        `Grant a one-time re-entry to "${name}"?\n\n` +
        `Their previous submission will be DELETED so they can take the assessment from the start. ` +
        `Their existing answers and any lockdown violations will not be kept.\n\n` +
        `This grant can only be used once — if they get locked out again, you'll need to grant another re-entry.`
      )) return;
      btn.disabled = true;
      btn.textContent = '…';
      try {
        await api(`/api/assessments/${assessmentId}/grant-reentry`, {
          method: 'POST',
          body: { studentId },
        });
        openResults(assessmentId);
      } catch (e) {
        alert('Could not grant re-entry: ' + e.message);
        btn.disabled = false;
        btn.textContent = '🔓 Grant re-entry';
      }
    };
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
  const _sk = ccAnalyticsSkillsHtml(assessmentId, a);
  if (!a.submissionCount) {
    return _sk.releaseBar + `<div class="panel" style="margin-bottom: 14px;"><strong>Class analytics:</strong> no submissions yet.</div>`;
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
    const wrong = (q.skill ? `<div class="muted" style="font-size: 12px; margin-top: 2px;">🎯 ${escapeHtml(q.skill)}</div>` : '') + (q.mostCommonWrong
      ? `<div class="muted" style="font-size: 12px; margin-top: 2px;">Most common wrong answer: "${escapeHtml(q.mostCommonWrong.optionText)}" (${q.mostCommonWrong.count} student${q.mostCommonWrong.count === 1 ? '' : 's'})</div>`
      : '');
    return `
      <div class="qd-row">
        <div class="qd-num">Q${i + 1}</div>
        <div class="qd-prompt">${escapeHtml(q.prompt.slice(0, 90))}${q.prompt.length > 90 ? '…' : ''}</div>
        <div class="qd-rate ${rateClass}">${rateText}</div>
      </div>
      ${wrong}
    `;
  }).join('');

  return _sk.releaseBar + `
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
      ${_sk.body}
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
        ${(() => {
          const fw = frameworkForSubject(data.subject);
          const band = bandFor(pct);
          const bs = bandStyle(band);
          const frameworkCard = (() => {
            if (fw === 'cefr') {
              return `
                <div style="padding: 10px 16px; background:#eef2ff; border:1px solid #c7d2fe; border-radius: 10px;">
                  <div style="font-size: 12px; color:#4338ca; text-transform: uppercase; letter-spacing: 1px;">CEFR Level</div>
                  <div style="font-size: 28px; font-weight: 700; color:#1e1b4b;">${cefrFor(pct)}</div>
                </div>`;
            }
            if (fw === 'pisa') {
              return `
                <div style="padding: 10px 16px; background:#ecfdf5; border:1px solid #6ee7b7; border-radius: 10px;">
                  <div style="font-size: 12px; color:#047857; text-transform: uppercase; letter-spacing: 1px;">PISA Level</div>
                  <div style="font-size: 28px; font-weight: 700; color:#065f46;">${pisaFor(pct)} of 6</div>
                </div>`;
            }
            // No universal framework for the subject — show the raw percent
            // as the dominant figure instead.
            return `
              <div style="padding: 10px 16px; background:#f3f4f6; border:1px solid #d1d5db; border-radius: 10px;">
                <div style="font-size: 12px; color:#374151; text-transform: uppercase; letter-spacing: 1px;">Score</div>
                <div style="font-size: 28px; font-weight: 700; color:#1f2937;">${pct}%</div>
              </div>`;
          })();
          const overrideCard = data.teacherGradeOverride
            ? `<div style="padding: 10px 16px; background:#fef3c7; border:2px solid #c69214; border-radius: 10px;">
                 <div style="font-size: 12px; color:#92400e; text-transform: uppercase; letter-spacing: 1px;">Teacher's Grade</div>
                 <div style="font-size: 28px; font-weight: 700; color:#78350f;">${escapeHtml(data.teacherGradeOverride)}</div>
               </div>`
            : '';
          return `
            <div class="report-cefr" style="display:flex; gap: 14px; margin-top: 14px; flex-wrap: wrap;">
              ${frameworkCard}
              <div style="padding: 10px 16px; background:${bs.bg}; border:1px solid ${bs.color}; border-radius: 10px;">
                <div style="font-size: 12px; color:${bs.color}; text-transform: uppercase; letter-spacing: 1px;">Achievement Band</div>
                <div style="font-size: 28px; font-weight: 700; color:${bs.color};">${band}</div>
              </div>
              ${overrideCard}
            </div>
          `;
        })()}
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
          <div class="field" style="margin-bottom: 14px;">
            <label style="font-weight: 600;">Your own grade for this student (optional)</label>
            <div class="muted" style="font-size: 12px; margin-bottom: 4px;">Free text — any letter, number, or word you prefer. Examples: <em>A+</em>, <em>18/20</em>, <em>Outstanding</em>, <em>Needs support</em>. Shows as a gold badge on the report card.</div>
            <div class="row" style="gap: 8px;">
              <input type="text" id="teacher-grade-override" placeholder="e.g. A+" value="${escapeAttr(data.teacherGradeOverride || '')}" style="flex: 1;" />
              <button id="save-teacher-grade" class="btn primary">Save grade</button>
              <span id="teacher-grade-status" class="muted" style="align-self: center;"></span>
            </div>
          </div>
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

  mountBody.innerHTML = ccSkillsBlockHtml(data.skillReport) + `
    <div class="report-card">
      <h2>Question by Question</h2>
      ${data.review.map((q, i) => renderReviewQuestion(q, i)).join('')}
    </div>
  `;

  if (isTeacher) {
    // Wire the Teacher's own grade input.
    const tgInput = document.getElementById('teacher-grade-override');
    const tgBtn = document.getElementById('save-teacher-grade');
    const tgStatus = document.getElementById('teacher-grade-status');
    if (tgBtn) {
      tgBtn.onclick = async () => {
        const value = (tgInput.value || '').trim();
        tgStatus.textContent = 'Saving...';
        tgStatus.style.color = '';
        try {
          await api(`/api/results/${data.__resultId}/teacher-grade`, {
            method: 'PUT', body: { grade: value },
          });
          tgStatus.textContent = value ? '✓ Saved.' : '✓ Cleared.';
          tgStatus.style.color = '#166534';
          data.teacherGradeOverride = value || null;
          // Re-render the report so the badge updates.
          renderReportCard({
            mountSummary, mountBody, data, isTeacher: true,
          });
        } catch (e) {
          tgStatus.textContent = '❌ ' + e.message;
          tgStatus.style.color = '#b91c1c';
        }
      };
    }

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
      ${ccReviewExtrasHtml(q)}
    </div>
  `;
}

function hideAllViews() {
  document.body.classList.remove('cc-builder-open');
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
  document.body.classList.remove('cc-list-only');
  document.body.classList.remove('cc-builder-open');
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
    els.queueBody.innerHTML =
      '<div id="cc-queue-bulk" style="margin-bottom: 12px; padding: 10px 14px; background:#f1f5f9; border-radius:10px; display:flex; align-items:center; gap:10px;">' +
        '<label style="font-weight:600; color:#1a1e33;"><input type="checkbox" id="cc-queue-selectall" /> Select all</label>' +
        '<span class="muted" id="cc-queue-selcount" style="font-size:13px;"></span>' +
        '<div style="flex:1;"></div>' +
        '<button class="btn danger" id="cc-queue-delete" disabled style="opacity:0.5;">🗑 Delete selected</button>' +
      '</div>' +
      queue.map((item) => renderQueueItem(item)).join('');
    queue.forEach((item) => wireQueueItem(item));
    _ccWireEssayQueueBulk(queue);
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
    <div class="panel" id="${rowId}" data-result-id="${item.resultId}" data-question-id="${item.questionId}">
      <div class="row" style="margin-bottom: 6px; align-items:center;">
        <input type="checkbox" class="cc-queue-check" data-result-id="${item.resultId}" data-question-id="${item.questionId}" style="width:18px; height:18px; cursor:pointer;" />
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
    try {
      const f = document.getElementById('bg-model-field'), sel = document.getElementById('bg-model-select');
      if (f && sel) {
        f.style.display = data.isAdmin ? '' : 'none';
        sel.value = data.bgModel || 'haiku';
        sel.onchange = async () => {
          const st = document.getElementById('bg-model-status');
          try { const r = await api('/api/settings/ai-model', { method: 'POST', body: { bgModel: sel.value } }); if (st) st.textContent = '✓ Saved — ' + (r.bgModel === 'sonnet' ? 'Sonnet' : 'Haiku') + ' is used from now on.'; }
          catch (e) { if (st) st.textContent = '⚠ ' + e.message; }
        };
      }
    } catch (e) {}
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


// ───────────────────────────────────────────────────────────────────────────
//  CLASS ANALYTICS (CEFR distribution + per-skill + L/M/H + drill-down)
// ───────────────────────────────────────────────────────────────────────────
async function openClassAnalytics() {
  const classId = getActiveClassId();
  if (!classId) { alert('Pick a class first using the class switcher.'); return; }
  hideAllViews();
  const mount = document.getElementById('class-analytics-view') || (() => {
    const div = document.createElement('div');
    div.id = 'class-analytics-view';
    document.querySelector('.container').appendChild(div);
    return div;
  })();
  mount.style.display = 'block';
  mount.innerHTML = '<div class="panel"><div class="muted">Loading analytics…</div></div>';
  let data, cross;
  try {
    data = await api(`/api/classes/${classId}/analytics`);
    cross = await api(`/api/analytics/cross-class`);
  } catch (e) {
    mount.innerHTML = `<div class="panel"><div class="error">Could not load analytics: ${escapeHtml(e.message)}</div></div>`;
    return;
  }

  const cefrCells = ['A1','A2','B1','B2','C1','C2'].map((lvl) => {
    const n = data.cefrHistogram[lvl] || 0;
    const w = data.students.length ? Math.round((n / data.students.length) * 100) : 0;
    const color = (lvl[0] === 'C') ? '#166534' : (lvl[0] === 'B') ? '#b45309' : '#b91c1c';
    return `
      <div style="background:#f8fafc; border:1px solid #e5e7eb; border-radius:10px; padding:14px;">
        <div style="font-size:13px; color:#475569; letter-spacing:1px;">${lvl}</div>
        <div style="font-size:34px; font-weight:700; color:${color};">${n}</div>
        <div style="font-size:12px; color:#475569;">${w}% of class</div>
      </div>
    `;
  }).join('');

  const bandCard = (label, n, total, color, bg) => `
    <div style="flex:1; min-width:160px; background:${bg}; border:1px solid ${color}; border-radius:10px; padding:14px;">
      <div style="font-size:13px; color:${color}; text-transform:uppercase; letter-spacing:1px;">${label}</div>
      <div style="font-size:34px; font-weight:700; color:${color};">${n}</div>
      <div style="font-size:12px; color:${color};">${total ? Math.round((n/total)*100) : 0}% of class</div>
    </div>`;

  const skillsHtml = data.skills.length
    ? data.skills.map((s) => `
        <div style="margin-bottom:8px;">
          <div class="row" style="margin-bottom:4px;">
            <span style="font-weight:600;">${escapeHtml(s.name)}</span>
            <div class="spacer"></div>
            <span class="muted">${s.score} / ${s.max}</span>
            <strong style="margin-left:8px;">${s.avgPct}%</strong>
          </div>
          <div style="height:10px; background:#e5e7eb; border-radius:5px; overflow:hidden;">
            <div style="height:100%; width:${s.avgPct}%; background: linear-gradient(90deg,#10b981,#34d399);"></div>
          </div>
        </div>
      `).join('')
    : '<div class="muted">No section data yet — students need to submit assessments first.</div>';

  const studentRows = data.students.map((s) => {
    const bandColor = s.band === 'High' ? '#166534' : s.band === 'Medium' ? '#92400e' : '#b91c1c';
    const bandBg    = s.band === 'High' ? '#dcfce7' : s.band === 'Medium' ? '#fef3c7' : '#fee2e2';
    return `
      <tr>
        <td style="padding:8px;"><strong>${escapeHtml(s.name)}</strong><div class="muted" style="font-size:12px;">${escapeHtml(s.email)}</div></td>
        <td style="padding:8px;"><strong>${s.pct}%</strong></td>
        <td style="padding:8px;"><span style="background:#eef2ff; color:#3730a3; padding:2px 8px; border-radius:6px; font-weight:600;">${s.cefrLevel}</span></td>
        <td style="padding:8px;"><span style="background:${bandBg}; color:${bandColor}; padding:2px 8px; border-radius:6px; font-weight:600;">${s.band}</span></td>
        <td style="padding:8px;" class="muted">${s.submissions} submission${s.submissions === 1 ? '' : 's'}</td>
        <td style="padding:8px;"><button class="btn" data-student-detail="${escapeAttr(s.studentId)}">View detail</button></td>
      </tr>
    `;
  }).join('');

  const crossHtml = (cross && cross.classes && cross.classes.length > 1)
    ? `
      <div class="panel" style="margin-top:14px;">
        <h2 style="margin-top:0;">Cross-class comparison</h2>
        <div class="muted" style="margin-bottom:8px;">All your classes side-by-side.</div>
        ${cross.classes.map((cc) => `
          <div style="margin-bottom:6px;">
            <div class="row"><span style="font-weight:600;">${escapeHtml(cc.name)}</span>
              <div class="spacer"></div>
              <span class="muted">${cc.submissionCount} submissions · ${cc.rosterCount} on roster</span>
              <strong style="margin-left:8px;">${cc.avgPct}%</strong>
            </div>
            <div style="height:8px; background:#e5e7eb; border-radius:4px; overflow:hidden;">
              <div style="height:100%; width:${cc.avgPct}%; background: linear-gradient(90deg,#6366f1,#a855f7);"></div>
            </div>
          </div>
        `).join('')}
      </div>
    `
    : '';

  mount.innerHTML = `
    <div class="row" style="margin-bottom: 12px;">
      <h1 style="margin:0;">📊 ${escapeHtml(data.class.name)} — Class Analytics</h1>
      <div class="spacer"></div>
      <button class="btn" id="analytics-back">← Back to dashboard</button>
    </div>
    <div class="panel">
      <div class="row" style="margin-bottom:12px; flex-wrap: wrap; gap: 16px;">
        <div><div class="muted">Class average</div><div style="font-size:34px; font-weight:700;">${data.classAvgPct}%</div></div>
        <div><div class="muted">Submissions</div><div style="font-size:34px; font-weight:700;">${data.submissionCount}</div></div>
        <div><div class="muted">Assessments</div><div style="font-size:34px; font-weight:700;">${data.assessmentCount}</div></div>
        <div><div class="muted">Roster</div><div style="font-size:34px; font-weight:700;">${data.class.rosterCount}</div></div>
      </div>
      <h2>Achievement bands</h2>
      <div class="row" style="gap:10px; flex-wrap: wrap;">
        ${bandCard('High (C1-C2)', data.bands.High, data.students.length, '#166534', '#dcfce7')}
        ${bandCard('Medium (B1-B2)', data.bands.Medium, data.students.length, '#92400e', '#fef3c7')}
        ${bandCard('Low (A1-A2)', data.bands.Low, data.students.length, '#b91c1c', '#fee2e2')}
      </div>
      <h2 style="margin-top:18px;">CEFR distribution</h2>
      <div style="display:grid; grid-template-columns: repeat(6, 1fr); gap:10px;">${cefrCells}</div>
    </div>
    <div class="panel">
      <h2 style="margin-top:0;">Per-skill performance</h2>
      ${skillsHtml}
    </div>
    ${crossHtml}
    <div class="panel">
      <h2 style="margin-top:0;">Students (sorted by score)</h2>
      <table style="width:100%; font-size:14px; border-collapse: collapse;">
        <thead><tr style="background:#eef2ff;">
          <th style="text-align:left; padding:8px;">Student</th>
          <th style="text-align:left; padding:8px;">Average</th>
          <th style="text-align:left; padding:8px;">CEFR</th>
          <th style="text-align:left; padding:8px;">Band</th>
          <th style="text-align:left; padding:8px;">Activity</th>
          <th style="text-align:left; padding:8px;"></th>
        </tr></thead>
        <tbody>${studentRows || '<tr><td colspan="6" class="muted" style="padding:8px;">No student submissions yet.</td></tr>'}</tbody>
      </table>
    </div>
  `;
  document.getElementById('analytics-back').onclick = () => {
    mount.style.display = 'none';
    els.listView.style.display = 'block';
  };
  mount.querySelectorAll('[data-student-detail]').forEach((b) => {
    b.onclick = () => openStudentProgress(b.dataset.studentDetail);
  });
}

// ───────────────────────────────────────────────────────────────────────────
//  PRINT-TO-PDF — opens a printable view of the assessment + answer key
// ───────────────────────────────────────────────────────────────────────────
async function printAssessmentPDF(assessmentId, setNo) {
  // Fetch the assessment JSON with the session cookie attached, then render
  // a fully-styled printable page inside a HIDDEN IFRAME inside this same
  // window. No popup required — works in browsers and the desktop app.
  let data;
  try {
    data = await api(`/api/assessments/${assessmentId}/export`);
  } catch (e) {
    alert('Could not load assessment: ' + e.message);
    return;
  }
  const a = data.assessment || data;
  const sections = a.sections || [];
  const questions = setNo ? ccMakeSet(a, setNo) : (a.questions || []);
  const _setLabel = setNo ? ` — Set ${setNo}` : '';

  const css = `
    <style>
      body { font-family: Calibri, Arial, sans-serif; color:#1a1e33; padding: 30px 40px; line-height: 1.55; font-size: 14px; margin: 0; }
      h1 { color:#1a1e33; margin: 0 0 4px; font-size: 24px; }
      h2 { color:#1a1e33; margin: 22px 0 6px; font-size: 18px; }
      .meta { color:#475569; font-size: 13px; margin-bottom: 18px; }
      .passage { background:#fef7e6; border:1px solid #f59e0b; border-radius: 6px; padding: 12px 14px; white-space: pre-wrap; margin: 8px 0 14px; font-size: 14px; }
      .q { margin: 12px 0; padding-bottom: 8px; border-bottom: 1px dashed #cbd5e1; page-break-inside: avoid; }
      .q-prompt { font-weight: 600; margin-bottom: 6px; }
      .opt { padding: 3px 0 3px 22px; position: relative; }
      .opt::before { content: '○'; position: absolute; left: 4px; color:#64748b; }
      .write-lines { border-bottom: 1px solid #94a3b8; height: 22px; margin: 6px 0; }
      .pagebreak { page-break-before: always; }
      .key { background:#ecfdf5; border:1px solid #10b981; border-radius:8px; padding: 14px; margin-top: 12px; }
      .key-row { padding: 4px 0; border-bottom: 1px dashed #6ee7b7; }
    </style>
  `;
  function answerLine(q) {
    if (q.type === 'mc') return (q.options || []).map((o) => `<div class="opt">${escapeHtml(String(o || ''))}</div>`).join('');
    if (q.type === 'tf') return `<div class="opt">True</div><div class="opt">False</div>`;
    if (q.type === 'tfng') return `<div class="opt">True</div><div class="opt">False</div><div class="opt">Not Given</div>`;
    if (q.type === 'short') return `<div class="write-lines"></div>`;
    if (q.type === 'long' || q.type === 'essay' || q.type === 'writing') {
      return Array.from({length: q.type === 'writing' ? 14 : 6}, () => '<div class="write-lines"></div>').join('');
    }
    return '';
  }
  function correctLine(q, i) {
    if (q.type === 'mc') return `<div class="key-row"><strong>Q${i+1}:</strong> ${escapeHtml(String((q.options || [])[q.correctAnswer] || ''))}</div>`;
    if (q.type === 'tf') return `<div class="key-row"><strong>Q${i+1}:</strong> ${q.correctAnswer ? 'True' : 'False'}</div>`;
    if (q.type === 'tfng') return `<div class="key-row"><strong>Q${i+1}:</strong> ${escapeHtml(String(q.correctAnswer || ''))}</div>`;
    if (q.type === 'short') return `<div class="key-row"><strong>Q${i+1}:</strong> ${escapeHtml(String(q.correctAnswer || '(open-ended)'))}</div>`;
    return `<div class="key-row"><strong>Q${i+1}:</strong> Teacher / AI graded — no fixed key.</div>`;
  }
  let body = `<h1>${escapeHtml(a.title)}${_setLabel}</h1>
    <div class="meta">${escapeHtml(a.description || '')}</div>
    <div class="meta">${a.durationMinutes ? a.durationMinutes + ' minutes &middot; ' : ''}${questions.length} question${questions.length === 1 ? '' : 's'}${a.subject ? ' &middot; ' + escapeHtml(a.subject) : ''}${a.grade ? ' &middot; Grade ' + escapeHtml(a.grade) : ''}${a.term ? ' &middot; Term ' + escapeHtml(a.term) : ''}</div>`;
  let qi = 0;
  if (sections.length) {
    for (const sec of sections) {
      if (sec.title) body += `<h2>${escapeHtml(sec.title)}</h2>`;
      if (sec.instructions) body += `<div style="font-style: italic; margin: 4px 0 8px;">${escapeHtml(sec.instructions)}</div>`;
      if (sec.passage) body += `<div class="passage">${escapeHtml(sec.passage)}</div>`;
      for (const q of questions.filter((qq) => qq.sectionId === sec.id)) {
        qi++;
        body += `<div class="q"><div class="q-prompt">Q${qi} (${q.points || 1} pt${(q.points || 1) === 1 ? '' : 's'}): ${escapeHtml(q.prompt)}</div>${answerLine(q)}</div>`;
      }
    }
  } else {
    for (const q of questions) {
      qi++;
      body += `<div class="q"><div class="q-prompt">Q${qi} (${q.points || 1} pt): ${escapeHtml(q.prompt)}</div>${answerLine(q)}</div>`;
    }
  }
  body += `<div class="pagebreak"></div><h2>Answer Key${_setLabel}</h2><div class="key">${questions.map((q, i) => correctLine(q, i)).join('')}</div>`;

  const _rtlPrint = /arab|urdu|persian|farsi|hebrew|عرب/i.test(String(a.assessmentLanguage || ''));
  const _mathJaxPrint = `<script>window.MathJax={tex:{inlineMath:[['\\\\(','\\\\)']],displayMath:[['\\\\[','\\\\]']]},svg:{fontCache:'global'}};<\/script><script src="${location.origin}/vendor/mathjax/tex-svg.js" onerror="this.onerror=null;this.src='https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js'"><\/script>`;
  const fullHtml = `<!DOCTYPE html><html dir="${_rtlPrint ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${escapeHtml(a.title)}</title>${css}${_mathJaxPrint}</head><body>${body}</body></html>`;

  // Build a same-origin modal wrapping a print iframe — no popup needed.
  const overlay = document.createElement('div');
  overlay.id = 'pdf-print-overlay';
  overlay.style.cssText = [
    'position: fixed', 'inset: 0',
    'background: rgba(11, 16, 32, 0.55)',
    'display: flex', 'flex-direction: column',
    'align-items: stretch',
    'z-index: 100000',
  ].join(';');
  overlay.innerHTML = `
    <div style="display:flex; gap:8px; align-items:center; padding: 10px 14px; background: #1a1e33; color:#fff;">
      <strong>Preview — ${escapeHtml(a.title)}</strong>
      <div style="flex:1;"></div>
      <button class="btn primary" id="pdf-print-btn">🖨️ Print / Save as PDF</button>
      <button class="btn" id="pdf-print-close" style="background:#374151; color:#fff; border-color:#374151;">Close</button>
    </div>
    <iframe id="pdf-print-iframe" style="flex: 1; width: 100%; border: 0; background: #fff;"></iframe>
  `;
  document.body.appendChild(overlay);
  const close = () => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); };
  document.getElementById('pdf-print-close').onclick = close;
  // Click outside on the dark backdrop to close (but not on the iframe).
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  const iframe = document.getElementById('pdf-print-iframe');
  // Write the HTML into the iframe and trigger print after a moment.
  iframe.onload = () => {
    // Wait for the maths to finish rendering before opening the print dialog.
    const w = iframe.contentWindow;
    const go = () => { try { w.focus(); w.print(); } catch (e) {} };
    let waited = 0;
    const tick = () => {
      const MJ = w && w.MathJax;
      if (MJ && MJ.startup && MJ.startup.promise) {
        MJ.startup.promise.then(() => (MJ.typesetPromise ? MJ.typesetPromise() : null))
          .then(() => setTimeout(go, 200)).catch(() => setTimeout(go, 200));
        return;
      }
      if ((waited += 150) > 5000) return go();
      setTimeout(tick, 150);
    };
    setTimeout(tick, 150);
  };
  iframe.srcdoc = fullHtml;
  document.getElementById('pdf-print-btn').onclick = () => {
    try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) {}
  };
}

// ───────────────────────────────────────────────────────────────────────────
//  SHARE WITH ANOTHER TEACHER — generate + copy share link
// ───────────────────────────────────────────────────────────────────────────
async function shareAssessment(assessmentId) {
  let resp;
  try {
    resp = await api(`/api/assessments/${assessmentId}/share`, { method: 'POST' });
  } catch (e) {
    alert('Could not generate share link: ' + e.message);
    return;
  }
  const url = resp.shareUrl;
  // Best-effort auto-copy.
  try { await navigator.clipboard.writeText(url); } catch {}

  const overlay = document.createElement('div');
  overlay.id = 'share-teacher-overlay';
  overlay.style.cssText = [
    'position: fixed', 'inset: 0',
    'background: rgba(11, 16, 32, 0.55)',
    'display: flex', 'align-items: center', 'justify-content: center',
    'z-index: 100000',
  ].join(';');
  const enc = encodeURIComponent;
  const subject = enc('ClassCurio assessment to duplicate');
  const bodyText = enc(`I'm sharing a ClassCurio assessment with you. Open this link while logged in to ClassCurio and you can preview, download as PDF/Word, or duplicate it into one of your own classes:\n\n${url}\n\n— Sent from ClassCurio`);
  overlay.innerHTML = `
    <div style="background:#fff; border-radius:12px; padding:24px 28px; max-width: 580px; width: 92%; box-shadow: 0 16px 48px rgba(0,0,0,0.30);">
      <h2 style="margin: 0 0 6px; color:#1a1e33;">🤝 Share with another teacher</h2>
      <p style="margin: 0 0 14px; color:#475569; font-size: 14px;">
        Copy the link below and send it to any other ClassCurio teacher. When they open it while signed in to their own account, they can preview the assessment, download it as PDF or Word, or duplicate it into one of their own classes.
      </p>
      <div style="display:flex; gap:8px; margin-bottom: 12px;">
        <input id="share-teacher-url" type="text" readonly value="${escapeAttr(url)}" style="flex:1; font-size: 13px; padding: 10px 12px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:8px; color:#1a1e33;" />
        <button class="btn primary" id="share-teacher-copy">Copy link</button>
      </div>
      <div class="row" style="gap: 8px; flex-wrap: wrap; margin-bottom: 6px;">
        <a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text=${enc(`Sharing a ClassCurio assessment: ${url}`)}" style="background:#25d366; color:#fff; border-color:#25d366;">💬 WhatsApp</a>
        <a class="btn" target="_blank" rel="noopener" href="mailto:?subject=${subject}&body=${bodyText}" style="background:#3b82f6; color:#fff; border-color:#3b82f6;">✉ Email</a>
        <a class="btn" target="_blank" rel="noopener" href="https://teams.microsoft.com/share?msgText=${enc(`ClassCurio assessment to duplicate: ${url}`)}" style="background:#4b53bc; color:#fff; border-color:#4b53bc;">Teams</a>
        <div class="spacer"></div>
        <button class="btn ghost" id="share-teacher-close">Close</button>
      </div>
      <div id="share-teacher-status" style="font-size: 12px; color:#166534; margin-top: 4px;">✓ Link already copied to your clipboard.</div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); };
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.getElementById('share-teacher-close').onclick = close;
  document.getElementById('share-teacher-copy').onclick = async () => {
    const input = document.getElementById('share-teacher-url');
    input.select();
    try {
      await navigator.clipboard.writeText(url);
      document.getElementById('share-teacher-status').textContent = '✓ Copied to clipboard.';
    } catch {
      if (document.execCommand) document.execCommand('copy');
    }
  };
  // Auto-select the URL so even on browsers without Clipboard API
  // the teacher can just press Cmd+C.
  setTimeout(() => {
    const input = document.getElementById('share-teacher-url');
    if (input) input.select();
  }, 100);
}

// ───────────────────────────────────────────────────────────────────────────
//  OPEN SHARED ASSESSMENT (when URL has ?share=TOKEN)
// ───────────────────────────────────────────────────────────────────────────
async function maybeHandleShareLink() {
  const params = new URLSearchParams(location.search);
  const token = params.get('share');
  if (!token) return;
  try {
    const resp = await api(`/api/assessments/share/${encodeURIComponent(token)}`);
    const a = resp.assessment;
    if (!a) return;
    const classOpts = classes.map((c) => `<option value="${escapeAttr(c.id)}">${escapeHtml(c.name)}</option>`).join('');
    hideAllViews();
    const mount = document.getElementById('shared-assessment-view') || (() => {
      const div = document.createElement('div');
      div.id = 'shared-assessment-view';
      document.querySelector('.container').appendChild(div);
      return div;
    })();
    mount.style.display = 'block';
    mount.innerHTML = `
      <div class="panel" style="background:#eef2ff; border:2px solid #c7d2fe;">
        <div class="row"><h1 style="margin:0;">🔗 Shared assessment from another teacher</h1>
          <div class="spacer"></div>
          <button class="btn" id="share-back">← Back</button>
        </div>
        <p><strong>Title:</strong> ${escapeHtml(a.title)}</p>
        <p><strong>Description:</strong> ${escapeHtml(a.description || '(none)')}</p>
        <p><strong>Questions:</strong> ${(a.questions || []).length} · <strong>Duration:</strong> ${a.durationMinutes || '?'} min</p>
        <p><strong>Original teacher:</strong> ${escapeHtml(a.teacherName || '(unknown)')}</p>
        <div class="row" style="gap:8px; margin-top:14px;">
          <button class="btn primary" id="share-print">📄 Print as PDF</button>
          <select id="share-dup-target">${classOpts}</select>
          <button class="btn primary" id="share-dup">📋 Duplicate into selected class</button>
        </div>
        <div id="share-status" class="muted" style="margin-top:10px;"></div>
      </div>
    `;
    document.getElementById('share-back').onclick = () => {
      history.replaceState({}, '', location.pathname);
      mount.style.display = 'none';
      els.listView.style.display = 'block';
    };
    document.getElementById('share-print').onclick = () => printAssessmentPDF(a.id);
    document.getElementById('share-dup').onclick = async () => {
      const targetClassId = document.getElementById('share-dup-target').value;
      if (!targetClassId) return;
      const status = document.getElementById('share-status');
      status.textContent = 'Duplicating...';
      try {
        const r2 = await api(`/api/assessments/share/${encodeURIComponent(token)}/duplicate`, {
          method: 'POST', body: { classId: targetClassId },
        });
        status.textContent = `✓ Created "${r2.title}" in your class. Switching back to dashboard...`;
        setTimeout(async () => {
          history.replaceState({}, '', location.pathname);
          mount.style.display = 'none';
          els.listView.style.display = 'block';
          await loadAssessments();
        }, 1200);
      } catch (e) {
        status.textContent = '❌ ' + e.message;
      }
    };
  } catch (e) {
    // Silent — just stay on the dashboard.
    console.warn('share link load failed:', e.message);
  }
}
// Run after the initial dashboard load.
window.addEventListener('load', () => setTimeout(maybeHandleShareLink, 500));


// ───────────────────────────────────────────────────────────────────────────
//  PDF-vs-Word chooser (added after the file restore)
// ───────────────────────────────────────────────────────────────────────────
function showExportChooser(assessmentId) {
  const overlay = document.createElement('div');
  overlay.id = 'export-chooser-overlay';
  overlay.style.cssText = [
    'position: fixed', 'inset: 0',
    'background: rgba(11, 16, 32, 0.55)',
    'display: flex', 'align-items: center', 'justify-content: center',
    'z-index: 100000',
  ].join(';');
  overlay.innerHTML = `
    <div style="background:#fff; border-radius:12px; padding:24px 28px; max-width: 460px; width: 90%; box-shadow: 0 16px 48px rgba(0,0,0,0.30);">
      <h2 style="margin: 0 0 8px; color:#1a1e33;">Download assessment</h2>
      <p style="margin: 0 0 16px; color:#475569; font-size: 14px;">Choose the format. Both include the questions and a separate answer-key page.</p>
      <div class="field" style="margin-bottom:12px;">
        <label>Version</label>
        <select id="export-set" style="width:100%;">
          <option value="0">Original order</option>
          <option value="1">Set 1 (shuffled)</option>
          <option value="2">Set 2 (shuffled)</option>
          <option value="3">Set 3 (shuffled)</option>
          <option value="4">Set 4 (shuffled)</option>
        </select>
        <div class="muted" style="font-size:12px; margin-top:4px;">Sets have the same questions in a different order, with shuffled answer options and their own answer key. Sets are PDF only.</div>
        <div style="font-size:12px; margin-top:8px; padding:8px 10px; background:#ede9fe; color:#4c1d95; border-radius:8px;">🖨 <strong>Printing for class?</strong> Download Set 1, 2, 3 and 4 one after another and hand out a different set to neighbouring students. Each set title shows "— Set 1", "— Set 2"… and has its own answer key.</div>
      </div>
      <div class="row" style="gap: 10px; flex-wrap: wrap;">
        <button class="btn primary" data-export-fmt="pdf" style="flex:1; min-width: 160px;">📄 Download as PDF</button>
        <button class="btn" data-export-fmt="docx" style="flex:1; min-width: 160px;">📝 Download as Word</button>
      </div>
      <div class="row" style="margin-top: 14px;">
        <div class="spacer"></div>
        <button class="btn ghost" data-export-fmt="cancel">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); };
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelectorAll('[data-export-fmt]').forEach((b) => {
    b.onclick = () => {
      const fmt = b.dataset.exportFmt;
      if (fmt === 'cancel') return close();
      const _setNo = Number((overlay.querySelector('#export-set') || {}).value || 0);
      close();
      if (fmt === 'pdf') return printAssessmentPDF(assessmentId, _setNo || undefined);
      if (fmt === 'docx' && _setNo) alert('Shuffled sets are available as PDF only — downloading the original order as Word.');
      if (fmt === 'docx') return downloadAssessmentDocx(assessmentId);
    };
  });
}

async function downloadAssessmentDocx(assessmentId) {
  // Fetch the .docx as a Blob with cookies attached, then trigger a save
  // via a temporary object URL. Works without popups and without relying
  // on the browser to forward auth cookies on a new-tab navigation.
  let blob;
  try {
    const r = await fetch(`/api/assessments/${assessmentId}/export.docx`, {
      method: 'GET', credentials: 'same-origin',
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      throw new Error('Server returned ' + r.status + (txt ? ' — ' + txt.slice(0, 200) : ''));
    }
    blob = await r.blob();
  } catch (e) {
    alert('Could not download Word document: ' + e.message);
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  // Try to grab the filename from Content-Disposition; otherwise default.
  a.href = url;
  a.download = (assessmentId + '.docx');
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (a.parentNode) a.parentNode.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

// ── Listening-audio UI refs (added by listening-feature patch) ─────────────
els.audioPanel       = document.getElementById('audio-panel');
els.audioInput       = document.getElementById('audio-input');
els.audioUploadBtn   = document.getElementById('audio-upload-btn');
els.audioRemoveBtn   = document.getElementById('audio-remove');
els.audioStatus      = document.getElementById('audio-status');
els.audioPreview     = document.getElementById('audio-preview');
els.audioCurrent     = document.getElementById('audio-current');
els.audioCurrentName = document.getElementById('audio-current-name');
els.audioCurrentSize = document.getElementById('audio-current-size');

// ── Listening-audio management ─────────────────────────────────────────────
function fmtAudioSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return n + ' B';
  if (n < 1024*1024) return (n/1024).toFixed(0) + ' KB';
  return (n/(1024*1024)).toFixed(1) + ' MB';
}
function renderAudioPanel(audioFile) {
  if (!els.audioCurrent) return;
  if (audioFile && audioFile.name) {
    els.audioCurrent.style.display = '';
    els.audioCurrentName.textContent = audioFile.name;
    els.audioCurrentSize.textContent = audioFile.size ? ' · ' + fmtAudioSize(audioFile.size) : '';
    // Preview source: stream from server (avoids re-uploading on edit).
    if (editingId && els.audioPreview) {
      els.audioPreview.src = `/api/assessments/${editingId}/audio?v=${Date.now()}`;
      els.audioPreview.style.display = '';
    }
  } else {
    els.audioCurrent.style.display = 'none';
    if (els.audioPreview) { els.audioPreview.style.display = 'none'; els.audioPreview.src = ''; }
  }
}
async function uploadAudio() {
  if (!editingId) {
    els.audioStatus.textContent = 'Save the assessment first — then upload audio.';
    return;
  }
  if (!els.audioInput || !els.audioInput.files || !els.audioInput.files[0]) {
    els.audioStatus.textContent = 'Choose an audio file first.';
    return;
  }
  const file = els.audioInput.files[0];
  if (file.size > 50 * 1024 * 1024) {
    els.audioStatus.textContent = 'File too big — max 50 MB.';
    return;
  }
  els.audioStatus.textContent = 'Uploading…';
  const fd = new FormData();
  fd.append('audio', file);
  try {
    const res = await fetch(`/api/assessments/${editingId}/audio`, {
      method: 'POST',
      body: fd,
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    els.audioStatus.textContent = 'Audio uploaded. Students will hear it at the top of the assessment.';
    renderAudioPanel(data.audioFile);
  } catch (e) {
    els.audioStatus.textContent = 'Upload failed: ' + (e.message || e);
  }
}
async function removeAudio() {
  if (!editingId) return;
  if (!confirm('Remove the audio from this assessment?')) return;
  try {
    const res = await fetch(`/api/assessments/${editingId}/audio`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed');
    els.audioStatus.textContent = 'Audio removed.';
    renderAudioPanel(null);
    if (els.audioInput) els.audioInput.value = '';
  } catch (e) {
    els.audioStatus.textContent = 'Remove failed: ' + (e.message || e);
  }
}
if (els.audioUploadBtn) els.audioUploadBtn.onclick = uploadAudio;
if (els.audioRemoveBtn) els.audioRemoveBtn.onclick = removeAudio;

// Whenever the builder opens an existing assessment, sync the audio panel.
window.__syncAudioPanelForEdit = function(assessment) {
  try {
    if (assessment && assessment.audioFile) renderAudioPanel(assessment.audioFile);
    else renderAudioPanel(null);
    if (els.audioStatus) els.audioStatus.textContent = '';
  } catch {}
};

// ── Listening: browser-TTS script + voice picker ───────────────────────────
els.audioScript    = document.getElementById('audio-script');
els.audioVoice     = document.getElementById('audio-voice');
els.audioTtsTest   = document.getElementById('audio-tts-test');
els.audioTtsStop   = document.getElementById('audio-tts-stop');
els.audioTtsSave   = document.getElementById('audio-tts-save');
els.audioTtsStatus    = document.getElementById('audio-tts-status');
els.audioTtsGenerate  = document.getElementById('audio-tts-generate');
els.audioTtsRedetect  = document.getElementById('audio-tts-redetect');
els.audioSpeakersPanel = document.getElementById('audio-speakers-panel');
els.audioSpeakersList = document.getElementById('audio-speakers-list');

function populateVoiceList() {
  if (!els.audioVoice) return;
  const voices = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
  // Filter to voices matching the chosen assessment language when possible.
  const langWord = (els.assessmentLanguage && els.assessmentLanguage.value || '').toLowerCase();
  const langPrefix = {
    'english':'en','arabic':'ar','french':'fr','spanish':'es','german':'de',
    'italian':'it','portuguese':'pt','russian':'ru','chinese':'zh','japanese':'ja',
    'korean':'ko','hindi':'hi','urdu':'ur','turkish':'tr','dutch':'nl',
  }[langWord] || '';
  const filtered = langPrefix
    ? voices.filter((v) => v.lang.toLowerCase().startsWith(langPrefix))
    : voices;
  const list = filtered.length ? filtered : voices;
  els.audioVoice.innerHTML = list.length
    ? list.map((v) => `<option value="${v.name}">${v.name} — ${v.lang}${v.default ? ' (default)' : ''}</option>`).join('')
    : '<option value="">No voices installed on this device</option>';
}
// Voices populate asynchronously in Chrome — listen for the event too.
if (window.speechSynthesis) {
  speechSynthesis.onvoiceschanged = populateVoiceList;
  setTimeout(populateVoiceList, 300);
}
// Refresh when teacher switches assessment language.
if (els.assessmentLanguage) {
  els.assessmentLanguage.addEventListener('change', populateVoiceList);
}

function ttsSpeak(text, voiceName) {
  if (!('speechSynthesis' in window)) {
    if (els.audioTtsStatus) els.audioTtsStatus.textContent = 'This browser has no speech engine.';
    return;
  }
  try { speechSynthesis.cancel(); } catch {}
  const u = new SpeechSynthesisUtterance(text);
  const v = speechSynthesis.getVoices().find((x) => x.name === voiceName);
  if (v) { u.voice = v; u.lang = v.lang; }
  u.rate = 0.95;
  u.pitch = 1.0;
  speechSynthesis.speak(u);
}
function ttsStop() {
  try { speechSynthesis.cancel(); } catch {}
}
// Robust Test play — waits for voices to load, chunks long scripts so very
// long utterances don't silently fail in some browsers, and surfaces a clear
// error if the browser can't produce any speech.
async function waitForVoices(timeoutMs = 2000) {
  if (!('speechSynthesis' in window)) return [];
  let voices = speechSynthesis.getVoices();
  if (voices.length) return voices;
  return await new Promise((resolve) => {
    const t0 = Date.now();
    function poll() {
      voices = speechSynthesis.getVoices();
      if (voices.length || Date.now() - t0 > timeoutMs) return resolve(voices);
      setTimeout(poll, 80);
    }
    speechSynthesis.onvoiceschanged = poll;
    poll();
  });
}
function chunkScript(text, max = 220) {
  // Split on sentence boundaries; combine into chunks under `max` chars.
  const sentences = String(text).split(/(?<=[.!?؟。！？])\s+/);
  const chunks = [];
  let buf = '';
  for (const s of sentences) {
    if ((buf + ' ' + s).length > max && buf) { chunks.push(buf.trim()); buf = s; }
    else { buf = buf ? buf + ' ' + s : s; }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}
// Play one turn — possibly chunked across multiple utterances — with the
// chosen voice. Returns when the last chunk ends.
async function playTurn(text, voice) {
  const chunks = chunkScript(text);
  for (const c of chunks) {
    await new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(c);
      if (voice) { u.voice = voice; u.lang = voice.lang; }
      // Slight per-utterance variation makes successive turns sound less robotic.
      u.rate  = 0.92 + Math.random() * 0.08;   // 0.92–1.00
      u.pitch = 0.97 + Math.random() * 0.06;   // 0.97–1.03
      u.onend = resolve;
      u.onerror = (e) => {
        els.audioTtsStatus.textContent = 'Playback error: ' + (e.error || 'unknown') + ' — try a different voice.';
        resolve();
      };
      speechSynthesis.speak(u);
    });
    if (!speechSynthesis.speaking) break;
  }
}

async function speakScript(text, defaultVoiceName) {
  if (!('speechSynthesis' in window)) {
    els.audioTtsStatus.textContent = 'This browser has no speech engine.';
    return;
  }
  try { speechSynthesis.cancel(); } catch {}
  const voices = await waitForVoices();
  if (!voices.length) {
    els.audioTtsStatus.textContent = 'No voices installed on this device — try Chrome on desktop, or Edge for high-quality voices.';
    return;
  }
  const pickVoice = (name) => voices.find((v) => v.name === name) || null;
  const defaultVoice = pickVoice(defaultVoiceName) || voices.find((v) => v.default) || voices[0];
  const turns = parseScriptIntoTurns(text);
  if (!turns.length) { els.audioTtsStatus.textContent = 'No script to play.'; return; }
  els.audioTtsStatus.textContent = `▶ Playing preview (${turns.length} turn${turns.length === 1 ? '' : 's'})…`;
  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    const voiceName = currentAudioVoices[turn.speaker];
    const voice = pickVoice(voiceName) || defaultVoice;
    await playTurn(turn.text, voice);
    if (!speechSynthesis.speaking && i < turns.length - 1) break;
  }
  if (!speechSynthesis.speaking) els.audioTtsStatus.textContent = '✓ Preview finished.';
}

if (els.audioTtsTest) els.audioTtsTest.onclick = async () => {
  const script = (els.audioScript && els.audioScript.value || '').trim();
  if (!script) { els.audioTtsStatus.textContent = 'No script yet — click ✨ Generate script with AI, or type one.'; return; }
  const voice = els.audioVoice && els.audioVoice.value || '';
  await speakScript(script, voice);
};

// ✨ Generate script with AI — works whether the assessment has been saved
// yet or not. Saved assessments use the per-id endpoint (which also
// persists the script). Unsaved drafts use the inline endpoint and the
// next Save will persist everything together.
if (els.audioTtsGenerate) els.audioTtsGenerate.onclick = async () => {
  els.audioTtsGenerate.disabled = true;
  const originalLabel = els.audioTtsGenerate.textContent;
  els.audioTtsGenerate.textContent = '✨ Generating…';
  els.audioTtsStatus.textContent = '✨ Asking AI to write a listening script… this usually takes 5–15 seconds.';

  try {
    let data;
    if (editingId) {
      const r = await fetch(`/api/assessments/${editingId}/generate-script`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      const text = await r.text();
      try { data = JSON.parse(text); }
      catch { throw new Error('Server returned an unexpected response: ' + text.slice(0, 120)); }
      if (!r.ok) throw new Error(data.error || `Server error ${r.status}`);
    } else {
      // Unsaved draft — send the current builder state inline.
      const payload = {
        title:       els.title ? els.title.value : '',
        description: els.description ? els.description.value : '',
        subject:     els.subject ? els.subject.value : '',
        language:    els.assessmentLanguage ? els.assessmentLanguage.value : '',
        questions:   (questions || []).map((q) => ({
          type: q.type,
          prompt: q.prompt,
          options: q.options || [],
          correctAnswer: q.correctAnswer,
        })),
      };
      const r = await fetch('/api/listening/generate-script', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const text = await r.text();
      try { data = JSON.parse(text); }
      catch { throw new Error('Server returned an unexpected response: ' + text.slice(0, 120)); }
      if (!r.ok) throw new Error(data.error || `Server error ${r.status}`);
    }

    const script = (data && data.audioScript) || '';
    if (!script.trim()) throw new Error('AI returned an empty script.');
    if (els.audioScript) els.audioScript.value = script;
    currentAudioVoices = {};
    renderSpeakersPanel(script);
    els.audioTtsStatus.textContent = `✓ Script ready (${script.length} chars). Pick a voice for each speaker, then click 🔊 Test play.`;
  } catch (e) {
    els.audioTtsStatus.textContent = '❌ ' + (e.message || 'Generation failed');
    console.error('[generate-script]', e);
  } finally {
    els.audioTtsGenerate.disabled = false;
    els.audioTtsGenerate.textContent = originalLabel;
  }
};
if (els.audioTtsStop) els.audioTtsStop.onclick = ttsStop;
if (els.audioTtsSave) els.audioTtsSave.onclick = async () => {
  if (!editingId) {
    els.audioTtsStatus.textContent = 'Save the assessment first, then click Use AI voice.';
    return;
  }
  const script = (els.audioScript && els.audioScript.value || '').trim();
  if (!script) { els.audioTtsStatus.textContent = 'Write a script first.'; return; }
  const voice = els.audioVoice && els.audioVoice.value || '';
  els.audioTtsStatus.textContent = 'Saving…';
  try {
    await api(`/api/assessments/${editingId}`, {
      method: 'PUT',
      body: { audioScript: script, audioVoice: voice, audioVoices: currentAudioVoices || {} },
    });
    els.audioTtsStatus.textContent = '✓ Saved. Students will hear this script read by the AI voice when they click play.';
  } catch (e) {
    els.audioTtsStatus.textContent = 'Save failed: ' + (e.message || e);
  }
};

// ── Multi-voice dialogue support ───────────────────────────────────────────
// Match a line that starts with a speaker label.
const SPEAKER_RE = /^\s*([A-Z][A-Za-z0-9 .'’-]{0,40}?):\s*(.*)$/;

// Score a voice for "humanistic-ness" — higher = more natural.
// Most browsers don't expose a quality field, so we infer from the name.
function voiceQuality(v) {
  const n = (v.name || '').toLowerCase();
  let s = 0;
  if (n.includes('natural'))       s += 100;
  if (n.includes('neural'))        s += 100;
  if (n.includes('premium'))       s +=  80;
  if (n.includes('online'))        s +=  60;
  if (n.includes('enhanced'))      s +=  50;
  if (n.includes('eloquence'))     s -=  30;
  if (n.includes('novelty'))       s -=  50;
  // Mac System Voices "Novelty" group:
  const novelty = ['albert','bad news','bahh','bells','boing','bubbles','cellos',
    'deranged','good news','hysterical','organ','superstar','trinoids',
    'whisper','wobble','zarvox','jester','pipe organ','grandma','grandpa',
    'kathy','fred','junior','ralph','flo'];
  if (novelty.some((bad) => n.includes(bad))) s -= 100;
  if (v.localService === false)    s +=  20;   // remote/cloud voices are usually better
  return s;
}
function sortVoices(voices) {
  return [...voices].sort((a, b) => voiceQuality(b) - voiceQuality(a) || a.name.localeCompare(b.name));
}
function voicesForCurrentLanguage() {
  const all = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
  const langWord = (els.assessmentLanguage && els.assessmentLanguage.value || '').toLowerCase();
  const prefix = ({english:'en',arabic:'ar',french:'fr',spanish:'es',german:'de',italian:'it',portuguese:'pt',russian:'ru',chinese:'zh',japanese:'ja',korean:'ko',hindi:'hi',urdu:'ur',turkish:'tr',dutch:'nl'})[langWord] || '';
  const filtered = prefix ? all.filter((v) => v.lang.toLowerCase().startsWith(prefix)) : all;
  return sortVoices(filtered.length ? filtered : all);
}
function voiceOptionsHtml(voices, selected) {
  // Group: humanistic (positive score) first, then a "Less natural" optgroup.
  const top = voices.filter((v) => voiceQuality(v) >= 0);
  const low = voices.filter((v) => voiceQuality(v) <  0);
  const opt = (v) => `<option value="${v.name.replace(/"/g, '&quot;')}" ${v.name === selected ? 'selected' : ''}>${v.name} — ${v.lang}${v.default ? ' (default)' : ''}</option>`;
  return [
    top.length ? '<optgroup label="More humanistic voices">' + top.map(opt).join('') + '</optgroup>' : '',
    low.length ? '<optgroup label="Less natural voices">'   + low.map(opt).join('') + '</optgroup>' : '',
  ].join('');
}
function detectSpeakersInScript(script) {
  const speakers = [];
  const seen = new Set();
  String(script || '').split(/\r?\n/).forEach((line) => {
    const m = line.match(SPEAKER_RE);
    if (m && m[2]) {
      const label = m[1].trim();
      if (!seen.has(label)) { seen.add(label); speakers.push(label); }
    }
  });
  return speakers;
}
// Hold the teacher's current per-speaker voice choices in memory.
let currentAudioVoices = {};
function autoAssignVoices(speakers, voices) {
  // Try to alternate by likely gender by scanning the voice name for hints.
  const isFemale = (v) => /female|woman|samantha|victoria|karen|moira|tessa|fiona|kate|allison|ava|susan|alice|amelia|emma|olivia|nora|salma|laila|aria|jenny|sara|isabella|joanna|kendra|veena|kalpana|amira|naayf/i.test(v.name);
  const isMale   = (v) => /male|man|daniel|alex|tom|fred|david|mark|james|oliver|reed|albert|kevin|brian|guy|matthew|justin|alonzo|maged|tarek|raid|wael|naayf|hamza/i.test(v.name);
  const females = voices.filter(isFemale);
  const males   = voices.filter(isMale);
  const rest    = voices.filter((v) => !isFemale(v) && !isMale(v));
  const fan = [];
  const max = Math.max(females.length, males.length);
  for (let i = 0; i < max; i++) {
    if (i < females.length) fan.push(females[i]);
    if (i < males.length)   fan.push(males[i]);
  }
  fan.push(...rest);
  const out = {};
  speakers.forEach((s, i) => { if (fan[i % fan.length]) out[s] = fan[i % fan.length].name; });
  return out;
}
function renderSpeakersPanel(scriptOverride) {
  if (!els.audioSpeakersPanel) return;
  const script = scriptOverride !== undefined ? scriptOverride : (els.audioScript && els.audioScript.value) || '';
  const speakers = detectSpeakersInScript(script);
  const voices   = voicesForCurrentLanguage();
  // Always show the default-narration dropdown.
  if (els.audioVoice) {
    const current = els.audioVoice.value;
    els.audioVoice.innerHTML = voiceOptionsHtml(voices, current);
  }
  if (!speakers.length) {
    els.audioSpeakersList.innerHTML = '<div class="muted" style="font-size: 12px;">No speaker labels found. If this is a dialogue, prefix each turn with a name and a colon — e.g. <code>Speaker 1: …</code>, <code>Sarah: …</code>. For a monologue/announcement, the default narration voice will be used.</div>';
    els.audioSpeakersPanel.style.display = '';
    return;
  }
  // Initialise voice choices: keep any existing assignments, auto-assign
  // the rest distinctly.
  const auto = autoAssignVoices(speakers, voices);
  speakers.forEach((s) => {
    if (!currentAudioVoices[s]) currentAudioVoices[s] = auto[s] || '';
  });
  // Render one row per speaker.
  els.audioSpeakersList.innerHTML = speakers.map((s) => `
    <div class="row" style="gap: 8px; align-items: center;">
      <strong style="flex: 0 0 130px; color:#1a1e33;">${s}:</strong>
      <select data-speaker="${s.replace(/"/g, '&quot;')}" class="audio-speaker-select" style="flex:1; padding: 6px; border-radius: 8px; border: 1px solid #c69214;">
        ${voiceOptionsHtml(voices, currentAudioVoices[s])}
      </select>
    </div>
  `).join('');
  els.audioSpeakersPanel.style.display = '';
  // Wire each dropdown to update the in-memory map.
  els.audioSpeakersList.querySelectorAll('.audio-speaker-select').forEach((sel) => {
    sel.addEventListener('change', () => {
      currentAudioVoices[sel.getAttribute('data-speaker')] = sel.value;
    });
  });
}
// Re-render automatically when the script changes (debounced).
let _speakerDebounce = null;
if (els.audioScript) {
  els.audioScript.addEventListener('input', () => {
    clearTimeout(_speakerDebounce);
    _speakerDebounce = setTimeout(() => renderSpeakersPanel(), 400);
  });
}
if (els.audioTtsRedetect) els.audioTtsRedetect.onclick = () => renderSpeakersPanel();
// Re-render after voice list loads.
if (window.speechSynthesis) {
  const prev = speechSynthesis.onvoiceschanged;
  speechSynthesis.onvoiceschanged = function () {
    try { if (prev) prev.apply(this, arguments); } catch {}
    renderSpeakersPanel();
  };
}

// Override the existing populateVoiceList — same as before but uses
// sortVoices + filtered set so the dropdown order is humanistic-first.
function populateVoiceList() {
  if (!els.audioVoice) return;
  const voices = voicesForCurrentLanguage();
  els.audioVoice.innerHTML = voices.length
    ? voiceOptionsHtml(voices, els.audioVoice.value)
    : '<option value="">No voices installed on this device</option>';
}

// Parse script into [{speaker, text}, ...] for the playback engine.
function parseScriptIntoTurns(script) {
  const turns = [];
  let current = { speaker: '', text: [] };
  String(script || '').split(/\r?\n/).forEach((line) => {
    const m = line.match(SPEAKER_RE);
    if (m && m[2] !== undefined) {
      // New turn starts.
      if (current.text.length) turns.push({ speaker: current.speaker, text: current.text.join('\n').trim() });
      current = { speaker: m[1].trim(), text: [m[2]] };
    } else {
      if (line.trim()) current.text.push(line);
    }
  });
  if (current.text.length) turns.push({ speaker: current.speaker, text: current.text.join('\n').trim() });
  return turns.filter((t) => t.text);
}

// ── Admin-only: Export users CSV button ────────────────────────────────────
(async function setupAdminExport() {
  const btn = document.getElementById('admin-export-users');
  if (!btn) return;
  try {
    const r = await fetch('/api/admin/is-admin', { credentials: 'include' });
    const data = await r.json().catch(() => ({}));
    if (data && data.isAdmin) {
      btn.style.display = '';
      btn.onclick = () => {
        // Direct browser navigation triggers the file download. The endpoint
        // sends Content-Disposition: attachment so the browser saves it.
        window.location.href = '/api/admin/users-export';
      };
      // Second admin button — students grouped by class.
      const classBtn = document.getElementById('admin-export-classes');
      if (classBtn) {
        // Buttons stay always-visible inside the dropdown; we toggle the
        // whole admin-menu-wrap container below instead.
        classBtn.onclick = () => {
          window.location.href = '/api/admin/students-by-class-export';
        };
      }
      // Third admin button — disk usage modal.
      const diskBtn = document.getElementById('admin-disk-usage');
      if (diskBtn) {
        diskBtn.onclick = showDiskUsageModal;
      }
      // Fourth admin button — re-run the /40 essay rescale migration.
      const rescaleBtn = document.getElementById('admin-rescale-essays');
      if (rescaleBtn) {
        rescaleBtn.onclick = async () => {
          if (!confirm('Re-scale every previously auto-graded essay to /40?\n\nSafe to run multiple times — only essays where the max isn\'t already 40 get touched.')) return;
          rescaleBtn.disabled = true;
          rescaleBtn.textContent = '🔁 Rescaling…';
          try {
            const r = await fetch('/api/admin/rescale-essays', { method: 'POST', credentials: 'include' });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || 'Failed');
            alert(`✓ Rescaled ${data.touched} auto-graded essay(s) to /40.`);
            // Reload assessment list so any open Results panel re-fetches fresh data.
            if (typeof loadAssessments === 'function') loadAssessments();
          } catch (e) {
            alert('❌ Rescale failed: ' + (e.message || 'unknown error'));
          } finally {
            rescaleBtn.disabled = false;
            rescaleBtn.textContent = '🔁 Rescale essays to /40';
          }
        };
      }
      // Show the whole admin dropdown wrap (which contains all 3 items).
      const adminWrap = document.getElementById('admin-menu-wrap');
      if (adminWrap) {
        adminWrap.style.display = '';
        const toggle = document.getElementById('admin-menu-toggle');
        const menu = document.getElementById('admin-menu-dropdown');
        toggle.onclick = (e) => {
          e.stopPropagation();
          menu.style.display = (menu.style.display === 'none' || !menu.style.display) ? 'block' : 'none';
        };
        // Close when clicking outside the dropdown.
        document.addEventListener('click', (e) => {
          if (!adminWrap.contains(e.target)) menu.style.display = 'none';
        });
      }
    }
  } catch {}
})();

function fmtBytes(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
  return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}
async function showDiskUsageModal() {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed; inset:0; background:rgba(11,16,32,0.55); z-index:2147483645; display:flex; align-items:center; justify-content:center;';
  overlay.innerHTML = `
    <div style="background:#fff; border-radius:12px; padding:24px 28px; max-width: 560px; width: 92%; box-shadow:0 16px 48px rgba(0,0,0,0.30);">
      <h2 style="margin:0 0 8px; color:#1a1e33;">💾 Disk usage</h2>
      <p class="muted" style="margin:0 0 16px; font-size:14px;">Persistent disk on Render — survives every restart.</p>
      <div id="disk-body" class="muted">Loading…</div>
      <div class="row" style="gap:10px; justify-content:flex-end; margin-top:16px;">
        <button class="btn" id="disk-close">Close</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const close = () => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); };
  document.getElementById('disk-close').onclick = close;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  try {
    const r = await fetch('/api/admin/disk-usage', { credentials: 'include' });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Failed');
    const pct = (data.total && data.used) ? Math.min(100, Math.round((data.used / data.total) * 100)) : null;
    const barColor = pct == null ? '#94a3b8' : pct > 90 ? '#dc2626' : pct > 70 ? '#f59e0b' : '#16a34a';
    const breakdownRows = Object.entries(data.breakdown || {})
      .sort((a, b) => b[1] - a[1])
      .map(([name, bytes]) => `
        <div class="row" style="gap:10px; padding:6px 0; border-bottom:1px solid #e5e7eb; font-size:14px;">
          <code style="flex:1; color:#1a1e33;">${name}</code>
          <span style="color:#475569;">${fmtBytes(bytes)}</span>
        </div>
      `).join('');
    document.getElementById('disk-body').innerHTML = `
      <div style="background:#f1f5f9; border-radius:8px; padding:14px; margin-bottom:14px;">
        <div style="display:flex; justify-content:space-between; font-weight:700; color:#1a1e33; margin-bottom:6px;">
          <span>Total ${fmtBytes(data.total)}</span>
          <span>Free ${fmtBytes(data.free)} (${data.total ? Math.round((data.free / data.total) * 100) : '—'}%)</span>
        </div>
        ${pct == null ? '<div class="muted" style="font-size:13px;">df not available — volume totals unknown.</div>' : `
          <div style="background:#e2e8f0; border-radius:6px; overflow:hidden; height:14px;">
            <div style="background:${barColor}; height:100%; width:${pct}%;"></div>
          </div>
          <div style="font-size:13px; color:#475569; margin-top:4px;">${pct}% used &nbsp;·&nbsp; ${fmtBytes(data.used)} of ${fmtBytes(data.total)}</div>
        `}
      </div>
      <div style="font-weight:700; color:#1a1e33; margin-bottom:6px;">What's in your /data folder (${fmtBytes(data.dataFolderSize)} total):</div>
      ${breakdownRows || '<div class="muted">No files yet.</div>'}
      <div class="muted" style="font-size:12px; margin-top:12px;">Mount: <code>${data.mount || '—'}</code> · Path: <code>${data.diskPath}</code></div>
    `;
  } catch (e) {
    document.getElementById('disk-body').innerHTML = '<div style="color:#dc2626;">❌ ' + (e.message || 'Could not load disk usage.') + '</div>';
  }
}

// ── Match-the-following editor ─────────────────────────────────────────────
function renderMatchEditor(q) {
  const variant = q.matchVariant || 'word-definition';
  const pairs   = Array.isArray(q.pairs) ? q.pairs : [];
  const showImg = variant === 'word-picture';
  const rows = pairs.map((p, i) => `
    <div class="row" style="gap:6px; align-items:flex-start; margin-bottom:6px;">
      <input type="text" data-mp-i="${i}" data-mp-f="left" placeholder="Left item (e.g. word)" value="${(p.left || '').replace(/"/g, '&quot;')}" style="flex:1; padding:6px; border:1px solid #cbd5e1; border-radius:6px;" />
      <span style="line-height:32px; color:#6b7280;">↔</span>
      <input type="text" data-mp-i="${i}" data-mp-f="right" placeholder="${showImg ? 'Optional caption' : 'Right item (definition / matching word)'}" value="${(p.right || '').replace(/"/g, '&quot;')}" style="flex:2; padding:6px; border:1px solid #cbd5e1; border-radius:6px;" />
      ${showImg ? `
        <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
          <label class="btn" style="padding:4px 8px; font-size:12px;">📷 Image
            <input type="file" data-mp-i="${i}" data-mp-img="1" accept="image/*" style="display:none;" />
          </label>
          ${p.rightImageUrl ? `<img src="${p.rightImageUrl}" style="height:38px; border-radius:4px; border:1px solid #cbd5e1;" />` : ''}
        </div>
      ` : ''}
      <button type="button" class="btn danger" data-mp-i="${i}" data-mp-del="1" style="padding:4px 8px;">✕</button>
    </div>
  `).join('');
  return `
    <div class="muted" style="font-size:13px; margin-bottom:6px;">Pairs (left ↔ correct right). The student sees the right column SHUFFLED.</div>
    <div class="row" style="gap:8px; margin-bottom:8px;">
      <label style="font-size:13px; font-weight:600;">Type:</label>
      <select data-mv style="padding:6px; border:1px solid #cbd5e1; border-radius:6px;">
        <option value="word-definition" ${variant === 'word-definition' ? 'selected' : ''}>Word ↔ definition</option>
        <option value="word-word"        ${variant === 'word-word'        ? 'selected' : ''}>Word ↔ word</option>
        <option value="word-picture"     ${variant === 'word-picture'     ? 'selected' : ''}>Word ↔ picture</option>
      </select>
    </div>
    <div data-mp-rows>${rows}</div>
    <button type="button" class="btn" data-mp-add="1" style="margin-top:6px;">+ Add pair</button>
  `;
}

// Wire interactions inside a freshly-rendered match editor.
function wireMatchEditor(qWrap, q) {
  if (!qWrap) return;
  const refresh = () => {
    const host = qWrap.querySelector('[data-match-host]');
    if (host) host.innerHTML = renderMatchEditor(q);
    wireMatchEditor(qWrap, q);
  };
  const variantSel = qWrap.querySelector('[data-mv]');
  if (variantSel) variantSel.onchange = () => { q.matchVariant = variantSel.value; refresh(); };
  qWrap.querySelectorAll('[data-mp-f]').forEach((inp) => {
    inp.oninput = () => {
      const i = Number(inp.getAttribute('data-mp-i'));
      const f = inp.getAttribute('data-mp-f');
      if (!q.pairs[i]) q.pairs[i] = { left: '', right: '', rightImageUrl: '' };
      q.pairs[i][f] = inp.value;
    };
  });
  qWrap.querySelectorAll('[data-mp-img]').forEach((inp) => {
    inp.onchange = async () => {
      const i = Number(inp.getAttribute('data-mp-i'));
      const f = inp.files && inp.files[0];
      if (!f) return;
      try {
        const url = await compressImageToDataUrl(f, 600);
        if (!q.pairs[i]) q.pairs[i] = { left: '', right: '', rightImageUrl: '' };
        q.pairs[i].rightImageUrl = url;
        refresh();
      } catch (e) { alert('Image upload failed: ' + e.message); }
    };
  });
  qWrap.querySelectorAll('[data-mp-del]').forEach((btn) => {
    btn.onclick = () => {
      const i = Number(btn.getAttribute('data-mp-i'));
      q.pairs.splice(i, 1);
      refresh();
    };
  });
  const addBtn = qWrap.querySelector('[data-mp-add]');
  if (addBtn) addBtn.onclick = () => {
    if (!Array.isArray(q.pairs)) q.pairs = [];
    q.pairs.push({ left: '', right: '', rightImageUrl: '' });
    refresh();
  };
}

// Post-render hook: replace any match-question body with the rich editor.
(function attachMatchPostRender() {
  const origRender = typeof renderQuestions === 'function' ? renderQuestions : null;
  if (!origRender) return;
  window.renderQuestions = function () {
    origRender.apply(this, arguments);
    document.querySelectorAll('[data-q-id], .q-row[id^="q-"]').forEach((row) => {
      const id = row.getAttribute('data-q-id') || row.id.slice(2);
      const q = questions.find((x) => x.id === id);
      if (!q || q.type !== 'match') return;
      if (!Array.isArray(q.pairs)) q.pairs = [{ left: '', right: '', rightImageUrl: '' }];
      // Replace the body of the row with the match editor.
      let host = row.querySelector('[data-match-host]');
      if (!host) {
        // Build a host div at the end of the row.
        const wrap = document.createElement('div');
        wrap.setAttribute('data-match-host', '1');
        wrap.style.cssText = 'margin-top: 8px; padding: 10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;';
        row.appendChild(wrap);
        host = wrap;
      }
      host.innerHTML = renderMatchEditor(q);
      wireMatchEditor(row, q);
    });
  };
})();

// ── 📖 User Guide modal ────────────────────────────────────────────────────
(function setupUserGuideButton() {
  const btn = document.getElementById('open-user-guide');
  if (!btn) return;
  btn.onclick = openUserGuide;
})();

function openUserGuide() {
  // Avoid double-open.
  if (document.getElementById('cc-user-guide-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'cc-user-guide-overlay';
  overlay.style.cssText = 'position:fixed; inset:0; background:rgba(11,16,32,0.55); z-index:2147483645; display:flex; align-items:center; justify-content:center; padding: 24px;';
  overlay.innerHTML = `
    <div style="background:#fff; border-radius:14px; padding:0; max-width: 900px; width:100%; max-height: 90vh; display:flex; flex-direction:column; box-shadow:0 16px 48px rgba(0,0,0,0.30);">
      <div style="padding: 18px 22px; border-bottom: 1px solid #e5e7eb; background: linear-gradient(135deg, #4338ca, #6d28d9); color:#fff; border-radius: 14px 14px 0 0;">
        <div class="row" style="align-items:center;">
          <h2 style="margin:0; flex:1;">📖 ClassCurio User Guide</h2>
          <select id="cc-ug-lang" data-no-translate="1" style="margin-right: 8px; padding: 6px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.4); background: rgba(255,255,255,0.95); font-size: 12px; cursor: pointer; max-width: 140px;"><option value="">🌐 English</option><option value="ar">🌐 العربية</option><option value="hi">🌐 हिन्दी</option><option value="zh">🌐 中文</option><option value="es">🌐 Español</option><option value="fr">🌐 Français</option><option value="th">🌐 ไทย</option><option value="bn">🌐 বাংলা</option><option value="ur">🌐 اردو</option><option value="ta">🌐 தமிழ்</option><option value="te">🌐 తెలుగు</option><option value="ml">🌐 മലയാളം</option><option value="pa">🌐 ਪੰਜਾਬੀ</option><option value="id">🌐 Indonesia</option><option value="ms">🌐 Melayu</option><option value="vi">🌐 Tiếng Việt</option><option value="tl">🌐 Filipino</option><option value="km">🌐 ខ្មែរ</option><option value="ja">🌐 日本語</option><option value="ko">🌐 한국어</option><option value="fa">🌐 فارسی</option><option value="tr">🌐 Türkçe</option><option value="he">🌐 עברית</option><option value="sw">🌐 Kiswahili</option><option value="de">🌐 Deutsch</option><option value="it">🌐 Italiano</option><option value="pt">🌐 Português</option><option value="ru">🌐 Русский</option><option value="pl">🌐 Polski</option><option value="nl">🌐 Nederlands</option></select><a href="/docs/ClassCurio_Teacher_Guide.docx" download class="btn" style="background: rgba(255,255,255,0.18); color:#fff; border:1px solid rgba(255,255,255,0.4); margin-right: 6px;">📥 Word</a>
          <a href="/docs/ClassCurio_Teacher_Guide.pdf"  download class="btn" style="background: rgba(255,255,255,0.18); color:#fff; border:1px solid rgba(255,255,255,0.4); margin-right: 6px;">📥 PDF</a>
          <button id="cc-ug-close" class="btn" style="background: rgba(255,255,255,0.18); color:#fff; border:1px solid rgba(255,255,255,0.4);">Close</button>
        </div>
      </div>
      <div id="cc-ug-body" style="overflow-y:auto; padding: 20px 28px; line-height:1.55; color:#1a1e33;"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('cc-ug-body').innerHTML = USER_GUIDE_HTML;
  const close = () => { overlay.remove(); };
  document.getElementById('cc-ug-close').onclick = close;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  // Restore last-chosen guide language + wire change handler.
  const langSel = document.getElementById('cc-ug-lang');
  if (langSel) {
    try { langSel.value = localStorage.getItem('cc_ug_lang') || ''; } catch {}
    if (langSel.value) _ccTranslateGuide(langSel.value);
    langSel.onchange = () => {
      try { localStorage.setItem('cc_ug_lang', langSel.value); } catch {}
      _ccTranslateGuide(langSel.value);
    };
  }
}

async function _ccTranslateGuide(targetLang) {
  const body = document.getElementById('cc-ug-body');
  if (!body) return;
  if (!targetLang) {
    body.innerHTML = USER_GUIDE_HTML;
    body.removeAttribute('dir');
    return;
  }
  body.innerHTML = '<div style="text-align:center; color:#6b7280; padding:30px;">Translating User Guide… this takes ~10 seconds the first time.</div>';
  try {
    const r = await fetch('/api/translate-guide', {
      method: 'POST', credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetLang: targetLang, html: USER_GUIDE_HTML }),
    });
    const data = await r.json();
    if (!r.ok || !data.html) throw new Error((data && data.error) || 'Translation failed');
    body.innerHTML = data.html;
    if (['ar','he','fa','ur'].indexOf(targetLang) >= 0) body.setAttribute('dir', 'rtl');
    else body.removeAttribute('dir');
  } catch (e) {
    body.innerHTML = USER_GUIDE_HTML;
    body.removeAttribute('dir');
    alert('Could not translate the guide: ' + (e.message || ''));
  }
}

// Inline guide content — mirrors the DOCX/PDF available for download.
const USER_GUIDE_HTML = `
<style>
  #cc-ug-body h2 { color:#1a1e33; margin: 22px 0 8px; font-size: 20px; }
  #cc-ug-body h3 { color:#4338ca; margin: 16px 0 6px; font-size: 16px; }
  #cc-ug-body p  { margin: 8px 0; }
  #cc-ug-body ol, #cc-ug-body ul { margin: 6px 0 12px 22px; }
  #cc-ug-body li { margin: 4px 0; }
  #cc-ug-body code { background:#f1f5f9; padding: 1px 5px; border-radius: 4px; font-size: 13px; }
  #cc-ug-body .tip { background:#fef7e6; border-left: 4px solid #f59e0b; padding: 10px 14px; margin: 10px 0; border-radius: 4px; }
  #cc-ug-body .note { background:#eff6ff; border-left: 4px solid #2563eb; padding: 10px 14px; margin: 10px 0; border-radius: 4px; }
</style>

<h2>1. Signing in</h2>
<p><strong>First time:</strong> click the Register tab on the sign-in page, enter your name, email, password, choose Teacher, click Register.</p>
<p><strong>Returning:</strong> click Sign in tab, enter email + password, click Sign in.</p>
<p><strong>Forgot password:</strong> click the "Forgot password?" link on the sign-in page, enter your email and new password — it's applied immediately.</p>

<h2>2. Dashboard tour</h2>
<ul>
  <li><strong>Class dropdown</strong> (top) — switch between the classes you teach.</li>
  <li><strong>Assessment cards</strong> — each one has Share with students, Results, PDF, Share with teacher, Edit, Duplicate, Delete.</li>
  <li><strong>Filters</strong> — narrow by term, grade, or academic year.</li>
  <li><strong>Views</strong> — toggle between List and Calendar.</li>
  <li><strong>Buttons in the topbar</strong> — UI language, your name + email, Sign out. Admins also see 👥 Export users, 🏫 Export students by class, 💾 Disk usage.</li>
</ul>

<h2>3. Managing classes</h2>
<p>Click <strong>⚙ Manage classes</strong> in the topbar.</p>
<ol>
  <li>Type the class name in the "New class" field (e.g. "Grade 11 English — Section A").</li>
  <li>Click Add. The new class appears in the dropdown immediately.</li>
  <li>To delete: click the trash icon next to a class. This also removes its student roster and assessments — be careful.</li>
</ol>

<h2>4. Adding students to a class</h2>
<p>Four ways:</p>
<h3>Upload a CSV / PDF / Word list</h3>
<ol>
  <li>⚙ Manage classes → click the class.</li>
  <li>Click 📋 Upload roster.</li>
  <li>Choose your file (one student per line: name, email).</li>
  <li>Click Upload → review → Confirm.</li>
</ol>
<h3>Add a single student manually</h3>
<ol>
  <li>⚙ Manage classes → ➕ Add student → type name + email → Save.</li>
  <li>A temporary password appears — share it with the student.</li>
</ol>
<h3>Pre-register a whole class with temp passwords</h3>
<ol>
  <li>⚙ Manage classes → 🔐 Pre-register students → upload CSV.</li>
  <li>Click <strong>💾 Download credentials CSV immediately</strong> — this is your only chance.</li>
  <li>On first sign-in, each student is forced to change their password.</li>
</ol>
<h3>Auto-sync from results</h3>
<p>If students self-registered and took an assessment but aren't on the roster, click <strong>🔄 Sync from results</strong>. ClassCurio scans every result for that class and adds missing students.</p>

<h2>5. Editing or moving students</h2>
<ul>
  <li><strong>Edit name/email:</strong> Manage classes → click the student → Edit → Save.</li>
  <li><strong>Move/copy to another class:</strong> Tick the checkbox(es) → click Move to… or Copy to… → pick destination.</li>
  <li><strong>Bulk delete:</strong> Tick the students → Delete selected → confirm.</li>
</ul>


<h2>5b. Organising assessments with folders (NEW)</h2>
<p>Each class now has its own set of folders so you can group assessments by topic, year, or term. Examples: <em>Reading</em>, <em>Writing</em>, <em>2025-2026 Term 1</em>, <em>Old papers</em>.</p>
<h3>Create a folder</h3>
<ol>
  <li>Pick the class with the class dropdown.</li>
  <li>Click <strong>+ New folder</strong> in the 📁 Folders bar above the assessment list.</li>
  <li>Enter the name, optional year, optional term. Done.</li>
</ol>
<h3>Filter by folder</h3>
<p>Click any folder chip to see only its assessments. Click <strong>All</strong> to show every assessment in the class again.</p>
<h3>Move an assessment</h3>
<ol>
  <li>On any assessment card, click <strong>📂 Move</strong>.</li>
  <li>Choose a destination class (any class you own) and folder.</li>
  <li>Click Move. The assessment hops over instantly — folder picker auto-refreshes when you change class.</li>
</ol>
<div class="tip"><strong>Tip:</strong> Use folders to separate current-year work from archived old papers, or split a class into Reading / Writing / Speaking / Listening folders.</div>

<h2>6. Creating an assessment — with AI (fastest)</h2>
<ol>
  <li>Click <strong>+ New assessment</strong>.</li>
  <li>Click <strong>✨ Generate with AI</strong>.</li>
  <li>Choose Subject (English, Math, Listening, IELTS, TOEFL, PISA, …) and Language.</li>
  <li>Pick how many questions.</li>
  <li>Describe what you want — e.g. <em>"30 minutes, 10 questions on photosynthesis for Grade 9 biology, include 2 short-answer."</em></li>
  <li>Optional: drag in a scheme of work, past paper, or screenshot.</li>
  <li>Click Generate. The builder opens with everything pre-filled.</li>
  <li>Review every question, edit anything, click Save.</li>
</ol>

<h2>7. Preview the assessment (NEW)</h2>
<p>After you save (or duplicate) an assessment, click <strong>👁 Preview</strong> on the assessment card to open a read-only view in a new tab. You will see every section, passage, question, audio, and match-the-following pair exactly as a student would.</p>
<ul>
  <li>Toggle <strong>Show answer key</strong> at the top to verify correct answers.</li>
  <li>No lockdown runs in preview — you can navigate freely.</li>
  <li>Click <strong>✎ Edit this assessment</strong> in the preview's top bar to jump back into the builder if you spot something to fix.</li>
</ul>
<div class="tip"><strong>Tip:</strong> Always preview a new assessment once before sharing the link with students. It's the fastest way to catch typos, missing options, or pairs you forgot to fill in.</div>

<h2>8. Creating an assessment — manually</h2>
<p>Click <strong>+ New assessment</strong> → <strong>Start from scratch</strong>.</p>
<h3>Basic settings</h3>
<ul>
  <li>Title, Class, Subject, Language, Grade level, Academic year, Term, Date, Duration.</li>
  <li><strong>Delivery mode</strong> — Online (webcam mandatory) or On-site (you supervise; no webcam).</li>
  <li><strong>Published / Draft</strong> — only Published assessments are visible to students.</li>
</ul>
<h3>Sections + questions</h3>
<ol>
  <li>Click <strong>+ Section</strong>. Give it a title + instructions.</li>
  <li>If the section has a reading passage, paste it into the Reading passage box.</li>
  <li>Add questions: + Multiple choice, + True/False, + True/False/Not Given, + Short answer, + Long answer, + Essay (manual or auto), + Match the following.</li>
  <li>Click Save when done.</li>
</ol>
<div class="tip"><strong>Tip:</strong> Essay (auto-graded) uses Claude with the rubric you picked — Stage 7 or 8 for IB, 3–5 / 5–9 for primary/middle.</div>

<h2>9. Reading comprehension + highlighter</h2>
<p>When a section has a reading passage, students see a vertical yellow highlighter toolbar on the left during the exam. They can:</p>
<ul>
  <li>Select text in the passage → click <strong>Highlight</strong> to mark it yellow.</li>
  <li>Click <strong>Erase</strong> then a highlighted span to remove that one.</li>
  <li>Click <strong>Clear all</strong> to remove every highlight.</li>
</ul>
<p>Highlights persist if the student briefly loses focus or is granted re-entry.</p>

<h2>10. Listening assessments (audio)</h2>
<h3>Subject choices</h3>
<ul>
  <li><strong>Listening</strong> — practice mode. Audio can be played <strong>twice</strong>.</li>
  <li><strong>IELTS / TOEFL / PISA</strong> — official exam mode. Audio plays <strong>once only</strong>, no replays.</li>
</ul>
<h3>Option A — Upload your own MP3</h3>
<ol>
  <li>Save the assessment first.</li>
  <li>Scroll to the 🎧 Listening audio panel.</li>
  <li>Choose File → Upload audio. Max 50 MB. Formats: MP3, M4A, WAV, OGG, AAC.</li>
</ol>
<h3>Option B — Free AI voice (no file needed)</h3>
<ol>
  <li>In the 🎧 Listening audio panel, click <strong>✨ Generate script with AI</strong>. ~10s later the textarea fills with a transcript that matches your questions.</li>
  <li>The 🎭 Speakers panel auto-detects every speaker label (Speaker 1, Sarah, Dr. Khan, …) and assigns distinct voices.</li>
  <li>Pick a voice per speaker (more humanistic voices are listed first) + a default narration voice.</li>
  <li>Click <strong>🔊 Test play</strong> to preview.</li>
  <li>Click <strong>Use AI voice</strong> (or Save) to persist everything.</li>
</ol>
<div class="tip"><strong>Tip:</strong> For more natural voices: on Mac download Premium voices in System Settings → Accessibility → Spoken Content. On Windows, use Edge for the Microsoft Natural voices.</div>

<h2>11. Match the following</h2>
<p>In the builder, click <strong>+ Match the following</strong>. Three variants:</p>
<ul>
  <li><strong>Word ↔ definition</strong> (default)</li>
  <li><strong>Word ↔ word</strong></li>
  <li><strong>Word ↔ picture</strong> — each right item has a 📷 Image uploader</li>
</ul>
<p>The student sees the right column shuffled. Score: <code>points / pairs</code> per correct match. AI Generator and Quick Import preserve match questions from uploaded papers; pictures embedded in PDFs/DOCX come through automatically (when poppler-utils is installed on the server).</p>

<h2>12. Lockdown + 3-violation rule</h2>
<p>The exam blocks copy, paste, right-click, screenshots (where possible), tab-switching, and full-screen exits. Each event = 1 violation. On the <strong>3rd violation</strong>, the assessment auto-submits.</p>
<ul>
  <li>Tab switch / Cmd+Tab / minimise → 1 strike</li>
  <li>Window loses focus → 1 strike</li>
  <li>Exit full-screen → 1 strike</li>
  <li>Screenshot keypress → 1 strike</li>
  <li>Webcam off / covered / muted → 1 strike (online mode)</li>
  <li>Different face / no face visible → 1 strike (online mode)</li>
</ul>
<div class="note"><strong>macOS screenshot caveat:</strong> Cmd+Shift+3/4/5 are intercepted by the OS before the browser sees them. For true screenshot prevention, students must use the ClassCurio <strong>desktop app</strong>.</div>

<h2>13. Sharing with students</h2>
<ol>
  <li>Make sure the assessment is <strong>Published</strong>.</li>
  <li>Click 🔗 <strong>Share with students</strong> → Copy.</li>
  <li>Paste the link into your classroom chat (WhatsApp, Email, Teams, …).</li>
  <li>Students click → sign in → start.</li>
</ol>
<h3>Sharing with another teacher</h3>
<p>Click 🤝 <strong>Share with teacher</strong> for a teacher-only preview link. The receiving teacher can preview, print, or Duplicate into their own class with one click.</p>

<h2>14. Viewing results + analytics</h2>
<ol>
  <li>Click <strong>Results</strong> on the assessment card.</li>
  <li>The Class analytics panel shows the distribution by band (Low/Med/High, A1–C2 for language, PISA Level 1–6 for Math/Science).</li>
  <li>Each student row has a Report card button — opens detail with every question, the student's answer, the correct answer, and Claude's essay feedback.</li>
  <li>Disagree with an auto grade? Click <strong>Override grade</strong> and enter your own.</li>
</ol>
<h3>Exporting</h3>
<ul>
  <li>📊 Excel scoresheet — all results as a spreadsheet.</li>
  <li>📄 PDF — blank assessment as printable PDF.</li>
  <li>Word doc — editable .docx version.</li>
</ul>

<h2>15. Re-entry for locked-out students</h2>
<p>If a student violates the 3-strike rule or loses connection, you can grant a one-time re-entry.</p>
<ol>
  <li>Open Results for that assessment.</li>
  <li>Find the student → click <strong>Grant re-entry</strong>.</li>
  <li>If the student isn't in the list (because they were logged out before submitting anything), use the <strong>Grant re-entry by email</strong> panel at the bottom — enter their email → Grant.</li>
  <li>Tell the student to sign in again and reopen the assessment. They'll resume from where they left off, with previous answers pre-filled.</li>
</ol>

<h2>16. Settings + AI key</h2>
<p>The AI features (generate, grade, identity check, vision) all need an Anthropic API key. Add yours in <strong>Settings → API key</strong>. Stored on the server only, never shared with students.</p>

<h2>17. Tips for first-time deployment</h2>
<ul>
  <li>Pilot one assessment with a small group before rolling out school-wide.</li>
  <li>For listening exams, the desktop app gives the cleanest lockdown.</li>
  <li>Tell students to allow webcam permission and run full-screen (both required for online mode).</li>
  <li>Override AI grades whenever Claude's mark needs adjusting.</li>
  <li>Pre-register students with temp passwords for the first session, then they choose their own.</li>
</ul>

<div class="tip" style="margin-top: 24px;">
  Need the guide as a file? Use the <strong>📥 Word</strong> or <strong>📥 PDF</strong> buttons in the top bar of this modal — both are also bilingual (English + Arabic in one file).
</div>
`;

// CC: dashboard-only watchdog. If no editor surface is set to display:block,
// force cc-list-only so the builder/results/etc. can't leak through.
(function dashboardWatchdog() {
  function isAnyEditorVisible() {
    return ['builder-view','results-view','template-picker','essay-queue-view',
            'report-card-view','students-view','progress-view']
      .some((id) => {
        const el = document.getElementById(id);
        if (!el) return false;
        const inline = el.style && el.style.display;
        const computed = window.getComputedStyle(el).display;
        return (inline === 'block' || (inline !== 'none' && computed !== 'none'));
      });
  }
  function check() {
    if (!isAnyEditorVisible()) {
      if (!document.body.classList.contains('cc-list-only')) document.body.classList.add('cc-list-only');
      // The questions panel + Save row are siblings of #builder-view, so
      // hiding the builder alone leaves them on screen. Close them too.
      if (document.body.classList.contains('cc-builder-open')) document.body.classList.remove('cc-builder-open');
    }
  }
  // Run on load + periodically + on visibilitychange.
  setTimeout(check, 50);
  setInterval(check, 500);
  document.addEventListener('visibilitychange', check);
})();


// ── Admin: 📅 Date-range user export modal ─────────────────────────────────

function showAdminReportsModal() {
  if (document.getElementById('cc-reports-overlay')) return;
  const today = new Date();
  const fmt = (d) => d.toISOString().slice(0, 10);
  const thirty = new Date(today.getTime() - 30*24*60*60*1000);
  const overlay = document.createElement('div');
  overlay.id = 'cc-reports-overlay';
  overlay.style.cssText = 'position:fixed; inset:0; background:rgba(11,16,32,0.55); z-index:2147483646; display:flex; align-items:center; justify-content:center; padding:24px;';
  overlay.innerHTML = '<div style="background:#fff; border-radius:14px; padding:0; max-width:980px; width:100%; max-height:92vh; display:flex; flex-direction:column; box-shadow:0 16px 48px rgba(0,0,0,0.30);">' +
    '<div style="padding:14px 22px; border-bottom:1px solid #e5e7eb; background:linear-gradient(135deg,#1a1e33,#3b3a6b); color:#fff; border-radius:14px 14px 0 0;">' +
      '<div class="row" style="gap:10px; align-items:center; flex-wrap:wrap;">' +
        '<h2 style="margin:0; flex:1;">📊 Admin Reports</h2>' +
        '<button class="btn" id="cc-rep-tab-t" style="background:#fde68a; color:#1a1e33; border:1px solid #c69214;">👨‍🏫 Teachers</button>' +
        '<button class="btn" id="cc-rep-tab-s" style="background:rgba(255,255,255,0.18); color:#fff; border:1px solid rgba(255,255,255,0.4);">🎓 Students</button>' +
        '<button class="btn" id="cc-rep-close" style="background:#dc2626; color:#fff; border:1px solid #fecaca;">✕ Close</button>' +
      '</div>' +
      '<div class="row" style="gap:10px; align-items:center; margin-top:10px; flex-wrap:wrap; color:#fff;">' +
        '<label style="font-size:13px;">From</label><input type="date" id="cc-rep-from" value="' + fmt(thirty) + '" style="padding:6px 8px; border-radius:6px; border:1px solid rgba(255,255,255,0.4); background:rgba(255,255,255,0.95);" />' +
        '<label style="font-size:13px;">To</label><input type="date" id="cc-rep-to" value="' + fmt(today) + '" style="padding:6px 8px; border-radius:6px; border:1px solid rgba(255,255,255,0.4); background:rgba(255,255,255,0.95);" />' +
        '<button class="btn" data-preset="7"   style="padding:4px 10px; font-size:12px;">7d</button>' +
        '<button class="btn" data-preset="30"  style="padding:4px 10px; font-size:12px;">30d</button>' +
        '<button class="btn" data-preset="90"  style="padding:4px 10px; font-size:12px;">90d</button>' +
        '<button class="btn" data-preset="365" style="padding:4px 10px; font-size:12px;">1yr</button>' +
        '<button class="btn" data-preset="all" style="padding:4px 10px; font-size:12px;">All</button>' +
        '<span style="flex:1;"></span>' +
        '<button class="btn" id="cc-rep-dl-users" style="background:#16a34a; color:#fff; border:1px solid #86efac;">📥 Users CSV</button>' +
        '<button class="btn" id="cc-rep-dl-logins" style="background:#2563eb; color:#fff; border:1px solid #93c5fd;">📥 Logins CSV</button>' +
      '</div>' +
    '</div>' +
    '<div style="overflow-y:auto; padding:18px 22px;" id="cc-rep-body"><div class="muted">Loading…</div></div>' +
  '</div>';
  document.body.appendChild(overlay);
  document.getElementById('cc-rep-close').onclick = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  let activeRole = 'teacher';
  function setTab(role) {
    activeRole = role;
    const t = document.getElementById('cc-rep-tab-t');
    const s = document.getElementById('cc-rep-tab-s');
    if (role === 'teacher') {
      t.style.background = '#fde68a'; t.style.color = '#1a1e33';
      s.style.background = 'rgba(255,255,255,0.18)'; s.style.color = '#fff';
    } else {
      s.style.background = '#fde68a'; s.style.color = '#1a1e33';
      t.style.background = 'rgba(255,255,255,0.18)'; t.style.color = '#fff';
    }
    refresh();
  }
  document.getElementById('cc-rep-tab-t').onclick = () => setTab('teacher');
  document.getElementById('cc-rep-tab-s').onclick = () => setTab('student');

  // Date preset chips
  overlay.querySelectorAll('[data-preset]').forEach((b) => {
    b.onclick = () => {
      const v = b.getAttribute('data-preset');
      if (v === 'all') {
        document.getElementById('cc-rep-from').value = '';
        document.getElementById('cc-rep-to').value = '';
      } else {
        const days = Number(v);
        document.getElementById('cc-rep-from').value = fmt(new Date(today.getTime() - days*24*60*60*1000));
        document.getElementById('cc-rep-to').value   = fmt(today);
      }
      refresh();
    };
  });
  document.getElementById('cc-rep-from').onchange = refresh;
  document.getElementById('cc-rep-to').onchange = refresh;

  function buildQs() {
    const fr = document.getElementById('cc-rep-from').value;
    const to = document.getElementById('cc-rep-to').value;
    const qs = new URLSearchParams();
    qs.set('role', activeRole);
    if (fr) qs.set('from', fr);
    if (to) qs.set('to', to);
    return qs.toString();
  }

  document.getElementById('cc-rep-dl-users').onclick = () => {
    window.location.href = '/api/admin/users-export?' + buildQs();
  };
  document.getElementById('cc-rep-dl-logins').onclick = () => {
    window.location.href = '/api/admin/logins-export?' + buildQs();
  };

  async function refresh() {
    const body = document.getElementById('cc-rep-body');
    body.innerHTML = '<div class="muted">Loading…</div>';
    try {
      const qs = buildQs();
      const [uRes, lRes] = await Promise.all([
        fetch('/api/admin/users?' + qs, { credentials: 'include' }).then((r) => r.json()),
        fetch('/api/admin/logins?' + qs, { credentials: 'include' }).then((r) => r.json()),
      ]);
      const users = (uRes && uRes.users) || [];
      const logins = (lRes && lRes.logins) || [];
      const dailyCounts = (lRes && lRes.dailyCounts) || [];
      const totalLogins = (lRes && lRes.totalCount) || 0;
      const roleLabel = activeRole === 'teacher' ? 'teachers' : 'students';

      body.innerHTML =
        '<div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:14px;">' +
          '<div style="flex:1; min-width:160px; background:#f1f5f9; border-radius:10px; padding:14px;"><div style="font-size:12px; color:#475569;">Total ' + roleLabel + '</div><div style="font-size:28px; font-weight:800; color:#1a1e33;">' + users.length + '</div></div>' +
          '<div style="flex:1; min-width:160px; background:#f1f5f9; border-radius:10px; padding:14px;"><div style="font-size:12px; color:#475569;">Logins in range</div><div style="font-size:28px; font-weight:800; color:#1a1e33;">' + totalLogins + '</div></div>' +
          '<div style="flex:1; min-width:160px; background:#f1f5f9; border-radius:10px; padding:14px;"><div style="font-size:12px; color:#475569;">Active days</div><div style="font-size:28px; font-weight:800; color:#1a1e33;">' + dailyCounts.length + '</div></div>' +
        '</div>' +
        '<h3 style="margin:0 0 8px; color:#1a1e33;">📅 Logins by day</h3>' +
        (dailyCounts.length === 0
          ? '<div class="muted" style="padding:10px;">No logins in this date range.</div>'
          : '<table style="width:100%; border-collapse:collapse; margin-bottom:18px;"><thead style="background:#f1f5f9;"><tr><th style="text-align:left; padding:8px 12px;">Date</th><th style="text-align:right; padding:8px 12px;">Logins</th></tr></thead><tbody>' +
            dailyCounts.map((d) => '<tr style="border-top:1px solid #e5e7eb;"><td style="padding:6px 12px;">' + d.date + '</td><td style="padding:6px 12px; text-align:right; font-weight:600;">' + d.count + '</td></tr>').join('') +
            '</tbody></table>') +
        '<h3 style="margin:14px 0 8px; color:#1a1e33;">👥 ' + roleLabel.replace(/^./, (c) => c.toUpperCase()) + ' (' + users.length + ')</h3>' +
        (users.length === 0
          ? '<div class="muted" style="padding:10px;">No ' + roleLabel + ' match the filter.</div>'
          : '<table style="width:100%; border-collapse:collapse; margin-bottom:18px;"><thead style="background:#f1f5f9;"><tr><th style="text-align:left; padding:8px 12px;">Name</th><th style="text-align:left; padding:8px 12px;">Email</th><th style="text-align:left; padding:8px 12px;">Created</th><th style="text-align:left; padding:8px 12px;">Status</th></tr></thead><tbody>' +
            users.slice(0, 500).map((u) => '<tr style="border-top:1px solid #e5e7eb;' + (u.blocked ? ' background:#fef2f2;' : '') + '"><td style="padding:6px 12px;">' + (u.name||'') + '</td><td style="padding:6px 12px; color:#475569;">' + (u.email||'') + '</td><td style="padding:6px 12px;">' + ((u.createdAt||'').slice(0,10) || '—') + '</td><td style="padding:6px 12px;">' + (u.blocked ? '<span style="color:#b91c1c; font-weight:700;">🚫 Blocked</span>' : '<span style="color:#16a34a;">✓ Active</span>') + '</td></tr>').join('') +
            '</tbody></table>' +
            (users.length > 500 ? '<div class="muted" style="font-size:12px;">Showing first 500 — download CSV for the full list.</div>' : '')) +
        '<h3 style="margin:14px 0 8px; color:#1a1e33;">🕒 Recent logins</h3>' +
        (logins.length === 0
          ? '<div class="muted" style="padding:10px;">No logins recorded in this date range.</div>'
          : '<table style="width:100%; border-collapse:collapse;"><thead style="background:#f1f5f9;"><tr><th style="text-align:left; padding:8px 12px;">When</th><th style="text-align:left; padding:8px 12px;">Name</th><th style="text-align:left; padding:8px 12px;">Email</th></tr></thead><tbody>' +
            logins.slice(0, 200).map((g) => '<tr style="border-top:1px solid #e5e7eb;"><td style="padding:6px 12px; color:#475569;">' + (g.at||'').replace('T', ' ').slice(0, 19) + '</td><td style="padding:6px 12px;">' + (g.name||'') + '</td><td style="padding:6px 12px; color:#475569;">' + (g.email||'') + '</td></tr>').join('') +
            '</tbody></table>' +
            (logins.length > 200 ? '<div class="muted" style="font-size:12px;">Showing first 200 most-recent — download CSV for the full list.</div>' : ''));
    } catch (e) {
      body.innerHTML = '<div style="color:#dc2626;">❌ Could not load: ' + (e.message || '') + '</div>';
    }
  }
  setTab('teacher');
}

// Keep the existing menu wiring alive — re-point to the new modal.
function showDateRangeExportModal() { showAdminReportsModal(); }

// Attach the modal opener to the menu item, no matter when the DOM loads.
// Use both DOMContentLoaded and a delayed retry — the admin-menu wrap can be
// hidden initially and only revealed when isAdmin returns true.
function _wireDateRangeButton() {
  const rangeBtn = document.getElementById('admin-export-users-range');
  if (rangeBtn && !rangeBtn._ccWired) {
    rangeBtn.onclick = showDateRangeExportModal;
    rangeBtn._ccWired = true;
  }
}
if (document.readyState !== 'loading') _wireDateRangeButton();
else document.addEventListener('DOMContentLoaded', _wireDateRangeButton);
// Retry every 250ms for the first 3s in case the admin check finishes later.
let _wireTries = 0;
const _wireInterval = setInterval(() => {
  _wireDateRangeButton();
  _wireTries += 1;
  if (_wireTries > 12) clearInterval(_wireInterval);
}, 250);

// ── Admin: 👤 Manage users modal ──────────────────────────────────────────
async function showManageUsersModal() {
  if (document.getElementById('cc-mu-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'cc-mu-overlay';
  overlay.style.cssText = 'position:fixed; inset:0; background:rgba(11,16,32,0.55); z-index:2147483646; display:flex; align-items:center; justify-content:center; padding:24px;';
  overlay.innerHTML = '<div style="background:#fff; border-radius:14px; padding:0; max-width:840px; width:100%; max-height:90vh; display:flex; flex-direction:column; box-shadow:0 16px 48px rgba(0,0,0,0.30);">' +
    '<div style="padding:16px 22px; border-bottom:1px solid #e5e7eb; background:linear-gradient(135deg,#1a1e33,#3b3a6b); color:#fff; border-radius:14px 14px 0 0;">' +
      '<div class="row" style="gap:10px; align-items:center;">' +
        '<h2 style="margin:0; flex:1;">👤 Manage users</h2>' +
        '<input id="cc-mu-search" type="search" placeholder="Search name or email…" style="padding:8px 10px; border:1px solid #cbd5e1; border-radius:8px; min-width:240px;" />' +
        '<button class="btn" id="cc-mu-close" style="background:rgba(255,255,255,0.2); color:#fff; border:1px solid rgba(255,255,255,0.4);">Close</button>' +
      '</div>' +
    '</div>' +
    '<div style="overflow-y:auto; padding:0;"><table style="width:100%; border-collapse:collapse;" id="cc-mu-table">' +
      '<thead style="background:#f1f5f9; position:sticky; top:0;"><tr>' +
        '<th style="text-align:left; padding:10px 14px;">Role</th>' +
        '<th style="text-align:left; padding:10px 14px;">Name</th>' +
        '<th style="text-align:left; padding:10px 14px;">Email</th>' +
        '<th style="text-align:left; padding:10px 14px;">Status</th>' +
        '<th style="text-align:right; padding:10px 14px;">Actions</th>' +
      '</tr></thead><tbody id="cc-mu-body"><tr><td colspan="5" style="padding:20px; text-align:center; color:#6b7280;">Loading…</td></tr></tbody>' +
    '</table></div>' +
  '</div>';
  document.body.appendChild(overlay);
  document.getElementById('cc-mu-close').onclick = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  let users = [];
  function render() {
    const q = (document.getElementById('cc-mu-search').value || '').toLowerCase();
    const filtered = users.filter((u) => !q || (u.name||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q));
    document.getElementById('cc-mu-body').innerHTML = filtered.length === 0
      ? '<tr><td colspan="5" style="padding:20px; text-align:center; color:#6b7280;">No users match.</td></tr>'
      : filtered.map((u) => (
          '<tr style="border-top:1px solid #e5e7eb;' + (u.blocked ? ' background:#fef2f2;' : '') + '">' +
            '<td style="padding:8px 14px; text-transform:capitalize;">' + (u.role||'') + '</td>' +
            '<td style="padding:8px 14px;">' + (u.name||'') + '</td>' +
            '<td style="padding:8px 14px; color:#475569;">' + (u.email||'') + '</td>' +
            '<td style="padding:8px 14px;">' + (u.blocked ? '<span style="color:#b91c1c; font-weight:700;">🚫 Blocked</span>' : '<span style="color:#16a34a;">✓ Active</span>') + '</td>' +
            '<td style="padding:8px 14px; text-align:right; white-space:nowrap;">' +
              '<button class="btn" data-action="' + (u.blocked ? 'unblock' : 'block') + '" data-id="' + u.id + '" style="margin-right:4px;">' + (u.blocked ? '✓ Unblock' : '🚫 Block') + '</button>' +
              '<button class="btn danger" data-action="delete" data-id="' + u.id + '">🗑 Delete</button>' +
            '</td>' +
          '</tr>'
        )).join('');
    document.querySelectorAll('#cc-mu-body button').forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-id');
        const action = btn.getAttribute('data-action');
        const u = users.find((x) => x.id === id) || {};
        if (action === 'delete') {
          if (!confirm('Permanently delete ' + u.name + ' (' + u.email + ')?\nThis cannot be undone. Their results stay but become orphaned.')) return;
          try {
            const r = await fetch('/api/admin/users/' + id, { method: 'DELETE', credentials: 'include' });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || 'Failed');
            users = users.filter((x) => x.id !== id);
            render();
          } catch (e) { alert('Delete failed: ' + e.message); }
        } else {
          const url = '/api/admin/users/' + id + '/' + action;
          try {
            const r = await fetch(url, { method: 'POST', credentials: 'include' });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || 'Failed');
            u.blocked = !!data.blocked;
            render();
          } catch (e) { alert(action + ' failed: ' + e.message); }
        }
      };
    });
  }

  try {
    const r = await fetch('/api/admin/users', { credentials: 'include' });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Failed');
    users = data.users || [];
    render();
  } catch (e) {
    document.getElementById('cc-mu-body').innerHTML = '<tr><td colspan="5" style="padding:20px; text-align:center; color:#dc2626;">❌ ' + (e.message || 'Could not load users') + '</td></tr>';
  }
  document.getElementById('cc-mu-search').oninput = render;
}

// ── Admin: 🔔 API credit warning ──────────────────────────────────────────
async function _ccCheckApiStatus() {
  const bell = document.getElementById('api-funds-bell');
  if (!bell) return;
  try {
    const r = await fetch('/api/admin/api-status', { credentials: 'include' });
    if (!r.ok) return;
    const data = await r.json();
    if (data && data.apiCreditWarning) {
      bell.style.display = '';
      bell._ccWarning = data.apiCreditWarning;
    } else {
      bell.style.display = 'none';
    }
  } catch {}
}
function _ccWireApiBell() {
  const bell = document.getElementById('api-funds-bell');
  if (!bell || bell._ccWired) return;
  bell._ccWired = true;
  bell.onclick = () => {
    const w = bell._ccWarning || {};
    const overlay = document.createElement('div');
    overlay.id = 'cc-api-warn-overlay';
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(11,16,32,0.55); z-index:2147483647; display:flex; align-items:center; justify-content:center; padding:24px;';
    overlay.innerHTML = '<div style="background:#fff; border-radius:12px; padding:24px 28px; max-width:520px; width:92%; box-shadow:0 16px 48px rgba(0,0,0,0.30);">' +
      '<h2 style="margin:0 0 10px; color:#b91c1c;">🔔 API credit issue</h2>' +
      '<p style="margin:0 0 12px; color:#1a1e33;"><strong>HTTP ' + (w.status || '—') + '</strong> from the Anthropic API.</p>' +
      '<pre style="background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:12px; color:#7f1d1d; white-space:pre-wrap; max-height:200px; overflow:auto;">' + (w.message || '(no message)') + '</pre>' +
      '<p style="margin:14px 0 6px; color:#475569; font-size:13px;">Detected: ' + (w.detectedAt || '—') + '</p>' +
      '<p style="margin:6px 0 16px; font-size:14px;">Top up your Anthropic credit at <a href="https://console.anthropic.com/settings/billing" target="_blank" rel="noopener">console.anthropic.com/settings/billing</a>, then click "Dismiss" once you have added funds.</p>' +
      '<div class="row" style="gap:10px; justify-content:flex-end;">' +
        '<button class="btn" id="cc-api-warn-close">Close</button>' +
        '<button class="btn primary" id="cc-api-warn-clear">✓ Dismiss</button>' +
      '</div></div>';
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    document.getElementById('cc-api-warn-close').onclick = close;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.getElementById('cc-api-warn-clear').onclick = async () => {
      try { await fetch('/api/admin/api-status/clear', { method: 'POST', credentials: 'include' }); } catch {}
      close();
      _ccCheckApiStatus();
    };
  };
}

// Wire menu item + bell + start polling.
function _ccWireAdminExtras() {
  const muBtn = document.getElementById('admin-manage-users');
  if (muBtn && !muBtn._ccWired) {
    muBtn.onclick = showManageUsersModal;
    muBtn._ccWired = true;
  }
  _ccWireApiBell();
}
if (document.readyState !== 'loading') _ccWireAdminExtras();
else document.addEventListener('DOMContentLoaded', _ccWireAdminExtras);
let _ccExtrasTries = 0;
const _ccExtrasInterval = setInterval(() => {
  _ccWireAdminExtras();
  _ccExtrasTries += 1;
  if (_ccExtrasTries > 16) clearInterval(_ccExtrasInterval);
}, 250);
// Poll API status every 60s once we know we're admin.
setTimeout(_ccCheckApiStatus, 1500);
setInterval(_ccCheckApiStatus, 60 * 1000);

// ── Folders + Move-to-folder modal ─────────────────────────────────────────
let _ccFoldersCache = null;
let _ccActiveFolderId = null;

async function _ccLoadFolders() {
  try {
    const r = await fetch('/api/folders', { credentials: 'include' });
    const data = await r.json();
    _ccFoldersCache = Array.isArray(data.folders) ? data.folders : [];
  } catch { _ccFoldersCache = []; }
  return _ccFoldersCache;
}

async function _ccRenderFolderBar() {
  let host = document.getElementById('cc-folder-bar');
  if (!host) {
    host = document.createElement('div');
    host.id = 'cc-folder-bar';
    host.style.cssText = 'background:#fff; border:1px solid #e5e7eb; border-radius:10px; padding:10px 14px; margin: 0 0 12px;';
    const list = document.getElementById('list-view');
    if (list) list.insertBefore(host, list.children[1] || null);
  }
  const folders = await _ccLoadFolders();
  const activeClass = (typeof getActiveClassId === 'function') ? getActiveClassId() : '';
  const mine = folders.filter((f) => f.classId === activeClass);
  const all = (typeof allAssessments !== 'undefined') ? (allAssessments || []) : [];
  const countIn = (fid) => all.filter((a) => (a.classId === activeClass) && (fid === null ? !a.folderId : a.folderId === fid)).length;
  const everythingCount = all.filter((a) => a.classId === activeClass).length;
  const activeLabel = (() => {
    if (_ccActiveFolderId === '__ALL__') return '🗂 Everything (' + everythingCount + ')';
    if (_ccActiveFolderId === null) return '📥 Unfiled (' + countIn(null) + ')';
    const f = mine.find((x) => x.id === _ccActiveFolderId);
    if (!f) return '📥 Unfiled (' + countIn(null) + ')';
    return '📁 ' + f.name + (f.year ? ' · ' + f.year : '') + (f.term ? ' · ' + f.term : '') + ' (' + countIn(f.id) + ')';
  })();
  const itemHtml = (label, value, isActive) =>
    '<button class="btn" data-folder-pick="' + (value === null ? '' : value) + '" style="display:block; width:100%; text-align:left; margin:2px 0; background:' + (isActive ? '#eef2ff' : 'transparent') + '; color:#1a1e33; border:1px solid transparent;">' + label + '</button>';
  const folderRow = (f) =>
    '<div style="display:flex; gap:4px; align-items:center; margin:2px 0;">' +
      itemHtml('📁 ' + f.name + (f.year ? ' · ' + f.year : '') + (f.term ? ' · ' + f.term : '') + ' (' + countIn(f.id) + ')', f.id, _ccActiveFolderId === f.id).replace('display:block; width:100%;', 'display:block; flex:1;') +
      '<button class="btn" data-folder-rename="' + f.id + '" title="Rename" style="padding:2px 6px; font-size:11px;">✎</button>' +
      '<button class="btn danger" data-folder-del="' + f.id + '" title="Delete" style="padding:2px 6px; font-size:11px;">✕</button>' +
    '</div>';
  host.innerHTML = '<div style="display:flex; align-items:center; gap:8px;">' +
      '<strong style="margin-right:4px;">📁 Folder:</strong>' +
      '<div id="cc-folder-wrap" style="position:relative; flex:1;">' +
        '<button id="cc-folder-toggle" class="btn" style="background:#fff; color:#1a1e33; border:1px solid #cbd5e1; text-align:left; width:100%;">' + activeLabel + ' ▾</button>' +
        '<div id="cc-folder-dropdown" style="display:none; position:absolute; left:0; right:0; top:calc(100% + 4px); background:#fff; border:1px solid #cbd5e1; border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,0.18); padding:6px; z-index:2147483600; max-height: 60vh; overflow-y: auto;">' +
          itemHtml('🗂 Everything (' + everythingCount + ')', '__ALL__', _ccActiveFolderId === '__ALL__') +
          itemHtml('📥 Unfiled (' + countIn(null) + ')', null, _ccActiveFolderId === null) +
          (mine.length ? '<div style="border-top:1px solid #e5e7eb; margin:6px 0;"></div>' + mine.map(folderRow).join('') : '') +
          '<div style="border-top:1px solid #e5e7eb; margin:6px 0;"></div>' +
          '<button id="cc-folder-new" class="btn primary" style="display:block; width:100%; text-align:left; background:#4338ca; color:#fff;">+ New folder</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  // Wire toggle + close-on-outside-click.
  const toggle = document.getElementById('cc-folder-toggle');
  const menu = document.getElementById('cc-folder-dropdown');
  const wrap = document.getElementById('cc-folder-wrap');
  toggle.onclick = (e) => {
    e.stopPropagation();
    menu.style.display = (menu.style.display === 'none' || !menu.style.display) ? 'block' : 'none';
  };
  document.addEventListener('click', function _cc_close(e) {
    if (!wrap.contains(e.target)) menu.style.display = 'none';
  });
  // Picking an item updates active filter and closes the menu.
  menu.querySelectorAll('[data-folder-pick]').forEach((b) => {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const v = b.getAttribute('data-folder-pick');
      _ccActiveFolderId = v === '' ? null : v;
      menu.style.display = 'none';
      _ccRenderFolderBar();
      if (typeof render === 'function') render();
    });
  });
}

function _ccFilterByFolder(list) {
  // "🗂 Everything" chip shows the entire list. "📥 Unfiled" shows
  // only assessments not in any folder. Folder chip shows that folder.
  if (_ccActiveFolderId === '__ALL__') return list;
  if (_ccActiveFolderId === null) return list.filter((a) => !a.folderId);
  return list.filter((a) => a.folderId === _ccActiveFolderId);
}

(function hookRenderForFolders() {
  if (typeof render === 'function') {
    const orig = render;
    window.render = function () { try { _ccRenderFolderBar(); } catch {} return orig.apply(this, arguments); };
  }
  if (typeof loadAssessments === 'function') {
    const o = loadAssessments;
    window.loadAssessments = async function () { _ccActiveFolderId = null; _ccFoldersCache = null; const r = await o.apply(this, arguments); try { await _ccRenderFolderBar(); } catch {} return r; };
  }
  if (typeof filteredAssessments === 'function') {
    const o2 = filteredAssessments;
    window.filteredAssessments = function () { return _ccFilterByFolder(o2.apply(this, arguments)); };
  }
})();

async function showMoveAssessmentModal(assessmentId) {
  if (document.getElementById('cc-move-overlay')) return;
  let classes = (typeof allClasses !== 'undefined' && Array.isArray(allClasses)) ? allClasses : [];
  if (!classes.length) {
    try { const data = await (await fetch('/api/classes', { credentials: 'include' })).json(); classes = data.classes || data || []; } catch {}
  }
  const folders = await _ccLoadFolders();
  const ass = (allAssessments || []).find((x) => x.id === assessmentId) || {};
  const overlay = document.createElement('div');
  overlay.id = 'cc-move-overlay';
  overlay.style.cssText = 'position:fixed; inset:0; background:rgba(11,16,32,0.55); z-index:2147483646; display:flex; align-items:center; justify-content:center; padding:24px;';
  const folderOpts = (cid) => '<option value="">— No folder —</option>' + folders.filter((f) => f.classId === cid).map((f) => '<option value="' + f.id + '"' + (ass.folderId === f.id ? ' selected' : '') + '>' + f.name + '</option>').join('');
  overlay.innerHTML = '<div style="background:#fff; border-radius:12px; padding:24px 28px; max-width:520px; width:92%; box-shadow:0 16px 48px rgba(0,0,0,0.3);">' +
    '<h2 style="margin:0 0 10px; color:#1a1e33;">📂 Move "' + (ass.title || 'assessment') + '"</h2>' +
    '<p style="margin:0 0 14px; color:#475569; font-size:14px;">Move this assessment to a different class or folder.</p>' +
    '<div class="field"><label>Class</label><select id="cc-move-class" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px;">' +
      classes.map((c) => '<option value="' + c.id + '"' + (ass.classId === c.id ? ' selected' : '') + '>' + c.name + '</option>').join('') +
    '</select></div>' +
    '<div class="field"><label>Folder (optional)</label><select id="cc-move-folder" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px;">' + folderOpts(ass.classId) + '</select></div>' +
    '<div class="row" style="gap:10px; justify-content:flex-end; margin-top:18px;">' +
      '<button class="btn" id="cc-move-cancel">Cancel</button>' +
      '<button class="btn primary" id="cc-move-confirm">Move</button>' +
    '</div></div>';
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  document.getElementById('cc-move-cancel').onclick = close;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.getElementById('cc-move-class').onchange = (e) => { document.getElementById('cc-move-folder').innerHTML = folderOpts(e.target.value); };
  document.getElementById('cc-move-confirm').onclick = async () => {
    const classId = document.getElementById('cc-move-class').value;
    const folderId = document.getElementById('cc-move-folder').value || null;
    try {
      const r = await fetch('/api/assessments/' + assessmentId + '/move-to', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ classId, folderId }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Move failed');
      close();
      if (typeof loadAssessments === 'function') loadAssessments();
    } catch (e) { alert('Move failed: ' + e.message); }
  };
}

// ── Folder modals (no browser prompts) + global click delegation ───────────
function _ccOpenNewFolderModal(classId) {
  if (document.getElementById('cc-newfolder-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'cc-newfolder-overlay';
  overlay.style.cssText = 'position:fixed; inset:0; background:rgba(11,16,32,0.55); z-index:2147483646; display:flex; align-items:center; justify-content:center; padding:24px;';
  overlay.innerHTML = '<div style="background:#fff; border-radius:12px; padding:24px 28px; max-width:460px; width:92%; box-shadow:0 16px 48px rgba(0,0,0,0.30);">' +
    '<h2 style="margin:0 0 14px; color:#1a1e33;">📁 New folder</h2>' +
    '<div class="field"><label>Folder name</label><input type="text" id="cc-nf-name" placeholder="e.g. Reading · Writing · Old papers" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px;" /></div>' +
    '<div class="row" style="gap:10px;"><div class="field" style="flex:1;"><label>Year (optional)</label><input type="text" id="cc-nf-year" placeholder="2025-2026" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px;" /></div>' +
    '<div class="field" style="flex:1;"><label>Term (optional)</label><input type="text" id="cc-nf-term" placeholder="Term 1" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px;" /></div></div>' +
    '<div class="row" style="gap:10px; justify-content:flex-end; margin-top:14px;"><button class="btn" id="cc-nf-cancel">Cancel</button><button class="btn primary" id="cc-nf-save">Create folder</button></div></div>';
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  document.getElementById('cc-nf-cancel').onclick = close;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  setTimeout(() => { try { document.getElementById('cc-nf-name').focus(); } catch {} }, 30);
  document.getElementById('cc-nf-save').onclick = async () => {
    const name = (document.getElementById('cc-nf-name').value || '').trim();
    const year = (document.getElementById('cc-nf-year').value || '').trim();
    const term = (document.getElementById('cc-nf-term').value || '').trim();
    if (!name) { alert('Please enter a folder name.'); return; }
    try {
      const r = await fetch('/api/folders', { method: 'POST', credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ classId, name, year, term }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Failed');
      close();
      _ccFoldersCache = null;
      await _ccRenderFolderBar();
    } catch (e) { alert('Could not create: ' + e.message); }
  };
}

function _ccOpenRenameFolderModal(folder) {
  if (document.getElementById('cc-rf-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'cc-rf-overlay';
  overlay.style.cssText = 'position:fixed; inset:0; background:rgba(11,16,32,0.55); z-index:2147483646; display:flex; align-items:center; justify-content:center; padding:24px;';
  const escAttr = (s) => String(s || '').replace(/"/g, '&quot;');
  overlay.innerHTML = '<div style="background:#fff; border-radius:12px; padding:24px 28px; max-width:460px; width:92%; box-shadow:0 16px 48px rgba(0,0,0,0.30);">' +
    '<h2 style="margin:0 0 14px; color:#1a1e33;">✎ Rename folder</h2>' +
    '<div class="field"><label>Folder name</label><input type="text" id="cc-rf-name" value="' + escAttr(folder.name) + '" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px;" /></div>' +
    '<div class="row" style="gap:10px;"><div class="field" style="flex:1;"><label>Year</label><input type="text" id="cc-rf-year" value="' + escAttr(folder.year||'') + '" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px;" /></div>' +
    '<div class="field" style="flex:1;"><label>Term</label><input type="text" id="cc-rf-term" value="' + escAttr(folder.term||'') + '" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px;" /></div></div>' +
    '<div class="row" style="gap:10px; justify-content:flex-end; margin-top:14px;"><button class="btn" id="cc-rf-cancel">Cancel</button><button class="btn primary" id="cc-rf-save">Save</button></div></div>';
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  document.getElementById('cc-rf-cancel').onclick = close;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.getElementById('cc-rf-save').onclick = async () => {
    const name = (document.getElementById('cc-rf-name').value || '').trim();
    const year = (document.getElementById('cc-rf-year').value || '').trim();
    const term = (document.getElementById('cc-rf-term').value || '').trim();
    if (!name) { alert('Please enter a folder name.'); return; }
    try {
      const r = await fetch('/api/folders/' + folder.id, { method: 'PUT', credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, year, term }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Failed');
      close();
      _ccFoldersCache = null;
      await _ccRenderFolderBar();
    } catch (e) { alert('Could not rename: ' + e.message); }
  };
}

// Global click delegation — guarantees folder buttons work after any rerender.
document.addEventListener('click', async (e) => {
  const target = e.target && e.target.closest ? e.target.closest('button') : null;
  if (!target) return;
  if (target.id === 'cc-folder-new') {
    e.preventDefault();
    const cid = (typeof getActiveClassId === 'function') ? getActiveClassId() : '';
    _ccOpenNewFolderModal(cid);
    return;
  }
  if (target.hasAttribute('data-folder-chip')) {
    const v = target.getAttribute('data-folder-chip');
    _ccActiveFolderId = v === '' ? null : v;
    try { _ccRenderFolderBar(); } catch {}
    if (typeof render === 'function') render();
    return;
  }
  if (target.hasAttribute('data-folder-rename')) {
    e.preventDefault(); e.stopPropagation();
    const id = target.getAttribute('data-folder-rename');
    const f = (_ccFoldersCache || []).find((x) => x.id === id);
    if (f) _ccOpenRenameFolderModal(f);
    return;
  }
  if (target.hasAttribute('data-folder-del')) {
    e.preventDefault(); e.stopPropagation();
    const id = target.getAttribute('data-folder-del');
    const f = (_ccFoldersCache || []).find((x) => x.id === id);
    if (!f) return;
    if (!confirm('Delete folder "' + f.name + '"? Assessments inside will move back to "All".')) return;
    try {
      await fetch('/api/folders/' + id, { method: 'DELETE', credentials: 'include' });
      _ccFoldersCache = null;
      if (_ccActiveFolderId === id) _ccActiveFolderId = null;
      await _ccRenderFolderBar();
      if (typeof render === 'function') render();
    } catch (err) { alert('Delete failed'); }
    return;
  }
});

// CC: show Listening Audio panel + Skill picker conditionally.
function _ccApplyConditionalPanels() {
  const subject = (els.subject && els.subject.value || '').trim();
  const skill   = (els.skill   && els.skill.value   || '').trim();
  const isLanguageSubject = ['English','Arabic','French','Listening','IELTS','TOEFL','PISA'].includes(subject);
  // Skill dropdown — only relevant for language subjects.
  if (els.skillField) els.skillField.style.display = isLanguageSubject ? '' : 'none';
  // Listening Audio panel — show when subject implies listening OR skill is Listening.
  const showListening = ['Listening','IELTS','TOEFL','PISA'].includes(subject) || skill === 'Listening';
  if (els.listeningAudioHost) els.listeningAudioHost.style.display = showListening ? '' : 'none';
}
if (els.subject) els.subject.addEventListener('change', _ccApplyConditionalPanels);
if (els.skill)   els.skill  .addEventListener('change', _ccApplyConditionalPanels);
// Run once on script load (in case the builder is already open).
setTimeout(_ccApplyConditionalPanels, 100);

// CC: Tools dropdown — open/close + close-on-outside-click + mirror the
// Grade-essays badge onto the parent button so the count is visible.
(function setupToolsDropdown() {
  const toggle = document.getElementById('tools-menu-toggle');
  const menu   = document.getElementById('tools-menu-dropdown');
  const wrap   = document.getElementById('tools-menu-wrap');
  if (!toggle || !menu) return;
  toggle.onclick = (e) => {
    e.stopPropagation();
    menu.style.display = (menu.style.display === 'none' || !menu.style.display) ? 'block' : 'none';
  };
  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) menu.style.display = 'none';
  });
  // Close after picking any item in the menu.
  menu.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => { menu.style.display = 'none'; });
  });
  // Mirror the queue badge onto the dropdown button so it's visible even
  // when the menu is closed.
  const inner = document.getElementById('queue-count');
  const pill  = document.getElementById('queue-count-pill');
  if (inner && pill) {
    const mirror = () => {
      const txt = (inner.textContent || '').trim();
      const visible = txt && inner.style.display !== 'none';
      pill.textContent = txt;
      pill.style.display = visible ? '' : 'none';
    };
    new MutationObserver(mirror).observe(inner, { childList: true, characterData: true, attributes: true, subtree: true });
    setTimeout(mirror, 300);
  }
})();

// CC: bulk-select toolbar on the Essay Grading Queue.
function _ccWireEssayQueueBulk(queue) {
  const all   = document.querySelectorAll('.cc-queue-check');
  const selAll = document.getElementById('cc-queue-selectall');
  const count  = document.getElementById('cc-queue-selcount');
  const delBtn = document.getElementById('cc-queue-delete');
  if (!selAll || !delBtn) return;
  function refresh() {
    const checked = Array.from(all).filter((c) => c.checked);
    count.textContent = checked.length ? (checked.length + ' selected') : '';
    delBtn.disabled = checked.length === 0;
    delBtn.style.opacity = checked.length === 0 ? '0.5' : '1';
  }
  selAll.onchange = () => { all.forEach((c) => { c.checked = selAll.checked; }); refresh(); };
  all.forEach((c) => c.onchange = () => { if (!c.checked) selAll.checked = false; refresh(); });
  delBtn.onclick = async () => {
    const checked = Array.from(all).filter((c) => c.checked);
    if (!checked.length) return;
    if (!confirm('Delete (dismiss) ' + checked.length + ' essay(s) from the grading queue? The submission is kept but these entries will no longer appear here.')) return;
    delBtn.disabled = true; delBtn.textContent = 'Deleting…';
    const items = checked.map((c) => ({
      resultId: c.getAttribute('data-result-id'),
      questionId: c.getAttribute('data-question-id'),
    }));
    try {
      const r = await fetch('/api/essay-queue/dismiss', { method: 'POST', credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Failed');
      openEssayQueue();
    } catch (e) {
      alert('Delete failed: ' + e.message);
      delBtn.disabled = false; delBtn.textContent = '🗑 Delete selected';
    }
  };
  refresh();
}

// CC: 🔐 Two-factor authentication modal (admin-only).
async function show2faModal() {
  if (document.getElementById('cc-2fa-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'cc-2fa-overlay';
  overlay.style.cssText = 'position:fixed; inset:0; background:rgba(11,16,32,0.55); z-index:2147483646; display:flex; align-items:center; justify-content:center; padding:24px;';
  overlay.innerHTML = '<div style="background:#fff; border-radius:12px; padding:24px 28px; max-width:520px; width:92%; box-shadow:0 16px 48px rgba(0,0,0,0.30);">' +
    '<h2 style="margin:0 0 10px; color:#1a1e33;">🔐 Two-factor authentication</h2>' +
    '<div id="cc-2fa-body" class="muted">Loading…</div>' +
  '</div>';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  async function refresh() {
    try {
      const r = await fetch('/api/auth/2fa/status', { credentials: 'include' });
      const data = await r.json();
      if (data.enabled) {
        document.getElementById('cc-2fa-body').innerHTML =
          '<div style="background:#dcfce7; border:1px solid #16a34a; color:#14532d; padding:14px; border-radius:8px; margin-bottom:14px;">✓ 2FA is currently <strong>ENABLED</strong> on this account. You will need a 6-digit code at every sign-in.</div>' +
          '<div style="text-align:right;"><button class="btn" id="cc-2fa-close">Close</button> <button class="btn danger" id="cc-2fa-disable">Disable 2FA</button></div>';
        document.getElementById('cc-2fa-close').onclick = () => overlay.remove();
        document.getElementById('cc-2fa-disable').onclick = async () => {
          if (!confirm('Disable two-factor authentication? Your account will be less secure.')) return;
          await fetch('/api/auth/2fa/disable', { method: 'POST', credentials: 'include' });
          refresh();
        };
      } else {
        document.getElementById('cc-2fa-body').innerHTML =
          '<p>Add a second layer of protection to your admin account using a free authenticator app like Google Authenticator, Authy, or 1Password.</p>' +
          '<div style="text-align:right; margin-top:14px;"><button class="btn" id="cc-2fa-cancel">Close</button> <button class="btn primary" id="cc-2fa-start">Set up 2FA</button></div>';
        document.getElementById('cc-2fa-cancel').onclick = () => overlay.remove();
        document.getElementById('cc-2fa-start').onclick = startSetup;
      }
    } catch (e) {
      document.getElementById('cc-2fa-body').innerHTML = '<div style="color:#dc2626;">❌ Could not load 2FA status: ' + (e.message || '') + '</div>';
    }
  }

  async function startSetup() {
    try {
      const r = await fetch('/api/auth/2fa/setup', { method: 'POST', credentials: 'include' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Setup failed');
      const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(data.otpauth);
      document.getElementById('cc-2fa-body').innerHTML =
        '<ol style="padding-left:20px; line-height:1.6; color:#1a1e33;">' +
          '<li>On your phone, open <strong>Google Authenticator</strong>, <strong>Authy</strong>, <strong>Microsoft Authenticator</strong>, or any TOTP app.</li>' +
          '<li>Tap <strong>+ Add</strong> → <strong>Scan QR code</strong> → point at the QR below.</li>' +
          '<li>The app shows a 6-digit code. Type it here to confirm.</li>' +
        '</ol>' +
        '<div style="text-align:center; margin:14px 0;">' +
          '<img src="' + qrUrl + '" alt="Scan with your authenticator app" style="border-radius:8px; border:1px solid #cbd5e1;" />' +
        '</div>' +
        '<details style="margin-bottom:10px;"><summary style="cursor:pointer; color:#475569;">Can\'t scan? Type the secret manually</summary>' +
          '<code style="display:block; padding:8px; background:#f1f5f9; border-radius:6px; margin-top:6px; user-select:all; word-break:break-all;">' + data.secret + '</code>' +
        '</details>' +
        '<div class="field"><label>6-digit code from your app</label><input type="text" id="cc-2fa-code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="123456" style="width:100%; padding:8px; font-size:18px; letter-spacing:4px; text-align:center; border:1px solid #cbd5e1; border-radius:6px;" /></div>' +
        '<div style="text-align:right; margin-top:10px;"><button class="btn" id="cc-2fa-back">Cancel</button> <button class="btn primary" id="cc-2fa-confirm">Verify + Enable</button></div>' +
        '<div id="cc-2fa-err" style="color:#dc2626; margin-top:8px; display:none;"></div>';
      document.getElementById('cc-2fa-back').onclick = () => refresh();
      document.getElementById('cc-2fa-confirm').onclick = async () => {
        const code = (document.getElementById('cc-2fa-code').value || '').trim();
        if (!/^\d{6}$/.test(code)) { document.getElementById('cc-2fa-err').style.display = 'block'; document.getElementById('cc-2fa-err').textContent = 'Enter the 6-digit code from your app.'; return; }
        const r2 = await fetch('/api/auth/2fa/verify', { method: 'POST', credentials: 'include', headers: {'content-type':'application/json'}, body: JSON.stringify({ code }) });
        const data2 = await r2.json();
        if (!r2.ok) { document.getElementById('cc-2fa-err').style.display = 'block'; document.getElementById('cc-2fa-err').textContent = data2.error || 'Failed'; return; }
        alert('✓ Two-factor authentication is now ENABLED. From your next sign-in, you will need the 6-digit code from your authenticator app.');
        overlay.remove();
      };
    } catch (e) {
      document.getElementById('cc-2fa-body').innerHTML = '<div style="color:#dc2626;">❌ ' + (e.message || 'Setup failed') + '</div>';
    }
  }

  refresh();
}

// Wire the new admin menu item.
(function wire2faAdminMenu() {
  function go() {
    const btn = document.getElementById('admin-2fa');
    if (btn && !btn._cc2faWired) {
      btn.onclick = show2faModal;
      btn._cc2faWired = true;
    }
  }
  if (document.readyState !== 'loading') go();
  else document.addEventListener('DOMContentLoaded', go);
  let tries = 0;
  const iv = setInterval(() => { go(); if (++tries > 12) clearInterval(iv); }, 250);
})();


// ── CC AI Visuals: PDF import + regenerate visual ─────────────────────────
async function ccImportPdfWithVisuals(file) {
  if (!file) return null;
  const fd = new FormData();
  fd.append('pdf', file);
  const r = await fetch('/api/import/pdf-with-visuals', { method: 'POST', body: fd, credentials: 'include' });
  const j = await r.json().catch(function(){ return { error: 'Bad response' }; });
  if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
  return j.questions || [];
}
async function ccRegenerateVisual(questionText, subject, hint) {
  const r = await fetch('/api/ai/regenerate-visual', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ questionText: questionText, subject: subject || '', hint: hint || '' }),
  });
  const j = await r.json().catch(function(){ return { error: 'Bad response' }; });
  if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
  return j.visual || null;
}
async function ccGenerateImage(description) {
  const r = await fetch('/api/ai/generate-image', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ description: description }),
  });
  const j = await r.json().catch(function(){ return { error: 'Bad response' }; });
  if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
  return j.visual || null;
}

// Attach a "📄 Import PDF (with diagrams)" button in the Tools / Quick Import area.
function _ccInstallPdfImportButton() {
  if (document.getElementById('cc-pdf-visuals-btn')) return;
  const parent = document.querySelector('.tools-dropdown, .topbar, header, .dashboard-topbar') || document.body;
  const btn = document.createElement('button');
  btn.id = 'cc-pdf-visuals-btn';
  btn.textContent = '📄 Import PDF (with diagrams)';
  btn.style.cssText = 'margin:4px; padding:8px 14px; background:#4338CA; color:#fff; border:none; border-radius:6px; cursor:pointer;';
  btn.onclick = function () {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'application/pdf';
    inp.onchange = async function () {
      const f = inp.files && inp.files[0]; if (!f) return;
      btn.disabled = true; btn.textContent = 'Reading PDF (may take a few minutes for large files)…';
      try {
        // Call the endpoint directly so we can read the full response envelope.
        const fd = new FormData(); fd.append('pdf', f);
        // Include the currently-selected classId so the draft lands in the right class.
        const classSel = document.getElementById('class-select') || document.querySelector('select[name="class"]') || document.querySelector('.class-dropdown');
        const classId = classSel ? classSel.value : '';
        if (classId) fd.append('classId', classId);
        const resp = await fetch('/api/import/pdf-with-visuals', { method: 'POST', body: fd, credentials: 'include' });
        const j = await resp.json().catch(function(){ return {}; });
        if (!resp.ok) throw new Error(j.error || ('HTTP ' + resp.status));
        const n = (j.questions || []).length;
        const title = j.assessmentTitle || 'PDF Import';
        alert('Extracted ' + n + ' questions and saved as a new draft assessment: "' + title + '".\n\nReloading the dashboard so you can open it.');
        window.location.reload();
      } catch (e) { alert('PDF import failed: ' + (e.message || e)); }
      finally { btn.disabled = false; btn.textContent = '📄 Import PDF (with diagrams)'; }
    };
    inp.click();
  };
  parent.appendChild(btn);
}
// [disabled] document.addEventListener('DOMContentLoaded', _ccInstallPdfImportButton);
// [disabled] setTimeout(_ccInstallPdfImportButton, 500);

// Render existing visuals + add a regenerate button per question in the builder.
function _ccDecorateBuilderQuestions() {
  document.querySelectorAll('[data-question-index]').forEach(function (el) {
    if (el.querySelector('.cc-visual-host')) return;
    const idx = Number(el.getAttribute('data-question-index') || 0);
    const q   = (window._ccCurrentAssessment && window._ccCurrentAssessment.questions || [])[idx];
    if (!q) return;
    const host = document.createElement('div');
    host.className = 'cc-visual-host';
    host.setAttribute('data-visual-host', '1');
    if (q.visual) host.setAttribute('data-visual-json', JSON.stringify(q.visual));
    el.appendChild(host);
    if (q.visual && window.ccRenderVisual) window.ccRenderVisual(q.visual, host);
    // Regenerate button.
    const btn = document.createElement('button');
    btn.textContent = q.visual ? '🎨 Regenerate visual' : '🎨 Generate visual';
    btn.style.cssText = 'margin-top:6px; padding:6px 10px; background:#F3F4F6; border:1px solid #D1D5DB; border-radius:4px; cursor:pointer; font-size:12px;';
    btn.onclick = async function () {
      btn.disabled = true; btn.textContent = 'Generating…';
      try {
        const v = await ccRegenerateVisual(q.text || '', (window._ccCurrentAssessment && window._ccCurrentAssessment.subject) || '');
        q.visual = v;
        host.setAttribute('data-visual-json', JSON.stringify(v));
        if (window.ccRenderVisual) window.ccRenderVisual(v, host);
      } catch (e) { alert('Visual generation failed: ' + (e.message || e)); }
      finally { btn.disabled = false; btn.textContent = '🎨 Regenerate visual'; }
    };
    el.appendChild(btn);
  });
}
// Rerun decoration whenever the DOM changes (very cheap MutationObserver).
if (window.MutationObserver) {
  new MutationObserver(function(){ _ccDecorateBuilderQuestions(); }).observe(document.body, { childList: true, subtree: true });
}

// ── Admin → Image API config panel ──────────────────────────────────────
async function ccOpenImageApiPanel() {
  const cur = await fetch('/api/admin/image-config', { credentials:'include' }).then(function(r){ return r.json(); }).catch(function(){ return {}; });
  const provider = prompt('Image API provider (openai or leave blank to clear):', cur.provider || 'openai');
  if (provider === null) return;
  const apiKey = prompt('API key (sk-...) — leave blank to keep existing:', '');
  const body = { provider: provider || '', apiKey: apiKey || '' };
  if (!apiKey && cur.hasKey) delete body.apiKey; // keep existing
  const r = await fetch('/api/admin/image-config', { method:'PUT', headers:{'content-type':'application/json'}, credentials:'include', body: JSON.stringify(body) });
  const j = await r.json().catch(function(){ return {}; });
  if (r.ok) alert('Image API config saved.');
  else alert('Failed: ' + (j.error || r.status));
}
// Attach to Admin dropdown if present.
document.addEventListener('DOMContentLoaded', function () {
  const menu = document.querySelector('.admin-dropdown-menu, #admin-dropdown, .admin-menu');
  return; // Paid real-world image generation removed at the teacher's request.
  const item = document.createElement('a');
  item.id = 'cc-image-api-item';
  item.href = '#';
  item.textContent = '🖼 Image API';
  item.style.cssText = 'display:block; padding:8px 12px; color:#111; text-decoration:none;';
  item.onclick = function(e){ e.preventDefault(); ccOpenImageApiPanel(); };
  menu.appendChild(item);
});
// ────────────────────────────────────────────────────────────────────────
// Remove the button from the DOM in case it was rendered before this deploy.
document.addEventListener('DOMContentLoaded', function () {
  var b = document.getElementById('cc-pdf-visuals-btn');
  if (b) b.remove();
});


// ── Marked PDFs: attach a "📥 Marked PDFs" next to every "Results" button ─
function _ccExtractAssessmentIdFromResultsBtn(el) {
  if (!el) return '';
  // 1) href
  const href = el.getAttribute && (el.getAttribute('href') || '');
  if (href) {
    const m = href.match(/(?:assessment|aid|id)=([A-Za-z0-9_-]+)/) || href.match(/results\/([A-Za-z0-9_-]+)/);
    if (m) return m[1];
  }
  // 2) data attributes on the button
  for (const a of (el.attributes || [])) {
    if (/(assessment|aid|-id$)/.test(a.name) && a.value) return a.value;
  }
  // 3) walk up looking for a container with a data-* id
  let p = el.parentElement;
  for (let n = 0; n < 6 && p; n++, p = p.parentElement) {
    for (const a of (p.attributes || [])) {
      if (/(assessment|aid|-id$)/.test(a.name) && a.value && !/section|option|question/i.test(a.name)) return a.value;
    }
  }
  // 4) parse onclick
  const oc = el.getAttribute && (el.getAttribute('onclick') || '');
  if (oc) {
    const m = oc.match(/['"]([A-Za-z0-9_-]{6,})['"]/);
    if (m) return m[1];
  }
  return '';
}

function _ccInstallMarkedPdfsButtons() {
  // Find every element whose text says "Results" and is a button-like element.
  const cands = Array.from(document.querySelectorAll('button, a'));
  cands.forEach(function (el) {
    const txt = (el.textContent || '').trim();
    if (txt !== 'Results' && !/^Results\b/.test(txt)) return;
    // Already added?
    if (el.parentElement && el.parentElement.querySelector('.cc-marked-pdfs-btn')) return;
    const aid = _ccExtractAssessmentIdFromResultsBtn(el);
    const btn = document.createElement('a');
    btn.className = 'cc-marked-pdfs-btn';
    btn.textContent = '📥 Marked PDFs';
    btn.title = 'Download every student\'s marked assessment as a ZIP of PDFs';
    btn.style.cssText = 'display:inline-flex; align-items:center; margin:0 4px; padding:8px 14px; background:#0369A1; color:#fff; text-decoration:none; border-radius:6px; font-size:13px; font-weight:500; cursor:pointer; border:none;';
    btn.href = '#';
    btn.onclick = async function (e) {
      e.preventDefault();
      if (!aid) { alert('Cannot detect assessment ID from this card. Try opening Results first, then reload.'); return; }
      const orig = btn.textContent;
      btn.textContent = 'Preparing…';
      btn.style.opacity = '0.7';
      try {
        const r = await fetch('/api/teacher/assessments/' + encodeURIComponent(aid) + '/marked-pdfs.zip', { credentials: 'include' });
        if (!r.ok) {
          let msg = 'Download failed (HTTP ' + r.status + ')';
          try { const j = await r.json(); if (j && j.error) msg = j.error; } catch(_){}
          alert(msg);
          return;
        }
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // Try to read filename from Content-Disposition
        const cd = r.headers.get('Content-Disposition') || '';
        const m = cd.match(/filename="?([^";]+)"?/i);
        a.download = m ? m[1] : 'marked-pdfs.zip';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function(){ URL.revokeObjectURL(url); }, 5000);
      } catch (err) {
        alert('Download failed: ' + (err.message || err));
      } finally {
        btn.textContent = orig;
        btn.style.opacity = '';
      }
    };
    // Insert right after the Results button.
    if (el.parentElement) el.parentElement.insertBefore(btn, el.nextSibling);
  });
}

document.addEventListener('DOMContentLoaded', _ccInstallMarkedPdfsButtons);
if (window.MutationObserver) {
  new MutationObserver(function(){ _ccInstallMarkedPdfsButtons(); })
    .observe(document.body, { childList: true, subtree: true });
}
// Run again shortly after load in case cards render asynchronously.
setTimeout(_ccInstallMarkedPdfsButtons, 500);
setTimeout(_ccInstallMarkedPdfsButtons, 1500);
// ──────────────────────────────────────────────────────────────────────────


// ── AI Mark Writing v2 — rubric dropdown, PDF download, folders ───────
(function () {
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    if (attrs) for (const k of Object.keys(attrs)) {
      if (k === 'style') n.style.cssText = attrs[k];
      else if (k === 'onclick') n.onclick = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    for (const kid of kids) if (kid !== null && kid !== undefined) n.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
    return n;
  }
  function overlayHost() {
    const overlay = el('div', { style: 'position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:99999; display:flex; align-items:center; justify-content:center;' });
    return overlay;
  }
  async function fetchJson(url, init){
    const r = await fetch(url, Object.assign({ credentials: 'include' }, init || {}));
    const j = await r.json().catch(function(){ return { error: 'Bad response' }; });
    if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
    return j;
  }

  // ── Mark modal ─────────────────────────────────────────────────────
  async function openMarkModal() {
    let rubrics = []; let folders = [];
    try { rubrics = await fetchJson('/api/teacher/writing-rubrics'); } catch(e){}
    try { folders = await fetchJson('/api/teacher/folders'); } catch(e){}

    const overlay = overlayHost();
    const modal = el('div', { style: 'background:#fff; border-radius:12px; max-width:760px; width:92%; max-height:92vh; overflow:auto; padding:24px;' });
    modal.appendChild(el('h2', { style: 'margin:0 0 8px;' }, '🖊️ Mark writing with AI'));
    modal.appendChild(el('p', { style: 'margin:0 0 16px; color:#666;' }, 'Upload the student\'s writing. Pick a rubric. Get a marked PDF you can download and save.'));

    const rubricLbl = el('label', { style: 'display:block; font-weight:600; margin:8px 0 4px;' }, 'Rubric');
    const rubricSel = el('select', { style: 'width:100%; padding:8px; border:1px solid #D1D5DB; border-radius:6px;' });
    rubrics.forEach(function(r){ rubricSel.appendChild(el('option', { value: r.slug }, r.label)); });
    rubricSel.appendChild(el('option', { value: '_custom' }, '✏️ Custom rubric (paste your own)'));
    const customArea = el('textarea', { style: 'width:100%; margin-top:8px; padding:8px; border:1px solid #D1D5DB; border-radius:6px; min-height:80px; display:none;', placeholder: 'Paste your rubric here. List the criteria, their max scores, and any band descriptors.' });
    rubricSel.onchange = function(){ customArea.style.display = rubricSel.value === '_custom' ? 'block' : 'none'; };

    const nameLbl = el('label', { style: 'display:block; font-weight:600; margin:16px 0 4px;' }, 'Student name');
    const nameInp = el('input', { type: 'text', style: 'width:100%; padding:8px; border:1px solid #D1D5DB; border-radius:6px;' });

    const fileLbl = el('label', { style: 'display:block; font-weight:600; margin:16px 0 4px;' }, 'Upload writing (image or PDF)');
    const fileInp = el('input', { type: 'file', accept: 'image/*,application/pdf', style: 'width:100%; padding:8px; border:1px solid #D1D5DB; border-radius:6px;' });

    const folderLbl = el('label', { style: 'display:block; font-weight:600; margin:16px 0 4px;' }, 'Save to folder (optional)');
    const folderRow = el('div', { style: 'display:flex; gap:8px;' });
    const folderSel = el('select', { style: 'flex:1; padding:8px; border:1px solid #D1D5DB; border-radius:6px;' });
    folderSel.appendChild(el('option', { value: '' }, '— Don\'t save —'));
    // Only show writing folders (skip legacy folders like Reading).
    // Only WRITING folders: name must start with "Writing" (created via the class picker).
    const writingFolders = folders.filter(function(f){ return f && /^Writing/i.test(String(f.name || '').trim()); });
    writingFolders.forEach(function(f){ folderSel.appendChild(el('option', { value: f.id }, '📁 ' + f.name)); });
    writingFolders.forEach(function(f){ folderSel.appendChild(el('option', { value: f.id }, '📁 ' + f.name)); });
    const newFolderBtn = el('button', { style: 'padding:8px 14px; background:#F3F4F6; border:1px solid #D1D5DB; border-radius:6px; cursor:pointer;' }, '+ New folder');
    newFolderBtn.onclick = async function () {
      // Fetch classes, present a picker.
      let classes = [];
      try { classes = await fetchJson('/api/teacher/my-classes-brief'); } catch(e){}
      if (!classes.length) { alert('You have no classes yet. Create a class from Manage classes first.'); return; }
      const pickOverlay = overlayHost();
      const pickModal = el('div', { style: 'background:#fff; border-radius:12px; max-width:400px; width:90%; padding:20px;' });
      pickModal.appendChild(el('h3', { style: 'margin:0 0 12px;' }, 'Create writing folder for…'));
      const clsSel = el('select', { style: 'width:100%; padding:8px; border:1px solid #D1D5DB; border-radius:6px;' });
      classes.forEach(function(c){ clsSel.appendChild(el('option', { value: c.id }, c.name)); });
      pickModal.appendChild(clsSel);
      const okBtn = el('button', { style: 'margin-top:16px; padding:8px 16px; background:#4338CA; color:#fff; border:none; border-radius:6px; cursor:pointer;' }, 'Create');
      const cancelBtn = el('button', { style: 'margin-top:16px; margin-left:8px; padding:8px 16px; background:#F3F4F6; border:1px solid #D1D5DB; border-radius:6px; cursor:pointer;' }, 'Cancel');
      cancelBtn.onclick = function(){ pickOverlay.remove(); };
      okBtn.onclick = async function () {
        const cls = classes.find(x => x.id === clsSel.value);
        try {
          const f = await fetchJson('/api/teacher/folders', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ classId: cls.id, className: cls.name }),
          });
          // Ensure the option is in the dropdown; select it.
          let existing = Array.from(folderSel.options).find(o => o.value === f.id);
          if (!existing) folderSel.appendChild(el('option', { value: f.id }, '📁 ' + f.name));
          folderSel.value = f.id;
          pickOverlay.remove();
        } catch (e) { alert('Failed: ' + e.message); }
      };
      pickModal.appendChild(okBtn); pickModal.appendChild(cancelBtn);
      pickOverlay.appendChild(pickModal); document.body.appendChild(pickOverlay);
    };
    folderRow.appendChild(folderSel); folderRow.appendChild(newFolderBtn);

    const status = el('div', { style: 'margin-top:16px; padding:12px; background:#F3F4F6; border-radius:6px; color:#374151; font-size:13px; display:none;' });
    const result = el('div', { style: 'margin-top:16px; display:none;' });

    const submitBtn = el('button', { style: 'margin-top:20px; padding:10px 20px; background:#4338CA; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:600;' }, 'Mark with AI');
    const closeBtn  = el('button', { style: 'margin-top:20px; margin-left:8px; padding:10px 20px; background:#F3F4F6; color:#374151; border:1px solid #D1D5DB; border-radius:6px; cursor:pointer;' }, 'Close');
    closeBtn.onclick = function(){ overlay.remove(); };

    let currentMarking = null;
    let currentStudentName = '';
    let currentRubricLabel = '';

    submitBtn.onclick = async function () {
      const f = fileInp.files && fileInp.files[0];
      if (!f) { alert('Please choose an image or PDF first.'); return; }
      submitBtn.disabled = true; submitBtn.textContent = 'Marking (30–60s)…';
      status.style.display = 'block'; status.textContent = 'Sending writing to AI…';
      result.style.display = 'none';
      const fd = new FormData();
      fd.append('writing', f);
      fd.append('rubricSlug', rubricSel.value === '_custom' ? '' : rubricSel.value);
      if (rubricSel.value === '_custom') fd.append('customRubric', customArea.value);
      fd.append('studentName', nameInp.value || '');
      try {
        const r = await fetch('/api/teacher/ai-mark-writing', { method: 'POST', body: fd, credentials: 'include' });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Failed');
        currentMarking = j.marking; currentStudentName = j.studentName || nameInp.value || '';
        currentRubricLabel = j.rubricLabel || (rubricSel.selectedOptions[0] && rubricSel.selectedOptions[0].textContent) || '';
        renderResult(result, j.marking, currentStudentName);
        status.style.display = 'none';
        result.style.display = 'block';
      } catch (e) {
        status.textContent = 'Failed: ' + (e.message || e);
      } finally {
        submitBtn.disabled = false; submitBtn.textContent = 'Mark another';
      }
    };

    function renderResult(host, m, studentName) {
      host.innerHTML = '';
      host.appendChild(el('h3', { style: 'margin:0 0 8px;' }, 'Marking result' + (studentName ? ' — ' + studentName : '')));
      host.appendChild(el('div', { style: 'padding:12px; background:#EEF2FF; border-radius:6px; margin-bottom:12px;' },
        el('div', { style: 'font-size:18px; font-weight:700;' }, 'Score: ' + m.totalScore + ' / ' + m.maxScore + '   (' + Math.round((m.totalScore/m.maxScore)*100) + '%)'),
        el('div', { style: 'margin-top:4px; color:#4338CA;' }, 'Band: ' + (m.band || '—')),
      ));
      // Mistakes.
      if (Array.isArray(m.mistakes) && m.mistakes.length) {
        host.appendChild(el('h4', { style: 'margin:12px 0 6px;' }, 'Corrections (' + m.mistakes.length + ')'));
        m.mistakes.slice(0, 20).forEach(function(k, i){
          host.appendChild(el('div', { style: 'padding:8px 10px; border-left:2px solid #B91C1C; background:#FEF2F2; margin:4px 0; font-size:13px;' },
            el('div', {},
              (i+1) + '. "', el('span', { style: 'color:#B91C1C;' }, k.text || ''), '" → "', el('span', { style: 'color:#059669;' }, k.correction || ''), '" (', k.type || 'note', ')'
            ),
            k.explanation ? el('div', { style: 'color:#6B7280; font-size:12px; margin-top:2px;' }, k.explanation) : null,
          ));
        });
        if (m.mistakes.length > 20) host.appendChild(el('div', { style: 'color:#6B7280; font-size:12px;' }, '…and ' + (m.mistakes.length - 20) + ' more (see PDF).'));
      }
      // Criteria.
      if (Array.isArray(m.criteria)) {
        host.appendChild(el('h4', { style: 'margin:12px 0 6px;' }, 'Rubric scoring'));
        m.criteria.forEach(function(k){
          host.appendChild(el('div', { style: 'padding:8px; margin:4px 0; background:#F9FAFB; border-left:3px solid #4338CA;' },
            el('div', { style: 'font-weight:600;' }, k.name + ' — ' + k.score + '/' + k.max),
            el('div', { style: 'color:#374151; font-size:13px;' }, k.comment || ''),
          ));
        });
      }
      if (m.overallComment) host.appendChild(el('div', { style: 'margin-top:12px; padding:10px; background:#FEF7E6; border-left:3px solid #F59E0B;' }, el('strong', {}, 'Overall: '), m.overallComment));
      if (m.feedback) host.appendChild(el('div', { style: 'margin-top:12px; padding:10px; background:#ECFDF5; border-left:3px solid #059669;' }, el('strong', {}, 'Feedback for student: '), m.feedback));

      // Action buttons.
      const actionRow = el('div', { style: 'margin-top:16px; display:flex; gap:8px; flex-wrap:wrap;' });
      const dlBtn = el('button', { style: 'padding:10px 16px; background:#0369A1; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:600;' }, '📄 Download marked PDF');
      dlBtn.onclick = async function () {
        dlBtn.disabled = true; dlBtn.textContent = 'Building PDF…';
        try {
          const r = await fetch('/api/teacher/ai-mark-writing/pdf', {
            method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'include',
            body: JSON.stringify({ marking: currentMarking, rubricLabel: currentRubricLabel, studentName: currentStudentName }),
          });
          if (!r.ok) { const j = await r.json().catch(function(){return{}}); throw new Error(j.error || ('HTTP ' + r.status)); }
          const blob = await r.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url;
          a.download = (currentStudentName || 'student').replace(/[^A-Za-z0-9_-]+/g, '_') + '_marked_writing.pdf';
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function(){ URL.revokeObjectURL(url); }, 5000);
          dlBtn.textContent = '✓ Downloaded';
        } catch (e) { alert('Download failed: ' + e.message); dlBtn.textContent = '📄 Download marked PDF'; }
        finally { dlBtn.disabled = false; }
      };
      actionRow.appendChild(dlBtn);

      // Save to folder button (if a folder is selected).
      if (folderSel.value) {
        const saveBtn = el('button', { style: 'padding:10px 16px; background:#059669; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:600;' }, '💾 Save to folder');
        saveBtn.onclick = async function () {
          saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
          try {
            // Regenerate PDF and post to the folder-save endpoint.
            const r1 = await fetch('/api/teacher/ai-mark-writing/pdf', {
              method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'include',
              body: JSON.stringify({ marking: currentMarking, rubricLabel: currentRubricLabel, studentName: currentStudentName }),
            });
            if (!r1.ok) throw new Error('PDF build failed');
            const blob = await r1.blob();
            const fd2 = new FormData();
            fd2.append('pdf', blob, (currentStudentName || 'student') + '_marked_writing.pdf');
            fd2.append('studentName', currentStudentName || '');
            const r2 = await fetch('/api/teacher/folders/' + folderSel.value + '/save-marking', { method: 'POST', body: fd2, credentials: 'include' });
            const j = await r2.json();
            if (!r2.ok) throw new Error(j.error || 'save failed');
            saveBtn.textContent = '✓ Saved to folder';
          } catch (e) { alert('Save failed: ' + e.message); saveBtn.textContent = '💾 Save to folder'; }
          finally { saveBtn.disabled = false; }
        };
        actionRow.appendChild(saveBtn);
      }
      host.appendChild(actionRow);
    }

    modal.appendChild(rubricLbl); modal.appendChild(rubricSel); modal.appendChild(customArea);
    modal.appendChild(nameLbl); modal.appendChild(nameInp);
    modal.appendChild(fileLbl); modal.appendChild(fileInp);
    modal.appendChild(folderLbl); modal.appendChild(folderRow);
    modal.appendChild(submitBtn); modal.appendChild(closeBtn);
    modal.appendChild(status); modal.appendChild(result);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  // ── Folder browser ─────────────────────────────────────────────────
  async function openFolderBrowser() {
    let folders = [];
    try { folders = await fetchJson('/api/teacher/folders'); } catch(e){ alert('Load folders failed: ' + e.message); return; }

    const overlay = overlayHost();
    const modal = el('div', { style: 'background:#fff; border-radius:12px; max-width:800px; width:92%; max-height:92vh; overflow:auto; padding:24px;' });
    modal.appendChild(el('h2', { style: 'margin:0 0 12px;' }, '📁 My marking folders'));

    const list = el('div', { style: 'display:flex; flex-direction:column; gap:8px;' });
    // Only show writing folders in the browser.
    const writingOnly = folders.filter(function(x){ return x && /^Writing/i.test(String(x.name || '').trim()); });
    if (!writingOnly.length) list.appendChild(el('div', { style: 'color:#6B7280;' }, 'No writing folders yet. Create one from the "🖊️ AI Mark Writing" modal → + New folder.'));
    for (const f of writingOnly) {
      const card = el('div', { style: 'padding:12px; border:1px solid #E5E7EB; border-radius:8px;' });
      const actions = el('div', { style: 'display:flex; gap:6px;' });
      const openBtn = el('button', { style: 'padding:4px 10px; background:#EEF2FF; color:#4338CA; border:none; border-radius:4px; cursor:pointer; font-size:12px;' }, 'Open');
      const delBtn  = el('button', { style: 'padding:4px 10px; background:#FEE2E2; color:#B91C1C; border:none; border-radius:4px; cursor:pointer; font-size:12px;' }, 'Delete');
      delBtn.onclick = async function () {
        if (!confirm('Delete folder "' + f.name + '" and all saved markings inside?')) return;
        try { await fetchJson('/api/teacher/folders/' + f.id, { method: 'DELETE' }); card.remove(); }
        catch (e) { alert('Delete failed: ' + e.message); }
      };
      actions.appendChild(openBtn); actions.appendChild(delBtn);
      const header = el('div', { style: 'display:flex; justify-content:space-between; align-items:center;' },
        el('div', { style: 'font-weight:600;' }, '📁 ' + f.name),
        actions,
      );
      const detail = el('div', { style: 'margin-top:8px; display:none;' });
      openBtn.onclick = async function () {
        if (detail.style.display === 'block') { detail.style.display = 'none'; openBtn.textContent = 'Open'; return; }
        try {
          const j = await fetchJson('/api/teacher/folders/' + f.id);
          detail.innerHTML = '';
          if (!j.markings.length) { detail.appendChild(el('div', { style: 'color:#6B7280;' }, 'Empty folder.')); }
          else j.markings.forEach(function(m){
            detail.appendChild(el('div', { style: 'padding:6px; border-top:1px solid #F3F4F6; display:flex; justify-content:space-between; align-items:center;' },
              el('div', {}, '📄 ' + m.studentName + '  ', el('span', { style: 'color:#6B7280; font-size:12px;' }, new Date(m.createdAt).toLocaleString())),
              el('a', { href: '/api/teacher/markings/' + m.id + '/download', style: 'color:#4338CA; text-decoration:none; font-size:13px;' }, 'Download'),
            ));
          });
          detail.style.display = 'block'; openBtn.textContent = 'Close';
        } catch (e) { alert('Load failed: ' + e.message); }
      };
      card.appendChild(header); card.appendChild(detail);
      list.appendChild(card);
    }

    const closeBtn = el('button', { style: 'margin-top:16px; padding:8px 16px; background:#F3F4F6; border:1px solid #D1D5DB; border-radius:6px; cursor:pointer;' }, 'Close');
    closeBtn.onclick = function(){ overlay.remove(); };
    modal.appendChild(list); modal.appendChild(closeBtn);
    overlay.appendChild(modal); document.body.appendChild(overlay);
  }

  function installButtons() {
    if (!document.getElementById('cc-ai-mark-btn')) {
      const btn = el('button', { id: 'cc-ai-mark-btn',
        style: 'position:fixed; bottom:24px; right:24px; z-index:9998; padding:14px 20px; background:#059669; color:#fff; border:none; border-radius:999px; box-shadow:0 8px 24px rgba(5,150,105,0.4); cursor:pointer; font-weight:600; font-size:14px;',
        onclick: openMarkModal }, '🖊️ AI Mark Writing');
      document.body.appendChild(btn);
    }
    if (!document.getElementById('cc-folders-btn')) {
      const btn2 = el('button', { id: 'cc-folders-btn',
        style: 'position:fixed; bottom:24px; left:24px; z-index:9998; padding:14px 20px; background:#4338CA; color:#fff; border:none; border-radius:999px; box-shadow:0 8px 24px rgba(67,56,202,0.4); cursor:pointer; font-weight:600; font-size:14px;',
        onclick: openFolderBrowser }, '📁 My Folders');
      document.body.appendChild(btn2);
    }
  }
  document.addEventListener('DOMContentLoaded', installButtons);
  setTimeout(installButtons, 500);
})();
// ─────────────────────────────────────────────────────────────────────


// ── Dashboard cleanup: slim per-card action buttons (v2) ─────────────
(function () {
  const PRIMARY = new Set(['Share with students', 'Results', 'Edit']);
  const SECONDARY_ORDER = ['PDF', 'Share with teacher', 'Preview', 'Move', 'Duplicate', 'Delete'];
  let openMenu = null;
  let openedAt = 0;

  function positionMenu(menu, anchor) {
    const r = anchor.getBoundingClientRect();
    menu.style.position = 'fixed';
    // Show menu to get its height, then decide up or down.
    menu.style.visibility = 'hidden';
    menu.style.display = 'block';
    const menuHeight = menu.offsetHeight || 240;
    const menuWidth = 200;
    const vh = window.innerHeight;
    const spaceBelow = vh - r.bottom;
    const spaceAbove = r.top;
    // If there's not enough room below AND more room above, flip up.
    if (spaceBelow < menuHeight + 20 && spaceAbove > spaceBelow) {
      menu.style.top = Math.max(8, r.top - menuHeight - 6) + 'px';
    } else {
      menu.style.top = (r.bottom + 6) + 'px';
    }
    let left = r.right - menuWidth;
    if (left < 8) left = 8;
    menu.style.left = left + 'px';
    menu.style.minWidth = menuWidth + 'px';
    menu.style.zIndex = '999999';
    menu.style.visibility = 'visible';
  }

  function closeAny() {
    if (openMenu) { openMenu.style.display = 'none'; openMenu = null; }
  }

  function slimCard(row) {
    if (row.dataset.ccSlim === '2') return;
    const btns = Array.from(row.querySelectorAll('button, a'));
    if (!btns.length) return;
    // Strip leading emojis/symbols/whitespace so "📄 PDF" matches "PDF".
    function label(b) {
      return String(b.textContent || '').replace(/^[^A-Za-z]+/, '').trim();
    }
    const hasDelete  = btns.some(b => /^Delete/i.test(label(b)));
    const hasResults = btns.some(b => /^Results/i.test(label(b)));
    if (!hasDelete || !hasResults) return;

    const secondary = [];
    for (const b of btns) {
      const l = label(b);
      if (b.classList.contains('cc-marked-pdfs-btn')) continue;
      // Match PRIMARY by prefix (allows for trailing icons/counts).
      let isPrimary = false;
      for (const p of PRIMARY) { if (l.toLowerCase().startsWith(p.toLowerCase())) { isPrimary = true; break; } }
      if (isPrimary) continue;
      let isSecondary = false;
      for (const s of SECONDARY_ORDER) { if (l.toLowerCase().startsWith(s.toLowerCase())) { isSecondary = true; break; } }
      if (isSecondary) secondary.push(b);
    }
    if (!secondary.length) { row.dataset.ccSlim = '2'; return; }

    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'cc-more-btn';
    more.textContent = '⋯ More';
    more.style.cssText = 'margin:0 4px; padding:8px 12px; background:#F3F4F6; border:1px solid #D1D5DB; border-radius:6px; cursor:pointer; font-size:13px;';

    const menu = document.createElement('div');
    menu.className = 'cc-more-menu';
    menu.style.cssText = 'background:#fff; border:1px solid #E5E7EB; border-radius:8px; box-shadow:0 10px 30px rgba(0,0,0,0.15); padding:6px; display:none;';

    secondary.sort(function(a, b){
      function labelOf(el){ return String(el.textContent||'').replace(/^[^A-Za-z]+/,'').trim(); }
      function rankOf(el){
        const t = labelOf(el).toLowerCase();
        for (let i = 0; i < SECONDARY_ORDER.length; i++) { if (t.startsWith(SECONDARY_ORDER[i].toLowerCase())) return i; }
        return 99;
      }
      return rankOf(a) - rankOf(b);
    });
    secondary.forEach(b => {
      b.style.display     = 'block';
      b.style.width       = '100%';
      b.style.textAlign   = 'left';
      b.style.margin      = '2px 0';
      b.style.padding     = '8px 10px';
      b.style.background  = 'transparent';
      b.style.border      = 'none';
      b.style.borderRadius= '4px';
      b.style.cursor      = 'pointer';
      b.style.color       = /^Delete/i.test(String(b.textContent||'').replace(/^[^A-Za-z]+/,'').trim()) ? '#B91C1C' : '#111827';
      b.addEventListener('mouseenter', function(){ b.style.background = '#F3F4F6'; });
      b.addEventListener('mouseleave', function(){ b.style.background = 'transparent'; });
      // Close menu after they click any item.
      const originalClick = b.onclick;
      b.addEventListener('click', function(){ setTimeout(closeAny, 50); });
      menu.appendChild(b);
    });

    // Menu must live at document.body so it isn't clipped by card overflow.
    document.body.appendChild(menu);

    more.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (openMenu === menu) { closeAny(); return; }
      closeAny();
      positionMenu(menu, more);
      menu.style.display = 'block';
      openMenu = menu;
      openedAt = Date.now();
    };
    row.appendChild(more);
    row.dataset.ccSlim = '2';
  }

  // Close on outside click, but not the click that just opened.
  document.addEventListener('click', function (e) {
    if (!openMenu) return;
    if (Date.now() - openedAt < 150) return;
    if (openMenu.contains(e.target)) return;
    closeAny();
  }, true);

  // Reposition on scroll/resize.
  window.addEventListener('scroll', function(){ if (openMenu) closeAny(); }, true);
  window.addEventListener('resize', function(){ if (openMenu) closeAny(); });

  function scan() {
    const candidates = new Set();
    document.querySelectorAll('button, a').forEach(function (btn) {
      if (!/^Delete/i.test(String(btn.textContent || '').replace(/^[^A-Za-z]+/,'').trim())) return;
      const parent = btn.parentElement;
      if (parent) candidates.add(parent);
    });
    candidates.forEach(slimCard);
  }
  document.addEventListener('DOMContentLoaded', scan);
  setTimeout(scan, 500);
  setTimeout(scan, 1500);
  if (window.MutationObserver) {
    let t = null;
    new MutationObserver(function () { clearTimeout(t); t = setTimeout(scan, 200); })
      .observe(document.body, { childList: true, subtree: true });
  }
})();
// ─────────────────────────────────────────────────────────────────────


// ── Dashboard cleanup: search box + collapsible filters ───────────────
(function () {
  // 1. Insert a search input above the assessments list.
  function installSearch() {
    if (document.getElementById('cc-search-input')) return;
    // Find the "Your assessments" heading.
    const headings = Array.from(document.querySelectorAll('h1,h2,h3'));
    const heading = headings.find(h => /Your assessments/i.test(h.textContent || ''));
    if (!heading) return;
    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin:12px 0; position:relative;';
    const inp = document.createElement('input');
    inp.id = 'cc-search-input';
    inp.type = 'search';
    inp.placeholder = '🔍 Search assessments by title…';
    inp.style.cssText = 'width:100%; max-width:520px; padding:10px 14px; border:1px solid #D1D5DB; border-radius:8px; font-size:14px; background:#fff;';
    wrap.appendChild(inp);
    heading.insertAdjacentElement('afterend', wrap);

    inp.addEventListener('input', function () {
      const q = inp.value.trim().toLowerCase();
      // Cards = rows with a Delete button; their card container is a few levels up.
      const cards = new Set();
      document.querySelectorAll('.cc-more-btn, button').forEach(function (btn) {
        const t = String(btn.textContent || '').replace(/^[^A-Za-z]+/, '').trim();
        if (!(/^Delete/i.test(t) || btn.classList.contains('cc-more-btn'))) return;
        // Climb up until we hit a card boundary — heuristic: element wider than 500px.
        let p = btn.parentElement;
        for (let n = 0; n < 6 && p; n++, p = p.parentElement) {
          const w = p.getBoundingClientRect().width;
          if (w > 500 && p.tagName !== 'DIV' || w > 600) { cards.add(p); break; }
          if (n === 5) cards.add(p);
        }
      });
      cards.forEach(function (card) {
        const txt = (card.textContent || '').toLowerCase();
        card.style.display = (!q || txt.includes(q)) ? '' : 'none';
      });
    });
  }

  // 2. Collapse the Term/Grade/Academic Year filter row.
  function installFilterCollapse() {
    if (document.getElementById('cc-filters-toggle')) return;
    // Find labels that look like our filter labels.
    const labels = Array.from(document.querySelectorAll('label, div, span'));
    const termLabel = labels.find(l => /^TERM$/i.test((l.textContent || '').trim()));
    if (!termLabel) return;
    // Walk up until we find a row that contains TERM + GRADE + ACADEMIC YEAR labels.
    let row = termLabel;
    for (let n = 0; n < 6 && row; n++, row = row.parentElement) {
      const t = (row.textContent || '').toUpperCase();
      if (t.includes('TERM') && t.includes('GRADE') && t.includes('ACADEMIC YEAR')) break;
    }
    if (!row) return;
    // Build a toggle pill and insert it before the row.
    const toggle = document.createElement('button');
    toggle.id = 'cc-filters-toggle';
    toggle.type = 'button';
    toggle.textContent = '⚙️ Filters ▾';
    toggle.style.cssText = 'margin:8px 0; padding:8px 14px; background:#F3F4F6; border:1px solid #D1D5DB; border-radius:999px; cursor:pointer; font-size:13px; font-weight:600;';
    row.style.display = 'none';
    row.parentElement.insertBefore(toggle, row);
    toggle.addEventListener('click', function () {
      const open = row.style.display !== 'none';
      row.style.display = open ? 'none' : '';
      toggle.textContent = open ? '⚙️ Filters ▾' : '⚙️ Filters ▴';
    });
  }

  function run() {
    installSearch();
    installFilterCollapse();
  }
  document.addEventListener('DOMContentLoaded', run);
  setTimeout(run, 500);
  setTimeout(run, 1500);
  if (window.MutationObserver) {
    let t = null;
    new MutationObserver(function () { clearTimeout(t); t = setTimeout(run, 300); })
      .observe(document.body, { childList: true, subtree: true });
  }
})();
// ─────────────────────────────────────────────────────────────────────


// ── Dashboard cleanup #3-#6 ──────────────────────────────────────────
(function () {
  // ── #3 Combined FAB ────────────────────────────────────────────────
  function installFab() {
    if (document.getElementById('cc-fab')) return;
    // Remove the old individual floating buttons if they exist.
    const oldBtns = ['cc-ai-mark-btn', 'cc-folders-btn'];
    oldBtns.forEach(id => { const b = document.getElementById(id); if (b) { b.style.display='none'; b.setAttribute('aria-hidden','true'); } });

    const fabWrap = document.createElement('div');
    fabWrap.id = 'cc-fab';
    fabWrap.style.cssText = 'position:fixed; bottom:24px; right:24px; z-index:9998;';

    const menu = document.createElement('div');
    menu.style.cssText = 'position:absolute; bottom:66px; right:0; display:none; flex-direction:column; gap:8px; align-items:flex-end;';

    function menuItem(label, bg, onClick) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      btn.style.cssText = 'padding:12px 18px; background:' + bg + '; color:#fff; border:none; border-radius:999px; box-shadow:0 6px 18px rgba(0,0,0,0.15); cursor:pointer; font-weight:600; font-size:14px; white-space:nowrap;';
      btn.onclick = function () { menu.style.display = 'none'; onClick(); };
      return btn;
    }
    // Wire to existing functions.
    menu.appendChild(menuItem('🖊️ Mark writing with AI', '#059669', function(){ const oldMark = document.getElementById('cc-ai-mark-btn'); if (oldMark && oldMark.onclick) oldMark.onclick(); else if (oldMark) oldMark.click(); else if (typeof openMarkModal === 'function') openMarkModal(); else window.ccToast && window.ccToast('AI Mark Writing not available', { type:'error' }); }));
    menu.appendChild(menuItem('📁 My marking folders',    '#4338CA', function(){ const oldFold = document.getElementById('cc-folders-btn'); if (oldFold && oldFold.onclick) oldFold.onclick(); else if (oldFold) oldFold.click(); else if (typeof openFolderBrowser === 'function') openFolderBrowser(); else window.ccToast && window.ccToast('My Folders not available', { type:'error' }); }));

    const fab = document.createElement('button');
    fab.type = 'button';
    fab.setAttribute('aria-label', 'Quick actions');
    fab.textContent = '+';
    fab.style.cssText = 'width:56px; height:56px; border-radius:50%; background:#4338CA; color:#fff; border:none; font-size:28px; font-weight:300; cursor:pointer; box-shadow:0 8px 24px rgba(67,56,202,0.4); transition:transform 0.15s;';
    fab.onclick = function (e) {
      e.stopPropagation();
      const open = menu.style.display === 'flex';
      menu.style.display = open ? 'none' : 'flex';
      fab.style.transform = open ? 'rotate(0deg)' : 'rotate(45deg)';
    };
    document.addEventListener('click', function (e) {
      if (!fabWrap.contains(e.target)) { menu.style.display = 'none'; fab.style.transform = 'rotate(0deg)'; }
    });

    fabWrap.appendChild(menu); fabWrap.appendChild(fab);
    document.body.appendChild(fabWrap);
  }

  // ── #4 Shrink welcome banner ───────────────────────────────────────
  function installBannerShrink() {
    if (localStorage.getItem('cc-banner-hidden') === '1') {
      const hideBanner = function () {
        document.querySelectorAll('*').forEach(function (el) {
          const t = (el.textContent || '').trim();
          if (/^Welcome to your ClassCurio dashboard/i.test(t) && el.children.length < 20 && el.getBoundingClientRect().height > 100) {
            let banner = el;
            for (let n = 0; n < 4 && banner.parentElement; n++) {
              const p = banner.parentElement;
              if (p.getBoundingClientRect().height > 400) { banner = p; break; }
              banner = p;
            }
            banner.style.display = 'none';
          }
        });
      };
      setTimeout(hideBanner, 200);
      setTimeout(hideBanner, 800);
      return;
    }
    if (document.getElementById('cc-banner-shrink')) return;
    // Find the banner root — an element with the welcome text that is tall.
    let banner = null;
    document.querySelectorAll('*').forEach(function (el) {
      if (banner) return;
      const t = (el.textContent || '').trim();
      if (/^Welcome to your ClassCurio dashboard/i.test(t) && el.children.length < 20) {
        let p = el;
        for (let n = 0; n < 5 && p.parentElement; n++, p = p.parentElement) {
          const r = p.getBoundingClientRect();
          if (r.height > 300) { banner = p; break; }
        }
      }
    });
    if (!banner) return;
    // Add an "X" hide button.
    const x = document.createElement('button');
    x.id = 'cc-banner-shrink';
    x.type = 'button';
    x.textContent = '✕';
    x.title = 'Hide this banner (permanent)';
    x.style.cssText = 'position:absolute; top:10px; right:16px; background:rgba(255,255,255,0.2); color:#fff; border:none; border-radius:50%; width:32px; height:32px; font-size:16px; cursor:pointer; z-index:5;';
    x.onclick = function () {
      localStorage.setItem('cc-banner-hidden', '1');
      banner.style.display = 'none';
    };
    banner.style.position = 'relative';
    banner.appendChild(x);
    // Also shrink the height.
    banner.style.maxHeight = '120px';
    banner.style.overflow = 'hidden';
  }

  // ── #5 Categorize the Tools dropdown ───────────────────────────────
  function installToolsCategorization() {
    // The Tools dropdown menu — find any container with many items whose
    // trigger button includes the text "Tools".
    const triggers = Array.from(document.querySelectorAll('button, a')).filter(function (b) {
      return /Tools/i.test((b.textContent || '').trim());
    });
    if (!triggers.length) return;
    // We look for the menu after clicking. Instead, we listen for click
    // on any Tools button and re-order the menu items on next paint.
    triggers.forEach(function (t) {
      if (t.dataset.ccCatWired === '1') return;
      t.dataset.ccCatWired = '1';
      t.addEventListener('click', function () {
        setTimeout(reorganize, 100);
        setTimeout(reorganize, 400);
      });
    });
    function reorganize() {
      // Any visible dropdown/menu with >20 items is our target.
      const candidates = Array.from(document.querySelectorAll('ul, div')).filter(function (el) {
        const r = el.getBoundingClientRect();
        if (r.width < 100 || r.height < 100) return false;
        if (el.dataset.ccCategorized === '1') return false;
        // Item count.
        const items = el.children.length;
        return items >= 20 && r.height > 300;
      });
      candidates.forEach(function (menu) {
        // Categorize each direct child by its text.
        const groups = { 'AI tools': [], 'Data & Reports': [], 'Admin': [], 'Assessment tools': [] };
        const originalChildren = Array.from(menu.children);
        originalChildren.forEach(function (item) {
          const t = (item.textContent || '').toLowerCase();
          let g = 'Assessment tools';
          if (/\b(ai|auto|generate|regenerate|mark writing|extract)\b/.test(t)) g = 'AI tools';
          else if (/\b(report|export|analytics|results|stats|insights|dashboard|leaderboard)\b/.test(t)) g = 'Data & Reports';
          else if (/\b(admin|user|permission|backup|restore|role|invite|two-?factor|2fa|lockout|reports)\b/.test(t)) g = 'Admin';
          groups[g].push(item);
        });
        // Rebuild the menu with headers.
        menu.innerHTML = '';
        Object.keys(groups).forEach(function (gname) {
          if (!groups[gname].length) return;
          const hdr = document.createElement('div');
          hdr.textContent = gname;
          hdr.style.cssText = 'padding:8px 12px 4px; font-size:11px; font-weight:700; color:#6B7280; text-transform:uppercase; letter-spacing:0.05em; border-top:1px solid #F3F4F6;';
          menu.appendChild(hdr);
          groups[gname].forEach(function (item) { menu.appendChild(item); });
        });
        menu.dataset.ccCategorized = '1';
      });
    }
  }

  // ── #6 Colored status chips ────────────────────────────────────────
  function installStatusChips() {
    const badges = Array.from(document.querySelectorAll('span, div, small'))
      .filter(function (el) {
        const t = (el.textContent || '').trim();
        return (t === 'Published' || t === 'Draft' || t === 'Scheduled' || t === 'Archived') && el.children.length === 0;
      });
    badges.forEach(function (b) {
      if (b.dataset.ccChip === '1') return;
      const t = b.textContent.trim();
      const map = {
        'Published': { bg: '#DCFCE7', fg: '#166534', icon: '✅' },
        'Scheduled': { bg: '#FEF3C7', fg: '#92400E', icon: '⏰' },
        'Draft':     { bg: '#E5E7EB', fg: '#374151', icon: '📝' },
        'Archived':  { bg: '#FEE2E2', fg: '#991B1B', icon: '📦' },
      };
      const s = map[t]; if (!s) return;
      b.style.background = s.bg;
      b.style.color = s.fg;
      b.style.padding = '3px 10px';
      b.style.borderRadius = '999px';
      b.style.fontSize = '12px';
      b.style.fontWeight = '600';
      b.style.display = 'inline-flex';
      b.style.alignItems = 'center';
      b.style.gap = '4px';
      b.textContent = s.icon + ' ' + t;
      b.dataset.ccChip = '1';
    });
  }

  function run() {
    installFab();
    installBannerShrink();
    installToolsCategorization();
    installStatusChips();
  }
  document.addEventListener('DOMContentLoaded', run);
  setTimeout(run, 400);
  setTimeout(run, 1200);
  if (window.MutationObserver) {
    let t = null;
    new MutationObserver(function () { clearTimeout(t); t = setTimeout(run, 300); })
      .observe(document.body, { childList: true, subtree: true });
  }
})();
// ─────────────────────────────────────────────────────────────────────


// ── Old floating buttons: permanent removal ──────────────────────────
(function () {
  function killOld() {
    ['cc-ai-mark-btn', 'cc-folders-btn'].forEach(function (id) {
      const b = document.getElementById(id);
      if (b && b.style.display !== 'none') { b.style.display = 'none'; b.setAttribute('aria-hidden', 'true'); }
    });
  }
  killOld();
  setInterval(killOld, 300);
  if (window.MutationObserver) {
    new MutationObserver(killOld).observe(document.body, { childList: true, subtree: true });
  }
})();
// ────────────────────────────────────────────────────────────────────


// ── Hide the outer "count" badge on the Tools button ─────────────────
(function () {
  function hideBadge() {
    document.querySelectorAll('button, a').forEach(function (btn) {
      const t = (btn.textContent || '').trim();
      if (!/Tools/i.test(t)) return;
      // Find red/badge-styled child (round pill with a number).
      const kids = btn.querySelectorAll('span, small, div');
      kids.forEach(function (k) {
        const kt = (k.textContent || '').trim();
        if (/^\d+$/.test(kt)) {
          k.style.display = 'none';
          k.setAttribute('aria-hidden', 'true');
        }
      });
    });
  }
  hideBadge();
  setInterval(hideBadge, 500);
  if (window.MutationObserver) {
    new MutationObserver(hideBadge).observe(document.body, { childList: true, subtree: true });
  }
})();
// ────────────────────────────────────────────────────────────────────


// ── Dashboard Pro Features ────────────────────────────────────────────
(function () {
  // ── #2 Toast notifications ─────────────────────────────────────────
  function ensureToastRoot() {
    let root = document.getElementById('cc-toast-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'cc-toast-root';
      root.style.cssText = 'position:fixed; top:20px; right:20px; z-index:999999; display:flex; flex-direction:column; gap:10px; pointer-events:none;';
      document.body.appendChild(root);
    }
    return root;
  }
  window.ccToast = function (msg, opts) {
    opts = opts || {};
    const root = ensureToastRoot();
    const t = document.createElement('div');
    const bg = opts.type === 'error' ? '#B91C1C' : opts.type === 'success' ? '#059669' : '#1F2937';
    t.style.cssText = 'pointer-events:auto; padding:12px 16px; background:' + bg + '; color:#fff; border-radius:8px; box-shadow:0 10px 30px rgba(0,0,0,0.2); font-size:14px; min-width:200px; max-width:360px; opacity:0; transform:translateX(20px); transition:opacity 0.2s, transform 0.2s;';
    t.textContent = String(msg);
    root.appendChild(t);
    setTimeout(function(){ t.style.opacity='1'; t.style.transform='translateX(0)'; }, 10);
    setTimeout(function(){
      t.style.opacity='0'; t.style.transform='translateX(20px)';
      setTimeout(function(){ t.remove(); }, 300);
    }, opts.duration || 4000);
  };
  // Monkey-patch alert() to route through toasts (short messages only).
  const _origAlert = window.alert;
  window.alert = function (msg) {
    const s = String(msg || '');
    if (s.length < 200) { window.ccToast(s, { type: /fail|error|couldn|not able/i.test(s) ? 'error' : 'info' }); }
    else { _origAlert.call(window, msg); }
  };

  // ── #1 Command palette (⌘K) ────────────────────────────────────────
  let paletteOpen = false;
  async function openPalette() {
    if (paletteOpen) return;
    paletteOpen = true;
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:999998; display:flex; align-items:flex-start; justify-content:center; padding-top:120px;';
    const panel = document.createElement('div');
    panel.style.cssText = 'background:#fff; border-radius:12px; box-shadow:0 30px 80px rgba(0,0,0,0.4); width:640px; max-width:90%; max-height:70vh; display:flex; flex-direction:column; overflow:hidden;';
    const input = document.createElement('input');
    input.type = 'search';
    input.placeholder = '🔍 Type to search — assessments, classes, tools…';
    input.style.cssText = 'padding:16px 20px; border:none; border-bottom:1px solid #E5E7EB; font-size:16px; outline:none;';
    const results = document.createElement('div');
    results.style.cssText = 'overflow:auto; padding:6px;';
    panel.appendChild(input); panel.appendChild(results);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    input.focus();

    // Gather searchable items from the current page.
    function collect() {
      const items = [];
      // Cards on the current dashboard: any element containing "Delete" button + a title.
      document.querySelectorAll('*').forEach(function () {});
      // Simpler heuristic: find any card containing "Share with students".
      document.querySelectorAll('*').forEach(function (el) {
        if (el.children.length > 20) return;
        const btns = el.querySelectorAll('button, a');
        const hasShare = Array.from(btns).some(b => /Share with students/i.test((b.textContent||'').trim()));
        const hasDelete = Array.from(btns).some(b => /Delete/i.test((b.textContent||'').trim()));
        if (!hasShare && !hasDelete) return;
        // Extract card title = first non-button significant text.
        const clone = el.cloneNode(true);
        clone.querySelectorAll('button, a').forEach(x => x.remove());
        const title = (clone.textContent || '').trim().split('\n')[0].slice(0, 120);
        if (title && title.length > 6) items.push({ kind: 'Assessment', label: title, el });
      });
      // Classes from dropdown.
      const classSel = document.querySelector('select');
      if (classSel) Array.from(classSel.options).forEach(o => {
        if (o.value) items.push({ kind: 'Class', label: 'Class: ' + o.textContent, action: function(){ classSel.value = o.value; classSel.dispatchEvent(new Event('change', { bubbles: true })); } });
      });
      // Tools.
      const tools = ['Settings', 'Students', 'Grade essays', 'Quick Import', 'Manage classes', 'Mark writing with AI', 'My marking folders'];
      tools.forEach(t => items.push({ kind: 'Tool', label: t }));
      // Deduplicate by label.
      const seen = new Set();
      return items.filter(i => { const k = i.kind + '::' + i.label; if (seen.has(k)) return false; seen.add(k); return true; });
    }

    const all = collect();
    let filtered = all.slice(0, 30);
    let selected = 0;

    function render() {
      results.innerHTML = '';
      if (!filtered.length) {
        const empty = document.createElement('div');
        empty.style.cssText = 'padding:20px; color:#9CA3AF; text-align:center;';
        empty.textContent = 'No matches.';
        results.appendChild(empty);
        return;
      }
      filtered.forEach(function (item, i) {
        const row = document.createElement('div');
        row.style.cssText = 'padding:10px 14px; border-radius:6px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; background:' + (i === selected ? '#EEF2FF' : 'transparent') + ';';
        const left = document.createElement('div');
        left.textContent = item.label;
        left.style.cssText = 'font-size:14px; color:#111827;';
        const right = document.createElement('div');
        right.textContent = item.kind;
        right.style.cssText = 'font-size:11px; color:#6B7280; text-transform:uppercase; letter-spacing:0.05em;';
        row.appendChild(left); row.appendChild(right);
        row.onclick = function () { activate(item); };
        row.onmouseenter = function () { selected = i; render(); };
        results.appendChild(row);
      });
    }
    function activate(item) {
      close();
      if (item.action) return item.action();
      if (item.el) {
        item.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        item.el.style.transition = 'box-shadow 0.4s';
        item.el.style.boxShadow = '0 0 0 3px #4338CA';
        setTimeout(function(){ item.el.style.boxShadow = ''; }, 1500);
        return;
      }
      // Tools: try to click the matching menu item.
      const tools = Array.from(document.querySelectorAll('button, a'));
      const match = tools.find(x => (x.textContent||'').includes(item.label));
      if (match) match.click();
      else window.ccToast('Not found on this page: ' + item.label);
    }
    function close() {
      paletteOpen = false;
      overlay.remove();
    }
    input.addEventListener('input', function () {
      const q = input.value.toLowerCase();
      filtered = all.filter(i => i.label.toLowerCase().includes(q)).slice(0, 30);
      selected = 0;
      render();
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); selected = Math.min(selected + 1, filtered.length - 1); render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); selected = Math.max(selected - 1, 0); render(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (filtered[selected]) activate(filtered[selected]); }
    });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    render();
  }
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openPalette(); }
  });

  // ── #3 Sticky header when scrolled ─────────────────────────────────
  function installStickyHeader() {
    if (document.getElementById('cc-sticky-hdr')) return;
    const bar = document.createElement('div');
    bar.id = 'cc-sticky-hdr';
    bar.style.cssText = 'position:fixed; top:0; left:0; right:0; z-index:9990; background:rgba(255,255,255,0.98); backdrop-filter:blur(6px); border-bottom:1px solid #E5E7EB; padding:10px 20px; display:none; align-items:center; gap:12px; box-shadow:0 4px 12px rgba(0,0,0,0.05);';
    bar.innerHTML = '<div style="font-weight:700; color:#4338CA;">ClassCurio</div>' +
      '<input id="cc-sticky-search" type="search" placeholder="🔍 Search (⌘K for palette)" style="flex:1; max-width:400px; padding:6px 10px; border:1px solid #D1D5DB; border-radius:6px;">' +
      '<button id="cc-sticky-new" style="padding:6px 12px; background:#4338CA; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:600;">+ New</button>';
    document.body.appendChild(bar);
    // Mirror the sticky search into the main search.
    bar.querySelector('#cc-sticky-search').addEventListener('input', function (e) {
      const main = document.getElementById('cc-search-input');
      if (main) { main.value = e.target.value; main.dispatchEvent(new Event('input', { bubbles: true })); }
    });
    // New button clicks the real New Assessment.
    bar.querySelector('#cc-sticky-new').addEventListener('click', function () {
      const btn = Array.from(document.querySelectorAll('button, a')).find(b => /\+?\s*New assessment/i.test((b.textContent||'').trim()));
      if (btn) btn.click();
    });
    window.addEventListener('scroll', function () {
      const show = window.scrollY > 300;
      bar.style.display = show ? 'flex' : 'none';
    });
  }

  // ── #4 Bulk actions ────────────────────────────────────────────────
  const selectedCards = new Set();
  function installBulkActions() {
    // Add a checkbox to each card. Card = row containing Delete button (via row.parentElement climbing).
    document.querySelectorAll('button, a').forEach(function (btn) {
      const t = (btn.textContent||'').trim();
      if (!/^Share with students/i.test(t)) return;
      // Climb to find the enclosing card (roughly).
      let card = btn.parentElement;
      for (let n = 0; n < 5 && card; n++, card = card.parentElement) {
        if (card.getBoundingClientRect().width > 600 && card.querySelector('h1, h2, h3, strong, b, .title')) break;
      }
      if (!card || card.dataset.ccBulk === '1') return;
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'cc-bulk-check';
      cb.style.cssText = 'position:absolute; top:12px; left:12px; width:18px; height:18px; cursor:pointer; z-index:5;';
      card.style.position = card.style.position || 'relative';
      card.insertBefore(cb, card.firstChild);
      cb.addEventListener('change', function () {
        if (cb.checked) selectedCards.add(card);
        else selectedCards.delete(card);
        updateBulkBar();
      });
      card.dataset.ccBulk = '1';
    });
  }
  function updateBulkBar() {
    let bar = document.getElementById('cc-bulk-bar');
    if (selectedCards.size === 0) { if (bar) bar.remove(); return; }
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'cc-bulk-bar';
      bar.style.cssText = 'position:fixed; bottom:24px; left:50%; transform:translateX(-50%); z-index:9997; background:#1F2937; color:#fff; padding:12px 20px; border-radius:999px; box-shadow:0 10px 30px rgba(0,0,0,0.3); display:flex; align-items:center; gap:12px;';
      document.body.appendChild(bar);
    }
    bar.innerHTML = '';
    const count = document.createElement('span');
    count.textContent = selectedCards.size + ' selected';
    bar.appendChild(count);
    function actionBtn(label, color, action) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.style.cssText = 'padding:6px 12px; background:' + color + '; color:#fff; border:none; border-radius:6px; cursor:pointer;';
      b.onclick = action;
      return b;
    }
    bar.appendChild(actionBtn('Delete', '#B91C1C', function () {
      if (!confirm('Delete ' + selectedCards.size + ' assessments?')) return;
      selectedCards.forEach(card => {
        // Click the card's Delete button.
        const deleteBtn = Array.from(card.querySelectorAll('button, a')).find(b => /^Delete/i.test((b.textContent||'').replace(/^[^A-Za-z]+/,'').trim()));
        if (deleteBtn) deleteBtn.click();
      });
      selectedCards.clear(); updateBulkBar();
    }));
    bar.appendChild(actionBtn('Duplicate', '#4338CA', function () {
      selectedCards.forEach(card => {
        const dup = Array.from(card.querySelectorAll('button, a')).find(b => /Duplicate/i.test((b.textContent||'').trim()));
        if (dup) dup.click();
      });
      selectedCards.clear(); updateBulkBar();
    }));
    bar.appendChild(actionBtn('Clear', '#6B7280', function () {
      document.querySelectorAll('.cc-bulk-check:checked').forEach(cb => { cb.checked = false; });
      selectedCards.clear(); updateBulkBar();
    }));
  }

  // ── #5 Group cards by term (only when more than 5 cards) ───────────
  function installGrouping() {
    // Skip for now: safe DOM reorganization is fragile; provide a "Group by
    // term" toggle instead.
    if (document.getElementById('cc-group-toggle')) return;
    const filtersToggle = document.getElementById('cc-filters-toggle');
    if (!filtersToggle) return;
    const grpBtn = document.createElement('button');
    grpBtn.id = 'cc-group-toggle';
    grpBtn.type = 'button';
    grpBtn.textContent = '📚 Group by Term';
    grpBtn.style.cssText = 'margin:8px 4px; padding:8px 14px; background:#F3F4F6; border:1px solid #D1D5DB; border-radius:999px; cursor:pointer; font-size:13px; font-weight:600;';
    filtersToggle.insertAdjacentElement('afterend', grpBtn);
    let grouped = false;
    grpBtn.onclick = function () {
      grouped = !grouped;
      grpBtn.textContent = grouped ? '📚 Ungroup' : '📚 Group by Term';
      // Find all card elements.
      const cards = [];
      document.querySelectorAll('input.cc-bulk-check').forEach(cb => cards.push(cb.parentElement));
      if (!cards.length) return;
      const parent = cards[0].parentElement;
      // Remove existing group headers.
      parent.querySelectorAll('.cc-group-hdr').forEach(h => h.remove());
      if (!grouped) return;
      // Group.
      const groups = {};
      cards.forEach(card => {
        const txt = card.textContent || '';
        const m = txt.match(/Term\s+(\d+)/i);
        const key = m ? 'Term ' + m[1] : 'Other';
        (groups[key] = groups[key] || []).push(card);
      });
      Object.keys(groups).sort().forEach(k => {
        const h = document.createElement('div');
        h.className = 'cc-group-hdr';
        h.textContent = '▾ ' + k + ' (' + groups[k].length + ')';
        h.style.cssText = 'margin:16px 0 8px; padding:8px 12px; background:#EEF2FF; color:#4338CA; font-weight:700; border-radius:6px;';
        parent.appendChild(h);
        groups[k].forEach(card => parent.appendChild(card));
      });
    };
  }

  // ── #6 Analytics summary strip ─────────────────────────────────────
  function installAnalytics() {
    if (document.getElementById('cc-analytics')) return;
    const search = document.getElementById('cc-search-input');
    if (!search) return;
    const strip = document.createElement('div');
    strip.id = 'cc-analytics';
    strip.style.cssText = 'margin:8px 0 16px; display:flex; gap:20px; padding:12px 16px; background:#F9FAFB; border:1px solid #E5E7EB; border-radius:8px; font-size:13px; color:#374151;';
    function refresh() {
      const cards = document.querySelectorAll('input.cc-bulk-check').length;
      const published = document.querySelectorAll('[data-cc-chip="1"]').length;
      // Grade essays count from tools dropdown.
      let essays = 0;
      const gr = Array.from(document.querySelectorAll('*')).find(el => /Grade essays/i.test((el.textContent||'').trim()) && el.children.length < 5);
      if (gr) { const m = (gr.textContent||'').match(/\b(\d+)\b/); if (m) essays = Number(m[1]); }
      strip.innerHTML =
        '<div>📊 <b>' + cards + '</b> assessments</div>' +
        '<div>✅ <b>' + published + '</b> published</div>' +
        '<div>📝 <b>' + essays + '</b> essays to grade</div>' +
        '<div style="margin-left:auto; color:#9CA3AF;">⌘K to search</div>';
    }
    search.parentElement.insertBefore(strip, search.parentElement.firstChild);
    refresh();
    setInterval(refresh, 2000);
  }

  function run() {
    installStickyHeader();
    installBulkActions();
    installGrouping();
    installAnalytics();
  }
  document.addEventListener('DOMContentLoaded', run);
  setTimeout(run, 500);
  setTimeout(run, 1500);
  if (window.MutationObserver) {
    let t = null;
    new MutationObserver(function () { clearTimeout(t); t = setTimeout(run, 300); })
      .observe(document.body, { childList: true, subtree: true });
  }

  window.ccToast('Pro features loaded — press ⌘K to search', { type: 'success', duration: 3000 });
})();
// ─────────────────────────────────────────────────────────────────────


// ── Class Averages modal + FAB entry ─────────────────────────────────
(function () {
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    if (attrs) for (const k of Object.keys(attrs)) {
      if (k === 'style') n.style.cssText = attrs[k];
      else if (k === 'onclick') n.onclick = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    for (const kid of kids) if (kid !== null && kid !== undefined) n.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
    return n;
  }

  async function fetchJson(url, init){
    const r = await fetch(url, Object.assign({ credentials: 'include' }, init || {}));
    const j = await r.json().catch(function(){ return { error: 'Bad response' }; });
    if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
    return j;
  }

  window.openClassAveragesModal = async function () {
    let classes = [];
    try { classes = await fetchJson('/api/teacher/my-classes-brief'); } catch(e){}
    const overlay = el('div', { style: 'position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:99999; display:flex; align-items:center; justify-content:center;' });
    const modal = el('div', { style: 'background:#fff; border-radius:12px; max-width:720px; width:92%; max-height:92vh; overflow:auto; padding:24px;' });
    modal.appendChild(el('h2', { style: 'margin:0 0 8px;' }, '📊 Class Averages'));
    modal.appendChild(el('p', { style: 'margin:0 0 16px; color:#666;' }, 'Pick a class, tick the assessments to include, and download an Excel with each student\'s score per assessment and their average (out of 100).'));

    const clsLbl = el('label', { style: 'display:block; font-weight:600; margin:8px 0 4px;' }, 'Class');
    const clsSel = el('select', { style: 'width:100%; padding:8px; border:1px solid #D1D5DB; border-radius:6px;' });
    clsSel.appendChild(el('option', { value: '' }, '— Choose a class —'));
    classes.forEach(function(cls){ clsSel.appendChild(el('option', { value: cls.id }, cls.name)); });

    const listLbl = el('label', { style: 'display:block; font-weight:600; margin:16px 0 4px;' }, 'Assessments');
    const listWrap = el('div', { style: 'max-height:320px; overflow:auto; border:1px solid #E5E7EB; border-radius:8px; padding:8px; background:#F9FAFB;' });
    listWrap.textContent = 'Pick a class first.';
    const listAll = el('label', { style: 'display:block; margin-top:8px; font-size:13px; color:#374151;' });
    const listAllCb = el('input', { type: 'checkbox' });
    listAll.appendChild(listAllCb); listAll.appendChild(document.createTextNode(' Select all'));

    const status = el('div', { style: 'margin-top:16px; padding:12px; background:#F3F4F6; border-radius:6px; color:#374151; font-size:13px; display:none;' });

    const genBtn = el('button', { style: 'margin-top:20px; padding:10px 20px; background:#4338CA; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:600;' }, '📥 Generate Excel');
    const closeBtn = el('button', { style: 'margin-top:20px; margin-left:8px; padding:10px 20px; background:#F3F4F6; color:#374151; border:1px solid #D1D5DB; border-radius:6px; cursor:pointer;' }, 'Close');
    closeBtn.onclick = function(){ overlay.remove(); };

    let currentAssessments = [];
    clsSel.onchange = async function () {
      if (!clsSel.value) { listWrap.textContent = 'Pick a class first.'; currentAssessments = []; return; }
      status.style.display = 'block'; status.textContent = 'Loading assessments…';
      try {
        currentAssessments = await fetchJson('/api/teacher/classes/' + encodeURIComponent(clsSel.value) + '/assessments');
        listWrap.innerHTML = '';
        if (!currentAssessments.length) { listWrap.textContent = 'No assessments found for this class.'; status.style.display = 'none'; return; }
        currentAssessments.forEach(function (a) {
          const row = el('label', { style: 'display:flex; align-items:center; gap:8px; padding:6px; border-radius:4px; cursor:pointer;' });
          const cb = el('input', { type: 'checkbox', 'data-aid': a.id });
          cb.style.cursor = 'pointer';
          const title = el('span', {}, a.title + (a.published ? ' ✅' : ''));
          row.appendChild(cb); row.appendChild(title);
          listWrap.appendChild(row);
        });
        status.style.display = 'none';
      } catch (e) {
        status.textContent = 'Failed: ' + e.message;
      }
    };
    listAllCb.onchange = function () {
      listWrap.querySelectorAll('input[type=checkbox]').forEach(function(cb){ cb.checked = listAllCb.checked; });
    };

    genBtn.onclick = async function () {
      const ids = Array.from(listWrap.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.getAttribute('data-aid'));
      if (!clsSel.value) { alert('Pick a class first.'); return; }
      if (!ids.length) { alert('Pick at least one assessment.'); return; }
      genBtn.disabled = true; genBtn.textContent = 'Building Excel…';
      status.style.display = 'block'; status.textContent = 'Computing averages and building spreadsheet…';
      try {
        const r = await fetch('/api/teacher/class-averages-excel', {
          method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ classId: clsSel.value, assessmentIds: ids }),
        });
        if (!r.ok) { let msg = 'Failed'; try { const j = await r.json(); msg = j.error || msg; } catch(_){} throw new Error(msg); }
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        const cd = r.headers.get('Content-Disposition') || '';
        const m = cd.match(/filename="?([^";]+)"?/i);
        a.download = m ? m[1] : 'class_averages.xlsx';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function(){ URL.revokeObjectURL(url); }, 5000);
        status.textContent = '✓ Downloaded. Check your Downloads folder.';
      } catch (e) {
        status.textContent = 'Failed: ' + (e.message || e);
      } finally {
        genBtn.disabled = false; genBtn.textContent = '📥 Generate Excel';
      }
    };

    modal.appendChild(clsLbl); modal.appendChild(clsSel);
    modal.appendChild(listLbl); modal.appendChild(listWrap); modal.appendChild(listAll);
    modal.appendChild(genBtn); modal.appendChild(closeBtn);
    modal.appendChild(status);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  };

  // Add to FAB menu.
  function injectFabItem() {
    const fabWrap = document.getElementById('cc-fab');
    if (!fabWrap) return;
    const menu = fabWrap.querySelector('div');
    if (!menu || menu.querySelector('.cc-avg-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'cc-avg-btn';
    btn.type = 'button';
    btn.textContent = '📊 Class Averages';
    btn.style.cssText = 'padding:12px 18px; background:#0369A1; color:#fff; border:none; border-radius:999px; box-shadow:0 6px 18px rgba(0,0,0,0.15); cursor:pointer; font-weight:600; font-size:14px; white-space:nowrap;';
    btn.onclick = function () { menu.style.display = 'none'; window.openClassAveragesModal(); };
    menu.insertBefore(btn, menu.firstChild);
  }
  setInterval(injectFabItem, 500);
  document.addEventListener('DOMContentLoaded', injectFabItem);
})();
// ─────────────────────────────────────────────────────────────────────


// ── Parent Reports modal + FAB entry ─────────────────────────────────
(function () {
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    if (attrs) for (const k of Object.keys(attrs)) {
      if (k === 'style') n.style.cssText = attrs[k];
      else if (k === 'onclick') n.onclick = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    for (const kid of kids) if (kid !== null && kid !== undefined) n.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
    return n;
  }
  async function fetchJson(url, init){
    const r = await fetch(url, Object.assign({ credentials: 'include' }, init || {}));
    const j = await r.json().catch(function(){ return { error: 'Bad response' }; });
    if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
    return j;
  }

  window.openParentReportsModal = async function () {
    let classes = [];
    try { classes = await fetchJson('/api/teacher/my-classes-brief'); } catch(e){}
    const overlay = el('div', { style: 'position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:99999; display:flex; align-items:center; justify-content:center;' });
    const modal = el('div', { style: 'background:#fff; border-radius:12px; max-width:640px; width:92%; max-height:92vh; overflow:auto; padding:24px;' });
    modal.appendChild(el('h2', { style: 'margin:0 0 8px;' }, '📄 Parent Reports'));
    modal.appendChild(el('p', { style: 'margin:0 0 16px; color:#666;' }, 'Finds students who need support and writes one Word letter per student for the parents: an "Inconsistent performance" letter when results swing up and down, or a "Consistently low performance" letter when results stay below the level you set. Each letter lists her results and the skills she finds hardest. You can edit each before printing.'));

    const clsLbl = el('label', { style: 'display:block; font-weight:600; margin:8px 0 4px;' }, 'Class');
    const clsSel = el('select', { style: 'width:100%; padding:8px; border:1px solid #D1D5DB; border-radius:6px;' });
    clsSel.appendChild(el('option', { value: '' }, '— Choose a class —'));
    classes.forEach(function(cls){ clsSel.appendChild(el('option', { value: cls.id }, cls.name)); });

    const langLbl = el('label', { style: 'display:block; font-weight:600; margin:16px 0 4px;' }, 'Language');
    const langSel = el('select', { style: 'width:100%; padding:8px; border:1px solid #D1D5DB; border-radius:6px;' });
    [['both','English + Arabic (both files)'], ['en','English only'], ['ar','Arabic only']].forEach(function(o){
      langSel.appendChild(el('option', { value: o[0] }, o[1]));
    });

    const typeLbl = el('label', { style: 'display:block; font-weight:600; margin:16px 0 4px;' }, 'Report type');
    const typeSel = el('select', { style: 'width:100%; padding:8px; border:1px solid #D1D5DB; border-radius:6px;' });
    [['auto','Both — chosen automatically for each student'], ['low','Consistently low performance only'], ['inconsistent','Inconsistent performance only']].forEach(function(o){
      typeSel.appendChild(el('option', { value: o[0] }, o[1]));
    });
    const thrLbl = el('label', { style: 'display:block; font-weight:600; margin:16px 0 4px;' }, 'Poor performance if score < ');
    const thrVal = el('span', { id: 'cc-pr-thr-val', style: 'color:#4338CA;' }, '60%');
    thrLbl.appendChild(thrVal);
    const thrInp = el('input', { type: 'range', min: '30', max: '80', value: '60', style: 'width:100%;' });
    thrInp.oninput = function(){ thrVal.textContent = thrInp.value + '%'; };
    const thrHelp = el('div', { style: 'font-size:12px; color:#6B7280; margin-top:4px;' }, 'Flags a student who has 2 or more assessments in a row below this level. If almost all of her results are below it, she gets the "Consistently low" letter; otherwise the "Inconsistent" letter.');
    modal.__thrHelp = thrHelp;

    const saveLbl = el('label', { style: 'display:block; margin:16px 0; font-size:14px;' });
    const saveCb = el('input', { type: 'checkbox', checked: 'checked' });
    saveLbl.appendChild(saveCb);
    saveLbl.appendChild(document.createTextNode(' Save the ZIP into a "Parent Reports — {Class}" folder for later access'));

    const status = el('div', { style: 'margin-top:16px; padding:12px; background:#F3F4F6; border-radius:6px; color:#374151; font-size:13px; display:none;' });

    const genBtn = el('button', { style: 'margin-top:16px; padding:10px 20px; background:#4338CA; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:600;' }, '📥 Generate reports');
    const closeBtn = el('button', { style: 'margin-top:16px; margin-left:8px; padding:10px 20px; background:#F3F4F6; color:#374151; border:1px solid #D1D5DB; border-radius:6px; cursor:pointer;' }, 'Close');
    closeBtn.onclick = function(){ overlay.remove(); };

    genBtn.onclick = async function () {
      if (!clsSel.value) { alert('Pick a class first.'); return; }
      genBtn.disabled = true; genBtn.textContent = 'Generating…';
      status.style.display = 'block'; status.textContent = 'Analysing scores and building reports (may take up to a minute)…';
      try {
        const r = await fetch('/api/teacher/parent-reports/generate', {
          method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({
            classId: clsSel.value,
            language: langSel.value,
            threshold: Number(thrInp.value),
            minConsecutive: 2,
            reportType: typeSel.value,
            saveToFolder: saveCb.checked,
          }),
        });
        if (!r.ok) { let msg = 'Failed'; try { const j = await r.json(); msg = j.error || msg; } catch(_){} throw new Error(msg); }
        const flagged = r.headers.get('X-CC-Students-Flagged') || '?';
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        const cd = r.headers.get('Content-Disposition') || '';
        const m = cd.match(/filename="?([^";]+)"?/i);
        a.download = m ? m[1] : 'parent_reports.zip';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function(){ URL.revokeObjectURL(url); }, 5000);
        const nLow = r.headers.get('X-CC-Low'), nInc = r.headers.get('X-CC-Inconsistent');
        status.textContent = '✓ Downloaded. Students: ' + flagged + (nLow != null ? ' (' + nLow + ' consistently low, ' + nInc + ' inconsistent)' : '') + '. ' + (saveCb.checked ? 'Also saved to your Parent Reports folder.' : '');
      } catch (e) {
        status.textContent = 'Failed: ' + (e.message || e);
      } finally {
        genBtn.disabled = false; genBtn.textContent = '📥 Generate reports';
      }
    };

    modal.appendChild(clsLbl); modal.appendChild(clsSel);
    modal.appendChild(langLbl); modal.appendChild(langSel);
    modal.appendChild(typeLbl); modal.appendChild(typeSel);
    modal.appendChild(thrLbl); modal.appendChild(thrInp); modal.appendChild(modal.__thrHelp);
    modal.appendChild(saveLbl);
    modal.appendChild(genBtn); modal.appendChild(closeBtn);
    modal.appendChild(status);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  };

  function injectFabItem() {
    const fabWrap = document.getElementById('cc-fab');
    if (!fabWrap) return;
    const menu = fabWrap.querySelector('div');
    if (!menu || menu.querySelector('.cc-pr-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'cc-pr-btn'; btn.type = 'button';
    btn.textContent = '📄 Parent Reports';
    btn.style.cssText = 'padding:12px 18px; background:#B45309; color:#fff; border:none; border-radius:999px; box-shadow:0 6px 18px rgba(0,0,0,0.15); cursor:pointer; font-weight:600; font-size:14px; white-space:nowrap;';
    btn.onclick = function(){ menu.style.display = 'none'; window.openParentReportsModal(); };
    menu.insertBefore(btn, menu.firstChild);
  }
  setInterval(injectFabItem, 500);
  document.addEventListener('DOMContentLoaded', injectFabItem);
})();
// ─────────────────────────────────────────────────────────────────────


// ── Close the editor whenever the dashboard is showing ─────────────────
// The questions panel and Save row sit outside #builder-view, so any path
// that returns to the dashboard must also remove .cc-builder-open.
(function ccCloseBuilderOnDashboard() {
  function sync() {
    const list = els.listView, builder = els.builderView;
    const listShown = list && list.style.display !== 'none' && getComputedStyle(list).display !== 'none';
    const builderHidden = !builder || builder.style.display === 'none' || !builder.isConnected;
    // Only touch the class when it is actually present — writing it
    // unconditionally re-triggers observers and can loop forever.
    if ((listShown || builderHidden) && document.body.classList.contains('cc-builder-open')) {
      document.body.classList.remove('cc-builder-open');
    }
  }
  const obs = new MutationObserver(sync);
  if (els.listView) obs.observe(els.listView, { attributes: true, attributeFilter: ['style'] });
  if (els.builderView) obs.observe(els.builderView, { attributes: true, attributeFilter: ['style'] });
  setInterval(sync, 400);
  sync();
})();

// ════════════════════════════════════════════════════════════════════════
//  Maths preview, paste-a-screenshot questions, accurate AI diagrams
// ════════════════════════════════════════════════════════════════════════

function ccHasMath(s) {
  return /\\\(|\\\[|\\[a-zA-Z]+|\^\{|_\{/.test(String(s || ''));
}

// Rendered preview of the question as students will see it (only shown
// when the question contains maths). MathJax typesets it automatically.
function ccMathPreviewHtml(q) {
  const parts = [q.prompt || ''].concat(q.type === 'mc' ? (q.options || []) : []);
  if (!parts.some(ccHasMath)) return '';
  const opts = q.type === 'mc'
    ? '<ol type="A" style="margin:6px 0 0 18px; padding:0;">' + (q.options || []).map((o) => `<li>${escapeHtml(o || '')}</li>`).join('') + '</ol>'
    : '';
  return `<div style="font-size:12px; color:#6b7280; margin-bottom:4px;">Preview — how students will see it</div>
    <div dir="auto" style="font-size:16px; line-height:1.6; color:#1a1e33;">${escapeHtml(q.prompt || '')}</div>${opts}`;
}

function ccRefreshMathPreview(root, q) {
  const box = root.querySelector('[data-math-preview]');
  if (!box) return;
  const html = ccMathPreviewHtml(q);
  box.innerHTML = html;
  box.style.display = html ? 'block' : 'none';
  if (html && window.MathJax && window.MathJax.typesetPromise) {
    try { window.MathJax.typesetPromise([box]).catch(() => {}); } catch (e) {}
  }
}

function ccFileToDataUrl(file, maxW = 1600) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the image'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file is not a readable image'));
      img.onload = () => {
        const ratio = Math.min(1, maxW / img.width);
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * ratio); c.height = Math.round(img.height * ratio);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.92));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Crop a region (fractions 0–1) out of a data-URL image, with a small margin.
function ccCropDataUrl(dataUrl, box, pad = 0.03) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const W = img.width, H = img.height;
      const x = Math.max(0, (box.x - pad) * W), y = Math.max(0, (box.y - pad) * H);
      const w = Math.min(W - x, (box.w + 2 * pad) * W), h = Math.min(H - y, (box.h + 2 * pad) * H);
      if (w < 10 || h < 10) return resolve('');
      const scale = Math.min(1, 900 / w);
      const c = document.createElement('canvas');
      c.width = Math.round(w * scale); c.height = Math.round(h * scale);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, x, y, w, h, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => resolve('');
    img.src = dataUrl;
  });
}

async function ccQuestionFromContent(payload) {
  const r = await fetch('/api/ai/question-from-content', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(Object.assign({
      subject: (els.subject && els.subject.value) || '',
      language: (els.assessmentLanguage && els.assessmentLanguage.value) || (document.getElementById('assessment-language') || {}).value || '',
    }, payload)),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
  return j.question;
}

// Replace the question in its slot with what the AI read.
async function ccApplyAiQuestion(q, ai, sourceImage) {
  const types = ['mc', 'tf', 'tfng', 'short', 'long', 'essay', 'writing', 'match'];
  const t = types.includes(ai.type) ? ai.type : (q.type || 'short');
  q.type = t;
  q.prompt = String(ai.prompt || '');
  q.imageDescription = '';
  if (ai.skill) q.skill = String(ai.skill);
  if (ai.explanation) q.explanation = String(ai.explanation);
  if (ai.points && Number(ai.points) > 0) q.points = Number(ai.points);
  if (t === 'mc') {
    q.options = (Array.isArray(ai.options) && ai.options.length ? ai.options : ['', '', '', '']).map(String);
    const i = parseInt(ai.correctAnswer, 10);
    q.correctAnswer = i >= 0 && i < q.options.length ? i : 0;
  } else {
    q.options = [];
    if (t === 'tf') q.correctAnswer = ai.correctAnswer === true || String(ai.correctAnswer).toLowerCase() === 'true';
    else if (t === 'tfng') { const v = String(ai.correctAnswer || '').toLowerCase(); q.correctAnswer = ['true', 'false', 'ng'].includes(v) ? v : 'true'; }
    else if (t === 'short') q.correctAnswer = ai.correctAnswer != null ? String(ai.correctAnswer) : '';
    else q.correctAnswer = null;
  }
  if (t === 'match') {
    q.matchVariant = ai.matchVariant === 'word-word' ? 'word-word' : 'word-definition';
    q.pairs = (Array.isArray(ai.pairs) ? ai.pairs : []).slice(0, 30).map((p) => ({ left: String((p && p.left) || ''), right: String((p && p.right) || ''), rightImageUrl: '' }));
    if (!q.pairs.length) q.pairs = [{ left: '', right: '', rightImageUrl: '' }];
  }
  q.imageUrl = '';
  if (sourceImage && ai.hasFigure && ai.figureBox) {
    q.imageUrl = await ccCropDataUrl(sourceImage, ai.figureBox);
  }
  q._aiCheck = !!ai.answerUnsure || ['mc', 'tf', 'tfng', 'short'].includes(t);
}

// ── Safe maths expression compiler (no eval) ─────────────────────────────
function ccCompileExpr(src) {
  let s = String(src || '').trim()
    .replace(/^\s*(?:y|f\s*\(\s*x\s*\))\s*=/i, '')
    .replace(/\*\*/g, '^').replace(/π/g, 'pi').replace(/[−–]/g, '-').replace(/×/g, '*').replace(/÷/g, '/')
    .replace(/\s+/g, '');
  const FUN = {
    asin: Math.asin, acos: Math.acos, atan: Math.atan, sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan,
    abs: Math.abs, exp: Math.exp, ln: Math.log, log: (v) => Math.log10(v), sec: (v) => 1 / Math.cos(v), csc: (v) => 1 / Math.sin(v), cot: (v) => 1 / Math.tan(v),
  };
  const NAMES = Object.keys(FUN).sort((a, b) => b.length - a.length).concat(['pi', 'x', 'e']);
  let i = 0;
  const peek = () => s[i];
  const startsPrimary = (c) => c !== undefined && /[0-9.a-zA-Z(]/.test(c);
  function expr() {
    let f = term();
    for (;;) {
      const c = peek();
      if (c === '+' || c === '-') { i++; const a = f, b = term(); f = c === '+' ? (x) => a(x) + b(x) : (x) => a(x) - b(x); } else return f;
    }
  }
  function term() {
    let f = unary();
    for (;;) {
      const c = peek();
      if (c === '*' || c === '/') { i++; const a = f, b = unary(); f = c === '*' ? (x) => a(x) * b(x) : (x) => a(x) / b(x); }
      else if (startsPrimary(c)) { const a = f, b = power(); f = (x) => a(x) * b(x); }
      else return f;
    }
  }
  function unary() {
    const c = peek();
    if (c === '-') { i++; const a = unary(); return (x) => -a(x); }
    if (c === '+') { i++; return unary(); }
    return power();
  }
  function power() {
    const base = primary();
    if (peek() === '^') { i++; const ex = unary(); return (x) => Math.pow(base(x), ex(x)); }
    return base;
  }
  function primary() {
    const c = peek();
    if (c === '(') { i++; const f = expr(); if (peek() !== ')') throw new Error('Missing )'); i++; return f; }
    if (/[0-9.]/.test(c || '')) {
      let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const v = parseFloat(s.slice(i, j)); if (isNaN(v)) throw new Error('Bad number'); i = j; return () => v;
    }
    if (/[a-zA-Z]/.test(c || '')) {
      const name = NAMES.find((n) => s.startsWith(n, i));
      if (!name) throw new Error('Unknown symbol at ' + s.slice(i, i + 6));
      i += name.length;
      if (FUN[name]) {
        const fn = FUN[name];
        if (peek() === '(') { i++; const arg = expr(); if (peek() !== ')') throw new Error('Missing )'); i++; return (x) => fn(arg(x)); }
        const arg = power(); return (x) => fn(arg(x));
      }
      if (name === 'x') return (x) => x;
      if (name === 'pi') return () => Math.PI;
      return () => Math.E;
    }
    throw new Error('Unexpected ' + (c || 'end'));
  }
  const f = expr();
  if (i < s.length) throw new Error('Unexpected ' + s[i]);
  return f;
}

function ccNiceStep(range) {
  const raw = range / 10;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
}
function ccFmtNum(v) {
  const r = Math.round(v * 1000) / 1000;
  return String(r).replace('-', '−');
}
function ccPlainLabel(s) {
  return String(s == null ? '' : s)
    .replace(/\\\(|\\\)|\\\[|\\\]/g, '').replace(/\^\{?\\circ\}?/g, '°')
    .replace(/\\theta/g, 'θ').replace(/\\alpha/g, 'α').replace(/\\beta/g, 'β').replace(/\\pi/g, 'π').replace(/\\Delta/g, 'Δ')
    .replace(/\\times/g, '×').replace(/\\cdot/g, '·').replace(/\\le(q)?/g, '≤').replace(/\\ge(q)?/g, '≥')
    .replace(/\^\{?2\}?/g, '²').replace(/\^\{?3\}?/g, '³').replace(/\\[a-zA-Z]+/g, '').replace(/[{}]/g, '');
}
function ccEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const CC_SVG_HEAD = '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400" font-family="Arial, Helvetica, sans-serif">'
  + '<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#111"/></marker>'
  + '<marker id="arb" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#1d4ed8"/></marker></defs>'
  + '<rect width="600" height="400" fill="#fff"/>';

function ccRenderAxes(spec) {
  const W = 600, H = 400, m = { l: 50, r: 30, t: 25, b: 40 };
  const fns = (spec.functions || []).map((f) => ({ ...f, fn: ccCompileExpr(f.expr) }));
  let [x0, x1] = Array.isArray(spec.x) && spec.x.length === 2 ? spec.x.map(Number) : [-10, 10];
  if (!(x1 > x0)) [x0, x1] = [-10, 10];
  let y0, y1;
  if (Array.isArray(spec.y) && spec.y.length === 2 && Number(spec.y[1]) > Number(spec.y[0])) [y0, y1] = spec.y.map(Number);
  else {
    const ys = [0];
    for (const f of fns) for (let k = 0; k <= 200; k++) { const x = x0 + (x1 - x0) * k / 200; const v = f.fn(x); if (isFinite(v)) ys.push(v); }
    (spec.points || []).forEach((p) => ys.push(Number(p.y)));
    let lo = Math.min(...ys), hi = Math.max(...ys); if (hi - lo < 1e-9) { lo -= 5; hi += 5; }
    const pad = (hi - lo) * 0.1; y0 = lo - pad; y1 = hi + pad;
  }
  const sx = (v) => m.l + (v - x0) / (x1 - x0) * (W - m.l - m.r);
  const sy = (v) => H - m.b - (v - y0) / (y1 - y0) * (H - m.t - m.b);
  let out = CC_SVG_HEAD + `<clipPath id="plot"><rect x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${H - m.t - m.b}"/></clipPath>`;
  const xs = ccNiceStep(x1 - x0), ys2 = ccNiceStep(y1 - y0);
  const ax = y0 <= 0 && y1 >= 0 ? sy(0) : sy(y0);
  const ay = x0 <= 0 && x1 >= 0 ? sx(0) : sx(x0);
  if (spec.grid !== false) {
    for (let v = Math.ceil(x0 / xs) * xs; v <= x1 + 1e-9; v += xs) out += `<line x1="${sx(v)}" y1="${m.t}" x2="${sx(v)}" y2="${H - m.b}" stroke="#e5e7eb" stroke-width="1"/>`;
    for (let v = Math.ceil(y0 / ys2) * ys2; v <= y1 + 1e-9; v += ys2) out += `<line x1="${m.l}" y1="${sy(v)}" x2="${W - m.r}" y2="${sy(v)}" stroke="#e5e7eb" stroke-width="1"/>`;
  }
  out += `<line x1="${m.l}" y1="${ax}" x2="${W - m.r + 12}" y2="${ax}" stroke="#111" stroke-width="1.6" marker-end="url(#ar)"/>`;
  out += `<line x1="${ay}" y1="${H - m.b}" x2="${ay}" y2="${m.t - 12}" stroke="#111" stroke-width="1.6" marker-end="url(#ar)"/>`;
  for (let v = Math.ceil(x0 / xs) * xs; v <= x1 + 1e-9; v += xs) {
    if (Math.abs(v) < 1e-9) continue;
    out += `<line x1="${sx(v)}" y1="${ax - 4}" x2="${sx(v)}" y2="${ax + 4}" stroke="#111"/><text x="${sx(v)}" y="${ax + 18}" font-size="13" text-anchor="middle">${ccFmtNum(v)}</text>`;
  }
  for (let v = Math.ceil(y0 / ys2) * ys2; v <= y1 + 1e-9; v += ys2) {
    if (Math.abs(v) < 1e-9) continue;
    out += `<line x1="${ay - 4}" y1="${sy(v)}" x2="${ay + 4}" y2="${sy(v)}" stroke="#111"/><text x="${ay - 8}" y="${sy(v) + 4}" font-size="13" text-anchor="end">${ccFmtNum(v)}</text>`;
  }
  if (x0 <= 0 && x1 >= 0 && y0 <= 0 && y1 >= 0) out += `<text x="${sx(0) - 8}" y="${sy(0) + 16}" font-size="13" text-anchor="end">0</text>`;
  out += `<text x="${W - m.r + 14}" y="${ax - 8}" font-size="16" font-style="italic" text-anchor="end">${ccEsc(ccPlainLabel(spec.xLabel || 'x'))}</text>`;
  out += `<text x="${ay + 10}" y="${m.t - 2}" font-size="16" font-style="italic">${ccEsc(ccPlainLabel(spec.yLabel || 'y'))}</text>`;
  const colors = ['#1d4ed8', '#dc2626', '#047857', '#7c3aed'];
  const usedY = [];
  const freeY = (y) => { let v = y; while (usedY.some((u) => Math.abs(u - v) < 20)) v += 22; usedY.push(v); return v; };
  (spec.polygons || []).forEach((pg) => {
    const pts = (pg.points || []).map((p) => `${sx(+p[0])},${sy(+p[1])}`).join(' ');
    if (pts) out += `<polygon points="${pts}" fill="#93c5fd" fill-opacity="0.25" stroke="#111" stroke-width="2" clip-path="url(#plot)"/>`;
  });
  fns.forEach((f, idx) => {
    const [d0, d1] = Array.isArray(f.domain) && f.domain.length === 2 ? f.domain.map(Number) : [x0, x1];
    const a0 = Math.max(x0, d0), a1 = Math.min(x1, d1);
    let d = '', pen = false, prev = null, last = null;
    const N = 800, span = y1 - y0;
    for (let k = 0; k <= N; k++) {
      const x = a0 + (a1 - a0) * k / N, y = f.fn(x);
      if (!isFinite(y) || y < y0 - span * 3 || y > y1 + span * 3 || (prev !== null && Math.abs(y - prev) > span * 1.5)) { pen = false; prev = isFinite(y) ? y : null; continue; }
      d += (pen ? 'L' : 'M') + sx(x).toFixed(2) + ',' + sy(y).toFixed(2);
      pen = true; prev = y;
      if (y >= y0 && y <= y1) last = [x, y];
    }
    const col = colors[idx % colors.length];
    out += `<path d="${d}" fill="none" stroke="${col}" stroke-width="2.5" clip-path="url(#plot)"/>`;
    if (f.label && last) out += `<text x="${Math.min(sx(last[0]) + 6, W - m.r - 4)}" y="${freeY(Math.max(sy(last[1]) - 8, m.t + 12))}" font-size="15" fill="${col}" stroke="#fff" stroke-width="4" paint-order="stroke" text-anchor="${sx(last[0]) > W - 140 ? 'end' : 'start'}">${ccEsc(ccPlainLabel(f.label))}</text>`;
  });
  (spec.segments || []).forEach((sg) => {
    if (!sg.from || !sg.to) return;
    const [ax1, ay1] = sg.from.map(Number), [ax2, ay2] = sg.to.map(Number);
    out += `<line x1="${sx(ax1)}" y1="${sy(ay1)}" x2="${sx(ax2)}" y2="${sy(ay2)}" stroke="#111" stroke-width="2" ${sg.dashed ? 'stroke-dasharray="6 5"' : ''} clip-path="url(#plot)"/>`;
    if (sg.label) out += `<text x="${(sx(ax1) + sx(ax2)) / 2 + 8}" y="${(sy(ay1) + sy(ay2)) / 2 - 8}" font-size="15">${ccEsc(ccPlainLabel(sg.label))}</text>`;
  });
  (spec.points || []).forEach((p) => {
    const X = sx(+p.x), Y = sy(+p.y);
    out += `<circle cx="${X}" cy="${Y}" r="4.5" fill="${p.open ? '#fff' : '#111'}" stroke="#111" stroke-width="2"/>`;
    if (p.label) out += `<text x="${X + 8}" y="${Y - 10}" font-size="15" font-weight="bold" stroke="#fff" stroke-width="4" paint-order="stroke">${ccEsc(ccPlainLabel(p.label))}</text>`;
  });
  return out + '</svg>';
}

function ccRenderNumberLine(spec) {
  const W = 600, y = 220, l = 45, r = 555;
  let min = Number(spec.min), max = Number(spec.max);
  if (!(max > min)) { min = -5; max = 5; }
  const step = Number(spec.step) > 0 ? Number(spec.step) : ccNiceStep(max - min) || 1;
  const sx = (v) => l + (v - min) / (max - min) * (r - l);
  let out = CC_SVG_HEAD + `<line x1="${l - 25}" y1="${y}" x2="${r + 25}" y2="${y}" stroke="#111" stroke-width="2" marker-start="url(#ar)" marker-end="url(#ar)"/>`;
  for (let v = min, n = 0; v <= max + 1e-9 && n < 60; v += step, n++) {
    out += `<line x1="${sx(v)}" y1="${y - 8}" x2="${sx(v)}" y2="${y + 8}" stroke="#111" stroke-width="2"/><text x="${sx(v)}" y="${y + 30}" font-size="15" text-anchor="middle">${ccFmtNum(v)}</text>`;
  }
  (spec.intervals || []).forEach((iv) => {
    const a = iv.from == null ? null : Number(iv.from), b = iv.to == null ? null : Number(iv.to);
    const X1 = a == null ? l - 22 : sx(a), X2 = b == null ? r + 22 : sx(b);
    out += `<line x1="${X1}" y1="${y - 28}" x2="${X2}" y2="${y - 28}" stroke="#1d4ed8" stroke-width="4" ${a == null ? 'marker-start="url(#arb)"' : ''} ${b == null ? 'marker-end="url(#arb)"' : ''}/>`;
    if (a != null) out += `<line x1="${X1}" y1="${y - 28}" x2="${X1}" y2="${y}" stroke="#1d4ed8" stroke-dasharray="3 3"/><circle cx="${X1}" cy="${y - 28}" r="7" fill="${iv.fromOpen ? '#fff' : '#1d4ed8'}" stroke="#1d4ed8" stroke-width="2.5"/>`;
    if (b != null) out += `<line x1="${X2}" y1="${y - 28}" x2="${X2}" y2="${y}" stroke="#1d4ed8" stroke-dasharray="3 3"/><circle cx="${X2}" cy="${y - 28}" r="7" fill="${iv.toOpen ? '#fff' : '#1d4ed8'}" stroke="#1d4ed8" stroke-width="2.5"/>`;
  });
  (spec.points || []).forEach((p) => {
    const X = sx(Number(p.x));
    out += `<circle cx="${X}" cy="${y}" r="7" fill="${p.open ? '#fff' : '#111'}" stroke="#111" stroke-width="2.5"/>`;
    if (p.label) out += `<text x="${X}" y="${y - 18}" font-size="16" font-weight="bold" text-anchor="middle">${ccEsc(ccPlainLabel(p.label))}</text>`;
  });
  return out + '</svg>';
}

function ccSolveTriangle(sides, angles) {
  const rad = (d) => d * Math.PI / 180, deg = (r) => r * 180 / Math.PI;
  let a = +((sides || {}).a) || 0, b = +((sides || {}).b) || 0, c = +((sides || {}).c) || 0;
  let A = +((angles || {}).A) || 0, B = +((angles || {}).B) || 0, C = +((angles || {}).C) || 0;
  for (let k = 0; k < 5; k++) {
    if ([A, B, C].filter(Boolean).length === 2) { if (!A) A = 180 - B - C; else if (!B) B = 180 - A - C; else C = 180 - A - B; }
    if (a && b && c && !(A && B && C)) {
      A = deg(Math.acos((b * b + c * c - a * a) / (2 * b * c)));
      B = deg(Math.acos((a * a + c * c - b * b) / (2 * a * c)));
      C = 180 - A - B;
    }
    if (!a && b && c && A) a = Math.sqrt(b * b + c * c - 2 * b * c * Math.cos(rad(A)));
    if (!b && a && c && B) b = Math.sqrt(a * a + c * c - 2 * a * c * Math.cos(rad(B)));
    if (!c && a && b && C) c = Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(rad(C)));
    const pair = [[a, A], [b, B], [c, C]].find(([s, t]) => s && t);
    if (pair) {
      const K = pair[0] / Math.sin(rad(pair[1]));
      if (!a && A) a = K * Math.sin(rad(A));
      if (!b && B) b = K * Math.sin(rad(B));
      if (!c && C) c = K * Math.sin(rad(C));
      const asin = (s) => deg(Math.asin(Math.max(-1, Math.min(1, s / K))));
      if ([A, B, C].filter(Boolean).length < 2) {
        if (a && !A) A = asin(a); else if (b && !B) B = asin(b); else if (c && !C) C = asin(c);
      }
    }
  }
  const ok = [a, b, c, A, B, C].every((v) => isFinite(v) && v > 0) && Math.abs(A + B + C - 180) < 1;
  if (!ok) return null;
  return { a, b, c, A, B, C };
}

function ccRenderTriangle(spec) {
  let t = ccSolveTriangle(spec.sides, spec.angles);
  const fallback = !t;
  if (!t) { t = { A: 62, B: 48, C: 70 }; const K = 1; t.a = K * Math.sin(t.A * Math.PI / 180); t.b = K * Math.sin(t.B * Math.PI / 180); t.c = K * Math.sin(t.C * Math.PI / 180); }
  const rad = (d) => d * Math.PI / 180;
  const P = { B: [0, 0], C: [t.a, 0], A: [t.c * Math.cos(rad(t.B)), t.c * Math.sin(rad(t.B))] };
  const xs = [P.A[0], P.B[0], P.C[0]], ys = [P.A[1], P.B[1], P.C[1]];
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const sc = Math.min(470 / (maxX - minX || 1), 300 / (maxY - minY || 1));
  const offX = 300 - sc * (minX + maxX) / 2, offY = 200 + sc * (minY + maxY) / 2;
  const S = {}; for (const k of ['A', 'B', 'C']) S[k] = [offX + sc * P[k][0], offY - sc * P[k][1]];
  const G = [(S.A[0] + S.B[0] + S.C[0]) / 3, (S.A[1] + S.B[1] + S.C[1]) / 3];
  const unit = (v) => { const L = Math.hypot(v[0], v[1]) || 1; return [v[0] / L, v[1] / L]; };
  const labels = spec.labels || {}, sideLabels = spec.sideLabels || {}, angleLabels = spec.angleLabels || {};
  let out = CC_SVG_HEAD + `<polygon points="${['A', 'B', 'C'].map((k) => S[k].join(',')).join(' ')}" fill="none" stroke="#111" stroke-width="2.5" stroke-linejoin="round"/>`;
  const opp = { a: ['B', 'C'], b: ['C', 'A'], c: ['A', 'B'] };
  const angVal = { A: t.A, B: t.B, C: t.C };
  for (const V of ['A', 'B', 'C']) {
    const [Q1, Q2] = ['A', 'B', 'C'].filter((k) => k !== V);
    const u1 = unit([S[Q1][0] - S[V][0], S[Q1][1] - S[V][1]]), u2 = unit([S[Q2][0] - S[V][0], S[Q2][1] - S[V][1]]);
    const isRight = !fallback && Math.abs(angVal[V] - 90) < 0.6;
    if (isRight) {
      const s = 16, p1 = [S[V][0] + u1[0] * s, S[V][1] + u1[1] * s], p2 = [p1[0] + u2[0] * s, p1[1] + u2[1] * s], p3 = [S[V][0] + u2[0] * s, S[V][1] + u2[1] * s];
      out += `<polyline points="${p1.join(',')} ${p2.join(',')} ${p3.join(',')}" fill="none" stroke="#111" stroke-width="1.8"/>`;
    }
    const al = angleLabels[V];
    if (al && !isRight) {
      const r = 30, s1 = [S[V][0] + u1[0] * r, S[V][1] + u1[1] * r], s2 = [S[V][0] + u2[0] * r, S[V][1] + u2[1] * r];
      const sweep = (u1[0] * u2[1] - u1[1] * u2[0]) > 0 ? 1 : 0;
      out += `<path d="M${s1.join(',')} A${r},${r} 0 0 ${sweep} ${s2.join(',')}" fill="none" stroke="#111" stroke-width="1.6"/>`;
      const bis = unit([u1[0] + u2[0], u1[1] + u2[1]]);
      out += `<text x="${S[V][0] + bis[0] * 50}" y="${S[V][1] + bis[1] * 50 + 5}" font-size="16" text-anchor="middle">${ccEsc(ccPlainLabel(al))}</text>`;
    } else if (al && isRight && !/^90/.test(String(al))) {
      const bis = unit([u1[0] + u2[0], u1[1] + u2[1]]);
      out += `<text x="${S[V][0] + bis[0] * 44}" y="${S[V][1] + bis[1] * 44 + 5}" font-size="16" text-anchor="middle">${ccEsc(ccPlainLabel(al))}</text>`;
    }
    const out1 = unit([S[V][0] - G[0], S[V][1] - G[1]]);
    out += `<text x="${S[V][0] + out1[0] * 20}" y="${S[V][1] + out1[1] * 20 + 6}" font-size="18" font-weight="bold" font-style="italic" text-anchor="middle">${ccEsc(ccPlainLabel(labels[V] || V))}</text>`;
  }
  for (const sd of ['a', 'b', 'c']) {
    const lab = sideLabels[sd];
    if (!lab) continue;
    const [p, q] = opp[sd];
    const M = [(S[p][0] + S[q][0]) / 2, (S[p][1] + S[q][1]) / 2];
    const n = unit([M[0] - G[0], M[1] - G[1]]);
    const anc = n[0] > 0.35 ? 'start' : n[0] < -0.35 ? 'end' : 'middle';
    out += `<text x="${M[0] + n[0] * 12}" y="${M[1] + n[1] * 16 + 6}" font-size="16" text-anchor="${anc}">${ccEsc(ccPlainLabel(lab))}</text>`;
  }
  return out + '</svg>';
}

function ccRenderDiagramSpec(spec) {
  if (!spec || typeof spec !== 'object') return '';
  if (spec.kind === 'axes') return ccRenderAxes(spec);
  if (spec.kind === 'numberline') return ccRenderNumberLine(spec);
  if (spec.kind === 'triangle') return ccRenderTriangle(spec);
  return '';
}

async function ccGenerateDiagramImage(q, onStatus) {
  const status = (s) => { try { onStatus && onStatus(s); } catch (e) {} };
  const body = {
    prompt: q.prompt || '',
    description: q.imageDescription || '',
    options: Array.isArray(q.options) ? q.options : [],
    subject: (els.subject && els.subject.value) || '',
  };
  const call = async (url, payload) => {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
    return j;
  };
  status('✨ Drawing…');
  let j = await call('/api/ai/generate-diagram', body);
  if (j.spec) {
    try {
      const svg = ccRenderDiagramSpec(j.spec);
      if (svg) return await ccSvgToPngDataUrl(svg, 900);
    } catch (e) { console.warn('[diagram spec]', e); }
    status('✨ Drawing…');
    j = await call('/api/ai/generate-diagram', Object.assign({}, body, { forceSvg: true }));
  }
  if (!j.svg) throw new Error('No diagram was returned.');
  let png = await ccSvgToPngDataUrl(j.svg, 900);
  status('🔍 Checking accuracy…');
  try {
    const rv = await call('/api/ai/review-diagram', { prompt: body.prompt, options: body.options, svg: j.svg, image: png });
    if (rv && rv.svg) png = await ccSvgToPngDataUrl(rv.svg, 900);
  } catch (e) { /* keep the first drawing */ }
  return png;
}

// ── Skills report block (shared by student + teacher report cards) ─────
function ccSkillsBlockHtml(rep) {
  if (!rep || !Array.isArray(rep.skills) || !rep.skills.length) return '';
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const colour = (p) => (p >= 80 ? '#059669' : p >= 60 ? '#d97706' : '#dc2626');
  const rows = rep.skills.slice().sort((a, b) => b.pct - a.pct).map((s) => `
    <div style="display:flex; align-items:center; gap:10px; margin:6px 0;">
      <div dir="auto" style="flex:0 0 42%; font-size:14px;">${esc(s.skill)}</div>
      <div style="flex:1; background:#e5e7eb; border-radius:6px; height:12px; overflow:hidden;"><div style="width:${s.pct}%; height:100%; background:${colour(s.pct)};"></div></div>
      <div style="flex:0 0 120px; text-align:right; font-size:13px; color:${colour(s.pct)}; font-weight:600;">${s.pct}% · ${esc(s.status)}</div>
    </div>`).join('');
  const list = (arr) => arr.map((x) => `<li dir="auto">${esc(x)}</li>`).join('');
  return `
    <div class="report-card" style="margin-top:14px;">
      <h2 style="margin-top:0;">🎯 Skills report</h2>
      ${rows}
      <div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:12px;">
        ${rep.strengths && rep.strengths.length ? `<div style="flex:1; min-width:220px; background:#ecfdf5; border-radius:8px; padding:10px 12px;"><strong>✅ Strengths</strong><ul style="margin:6px 0 0 18px; padding:0;">${list(rep.strengths)}</ul></div>` : ''}
        ${rep.needsWork && rep.needsWork.length ? `<div style="flex:1; min-width:220px; background:#fef2f2; border-radius:8px; padding:10px 12px;"><strong>📌 Skills to work on</strong><ul style="margin:6px 0 0 18px; padding:0;">${list(rep.needsWork)}</ul><div style="font-size:12px; color:#6b7280; margin-top:6px;">Review the feedback on the questions for these skills below.</div></div>` : ''}
      </div>
    </div>`;
}

function ccReviewExtrasHtml(q) {
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let h = '';
  if (q.skill) h += `<div style="margin-top:6px; font-size:13px; color:#4338ca;">🎯 Skill: <span dir="auto">${esc(q.skill)}</span></div>`;
  if (q.explanation) h += `<div dir="auto" style="margin-top:6px; padding:8px 10px; background:#fffbeb; border-left:3px solid #f59e0b; border-radius:6px; font-size:14px;"><strong>💡 Feedback:</strong> ${esc(q.explanation)}</div>`;
  return h;
}


// ── 🏷 Tag skills & write feedback with AI (builder) ───────────────────
async function ccTagSkillsWithAI(btn) {
  if (!questions.length) { alert('Add some questions first.'); return; }
  const missing = questions.filter((q) => !String(q.skill || '').trim() || !String(q.explanation || '').trim());
  let target = missing;
  if (!missing.length) {
    if (!confirm('Every question already has a skill and feedback. Re-do them all with AI? (Your current text will be replaced.)')) return;
    target = questions.slice();
  }
  const label = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = `🏷 Tagging ${target.length} question${target.length === 1 ? '' : 's'}…`; }
  try {
    const r = await fetch('/api/ai/tag-skills', {
      method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({
        subject: (els.subject && els.subject.value) || '',
        grade: (els.grade && els.grade.value) || '',
        language: (els.assessmentLanguage && els.assessmentLanguage.value) || '',
        questions: (() => { let budget = 11e6; return target.map((q) => {
          let imageUrl = '';
          const u = String(q.imageUrl || '');
          if (u && (!u.startsWith('data:') || u.length < budget)) { imageUrl = u; if (u.startsWith('data:')) budget -= u.length; }
          return { id: q.id, type: q.type, prompt: q.prompt, options: q.options, correctAnswer: q.correctAnswer, pairs: (q.pairs || []).map((p) => ({ left: p.left, right: p.right })), imageUrl, imageDescription: q.imageDescription || '' };
        }); })(),
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
    const byId = new Map((j.items || []).map((x) => [String(x.id), x]));
    let n = 0;
    for (const q of target) {
      const x = byId.get(String(q.id));
      if (!x) continue;
      if (x.skill) q.skill = x.skill;
      if (x.explanation) q.explanation = x.explanation;
      n++;
    }
    renderQuestions();
    alert(`Skills and feedback added to ${n} question${n === 1 ? '' : 's'}. Check them, then click Save assessment.`);
  } catch (e) {
    alert('Could not tag the questions: ' + (e.message || e));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = label; }
  }
}
document.addEventListener('click', (e) => {
  const b = e.target && e.target.closest && e.target.closest('#tag-skills-btn');
  if (b) { e.preventDefault(); ccTagSkillsWithAI(b); }
});

// ── Printed Sets 1–4 (same algorithm as the server's per-student shuffle) ─
function ccSetRng(seedStr) {
  let h = 2166136261 >>> 0;
  const s = String(seedStr);
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return function () {
    h = (h + 0x6D2B79F5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function ccMakeSet(a, setNo) {
  const LETTER_REF = /\b[A-F]\s*(?:and|&|or|,)\s*[A-F]\b|\b(?:options?|choices?)\s+[A-F]\b/;
  const LOCK_OPT = /\b(?:all|none|any)\s+of\s+(?:the\s+)?(?:above|these|them)\b|\bneither\b|\bboth\b|جميع ما سبق|كل ما سبق|لا شيء مما سبق|ليس مما سبق|كلاهما|لا هذا ولا ذاك/i;
  const LOCK_Q = /\b(?:previous|above|preceding|last|next|following)\s+question\b|\bquestions?\s*\d+\b|\bQ\s?\d+\b|السؤال السابق|السؤال الآتي/i;
  const shuffle = (arr, rand) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  const key = `set${setNo}`;
  const qs = (a.questions || []).map((q) => JSON.parse(JSON.stringify(q)));
  const bySec = new Map();
  qs.forEach((q) => { const k = q.sectionId || ''; if (!bySec.has(k)) bySec.set(k, []); bySec.get(k).push(q); });
  const order = (a.sections || []).map((s) => s.id);
  for (const k of bySec.keys()) if (!order.includes(k)) order.push(k);
  const out = [];
  for (const sid of order) {
    const list = bySec.get(sid);
    if (!list) continue;
    const free = list.filter((q) => !LOCK_Q.test(String(q.prompt || '')));
    let mixed = free;
    for (let attempt = 0; attempt < 12; attempt++) {
      mixed = shuffle(free.slice(), ccSetRng(`${a.id}|${key}|sec|${sid}|${attempt}`));
      if (free.length < 3 || mixed.some((q, i) => q !== free[i])) break;   // make sure the set really differs
    }
    let k = 0;
    list.forEach((q) => out.push(LOCK_Q.test(String(q.prompt || '')) ? q : mixed[k++]));
  }
  for (const q of out) {
    if (q.type !== 'mc' || !Array.isArray(q.options) || q.options.length < 2) continue;
    if (q.options.some((o) => LETTER_REF.test(String(o || '')))) continue;
    const ident = q.options.map((_, i) => i);
    const free = ident.filter((i) => !LOCK_OPT.test(String(q.options[i] || '')));
    const mixed = shuffle(free.slice(), ccSetRng(`${a.id}|${key}|opt|${q.id}`));
    let k = 0;
    const perm = ident.map((i) => (free.includes(i) ? mixed[k++] : i));
    const orig = q.options.slice();
    q.options = perm.map((i) => orig[i]);
    q.correctAnswer = perm.indexOf(Number(q.correctAnswer));
  }
  return out;
}

// ── Results page: release toggle, skills, flags ────────────────────────
document.addEventListener('click', async (e) => {
  const rel = e.target && e.target.closest && e.target.closest('[data-cc-release]');
  if (rel) {
    e.preventDefault();
    const id = rel.getAttribute('data-cc-release');
    const release = rel.getAttribute('data-state') !== 'released';
    if (release && !confirm('Release results to students? They will see their score, the correct answers, the feedback for every question and their skills report.\n\nOnly do this when every student has finished.')) return;
    rel.disabled = true;
    try {
      await api(`/api/assessments/${id}/release-results`, { method: 'POST', body: { released: release } });
      if (typeof openResults === 'function') openResults(id);
    } catch (err) { alert('Could not update: ' + err.message); rel.disabled = false; }
  }
  const xl = e.target && e.target.closest && e.target.closest('[data-cc-skills-xlsx]');
  if (xl) {
    e.preventDefault();
    window.location.href = `/api/assessments/${xl.getAttribute('data-cc-skills-xlsx')}/skills-report.xlsx`;
  }
});

function ccAnalyticsSkillsHtml(assessmentId, a) {
  const esc = (s) => escapeHtml(String(s == null ? '' : s));
  const colour = (p) => (p >= 80 ? '#059669' : p >= 60 ? '#d97706' : '#dc2626');
  const released = a.resultsReleased !== false;
  const releaseBar = `
    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; padding:12px 14px; border-radius:10px; margin-bottom:14px; background:${released ? '#ecfdf5' : '#fef3c7'}; border:1px solid ${released ? '#10b981' : '#f59e0b'};">
      <div style="flex:1; min-width:240px;">${released
        ? '✅ <strong>Results are released.</strong> Students can see their answers, feedback and skills report.'
        : '🔒 <strong>Results are hidden from students.</strong> Release them once everyone has finished so answers can\'t be shared.'}</div>
      <button class="btn ${released ? '' : 'primary'}" data-cc-release="${assessmentId}" data-state="${released ? 'released' : 'hidden'}">${released ? '🔒 Hide from students' : '📢 Release results & feedback'}</button>
      <button class="btn" data-cc-skills-xlsx="${assessmentId}">⬇ Skills report (Excel)</button>
    </div>`;
  const skills = Array.isArray(a.classSkills) ? a.classSkills : [];
  const hard = (a.questions || []).map((q, i) => ({ ...q, n: i + 1 })).filter((q) => q.correctRate != null && q.correctRate < 0.5);
  let body = '';
  if (skills.length) {
    body += `<h3 style="margin-top:16px;">🎯 Skills — class average</h3>` + skills.map((s) => `
      <div style="display:flex; align-items:center; gap:10px; margin:6px 0;">
        <div dir="auto" style="flex:0 0 36%;">${esc(s.skill)} <span class="muted" style="font-size:12px;">(${s.questionNums.map((n) => 'Q' + n).join(', ')})</span></div>
        <div style="flex:1; background:#e5e7eb; border-radius:6px; height:12px; overflow:hidden;"><div style="width:${s.classPct}%; height:100%; background:${colour(s.classPct)};"></div></div>
        <div style="flex:0 0 60px; text-align:right; font-weight:600; color:${colour(s.classPct)};">${s.classPct}%</div>
      </div>
      ${s.strugglingCount ? `<div class="muted" style="font-size:12px; margin:-2px 0 6px 0;">Below 60%: ${s.struggling.map((x) => esc(x.name) + ' (' + x.pct + '%)').join(', ')}</div>` : ''}`).join('');
    const weak = skills.filter((s) => s.classPct < 60);
    if (weak.length) body += `<div style="margin-top:10px; padding:10px 12px; background:#fef2f2; border-radius:8px;"><strong>📌 The class is struggling with:</strong> ${weak.map((s) => esc(s.skill) + ' (' + s.classPct + '%)').join(', ')}</div>`;
  } else {
    body += `<div class="muted" style="margin-top:12px;">No skills tagged yet.</div>`;
  }
  const _untagged = (a.questions || []).filter((q) => !q.skill).length;
  if (_untagged) {
    const _tried = _ccAutoTagDone.has(assessmentId);
    body = `<div id="cc-autotag-${assessmentId}" style="margin-top:12px; padding:10px 12px; background:#eef2ff; border-radius:8px;">${_tried
      ? `🏷 ${_untagged} question${_untagged === 1 ? ' is' : 's are'} still untagged. <button class="btn" onclick="ccAutoTagSkills('${assessmentId}', true)">Tag them now</button>`
      : `🏷 Identifying the skill tested by ${_untagged} question${_untagged === 1 ? '' : 's'} and writing feedback… The report will refresh by itself.`}</div>` + body;
    if (!_tried) ccAutoTagSkills(assessmentId);
  }
  if (hard.length) {
    body += `<h3 style="margin-top:16px;">⚠️ Questions most students got wrong</h3>` + hard.map((q) => `
      <div style="padding:8px 10px; border-left:3px solid #dc2626; background:#fff7f7; margin:6px 0; border-radius:6px;">
        <strong>Q${q.n}</strong> — ${Math.round(q.correctRate * 100)}% correct${q.skill ? ` · 🎯 ${esc(q.skill)}` : ''}
        <div dir="auto" style="font-size:13px; margin-top:2px;">${esc(String(q.prompt || '').slice(0, 160))}</div>
        ${q.mostCommonWrong ? `<div class="muted" style="font-size:12px; margin-top:2px;">Most chose: "${esc(q.mostCommonWrong.optionText)}" (${q.mostCommonWrong.count}) — likely misconception to reteach.</div>` : ''}
      </div>`).join('');
  }
  return { releaseBar, body };
}

// ── Admin → 📊 Difficulty review (admins only; labels never shown elsewhere) ─
function ccDiffBar(pct) {
  const seg = (l, c) => pct[l] ? `<div title="${l} ${pct[l]}%" style="width:${pct[l]}%; background:${c}; height:100%;"></div>` : '';
  return `<div style="display:flex; width:180px; height:12px; border-radius:6px; overflow:hidden; background:#e5e7eb;">${seg('easy', '#34d399')}${seg('medium', '#fbbf24')}${seg('hard', '#f87171')}</div>`;
}
function ccDiffOverlay(inner) {
  const ov = document.createElement('div');
  ov.id = 'cc-diff-overlay';
  ov.style.cssText = 'position:fixed; inset:0; background:rgba(11,16,32,0.55); z-index:2147483000; display:flex; align-items:flex-start; justify-content:center; overflow:auto; padding:30px 12px;';
  ov.innerHTML = `<div style="background:#fff; border-radius:12px; width:min(1100px,100%); padding:20px 24px; box-shadow:0 16px 48px rgba(0,0,0,.3);">${inner}</div>`;
  ov.addEventListener('click', (e) => { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
  return ov;
}
async function ccOpenDifficultyReview() {
  const old = document.getElementById('cc-diff-overlay'); if (old) old.remove();
  const ov = ccDiffOverlay('<div class="muted">Loading…</div>');
  const box = ov.firstElementChild;
  let data;
  try { data = await api('/api/admin/difficulty'); } catch (e) { box.innerHTML = `<div class="error">${escapeHtml(e.message)}</div>`; return; }
  const t = data.target;
  const unlabeled = data.assessments.filter((a) => a.labelled < a.questions).length;
  box.innerHTML = `
    <div class="row" style="align-items:center; gap:10px; margin-bottom:6px;">
      <h2 style="margin:0; flex:1;">📊 Difficulty review <span class="muted" style="font-size:13px; font-weight:400;">— visible to admins only</span></h2>
      <button class="btn" id="cc-diff-close">Close</button>
    </div>
    <div class="muted" style="font-size:13px; margin-bottom:12px;">
      Target mix by marks: <strong style="color:#059669;">${t.easy}% easy</strong> · <strong style="color:#b45309;">${t.medium}% medium</strong> · <strong style="color:#dc2626;">${t.hard}% hard</strong>.
      Papers more than 15 points off the target are flagged. New and edited assessments are labelled automatically a few seconds after the teacher saves.
    </div>
    ${unlabeled ? `<div style="padding:10px 12px; background:#eef2ff; border-radius:8px; margin-bottom:12px;">${unlabeled} assessment${unlabeled === 1 ? ' has' : 's have'} unlabelled questions. <button class="btn primary" id="cc-diff-backfill" style="margin-left:8px;">🏷 Label existing assessments with AI</button> <span id="cc-diff-bf-status" class="muted"></span></div>` : ''}
    <table style="width:100%; border-collapse:collapse; font-size:14px;">
      <tr style="text-align:left; border-bottom:2px solid #e5e7eb;"><th style="padding:6px;">Assessment</th><th>Teacher</th><th>Mix</th><th>Easy / Med / Hard</th><th>Labelled</th><th></th></tr>
      ${data.assessments.map((a) => `
        <tr style="border-bottom:1px solid #f1f5f9; ${a.flag ? 'background:#fff7ed;' : ''}">
          <td style="padding:6px;" dir="auto">${escapeHtml(a.title || '(untitled)')}<div class="muted" style="font-size:12px;">${escapeHtml([a.subject, a.grade ? 'Grade ' + a.grade : ''].filter(Boolean).join(' · '))}</div></td>
          <td>${escapeHtml(a.teacher)}</td>
          <td>${a.labelled ? ccDiffBar(a.pct) : '<span class="muted">—</span>'}</td>
          <td>${a.labelled ? `${a.pct.easy}% / ${a.pct.medium}% / ${a.pct.hard}%${a.flag ? ' <span style="color:#c2410c; font-weight:600;">⚠ off target</span>' : ''}` : ''}</td>
          <td>${a.labelled}/${a.questions}</td>
          <td><button class="btn" data-cc-diff-open="${a.id}">Open</button></td>
        </tr>`).join('')}
    </table>`;
  box.querySelector('#cc-diff-close').onclick = () => ov.remove();
  box.querySelectorAll('[data-cc-diff-open]').forEach((b) => { b.onclick = () => ccOpenDifficultyDetail(b.getAttribute('data-cc-diff-open')); });
  const bf = box.querySelector('#cc-diff-backfill');
  if (bf) bf.onclick = async () => {
    const st = box.querySelector('#cc-diff-bf-status');
    bf.disabled = true;
    try {
      for (;;) {
        st.textContent = 'Labelling… (this can take a minute)';
        const r = await api('/api/admin/difficulty/backfill', { method: 'POST', body: {} });
        if (!r.remaining) break;
        st.textContent = `${r.remaining} assessments left…`;
      }
      ccOpenDifficultyReview();
    } catch (e) { st.textContent = 'Stopped: ' + e.message; bf.disabled = false; }
  };
}
async function ccOpenDifficultyDetail(id) {
  const old = document.getElementById('cc-diff-overlay'); if (old) old.remove();
  const ov = ccDiffOverlay('<div class="muted">Loading…</div>');
  const box = ov.firstElementChild;
  let d;
  try { d = await api('/api/admin/difficulty/' + encodeURIComponent(id)); } catch (e) { box.innerHTML = `<div class="error">${escapeHtml(e.message)}</div>`; return; }
  const colour = { easy: '#059669', medium: '#b45309', hard: '#dc2626' };
  box.innerHTML = `
    <div class="row" style="align-items:center; gap:10px; margin-bottom:8px;">
      <button class="btn" id="cc-diff-back">← All assessments</button>
      <h2 style="margin:0; flex:1;" dir="auto">${escapeHtml(d.title || '')}</h2>
      <button class="btn" data-cc-spec="${id}" title="Download the specification table (Excel)">📋 Spec table</button>
      <button class="btn" id="cc-diff-redo" title="Re-label every question (your manual changes are kept)">🔄 Re-label with AI</button>
    </div>
    <div class="row" style="gap:14px; align-items:center; margin-bottom:12px;">
      ${ccDiffBar(d.mix.pct)}
      <div>Easy <strong>${d.mix.pct.easy}%</strong> (${d.mix.counts.easy}) · Medium <strong>${d.mix.pct.medium}%</strong> (${d.mix.counts.medium}) · Hard <strong>${d.mix.pct.hard}%</strong> (${d.mix.counts.hard}) — target ${d.target.easy}/${d.target.medium}/${d.target.hard}
      ${d.mix.flag ? ' <span style="color:#c2410c; font-weight:600;">⚠ off target</span>' : ''}</div>
    </div>
    ${d.mix.labelled < d.mix.questions ? `<div class="muted" style="margin-bottom:10px;">${d.mix.questions - d.mix.labelled} question(s) not labelled yet. <button class="btn" id="cc-diff-fill">🏷 Label them now</button></div>` : ''}
    <table style="width:100%; border-collapse:collapse; font-size:14px;">
      <tr style="text-align:left; border-bottom:2px solid #e5e7eb;"><th style="padding:6px;">Q</th><th>Question</th><th>Difficulty</th><th>Why</th><th>Students correct</th></tr>
      ${d.questions.map((q) => `
        <tr style="border-bottom:1px solid #f1f5f9; vertical-align:top;">
          <td style="padding:6px;"><strong>${q.n}</strong><div class="muted" style="font-size:11px;">${q.points} pt</div></td>
          <td dir="auto" style="max-width:380px;">${escapeHtml(q.prompt)}${q.skill ? `<div class="muted" style="font-size:12px;">🎯 ${escapeHtml(q.skill)}</div>` : ''}</td>
          <td>
            <select data-cc-diff-q="${q.id}" style="color:${colour[q.level] || '#6b7280'}; font-weight:600;">
              <option value="" ${q.level ? '' : 'selected'} disabled>—</option>
              ${['easy', 'medium', 'hard'].map((l) => `<option value="${l}" ${q.level === l ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
            ${q.source === 'admin' ? '<div class="muted" style="font-size:11px;">set by admin</div>' : ''}
          </td>
          <td class="muted" style="font-size:13px; max-width:260px;" dir="auto">${escapeHtml(q.reason || '')}</td>
          <td>${q.pctCorrect == null ? '<span class="muted">—</span>' : `${q.pctCorrect}% <span class="muted" style="font-size:11px;">(${q.answered})</span>`}
            ${q.check ? `<div style="font-size:12px; color:#c2410c; margin-top:2px;">⚠ ${escapeHtml(q.check)}</div>` : ''}</td>
        </tr>`).join('')}
    </table>`;
  box.querySelector('#cc-diff-back').onclick = () => ccOpenDifficultyReview();
  box.querySelectorAll('[data-cc-diff-q]').forEach((sel) => {
    sel.onchange = async () => {
      try { await api(`/api/admin/difficulty/${encodeURIComponent(id)}/${encodeURIComponent(sel.getAttribute('data-cc-diff-q'))}`, { method: 'PUT', body: { level: sel.value } }); ccOpenDifficultyDetail(id); }
      catch (e) { alert('Could not save: ' + e.message); }
    };
  });
  const run = async (btn, redo) => {
    btn.disabled = true; btn.textContent = 'Labelling…';
    try { await api(`/api/admin/difficulty/${encodeURIComponent(id)}/classify`, { method: 'POST', body: { redo } }); ccOpenDifficultyDetail(id); }
    catch (e) { alert('Failed: ' + e.message); btn.disabled = false; }
  };
  const redo = box.querySelector('#cc-diff-redo'); if (redo) redo.onclick = () => { if (confirm('Re-label every question with AI? Labels you set yourself are kept.')) run(redo, true); };
  const fill = box.querySelector('#cc-diff-fill'); if (fill) fill.onclick = () => run(fill, false);
}
document.addEventListener('click', (e) => {
  const b = e.target && e.target.closest && e.target.closest('#admin-difficulty');
  if (b) {
    e.preventDefault();
    const dd = document.getElementById('admin-menu-dropdown'); if (dd) dd.style.display = 'none';
    ccOpenDifficultyReview();
  }
});

const _ccAutoTagDone = new Set();
async function ccAutoTagSkills(assessmentId, force) {
  if (_ccAutoTagDone.has(assessmentId) && !force) return;
  _ccAutoTagDone.add(assessmentId);
  const box = () => document.getElementById('cc-autotag-' + assessmentId);
  const show = (html) => { const b = box(); if (b) b.innerHTML = html; };
  const retryBtn = `<button class="btn" style="margin-left:8px;" onclick="ccAutoTagSkills('${assessmentId}', true)">Try again</button>`;
  try {
    let st = await api(`/api/assessments/${assessmentId}/tag-skills`, { method: 'POST', body: {} });
    for (let i = 0; i < 150 && st.state === 'running'; i++) {
      show(`🏷 Identifying the skill tested by each question and writing feedback… ${st.total ? `${st.done} of ${st.total} done` : 'starting'}. The report will refresh by itself.`);
      await new Promise((r) => setTimeout(r, 4000));
      st = await api(`/api/assessments/${assessmentId}/tag-skills`);
    }
    if (st.state === 'error') { show('⚠️ Could not tag skills: ' + escapeHtml(st.error || 'unknown error') + retryBtn); return; }
    if (currentResultsAssessmentId === assessmentId && els.resultsView && els.resultsView.style.display !== 'none') openResults(assessmentId);
  } catch (e) {
    show('⚠️ Could not tag skills: ' + escapeHtml(e.message) + retryBtn);
  }
}

// ── 🔀 Make shuffling visible to the teacher ─────────────────────────────
function ccShuffleSampleOverlay(a, heading) {
  const old = document.getElementById('cc-shuffle-sample'); if (old) old.remove();
  const origNo = new Map((a.questions || []).map((q, i) => [q.id, i + 1]));
  const LET = 'ABCDEFGH';
  const esc = (s) => escapeHtml(String(s == null ? '' : s));
  const ov = document.createElement('div');
  ov.id = 'cc-shuffle-sample';
  ov.style.cssText = 'position:fixed; inset:0; background:rgba(11,16,32,0.55); z-index:2147483000; display:flex; align-items:flex-start; justify-content:center; overflow:auto; padding:30px 12px;';
  const draw = () => {
    const seed = 'sample-' + Math.random().toString(36).slice(2, 8);
    const qs = ccMakeSet(a, seed);
    const secTitle = new Map((a.sections || []).map((s) => [s.id, s.title]));
    let lastSec = null;
    const body = qs.map((q, i) => {
      let head = '';
      if ((q.sectionId || '') !== lastSec) { lastSec = q.sectionId || ''; const st = secTitle.get(lastSec); if (st) head = `<h3 style="margin:16px 0 6px;" dir="auto">${esc(st)}</h3>`; }
      const orig = (a.questions || []).find((o) => o.id === q.id) || {};
      const opts = (q.type === 'mc' && Array.isArray(q.options)) ? `<ol style="list-style:none; padding-left:4px; margin:6px 0 0;">${q.options.map((o, k) => {
        const was = (orig.options || []).indexOf(o);
        return `<li dir="auto" style="margin:2px 0; ${k === Number(q.correctAnswer) ? 'color:#047857; font-weight:600;' : ''}">${LET[k]}. ${esc(o)}${was >= 0 && was !== k ? ` <span class="muted" style="font-size:11px; font-weight:400;">(was ${LET[was]})</span>` : ''}</li>`;
      }).join('')}</ol>` : '';
      const n0 = origNo.get(q.id);
      return `${head}<div style="padding:8px 0; border-bottom:1px solid #f1f5f9;">
        <strong>Q${i + 1}.</strong> ${n0 !== i + 1 ? `<span class="muted" style="font-size:11px;">(Q${n0} in your original)</span>` : ''}
        <div dir="auto" style="margin-top:2px;">${esc(q.prompt)}</div>
        ${q.imageUrl ? `<img src="${esc(q.imageUrl)}" style="max-width:260px; max-height:160px; margin-top:4px;">` : ''}${opts}</div>`;
    }).join('');
    ov.innerHTML = `<div style="background:#fff; border-radius:12px; width:min(820px,100%); padding:20px 24px; box-shadow:0 16px 48px rgba(0,0,0,.3);">
      <div class="row" style="align-items:center; gap:10px;">
        <h2 style="margin:0; flex:1;">🔀 ${esc(heading || 'Example student version')}</h2>
        <button class="btn" id="cc-ss-again">🔄 Show another student</button>
        <button class="btn" id="cc-ss-close">Close</button>
      </div>
      <div style="margin:10px 0 6px; padding:10px 12px; background:#ede9fe; color:#4c1d95; border-radius:8px; font-size:13px;">
        This is what <strong>one</strong> student might see. Every student gets their own order of questions (within each section) and of answer options, so neighbours can't copy numbers or letters.
        Marking is automatic, and in Results every question keeps its original number. Correct answers are shown in green here only.
      </div>
      ${body || '<div class="muted">No questions yet.</div>'}</div>`;
    ov.querySelector('#cc-ss-close').onclick = () => ov.remove();
    ov.querySelector('#cc-ss-again').onclick = draw;
    try { if (window.MathJax && window.MathJax.typesetPromise) window.MathJax.typesetPromise([ov]).catch(() => {}); } catch (e) {}
  };
  ov.addEventListener('click', (e) => { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
  draw();
}
function ccShuffleStatusUpdate() {
  const cb = document.getElementById('shuffle-toggle');
  const box = document.getElementById('cc-shuffle-status');
  if (!cb || !box) return;
  box.innerHTML = cb.checked
    ? `<span style="display:inline-block; padding:4px 10px; border-radius:999px; background:#ede9fe; color:#5b21b6; font-weight:600;">🔀 On — every student gets a different version</span>
       <button type="button" class="btn" id="cc-shuffle-example" style="margin-left:8px;">👁 See an example student version</button>`
    : `<span style="display:inline-block; padding:4px 10px; border-radius:999px; background:#f1f5f9; color:#475569; font-weight:600;">Off — every student sees the same order</span>`;
}
document.addEventListener('change', (e) => { if (e.target && e.target.id === 'shuffle-toggle') ccShuffleStatusUpdate(); });
document.addEventListener('click', async (e) => {
  const ex = e.target && e.target.closest && e.target.closest('#cc-shuffle-example');
  if (ex) {
    e.preventDefault();
    ccShuffleSampleOverlay({ id: editingId || 'draft', questions, sections }, 'Example student version (unsaved changes included)');
    return;
  }
  const card = e.target && e.target.closest && e.target.closest('[data-cc-shuffle-sample]');
  if (card) {
    e.preventDefault();
    try {
      const d = await api(`/api/assessments/${card.getAttribute('data-cc-shuffle-sample')}/export`);
      const a = d.assessment || d;
      ccShuffleSampleOverlay(a, 'Example student version — ' + (a.title || ''));
    } catch (err) { alert('Could not load: ' + err.message); }
  }
});

// ── Admin: view a teacher's dashboard (view only) ─────────────────────────
async function ccOpenViewAsPicker(tab) {
  const old = document.getElementById('cc-viewas'); if (old) old.remove();
  const ov = document.createElement('div');
  ov.id = 'cc-viewas';
  ov.style.cssText = 'position:fixed; inset:0; background:rgba(11,16,32,0.55); z-index:2147483000; display:flex; align-items:flex-start; justify-content:center; overflow:auto; padding:30px 12px;';
  ov.innerHTML = '<div style="background:#fff; border-radius:12px; width:min(820px,100%); padding:20px 24px; box-shadow:0 16px 48px rgba(0,0,0,.3);"><div class="muted">Loading…</div></div>';
  ov.addEventListener('click', (e) => { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
  const box = ov.firstElementChild;
  const esc = (x) => escapeHtml(String(x == null ? '' : x));
  const head = `<div class="row" style="align-items:center; gap:8px; margin-bottom:10px;">
      <h2 style="margin:0; flex:1;">👁 Teachers' dashboards</h2>
      <button class="btn ${tab === 'log' ? '' : 'primary'}" id="cc-va-t1">Teachers</button>
      <button class="btn ${tab === 'log' ? 'primary' : ''}" id="cc-va-t2">📜 Visit log</button>
      <button class="btn" id="cc-va-close">Close</button></div>`;
  const wire = () => {
    box.querySelector('#cc-va-close').onclick = () => ov.remove();
    box.querySelector('#cc-va-t1').onclick = () => ccOpenViewAsPicker('teachers');
    box.querySelector('#cc-va-t2').onclick = () => ccOpenViewAsPicker('log');
  };
  try {
    if (tab === 'log') {
      const { log } = await api('/api/admin/view-log');
      box.innerHTML = head + `<div class="muted" style="font-size:13px; margin-bottom:8px;">Only admins can see this log. Teachers are not notified.</div>
        <table style="width:100%; border-collapse:collapse; font-size:14px;">
        <tr style="text-align:left; border-bottom:2px solid #e5e7eb;"><th style="padding:6px;">When</th><th>Admin</th><th>Teacher</th><th></th></tr>
        ${log.length ? log.map((r) => `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:6px;">${esc(new Date(r.at).toLocaleString())}</td><td>${esc(r.adminName || r.adminEmail)}</td><td>${esc(r.teacherName)} <span class="muted" style="font-size:12px;">${esc(r.teacherEmail)}</span></td><td>${r.action === 'start' ? 'Opened' : `Closed${r.minutes != null ? ` (${r.minutes} min)` : ''}`}</td></tr>`).join('') : '<tr><td colspan="4" class="muted" style="padding:8px;">No visits yet.</td></tr>'}
        </table>`;
      wire(); return;
    }
    const { users } = await api('/api/admin/users?role=teacher');
    box.innerHTML = head + `<div style="padding:10px 12px; background:#eff6ff; border-radius:8px; font-size:13px; margin-bottom:10px;">
        You'll see the teacher's dashboard exactly as they do: assessments, results, students and reports. It is <strong>view only</strong>, so nothing can be edited, deleted, published or marked.
        Each visit is recorded in the Visit log. Click <strong>Return to my account</strong> at the top when you're done.</div>
      <input id="cc-va-q" placeholder="Search by name or email…" style="width:100%; margin-bottom:8px;">
      <div id="cc-va-list"></div>`;
    wire();
    const list = box.querySelector('#cc-va-list');
    const draw = () => {
      const q = box.querySelector('#cc-va-q').value.trim().toLowerCase();
      const rows = users.filter((u) => !q || (u.name + ' ' + u.email).toLowerCase().includes(q));
      list.innerHTML = rows.map((u) => `<div style="display:flex; align-items:center; gap:10px; padding:8px 4px; border-bottom:1px solid #f1f5f9;">
          <div style="flex:1;" dir="auto"><strong>${esc(u.name)}</strong> <span class="muted" style="font-size:12px;">${esc(u.email)}</span>${u.blocked ? ' <span class="badge">blocked</span>' : ''}</div>
          <button class="btn" data-cc-va="${esc(u.id)}">👁 View dashboard</button></div>`).join('') || '<div class="muted">No teachers found.</div>';
      list.querySelectorAll('[data-cc-va]').forEach((b) => {
        b.onclick = async () => {
          b.disabled = true; b.textContent = 'Opening…';
          try { await api('/api/admin/view-as/' + encodeURIComponent(b.getAttribute('data-cc-va')), { method: 'POST', body: {} }); window.location.reload(); }
          catch (e) { alert(e.message); b.disabled = false; b.textContent = '👁 View dashboard'; }
        };
      });
    };
    box.querySelector('#cc-va-q').oninput = draw;
    draw();
  } catch (e) { box.innerHTML = head + `<div class="error">${esc(e.message)}</div>`; wire(); }
}
document.addEventListener('click', (e) => {
  const b = e.target && e.target.closest && e.target.closest('#admin-view-as');
  if (b) {
    e.preventDefault();
    const dd = document.getElementById('admin-menu-dropdown'); if (dd) dd.style.display = 'none';
    ccOpenViewAsPicker('teachers');
  }
});
(async function ccViewAsBanner() {
  try {
    const r = await fetch('/api/admin/view-as/status', { credentials: 'include' });
    const s = await r.json();
    if (!s || !s.viewing) return;
    const bar = document.createElement('div');
    bar.id = 'cc-viewas-banner';
    bar.style.cssText = 'position:fixed; top:var(--cc-credit-h,0px); left:0; right:0; z-index:2147483500; background:#7c2d12; color:#fff; padding:8px 14px; display:flex; align-items:center; gap:12px; font-size:14px; box-shadow:0 2px 8px rgba(0,0,0,.25);';
    bar.innerHTML = `<span style="flex:1;">👁 You are viewing <strong>${escapeHtml(s.teacherName || '')}</strong>'s dashboard <span style="opacity:.8;">(${escapeHtml(s.teacherEmail || '')})</span> — <strong>view only</strong>. Nothing can be changed.</span>
      <button id="cc-viewas-exit" class="btn" style="background:#fff; color:#7c2d12; font-weight:600;">↩ Return to my account</button>`;
    document.body.appendChild(bar);
    document.body.style.paddingTop = (bar.offsetHeight + 4 + (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cc-credit-h')) || 0)) + 'px';
    bar.querySelector('#cc-viewas-exit').onclick = async () => {
      try { await fetch('/api/admin/view-as/exit', { method: 'POST', credentials: 'include' }); } catch (e) {}
      window.location.reload();
    };
  } catch (e) {}
})();

// ── Admin: skill tags across every teacher's assessments ──────────────────
async function ccOpenSkillsSweep(start) {
  let ov = document.getElementById('cc-sweep');
  if (!ov) {
    ov = document.createElement('div'); ov.id = 'cc-sweep';
    ov.style.cssText = 'position:fixed; inset:0; background:rgba(11,16,32,0.55); z-index:2147483000; display:flex; align-items:flex-start; justify-content:center; overflow:auto; padding:30px 12px;';
    ov.innerHTML = '<div style="background:#fff; border-radius:12px; width:min(900px,100%); padding:20px 24px; box-shadow:0 16px 48px rgba(0,0,0,.3);"><div class="muted">Loading…</div></div>';
    ov.addEventListener('click', (e) => { if (e.target === ov) { clearInterval(ov._t); ov.remove(); } });
    document.body.appendChild(ov);
  }
  const box = ov.firstElementChild;
  const esc = (x) => escapeHtml(String(x == null ? '' : x));
  let d;
  try { d = start ? await api('/api/admin/skills-sweep', { method: 'POST', body: {} }) : await api('/api/admin/skills-sweep'); }
  catch (e) { box.innerHTML = `<div class="error">${esc(e.message)}</div>`; return; }
  const running = d.state === 'running';
  const pendQ = d.pending.reduce((n, p) => n + p.untagged, 0);
  box.innerHTML = `
    <div class="row" style="align-items:center; gap:10px; margin-bottom:8px;">
      <h2 style="margin:0; flex:1;">🏷 Skill tags — all teachers</h2>
      <button class="btn primary" id="cc-sw-go" ${running || !d.pending.length ? 'disabled' : ''}>${running ? 'Tagging…' : '▶ Tag everything now'}</button>
      <button class="btn" id="cc-sw-close">Close</button>
    </div>
    <div style="padding:10px 12px; border-radius:8px; margin-bottom:10px; background:${d.pending.length ? '#fef3c7' : '#ecfdf5'};">
      ${d.pending.length
        ? `<strong>${d.pending.length}</strong> of ${d.assessments} assessments still have <strong>${pendQ}</strong> question${pendQ === 1 ? '' : 's'} without a skill or feedback.`
        : `✅ Every question in all ${d.assessments} assessments (${d.questions} questions) has a skill and feedback.`}
      <div class="muted" style="font-size:12px; margin-top:4px;">This check also runs automatically a few minutes after each update and every 6 hours.</div>
    </div>
    ${running ? `<div style="margin-bottom:10px;">
      <div style="background:#e5e7eb; border-radius:6px; height:10px; overflow:hidden;"><div style="width:${d.total ? Math.round(d.done / d.total * 100) : 0}%; height:100%; background:#6366f1;"></div></div>
      <div class="muted" style="font-size:13px; margin-top:4px;">${d.done}/${d.total} assessments · ${d.tagged} questions tagged so far${d.current ? ` · now: ${esc(d.current.title)} (${esc(d.current.teacher)})` : ''}</div></div>` : ''}
    ${!running && d.finishedAt ? `<div class="muted" style="font-size:13px; margin-bottom:8px;">Last run ${esc(new Date(d.finishedAt).toLocaleString())}: ${d.tagged} questions tagged.</div>` : ''}
    ${d.error ? `<div class="error" style="margin-bottom:8px;">Stopped: ${esc(d.error)}</div>` : ''}
    ${d.failed && d.failed.length ? `<h3>Problems</h3>${d.failed.map((f) => `<div style="font-size:13px; padding:4px 0; border-bottom:1px solid #f1f5f9;"><strong dir="auto">${esc(f.title)}</strong> — ${esc(f.teacher)}<div class="muted">${esc(f.error)}</div></div>`).join('')}` : ''}
    ${d.pending.length ? `<h3 style="margin-top:12px;">Still to tag</h3>
      <table style="width:100%; border-collapse:collapse; font-size:14px;">
      <tr style="text-align:left; border-bottom:2px solid #e5e7eb;"><th style="padding:6px;">Assessment</th><th>Teacher</th><th>Missing</th></tr>
      ${d.pending.map((p) => `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:6px;" dir="auto">${esc(p.title)}</td><td>${esc(p.teacher)}</td><td>${p.untagged}/${p.questions}</td></tr>`).join('')}</table>` : ''}`;
  box.querySelector('#cc-sw-close').onclick = () => { clearInterval(ov._t); ov.remove(); };
  const go = box.querySelector('#cc-sw-go'); if (go) go.onclick = () => ccOpenSkillsSweep(true);
  clearInterval(ov._t);
  if (running || start) ov._t = setInterval(() => { if (document.getElementById('cc-sweep')) ccOpenSkillsSweep(false); }, 5000);
}
document.addEventListener('click', (e) => {
  const b = e.target && e.target.closest && e.target.closest('#admin-skills-sweep');
  if (b) {
    e.preventDefault();
    const dd = document.getElementById('admin-menu-dropdown'); if (dd) dd.style.display = 'none';
    ccOpenSkillsSweep(false);
  }
});

// ── Session safety net ──────────────────────────────────────────────────
// 1) While the dashboard is open, ping the server every 5 minutes so the
//    sign-in doesn't time out in the middle of work.
// 2) If it has expired anyway (e.g. the tab was left open overnight), any
//    request that gets "Not authenticated" opens a small sign-in box. After
//    signing in, the SAME request is sent again automatically, so nothing
//    the teacher typed or generated is lost.
(function ccSessionGuard() {
  if (window.__ccSessionGuard) return; window.__ccSessionGuard = true;
  const origFetch = window.fetch.bind(window);
  let pending = null;
  const myEmail = () => { const m = String((document.getElementById('who') || {}).textContent || '').match(/\(([^)]+@[^)]+)\)/); return m ? m[1] : ''; };
  function relogin() {
    if (pending) return pending;
    pending = new Promise((resolve) => {
      const ov = document.createElement('div');
      ov.style.cssText = 'position:fixed; inset:0; background:rgba(11,16,32,0.6); z-index:2147483646; display:flex; align-items:center; justify-content:center;';
      ov.innerHTML = `<form style="background:#fff; border-radius:12px; padding:22px 26px; width:min(380px,92vw); box-shadow:0 16px 48px rgba(0,0,0,.35); font-family:inherit;">
        <h3 style="margin:0 0 6px;">🔒 Please sign in again</h3>
        <div class="muted" style="font-size:13px; margin-bottom:12px;">Your session timed out. Sign in and your work will continue from where you left off — nothing is lost.</div>
        <input name="email" type="email" placeholder="Email" required style="width:100%; margin-bottom:8px;" value="${myEmail().replace(/"/g, '')}">
        <input name="password" type="password" placeholder="Password" required style="width:100%; margin-bottom:8px;" autocomplete="current-password">
        <input name="otp" placeholder="2FA code (admins only)" style="width:100%; margin-bottom:8px; display:none;" inputmode="numeric">
        <div class="cc-rl-err" style="color:#b91c1c; font-size:13px; min-height:18px;"></div>
        <button class="btn primary" type="submit" style="width:100%;">Sign in and continue</button>
      </form>`;
      document.body.appendChild(ov);
      const f = ov.querySelector('form');
      setTimeout(() => { (f.email.value ? f.password : f.email).focus(); }, 50);
      f.onsubmit = async (e) => {
        e.preventDefault();
        const err = f.querySelector('.cc-rl-err'); err.textContent = '';
        const btn = f.querySelector('button'); btn.disabled = true; btn.textContent = 'Signing in…';
        try {
          const r = await origFetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'include',
            body: JSON.stringify({ email: f.email.value.trim(), password: f.password.value, otp: f.otp.value.trim() || undefined }) });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) {
            if (j.need2fa) f.otp.style.display = 'block';
            throw new Error(j.error || 'Sign-in failed');
          }
          const was = myEmail();
          ov.remove(); pending = null;
          if (was && j.user && String(j.user.email).toLowerCase() !== was.toLowerCase()) { location.reload(); return; }
          resolve(true);
        } catch (ex) { err.textContent = ex.message; btn.disabled = false; btn.textContent = 'Sign in and continue'; }
      };
    });
    return pending;
  }
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    let res;
    try { res = await origFetch(input, init); }
    catch (e) {
      // Network blip: try once more for app requests, then explain in plain words.
      if (!/\/api\//.test(url)) throw e;
      await new Promise((r) => setTimeout(r, 2000));
      try { res = await origFetch(input, init); }
      catch (e2) { throw new Error('Could not reach ClassCurio — please check the internet connection and try again.'); }
    }
    if (res.status !== 401 || !/\/api\//.test(url) || /\/api\/(login|register|logout)/.test(url)) return res;
    let body = {};
    try { body = await res.clone().json(); } catch {}
    if (!/not authenticated/i.test(body.error || '')) return res;
    await relogin();
    return origFetch(input, init);   // retry the same request once signed in
  };
  // keep-alive
  setInterval(() => { if (document.visibilityState === 'visible') origFetch('/api/me', { credentials: 'include' }).catch(() => {}); }, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    origFetch('/api/me', { credentials: 'include' }).then((r) => r.json()).then((j) => { if (j && !j.user) relogin(); }).catch(() => {});
  });
})();

// ── Admin: 📋 Specification table (جدول المواصفات) download ────────────────
(async function ccMarkAdmin() {
  try {
    const [a, v] = await Promise.all([
      fetch('/api/admin/is-admin', { credentials: 'include' }).then((r) => r.json()).catch(() => ({})),
      fetch('/api/admin/view-as/status', { credentials: 'include' }).then((r) => r.json()).catch(() => ({})),
    ]);
    if ((a && a.isAdmin) || (v && v.viewing)) document.body.classList.add('cc-admin');
  } catch (e) {}
})();
async function ccOpenSpecDialog(id) {
  const old = document.getElementById('cc-spec-dlg'); if (old) old.remove();
  const ov = document.createElement('div'); ov.id = 'cc-spec-dlg';
  ov.style.cssText = 'position:fixed; inset:0; background:rgba(11,16,32,0.55); z-index:2147483100; display:flex; align-items:flex-start; justify-content:center; overflow:auto; padding:30px 12px;';
  ov.innerHTML = '<div style="background:#fff; border-radius:12px; width:min(760px,100%); padding:20px 24px; box-shadow:0 16px 48px rgba(0,0,0,.3);"><div class="muted">Loading…</div></div>';
  ov.addEventListener('click', (e) => { if (e.target === ov) { clearInterval(ov._t); ov.remove(); } });
  document.body.appendChild(ov);
  const box = ov.firstElementChild;
  const esc = (x) => escapeHtml(String(x == null ? '' : x));
  let d;
  try { d = await api('/api/admin/spec/' + encodeURIComponent(id)); } catch (e) { box.innerHTML = `<div class="error">${esc(e.message)}</div>`; return; }
  const st = d.settings || {};
  const lvlName = { E: 'Easy', M: 'Medium', D: 'Difficult' };
  const autoLbl = d.week ? `Auto — Term ${d.week.term}, Week ${d.week.week}: ${lvlName[d.week.level] || '—'}` : 'Auto (no scheduled date in the 2026–27 calendar)';
  box.innerHTML = `
    <div class="row" style="align-items:center; gap:10px; margin-bottom:6px;">
      <h2 style="margin:0; flex:1;">📋 Specification table <span class="muted" style="font-size:13px; font-weight:400;">— admins only</span></h2>
      <button class="btn" id="cc-spec-close">Close</button>
    </div>
    <div class="muted" style="margin-bottom:12px;" dir="auto"><strong>${esc(d.title)}</strong> · ${esc(d.teacher || '')} · Grade ${esc(d.grade || '—')} · ${esc(d.subject || '—')} · ${d.items} questions</div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px 16px;">
      <label>Format<select id="cc-sp-format" style="width:100%;">
        <option value="B">Full blueprint (Summary, Specification, Outcome coverage, Checks + MOE format)</option>
        <option value="A">MOE format only (same as the ministry sheet)</option></select></label>
      <label>Language<select id="cc-sp-lang" style="width:100%;"><option value="en">English</option><option value="ar">العربية</option></select></label>
      <label style="grid-column:1/3;">School name (header)<input id="cc-sp-school" style="width:100%;" value="${esc(st.school || '')}" placeholder="e.g. Al-Noaimeyah Girls' School – Cycle 1, Cycle 2 & 3"></label>
      ${d.needsStream ? `<label>Stream<select id="cc-sp-stream" style="width:100%;">
        <option value="">All streams</option><option value="A" ${st.stream === 'A' ? 'selected' : ''}>Advanced</option><option value="G" ${st.stream === 'G' ? 'selected' : ''}>General</option></select></label>` : '<span></span>'}
      <label>Term<select id="cc-sp-term" style="width:100%;"><option value="">Auto (${esc(d.term || '—')})</option>
        ${['1', '2', '3'].map((x) => `<option value="${x}" ${st.term === x ? 'selected' : ''}>Term ${x}</option>`).join('')}</select></label>
      <label>Required difficulty level<select id="cc-sp-level" style="width:100%;">
        <option value="auto">${esc(autoLbl)}</option>
        ${['E', 'M', 'D'].map((x) => `<option value="${x}" ${st.level === x ? 'selected' : ''}>${lvlName[x]}</option>`).join('')}
        <option value="none" ${st.level === 'none' ? 'selected' : ''}>No target (end-of-term / central exam)</option></select></label>
      <label>Paper covers<select id="cc-sp-scope" style="width:100%;">
        <option value="term">Everything taught this term so far</option><option value="week" ${st.scope === 'week' ? 'selected' : ''}>This week’s lessons (weekly assessment)</option></select></label>
    </div>
    <div style="margin-top:12px; padding:10px 12px; background:${d.curriculum ? '#ecfdf5' : '#fef3c7'}; border-radius:8px; font-size:13px;">
      ${d.curriculum ? `📚 Curriculum linked: <strong>${esc(d.curriculum.key)}</strong> — ${d.curriculum.outcomes} outcomes · ${esc(d.curriculum.source)}`
        : `📚 No MOE curriculum is stored for this grade/subject${d.needsStream ? ' (check the stream)' : ''} — the AI will write the learning outcomes itself.`}
    </div>
    <details style="margin-top:10px;" ${Object.keys(st.targets || {}).length ? 'open' : ''}><summary style="cursor:pointer;"><strong>Target weight per skill</strong> <span class="muted">(optional — from the MOE table; leave blank to skip that check)</span></summary>
      <table style="width:100%; margin-top:6px; font-size:14px;">${(d.skills || []).map((s, i) => `<tr><td dir="auto">${esc(s.skill)} <span class="muted">(${s.marks} marks now)</span></td>
        <td style="width:120px;"><input type="number" min="0" max="100" step="1" data-cc-sp-target="${i}" value="${st.targets && st.targets[s.skill] != null ? st.targets[s.skill] : ''}" style="width:80px;"> %</td></tr>`).join('')}</table>
    </details>
    <label style="display:flex; gap:8px; align-items:center; margin-top:10px; text-transform:none; letter-spacing:0;"><input type="checkbox" id="cc-sp-force" style="width:auto;"> Re-tag every question with AI (Bloom’s level, outcome, difficulty)</label>
    <div id="cc-sp-status" style="margin-top:12px;"></div>
    <div class="row" style="margin-top:14px; gap:10px;"><div class="spacer"></div>
      <button class="btn primary" id="cc-sp-go">⬇ Prepare & download</button></div>`;
  box.querySelector('#cc-spec-close').onclick = () => { clearInterval(ov._t); ov.remove(); };
  const stBox = box.querySelector('#cc-sp-status');
  const showWarnings = (s) => {
    const w = s.warnings || [];
    return w.length ? `<div style="padding:10px 12px; background:#fff7ed; border:1px solid #fdba74; border-radius:8px;"><strong>⚠ Checks found ${w.length} thing${w.length === 1 ? '' : 's'} to look at</strong> (also listed in the file):<ul style="margin:6px 0 0 18px;">${w.map((x) => `<li dir="auto">${esc(x)}</li>`).join('')}</ul></div>`
      : '<div style="padding:10px 12px; background:#ecfdf5; border-radius:8px;">✅ All checks passed.</div>';
  };
  stBox.innerHTML = showWarnings(d);
  box.querySelector('#cc-sp-go').onclick = async () => {
    const btn = box.querySelector('#cc-sp-go');
    const lang = box.querySelector('#cc-sp-lang').value, format = box.querySelector('#cc-sp-format').value;
    const targets = {};
    box.querySelectorAll('[data-cc-sp-target]').forEach((inp) => { const s = d.skills[Number(inp.getAttribute('data-cc-sp-target'))]; if (s && inp.value !== '') targets[s.skill] = Number(inp.value); });
    const settings = { school: box.querySelector('#cc-sp-school').value, stream: (box.querySelector('#cc-sp-stream') || {}).value || '',
      term: box.querySelector('#cc-sp-term').value, level: box.querySelector('#cc-sp-level').value, scope: box.querySelector('#cc-sp-scope').value, targets };
    btn.disabled = true; btn.textContent = 'Preparing…';
    try {
      let s = await api(`/api/admin/spec/${encodeURIComponent(id)}/prepare`, { method: 'POST', body: { settings, force: box.querySelector('#cc-sp-force').checked, lang } });
      clearInterval(ov._t);
      const finish = (s2) => {
        clearInterval(ov._t);
        if (s2.job && s2.job.state === 'error') { stBox.innerHTML = `<div class="error">AI tagging stopped: ${esc(s2.job.error)}</div>` + showWarnings(s2); }
        else stBox.innerHTML = showWarnings(s2);
        window.location.href = `/api/admin/spec/${encodeURIComponent(id)}/xlsx?format=${format}&lang=${lang}`;
        btn.disabled = false; btn.textContent = '⬇ Download again';
      };
      if (s.job && s.job.state === 'running') {
        const tick = async () => {
          try {
            const s2 = await api(`/api/admin/spec/${encodeURIComponent(id)}/status?lang=${lang}`);
            if (s2.job.state === 'running') stBox.innerHTML = `<div class="muted">🤖 Tagging Bloom’s levels and learning outcomes… ${s2.job.done}/${s2.job.total || '…'} questions</div>`;
            else finish(s2);
          } catch (e) { clearInterval(ov._t); stBox.innerHTML = `<div class="error">${esc(e.message)}</div>`; btn.disabled = false; btn.textContent = '⬇ Prepare & download'; }
        };
        stBox.innerHTML = '<div class="muted">🤖 Tagging Bloom’s levels and learning outcomes…</div>';
        ov._t = setInterval(tick, 2500);
      } else finish(s);
    } catch (e) { stBox.innerHTML = `<div class="error">${esc(e.message)}</div>`; btn.disabled = false; btn.textContent = '⬇ Prepare & download'; }
  };
}
document.addEventListener('click', (e) => {
  const b = e.target && e.target.closest && e.target.closest('[data-cc-spec]');
  if (b) { e.preventDefault(); e.stopPropagation(); ccOpenSpecDialog(b.getAttribute('data-cc-spec')); }
}, true);

// ── Auto-update: when a new version is deployed, open pages refresh ─────
(function ccAutoUpdate() {
  let mine = null;
  const builderOpen = () => { const b = document.getElementById('builder-view'); return !!(b && b.style.display !== 'none' && b.offsetParent !== null); };
  function banner() {
    if (document.getElementById('cc-update-banner')) return;
    const d = document.createElement('div'); d.id = 'cc-update-banner';
    d.style.cssText = 'position:fixed; left:50%; bottom:18px; transform:translateX(-50%); z-index:2147483600; background:#1e3a8a; color:#fff; padding:10px 16px; border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,.3); display:flex; gap:12px; align-items:center; font-size:14px;';
    d.innerHTML = '🔄 ClassCurio has been updated. Save your work, then reload. <button class="btn" style="background:#fff; color:#1e3a8a; font-weight:600;">Reload now</button>';
    d.querySelector('button').onclick = () => location.reload();
    document.body.appendChild(d);
  }
  async function check() {
    try {
      const r = await fetch('/api/version', { cache: 'no-store', credentials: 'include' });
      const j = await r.json();
      if (!j || !j.build) return;
      if (mine === null) { mine = j.build; return; }
      if (j.build !== mine) { if (builderOpen()) banner(); else location.reload(); }
    } catch (e) {}
  }
  check();
  setInterval(check, 60 * 1000);
  window.addEventListener('focus', check);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
})();

// ── AI panel: MOE curriculum lesson picker → see "Learning-outcome coverage" at the end of this file.
document.addEventListener('change', (e) => {
  const id = e.target && e.target.id;
  if (['ai-subject', 'ai-cur-grade', 'ai-cur-stream', 'ai-cur-term'].includes(id)) ccLoadCurriculumOptions();
});

// ═══════════════════════════════════════════════════════════════════════
//  🎯 Learning-outcome coverage (per class section)
//  • AI panel: pick a class → each MOE outcome shows whether it has been
//    assessed in an assessment that students actually took; tick the gaps.
//  • Dashboard: "🎯 Outcome coverage" window for the active class.
//  • Admin: coverage report for every teacher / class + Excel download.
// ═══════════════════════════════════════════════════════════════════════
const CC_COV_SUBJECTS = ['Math', 'Science', 'Physics', 'Chemistry', 'Biology', 'English', 'AI & Technology', 'Business Studies', 'Health Science'];
function ccCovChip(o) {
  if (!o) return '';
  const up = o.taught ? '' : ' <span style="color:#64748b;">· not taught yet</span>';
  const base = 'display:inline-block; font-size:11px; padding:1px 7px; border-radius:999px; margin-left:6px; white-space:nowrap;';
  if (o.status === 'met') return `<span style="${base} background:#dcfce7; color:#166534;" title="${escapeHtml(o.assessments.join(' · '))}">🟢 assessed ×${o.count}</span>${up}`;
  if (o.status === 'partial') return `<span style="${base} background:#fef3c7; color:#92400e;" title="Power outcome — assessed in ${o.count} of 2 assessments">🟠 ${o.count} of 2</span>${up}`;
  if (o.status === 'optional') return `<span style="${base} background:#f1f5f9; color:#475569;">⚪ enrichment</span>${up}`;
  return `<span style="${base} background:#fee2e2; color:#991b1b;">🔴 not assessed</span>${up}`;
}
function ccCovPowerTag(p) { return /power|أولوية|main slo/i.test(String(p || '')) ? ' <span style="font-size:10px; color:#7c3aed; font-weight:600;">POWER</span>' : ''; }

// ── AI panel: curriculum picker with per-outcome coverage ───────────────
function ccCovFillClassSelect() {
  const sel = document.getElementById('ai-cov-class');
  if (!sel || typeof classes === 'undefined') return;
  const cur = sel.value || sel.getAttribute('data-want') || getActiveClassId() || '';
  sel.innerHTML = '<option value="">— no class (don\'t show coverage) —</option>' + classes.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  if (classes.find((c) => c.id === cur)) sel.value = cur;
  sel.removeAttribute('data-want');
}
function ccCurriculumSelection() {
  const g = (document.getElementById('ai-cur-grade') || {}).value;
  if (!g) return null;
  const keys = Array.from(document.querySelectorAll('#ai-cur-list input[data-cur-key]:checked')).map((x) => x.getAttribute('data-cur-key'));
  const outs = Array.from(document.querySelectorAll('#ai-cur-list input[data-cur-out]:checked')).map((x) => x.getAttribute('data-cur-out'));
  if (!keys.length && !outs.length) return null;
  const gap = outs.some((c) => { const o = (window._ccCovMap || {})[c]; return o && o.status !== 'met'; });
  return { grade: g, stream: parseInt(g, 10) >= 9 ? (document.getElementById('ai-cur-stream') || {}).value || 'A' : '',
    term: (document.getElementById('ai-cur-term') || {}).value || '1', keys, outcomes: outs, gapFill: gap,
    classId: (document.getElementById('ai-cov-class') || {}).value || '' };
}
async function ccLoadCurriculumOptions() {
  ccCovFillClassSelect();
  const subj = (document.getElementById('ai-subject') || {}).value || '';
  const g = (document.getElementById('ai-cur-grade') || {}).value || '';
  const streamSel = document.getElementById('ai-cur-stream');
  if (streamSel) streamSel.style.display = parseInt(g, 10) >= 9 ? '' : 'none';
  const st = document.getElementById('ai-cur-status'), list = document.getElementById('ai-cur-list');
  const covBox = document.getElementById('ai-cov-summary');
  if (!st || !list) return;
  list.innerHTML = ''; if (covBox) covBox.innerHTML = '';
  window._ccCovMap = {};
  if (!subj || !g) { st.textContent = 'Pick the subject above, then the grade — the lessons from the MOE curriculum appear here. Tick the lessons or outcomes this assessment should cover.'; return; }
  const q = new URLSearchParams({ subject: subj, grade: g, stream: parseInt(g, 10) >= 9 ? streamSel.value : '', term: document.getElementById('ai-cur-term').value });
  st.textContent = 'Loading lessons…';
  const seq = (window._ccCurSeq = (window._ccCurSeq || 0) + 1);
  try {
    let d = await (await fetch('/api/curriculum/options?' + q.toString(), { credentials: 'include' })).json();
    if ((!d.available || !d.lessons.length) && parseInt(g, 10) >= 9 && streamSel) {
      const other = streamSel.value === 'A' ? 'G' : 'A';
      q.set('stream', other);
      const d2 = await (await fetch('/api/curriculum/options?' + q.toString(), { credentials: 'include' })).json();
      if (d2.available && d2.lessons.length) { streamSel.value = other; d = d2; }
    }
    if (seq !== window._ccCurSeq) return;
    if (!d.available || !d.lessons.length) { st.textContent = 'No MOE curriculum is stored for this subject / grade / term yet — the AI will use your instructions only.'; return; }
    // Coverage for the chosen class section
    const classId = (document.getElementById('ai-cov-class') || {}).value || '';
    let cov = null;
    if (classId) {
      try {
        const cq = new URLSearchParams({ classId, subject: subj, term: q.get('term'), grade: g, stream: parseInt(g, 10) >= 9 ? streamSel.value : '' });
        cov = await api('/api/coverage?' + cq.toString());
        (cov.outcomes || []).forEach((o) => { window._ccCovMap[o.code] = o; if (o.lessonKey && !o.code.includes('.') ) window._ccCovMap['L:' + o.lessonKey] = o; });
      } catch (e) { cov = null; }
    }
    if (seq !== window._ccCurSeq) return;
    const covOf = (l, s) => (s ? window._ccCovMap[s.code] : (window._ccCovMap[l.key] || window._ccCovMap['L:' + l.key]));
    st.innerHTML = `📚 ${escapeHtml(d.source)} — tick lessons or single outcomes (${d.lessons.length} lessons). <a href="#" id="ai-cur-all">Select all</a> · <a href="#" id="ai-cur-none">None</a>`
      + (cov ? ` · <a href="#" id="ai-cov-gaps-taught" style="color:#b91c1c; font-weight:600;">Select not-yet-assessed (taught so far)</a> · <a href="#" id="ai-cov-gaps-all" style="color:#b91c1c;">all not-yet-assessed</a>` : '');
    if (covBox && cov) {
      const s = cov.summary;
      const cls = (classes.find((c) => c.id === classId) || {}).name || '';
      covBox.innerHTML = `<div style="margin:6px 0; padding:8px 10px; border-radius:8px; background:${s.required && s.pct >= 80 ? '#ecfdf5' : '#fff7ed'}; font-size:13px;">
        🎯 <strong>${escapeHtml(cls)}</strong> — Term ${escapeHtml(cov.term)}: <strong>${s.met}</strong> of ${s.required} outcomes fully assessed (${s.pct}%)
        · <span style="color:#b91c1c;">${s.taughtMissing} taught so far still need assessing</span>
        ${cov.pending ? `<div class="muted" style="font-size:12px;">⏳ ${cov.pending} question(s) in older assessments are still being matched to outcomes by AI — the picture will be complete in a few minutes.</div>` : ''}
        <div class="muted" style="font-size:12px;">Only assessments students have taken count. Power outcomes need 2 assessments.</div></div>`;
    }
    let lastMod = null;
    list.innerHTML = d.lessons.map((l) => {
      const head = l.module && l.module !== lastMod ? `<div style="font-weight:600; margin:8px 0 2px; color:#3730a3;" dir="auto">${escapeHtml(l.module)}</div>` : '';
      lastMod = l.module;
      const slos = Array.isArray(l.slos) ? l.slos : [];
      const lessonCov = !slos.length && cov ? covOf(l) : null;
      const row = `<label style="display:flex; gap:8px; align-items:flex-start; text-transform:none; letter-spacing:0; font-weight:${slos.length ? 600 : 400}; margin:3px 0;" dir="auto">
        <input type="checkbox" data-cur-key="${escapeHtml(l.key)}" style="width:auto; margin-top:3px;">
        <span>${escapeHtml(l.lesson)}${l.weeks ? ` <span class="muted" style="font-size:12px; font-weight:400;">· ${escapeHtml(l.weeks)}</span>` : ''}${l.type === 'enrichment' ? ' <span class="muted" style="font-size:12px; font-weight:400;">· enrichment</span>' : ''}${lessonCov ? ccCovChip(lessonCov) : ''}</span></label>`;
      const sub = slos.map((s) => `<label style="display:flex; gap:8px; align-items:flex-start; text-transform:none; letter-spacing:0; font-weight:400; margin:2px 0 2px 26px; font-size:13px;" dir="auto">
        <input type="checkbox" data-cur-out="${escapeHtml(s.code)}" data-cur-lesson="${escapeHtml(l.key)}" style="width:auto; margin-top:3px;">
        <span><span style="color:#475569; font-family:monospace; font-size:11px;">${escapeHtml(s.code)}</span>${ccCovPowerTag(s.priority)} ${escapeHtml(s.text)}${cov ? ccCovChip(covOf(l, s)) : ''}</span></label>`).join('');
      return head + row + sub;
    }).join('');
    const syncLesson = (key) => {
      const kids = list.querySelectorAll(`input[data-cur-lesson="${CSS.escape(key)}"]`);
      if (!kids.length) return;
      const lb = list.querySelector(`input[data-cur-key="${CSS.escape(key)}"]`);
      const n = Array.from(kids).filter((x) => x.checked).length;
      if (lb) { lb.checked = n > 0; lb.indeterminate = n > 0 && n < kids.length; }
    };
    list.onchange = (e) => {
      const t = e.target;
      if (t.hasAttribute('data-cur-key')) {
        list.querySelectorAll(`input[data-cur-lesson="${CSS.escape(t.getAttribute('data-cur-key'))}"]`).forEach((x) => { x.checked = t.checked; });
        t.indeterminate = false;
      } else if (t.hasAttribute('data-cur-out')) syncLesson(t.getAttribute('data-cur-lesson'));
    };
    const setAll = (fn) => {
      list.querySelectorAll('input[data-cur-out]').forEach((x) => { x.checked = !!fn(window._ccCovMap[x.getAttribute('data-cur-out')], x); });
      list.querySelectorAll('input[data-cur-key]').forEach((x) => {
        const key = x.getAttribute('data-cur-key');
        if (list.querySelector(`input[data-cur-lesson="${CSS.escape(key)}"]`)) syncLesson(key);
        else x.checked = !!fn(window._ccCovMap[key] || window._ccCovMap['L:' + key], x);
      });
    };
    const gap = (taughtOnly) => (o) => o && o.required > 0 && o.status !== 'met' && (!taughtOnly || o.taught);
    const bind = (id, fn) => { const a = document.getElementById(id); if (a) a.onclick = (e) => { e.preventDefault(); setAll(fn); }; };
    bind('ai-cur-all', () => true); bind('ai-cur-none', () => false);
    bind('ai-cov-gaps-taught', gap(true)); bind('ai-cov-gaps-all', gap(false));
    // Outcomes chosen in the coverage window
    const pre = window._ccCovPreselect;
    if (pre && Array.isArray(pre.codes)) {
      const want = new Set(pre.codes);
      setAll((o, x) => want.has(x.getAttribute('data-cur-out') || x.getAttribute('data-cur-key')) || (o && want.has(o.code)));
      window._ccCovPreselect = null;
      const first = list.querySelector('input:checked'); if (first) first.scrollIntoView({ block: 'nearest' });
    }
  } catch (e) { st.textContent = 'Could not load the curriculum: ' + e.message; }
}
document.addEventListener('change', async (e) => {
  if (!e.target || e.target.id !== 'ai-cov-class') return;
  const cid = e.target.value;
  const gSel = document.getElementById('ai-cur-grade');
  if (cid && gSel && !gSel.value) {
    try {
      const subj = (document.getElementById('ai-subject') || {}).value || '';
      const r = await api('/api/coverage?' + new URLSearchParams({ classId: cid, subject: subj }).toString());
      if (r.profile && r.profile.grade) { gSel.value = r.profile.grade; const s = document.getElementById('ai-cur-stream'); if (s && r.profile.stream) s.value = r.profile.stream; }
    } catch (err) { /* ignore */ }
  }
  ccLoadCurriculumOptions();
});
document.addEventListener('click', (e) => {
  if (e.target && e.target.closest && e.target.closest('#new-btn')) setTimeout(() => { ccCovFillClassSelect(); }, 50);
});

// ── Dashboard: Outcome coverage window ──────────────────────────────────
async function ccOpenCoverage(opts) {
  opts = opts || {};
  let ov = document.getElementById('cc-cov');
  if (!ov) {
    ov = document.createElement('div'); ov.id = 'cc-cov';
    ov.style.cssText = 'position:fixed; inset:0; background:rgba(11,16,32,0.55); z-index:2147483000; display:flex; align-items:flex-start; justify-content:center; overflow:auto; padding:30px 12px;';
    ov.innerHTML = '<div style="background:#fff; border-radius:12px; width:min(1000px,100%); padding:20px 24px; box-shadow:0 16px 48px rgba(0,0,0,.3);"><div class="muted">Loading…</div></div>';
    ov.addEventListener('click', (ev) => { if (ev.target === ov) { clearTimeout(ov._t); ov.remove(); } });
    document.body.appendChild(ov);
  }
  const box = ov.firstElementChild;
  const esc = (x) => escapeHtml(String(x == null ? '' : x));
  const st = ov._st = Object.assign(ov._st || { classId: getActiveClassId(), filter: 'gaps' }, opts);
  const qs = new URLSearchParams({ classId: st.classId || '' });
  if (st.subject) qs.set('subject', st.subject);
  if (st.term) qs.set('term', st.term);
  if (st.grade) { qs.set('grade', st.grade); qs.set('stream', st.stream || ''); }
  let d;
  try { d = await api('/api/coverage?' + qs.toString()); }
  catch (e) { box.innerHTML = `<div class="error">${esc(e.message)}</div><button class="btn" onclick="document.getElementById('cc-cov').remove()">Close</button>`; return; }
  st.subject = d.subject; st.term = d.term; st.grade = d.profile.grade; st.stream = d.profile.stream;
  const s = d.summary;
  const subjOpts = Array.from(new Set([...(d.subjects || []), ...CC_COV_SUBJECTS]));
  const shown = d.outcomes.filter((o) => st.filter === 'all' ? true : st.filter === 'taught' ? (o.required && o.status !== 'met' && o.taught) : (o.required && o.status !== 'met'));
  let lastMod = null;
  const rowsHtml = shown.map((o) => {
    const head = (o.module || o.unit) !== lastMod ? `<tr><td colspan="3" style="padding:10px 6px 4px; font-weight:600; color:#3730a3;" dir="auto">${esc(o.module || o.unit)}</td></tr>` : '';
    lastMod = o.module || o.unit;
    return head + `<tr style="border-bottom:1px solid #f1f5f9; vertical-align:top;">
      <td style="padding:5px 6px; width:28px;">${o.status !== 'met' && o.required ? `<input type="checkbox" data-cov-pick="${esc(o.code)}" ${o.taught ? 'checked' : ''} style="width:auto;">` : ''}</td>
      <td style="padding:5px 6px;" dir="auto"><span style="font-family:monospace; font-size:11px; color:#475569;">${esc(o.code)}</span>${o.power ? ' <span style="font-size:10px; color:#7c3aed; font-weight:600;">POWER</span>' : ''} ${esc(o.text)}
        <div class="muted" style="font-size:12px;">${esc(o.lesson || '')}${o.weeks ? ' · ' + esc(o.weeks) : ''}${o.assessments.length ? ' · assessed in: ' + esc(o.assessments.join(' · ')) : ''}</div></td>
      <td style="padding:5px 6px; white-space:nowrap; text-align:right;">${ccCovChip(o)}</td></tr>`;
  }).join('');
  box.innerHTML = `
    <div class="row" style="align-items:center; gap:10px; margin-bottom:10px; flex-wrap:wrap;">
      <h2 style="margin:0; flex:1;">🎯 Outcome coverage</h2>
      <button class="btn" id="cc-cov-close">Close</button>
    </div>
    <div class="row" style="gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:10px;">
      <select id="cc-cov-class" style="width:auto;">${classes.map((c) => `<option value="${c.id}" ${c.id === d.class.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
      <select id="cc-cov-subject" style="width:auto;">${subjOpts.map((x) => `<option ${x === d.subject ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
      <select id="cc-cov-term" style="width:auto;">${['1', '2', '3'].map((t) => `<option value="${t}" ${t === d.term ? 'selected' : ''}>Term ${t}</option>`).join('')}</select>
      <span class="muted" style="font-size:13px;">Class is</span>
      <select id="cc-cov-grade" style="width:auto;"><option value="">Grade…</option>${[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((g) => `<option value="${g}" ${String(g) === String(d.profile.grade) ? 'selected' : ''}>Grade ${g}</option>`).join('')}</select>
      <select id="cc-cov-stream" style="width:auto; ${parseInt(d.profile.grade, 10) >= 9 ? '' : 'display:none;'}"><option value="A" ${d.profile.stream !== 'G' ? 'selected' : ''}>Advanced</option><option value="G" ${d.profile.stream === 'G' ? 'selected' : ''}>General</option></select>
      <button class="btn" id="cc-cov-save" title="Remember the grade and stream of this class">💾 Save class grade</button>
      ${d.profile.guessed ? '<span style="font-size:12px; color:#b45309;">⚠ grade/stream guessed — check and save</span>' : ''}
    </div>
    ${!d.curriculum ? `<div style="padding:10px 12px; border-radius:8px; background:#fef3c7;">No MOE curriculum is stored for ${esc(d.subject || 'this subject')} · Grade ${esc(d.profile.grade || '?')}${parseInt(d.profile.grade, 10) >= 9 ? (d.profile.stream === 'G' ? ' General' : ' Advanced') : ''} · Term ${esc(d.term)}. Check the grade and stream above.</div>` : `
    <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px;">
      <div style="flex:1; min-width:220px; padding:10px 12px; border-radius:10px; background:#eef2ff;">
        <div style="font-size:13px;" class="muted">Term ${esc(d.term)}${d.week ? ' · now in week ' + d.week : ''} · ${esc(d.curriculum.source)}</div>
        <div style="font-size:22px; font-weight:700;">${s.pct}% covered</div>
        <div style="background:#e5e7eb; border-radius:6px; height:10px; overflow:hidden; margin-top:4px;"><div style="width:${s.pct}%; height:100%; background:${s.pct >= 80 ? '#16a34a' : s.pct >= 50 ? '#f59e0b' : '#dc2626'};"></div></div>
      </div>
      <div style="padding:10px 12px; border-radius:10px; background:#f8fafc; font-size:14px; line-height:1.6;">
        🟢 Fully assessed: <strong>${s.met}</strong> / ${s.required}<br>🟠 Power, once only: <strong>${s.partial}</strong><br>🔴 Not assessed: <strong>${s.none}</strong></div>
      <div style="padding:10px 12px; border-radius:10px; background:#fff7ed; font-size:14px; line-height:1.6;">
        Taught so far, still to assess: <strong style="color:#b91c1c;">${s.taughtMissing}</strong><br>Power outcomes met: <strong>${s.powerMet}</strong> / ${s.power}<br>Assessments taken: <strong>${d.assessments.length}</strong></div>
    </div>
    ${d.pending ? `<div style="padding:8px 12px; border-radius:8px; background:#fef3c7; font-size:13px; margin-bottom:8px;">⏳ ${d.pending} question(s) in older assessments are being matched to outcomes by AI. This window refreshes by itself.</div>` : ''}
    <div class="row" style="gap:8px; align-items:center; margin-bottom:6px; flex-wrap:wrap;">
      <button class="btn ${st.filter === 'gaps' ? 'primary' : ''}" data-cov-filter="gaps">Not fully assessed</button>
      <button class="btn ${st.filter === 'taught' ? 'primary' : ''}" data-cov-filter="taught">Taught so far, not assessed</button>
      <button class="btn ${st.filter === 'all' ? 'primary' : ''}" data-cov-filter="all">All outcomes</button>
      <div class="spacer" style="flex:1;"></div>
      <button class="btn primary" id="cc-cov-gen">✨ Generate an assessment for the ticked outcomes</button>
    </div>
    <div style="max-height:52vh; overflow:auto; border:1px solid #e5e7eb; border-radius:8px;">
      <table style="width:100%; border-collapse:collapse; font-size:14px;">${rowsHtml || '<tr><td style="padding:14px;" class="muted">🎉 Nothing to show — every outcome in this view has been assessed.</td></tr>'}</table>
    </div>
    <div class="muted" style="font-size:12px; margin-top:8px;">Only assessments that students have taken count. Power outcomes need 2 assessments; enrichment lessons are optional. Each class section is tracked separately.</div>`}`;
  const reload = (o) => ccOpenCoverage(o);
  box.querySelector('#cc-cov-close').onclick = () => { clearTimeout(ov._t); ov.remove(); };
  box.querySelector('#cc-cov-class').onchange = (ev) => reload({ classId: ev.target.value, subject: '', grade: '', stream: '' });
  box.querySelector('#cc-cov-subject').onchange = (ev) => reload({ subject: ev.target.value });
  box.querySelector('#cc-cov-term').onchange = (ev) => reload({ term: ev.target.value });
  box.querySelector('#cc-cov-grade').onchange = (ev) => reload({ grade: ev.target.value, stream: box.querySelector('#cc-cov-stream').value });
  box.querySelector('#cc-cov-stream').onchange = (ev) => reload({ grade: box.querySelector('#cc-cov-grade').value, stream: ev.target.value });
  box.querySelector('#cc-cov-save').onclick = async () => {
    try { await api('/api/coverage/profile', { method: 'POST', body: { classId: d.class.id, grade: box.querySelector('#cc-cov-grade').value, stream: box.querySelector('#cc-cov-stream').value } }); reload({}); }
    catch (e) { alert(e.message); }
  };
  box.querySelectorAll('[data-cov-filter]').forEach((b) => { b.onclick = () => reload({ filter: b.getAttribute('data-cov-filter') }); });
  const gen = box.querySelector('#cc-cov-gen');
  if (gen) gen.onclick = () => {
    const codes = Array.from(box.querySelectorAll('[data-cov-pick]:checked')).map((x) => x.getAttribute('data-cov-pick'));
    if (!codes.length) { alert('Tick at least one outcome first.'); return; }
    clearTimeout(ov._t); ov.remove();
    ccGenerateForOutcomes({ classId: d.class.id, subject: d.subject, grade: d.profile.grade, stream: d.profile.stream, term: d.term, codes });
  };
  clearTimeout(ov._t);
  if (d.pending && d.matching) ov._t = setTimeout(() => { if (document.getElementById('cc-cov')) reload({}); }, 20000);
}
function ccGenerateForOutcomes(p) {
  if (p.classId) { setActiveClassId(p.classId); if (els.classSwitcher) els.classSwitcher.value = p.classId; }
  const nb = document.getElementById('new-btn'); if (nb) nb.click();
  setTimeout(() => {
    const set = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };
    set('ai-subject', p.subject); set('ai-cur-grade', p.grade); set('ai-cur-stream', p.stream || 'A'); set('ai-cur-term', p.term);
    const cs = document.getElementById('ai-cov-class'); if (cs) { cs.setAttribute('data-want', p.classId); }
    window._ccCovPreselect = { codes: p.codes };
    const subjEl = document.getElementById('ai-subject'); if (subjEl) subjEl.dispatchEvent(new Event('change', { bubbles: false }));
    ccLoadCurriculumOptions();
    const box = document.getElementById('ai-cur-box'); if (box) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const pr = document.getElementById('ai-prompt');
    if (pr && !pr.value) pr.value = `Assess the ${p.codes.length} ticked learning outcome${p.codes.length === 1 ? '' : 's'} that have not been assessed yet for this class.`;
  }, 250);
}
document.addEventListener('click', (e) => {
  const b = e.target && e.target.closest && e.target.closest('#coverage-btn');
  if (b) { e.preventDefault(); const ov = document.getElementById('cc-cov'); if (ov) ov.remove(); ccOpenCoverage({ classId: getActiveClassId(), subject: '', grade: '', stream: '', filter: 'gaps' }); }
});
// Small coverage chip next to the class switcher
async function ccCovRefreshChip() {
  const chip = document.getElementById('cc-cov-chip');
  if (!chip) return;
  try {
    const r = await api('/api/coverage/overview');
    const c = (r.classes || []).find((x) => x.id === getActiveClassId());
    const sub = c && c.subjects.find((x) => x.curriculum && x.summary.required);
    if (!sub) { chip.textContent = ''; return; }
    const p = sub.summary.pct;
    chip.innerHTML = `<span style="padding:3px 9px; border-radius:999px; font-size:12px; background:${p >= 80 ? '#dcfce7' : p >= 50 ? '#fef3c7' : '#fee2e2'};" title="${escapeHtml(sub.subject)} · Term ${escapeHtml(r.term)}">🎯 ${sub.summary.met}/${sub.summary.required} outcomes assessed (${p}%)</span>`;
  } catch (e) { chip.textContent = ''; }
}
setTimeout(ccCovRefreshChip, 1500);
document.addEventListener('change', (e) => { if (e.target && e.target.id === 'class-switcher') setTimeout(ccCovRefreshChip, 300); });

// ── Admin: coverage report for every teacher / class section ────────────
async function ccOpenAdminCoverage(opts) {
  opts = opts || {};
  let ov = document.getElementById('cc-acov');
  if (!ov) {
    ov = document.createElement('div'); ov.id = 'cc-acov';
    ov.style.cssText = 'position:fixed; inset:0; background:rgba(11,16,32,0.55); z-index:2147483000; display:flex; align-items:flex-start; justify-content:center; overflow:auto; padding:30px 12px;';
    ov.innerHTML = '<div style="background:#fff; border-radius:12px; width:min(1150px,100%); padding:20px 24px; box-shadow:0 16px 48px rgba(0,0,0,.3);"><div class="muted">Loading…</div></div>';
    ov.addEventListener('click', (ev) => { if (ev.target === ov) { clearTimeout(ov._t); ov.remove(); } });
    document.body.appendChild(ov);
  }
  const box = ov.firstElementChild;
  const esc = (x) => escapeHtml(String(x == null ? '' : x));
  const st = ov._st = Object.assign(ov._st || { term: '', q: '' }, opts);
  let d;
  try { d = await api('/api/admin/coverage?' + new URLSearchParams({ term: st.term || '', match: opts.match ? '1' : '' }).toString()); }
  catch (e) { box.innerHTML = `<div class="error">${esc(e.message)}</div>`; return; }
  st.term = d.term;
  const q = (st.q || '').toLowerCase();
  const rows = d.rows.filter((r) => !q || [r.teacher, r.className, r.subject].join(' ').toLowerCase().includes(q));
  const tot = rows.reduce((a, r) => { a.req += r.summary.required; a.met += r.summary.met; a.pend += r.pending; return a; }, { req: 0, met: 0, pend: 0 });
  box.innerHTML = `
    <div class="row" style="align-items:center; gap:10px; margin-bottom:10px; flex-wrap:wrap;">
      <h2 style="margin:0; flex:1;">🎯 Outcome coverage — all teachers</h2>
      <select id="cc-acov-term" style="width:auto;">${['1', '2', '3'].map((t) => `<option value="${t}" ${t === d.term ? 'selected' : ''}>Term ${t}</option>`).join('')}</select>
      <a class="btn primary" href="/api/admin/coverage.xlsx?term=${encodeURIComponent(d.term)}">⬇ Download Excel</a>
      <button class="btn" id="cc-acov-match" title="Use AI to link questions in older assessments to curriculum outcomes">🔗 Match older questions</button>
      <button class="btn" id="cc-acov-close">Close</button>
    </div>
    <div class="row" style="gap:10px; align-items:center; margin-bottom:10px; flex-wrap:wrap;">
      <input id="cc-acov-q" placeholder="Filter by teacher, class or subject…" value="${esc(st.q || '')}" style="max-width:320px;">
      <span class="muted" style="font-size:13px;">${rows.length} class/subject rows · ${tot.met} of ${tot.req} required outcomes fully assessed${tot.pend ? ` · ⏳ ${tot.pend} questions waiting for AI matching${d.matching ? ' (running)' : ''}` : ''}</span>
    </div>
    <div style="max-height:62vh; overflow:auto; border:1px solid #e5e7eb; border-radius:8px;">
    <table style="width:100%; border-collapse:collapse; font-size:14px;">
      <tr style="text-align:left; background:#f8fafc; position:sticky; top:0;"><th style="padding:8px;">Teacher</th><th>Class</th><th>Subject</th><th>Grade</th><th>Taken</th><th style="min-width:150px;">Coverage</th><th>🟢</th><th>🟠</th><th>🔴</th><th>Power</th><th>Taught, not assessed</th></tr>
      ${rows.map((r, i) => {
        const s = r.summary, p = s.pct;
        return `<tr style="border-top:1px solid #f1f5f9; cursor:pointer;" data-acov-row="${i}">
          <td style="padding:7px 8px;">${esc(r.teacher)}</td><td>${esc(r.className)}</td><td>${esc(r.subject)}</td>
          <td>${esc(r.grade || '?')}${r.stream ? (r.stream === 'A' ? ' Adv' : ' Gen') : ''}${r.guessed ? ' <span title="Guessed from the class name — the teacher can confirm it" style="color:#b45309;">*</span>' : ''}</td>
          <td>${r.taken}</td>
          <td>${r.curriculum ? `<div style="display:flex; align-items:center; gap:6px;"><div style="flex:1; background:#e5e7eb; border-radius:6px; height:8px; overflow:hidden;"><div style="width:${p}%; height:100%; background:${p >= 80 ? '#16a34a' : p >= 50 ? '#f59e0b' : '#dc2626'};"></div></div><strong>${p}%</strong></div>` : '<span class="muted" style="font-size:12px;">no MOE curriculum</span>'}</td>
          <td>${s.met}</td><td>${s.partial}</td><td>${s.none}</td><td>${s.powerMet}/${s.power}</td><td style="color:#b91c1c; font-weight:600;">${s.taughtMissing}</td></tr>
          <tr data-acov-detail="${i}" style="display:none;"><td colspan="11" style="padding:6px 12px 12px; background:#fafafa;">
            ${r.missing.length ? r.missing.map((o) => `<div style="font-size:13px; padding:3px 0;" dir="auto">${o.status === 'partial' ? '🟠' : '🔴'} <span style="font-family:monospace; font-size:11px; color:#475569;">${esc(o.code)}</span>${o.power ? ' <span style="font-size:10px; color:#7c3aed; font-weight:600;">POWER</span>' : ''} ${esc(o.text)}${o.taught ? '' : ' <span class="muted">· not taught yet</span>'}</div>`).join('') : '<div class="muted">🎉 Every required outcome has been assessed.</div>'}
          </td></tr>`;
      }).join('') || '<tr><td colspan="11" style="padding:14px;" class="muted">No classes with assessments in this term yet.</td></tr>'}
    </table></div>
    <div class="muted" style="font-size:12px; margin-top:8px;">Click a row to see the outcomes still to assess. Only assessments students have taken count; Power outcomes need 2 assessments; enrichment is optional. * = grade/stream guessed from the class name.</div>`;
  box.querySelector('#cc-acov-close').onclick = () => { clearTimeout(ov._t); ov.remove(); };
  box.querySelector('#cc-acov-term').onchange = (e) => ccOpenAdminCoverage({ term: e.target.value });
  box.querySelector('#cc-acov-match').onclick = () => ccOpenAdminCoverage({ match: true });
  const qi = box.querySelector('#cc-acov-q');
  qi.oninput = () => { clearTimeout(qi._t); qi._t = setTimeout(() => { st.q = qi.value; ccOpenAdminCoverage({}); }, 400); };
  box.querySelectorAll('[data-acov-row]').forEach((tr) => { tr.onclick = () => { const x = box.querySelector(`[data-acov-detail="${tr.getAttribute('data-acov-row')}"]`); if (x) x.style.display = x.style.display === 'none' ? '' : 'none'; }; });
  clearTimeout(ov._t);
  if (d.matching) ov._t = setTimeout(() => { if (document.getElementById('cc-acov')) ccOpenAdminCoverage({}); }, 20000);
}
document.addEventListener('click', (e) => {
  const b = e.target && e.target.closest && e.target.closest('#admin-coverage');
  if (b) {
    e.preventDefault();
    const dd = document.getElementById('admin-menu-dropdown'); if (dd) dd.style.display = 'none';
    ccOpenAdminCoverage({});
  }
});

// ═══════════════════════════════════════════════════════════════════════
//  ⚖ Weekly difficulty plan (Easy / Medium / Difficult weeks)
//  • Builder banner shows the week's target mix.
//  • "⚖ Difficulty check" (and an automatic check when saving) alerts the
//    teacher if the easy / medium / hard mix doesn't match the week, and
//    offers AI alternatives at the needed level to swap in.
// ═══════════════════════════════════════════════════════════════════════
const CC_LVL = { easy: { name: 'Easy', bg: '#dcfce7', fg: '#166534' }, medium: { name: 'Medium', bg: '#fef3c7', fg: '#92400e' }, hard: { name: 'Difficult', bg: '#fee2e2', fg: '#991b1b' } };
function ccLvlChip(l) { const x = CC_LVL[l]; return x ? `<span style="display:inline-block; font-size:11px; padding:1px 8px; border-radius:999px; background:${x.bg}; color:${x.fg}; font-weight:600;">${x.name}</span>` : '<span class="muted" style="font-size:11px;">not labelled</span>'; }
function ccDiffDate() { const v = els.scheduledDate && els.scheduledDate.value; return v || new Date().toISOString().slice(0, 10); }
async function ccDiffBanner() {
  const host = document.getElementById('cc-diff-banner');
  if (!host) return;
  try {
    const r = await api('/api/difficulty/plan?date=' + encodeURIComponent(ccDiffDate()));
    const t = r.target;
    host.innerHTML = `<div style="margin:8px 0 2px; padding:8px 12px; border-radius:8px; background:#f5f3ff; border:1px solid #ddd6fe; font-size:13px;">
      ⚖ <strong>${escapeHtml(t.label)}</strong>${els.scheduledDate && els.scheduledDate.value ? '' : ' <span class="muted">(today — set the scheduled date to plan another week)</span>'}
      → aim for <strong>${t.pct.easy}%</strong> easy · <strong>${t.pct.medium}%</strong> medium · <strong>${t.pct.hard}%</strong> difficult (by marks).</div>`;
  } catch (e) { host.innerHTML = ''; }
}
function ccDiffPayload() {
  return {
    assessmentId: (typeof editingId !== 'undefined' && editingId) || null,
    scheduledDate: ccDiffDate(),
    subject: els.subject ? els.subject.value : '', grade: els.grade ? els.grade.value : '',
    sections: (sections || []).map((s) => ({ id: s.id, passage: String(s.passage || '').slice(0, 1500) })),
    questions: (questions || []).map((q) => ({ id: q.id, type: q.type, prompt: q.prompt || '', options: q.options, correctAnswer: q.correctAnswer, points: q.points, sectionId: q.sectionId, imageUrl: q.imageUrl ? 'yes' : '' })),
  };
}
async function ccOpenDiffCheck(opts) {
  opts = opts || {};
  let ov = document.getElementById('cc-diffcheck');
  if (!ov) {
    ov = document.createElement('div'); ov.id = 'cc-diffcheck';
    ov.style.cssText = 'position:fixed; inset:0; background:rgba(11,16,32,0.55); z-index:2147483000; display:flex; align-items:flex-start; justify-content:center; overflow:auto; padding:30px 12px;';
    ov.innerHTML = '<div style="background:#fff; border-radius:12px; width:min(980px,100%); padding:20px 24px; box-shadow:0 16px 48px rgba(0,0,0,.3);"></div>';
    document.body.appendChild(ov);
  }
  ov._opts = opts;
  const box = ov.firstElementChild;
  const esc = (x) => escapeHtml(String(x == null ? '' : x));
  box.innerHTML = '<div class="muted">⚖ Checking the difficulty of each question…</div>';
  let d;
  try { d = await api('/api/difficulty/check', { method: 'POST', body: ccDiffPayload() }); }
  catch (e) {
    if (opts.gate) { ov.remove(); opts.onSave && opts.onSave(); return; }
    box.innerHTML = `<div class="error">${esc(e.message)}</div><button class="btn" id="cc-dc-x">Close</button>`;
    box.querySelector('#cc-dc-x').onclick = () => ov.remove(); return;
  }
  if (opts.gate && d.ok) { ov.remove(); opts.onSave && opts.onSave(); return; }
  ov._d = d;
  const t = d.target;
  const bar = (l) => `<div style="display:flex; align-items:center; gap:8px; margin:3px 0; font-size:13px;">
      <div style="width:70px;">${ccLvlChip(l)}</div>
      <div style="flex:1; position:relative; background:#f1f5f9; border-radius:6px; height:16px;">
        <div style="position:absolute; left:0; top:0; bottom:0; width:${Math.min(100, d.pct[l])}%; background:${CC_LVL[l].fg}; opacity:.75; border-radius:6px;"></div>
        <div title="Target" style="position:absolute; top:-3px; bottom:-3px; left:calc(${t.pct[l]}% - 1px); width:3px; background:#111827;"></div></div>
      <div style="width:150px;">now <strong>${d.pct[l]}%</strong> · target ${t.pct[l]}%</div></div>`;
  const qIndex = new Map((questions || []).map((q, i) => [q.id, i]));
  const sugg = d.suggestions.filter((s) => qIndex.has(s.id));
  const need = ['easy', 'medium', 'hard'].filter((l) => Math.abs(d.need[l]) >= 0.5).map((l) => `${d.need[l] > 0 ? '+' : ''}${d.need[l]} marks ${CC_LVL[l].name.toLowerCase()}`).join(' · ');
  const qRow = (q, s) => {
    const i = qIndex.get(q.id);
    const lvl = d.levels[q.id];
    const plain = String(q.prompt || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return `<div style="border:1px solid ${s ? '#fca5a5' : '#e5e7eb'}; background:${s ? '#fff7f7' : '#fff'}; border-radius:10px; padding:10px 12px; margin:8px 0;" data-dc-q="${esc(q.id)}">
      <div style="display:flex; gap:10px; align-items:flex-start;">
        <div style="font-weight:700; min-width:34px;">Q${i + 1}</div>
        <div style="flex:1;" dir="auto">${esc(plain.slice(0, 260))}${plain.length > 260 ? '…' : ''}${q.imageUrl ? ' <span class="muted">[picture]</span>' : ''}
          <div style="margin-top:4px; font-size:12px;">${ccLvlChip(lvl)} <span class="muted">${esc(q.points || 1)} mark${Number(q.points) === 1 ? '' : 's'}${d.reasons[q.id] ? ' · ' + esc(d.reasons[q.id]) : ''}</span></div></div>
        <div style="white-space:nowrap; text-align:right;">
          ${s ? `<button class="btn primary" data-dc-alt="${esc(q.id)}" data-dc-to="${s.to}">🔄 Show ${CC_LVL[s.to].name.toLowerCase()} alternatives</button>`
              : `<select data-dc-pick="${esc(q.id)}" style="width:auto; font-size:12px;"><option value="">Replace with…</option>${['easy', 'medium', 'hard'].filter((l) => l !== lvl).map((l) => `<option value="${l}">${CC_LVL[l].name} question</option>`).join('')}</select>`}
        </div></div>
      <div data-dc-alts="${esc(q.id)}"></div></div>`;
  };
  box.innerHTML = `
    <div class="row" style="align-items:center; gap:10px; margin-bottom:6px;">
      <h2 style="margin:0; flex:1;">⚖ Difficulty check</h2>
      <button class="btn" id="cc-dc-close">${opts.gate ? 'Back to editing' : 'Close'}</button>
    </div>
    <div style="font-size:14px; margin-bottom:8px;"><strong>${esc(t.label)}</strong> · ${esc(t.date)} — target ${t.pct.easy}% easy · ${t.pct.medium}% medium · ${t.pct.hard}% difficult (by marks)</div>
    <div style="padding:10px 12px; border-radius:10px; background:${d.ok ? '#ecfdf5' : '#fef2f2'}; border:1px solid ${d.ok ? '#a7f3d0' : '#fecaca'}; margin-bottom:10px;">
      ${d.ok ? '✅ <strong>The difficulty mix matches this week.</strong>'
        : `⚠ <strong>The difficulty mix does not match this week.</strong> ${need ? 'Needed: ' + esc(need) + '.' : ''} ${sugg.length ? `Replace the <strong>${sugg.length}</strong> question${sugg.length === 1 ? '' : 's'} marked below with alternatives at the right level.` : 'Change some questions to the needed level (use “Replace with…”).'}`}
      ${d.unlabelled.length ? `<div class="muted" style="font-size:12px; margin-top:4px;">${d.unlabelled.length} question(s) could not be labelled (empty text).</div>` : ''}
      <div style="margin-top:8px;">${bar('easy')}${bar('medium')}${bar('hard')}</div>
    </div>
    ${sugg.length ? `<h3 style="margin:10px 0 4px;">Suggested changes</h3>${sugg.map((s) => qRow(questions[qIndex.get(s.id)], s)).join('')}` : ''}
    <details ${sugg.length ? '' : 'open'} style="margin-top:10px;"><summary style="cursor:pointer; font-weight:600;">All questions (${questions.length})</summary>
      ${questions.filter((q) => !sugg.some((s) => s.id === q.id)).map((q) => qRow(q, null)).join('')}</details>
    <div class="row" style="gap:8px; margin-top:14px; justify-content:flex-end;">
      ${opts.gate ? `<button class="btn" id="cc-dc-saveanyway">Save anyway</button>` : ''}
      ${opts.gate && d.ok ? '' : ''}
      <button class="btn primary" id="cc-dc-done">${opts.gate ? (d.ok ? '💾 Save now' : 'Fix questions first') : 'Done'}</button>
    </div>
    <div class="muted" style="font-size:12px; margin-top:6px;">Labels are for teachers only — students never see them. The weekly level comes from the school plan (Easy / Medium / Difficult weeks).</div>`;
  const close = () => ov.remove();
  box.querySelector('#cc-dc-close').onclick = close;
  const done = box.querySelector('#cc-dc-done');
  done.onclick = () => { close(); if (opts.gate && d.ok && opts.onSave) opts.onSave(); };
  const sa = box.querySelector('#cc-dc-saveanyway'); if (sa) sa.onclick = () => { close(); opts.onSave && opts.onSave(); };
  box.querySelectorAll('[data-dc-alt]').forEach((b) => { b.onclick = () => ccDiffShowAlternatives(b.getAttribute('data-dc-alt'), b.getAttribute('data-dc-to'), d.levels[b.getAttribute('data-dc-alt')]); });
  box.querySelectorAll('[data-dc-pick]').forEach((s) => { s.onchange = () => { if (s.value) ccDiffShowAlternatives(s.getAttribute('data-dc-pick'), s.value, d.levels[s.getAttribute('data-dc-pick')]); }; });
}
async function ccDiffShowAlternatives(qid, to, from) {
  const host = document.querySelector(`[data-dc-alts="${CSS.escape(qid)}"]`);
  const q = (questions || []).find((x) => x.id === qid);
  if (!host || !q) return;
  const esc = (x) => escapeHtml(String(x == null ? '' : x));
  host.innerHTML = `<div class="muted" style="margin-top:8px;">✨ Writing 3 ${CC_LVL[to].name.toLowerCase()} alternatives…</div>`;
  const sec = (sections || []).find((s) => s.id === q.sectionId) || {};
  let r;
  try {
    r = await api('/api/difficulty/alternatives', { method: 'POST', body: {
      question: { type: q.type, prompt: q.prompt, options: q.options, correctAnswer: q.correctAnswer, points: q.points, skill: q.skill, pairs: q.pairs, matchVariant: q.matchVariant, imageDescription: q.imageDescription, imageUrl: q.imageUrl ? 'yes' : '' },
      level: to, from, subject: els.subject ? els.subject.value : '', grade: els.grade ? els.grade.value : '',
      language: els.assessmentLanguage ? els.assessmentLanguage.value : '', passage: sec.passage || '', instructions: sec.instructions || '' } });
  } catch (e) { host.innerHTML = `<div class="error" style="margin-top:8px;">${esc(e.message)} <button class="btn" data-dc-retry>Try again</button></div>`; host.querySelector('[data-dc-retry]').onclick = () => ccDiffShowAlternatives(qid, to, from); return; }
  const ansHtml = (a) => {
    if (a.type === 'mc') return `<ol type="A" style="margin:4px 0 0 18px; padding:0;">${a.options.map((o, i) => `<li style="${i === a.correctAnswer ? 'font-weight:700; color:#166534;' : ''}" dir="auto">${esc(o)}${i === a.correctAnswer ? ' ✓' : ''}</li>`).join('')}</ol>`;
    if (a.type === 'match') return `<div style="font-size:13px; margin-top:4px;">${(a.pairs || []).map((p) => `${esc(p.left)} → ${esc(p.right)}`).join('<br>')}</div>`;
    if (a.correctAnswer === null || a.correctAnswer === undefined || a.correctAnswer === '') return '';
    return `<div style="font-size:13px; margin-top:4px; color:#166534;">Answer: <strong dir="auto">${esc(a.correctAnswer === true ? 'True' : a.correctAnswer === false ? 'False' : a.correctAnswer)}</strong></div>`;
  };
  host.innerHTML = `<div style="margin-top:8px; display:grid; gap:8px;">${r.alternatives.map((a, k) => `
    <div style="border:1px dashed #a5b4fc; border-radius:8px; padding:8px 10px; background:#f8faff;">
      <div style="display:flex; gap:8px; align-items:flex-start;"><div style="flex:1;" dir="auto"><strong>Option ${k + 1}</strong> ${ccLvlChip(to)}<div style="margin-top:4px; white-space:pre-wrap;">${esc(a.prompt)}</div>${ansHtml(a)}
        ${a.difficultyReason ? `<div class="muted" style="font-size:12px; margin-top:4px;">Why ${CC_LVL[to].name.toLowerCase()}: ${esc(a.difficultyReason)}</div>` : ''}</div>
        <button class="btn primary" data-dc-use="${k}">Use this question</button></div></div>`).join('')}
    <div><button class="btn" data-dc-more>↻ Other alternatives</button> <button class="btn" data-dc-keep>Keep the original</button></div></div>`;
  host.querySelector('[data-dc-more]').onclick = () => ccDiffShowAlternatives(qid, to, from);
  host.querySelector('[data-dc-keep]').onclick = () => { host.innerHTML = ''; };
  host.querySelectorAll('[data-dc-use]').forEach((b) => {
    b.onclick = () => {
      const a = r.alternatives[Number(b.getAttribute('data-dc-use'))];
      const i = questions.findIndex((x) => x.id === qid);
      if (i < 0) return;
      const old = questions[i];
      const nq = Object.assign({}, old, { id: uid(), type: a.type, prompt: a.prompt, points: a.points || old.points, skill: a.skill || old.skill || '', explanation: a.explanation || '' });
      if (a.type === 'mc') { nq.options = a.options; nq.correctAnswer = a.correctAnswer; }
      else if (a.type === 'match') { nq.pairs = a.pairs; }
      else nq.correctAnswer = a.correctAnswer;
      if (old.imageUrl) { nq.imageUrl = ''; nq.imageDescription = ''; }
      questions[i] = nq;
      try { renderQuestions(); } catch (e) { console.warn(e); }
      ccOpenDiffCheck(document.getElementById('cc-diffcheck') && document.getElementById('cc-diffcheck')._opts || {});
    };
  });
}
// Builder button + banner
(function ccDiffInit() {
  const row = document.getElementById('tag-skills-btn');
  if (row && !document.getElementById('cc-diff-btn')) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn'; b.id = 'cc-diff-btn';
    b.style.cssText = 'margin-left:8px; background:#f5f3ff; border-color:#ddd6fe; color:#5b21b6;';
    b.title = 'Check the easy / medium / difficult mix against this week’s level';
    b.textContent = '⚖ Difficulty check';
    row.insertAdjacentElement('afterend', b);
    b.onclick = () => { if (!questions.length) { alert('Add some questions first.'); return; } ccOpenDiffCheck({}); };
    const banner = document.createElement('div'); banner.id = 'cc-diff-banner';
    const panel = document.getElementById('builder-questions-panel');
    const qs = document.getElementById('questions');
    if (panel && qs) panel.insertBefore(banner, qs);
  }
  if (els.scheduledDate) els.scheduledDate.addEventListener('change', ccDiffBanner);
  const nb = document.getElementById('new-btn');
  document.addEventListener('click', (e) => { if (e.target && e.target.closest && e.target.closest('[data-edit], #new-btn, .cc-edit-btn')) setTimeout(ccDiffBanner, 400); });
  const bv = document.getElementById('builder-view');
  if (bv && window.MutationObserver) new MutationObserver(() => { if (bv.style.display !== 'none') ccDiffBanner(); }).observe(bv, { attributes: true, attributeFilter: ['style'] });
})();
// Automatic check when the teacher saves
(function ccDiffSaveGate() {
  if (!els.saveBtn || els.saveBtn._ccDiffWrapped) return;
  const original = els.saveBtn.onclick;
  if (typeof original !== 'function') return;
  els.saveBtn._ccDiffWrapped = true;
  els.saveBtn.onclick = async (ev) => {
    if (window._ccDiffSkip || !questions || questions.length < 3) return original.call(els.saveBtn, ev);
    els.saveStatus.textContent = 'Checking the difficulty mix…';
    await ccOpenDiffCheck({ gate: true, onSave: () => { window._ccDiffSkip = true; Promise.resolve(original.call(els.saveBtn, ev)).finally(() => { window._ccDiffSkip = false; }); } });
    if (els.saveStatus.textContent === 'Checking the difficulty mix…') els.saveStatus.textContent = '';
  };
})();
// AI panel: assessment date → weekly level used for generation
async function ccAiWeekInfo() {
  const inp = document.getElementById('ai-week-date'), info = document.getElementById('ai-week-info');
  if (!inp || !info) return;
  if (!inp.value) inp.value = new Date().toISOString().slice(0, 10);
  try {
    const r = await api('/api/difficulty/plan?date=' + encodeURIComponent(inp.value));
    info.innerHTML = `⚖ ${escapeHtml(r.target.label)} → the AI will write about <strong>${r.target.pct.easy}%</strong> easy · <strong>${r.target.pct.medium}%</strong> medium · <strong>${r.target.pct.hard}%</strong> difficult.`;
  } catch (e) { info.textContent = ''; }
}
document.addEventListener('change', (e) => { if (e.target && e.target.id === 'ai-week-date') ccAiWeekInfo(); });
document.addEventListener('click', (e) => { if (e.target && e.target.closest && e.target.closest('#new-btn')) setTimeout(ccAiWeekInfo, 100); });
