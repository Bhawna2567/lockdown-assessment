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



// ───────────────────────────────────────────────────────────────────────────
//  EXPORT CHOOSER — let the teacher pick PDF or Word
// ───────────────────────────────────────────────────────────────────────────
function showExportChooser(assessmentId) {
  // Build a small modal overlay.
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
      <p style="margin: 0 0 16px; color:#475569; font-size: 14px;">Choose the format you'd like. Both include the questions and a separate answer-key page.</p>
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

function downloadAssessmentDocx(assessmentId) {
  // Just navigate the browser to the download endpoint — the server sets
  // Content-Disposition: attachment so the browser saves the file directly.
  const url = `/api/assessments/${assessmentId}/export.docx`;
  // Use a temporary anchor to trigger the download with the right filename.
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { if (a.parentNode) a.parentNode.removeChild(a); }, 1000);
}

// ───────────────────────────────────────────────────────────────────────────
//  SHARE WITH TEACHER — proper inline panel (no more alert dialog)
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
  // Auto-copy in the background (best effort).
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
  const bodyText = enc(`I'm sharing a ClassCurio assessment with you. Open this link while logged in to ClassCurio, and you'll be able to preview, print, or duplicate it into your own class:\n\n${url}\n\n— Sent from ClassCurio`);
  overlay.innerHTML = `
    <div style="background:#fff; border-radius:12px; padding:24px 28px; max-width: 560px; width: 92%; box-shadow: 0 16px 48px rgba(0,0,0,0.30);">
      <h2 style="margin: 0 0 6px; color:#1a1e33;">🤝 Share with another teacher</h2>
      <p style="margin: 0 0 14px; color:#475569; font-size: 14px;">
        Send this link to any other ClassCurio teacher. When they open it while signed in to their own account, they'll be able to preview the assessment, download it as PDF or Word, or duplicate it into one of their own classes.
      </p>
      <div style="display:flex; gap:8px; margin-bottom: 12px;">
        <input id="share-teacher-url" type="text" readonly value="${escapeAttr(url)}" style="flex:1; font-size: 13px; padding: 10px 12px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:8px; color:#1a1e33;" />
        <button class="btn primary" id="share-teacher-copy">Copy</button>
      </div>
      <div class="row" style="gap: 8px; flex-wrap: wrap; margin-bottom: 6px;">
        <a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text=${enc(`Sharing a ClassCurio assessment: ${url}`)}" style="background:#25d366; color:#fff; border-color:#25d366;">💬 WhatsApp</a>
        <a class="btn" target="_blank" rel="noopener" href="mailto:?subject=${subject}&body=${bodyText}" style="background:#3b82f6; color:#fff; border-color:#3b82f6;">✉ Email</a>
        <a class="btn" target="_blank" rel="noopener" href="https://teams.microsoft.com/share?msgText=${enc(`ClassCurio assessment to duplicate: ${url}`)}" style="background:#4b53bc; color:#fff; border-color:#4b53bc;">Teams</a>
        <div class="spacer"></div>
        <button class="btn ghost" id="share-teacher-close">Close</button>
      </div>
      <div id="share-teacher-status" class="muted" style="font-size: 12px; color:#166534;">Link already copied to your clipboard.</div>
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
      document.getElementById('share-teacher-status').textContent = '✓ Copied again.';
    } catch {
      document.execCommand && document.execCommand('copy');
    }
  };
  // Auto-select the URL so even on browsers without Clipboard API the
  // teacher can immediately Cmd+C.
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

