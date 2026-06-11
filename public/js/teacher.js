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
            </div>
            <div class="muted">${meta}</div>
          </div>
        </div>
        <div class="card-actions" style="display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; margin-top: 10px;">
          ${a.published ? `<button class="btn primary" data-act="share" data-id="${a.id}" title="Copy the link your students will use to take this assessment">🔗 Share with students</button>` : ''}
          <button class="btn" data-act="results" data-id="${a.id}">Results</button>
          <button class="btn" data-act="print" data-id="${a.id}" title="Print or save as PDF">📄 PDF</button>
          <button class="btn" data-act="share-teacher" data-id="${a.id}" title="Copy a link another teacher can use to preview, print, or duplicate this assessment">🤝 Share with teacher</button>
          <button class="btn" data-act="preview" data-id="${a.id}" title="See the assessment exactly as a student would">👁 Preview</button>
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
      // Multipart standard: same field name repeated for each file. Multer
      // collects them as req.files = [...] on the server.
      for (const f of fileList) fd.append('schemeOfWork', f);

      const res = await fetch('/api/assessments/ai-generate', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
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
        })),
      };
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
    root.querySelector('[data-f=points]').oninput = (e) => { q.points = Number(e.target.value) || 1; };
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
        <button class="btn primary" data-act="img-upload">📎 Upload image</button>
        <button class="btn ghost" data-act="img-skip" style="margin-left: 6px;">Skip — text only</button>
        <input type="file" accept="image/*" data-img-file style="display: none;" />
      </div>
    `;
  } else {
    imageSection = `
      <div class="field">
        <button class="btn ghost" data-act="img-upload">🖼 Add image (optional)</button>
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
      ${imageSection}
      ${body}
    </div>
  `;
}

// Compress + base64-encode an uploaded image so it can live inline in the
// assessment JSON. Caps at 800px wide and ~70% JPEG quality which keeps each
// image well under 250KB.
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
          <td>${r.autoScore}/${r.autoMax}</td>
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

  mountBody.innerHTML = `
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
async function printAssessmentPDF(assessmentId) {
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
  const questions = a.questions || [];

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
  let body = `<h1>${escapeHtml(a.title)}</h1>
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
  body += `<div class="pagebreak"></div><h2>Answer Key</h2><div class="key">${questions.map((q, i) => correctLine(q, i)).join('')}</div>`;

  const fullHtml = `<!DOCTYPE html><html><head><title>${escapeHtml(a.title)}</title>${css}</head><body>${body}</body></html>`;

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
    setTimeout(() => {
      try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) {}
    }, 300);
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
      close();
      if (fmt === 'pdf') return printAssessmentPDF(assessmentId);
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
    document.querySelectorAll('[data-q-id]').forEach((row) => {
      const id = row.getAttribute('data-q-id');
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
          <a href="/docs/ClassCurio_Teacher_Guide.docx" download class="btn" style="background: rgba(255,255,255,0.18); color:#fff; border:1px solid rgba(255,255,255,0.4); margin-right: 6px;">📥 Word</a>
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
      document.body.classList.add('cc-list-only');
    }
  }
  // Run on load + periodically + on visibilitychange.
  setTimeout(check, 50);
  setInterval(check, 500);
  document.addEventListener('visibilitychange', check);
})();


// ── Admin: 📅 Date-range user export modal ─────────────────────────────────
function showDateRangeExportModal() {
  if (document.getElementById('cc-range-overlay')) return;
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 10);
  const overlay = document.createElement('div');
  overlay.id = 'cc-range-overlay';
  overlay.style.cssText = 'position:fixed; inset:0; background:rgba(11,16,32,0.55); z-index:2147483646; display:flex; align-items:center; justify-content:center; padding: 24px;';
  overlay.innerHTML = '<div style="background:#fff; border-radius:12px; padding:24px 28px; max-width: 480px; width: 92%; box-shadow:0 16px 48px rgba(0,0,0,0.30);">' +
    '<h2 style="margin: 0 0 6px; color:#1a1e33;">📅 Export users by date range</h2>' +
    '<p class="muted" style="margin: 0 0 16px; font-size: 14px;">Download a CSV of teachers + students whose account was created between these dates (inclusive).</p>' +
    '<div class="row" style="gap: 12px; align-items: center; margin-bottom: 12px;">' +
      '<label style="flex:1;">' +
        '<div style="font-size:13px; font-weight:600; color:#1a1e33; margin-bottom:4px;">From</div>' +
        '<input type="date" id="cc-range-from" value="' + fmt(thirtyDaysAgo) + '" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px;" />' +
      '</label>' +
      '<label style="flex:1;">' +
        '<div style="font-size:13px; font-weight:600; color:#1a1e33; margin-bottom:4px;">To</div>' +
        '<input type="date" id="cc-range-to" value="' + fmt(today) + '" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px;" />' +
      '</label>' +
    '</div>' +
    '<div class="row" style="gap:6px; flex-wrap:wrap; margin-bottom: 14px;">' +
      '<button class="btn" data-preset="7"   style="padding:4px 10px; font-size:12px;">Last 7 days</button>' +
      '<button class="btn" data-preset="30"  style="padding:4px 10px; font-size:12px;">Last 30 days</button>' +
      '<button class="btn" data-preset="90"  style="padding:4px 10px; font-size:12px;">Last 90 days</button>' +
      '<button class="btn" data-preset="365" style="padding:4px 10px; font-size:12px;">Last 365 days</button>' +
      '<button class="btn" data-preset="all" style="padding:4px 10px; font-size:12px;">All time</button>' +
    '</div>' +
    '<div class="row" style="gap:10px; justify-content:flex-end;">' +
      '<button class="btn" id="cc-range-close">Cancel</button>' +
      '<button class="btn primary" id="cc-range-download">📥 Download CSV</button>' +
    '</div>' +
  '</div>';
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  document.getElementById('cc-range-close').onclick = close;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelectorAll('[data-preset]').forEach((b) => {
    b.onclick = () => {
      const v = b.getAttribute('data-preset');
      if (v === 'all') {
        document.getElementById('cc-range-from').value = '';
        document.getElementById('cc-range-to').value = '';
      } else {
        const days = Number(v);
        const fromD = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
        document.getElementById('cc-range-from').value = fmt(fromD);
        document.getElementById('cc-range-to').value   = fmt(today);
      }
    };
  });
  document.getElementById('cc-range-download').onclick = () => {
    const fr = document.getElementById('cc-range-from').value;
    const to = document.getElementById('cc-range-to').value;
    const qs = new URLSearchParams();
    if (fr) qs.set('from', fr);
    if (to) qs.set('to', to);
    window.location.href = '/api/admin/users-export' + (qs.toString() ? ('?' + qs.toString()) : '');
    close();
  };
}

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
  const chip = (label, fid, active) => '<button class="btn" data-folder-chip="' + (fid || '') + '" style="margin:3px; ' + (active ? 'background:#4338ca; color:#fff; border-color:#4338ca;' : '') + '">' + label + ' <span style="font-size:11px; opacity:.7;">(' + countIn(fid) + ')</span></button>';
  host.innerHTML = '<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;"><strong style="margin-right:6px;">📁 Folders:</strong>' +
    chip('All', null, _ccActiveFolderId === null) +
    mine.map((f) => {
      const label = f.name + (f.year ? ' · ' + f.year : '') + (f.term ? ' · ' + f.term : '');
      return '<span style="display:inline-flex; align-items:center;">' + chip(label, f.id, _ccActiveFolderId === f.id) +
        '<span style="margin-left:4px;"><button class="btn" data-folder-rename="' + f.id + '" title="Rename" style="padding:2px 6px; font-size:11px;">✎</button>' +
        '<button class="btn danger" data-folder-del="' + f.id + '" title="Delete" style="padding:2px 6px; font-size:11px;">✕</button></span></span>';
    }).join('') +
    '<span style="flex:1;"></span><button class="btn primary" id="cc-folder-new" style="background:#4338ca;">+ New folder</button></div>';
  host.querySelectorAll('[data-folder-chip]').forEach((b) => {
    b.onclick = () => {
      const v = b.getAttribute('data-folder-chip');
      _ccActiveFolderId = v === '' ? null : v;
      _ccRenderFolderBar();
      if (typeof render === 'function') render();
    };
  });
  host.querySelectorAll('[data-folder-rename]').forEach((b) => {
    b.onclick = async (e) => {
      e.stopPropagation();
      const f = mine.find((x) => x.id === b.getAttribute('data-folder-rename'));
      if (!f) return;
      const nn = prompt('Rename folder:', f.name);
      if (!nn || !nn.trim()) return;
      await fetch('/api/folders/' + f.id, { method: 'PUT', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: nn.trim() }) });
      _ccFoldersCache = null;
      await _ccRenderFolderBar();
    };
  });
  host.querySelectorAll('[data-folder-del]').forEach((b) => {
    b.onclick = async (e) => {
      e.stopPropagation();
      const f = mine.find((x) => x.id === b.getAttribute('data-folder-del'));
      if (!f) return;
      if (!confirm('Delete folder "' + f.name + '"? Assessments inside will move back to "All".')) return;
      await fetch('/api/folders/' + f.id, { method: 'DELETE', credentials: 'include' });
      _ccFoldersCache = null;
      if (_ccActiveFolderId === f.id) _ccActiveFolderId = null;
      await _ccRenderFolderBar();
      if (typeof render === 'function') render();
    };
  });
  const newBtn = document.getElementById('cc-folder-new');
  if (newBtn) newBtn.onclick = async () => {
    const name = prompt('New folder name (e.g. Reading, Writing, Old papers):');
    if (!name || !name.trim()) return;
    const year = prompt('Year (optional, e.g. 2025-2026):') || '';
    const term = prompt('Term (optional, e.g. Term 1):') || '';
    try {
      const r = await fetch('/api/folders', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ classId: activeClass, name: name.trim(), year: year.trim(), term: term.trim() }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Failed');
      _ccFoldersCache = null;
      await _ccRenderFolderBar();
    } catch (e) { alert('Could not create: ' + e.message); }
  };
}

function _ccFilterByFolder(list) {
  if (_ccActiveFolderId === null) return list;
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

