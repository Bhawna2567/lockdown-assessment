// Lockdown Assessment — Express backend
// Serves the web UI and provides REST endpoints for auth, assessments, and results.
const fs = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const SESSION_DIR = require('path').join(__dirname, '..', 'data', 'sessions');
require('fs').mkdirSync(SESSION_DIR, { recursive: true });



const bcrypt = require('bcryptjs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const ExcelJS = require('exceljs');

const { readAll, writeAll } = require('./store');
const { importFile, extractText, extractMediaImages } = require('./importer');
const { gradeWriting, readApiKey } = require('./grader');
const reports = require('./reports');
const { Packer } = require('docx');

// Uploads go to a tmp dir; we delete after parsing.
const UPLOAD_DIR = path.join(__dirname, '..', 'data', 'uploads');
const PROCTOR_DIR = path.join(__dirname, '..', 'data', 'proctor');
// Listening-assessment audio lives on the persistent disk so it survives
// every Render restart. One file per assessment, keyed by id.<ext>.
const AUDIO_DIR = path.join(__dirname, '..', 'data', 'audio');
for (const d of [UPLOAD_DIR, PROCTOR_DIR, AUDIO_DIR]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}
const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});
// Larger ceiling for listening audio (50 MB ≈ 50 minutes of 128 kbps mp3).
const audioUpload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['audio/mpeg','audio/mp3','audio/mp4','audio/x-m4a','audio/m4a',
                'audio/wav','audio/x-wav','audio/ogg','audio/aac','audio/webm'];
    if (ok.includes(file.mimetype) || /\.(mp3|m4a|wav|ogg|aac|webm)$/i.test(file.originalname)) {
      cb(null, true);
    } else cb(new Error('Unsupported audio format'));
  },
});

const PORT = process.env.PORT || 3000;
const app = express();

// Larger limit to accept base64-encoded webcam JPEGs.
app.use(bodyParser.json({ limit: '15mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change-me-in-production',
    // FileStore persists sessions to /data/sessions/ on the Render disk so
    // they survive every restart, deploy, and idle timeout. Without this,
    // every Render restart wipes the default in-memory store and kicks
    // every active student out with a 401 "Not authenticated".
    store: new FileStore({
      path: SESSION_DIR,
      ttl: 60 * 60 * 12,            // seconds; 12 hours
      retries: 1,
      logFn: () => {},               // suppress the chatty "session not found" messages
    }),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 12 },
  })
);


// ───────────────────────────────────────────────────────────────────────────
//  Rescale every AI-graded essay to a universal /40 scale.
// ───────────────────────────────────────────────────────────────────────────
// Idempotent — only touches entries where maxScore !== 40. Walks every
// result, every manualGrades entry tagged aiGrade:true, multiplies score
// by (40 / oldMax), updates maxScore to 40. Also rescales per-criterion
// breakdown if present. Returns the count of entries touched.
function rescaleEssaysTo40() {
  const results = readAll('results.json');
  let touched = 0;
  const TARGET = 40;
  for (const r of results) {
    if (!r.manualGrades) continue;
    for (const [, g] of Object.entries(r.manualGrades)) {
      if (!g || !g.aiGrade) continue;
      const oldMax = Number(g.maxScore) || 0;
      if (oldMax === TARGET || oldMax <= 0) continue;
      const oldScore = Number(g.score) || 0;
      const factor = TARGET / oldMax;
      g.score = Math.round(oldScore * factor * 10) / 10;
      g.maxScore = TARGET;
      if (g.breakdown && typeof g.breakdown === 'object') {
        for (const c of Object.keys(g.breakdown)) {
          const b = g.breakdown[c];
          if (!b) continue;
          if (typeof b.score === 'number') b.score = Math.round(b.score * factor * 10) / 10;
          if (typeof b.max   === 'number') b.max   = Math.round(b.max   * factor * 10) / 10;
        }
      }
      g.rescaledTo40At = new Date().toISOString();
      touched++;
    }
  }
  if (touched > 0) writeAll('results.json', results);
  return touched;
}
// Run on startup too (no flag — function is idempotent, safe to re-run).
try {
  const n = rescaleEssaysTo40();
  console.log(`[migration] startup rescale: ${n} essay(s) updated to /40.`);
} catch (e) {
  console.error('[migration] startup rescale error:', e.message);
}

// ---------- Auth helpers ----------
function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}
function requireTeacher(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.session.user.role !== 'teacher') return res.status(403).json({ error: 'Teachers only' });
  next();
}
function requireStudent(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.session.user.role !== 'student') return res.status(403).json({ error: 'Students only' });
  next();
}

// ---------- Auth routes ----------
app.post('/api/register', async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  if (!['teacher', 'student'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  const users = readAll('users.json');
  if (users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ error: 'Email already registered' });
  }
  const hash = await bcrypt.hash(password, 10);
  const user = {
    id: uuidv4(),
    name,
    email,
    role,
    passwordHash: hash,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  writeAll('users.json', users);
  req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
  res.json({ user: req.session.user });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  const users = readAll('users.json');
  const user = users.find((u) => u.email.toLowerCase() === (email || '').toLowerCase());
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password || '', user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
  res.json({ user: req.session.user });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
  if (!req.session.user) return res.json({ user: null });
  // Look up the freshest version of the user — important so the
  // mustChangePassword flag updates as soon as the student rotates their
  // password (otherwise the session would still report the stale flag).
  const users = readAll('users.json');
  const u = users.find((x) => x.id === req.session.user.id);
  if (!u) return res.json({ user: null });
  res.json({
    user: {
      id: u.id, name: u.name, email: u.email, role: u.role,
      studentNumber: u.studentNumber || '',
      mustChangePassword: !!u.mustChangePassword,
    },
  });
});

// ---------- Classes ----------
// Classes are lightweight teacher-side organizational units. Each assessment
// belongs to one class. Students don't see classes directly — they only see
// the assessments they've already submitted, accessed via teacher-shared
// share links.
//
// Migration: on first /api/classes call for a teacher with zero classes, we
// create a 'Default Class' and assign all of their existing assessments
// (those without a classId) to it.
function ensureDefaultClass(teacherId) {
  const classes = readAll('classes.json');
  const mine = classes.filter((c) => c.teacherId === teacherId);
  if (mine.length > 0) return mine;

  const defaultClass = {
    id: uuidv4(),
    teacherId,
    name: 'Default Class',
    roster: [],
    createdAt: new Date().toISOString(),
  };
  classes.push(defaultClass);
  writeAll('classes.json', classes);

  // Assign all existing classless assessments to this default class.
  const assessments = readAll('assessments.json');
  let touched = false;
  for (const a of assessments) {
    if (a.teacherId === teacherId && !a.classId) {
      a.classId = defaultClass.id;
      touched = true;
    }
  }
  if (touched) writeAll('assessments.json', assessments);

  return [defaultClass];
}

// Self-serve password reset. The requester types their email; if it
// matches a real user we generate a fresh temp password, hash it, and
// return the plaintext to the caller for them to use (same model as
// pre-register). Email infrastructure isn't required.
app.post('/api/auth/forgot-password', async (req, res) => {
  const email = String(req.body && req.body.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  const users = readAll('users.json');
  const idx = users.findIndex((u) => String(u.email || '').toLowerCase() === email);
  if (idx === -1) {
    // Don't leak whether the email exists — but DO tell the caller the
    // reset has been "sent" so they don't keep trying.
    return res.json({
      ok: true,
      sent: false,
      message: 'If an account exists for that email, a reset has been issued. Contact your school admin if you cannot sign in.',
    });
  }
  try {
    const tempPassword = generateTempPassword(10);
    users[idx].passwordHash = await bcrypt.hash(tempPassword, 10);
    users[idx].mustChangePassword = true;
    users[idx].passwordResetAt = new Date().toISOString();
    writeAll('users.json', users);
    return res.json({
      ok: true,
      sent: true,
      tempPassword,
      email: users[idx].email,
      name: users[idx].name,
      role: users[idx].role,
    });
  } catch (e) {
    return res.status(500).json({ error: 'Reset failed: ' + e.message });
  }
});

app.get('/api/classes', requireTeacher, (req, res) => {
  const list = ensureDefaultClass(req.session.user.id);
  res.json(list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')));
});

app.post('/api/classes', requireTeacher, (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 60);
  if (!name) return res.status(400).json({ error: 'Name required' });
  const all = readAll('classes.json');
  const newClass = {
    id: uuidv4(),
    teacherId: req.session.user.id,
    name,
    roster: [],
    createdAt: new Date().toISOString(),
  };
  all.push(newClass);
  writeAll('classes.json', all);
  res.json({ class: newClass });
});

// Replace the roster for a class. Body: { roster: [{email, name}] }.
// Roster is informational — it's a list of expected students. The share link
// is still the actual access control for assessments. When a registered
// student's email matches a roster entry, the teacher can see that student
// associated with this class on the dashboard.
app.post('/api/classes/:id/roster', requireTeacher, (req, res) => {
  const all = readAll('classes.json');
  const idx = all.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  if (all[idx].teacherId !== req.session.user.id) return res.status(403).json({ error: 'Forbidden' });

  const incoming = Array.isArray(req.body?.roster) ? req.body.roster : [];
  // Normalize + dedupe. Accept entries with email-only, name-only, or both.
  // Email-keyed dedup if email present, otherwise name-keyed.
  const seenEmails = new Set();
  const seenNames = new Set();
  const roster = [];
  for (const item of incoming) {
    const email = String(item?.email || '').trim().toLowerCase();
    const name = String(item?.name || '').trim().slice(0, 120);
    const validEmail = email && email.includes('@');
    if (!validEmail && !name) continue; // need at least one
    if (validEmail) {
      if (seenEmails.has(email)) continue;
      seenEmails.add(email);
    } else {
      const k = name.toLowerCase();
      if (seenNames.has(k)) continue;
      seenNames.add(k);
    }
    roster.push({ email: validEmail ? email : '', name });
    if (roster.length >= 1000) break; // safety cap
  }

  all[idx] = { ...all[idx], roster };
  writeAll('classes.json', all);
  res.json({ class: all[idx], count: roster.length });
});

// ----- Pre-register students with temporary passwords -----
// Teacher uploads a roster (CSV/PDF/Word OR raw JSON array) of
// {name, email, studentNumber}. Server creates student accounts (skipping
// any email that already has one), generates a temporary password for each
// new account, and updates the class's roster. Returns the list with
// per-row status + tempPassword for the teacher to share with students.
//
// Each new account is flagged mustChangePassword=true. On the student's
// first sign-in they're forced to set a password of their own choice.
function generateTempPassword(len = 10) {
  // Avoid ambiguous chars (0/O, 1/l/I). Mix upper + lower + digits.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

app.post('/api/classes/:id/pre-register', requireTeacher, upload.single('file'), async (req, res) => {
  const classes = readAll('classes.json');
  const idx = classes.findIndex((c) => c.id === req.params.id);
  if (idx === -1) {
    if (req.file) { try { fs.unlinkSync(req.file.path); } catch {} }
    return res.status(404).json({ error: 'Class not found' });
  }
  if (classes[idx].teacherId !== req.session.user.id) {
    if (req.file) { try { fs.unlinkSync(req.file.path); } catch {} }
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Get the roster — either from a JSON body or by parsing the uploaded file.
  let inputRoster = [];
  if (Array.isArray(req.body?.roster)) {
    inputRoster = req.body.roster;
  } else if (req.file) {
    try {
      const text = await extractText(req.file.path, req.file.mimetype, req.file.originalname);
      try { fs.unlinkSync(req.file.path); } catch {}
      inputRoster = extractRosterFromText(text);
    } catch (e) {
      try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(400).json({ error: 'Could not read file: ' + e.message });
    }
  } else {
    return res.status(400).json({ error: 'Provide a file or a JSON roster array.' });
  }

  // Expect {name, email, studentNumber}. Tolerate missing studentNumber.
  const users = readAll('users.json');
  const usersByEmail = new Map(users.map((u) => [String(u.email || '').toLowerCase(), u]));

  // Build a set of every email currently on ANY of this teacher's class
  // rosters. An existing student whose email is NOT in that set is "orphaned"
  // — they were probably pre-registered into a class the teacher later
  // deleted (before the cascade-cleanup was wired up). We self-heal those by
  // regenerating their temp password, so the teacher can start afresh just by
  // re-running pre-registration.
  const teacherClassEmails = new Set();
  for (const c of classes) {
    if (c.teacherId !== req.session.user.id) continue;
    for (const r of (c.roster || [])) {
      const em = String(r && r.email || '').trim().toLowerCase();
      if (em) teacherClassEmails.add(em);
    }
  }

  const results = [];
  const rosterForClass = [];

  for (const item of inputRoster) {
    const email = String(item.email || '').trim().toLowerCase();
    const name = String(item.name || '').trim().slice(0, 120);
    const studentNumber = String(item.studentNumber || item.student_number || item['student number'] || '').trim().slice(0, 40);
    if (!email || !email.includes('@')) {
      results.push({ email, name, studentNumber, status: 'skipped', reason: 'invalid email' });
      continue;
    }

    if (usersByEmail.has(email)) {
      const u = usersByEmail.get(email);
      // Optionally backfill studentNumber if missing.
      if (studentNumber && !u.studentNumber) {
        u.studentNumber = studentNumber;
      }
      // If the existing account is still pending (the student has never
      // signed in and the previous temp password was lost), generate a
      // FRESH temp password and rewrite the hash. This is safe because
      // mustChangePassword=true means the student hasn't chosen their own
      // password yet. We never reset passwords for students who already
      // logged in and picked their own password — that would be a security
      // hole, UNLESS the account is orphaned (not on any of this teacher's
      // class rosters), in which case the teacher effectively "owns" the
      // reset because they're the one re-pre-registering the student.
      //
      // Force-reset (forceReset=1 in the body) overrides the safety check
      // and resets EVERY existing account in the upload. Use carefully.
      const forceReset = req.body && (req.body.forceReset === '1' || req.body.forceReset === true);
      const isOrphaned = !teacherClassEmails.has(email);
      if (u.mustChangePassword === true || forceReset || isOrphaned) {
        try {
          const tempPassword = generateTempPassword(10);
          u.passwordHash = await bcrypt.hash(tempPassword, 10);
          u.mustChangePassword = true;
          u.passwordResetAt = new Date().toISOString();
          rosterForClass.push({ email, name: u.name || name, studentNumber: u.studentNumber || studentNumber });
          results.push({
            email, name: u.name || name,
            studentNumber: u.studentNumber || studentNumber,
            status: 'reset', tempPassword,
            note: forceReset
              ? 'force-reset'
              : isOrphaned
                ? 'orphaned account re-enrolled'
                : 'first-login still pending',
          });
        } catch (e) {
          results.push({ email, name, studentNumber, status: 'failed', reason: e.message });
        }
      } else {
        // Student already logged in and chose their own password — leave
        // it alone. Teacher can still see they're in the class.
        rosterForClass.push({ email, name: u.name || name, studentNumber: u.studentNumber || studentNumber });
        results.push({
          email, name: u.name || name,
          studentNumber: u.studentNumber || studentNumber,
          status: 'existed',
          note: 'student already chose their own password',
        });
      }
      continue;
    }

    // Generate a temp password and create the account.
    const tempPassword = generateTempPassword(10);
    try {
      const hash = await bcrypt.hash(tempPassword, 10);
      const u = {
        id: uuidv4(),
        name,
        email,
        role: 'student',
        studentNumber: studentNumber || '',
        passwordHash: hash,
        mustChangePassword: true,
        preRegisteredBy: req.session.user.id,
        createdAt: new Date().toISOString(),
      };
      users.push(u);
      usersByEmail.set(email, u);
      rosterForClass.push({ email, name, studentNumber });
      results.push({ email, name, studentNumber, status: 'created', tempPassword });
    } catch (e) {
      results.push({ email, name, studentNumber, status: 'failed', reason: e.message });
    }
  }

  writeAll('users.json', users);

  // Merge the new entries into the class roster (de-dupe by lowercase email).
  const seen = new Set((classes[idx].roster || []).map((r) => String(r.email || '').toLowerCase()).filter(Boolean));
  const mergedRoster = (classes[idx].roster || []).slice();
  for (const r of rosterForClass) {
    if (!seen.has(r.email)) {
      mergedRoster.push(r);
      seen.add(r.email);
    }
  }
  classes[idx].roster = mergedRoster;
  writeAll('classes.json', classes);

  const created = results.filter((r) => r.status === 'created').length;
  const reset   = results.filter((r) => r.status === 'reset').length;
  const existed = results.filter((r) => r.status === 'existed').length;
  const skipped = results.filter((r) => r.status === 'skipped' || r.status === 'failed').length;
  res.json({ ok: true, results, summary: { created, reset, existed, skipped, total: results.length } });
});

// ----- Change password -----
// Used by:
//   (a) any signed-in user who wants to rotate their password
//   (b) pre-registered students forced to set their own password on first login
app.post('/api/auth/change-password', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not signed in' });
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required.' });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }
  const users = readAll('users.json');
  const idx = users.findIndex((u) => u.id === req.session.user.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  const ok = await bcrypt.compare(currentPassword, users[idx].passwordHash);
  if (!ok) return res.status(401).json({ error: 'Current password is incorrect.' });
  users[idx].passwordHash = await bcrypt.hash(newPassword, 10);
  users[idx].mustChangePassword = false;
  users[idx].passwordChangedAt = new Date().toISOString();
  writeAll('users.json', users);
  res.json({ ok: true });
});

// Parse a class roster file (CSV / TXT / PDF / DOCX) and return the extracted
// {email, name} pairs WITHOUT saving. The frontend then shows the preview and
// asks the teacher to confirm before calling POST /api/classes/:id/roster.
//
// Heuristic: extract every email-looking token, then try to associate each
// with the nearest preceding non-email word(s) on the same line (or just
// before) as the student's name. Works for: CSVs (with or without header),
// PDFs of class lists, Word docs of student rosters.
app.post('/api/classes/parse-roster', requireTeacher, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const text = await extractText(req.file.path, req.file.mimetype, req.file.originalname);
    try { fs.unlinkSync(req.file.path); } catch {}

    const roster = extractRosterFromText(text);
    if (!roster.length) {
      return res.status(422).json({
        error: 'Could not detect any students in this file. Make sure each student is on its own line — emails are optional, just names is fine.',
      });
    }
    res.json({ roster });
  } catch (e) {
    try { fs.unlinkSync(req.file.path); } catch {}
    res.status(500).json({ error: e.message });
  }
});

// Extract {email, name} pairs from arbitrary text. Robust against:
//   - CSV (email,name or name,email, with or without header)
//   - PDF/DOCX class lists with one row per student (name + email, or just names)
//   - Plain lists of just emails (one per line)
//   - Plain lists of just names (one per line) — emails are optional
function extractRosterFromText(rawText) {
  const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const seenEmails = new Set();
  const seenNames = new Set();
  const roster = [];

  // First pass: lines with emails. Capture the email + the nearest name on
  // the same line.
  let foundAnyEmail = false;
  for (const line of lines) {
    const emails = line.match(EMAIL_RE) || [];
    if (!emails.length) continue;
    foundAnyEmail = true;

    let nameCandidate = line;
    for (const e of emails) nameCandidate = nameCandidate.replace(e, ' ');
    nameCandidate = cleanNameFragment(nameCandidate);

    for (const e of emails) {
      const email = e.toLowerCase();
      if (seenEmails.has(email)) continue;
      seenEmails.add(email);
      const name = nameCandidate && nameCandidate.length <= 120 ? nameCandidate : '';
      if (name) seenNames.add(name.toLowerCase());
      roster.push({ email, name });
      nameCandidate = '';
      if (roster.length >= 1000) break;
    }
    if (roster.length >= 1000) break;
  }

  // Second pass: if NO emails were found at all in the document, treat each
  // non-empty line as a candidate student name. This is the common case for
  // teacher-uploaded class lists from school systems that only export names.
  if (!foundAnyEmail) {
    for (const rawLine of lines) {
      const cleaned = cleanNameFragment(rawLine);
      if (!isPlausibleName(cleaned)) continue;
      const k = cleaned.toLowerCase();
      if (seenNames.has(k)) continue;
      seenNames.add(k);
      roster.push({ email: '', name: cleaned });
      if (roster.length >= 1000) break;
    }
  }

  return roster;
}

// Strip leading numbering, common separators, and column-header words. Also
// trim to a reasonable length cap.
function cleanNameFragment(s) {
  let out = String(s || '');
  // Leading list markers: "1.", "1)", "•", "-", "*", roman numerals.
  out = out.replace(/^\s*(?:\d{1,3}[\.\)]|[•\-\*]|[ivxlcdm]{1,5}[\.\)])\s+/i, '');
  // Tabs / pipes / semicolons / commas → spaces.
  out = out.replace(/[,;|\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  // Remove trailing column noise like "  F  Grade 7" / "  M  12-A".
  out = out.replace(/\s+(?:[FM]|Male|Female|Grade\s*\d+|Year\s*\d+|Class\s*\d+|\d{1,2}[A-Z]?)$/i, '').trim();
  // Drop pure header rows.
  if (/^(name|student name|full name|student|first name|last name|class roster|roster|grade\s*\d+|year\s*\d+|class\s*\d+)$/i.test(out)) {
    return '';
  }
  return out.slice(0, 120);
}

// Is this a plausible person name? Reject obvious junk: empty, all-digits,
// dates, single character, very long lines, page numbers, etc.
function isPlausibleName(s) {
  if (!s || s.length < 2 || s.length > 80) return false;
  if (!/[A-Za-zÀ-ɏЀ-ӿ֐-׿؀-ۿऀ-ॿ一-鿿぀-ヿ]/.test(s)) {
    // No letter characters at all (digits, punctuation, etc.)
    return false;
  }
  // Reject lines that are mostly digits.
  const digits = (s.match(/\d/g) || []).length;
  if (digits > s.length / 2) return false;
  // Reject phrases that look like dates / page numbers.
  if (/^(page|p\.?)\s*\d/i.test(s)) return false;
  if (/^\d{4}[\-\/]\d{1,2}[\-\/]\d{1,2}/.test(s)) return false;
  return true;
}

app.put('/api/classes/:id', requireTeacher, (req, res) => {
  const all = readAll('classes.json');
  const idx = all.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  if (all[idx].teacherId !== req.session.user.id) return res.status(403).json({ error: 'Forbidden' });
  const name = String(req.body?.name || '').trim().slice(0, 60);
  if (!name) return res.status(400).json({ error: 'Name required' });
  all[idx] = { ...all[idx], name };
  writeAll('classes.json', all);
  res.json({ class: all[idx] });
});

app.delete('/api/classes/:id', requireTeacher, (req, res) => {
  const all = readAll('classes.json');
  const idx = all.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  if (all[idx].teacherId !== req.session.user.id) return res.status(403).json({ error: 'Forbidden' });

  // Refuse deletion if any assessments still reference this class.
  const assessments = readAll('assessments.json');
  const inUse = assessments.some((a) => a.classId === req.params.id);
  if (inUse) {
    return res.status(409).json({
      error: 'This class still contains assessments. Move or delete them first, then delete the class.',
    });
  }

  // Capture the deleted class's roster before mutating the array, so we can
  // cascade-clean up student accounts that were only members of THIS class.
  const deletedClass = all[idx];
  const deletedEmails = new Set(
    (deletedClass.roster || [])
      .map((r) => String(r && r.email || '').trim().toLowerCase())
      .filter(Boolean)
  );

  all.splice(idx, 1);
  writeAll('classes.json', all);

  // CASCADE CLEANUP — after a class is gone, any pre-registered student whose
  // email no longer appears on any remaining class roster (anywhere in the
  // system, across all teachers) is orphaned. Remove their user account so
  // re-pre-registering them in a new class starts them afresh (status="created"
  // with a brand-new temp password) instead of falling into the "existed" path.
  let removedUsers = 0;
  let removedResults = 0;
  if (deletedEmails.size > 0) {
    const stillReferenced = new Set();
    for (const c of all) {
      for (const r of (c.roster || [])) {
        const em = String(r && r.email || '').trim().toLowerCase();
        if (em) stillReferenced.add(em);
      }
    }
    const orphanedEmails = [...deletedEmails].filter((em) => !stillReferenced.has(em));
    if (orphanedEmails.length > 0) {
      const orphanedSet = new Set(orphanedEmails);
      const users = readAll('users.json');
      const orphanedUserIds = new Set();
      const remainingUsers = [];
      for (const u of users) {
        const em = String(u.email || '').toLowerCase();
        // Only remove student accounts that were on the deleted class's roster.
        // Teacher accounts and self-signup students (not in any roster) are
        // left alone.
        if (u.role === 'student' && orphanedSet.has(em)) {
          orphanedUserIds.add(u.id);
          removedUsers++;
        } else {
          remainingUsers.push(u);
        }
      }
      if (orphanedUserIds.size > 0) {
        writeAll('users.json', remainingUsers);
        const results = readAll('results.json');
        const keptResults = results.filter((r) => !orphanedUserIds.has(r.studentId));
        removedResults = results.length - keptResults.length;
        if (removedResults > 0) writeAll('results.json', keptResults);
      }
    }
  }

  res.json({ ok: true, removedUsers, removedResults });
});

// Delete a single student account. A teacher can only delete a student who
// is on one of THEIR class rosters — they cannot reach into another
// teacher's class to wipe accounts. After deletion the email is free, so the
// teacher can immediately re-add the student via the +Add student form and a
// fresh temporary password will be generated.
app.delete('/api/students/:userId', requireTeacher, (req, res) => {
  const targetId = String(req.params.userId || '');
  if (!targetId) return res.status(400).json({ error: 'Missing user id' });

  const users = readAll('users.json');
  const target = users.find((u) => u.id === targetId);
  if (!target || target.role !== 'student') {
    return res.status(404).json({ error: 'Student not found' });
  }
  const targetEmail = String(target.email || '').toLowerCase();

  // Security gate: the student must be on at least one roster belonging to
  // THIS teacher. Otherwise refuse, even if the email exists.
  const classes = readAll('classes.json');
  const teacherOwnsThem = classes.some((c) =>
    c.teacherId === req.session.user.id &&
    (c.roster || []).some((r) => String(r && r.email || '').toLowerCase() === targetEmail)
  );
  if (!teacherOwnsThem) {
    return res.status(403).json({ error: 'You cannot delete a student who is not on one of your classes.' });
  }

  // Remove the student from every class roster anywhere in the system (once
  // their account is gone, leaving them on rosters is misleading).
  let rostersTouched = 0;
  for (const c of classes) {
    const before = (c.roster || []).length;
    c.roster = (c.roster || []).filter((r) =>
      String(r && r.email || '').toLowerCase() !== targetEmail
    );
    if (c.roster.length !== before) rostersTouched++;
  }
  if (rostersTouched > 0) writeAll('classes.json', classes);

  // Remove the user record.
  const keptUsers = users.filter((u) => u.id !== targetId);
  writeAll('users.json', keptUsers);

  // Remove the student's submitted results so their grades don't linger.
  const results = readAll('results.json');
  const keptResults = results.filter((r) => r.studentId !== targetId);
  const removedResults = results.length - keptResults.length;
  if (removedResults > 0) writeAll('results.json', keptResults);

  res.json({
    ok: true,
    removedEmail: targetEmail,
    rostersTouched,
    removedResults,
  });
});

// ---------- Assessments (teacher) ----------
app.get('/api/assessments', requireAuth, (req, res) => {
  const all = readAll('assessments.json');
  if (req.session.user.role === 'teacher') {
    // Make sure they have at least one class (migrates legacy data on first
    // load post-deploy).
    ensureDefaultClass(req.session.user.id);
    // Teachers see only their own.
    return res.json(all.filter((a) => a.teacherId === req.session.user.id));
  }
  // Students see ONLY assessments they have already submitted. Everything
  // else (discovery, browsing, lists of available assessments) is intentionally
  // removed — students start new assessments only via teacher-shared links.
  const results = readAll('results.json');
  const studentResults = results.filter((r) => r.studentId === req.session.user.id);
  const submittedIds = new Set(studentResults.map((r) => r.assessmentId));
  const visible = all
    .filter((a) => submittedIds.has(a.id))
    .map((a) => {
      const result = studentResults.find((r) => r.assessmentId === a.id);
      return {
        id: a.id,
        title: a.title,
        description: a.description,
        subject: a.subject || null,
        assessmentLanguage: a.assessmentLanguage || null,
        durationMinutes: a.durationMinutes,
        questionCount: a.questions.length,
        teacherName: a.teacherName,
        submittedAt: result ? result.submittedAt : null,
        resultId: result ? result.id : null,
      };
    })
    .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
  res.json(visible);
});

function normalizeTerm(t) {
  return t === '1' || t === '2' || t === '3' ? t : null;
}
function normalizeGrade(g) {
  const n = parseInt(g, 10);
  return n >= 1 && n <= 12 ? String(n) : null;
}

// Allowed subject values. Free-text 'Other' is allowed too — anything not in
// this list gets stored as 'Other'.
const SUBJECTS = new Set([
  'Math', 'Physics', 'Chemistry', 'Biology',
  'Health Science', 'Islamic Studies', 'Social Studies',
  'Arabic', 'French', 'English', 'Listening',
  'IELTS', 'PISA', 'TOEFL',
  'Other',
]);
function normalizeSubject(s) {
  if (!s) return null;
  const v = String(s).trim();
  return SUBJECTS.has(v) ? v : (v ? 'Other' : null);
}
function normalizeAssessmentLanguage(l) {
  if (!l) return null;
  const v = String(l).trim().slice(0, 60);
  return v || null;
}

// 'onsite' (in school, teacher supervises) → no camera required.
// 'online' (anywhere else) → mandatory webcam proctoring.
// Default to 'online' for safety: missing field = treat as remote exam.
function normalizeDeliveryMode(m) {
  const v = String(m || '').trim().toLowerCase();
  return v === 'onsite' ? 'onsite' : 'online';
}

// Sections group questions into parts (Section A, B, C…) with their own
// reading passages, instructions, and titles. Each section gets a stable
// id so questions can reference it. Returns { sections, byId } so callers
// can validate that question.sectionId points at a real section.
function normalizeSections(incoming) {
  const sections = Array.isArray(incoming) ? incoming : [];
  const byId = new Map();
  const out = [];
  let order = 0;
  for (const s of sections) {
    if (!s || typeof s !== 'object') continue;
    const id = s.id && typeof s.id === 'string' ? s.id : uuidv4();
    const title = String(s.title || '').slice(0, 200);
    const instructions = String(s.instructions || '').slice(0, 4000);
    const passage = String(s.passage || '').slice(0, 12000);
    const sec = { id, title, instructions, passage, order: order++ };
    out.push(sec);
    byId.set(id, sec);
  }
  return { sections: out, byId };
}

// Allowed question types. 'tfng' = True / False / Not Given (IELTS-style).
// 'long' = long-answer text (manually graded). Anything else is rejected.
const QUESTION_TYPES = new Set(['mc', 'tf', 'tfng', 'short', 'long', 'essay', 'writing', 'match']);
function normalizeQuestionType(t) {
  return QUESTION_TYPES.has(t) ? t : 'short';
}


// Match-the-following normaliser.
function normalizeMatchVariant(v) {
  const s = String(v || '').toLowerCase();
  if (s === 'word-word' || s === 'word-picture') return s;
  return 'word-definition';
}
function normalizeMatchPairs(pairs) {
  if (!Array.isArray(pairs)) return [];
  return pairs.slice(0, 30).map((p) => ({
    left:           String((p && p.left)  || '').slice(0, 500),
    right:          String((p && p.right) || '').slice(0, 800),
    rightImageUrl: (p && typeof p.rightImageUrl === 'string' && p.rightImageUrl.length < 1500000)
      ? p.rightImageUrl : '',
  })).filter((p) => p.left.trim() || p.right.trim() || p.rightImageUrl);
}

// Normalize a tfng correctAnswer into one of 'true' | 'false' | 'ng'.
function normalizeTfngAnswer(v) {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'true' || s === 't') return 'true';
  if (s === 'false' || s === 'f') return 'false';
  if (s === 'ng' || s === 'notgiven' || s === 'not given') return 'ng';
  return 'true';
}

app.post('/api/assessments', requireTeacher, (req, res) => {
  const {
    title, description, durationMinutes, questions, published,
    passage, rubricStage, term, academicYear, scheduledDate, grade,
    subject, assessmentLanguage, classId, deliveryMode, sections,
    audioScript, audioVoice, audioVoices,
  } = req.body || {};
  if (!title || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'Title and at least one question required' });
  }
  // Resolve class: must be a class belonging to this teacher; if not provided
  // or invalid, fall back to the teacher's first class (creating it if needed).
  const teacherClasses = ensureDefaultClass(req.session.user.id);
  const resolvedClassId = teacherClasses.find((c) => c.id === classId)
    ? classId
    : teacherClasses[0].id;

  const sectionNorm = normalizeSections(sections);

  const assessment = {
    id: uuidv4(),
    teacherId: req.session.user.id,
    teacherName: req.session.user.name,
    classId: resolvedClassId,
    deliveryMode: normalizeDeliveryMode(deliveryMode),
    subject: normalizeSubject(subject),
    assessmentLanguage: normalizeAssessmentLanguage(assessmentLanguage),
    sections: sectionNorm.sections,
    title: String(title),
    description: String(description || ''),
    passage: String(passage || ''),
    rubricStage: rubricStage === '8' ? '8' : (rubricStage === '7' ? '7' : null),
    term: normalizeTerm(term),
    grade: normalizeGrade(grade),
    academicYear: academicYear ? String(academicYear).slice(0, 20) : null,
    scheduledDate: scheduledDate ? String(scheduledDate).slice(0, 10) : null,
    durationMinutes: Number(durationMinutes) || 30,
    published: Boolean(published),
    audioFile: null,
    audioScript: audioScript ? String(audioScript).slice(0, 12000) : '',
    audioVoice:  audioVoice  ? String(audioVoice).slice(0, 200)  : '',
    audioVoices: (audioVoices && typeof audioVoices === 'object') ? audioVoices : {},
    questions: questions.map((q, i) => {
      const type = normalizeQuestionType(q.type);
      // Validate sectionId: must reference a real section on this assessment.
      // If not, leave blank — front-end will show the question in the default
      // "no section" group.
      const sectionId = q.sectionId && sectionNorm.byId.has(q.sectionId)
        ? q.sectionId : '';
      const out = {
        id: q.id || uuidv4(),
        order: i,
        sectionId,
        type, // 'mc' | 'tf' | 'tfng' | 'short' | 'long' | 'essay' | 'writing'
        prompt: q.prompt,
        options: q.options || [], // for mc
        correctAnswer: null,
        points: Number(q.points) || 1,
        imageUrl: typeof q.imageUrl === 'string' && q.imageUrl.length < 1500000 ? q.imageUrl : '',
        imageDescription: typeof q.imageDescription === 'string' ? String(q.imageDescription).slice(0, 500) : '',
      };
      if (type === 'mc') out.correctAnswer = q.correctAnswer ?? 0;
      else if (type === 'tf') out.correctAnswer = q.correctAnswer === true;
      else if (type === 'tfng') out.correctAnswer = normalizeTfngAnswer(q.correctAnswer);
      else if (type === 'short') out.correctAnswer = q.correctAnswer ?? null;
      else if (type === 'match') {
        out.matchVariant = normalizeMatchVariant(q.matchVariant);
        out.pairs        = normalizeMatchPairs(q.pairs);
      }
      return out;
    }),
    createdAt: new Date().toISOString(),
  };
  const all = readAll('assessments.json');
  all.push(assessment);
  writeAll('assessments.json', all);
  res.json({ assessment });
});

// Duplicate an assessment for a new batch of students. Copies all the
// content (title, description, questions, passage, rubric) but resets:
// - assessment ID (new UUID, so submissions go to the new copy)
// - question IDs (so grades don't bleed across copies)
// - published flag (starts as draft)
// - term / academicYear / scheduledDate (teacher fills these in)
app.post('/api/assessments/:id/duplicate', requireTeacher, (req, res) => {
  const all = readAll('assessments.json');
  const orig = all.find((a) => a.id === req.params.id);
  if (!orig) return res.status(404).json({ error: 'Not found' });
  if (orig.teacherId !== req.session.user.id) return res.status(403).json({ error: 'Forbidden' });

  const copy = {
    ...orig,
    id: uuidv4(),
    title: `Copy of ${orig.title}`,
    published: false,
    term: null,
    academicYear: null,
    scheduledDate: null,
    questions: (orig.questions || []).map((q, i) => ({
      ...q,
      id: uuidv4(),
      order: i,
    })),
    createdAt: new Date().toISOString(),
    updatedAt: undefined,
  };
  delete copy.updatedAt;

  all.push(copy);
  writeAll('assessments.json', all);
  res.json({ assessment: copy });
});

app.put('/api/assessments/:id', requireTeacher, (req, res) => {
  const all = readAll('assessments.json');
  const idx = all.findIndex((a) => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  if (all[idx].teacherId !== req.session.user.id) return res.status(403).json({ error: 'Forbidden' });
  const {
    title, description, durationMinutes, questions, published,
    passage, rubricStage, term, academicYear, scheduledDate, grade,
    subject, assessmentLanguage, classId, deliveryMode, sections,
    audioScript, audioVoice, audioVoices,
  } = req.body || {};
  // Validate classId if provided: must belong to this teacher.
  let nextClassId = all[idx].classId;
  if (classId !== undefined && classId !== null) {
    const teacherClasses = readAll('classes.json').filter((c) => c.teacherId === req.session.user.id);
    if (teacherClasses.some((c) => c.id === classId)) {
      nextClassId = classId;
    }
  }
  // If sections are sent in the PUT body, replace them. Otherwise keep the
  // existing ones — backwards-compat for clients that pre-date this field.
  const newSectionNorm = sections === undefined
    ? normalizeSections(all[idx].sections || [])
    : normalizeSections(sections);

  const updated = {
    ...all[idx],
    classId: nextClassId,
    deliveryMode: deliveryMode === undefined
      ? (all[idx].deliveryMode || 'online')
      : normalizeDeliveryMode(deliveryMode),
    sections: newSectionNorm.sections,
    subject: subject === undefined ? (all[idx].subject ?? null) : normalizeSubject(subject),
    assessmentLanguage: assessmentLanguage === undefined
      ? (all[idx].assessmentLanguage ?? null)
      : normalizeAssessmentLanguage(assessmentLanguage),
    title: title ?? all[idx].title,
    description: description ?? all[idx].description,
    passage: passage ?? all[idx].passage ?? '',
    rubricStage:
      rubricStage === '8' ? '8' :
      rubricStage === '7' ? '7' :
      rubricStage === null || rubricStage === '' ? null :
      (all[idx].rubricStage ?? null),
    term: term === undefined ? (all[idx].term ?? null) : normalizeTerm(term),
    grade: grade === undefined ? (all[idx].grade ?? null) : normalizeGrade(grade),
    academicYear: academicYear === undefined
      ? (all[idx].academicYear ?? null)
      : (academicYear ? String(academicYear).slice(0, 20) : null),
    scheduledDate: scheduledDate === undefined
      ? (all[idx].scheduledDate ?? null)
      : (scheduledDate ? String(scheduledDate).slice(0, 10) : null),
    durationMinutes: durationMinutes ?? all[idx].durationMinutes,
    published: published ?? all[idx].published,
    audioFile: all[idx].audioFile || null,
    audioScript: audioScript === undefined
      ? (all[idx].audioScript || '')
      : (audioScript ? String(audioScript).slice(0, 12000) : ''),
    audioVoice: audioVoice === undefined
      ? (all[idx].audioVoice || '')
      : (audioVoice ? String(audioVoice).slice(0, 200) : ''),
    audioVoices: audioVoices === undefined
      ? (all[idx].audioVoices || {})
      : (audioVoices && typeof audioVoices === 'object' ? audioVoices : {}),
    questions: Array.isArray(questions)
      ? questions.map((q, i) => {
          const type = normalizeQuestionType(q.type);
          const sectionId = q.sectionId && newSectionNorm.byId.has(q.sectionId)
            ? q.sectionId : '';
          const out = {
            id: q.id || uuidv4(),
            order: i,
            sectionId,
            type,
            prompt: q.prompt,
            options: q.options || [],
            correctAnswer: null,
            points: Number(q.points) || 1,
            imageUrl: typeof q.imageUrl === 'string' && q.imageUrl.length < 1500000 ? q.imageUrl : '',
            imageDescription: typeof q.imageDescription === 'string' ? String(q.imageDescription).slice(0, 500) : '',
          };
          if (type === 'mc') out.correctAnswer = q.correctAnswer ?? 0;
          else if (type === 'tf') out.correctAnswer = q.correctAnswer === true;
          else if (type === 'tfng') out.correctAnswer = normalizeTfngAnswer(q.correctAnswer);
          else if (type === 'short') out.correctAnswer = q.correctAnswer ?? null;
          else if (type === 'match') {
            out.matchVariant = normalizeMatchVariant(q.matchVariant);
            out.pairs        = normalizeMatchPairs(q.pairs);
          }
          return out;
        })
      : all[idx].questions,
    updatedAt: new Date().toISOString(),
  };
  all[idx] = updated;
  writeAll('assessments.json', all);
  res.json({ assessment: updated });
});

app.delete('/api/assessments/:id', requireTeacher, (req, res) => {
  const all = readAll('assessments.json');
  const idx = all.findIndex((a) => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  if (all[idx].teacherId !== req.session.user.id) return res.status(403).json({ error: 'Forbidden' });
  all.splice(idx, 1);
  writeAll('assessments.json', all);
  res.json({ ok: true });
});

// Grant a one-time re-entry to a student who got locked out (3 violations
// or any auto-submit). Only the teacher who owns the assessment can grant.
// Idempotent: if a previous grant exists and hasn't been used yet, re-grant
// just stamps a fresh grantedAt timestamp.
app.post('/api/assessments/:id/grant-reentry', requireTeacher, (req, res) => {
  const studentId = String(req.body && req.body.studentId || '');
  if (!studentId) return res.status(400).json({ error: 'Missing studentId' });
  const all = readAll('assessments.json');
  const a = all.find((x) => x.id === req.params.id);
  if (!a) return res.status(404).json({ error: 'Assessment not found' });
  if (a.teacherId !== req.session.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  // Verify the student exists.
  const users = readAll('users.json');
  const student = users.find((u) => u.id === studentId && u.role === 'student');
  if (!student) return res.status(404).json({ error: 'Student not found' });

  if (!Array.isArray(a.reentryGrants)) a.reentryGrants = [];
  // If an unused grant already exists, just refresh its timestamp.
  const existing = a.reentryGrants.find((g) => g.studentId === studentId && !g.usedAt);
  if (existing) {
    existing.grantedAt = new Date().toISOString();
  } else {
    a.reentryGrants.push({
      studentId,
      grantedAt: new Date().toISOString(),
      grantedBy: req.session.user.id,
    });
  }
  writeAll('assessments.json', all);
  res.json({
    ok: true,
    grantedTo: { id: student.id, name: student.name, email: student.email },
  });
});

// Reconcile a class roster against existing submissions. Walks every
// assessment in this class, looks at who submitted, and adds any student
// not already on the roster. Returns the list of added students so the
// teacher sees what changed. Teacher-only and scoped to their own class.
app.post('/api/classes/:id/reconcile-roster', requireTeacher, (req, res) => {
  const classes = readAll('classes.json');
  const cIdx = classes.findIndex((c) => c.id === req.params.id);
  if (cIdx === -1) return res.status(404).json({ error: 'Class not found' });
  if (classes[cIdx].teacherId !== req.session.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const assessments = readAll('assessments.json');
  const classAssessmentIds = new Set(
    assessments.filter((a) => a.classId === req.params.id).map((a) => a.id)
  );
  if (classAssessmentIds.size === 0) {
    return res.json({ ok: true, added: [], note: 'No assessments in this class yet.' });
  }

  const results = readAll('results.json');
  const users = readAll('users.json');
  const usersById = new Map(users.map((u) => [u.id, u]));

  const roster = Array.isArray(classes[cIdx].roster) ? classes[cIdx].roster : [];
  const haveEmails = new Set(
    roster.map((r) => String(r && r.email || '').toLowerCase()).filter(Boolean)
  );

  const seen = new Set();
  const added = [];
  for (const r of results) {
    if (!classAssessmentIds.has(r.assessmentId)) continue;
    if (seen.has(r.studentId)) continue;
    seen.add(r.studentId);
    const u = usersById.get(r.studentId);
    if (!u || u.role !== 'student') continue;
    const em = String(u.email || '').toLowerCase();
    if (!em || haveEmails.has(em)) continue;
    roster.push({
      email: em,
      name: u.name || em.split('@')[0],
      studentNumber: u.studentNumber || '',
      addedFrom: 'reconcile',
      addedAt: new Date().toISOString(),
    });
    haveEmails.add(em);
    added.push({ email: em, name: u.name || '', studentNumber: u.studentNumber || '' });
  }

  if (added.length > 0) {
    classes[cIdx].roster = roster;
    writeAll('classes.json', classes);
  }
  res.json({ ok: true, added, total: roster.length });
});

// Edit a roster row in place. The :email URL parameter is the CURRENT
// email of the roster row (URL-encoded). The body can supply newEmail,
// name, studentNumber to change any of them. We also update the matching
// user account so the student can still log in with the corrected email.
app.put('/api/classes/:id/roster/:email', requireTeacher, async (req, res) => {
  const classes = readAll('classes.json');
  const cIdx = classes.findIndex((c) => c.id === req.params.id);
  if (cIdx === -1) return res.status(404).json({ error: 'Class not found' });
  if (classes[cIdx].teacherId !== req.session.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const oldEmail = String(req.params.email || '').toLowerCase();
  const roster = Array.isArray(classes[cIdx].roster) ? classes[cIdx].roster : [];
  const rIdx = roster.findIndex((r) =>
    String(r && r.email || '').toLowerCase() === oldEmail
  );
  if (rIdx === -1) return res.status(404).json({ error: 'Student not found on roster' });

  const incoming = req.body || {};
  const newEmail = incoming.newEmail !== undefined
    ? String(incoming.newEmail || '').trim().toLowerCase()
    : oldEmail;
  const newName = incoming.name !== undefined
    ? String(incoming.name || '').trim().slice(0, 120)
    : (roster[rIdx].name || '');
  const newStudentNumber = incoming.studentNumber !== undefined
    ? String(incoming.studentNumber || '').trim().slice(0, 40)
    : (roster[rIdx].studentNumber || '');

  if (!newEmail || !newEmail.includes('@')) {
    return res.status(400).json({ error: 'Email must be a valid address.' });
  }

  // Email-change conflict checks.
  if (newEmail !== oldEmail) {
    // Conflict within this class roster.
    const dupOnRoster = roster.some((r, i) =>
      i !== rIdx && String(r && r.email || '').toLowerCase() === newEmail
    );
    if (dupOnRoster) {
      return res.status(409).json({ error: 'Another student in this class is already using that email.' });
    }
    // Conflict against other users in the system.
    const users = readAll('users.json');
    const dupOnUsers = users.some((u) =>
      String(u.email || '').toLowerCase() === newEmail
    );
    if (dupOnUsers) {
      return res.status(409).json({ error: 'A different account already uses that email. Pick another address or delete the other account first.' });
    }
  }

  // Apply the roster change.
  roster[rIdx].email = newEmail;
  roster[rIdx].name = newName;
  roster[rIdx].studentNumber = newStudentNumber;
  classes[cIdx].roster = roster;
  writeAll('classes.json', classes);

  // Mirror the change onto the user account (if one exists at the OLD
  // email). This keeps their login working.
  const users = readAll('users.json');
  const uIdx = users.findIndex((u) =>
    String(u.email || '').toLowerCase() === oldEmail && u.role === 'student'
  );
  let userTouched = false;
  if (uIdx !== -1) {
    users[uIdx].email = newEmail;
    if (newName) users[uIdx].name = newName;
    if (newStudentNumber !== undefined) users[uIdx].studentNumber = newStudentNumber;
    writeAll('users.json', users);
    userTouched = true;
  }

  // Mirror the email change on any OTHER class rosters that referenced the
  // old email — students can sit on multiple class rosters (in theory).
  if (newEmail !== oldEmail) {
    let touchedAny = false;
    for (const c of classes) {
      if (c.id === req.params.id) continue;
      for (const r of (c.roster || [])) {
        if (String(r && r.email || '').toLowerCase() === oldEmail) {
          r.email = newEmail;
          if (newName) r.name = newName;
          touchedAny = true;
        }
      }
    }
    if (touchedAny) writeAll('classes.json', classes);
  }

  res.json({
    ok: true,
    row: roster[rIdx],
    userAccountUpdated: userTouched,
  });
});

// Move OR copy a student between two classes owned by the teacher.
// mode: 'move' removes the source row after adding to target;
// mode: 'copy' leaves the source row in place.
app.post('/api/classes/:fromId/roster/:email/transfer', requireTeacher, (req, res) => {
  const fromId = req.params.fromId;
  const oldEmail = String(req.params.email || '').toLowerCase();
  const targetId = String(req.body && req.body.targetClassId || '');
  const mode = String(req.body && req.body.mode || 'move').toLowerCase();
  if (!targetId) return res.status(400).json({ error: 'Missing targetClassId' });
  if (mode !== 'move' && mode !== 'copy') {
    return res.status(400).json({ error: 'mode must be "move" or "copy"' });
  }
  if (fromId === targetId) {
    return res.status(400).json({ error: 'Source and target classes are the same.' });
  }

  const classes = readAll('classes.json');
  const srcIdx = classes.findIndex((c) => c.id === fromId);
  const dstIdx = classes.findIndex((c) => c.id === targetId);
  if (srcIdx === -1 || dstIdx === -1) {
    return res.status(404).json({ error: 'Class not found.' });
  }
  if (classes[srcIdx].teacherId !== req.session.user.id ||
      classes[dstIdx].teacherId !== req.session.user.id) {
    return res.status(403).json({ error: 'You can only move students between your own classes.' });
  }

  const srcRoster = Array.isArray(classes[srcIdx].roster) ? classes[srcIdx].roster : [];
  const rIdx = srcRoster.findIndex((r) =>
    String(r && r.email || '').toLowerCase() === oldEmail
  );
  if (rIdx === -1) {
    return res.status(404).json({ error: 'Student not found on the source class roster.' });
  }
  const studentRow = srcRoster[rIdx];

  const dstRoster = Array.isArray(classes[dstIdx].roster) ? classes[dstIdx].roster : [];
  const alreadyInTarget = dstRoster.some((r) =>
    String(r && r.email || '').toLowerCase() === oldEmail
  );

  // Add to target if missing.
  if (!alreadyInTarget) {
    dstRoster.push({
      email: studentRow.email,
      name: studentRow.name,
      studentNumber: studentRow.studentNumber,
      addedFrom: mode === 'move' ? 'moved' : 'copied',
      addedAt: new Date().toISOString(),
    });
    classes[dstIdx].roster = dstRoster;
  }

  // For move: drop from source.
  let removedFromSource = false;
  if (mode === 'move') {
    srcRoster.splice(rIdx, 1);
    classes[srcIdx].roster = srcRoster;
    removedFromSource = true;
  }

  writeAll('classes.json', classes);
  res.json({
    ok: true,
    mode,
    addedToTarget: !alreadyInTarget,
    alreadyInTarget,
    removedFromSource,
    targetRosterCount: dstRoster.length,
  });
});

// BULK delete students from a class. Each email goes through the same
// safety check as the single-row delete (teacher must own the source class
// and the student must be on the roster). Returns per-email outcomes.
app.post('/api/classes/:id/bulk-delete', requireTeacher, (req, res) => {
  const classes = readAll('classes.json');
  const cIdx = classes.findIndex((c) => c.id === req.params.id);
  if (cIdx === -1) return res.status(404).json({ error: 'Class not found' });
  if (classes[cIdx].teacherId !== req.session.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const emails = Array.isArray(req.body && req.body.emails) ? req.body.emails : [];
  if (emails.length === 0) return res.status(400).json({ error: 'No emails provided' });

  const wanted = new Set(emails.map((e) => String(e || '').toLowerCase()));
  const users = readAll('users.json');
  const results_arr = readAll('results.json');

  const removedUserIds = new Set();
  const outcomes = [];
  // Keep users that are NOT on the wanted list OR that belong to other rosters
  // we don't want to disturb.
  for (const u of users) {
    const em = String(u.email || '').toLowerCase();
    if (u.role === 'student' && wanted.has(em)) {
      removedUserIds.add(u.id);
      outcomes.push({ email: em, status: 'deleted' });
    }
  }

  // Remove from THIS class roster.
  let rosterTouched = 0;
  const before = (classes[cIdx].roster || []).length;
  classes[cIdx].roster = (classes[cIdx].roster || []).filter((r) =>
    !wanted.has(String(r && r.email || '').toLowerCase())
  );
  rosterTouched = before - classes[cIdx].roster.length;
  writeAll('classes.json', classes);

  // Drop the user accounts + their results.
  if (removedUserIds.size > 0) {
    const keptUsers = users.filter((u) => !removedUserIds.has(u.id));
    writeAll('users.json', keptUsers);
    const keptResults = results_arr.filter((r) => !removedUserIds.has(r.studentId));
    if (keptResults.length !== results_arr.length) {
      writeAll('results.json', keptResults);
    }
    // Also strip these emails from every OTHER class roster across the system.
    for (const c of classes) {
      c.roster = (c.roster || []).filter((r) =>
        !wanted.has(String(r && r.email || '').toLowerCase())
      );
    }
    writeAll('classes.json', classes);
  }

  res.json({
    ok: true,
    removedUsers: removedUserIds.size,
    rosterRowsRemoved: rosterTouched,
    outcomes,
  });
});

// BULK move/copy students to another class owned by the same teacher.
app.post('/api/classes/:fromId/bulk-transfer', requireTeacher, (req, res) => {
  const fromId = req.params.fromId;
  const targetId = String(req.body && req.body.targetClassId || '');
  const mode = String(req.body && req.body.mode || 'move').toLowerCase();
  const emails = Array.isArray(req.body && req.body.emails) ? req.body.emails : [];
  if (!targetId) return res.status(400).json({ error: 'Missing targetClassId' });
  if (mode !== 'move' && mode !== 'copy') {
    return res.status(400).json({ error: 'mode must be "move" or "copy"' });
  }
  if (fromId === targetId) {
    return res.status(400).json({ error: 'Source and target classes are the same.' });
  }
  if (emails.length === 0) return res.status(400).json({ error: 'No emails provided' });

  const classes = readAll('classes.json');
  const srcIdx = classes.findIndex((c) => c.id === fromId);
  const dstIdx = classes.findIndex((c) => c.id === targetId);
  if (srcIdx === -1 || dstIdx === -1) return res.status(404).json({ error: 'Class not found' });
  if (classes[srcIdx].teacherId !== req.session.user.id ||
      classes[dstIdx].teacherId !== req.session.user.id) {
    return res.status(403).json({ error: 'You can only move students between your own classes.' });
  }

  const wanted = new Set(emails.map((e) => String(e || '').toLowerCase()));
  const srcRoster = Array.isArray(classes[srcIdx].roster) ? classes[srcIdx].roster : [];
  const dstRoster = Array.isArray(classes[dstIdx].roster) ? classes[dstIdx].roster : [];
  const dstEmails = new Set(dstRoster.map((r) => String(r && r.email || '').toLowerCase()));

  const outcomes = [];
  const toMove = srcRoster.filter((r) =>
    wanted.has(String(r && r.email || '').toLowerCase())
  );
  for (const row of toMove) {
    const em = String(row.email || '').toLowerCase();
    const already = dstEmails.has(em);
    if (!already) {
      dstRoster.push({
        email: row.email,
        name: row.name,
        studentNumber: row.studentNumber,
        addedFrom: mode === 'move' ? 'bulk-moved' : 'bulk-copied',
        addedAt: new Date().toISOString(),
      });
      dstEmails.add(em);
    }
    outcomes.push({ email: em, addedToTarget: !already, alreadyInTarget: already });
  }
  classes[dstIdx].roster = dstRoster;

  if (mode === 'move') {
    classes[srcIdx].roster = srcRoster.filter((r) =>
      !wanted.has(String(r && r.email || '').toLowerCase())
    );
  }
  writeAll('classes.json', classes);
  res.json({
    ok: true,
    mode,
    processed: toMove.length,
    outcomes,
    targetRosterCount: dstRoster.length,
  });
});

// Class analytics — aggregate every submitted result for one class and
// return a compact summary the dashboard can render directly. Teacher-only,
// scoped to their own class.
app.get('/api/classes/:id/analytics', requireTeacher, (req, res) => {
  const classes = readAll('classes.json');
  const c = classes.find((x) => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'Class not found' });
  if (c.teacherId !== req.session.user.id) return res.status(403).json({ error: 'Forbidden' });

  const assessments = readAll('assessments.json');
  const myAssessments = assessments.filter((a) => a.classId === c.id);
  const myAssessmentIds = new Set(myAssessments.map((a) => a.id));

  const results = readAll('results.json').filter((r) => myAssessmentIds.has(r.assessmentId));
  const users = readAll('users.json');
  const usersById = new Map(users.map((u) => [u.id, u]));

  // CEFR 6-band split (Cambridge / IELTS-aligned).
  function cefr(pct) {
    if (pct >= 90) return 'C2';
    if (pct >= 75) return 'C1';
    if (pct >= 60) return 'B2';
    if (pct >= 45) return 'B1';
    if (pct >= 30) return 'A2';
    return 'A1';
  }
  // Achievement band: A1-A2 low, B1-B2 medium, C1-C2 high.
  function band(level) {
    if (level === 'C1' || level === 'C2') return 'High';
    if (level === 'B1' || level === 'B2') return 'Medium';
    return 'Low';
  }

  // Roll up per-student averages across all assessments in this class.
  const perStudent = new Map(); // studentId -> { name, email, total, max, count, perSection: {sid: {score, max}} }
  for (const r of results) {
    const total = (r.autoScore || 0) + (r.manualScore || 0);
    const max = (r.autoMax || 0) + (r.manualMax || 0);
    const u = usersById.get(r.studentId);
    let s = perStudent.get(r.studentId);
    if (!s) {
      s = {
        studentId: r.studentId,
        name: u ? u.name : (r.studentName || 'Unknown'),
        email: u ? u.email : (r.studentEmail || ''),
        total: 0, max: 0, count: 0,
        perSection: {},
      };
      perStudent.set(r.studentId, s);
    }
    s.total += total;
    s.max += max;
    s.count += 1;

    // Per-section roll-up — match each answer back to its question's section.
    const a = myAssessments.find((x) => x.id === r.assessmentId);
    if (!a) continue;
    const sectionsById = new Map((a.sections || []).map((sec) => [sec.id, sec]));
    for (const ans of (r.answers || [])) {
      const q = (a.questions || []).find((qq) => qq.id === ans.questionId);
      if (!q) continue;
      const sec = sectionsById.get(q.sectionId);
      const sectionName = (sec && sec.title) ? sec.title : 'General';
      if (!s.perSection[sectionName]) s.perSection[sectionName] = { score: 0, max: 0 };
      // Auto-gradable types: rely on ans.correct boolean. Essay/long etc.
      // count against teacher-graded only — for analytics we add them in
      // proportionally so sections with manual grading aren't ignored.
      const points = Number(q.points) || 1;
      s.perSection[sectionName].max += points;
      if (ans.correct === true) {
        s.perSection[sectionName].score += points;
      } else if (ans.correct == null && r.manualGrades && r.manualGrades[q.id]) {
        // Manual or AI graded. Use the recorded score.
        const mg = r.manualGrades[q.id];
        s.perSection[sectionName].score += Number(mg.score || 0);
      }
    }
  }

  const studentList = [];
  const sectionTotals = {}; // sectionName -> { score, max }
  for (const s of perStudent.values()) {
    const pct = s.max > 0 ? Math.round((s.total / s.max) * 100) : 0;
    const level = cefr(pct);
    studentList.push({
      studentId: s.studentId,
      name: s.name,
      email: s.email,
      pct,
      total: s.total,
      max: s.max,
      submissions: s.count,
      cefrLevel: level,
      band: band(level),
      perSection: s.perSection,
    });
    for (const [name, v] of Object.entries(s.perSection)) {
      if (!sectionTotals[name]) sectionTotals[name] = { score: 0, max: 0 };
      sectionTotals[name].score += v.score;
      sectionTotals[name].max += v.max;
    }
  }
  studentList.sort((a, b) => b.pct - a.pct);

  // Class-level CEFR histogram.
  const cefrHistogram = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 };
  for (const s of studentList) cefrHistogram[s.cefrLevel]++;
  const bands = { Low: 0, Medium: 0, High: 0 };
  for (const s of studentList) bands[s.band]++;

  // Per-skill averages.
  const skills = Object.entries(sectionTotals).map(([name, v]) => ({
    name,
    avgPct: v.max > 0 ? Math.round((v.score / v.max) * 100) : 0,
    score: v.score,
    max: v.max,
  })).sort((a, b) => b.avgPct - a.avgPct);

  // Overall class average pct.
  const totalAll = studentList.reduce((a, s) => a + s.total, 0);
  const maxAll = studentList.reduce((a, s) => a + s.max, 0);
  const classAvgPct = maxAll > 0 ? Math.round((totalAll / maxAll) * 100) : 0;

  res.json({
    ok: true,
    class: { id: c.id, name: c.name, rosterCount: (c.roster || []).length },
    assessmentCount: myAssessments.length,
    submissionCount: results.length,
    classAvgPct,
    cefrHistogram,
    bands,
    skills,
    students: studentList,
  });
});

// Cross-class analytics — averages for every class this teacher owns.
app.get('/api/analytics/cross-class', requireTeacher, (req, res) => {
  const classes = readAll('classes.json').filter((c) => c.teacherId === req.session.user.id);
  const assessments = readAll('assessments.json');
  const results = readAll('results.json');
  const items = classes.map((c) => {
    const ids = new Set(assessments.filter((a) => a.classId === c.id).map((a) => a.id));
    const cls = results.filter((r) => ids.has(r.assessmentId));
    const total = cls.reduce((a, r) => a + (r.autoScore || 0) + (r.manualScore || 0), 0);
    const max = cls.reduce((a, r) => a + (r.autoMax || 0) + (r.manualMax || 0), 0);
    return {
      classId: c.id,
      name: c.name,
      rosterCount: (c.roster || []).length,
      submissionCount: cls.length,
      avgPct: max > 0 ? Math.round((total / max) * 100) : 0,
    };
  }).sort((a, b) => b.avgPct - a.avgPct);
  res.json({ ok: true, classes: items });
});

// Generate a share token for an assessment so another teacher can open it
// from a link and either print or duplicate it. Idempotent — same call
// repeated returns the same token.
app.post('/api/assessments/:id/share', requireTeacher, (req, res) => {
  const all = readAll('assessments.json');
  const a = all.find((x) => x.id === req.params.id);
  if (!a) return res.status(404).json({ error: 'Not found' });
  if (a.teacherId !== req.session.user.id) return res.status(403).json({ error: 'Forbidden' });
  if (!a.shareToken) {
    a.shareToken = require('crypto').randomBytes(12).toString('hex');
    writeAll('assessments.json', all);
  }
  const origin = req.headers.origin || (req.protocol + '://' + req.get('host'));
  res.json({ ok: true, shareToken: a.shareToken, shareUrl: `${origin}/?share=${a.shareToken}` });
});

// View a shared assessment (any logged-in teacher). Returns the same shape
// as /take but stripped of session-specific stuff; designed for preview /
// print / duplicate.
app.get('/api/assessments/share/:token', requireTeacher, (req, res) => {
  const all = readAll('assessments.json');
  const a = all.find((x) => x.shareToken === req.params.token);
  if (!a) return res.status(404).json({ error: 'Shared assessment not found' });
  res.json({ ok: true, assessment: a });
});

// Duplicate a shared assessment into the receiving teacher's own classes.
// New assessment gets a fresh id, the receiving teacher's id, and the
// requested classId. shareToken is NOT carried over.
app.post('/api/assessments/share/:token/duplicate', requireTeacher, (req, res) => {
  const all = readAll('assessments.json');
  const original = all.find((x) => x.shareToken === req.params.token);
  if (!original) return res.status(404).json({ error: 'Shared assessment not found' });
  const targetClassId = String(req.body && req.body.classId || '');
  if (!targetClassId) return res.status(400).json({ error: 'classId required' });
  const classes = readAll('classes.json');
  const cls = classes.find((c) => c.id === targetClassId);
  if (!cls || cls.teacherId !== req.session.user.id) {
    return res.status(403).json({ error: 'You can only duplicate into your own class.' });
  }
  const copy = {
    ...original,
    id: uuidv4(),
    teacherId: req.session.user.id,
    teacherName: req.session.user.name || req.session.user.email,
    classId: targetClassId,
    published: false,
    createdAt: new Date().toISOString(),
    shareToken: null,
    duplicatedFrom: original.id,
  };
  delete copy.reentryGrants;
  // Give every question + section a NEW id so the new assessment doesn't
  // collide with the original's question references.
  copy.sections = (copy.sections || []).map((s) => ({ ...s, id: uuidv4() }));
  const sectionIdMap = new Map();
  (original.sections || []).forEach((s, i) => {
    if (copy.sections[i]) sectionIdMap.set(s.id, copy.sections[i].id);
  });
  copy.questions = (copy.questions || []).map((q) => ({
    ...q,
    id: uuidv4(),
    sectionId: sectionIdMap.get(q.sectionId) || (copy.sections[0] && copy.sections[0].id),
  }));
  all.push(copy);
  writeAll('assessments.json', all);
  res.json({ ok: true, assessmentId: copy.id, title: copy.title });
});

// Teacher writes their own free-text grade on a student's submission.
// Stored alongside the result so it shows on the report card.
app.put('/api/results/:resultId/teacher-grade', requireTeacher, (req, res) => {
  const results = readAll('results.json');
  const idx = results.findIndex((r) => r.id === req.params.resultId);
  if (idx === -1) return res.status(404).json({ error: 'Result not found' });
  const assessments = readAll('assessments.json');
  const a = assessments.find((x) => x.id === results[idx].assessmentId);
  if (!a || a.teacherId !== req.session.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const grade = String(req.body && req.body.grade != null ? req.body.grade : '').trim().slice(0, 80);
  results[idx].teacherGradeOverride = grade || null;
  results[idx].teacherGradeOverrideAt = grade ? new Date().toISOString() : null;
  writeAll('results.json', results);
  res.json({ ok: true, teacherGradeOverride: results[idx].teacherGradeOverride });
});

// JSON export of an assessment for the teacher (used by the PDF print
// flow and any other "preview the whole paper" feature).

// ───────────────────────────────────────────────────────────────────────────
//  Listening-assessment audio endpoints
// ───────────────────────────────────────────────────────────────────────────
// Teacher attaches/replaces the audio for one of their own assessments.
// We store the file as <assessmentId>.<ext> in AUDIO_DIR so cleanup is
// trivial (overwrite or unlink). The metadata { name, size, mime, ext }
// goes on the assessment record.
app.post('/api/assessments/:id/audio', requireTeacher, audioUpload.single('audio'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio uploaded' });
  const all = readAll('assessments.json');
  const idx = all.findIndex((a) => a.id === req.params.id);
  if (idx === -1) { try { fs.unlinkSync(req.file.path); } catch {} ; return res.status(404).json({ error: 'Not found' }); }
  if (all[idx].teacherId !== req.session.user.id) {
    try { fs.unlinkSync(req.file.path); } catch {}
    return res.status(403).json({ error: 'Forbidden' });
  }
  // Pick a safe extension from the original filename or mime.
  const extFromName = (req.file.originalname.match(/\.([a-z0-9]+)$/i) || [])[1] || '';
  const ext = (extFromName || (req.file.mimetype.split('/')[1] || 'mp3')).toLowerCase();
  const dest = path.join(AUDIO_DIR, `${req.params.id}.${ext}`);
  // Remove any pre-existing audio for this assessment (different extension).
  try {
    fs.readdirSync(AUDIO_DIR)
      .filter((f) => f.startsWith(req.params.id + '.'))
      .forEach((f) => { try { fs.unlinkSync(path.join(AUDIO_DIR, f)); } catch {} });
  } catch {}
  fs.renameSync(req.file.path, dest);
  all[idx].audioFile = {
    name: req.file.originalname,
    size: req.file.size,
    mime: req.file.mimetype,
    ext,
    uploadedAt: new Date().toISOString(),
  };
  writeAll('assessments.json', all);
  res.json({ audioFile: all[idx].audioFile });
});

// Stream the audio. Allowed for the owning teacher OR an authenticated
// student who is enrolled (we don't enforce class enrollment beyond the
// signed-in role; the student needs a valid session and the assessment
// must be published).
app.get('/api/assessments/:id/audio', requireAuth, (req, res) => {
  const all = readAll('assessments.json');
  const a = all.find((x) => x.id === req.params.id);
  if (!a || !a.audioFile || !a.audioFile.ext) return res.status(404).json({ error: 'No audio' });
  const isOwner = req.session.user.role === 'teacher' && a.teacherId === req.session.user.id;
  const isStudent = req.session.user.role === 'student' && a.published;
  if (!isOwner && !isStudent) return res.status(403).json({ error: 'Forbidden' });
  const fp = path.join(AUDIO_DIR, `${a.id}.${a.audioFile.ext}`);
  if (!fs.existsSync(fp)) return res.status(404).json({ error: 'Audio file missing' });
  res.setHeader('Content-Type', a.audioFile.mime || 'audio/mpeg');
  // Discourage download tools — not bulletproof, but matches the rest of
  // the lockdown posture. The HTML5 player still streams just fine.
  res.setHeader('Content-Disposition', 'inline; filename="audio"');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(fp);
});

// Teacher removes the audio.
app.delete('/api/assessments/:id/audio', requireTeacher, (req, res) => {
  const all = readAll('assessments.json');
  const idx = all.findIndex((a) => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  if (all[idx].teacherId !== req.session.user.id) return res.status(403).json({ error: 'Forbidden' });
  try {
    fs.readdirSync(AUDIO_DIR)
      .filter((f) => f.startsWith(req.params.id + '.'))
      .forEach((f) => { try { fs.unlinkSync(path.join(AUDIO_DIR, f)); } catch {} });
  } catch {}
  all[idx].audioFile = null;
  writeAll('assessments.json', all);
  res.json({ ok: true });
});


// ───────────────────────────────────────────────────────────────────────────
//  Listening: generate the AI-read transcript for an existing assessment.
// ───────────────────────────────────────────────────────────────────────────
// Given an existing assessment id, ask Claude to write a full listening
// script that the questions can be answered from. Persist to audioScript.
app.post('/api/assessments/:id/generate-script', requireTeacher, async (req, res) => {
  const apiKey = readApiKey();
  if (!apiKey) return res.status(400).json({ error: 'No Anthropic API key configured.' });

  const all = readAll('assessments.json');
  const idx = all.findIndex((a) => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  if (all[idx].teacherId !== req.session.user.id) return res.status(403).json({ error: 'Forbidden' });

  const a = all[idx];
  // Lay out the assessment's structure so the model knows what the script
  // has to support. Include questions, options, and any expected answer.
  const qLines = (a.questions || []).map((q, i) => {
    const parts = [];
    parts.push(`Q${i + 1} [${q.type}] ${q.prompt}`);
    if (Array.isArray(q.options) && q.options.length) {
      q.options.forEach((opt, j) => parts.push(`     (${String.fromCharCode(65 + j)}) ${opt}`));
    }
    if (q.correctAnswer !== undefined && q.correctAnswer !== null && q.correctAnswer !== '') {
      const ca = typeof q.correctAnswer === 'number'
        ? `option (${String.fromCharCode(65 + q.correctAnswer)})`
        : String(q.correctAnswer);
      parts.push(`     answer: ${ca}`);
    }
    return parts.join('\n');
  }).join('\n');

  const language = a.assessmentLanguage || 'English';
  const subject  = a.subject || 'Listening';
  const prompt = [
    'You write LISTENING-TEST audio scripts for classroom assessments.',
    'Your task: produce ONE complete spoken-word script that the student will hear ONCE during the exam.',
    '',
    'OUTPUT FORMAT — return ONLY this JSON object (no markdown fences, no commentary):',
    '{ "audioScript": "string — the full transcript, ready to be read aloud" }',
    '',
    'RULES',
    '  1. The script must contain EVERY piece of information needed to answer EVERY question below. A student listening once should be able to answer all of them.',
    `  2. Language: ${language}. Write the entire script in this language.`,
    '  3. Length: at least 250 words and at most 700 words. Long enough to be a real listening section, short enough to fit a 3–5 minute audio.',
    '  4. Style: natural spoken English (or the chosen language). Use full sentences. If it is a dialogue, label speakers ("Speaker 1:", "Speaker 2:", or named roles like "Interviewer:", "Dr. Khan:"). For announcements/monologues, just write the prose.',
    '  5. NO stage directions in brackets (e.g. NO "[pause]", NO "[music]"). NO question prompts — only the spoken material.',
    '  6. NEVER read the questions or answer choices aloud — just the source material that lets the student deduce the answers.',
    '  7. Mention specific facts (names, dates, places, numbers) that map clearly to each question.',
    '',
    `ASSESSMENT METADATA`,
    `  Title: ${a.title}`,
    `  Subject: ${subject}`,
    `  Language: ${language}`,
    `  Description: ${a.description || '(none)'}`,
    '',
    'QUESTIONS THE SCRIPT MUST COVER',
    qLines || '(no questions yet — write a generic 300-word listening passage on a school-appropriate topic for the language above)',
  ].join('\n');

  try {
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
      }),
    });
    if (!apiRes.ok) {
      const errText = await apiRes.text().catch(() => '');
      console.error('[generate-script] API error', apiRes.status, errText);
      return res.status(502).json({ error: 'AI service error: ' + apiRes.status });
    }
    const data = await apiRes.json();
    let text = (data.content || []).map((b) => b.type === 'text' ? b.text : '').join('').trim();
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    let parsed;
    try { parsed = JSON.parse(text); }
    catch (e) {
      // Fallback: treat the entire response as the script (some models drop the JSON wrapper).
      parsed = { audioScript: text };
    }
    const script = String(parsed.audioScript || '').slice(0, 12000).trim();
    if (!script) return res.status(502).json({ error: 'AI returned an empty script.' });

    all[idx].audioScript = script;
    writeAll('assessments.json', all);
    res.json({ ok: true, audioScript: script });
  } catch (e) {
    console.error('[generate-script] failed', e);
    res.status(500).json({ error: 'Generation failed: ' + e.message });
  }
});


// ───────────────────────────────────────────────────────────────────────────
//  Listening: generate a script from inline builder state (no save needed).
// ───────────────────────────────────────────────────────────────────────────
// The client sends { title, description, subject, language, questions[] }
// straight from the builder. The server asks Claude to write the script,
// returns it, and does NOT persist anything (the client will save it as
// part of the regular assessment save).
app.post('/api/listening/generate-script', requireTeacher, async (req, res) => {
  const apiKey = readApiKey();
  if (!apiKey) {
    return res.status(400).json({ error: 'No Anthropic API key configured. Add one in Settings → AI key.' });
  }
  const { title, description, subject, language, questions } = req.body || {};
  const lang = String(language || 'English');
  const subj = String(subject || 'Listening');
  const qs = Array.isArray(questions) ? questions : [];
  const qLines = qs.map((q, i) => {
    const parts = [];
    parts.push(`Q${i + 1} [${q.type || 'short'}] ${q.prompt || ''}`);
    if (Array.isArray(q.options) && q.options.length) {
      q.options.forEach((opt, j) => parts.push(`     (${String.fromCharCode(65 + j)}) ${opt}`));
    }
    if (q.correctAnswer !== undefined && q.correctAnswer !== null && q.correctAnswer !== '') {
      const ca = typeof q.correctAnswer === 'number'
        ? `option (${String.fromCharCode(65 + q.correctAnswer)})`
        : String(q.correctAnswer);
      parts.push(`     answer: ${ca}`);
    }
    return parts.join('\n');
  }).join('\n');

  const prompt = [
    'You write LISTENING-TEST audio scripts for classroom assessments.',
    'Your task: produce ONE complete spoken-word script that the student will hear during the exam.',
    '',
    'OUTPUT FORMAT — return ONLY this JSON object (no markdown fences, no commentary):',
    '{ "audioScript": "string — the full transcript, ready to be read aloud" }',
    '',
    'RULES',
    '  1. The script must contain EVERY piece of information needed to answer EVERY question below. A student listening once should be able to answer all of them.',
    `  2. Language: ${lang}. Write the entire script in this language.`,
    '  3. Length: at least 250 words and at most 700 words.',
    '  4. Style: natural spoken language. Use full sentences. If it is a dialogue, label speakers at the START of each line with a colon: "Speaker 1:", "Speaker 2:", or named roles like "Interviewer:", "Dr. Khan:", "Sarah:". Use the SAME label every time a speaker speaks. Each turn starts on a new line.',
    '  5. NO stage directions in brackets. NO question prompts read aloud. Just the source material.',
    '  6. Mention specific facts (names, dates, places, numbers) that map clearly to each question.',
    '',
    `ASSESSMENT METADATA`,
    `  Title: ${title || '(no title yet)'}`,
    `  Subject: ${subj}`,
    `  Language: ${lang}`,
    `  Description: ${description || '(none)'}`,
    '',
    'QUESTIONS THE SCRIPT MUST COVER',
    qLines || '(no questions yet — write a generic 350-word listening passage on a school-appropriate topic for the language above, as a dialogue between two speakers labelled "Speaker 1:" and "Speaker 2:")',
  ].join('\n');

  try {
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
      }),
    });
    if (!apiRes.ok) {
      const errText = await apiRes.text().catch(() => '');
      console.error('[listening/generate-script] API error', apiRes.status, errText);
      return res.status(502).json({ error: `Anthropic API error ${apiRes.status}. Check the API key in Settings.` });
    }
    const data = await apiRes.json();
    let text = (data.content || []).map((b) => b.type === 'text' ? b.text : '').join('').trim();
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    let parsed;
    try { parsed = JSON.parse(text); }
    catch (e) {
      // Some models drop the JSON wrapper and emit the script directly.
      parsed = { audioScript: text };
    }
    const script = String(parsed.audioScript || '').slice(0, 12000).trim();
    if (!script) return res.status(502).json({ error: 'AI returned an empty script. Try again.' });
    res.json({ ok: true, audioScript: script });
  } catch (e) {
    console.error('[listening/generate-script] failed', e);
    res.status(500).json({ error: 'Generation failed: ' + e.message });
  }
});


// ───────────────────────────────────────────────────────────────────────────
//  Admin-only: export every user as CSV
// ───────────────────────────────────────────────────────────────────────────
// Locked to one email so other teachers cannot pull the full user list.
// To rotate the admin, change ADMIN_EMAIL below.
// Multiple admin emails — either one has access to the user-export endpoints.
const ADMIN_EMAILS = ['bsharma2567@gmail.com', 'bhawna.sharma@moe.sch.ae'];
const ADMIN_EMAIL  = ADMIN_EMAILS[0]; // kept for backward compatibility
app.get('/api/admin/users-export', requireTeacher, (req, res) => {
  if (!ADMIN_EMAILS.map((e) => e.toLowerCase()).includes((req.session.user.email || '').toLowerCase())) {
    return res.status(403).json({ error: 'Forbidden — admin only.' });
  }
  // Optional date-range filter on createdAt — inclusive on both ends.
  // ?from=2026-01-01&to=2026-06-30
  const rawFrom = String(req.query.from || '').trim();
  const rawTo   = String(req.query.to   || '').trim();
  const fromMs  = rawFrom && /^\d{4}-\d{2}-\d{2}$/.test(rawFrom) ? Date.parse(rawFrom + 'T00:00:00.000Z') : null;
  const toMs    = rawTo   && /^\d{4}-\d{2}-\d{2}$/.test(rawTo)   ? Date.parse(rawTo   + 'T23:59:59.999Z') : null;
  let users = readAll('users.json');
  if (fromMs || toMs) {
    users = users.filter((u) => {
      const t = u.createdAt ? Date.parse(u.createdAt) : 0;
      if (fromMs && t < fromMs) return false;
      if (toMs   && t > toMs)   return false;
      return true;
    });
  }
  const classes = readAll('classes.json');
  // For each user, count how many classes reference them.
  const teacherClassCount = (id) => classes.filter((c) => c.teacherId === id).length;
  const studentClassCount = (email) => classes.filter((c) =>
    Array.isArray(c.roster) && c.roster.some((r) => (r.email || '').toLowerCase() === (email || '').toLowerCase())
  ).length;

  // Sort: teachers first (alpha by name), then students (alpha by name).
  const sorted = users
    .map((u) => ({ ...u }))
    .sort((a, b) => {
      const ra = a.role === 'teacher' ? 0 : 1;
      const rb = b.role === 'teacher' ? 0 : 1;
      if (ra !== rb) return ra - rb;
      return (a.name || '').localeCompare(b.name || '');
    });

  // CSV-escape helper.
  const esc = (v) => {
    const s = String(v == null ? '' : v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ['role','name','email','classes_count','created_at','must_change_password'];
  const lines = [header.join(',')];
  for (const u of sorted) {
    const count = u.role === 'teacher'
      ? teacherClassCount(u.id)
      : studentClassCount(u.email);
    lines.push([
      esc(u.role),
      esc(u.name),
      esc(u.email),
      esc(count),
      esc(u.createdAt || ''),
      esc(u.mustChangePassword ? 'yes' : 'no'),
    ].join(','));
  }
  const csv = lines.join('\n') + '\n';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="classcurio_users.csv"');
  res.send(csv);
});

// Admin-only: every student grouped by class — CSV for sending
// class-specific announcements. Columns: class_name, teacher_name,
// student_name, student_email. Sorted by class then student name.
app.get('/api/admin/students-by-class-export', requireTeacher, (req, res) => {
  if (!ADMIN_EMAILS.map((e) => e.toLowerCase()).includes((req.session.user.email || '').toLowerCase())) {
    return res.status(403).json({ error: 'Forbidden — admin only.' });
  }
  const users   = readAll('users.json');
  const classes = readAll('classes.json');
  const teacherById = new Map(users.filter((u) => u.role === 'teacher').map((u) => [u.id, u]));

  const esc = (v) => {
    const s = String(v == null ? '' : v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ['class_name','teacher_name','teacher_email','student_name','student_email'];
  const lines = [header.join(',')];

  const sortedClasses = [...classes].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  for (const c of sortedClasses) {
    const teacher = teacherById.get(c.teacherId) || {};
    const roster = Array.isArray(c.roster) ? c.roster : [];
    const sortedRoster = [...roster].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    if (!sortedRoster.length) {
      // Include empty classes too so the admin sees "class exists but no students".
      lines.push([
        esc(c.name), esc(teacher.name || ''), esc(teacher.email || ''),
        '', '',
      ].join(','));
      continue;
    }
    for (const r of sortedRoster) {
      lines.push([
        esc(c.name),
        esc(teacher.name || ''),
        esc(teacher.email || ''),
        esc(r.name || ''),
        esc(r.email || ''),
      ].join(','));
    }
  }
  const csv = lines.join('\n') + '\n';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="classcurio_students_by_class.csv"');
  res.send(csv);
});

// Lightweight check the dashboard uses to decide whether to show the
// admin Export button without exposing the admin email to the client.

// ───────────────────────────────────────────────────────────────────────────
//  Admin-only: how much space is left on the persistent disk
// ───────────────────────────────────────────────────────────────────────────
// Reports total / used / free for the volume that holds /data/ (or wherever
// readAll() reads from), plus a per-subfolder breakdown so the admin can see
// what's taking up space.
app.get('/api/admin/disk-usage', requireTeacher, async (req, res) => {
  if (!ADMIN_EMAILS.map((e) => e.toLowerCase()).includes((req.session.user.email || '').toLowerCase())) {
    return res.status(403).json({ error: 'Forbidden — admin only.' });
  }
  const dataDir = path.join(__dirname, '..', 'data');

  // Recursively walk a directory and sum up file sizes.
  async function dirSize(dir) {
    let total = 0;
    try {
      const entries = await require('fs').promises.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          total += await dirSize(p);
        } else if (e.isFile()) {
          try { total += (await require('fs').promises.stat(p)).size; } catch {}
        }
      }
    } catch {}
    return total;
  }

  // Volume-level numbers: prefer `df --block-size=1` for byte precision.
  // If df isn't available (e.g. some Render base images), gracefully fall
  // back to "unknown".
  function dfBytes(p) {
    return new Promise((resolve) => {
      require('child_process').execFile('df', ['-Pk', p], { timeout: 4000 }, (err, stdout) => {
        if (err) return resolve(null);
        // Header line then values: 1024-blocks Used Available Capacity Mounted
        const lines = String(stdout || '').trim().split(/\n/);
        if (lines.length < 2) return resolve(null);
        const cols = lines[1].split(/\s+/);
        if (cols.length < 6) return resolve(null);
        resolve({
          total: Number(cols[1]) * 1024,
          used:  Number(cols[2]) * 1024,
          free:  Number(cols[3]) * 1024,
          mount: cols[5],
        });
      });
    });
  }

  try {
    const vol = await dfBytes(dataDir);
    // Per-subfolder breakdown for the data tree.
    const subs = ['assessments.json','users.json','results.json','classes.json','config.json',
                  'audio','sessions','uploads','proctor'];
    const breakdown = {};
    for (const s of subs) {
      const p = path.join(dataDir, s);
      try {
        const st = await require('fs').promises.stat(p);
        breakdown[st.isDirectory() ? s + '/' : s] = st.isDirectory()
          ? await dirSize(p)
          : st.size;
      } catch {}
    }
    const dataFolderSize = Object.values(breakdown).reduce((a, b) => a + b, 0);
    res.json({
      diskPath: dataDir,
      total: vol ? vol.total : null,
      used:  vol ? vol.used  : null,
      free:  vol ? vol.free  : null,
      mount: vol ? vol.mount : null,
      dataFolderSize,
      breakdown,
    });
  } catch (e) {
    res.status(500).json({ error: 'Could not read disk usage: ' + e.message });
  }
});


// Admin-only: manually re-run the rescale (in case the startup pass was
// missed or ran before the rescale code had shipped).
app.post('/api/admin/rescale-essays', requireTeacher, (req, res) => {
  if (!ADMIN_EMAILS.map((e) => e.toLowerCase()).includes((req.session.user.email || '').toLowerCase())) {
    return res.status(403).json({ error: 'Forbidden — admin only.' });
  }
  try {
    const touched = rescaleEssaysTo40();
    res.json({ ok: true, touched });
  } catch (e) {
    res.status(500).json({ error: 'Rescale failed: ' + e.message });
  }
});

app.get('/api/admin/is-admin', requireAuth, (req, res) => {
  res.json({ isAdmin: ADMIN_EMAILS.map((e) => e.toLowerCase()).includes((req.session.user.email || '').toLowerCase()) });
});

app.get('/api/assessments/:id/export', requireTeacher, (req, res) => {
  const all = readAll('assessments.json');
  const a = all.find((x) => x.id === req.params.id);
  if (!a) return res.status(404).json({ error: 'Assessment not found' });
  if (a.teacherId !== req.session.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json({ ok: true, assessment: a });
});

// Word document export — the teacher downloads the assessment as a .docx
// they can edit/print at school. We embed the title, sections (with
// instructions and passage), every question with its options or answer
// lines, then an answer key on a final page.
app.get('/api/assessments/:id/export.docx', requireTeacher, async (req, res) => {
  const all = readAll('assessments.json');
  const a = all.find((x) => x.id === req.params.id);
  if (!a) return res.status(404).send('Assessment not found');
  if (a.teacherId !== req.session.user.id) {
    return res.status(403).send('Forbidden');
  }

  try {
    const docx = require('docx');
    const {
      Document, Packer, Paragraph, TextRun, AlignmentType,
      LevelFormat, HeadingLevel, PageBreak,
    } = docx;

    const NAVY = '1a1e33';
    const INK  = '232846';
    const MUTED = '6b7280';
    const ACCENT = '92400e';
    const PANEL = 'fef7e6';

    const para = (text, opts = {}) => new Paragraph({
      spacing: { before: 60, after: 60, line: 320 },
      ...opts,
      children: Array.isArray(text)
        ? text
        : [new TextRun({ text, font: 'Calibri', size: opts.size || 22, color: opts.color || INK, bold: opts.bold || false })],
    });
    const h1 = (text) => new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 120 },
      children: [new TextRun({ text, bold: true, color: NAVY, size: 36, font: 'Calibri' })],
    });
    const h2 = (text) => new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 220, after: 100 },
      children: [new TextRun({ text, bold: true, color: NAVY, size: 28, font: 'Calibri' })],
    });
    const italic = (text) => para(text, { });
    const passageBlock = (text) => new Paragraph({
      spacing: { before: 80, after: 120, line: 320 },
      shading: { fill: PANEL },
      children: [new TextRun({ text, font: 'Calibri', size: 22, color: INK })],
    });
    const optionRow = (text) => new Paragraph({
      spacing: { before: 30, after: 30, line: 280 },
      indent: { left: 480 },
      children: [
        new TextRun({ text: '◯  ', font: 'Calibri', size: 22, color: MUTED }),
        new TextRun({ text, font: 'Calibri', size: 22, color: INK }),
      ],
    });
    const writingLines = (count) => Array.from({length: count}, () =>
      new Paragraph({
        spacing: { before: 80, after: 80 },
        border: { bottom: { style: 'single', size: 6, color: '94a3b8' } },
        children: [new TextRun({ text: ' ' })],
      })
    );

    const children = [
      h1(a.title || 'Assessment'),
      para(a.description || '', { color: MUTED, size: 22 }),
      para([
        new TextRun({ text: 'Duration: ', bold: true, font: 'Calibri', size: 22, color: INK }),
        new TextRun({ text: (a.durationMinutes || 30) + ' minutes', font: 'Calibri', size: 22, color: INK }),
        new TextRun({ text: '  ·  ', font: 'Calibri', size: 22, color: MUTED }),
        new TextRun({ text: (a.questions || []).length + ' questions', font: 'Calibri', size: 22, color: INK }),
        ...(a.subject ? [new TextRun({ text: '  ·  ' + a.subject, font: 'Calibri', size: 22, color: INK })] : []),
        ...(a.grade ? [new TextRun({ text: '  ·  Grade ' + a.grade, font: 'Calibri', size: 22, color: INK })] : []),
        ...(a.term ? [new TextRun({ text: '  ·  Term ' + a.term, font: 'Calibri', size: 22, color: INK })] : []),
      ]),
      new Paragraph({ spacing: { before: 80 }, children: [new TextRun({ text: ' ' })] }),
    ];

    let qNum = 0;
    const sections = a.sections || [];
    const questions = a.questions || [];
    const renderQuestion = (q) => {
      qNum++;
      const blocks = [
        new Paragraph({
          spacing: { before: 200, after: 60 },
          children: [
            new TextRun({ text: 'Q' + qNum + ' ', bold: true, font: 'Calibri', size: 24, color: NAVY }),
            new TextRun({ text: '(' + (q.points || 1) + ' pt' + ((q.points || 1) === 1 ? '' : 's') + '):  ', bold: true, font: 'Calibri', size: 22, color: MUTED }),
            new TextRun({ text: q.prompt || '', font: 'Calibri', size: 22, color: INK }),
          ],
        }),
      ];
      if (q.type === 'mc') {
        for (const o of (q.options || [])) blocks.push(optionRow(String(o || '')));
      } else if (q.type === 'tf') {
        blocks.push(optionRow('True'));
        blocks.push(optionRow('False'));
      } else if (q.type === 'tfng') {
        blocks.push(optionRow('True'));
        blocks.push(optionRow('False'));
        blocks.push(optionRow('Not Given'));
      } else if (q.type === 'short') {
        blocks.push(...writingLines(1));
      } else if (q.type === 'long' || q.type === 'essay') {
        blocks.push(...writingLines(6));
      } else if (q.type === 'writing') {
        blocks.push(...writingLines(14));
      } else if (q.type === 'match' && Array.isArray(q.pairs)) {
        const variant = q.matchVariant || 'word-definition';
        blocks.push(new Paragraph({
          spacing: { before: 60, after: 60 },
          children: [new TextRun({ text: 'Match each item on the LEFT with the correct item on the RIGHT.', italics: true, font: 'Calibri', size: 20, color: MUTED })],
        }));
        for (let i = 0; i < q.pairs.length; i++) {
          const p = q.pairs[i];
          blocks.push(new Paragraph({
            spacing: { before: 30, after: 30 },
            children: [
              new TextRun({ text: '  ' + String.fromCharCode(65 + i) + '. ', bold: true, font: 'Calibri', size: 22, color: INK }),
              new TextRun({ text: (p && p.left) || '', font: 'Calibri', size: 22, color: INK }),
              new TextRun({ text: '   →   ____', font: 'Calibri', size: 22, color: MUTED }),
            ],
          }));
        }
        blocks.push(new Paragraph({
          spacing: { before: 80, after: 60 },
          children: [new TextRun({ text: 'Options:', bold: true, font: 'Calibri', size: 22, color: NAVY })],
        }));
        const shuffled = [...q.pairs].sort(() => Math.random() - 0.5);
        for (let i = 0; i < shuffled.length; i++) {
          const p = shuffled[i];
          blocks.push(new Paragraph({
            spacing: { before: 20, after: 20 },
            children: [
              new TextRun({ text: '  ' + (i + 1) + '. ', bold: true, font: 'Calibri', size: 22, color: INK }),
              new TextRun({ text: (p && p.right) || (variant === 'word-picture' ? '[picture]' : ''), font: 'Calibri', size: 22, color: INK }),
            ],
          }));
        }
      }
      return blocks;
    };

    if (sections.length) {
      for (const sec of sections) {
        if (sec.title) children.push(h2(sec.title));
        if (sec.instructions) children.push(para(sec.instructions, { color: ACCENT }));
        if (sec.passage) children.push(passageBlock(sec.passage));
        for (const q of questions.filter((qq) => qq.sectionId === sec.id)) {
          children.push(...renderQuestion(q));
        }
      }
    } else {
      for (const q of questions) children.push(...renderQuestion(q));
    }

    // Answer key on a new page.
    children.push(new Paragraph({ pageBreakBefore: true, children: [new TextRun({ text: '' })] }));
    children.push(h1('Answer Key'));
    let i = 0;
    for (const q of questions) {
      i++;
      let answerText = '';
      if (q.type === 'mc') answerText = String(((q.options || [])[q.correctAnswer]) || '');
      else if (q.type === 'tf') answerText = q.correctAnswer ? 'True' : 'False';
      else if (q.type === 'tfng') answerText = String(q.correctAnswer || '');
      else if (q.type === 'short') answerText = String(q.correctAnswer || '(open-ended)');
      else answerText = '(Teacher / AI graded)';
      children.push(new Paragraph({
        spacing: { before: 80, after: 80 },
        children: [
          new TextRun({ text: 'Q' + i + ': ', bold: true, font: 'Calibri', size: 22, color: NAVY }),
          new TextRun({ text: answerText, font: 'Calibri', size: 22, color: INK }),
        ],
      }));
    }

    const doc = new Document({
      creator: 'ClassCurio',
      title: a.title || 'Assessment',
      styles: {
        default: { document: { run: { font: 'Calibri', size: 22 } } },
      },
      sections: [{
        properties: {
          page: { margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } },
        },
        children,
      }],
    });

    const buf = await Packer.toBuffer(doc);
    const safe = (a.title || 'assessment').replace(/[^a-z0-9-]+/gi, '_').slice(0, 80);
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.set('Content-Disposition', `attachment; filename="${safe}.docx"`);
    res.send(buf);
  } catch (e) {
    console.error('[export.docx] failed', e);
    res.status(500).send('Could not generate Word document: ' + e.message);
  }
});

// ---------- Student assessment flow ----------
// Fetch one assessment for taking — strips correct answers

// ───────────────────────────────────────────────────────────────────────────
//  Preview-as-student — teacher-only endpoint
// ───────────────────────────────────────────────────────────────────────────
// Returns the same student-facing shape /take produces, but only for the
// teacher who owns the assessment. Used by /public/preview.html to render
// the exam exactly as a student would see it — without lockdown, without
// webcam, without submission.
app.get('/api/assessments/:id/preview', requireTeacher, (req, res) => {
  const all = readAll('assessments.json');
  const a = all.find((x) => x.id === req.params.id);
  if (!a) return res.status(404).json({ error: 'Not found' });
  if (a.teacherId !== req.session.user.id) return res.status(403).json({ error: 'Forbidden' });

  const safe = {
    id: a.id,
    title: a.title,
    description: a.description,
    passage: a.passage || '',
    rubricStage: a.rubricStage || null,
    durationMinutes: a.durationMinutes,
    teacherName: a.teacherName,
    subject: a.subject || null,
    assessmentLanguage: a.assessmentLanguage || null,
    deliveryMode: a.deliveryMode || 'online',
    hasAudio: !!(a.audioFile && a.audioFile.ext),
    audioFile: a.audioFile ? { name: a.audioFile.name, mime: a.audioFile.mime } : null,
    audioScript: a.audioScript || '',
    audioVoice:  a.audioVoice  || '',
    audioVoices: a.audioVoices || {},
    sections: Array.isArray(a.sections) ? a.sections : [],
    // For preview we INCLUDE the answer key so the teacher can verify it.
    questions: (a.questions || []).map((q) => {
      const out = {
        id: q.id,
        order: q.order,
        sectionId: q.sectionId || '',
        type: q.type,
        prompt: q.prompt,
        options: q.options,
        points: q.points,
        imageUrl: q.imageUrl || '',
        correctAnswer: q.correctAnswer,   // ← only sent in preview
      };
      if (q.type === 'match') {
        out.matchVariant = q.matchVariant || 'word-definition';
        out.pairs        = q.pairs || [];
      }
      return out;
    }),
  };
  res.json({ assessment: safe });
});

app.get('/api/assessments/:id/take', requireStudent, (req, res) => {
  const all = readAll('assessments.json');
  const a = all.find((x) => x.id === req.params.id && x.published);
  if (!a) return res.status(404).json({ error: 'Not found' });

  // Ensure the student hasn't already submitted — unless the teacher has
  // granted a one-time re-entry. A grant is a record on the assessment with
  // { studentId, grantedAt, usedAt? }.
  //
  // When an active grant exists for this student, we PRESERVE their prior
  // submission and return its answers so the student picks up where they
  // left off. The grant is NOT marked used at this point — only at submit
  // time — so the student can re-open the link if their browser crashes
  // before submit.
  const results = readAll('results.json');
  const already = results.find(
    (r) => r.studentId === req.session.user.id && r.assessmentId === a.id
  );
  let previousAnswersMap = null;
  if (already) {
    const grants = Array.isArray(a.reentryGrants) ? a.reentryGrants : [];
    const grant = grants.find(
      (g) => g.studentId === req.session.user.id && !g.usedAt
    );
    if (!grant) {
      return res.status(403).json({ error: 'You have already submitted this assessment.' });
    }
    // Build a { questionId -> given-answer } map for the client to pre-fill.
    previousAnswersMap = {};
    for (const ans of (already.answers || [])) {
      if (ans && ans.questionId !== undefined && ans.given !== undefined) {
        previousAnswersMap[ans.questionId] = ans.given;
      }
    }
  }

  const safe = {
    id: a.id,
    title: a.title,
    description: a.description,
    passage: a.passage || '',
    rubricStage: a.rubricStage || null,
    durationMinutes: a.durationMinutes,
    teacherName: a.teacherName,
    subject: a.subject || null,
    assessmentLanguage: a.assessmentLanguage || null,
    deliveryMode: a.deliveryMode || 'online',
    hasAudio: !!(a.audioFile && a.audioFile.ext),
    audioFile: a.audioFile ? { name: a.audioFile.name, mime: a.audioFile.mime } : null,
    audioScript: a.audioScript || '',
    audioVoice:  a.audioVoice  || '',
    audioVoices: a.audioVoices || {},
    // Re-entry mode: when the teacher has granted re-entry and the
    // student had a prior submission, we send back the answers they
    // had recorded so the client can pre-fill the form, plus the
    // milliseconds remaining on the original timer so the resumed
    // session starts at that count-down (not at full duration).
    reentryActive: !!previousAnswersMap,
    previousAnswers: previousAnswersMap,
    remainingMs: (already && Number.isFinite(already.remainingMs)) ? already.remainingMs : null,
    sections: Array.isArray(a.sections) ? a.sections : [],
    questions: a.questions.map((q) => {
      const out = {
        id: q.id,
        order: q.order,
        sectionId: q.sectionId || '',
        type: q.type,
        prompt: q.prompt,
        options: q.options,
        points: q.points,
        imageUrl: q.imageUrl || '',
      };
      if (q.type === 'match' && Array.isArray(q.pairs)) {
        // Shuffle the right column so the order isn't the answer key.
        const n = q.pairs.length;
        const idx = Array.from({ length: n }, (_, i) => i);
        for (let i = n - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [idx[i], idx[j]] = [idx[j], idx[i]];
        }
        out.matchVariant = q.matchVariant || 'word-definition';
        out.lefts        = q.pairs.map((p) => p.left || '');
        out.rights       = idx.map((origI) => ({
          text: q.pairs[origI].right || '',
          imageUrl: q.pairs[origI].rightImageUrl || '',
        }));
        out.rightShuffle = idx;
      }
      return out;
    }),
  };
  res.json({ assessment: safe });
});

// Submit answers — auto-grades MC/TF and stores everything else for teacher review
app.post('/api/assessments/:id/submit', requireStudent, (req, res) => {
  const all = readAll('assessments.json');
  const a = all.find((x) => x.id === req.params.id && x.published);
  if (!a) return res.status(404).json({ error: 'Not found' });

  const { answers, violations, startedAt, submitReason, remainingMs } = req.body || {};
  const results = readAll('results.json');

  // Block re-submission UNLESS the teacher has granted a re-entry. A grant
  // means the student is allowed to resubmit; in that case we fall through
  // to the rest of the handler, which will replace the prior result.
  const reentryGrants = Array.isArray(a.reentryGrants) ? a.reentryGrants : [];
  const hasActiveGrant = reentryGrants.some(
    (g) => g.studentId === req.session.user.id && !g.usedAt
  );
  const existingPrior = results.find(
    (r) => r.studentId === req.session.user.id && r.assessmentId === a.id
  );
  if (existingPrior && !hasActiveGrant) {
    return res.status(403).json({ error: 'Already submitted' });
  }

  let autoScore = 0;
  let autoMax = 0;
  const gradedAnswers = a.questions.map((q) => {
    const given = answers?.[q.id];
    let correct = null;
    if (q.type === 'mc' || q.type === 'tf') {
      autoMax += q.points;
      correct = String(given) === String(q.correctAnswer);
      if (correct) autoScore += q.points;
    } else if (q.type === 'tfng') {
      autoMax += q.points;
      correct = String(given).toLowerCase() === String(q.correctAnswer).toLowerCase();
      if (correct) autoScore += q.points;
    } else if (q.type === 'short' && q.correctAnswer) {
      // Case-insensitive exact match as a soft auto-grade
      autoMax += q.points;
      correct =
        typeof given === 'string' &&
        given.trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
      if (correct) autoScore += q.points;
    } else if (q.type === 'match' && Array.isArray(q.pairs) && q.pairs.length) {
      // Match scoring: the student sends { shuffleIndexMap, picks } where
      // picks[i] = the SHUFFLED right-column position the student matched
      // to left[i]. To remap back to the original right-side index, we use
      // the same shuffle the server generated. But /take used a random
      // shuffle, so we accept either:
      //   - picks: [origIdx_for_left0, origIdx_for_left1, ...]  (canonical)
      //   - { picks: [...], rightShuffle: [...] }                (legacy)
      // Whichever form arrives, we resolve to the ORIGINAL right index per
      // left, then check left[i] vs pairs[i] (which is the correct mapping
      // because pairs[i].right matches pairs[i].left).
      let picksOrigIdx = [];
      if (given && typeof given === 'object' && Array.isArray(given.picks)) {
        const shuffle = Array.isArray(given.rightShuffle) ? given.rightShuffle : null;
        picksOrigIdx = given.picks.map((p) => {
          const n = Number(p);
          if (!Number.isFinite(n) || n < 0) return -1;
          if (!shuffle) return n;
          return Number(shuffle[n] ?? -1);
        });
      } else if (Array.isArray(given)) {
        picksOrigIdx = given.map((n) => Number(n));
      }
      const n = q.pairs.length;
      let correctCount = 0;
      for (let i = 0; i < n; i++) {
        if (picksOrigIdx[i] === i) correctCount++;
      }
      autoMax += q.points;
      const earned = (correctCount / n) * q.points;
      autoScore += earned;
      correct = correctCount === n;
    }
    // 'long' and 'essay' types are always manual; 'writing' is rubric-based.
    return {
      questionId: q.id,
      given: given ?? null,
      correct, // null for essay / long / ungradable
    };
  });

  const envKey = `${req.session.user.id}__${a.id}`;
  const result = {
    id: uuidv4(),
    assessmentId: a.id,
    assessmentTitle: a.title,
    studentId: req.session.user.id,
    studentName: req.session.user.name,
    studentEmail: req.session.user.email,
    startedAt: startedAt || null,
    submittedAt: new Date().toISOString(),
    autoScore,
    autoMax,
    violations: violations || [],
    submitReason: submitReason || null,
    remainingMs: Number.isFinite(Number(remainingMs)) ? Number(remainingMs) : null,
    environment: vmFlags.get(envKey) || null,
    answers: gradedAnswers,
    manualGrades: {},
  };
  vmFlags.delete(envKey);

  // If the student already had a submission for this assessment, this is a
  // re-entry. Delete the previous submission (it was preserved up until now
  // so /take could pre-fill answers) and stamp usedAt on the matching grant.
  const priorIdx = results.findIndex(
    (r) => r.studentId === req.session.user.id && r.assessmentId === a.id
  );
  if (priorIdx !== -1) {
    results.splice(priorIdx, 1);
    const allAss = readAll('assessments.json');
    const aIdx = allAss.findIndex((x) => x.id === a.id);
    if (aIdx !== -1) {
      const grants = Array.isArray(allAss[aIdx].reentryGrants) ? allAss[aIdx].reentryGrants : [];
      const grant = grants.find(
        (g) => g.studentId === req.session.user.id && !g.usedAt
      );
      if (grant) {
        grant.usedAt = new Date().toISOString();
        writeAll('assessments.json', allAss);
      }
    }
  }

  results.push(result);
  writeAll('results.json', results);

  // ── Roster auto-stitch ───────────────────────────────────────────────────
  // Students who self-register via the share link aren't on the class
  // roster yet. After their first submission we add them so the teacher
  // can see them under View students immediately. Matching is by lowercase
  // email; we only stitch when the assessment has a classId AND the user
  // has a usable email.
  try {
    if (a.classId) {
      const allClasses = readAll('classes.json');
      const cIdx = allClasses.findIndex((c) => c.id === a.classId);
      if (cIdx !== -1) {
        const me = req.session.user;
        const myEmail = String(me.email || '').toLowerCase();
        const roster = Array.isArray(allClasses[cIdx].roster) ? allClasses[cIdx].roster : [];
        const present = roster.some((r) =>
          String(r && r.email || '').toLowerCase() === myEmail
        );
        if (myEmail && !present) {
          roster.push({
            email: myEmail,
            name: me.name || myEmail.split('@')[0],
            studentNumber: me.studentNumber || '',
            addedFrom: 'self-register',
            addedAt: new Date().toISOString(),
          });
          allClasses[cIdx].roster = roster;
          writeAll('classes.json', allClasses);
        }
      }
    }
  } catch (e) {
    console.warn('[submit] roster auto-stitch failed:', e.message);
  }

  // Kick off AI grading for any "writing" questions in the background. We
  // respond to the student immediately; the AI scores land in their review
  // page within ~30s. The teacher can override anything via the essay queue.
  scheduleAiGrading({ resultId: result.id });

  res.json({ result: { autoScore, autoMax, id: result.id } });
});

// Background: grade every "writing" answer in this result against the
// configured rubric stage, then persist the scores as manualGrades with
// aiGrade: true so the teacher can see + override.
function scheduleAiGrading({ resultId }) {
  setImmediate(async () => {
    try {
      const all = readAll('results.json');
      const idx = all.findIndex((r) => r.id === resultId);
      if (idx === -1) return;
      const r = all[idx];

      const assessments = readAll('assessments.json');
      const a = assessments.find((x) => x.id === r.assessmentId);
      if (!a) return;

      const writingQs = a.questions.filter((q) => q.type === 'writing' || q.type === 'essay');
      if (!writingQs.length) return;

      // Pick a rubric stage for AI grading. If the teacher set one on the
      // assessment, use it. If they forgot, fall back to Stage 8 so the
      // essay still gets a rubric-based grade instead of sitting in the
      // manual queue forever. Valid stages: '7', '8', '3-5', '5-9'.
      const validStages = new Set(['7', '8', '3-5', '5-9']);
      let effectiveStage = a.rubricStage && validStages.has(String(a.rubricStage))
        ? String(a.rubricStage)
        : '8';

      let touched = false;
      for (const q of writingQs) {
        const ans = (r.answers || []).find((x) => x.questionId === q.id);
        const essay = ans ? String(ans.given || '') : '';
        if (!essay.trim()) continue;
        const graded = await gradeWriting({
          rubricStage: effectiveStage,
          prompt: q.prompt,
          essay,
          maxScore: q.points,
        });
        if (!graded.ok) {
          console.log(`[grader] skipped q=${q.id} on result=${r.id}: ${graded.reason}`);
          continue;
        }
        // Persist as a manualGrade flagged aiGrade so the teacher knows.
        const fresh = readAll('results.json');
        const fIdx = fresh.findIndex((x) => x.id === resultId);
        if (fIdx === -1) return;
        fresh[fIdx].manualGrades = fresh[fIdx].manualGrades || {};
        // Don't overwrite a teacher-entered grade.
        const existing = fresh[fIdx].manualGrades[q.id];
        if (existing && !existing.aiGrade) continue;
        fresh[fIdx].manualGrades[q.id] = {
          score: graded.score,
          maxScore: graded.maxScore,
          feedback: graded.feedback,
          breakdown: graded.breakdown,
          aiGrade: true,
          rubricStage: graded.rubricStage,
          gradedAt: new Date().toISOString(),
          gradedBy: `ClassCurio AI (Stage ${graded.rubricStage} rubric)`,
        };
        writeAll('results.json', fresh);
        touched = true;
      }
      if (touched) console.log(`[grader] AI graded result ${resultId}`);
    } catch (e) {
      console.error('[grader] background error', e);
    }
  });
}

// ---------- Results (student) — post-submission review ----------
// Returns the student's own submission with correct answers and any teacher feedback.
app.get('/api/results/student/:resultId', requireStudent, (req, res) => {
  const results = readAll('results.json');
  const result = results.find((r) => r.id === req.params.resultId);
  if (!result) return res.status(404).json({ error: 'Not found' });
  if (result.studentId !== req.session.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const assessments = readAll('assessments.json');
  const a = assessments.find((x) => x.id === result.assessmentId);
  if (!a) return res.status(404).json({ error: 'Assessment missing' });

  // Build per-question review with correct answers for auto-graded types,
  // and teacher-provided feedback for manual-graded types if present.
  const review = a.questions.map((q) => {
    const ans = (result.answers || []).find((x) => x.questionId === q.id) || {};
    const manual = (result.manualGrades || {})[q.id] || null;
    return {
      questionId: q.id,
      type: q.type,
      prompt: q.prompt,
      options: q.options || [],
      points: q.points,
      imageUrl: q.imageUrl || '',
      given: ans.given ?? null,
      correct: ans.correct ?? null,
      correctAnswer:
        (q.type === 'mc' || q.type === 'tf' || q.type === 'tfng' || (q.type === 'short' && q.correctAnswer))
          ? q.correctAnswer
          : null,
      explanation: q.explanation || null,
      manualGrade: manual, // { score, maxScore, feedback } or null
    };
  });

  // Compute final (auto + manual) scores.
  let manualScore = 0;
  let manualMax = 0;
  for (const q of a.questions) {
    if (q.type === 'essay' || q.type === 'writing' || q.type === 'long' || (q.type === 'short' && !q.correctAnswer)) {
      const m = (result.manualGrades || {})[q.id];
      if (m) {
        manualScore += Number(m.score) || 0;
        manualMax += Number(m.maxScore) || q.points;
      } else {
        manualMax += q.points;
      }
    }
  }

  res.json({
    assessmentId: a.id,
    assessmentTitle: a.title,
    term: a.term || null,
    academicYear: a.academicYear || null,
    teacherName: a.teacherName,
    studentName: result.studentName,
    studentEmail: result.studentEmail,
    submittedAt: result.submittedAt,
    startedAt: result.startedAt || null,
    autoScore: result.autoScore,
    autoMax: result.autoMax,
    manualScore,
    manualMax,
    totalScore: result.autoScore + manualScore,
    totalMax: result.autoMax + manualMax,
    teacherComment: result.teacherComment || '',
    review,
    awaitingReview: review.some((r) =>
      (r.type === 'essay' || r.type === 'writing' || r.type === 'long' || (r.type === 'short' && r.correctAnswer == null)) && !r.manualGrade
    ),
  });
});

// Teacher version of the same report — accessed by the assessment owner.
app.get('/api/results/teacher/:resultId', requireTeacher, (req, res) => {
  const results = readAll('results.json');
  const result = results.find((r) => r.id === req.params.resultId);
  if (!result) return res.status(404).json({ error: 'Not found' });

  const assessments = readAll('assessments.json');
  const a = assessments.find((x) => x.id === result.assessmentId);
  if (!a) return res.status(404).json({ error: 'Assessment missing' });
  if (a.teacherId !== req.session.user.id) return res.status(403).json({ error: 'Forbidden' });

  // Same review structure as the student endpoint, just authorized for the
  // teacher rather than the submitter.
  const review = a.questions.map((q) => {
    const ans = (result.answers || []).find((x) => x.questionId === q.id) || {};
    const manual = (result.manualGrades || {})[q.id] || null;
    return {
      questionId: q.id,
      type: q.type,
      prompt: q.prompt,
      options: q.options || [],
      points: q.points,
      imageUrl: q.imageUrl || '',
      given: ans.given ?? null,
      correct: ans.correct ?? null,
      correctAnswer:
        (q.type === 'mc' || q.type === 'tf' || q.type === 'tfng' || (q.type === 'short' && q.correctAnswer))
          ? q.correctAnswer
          : null,
      explanation: q.explanation || null,
      manualGrade: manual,
    };
  });

  let manualScore = 0;
  let manualMax = 0;
  for (const q of a.questions) {
    if (q.type === 'essay' || q.type === 'writing' || q.type === 'long' || (q.type === 'short' && !q.correctAnswer)) {
      const m = (result.manualGrades || {})[q.id];
      if (m) {
        manualScore += Number(m.score) || 0;
        manualMax += Number(m.maxScore) || q.points;
      } else {
        manualMax += q.points;
      }
    }
  }

  res.json({
    assessmentId: a.id,
    assessmentTitle: a.title,
    term: a.term || null,
    academicYear: a.academicYear || null,
    teacherName: a.teacherName,
    studentName: result.studentName,
    studentEmail: result.studentEmail,
    submittedAt: result.submittedAt,
    startedAt: result.startedAt || null,
    autoScore: result.autoScore,
    autoMax: result.autoMax,
    manualScore,
    manualMax,
    totalScore: result.autoScore + manualScore,
    totalMax: result.autoMax + manualMax,
    teacherComment: result.teacherComment || '',
    teacherCommentBy: result.teacherCommentBy || '',
    teacherCommentAt: result.teacherCommentAt || '',
    review,
    violations: result.violations || [],
    submitReason: result.submitReason || null,
  });
});

// List the current student's past submissions (id + title + date only).
app.get('/api/results/mine', requireStudent, (req, res) => {
  const mine = readAll('results.json')
    .filter((r) => r.studentId === req.session.user.id)
    .map((r) => ({
      id: r.id,
      assessmentId: r.assessmentId,
      assessmentTitle: r.assessmentTitle,
      submittedAt: r.submittedAt,
      autoScore: r.autoScore,
      autoMax: r.autoMax,
    }))
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  res.json({ results: mine });
});

// ---------- Results (teacher) ----------
app.get('/api/results/:assessmentId', requireTeacher, (req, res) => {
  const all = readAll('assessments.json');
  const a = all.find((x) => x.id === req.params.assessmentId);
  if (!a) return res.status(404).json({ error: 'Not found' });
  if (a.teacherId !== req.session.user.id) return res.status(403).json({ error: 'Forbidden' });
  const results = readAll('results.json').filter((r) => r.assessmentId === a.id);
  res.json({ assessment: a, results });
});

// Teacher assigns a manual grade to a single essay/short-answer question in a result.
app.post('/api/results/:resultId/grade-question', requireTeacher, (req, res) => {
  const { questionId, score, maxScore, feedback } = req.body || {};
  if (!questionId) return res.status(400).json({ error: 'questionId required' });

  const results = readAll('results.json');
  const rIdx = results.findIndex((r) => r.id === req.params.resultId);
  if (rIdx === -1) return res.status(404).json({ error: 'Result not found' });

  // Check the assessment belongs to this teacher.
  const assessments = readAll('assessments.json');
  const a = assessments.find((x) => x.id === results[rIdx].assessmentId);
  if (!a) return res.status(404).json({ error: 'Assessment missing' });
  if (a.teacherId !== req.session.user.id) return res.status(403).json({ error: 'Forbidden' });

  const q = a.questions.find((qq) => qq.id === questionId);
  if (!q) return res.status(400).json({ error: 'Question not in this assessment' });

  results[rIdx].manualGrades = results[rIdx].manualGrades || {};
  results[rIdx].manualGrades[questionId] = {
    score: Number(score) || 0,
    maxScore: Number(maxScore) || q.points,
    feedback: String(feedback || ''),
    gradedAt: new Date().toISOString(),
    gradedBy: req.session.user.name,
  };
  writeAll('results.json', results);
  res.json({ ok: true, manualGrades: results[rIdx].manualGrades });
});

// Teacher's overall narrative comment for a student's submission. Shows up
// on the report card alongside per-question feedback. Saved per result.
app.post('/api/results/:resultId/comment', requireTeacher, (req, res) => {
  const { comment } = req.body || {};
  const results = readAll('results.json');
  const idx = results.findIndex((r) => r.id === req.params.resultId);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  const assessments = readAll('assessments.json');
  const a = assessments.find((x) => x.id === results[idx].assessmentId);
  if (!a) return res.status(404).json({ error: 'Assessment missing' });
  if (a.teacherId !== req.session.user.id) return res.status(403).json({ error: 'Forbidden' });

  results[idx].teacherComment = String(comment || '').slice(0, 3000);
  results[idx].teacherCommentBy = req.session.user.name;
  results[idx].teacherCommentAt = new Date().toISOString();
  writeAll('results.json', results);
  res.json({ ok: true });
});

// Class-level analytics for one assessment. Returns stats, score
// distribution histogram, per-question difficulty, time on task.
app.get('/api/assessments/:id/analytics', requireTeacher, (req, res) => {
  const assessments = readAll('assessments.json');
  const a = assessments.find((x) => x.id === req.params.id);
  if (!a) return res.status(404).json({ error: 'Not found' });
  if (a.teacherId !== req.session.user.id) return res.status(403).json({ error: 'Forbidden' });

  const results = readAll('results.json').filter((r) => r.assessmentId === a.id);

  function totalFor(r) {
    const manual = Object.values(r.manualGrades || {})
      .reduce((s, g) => s + (Number(g.score) || 0), 0);
    return (r.autoScore || 0) + manual;
  }
  function maxFor(r) {
    const manualMax = Object.values(r.manualGrades || {})
      .reduce((s, g) => s + (Number(g.maxScore) || 0), 0);
    return (r.autoMax || 0) + manualMax;
  }

  if (!results.length) {
    return res.json({
      assessmentTitle: a.title,
      submissionCount: 0,
      mean: null, median: null, min: null, max: null, avgTimeMinutes: null,
      histogram: [],
      questions: a.questions.map((q) => ({
        id: q.id, type: q.type, prompt: q.prompt, points: q.points,
        attempted: 0, correctRate: null, mostCommonWrong: null,
      })),
    });
  }

  // Per-submission totals (and totals possible) for percentage calculations.
  const totals = results.map(totalFor);
  const possibles = results.map(maxFor);
  const percents = totals.map((t, i) => possibles[i] ? (t / possibles[i]) * 100 : 0);

  const sortedTotals = [...totals].sort((a, b) => a - b);
  const mean = totals.reduce((s, x) => s + x, 0) / totals.length;
  const median = sortedTotals.length % 2 === 1
    ? sortedTotals[Math.floor(sortedTotals.length / 2)]
    : (sortedTotals[sortedTotals.length / 2 - 1] + sortedTotals[sortedTotals.length / 2]) / 2;
  const min = sortedTotals[0];
  const max = sortedTotals[sortedTotals.length - 1];

  // Score distribution histogram in 10-percent buckets.
  const buckets = Array.from({ length: 10 }, (_, i) => ({
    label: `${i * 10}–${i * 10 + 9}%`,
    rangeStart: i * 10,
    count: 0,
  }));
  // Edge case: 100% goes in the top bucket.
  percents.forEach((p) => {
    let idx = Math.min(9, Math.floor(p / 10));
    if (idx < 0) idx = 0;
    buckets[idx].count++;
  });

  // Per-question difficulty.
  const questionStats = a.questions.map((q) => {
    const answers = results.map((r) => (r.answers || []).find((x) => x.questionId === q.id));
    const attempted = answers.filter(
      (x) => x && x.given !== null && x.given !== undefined && x.given !== ''
    ).length;
    let correctRate = null;
    let mostCommonWrong = null;

    if (q.type === 'mc' || q.type === 'tf' || q.type === 'tfng' || (q.type === 'short' && q.correctAnswer)) {
      const countable = answers.filter((x) => x).length;
      const correctCount = answers.filter((x) => x && x.correct === true).length;
      correctRate = countable > 0 ? correctCount / countable : null;

      if (q.type === 'mc') {
        const wrongCounts = {};
        answers.forEach((x) => {
          if (x && x.correct === false && x.given !== null && x.given !== undefined) {
            wrongCounts[x.given] = (wrongCounts[x.given] || 0) + 1;
          }
        });
        const top = Object.entries(wrongCounts).sort((a, b) => b[1] - a[1])[0];
        if (top) {
          const idx = Number(top[0]);
          mostCommonWrong = {
            optionIndex: idx,
            optionText: q.options[idx] || `Option ${idx + 1}`,
            count: top[1],
          };
        }
      }
    } else {
      // Manual-graded: % who scored at least half the available marks.
      const graded = results.filter((r) => (r.manualGrades || {})[q.id]);
      if (graded.length) {
        const passed = graded.filter((r) => {
          const g = r.manualGrades[q.id];
          return Number(g.score) >= Number(g.maxScore || q.points) / 2;
        }).length;
        correctRate = passed / graded.length;
      }
    }

    return {
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      points: q.points,
      attempted,
      correctRate,
      mostCommonWrong,
    };
  });

  // Average time on task in minutes (uses startedAt → submittedAt).
  const times = results
    .filter((r) => r.startedAt)
    .map((r) => (new Date(r.submittedAt).getTime() - new Date(r.startedAt).getTime()) / 60000)
    .filter((m) => m > 0 && m < 24 * 60); // sanity: 0 < t < 24h
  const avgTimeMinutes = times.length
    ? Math.round((times.reduce((s, x) => s + x, 0) / times.length) * 10) / 10
    : null;

  res.json({
    assessmentTitle: a.title,
    submissionCount: results.length,
    mean: Math.round(mean * 10) / 10,
    median: Math.round(median * 10) / 10,
    min,
    max,
    avgTimeMinutes,
    histogram: buckets,
    questions: questionStats,
  });
});

// List all submissions across this teacher's assessments that have
// ungraded essay / long-answer / short-answer (no expected answer) questions.
app.get('/api/essay-queue', requireTeacher, (req, res) => {
  const assessments = readAll('assessments.json')
    .filter((a) => a.teacherId === req.session.user.id);
  const byId = new Map(assessments.map((a) => [a.id, a]));
  const results = readAll('results.json').filter((r) => byId.has(r.assessmentId));

  const queue = [];
  for (const r of results) {
    const a = byId.get(r.assessmentId);
    for (const q of a.questions) {
      const needsManual =
        q.type === 'essay' ||
        q.type === 'writing' ||
        (q.type === 'short' && (!q.correctAnswer || !String(q.correctAnswer).trim()));
      if (!needsManual) continue;
      const grade = (r.manualGrades || {})[q.id];
      // Show items that are unscored OR scored only by AI (teacher review).
      // Hide once a human teacher has saved a grade (no aiGrade flag).
      if (grade && !grade.aiGrade) continue;
      const ans = (r.answers || []).find((x) => x.questionId === q.id);
      queue.push({
        resultId: r.id,
        assessmentId: a.id,
        assessmentTitle: a.title,
        studentName: r.studentName,
        studentEmail: r.studentEmail,
        submittedAt: r.submittedAt,
        questionId: q.id,
        questionType: q.type,
        questionPrompt: q.prompt,
        questionPoints: q.points,
        studentAnswer: ans ? ans.given : null,
        aiGrade: grade && grade.aiGrade ? {
          score: grade.score,
          maxScore: grade.maxScore,
          feedback: grade.feedback,
          breakdown: grade.breakdown || null,
          rubricStage: grade.rubricStage || null,
        } : null,
      });
    }
  }
  queue.sort((x, y) => (x.submittedAt || '').localeCompare(y.submittedAt || ''));
  res.json({ queue });
});

// ---------- Cross-assessment student reports (Phase 2) ----------

// Helper: build a list of submissions for a student, restricted to
// assessments owned by the given teacher, optionally filtered by term/year.
function buildStudentSubmissions({ teacherId, studentId, term, academicYear }) {
  const assessments = readAll('assessments.json').filter((a) => a.teacherId === teacherId);
  const byId = new Map(assessments.map((a) => [a.id, a]));
  const all = readAll('results.json').filter((r) =>
    r.studentId === studentId && byId.has(r.assessmentId)
  );

  const filtered = all.filter((r) => {
    const a = byId.get(r.assessmentId);
    if (term && a.term !== term) return false;
    if (academicYear && a.academicYear !== academicYear) return false;
    return true;
  });

  // Build the same enriched "review" structure as /api/results/teacher/:id
  // so the report can show per-question detail.
  const enriched = filtered.map((r) => {
    const a = byId.get(r.assessmentId);
    const review = a.questions.map((q) => {
      const ans = (r.answers || []).find((x) => x.questionId === q.id) || {};
      const manual = (r.manualGrades || {})[q.id] || null;
      return {
        questionId: q.id,
        type: q.type,
        prompt: q.prompt,
        options: q.options || [],
        points: q.points,
        given: ans.given ?? null,
        correct: ans.correct ?? null,
        manualGrade: manual,
      };
    });

    let manualScore = 0, manualMax = 0;
    for (const q of a.questions) {
      if (q.type === 'essay' || q.type === 'writing' || q.type === 'long' || (q.type === 'short' && !q.correctAnswer)) {
        const m = (r.manualGrades || {})[q.id];
        if (m) {
          manualScore += Number(m.score) || 0;
          manualMax += Number(m.maxScore) || q.points;
        } else {
          manualMax += q.points;
        }
      }
    }

    return {
      id: r.id,
      assessmentId: r.assessmentId,
      submittedAt: r.submittedAt,
      startedAt: r.startedAt,
      autoScore: r.autoScore || 0,
      autoMax: r.autoMax || 0,
      manualScore,
      manualMax,
      totalScore: (r.autoScore || 0) + manualScore,
      totalMax: (r.autoMax || 0) + manualMax,
      teacherComment: r.teacherComment || '',
      review,
    };
  });

  // Sort by date ascending (chronological progress).
  enriched.sort((x, y) => (x.submittedAt || '').localeCompare(y.submittedAt || ''));
  return { submissions: enriched, assessments, byId };
}

// Helper: precompute class min/mean/max for each assessment so per-student
// reports can show how the student compares.
function computeClassAverages(assessmentIds) {
  const allResults = readAll('results.json');
  const out = {};
  for (const aid of assessmentIds) {
    const submissions = allResults.filter((r) => r.assessmentId === aid);
    if (!submissions.length) continue;
    const totals = submissions.map((r) => {
      const m = Object.values(r.manualGrades || {}).reduce(
        (s, g) => s + (Number(g.score) || 0), 0
      );
      return (r.autoScore || 0) + m;
    });
    const maxes = submissions.map((r) => {
      const mx = Object.values(r.manualGrades || {}).reduce(
        (s, g) => s + (Number(g.maxScore) || 0), 0
      );
      return (r.autoMax || 0) + mx;
    });
    out[aid] = {
      mean: totals.reduce((s, x) => s + x, 0) / totals.length,
      min: Math.min(...totals),
      max: Math.max(...totals),
      maxPossible: maxes.length ? Math.max(...maxes) : 0,
      submissionCount: submissions.length,
    };
  }
  return out;
}

// List of all students who've submitted to any of this teacher's
// assessments, with submission counts.
app.get('/api/teachers/students', requireTeacher, (req, res) => {
  const teacherId = req.session.user.id;
  const myAssessmentIds = new Set(
    readAll('assessments.json')
      .filter((a) => a.teacherId === teacherId)
      .map((a) => a.id)
  );
  const allResults = readAll('results.json').filter((r) => myAssessmentIds.has(r.assessmentId));

  const byStudent = new Map();
  for (const r of allResults) {
    if (!byStudent.has(r.studentId)) {
      byStudent.set(r.studentId, {
        studentId: r.studentId,
        name: r.studentName,
        email: r.studentEmail,
        submissions: 0,
        lastSubmittedAt: null,
      });
    }
    const e = byStudent.get(r.studentId);
    e.submissions++;
    if (!e.lastSubmittedAt || r.submittedAt > e.lastSubmittedAt) {
      e.lastSubmittedAt = r.submittedAt;
    }
  }
  const students = Array.from(byStudent.values()).sort(
    (a, b) => a.name.localeCompare(b.name)
  );
  res.json({ students });
});

// JSON aggregated progress data for one student (for the teacher's web view).
app.get('/api/students/:studentId/progress', requireTeacher, (req, res) => {
  const teacherId = req.session.user.id;
  const term = req.query.term || null;
  const academicYear = req.query.year || null;

  const { submissions, byId } = buildStudentSubmissions({
    teacherId, studentId: req.params.studentId, term, academicYear,
  });

  if (!submissions.length) {
    return res.json({
      studentName: '', studentEmail: '', term, academicYear,
      submissions: [], rubricAverages: null, overall: null,
    });
  }

  // Get student name/email from any submission
  const allResults = readAll('results.json');
  const sample = allResults.find((r) => r.studentId === req.params.studentId);
  const studentName = sample ? sample.studentName : '';
  const studentEmail = sample ? sample.studentEmail : '';

  // Build per-submission summary with assessment metadata and rubric
  const rows = submissions.map((s) => {
    const a = byId.get(s.assessmentId);
    return {
      resultId: s.id,
      assessmentId: s.assessmentId,
      title: a ? a.title : '(deleted)',
      term: a ? a.term : null,
      academicYear: a ? a.academicYear : null,
      submittedAt: s.submittedAt,
      score: s.totalScore,
      max: s.totalMax,
      percent: s.totalMax > 0 ? s.totalScore / s.totalMax : 0,
      teacherComment: s.teacherComment,
      rubric: reports.rubricAverages(s),
    };
  });

  // Class averages for each assessment in scope
  const classAverages = computeClassAverages([...new Set(rows.map((r) => r.assessmentId))]);
  rows.forEach((r) => {
    const a = classAverages[r.assessmentId];
    r.classAverage = a ? a.mean / a.maxPossible : null;
  });

  // Overall student totals
  let totalScore = 0, totalMax = 0;
  for (const s of submissions) { totalScore += s.totalScore; totalMax += s.totalMax; }

  // Aggregate rubric averages across writing assessments
  const writingSubs = submissions.filter((s) => reports.rubricAverages(s));
  let aggRubric = null;
  if (writingSubs.length) {
    const sums = { content: 0, organisation: 0, grammar: 0, lexis: 0 };
    for (const s of writingSubs) {
      const av = reports.rubricAverages(s);
      sums.content += av.content;
      sums.organisation += av.organisation;
      sums.grammar += av.grammar;
      sums.lexis += av.lexis;
    }
    aggRubric = {
      content: sums.content / writingSubs.length,
      organisation: sums.organisation / writingSubs.length,
      grammar: sums.grammar / writingSubs.length,
      lexis: sums.lexis / writingSubs.length,
      submissionCount: writingSubs.length,
    };
  }

  res.json({
    studentName, studentEmail, term, academicYear,
    submissions: rows,
    rubricAverages: aggRubric,
    overall: {
      score: totalScore, max: totalMax,
      percent: totalMax > 0 ? totalScore / totalMax : 0,
      submissionCount: submissions.length,
    },
  });
});

// Allowed regional language codes for bilingual reports. Hardcoded labels
// exist for ar/hi/th; everything else uses Claude API to translate labels at
// runtime. The full list mirrors the dropdown in public/teacher.html.
const SUPPORTED_LANGS = new Set([
  'ar', 'hi', 'th', 'zh', 'es', 'fr',
  'bn', 'ur', 'ta', 'pa', 'te', 'ml',
  'id', 'ms', 'vi', 'tl', 'km',
  'ja', 'ko',
  'fa', 'tr', 'he', 'sw',
  'de', 'it', 'pt', 'ru', 'pl', 'nl',
]);

// Excel download per student. ?lang=<code> for bilingual mode.
app.get('/api/students/:studentId/excel-report', requireTeacher, async (req, res) => {
  const teacherId = req.session.user.id;
  const term = req.query.term || null;
  const academicYear = req.query.year || null;
  const secondLang = (req.query.lang || '').toLowerCase();

  const { submissions, byId } = buildStudentSubmissions({
    teacherId, studentId: req.params.studentId, term, academicYear,
  });

  if (!submissions.length) return res.status(404).send('No submissions in scope');

  const allResults = readAll('results.json');
  const sample = allResults.find((r) => r.studentId === req.params.studentId);
  if (!sample) return res.status(404).send('Student not found');

  const classAverages = computeClassAverages([...new Set(submissions.map((s) => s.assessmentId))]);

  const wb = await reports.generateStudentExcelReport({
    student: { name: sample.studentName, email: sample.studentEmail },
    submissions,
    assessmentsById: byId,
    classAverages,
    term,
    academicYear,
    teacherName: req.session.user.name,
    secondLang: SUPPORTED_LANGS.has(secondLang) ? secondLang : null,
  });

  const safeName = (sample.studentName || 'student').replace(/[^a-z0-9]/gi, '_');
  const safeTerm = term ? `_term${term}` : '';
  const safeLang = secondLang ? `_${secondLang}` : '';
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}${safeTerm}${safeLang}_report.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

// Word download per student. ?lang=<code> for bilingual mode.
app.get('/api/students/:studentId/word-report', requireTeacher, async (req, res) => {
  const teacherId = req.session.user.id;
  const term = req.query.term || null;
  const academicYear = req.query.year || null;
  const secondLang = (req.query.lang || '').toLowerCase();

  const { submissions, byId } = buildStudentSubmissions({
    teacherId, studentId: req.params.studentId, term, academicYear,
  });

  if (!submissions.length) return res.status(404).send('No submissions in scope');

  const allResults = readAll('results.json');
  const sample = allResults.find((r) => r.studentId === req.params.studentId);
  if (!sample) return res.status(404).send('Student not found');

  const classAverages = computeClassAverages([...new Set(submissions.map((s) => s.assessmentId))]);

  const doc = await reports.generateStudentWordReport({
    student: { name: sample.studentName, email: sample.studentEmail },
    submissions,
    assessmentsById: byId,
    classAverages,
    teacherName: req.session.user.name,
    term,
    academicYear,
    secondLang: SUPPORTED_LANGS.has(secondLang) ? secondLang : null,
  });

  const buffer = await Packer.toBuffer(doc);
  const safeName = (sample.studentName || 'student').replace(/[^a-z0-9]/gi, '_');
  const safeTerm = term ? `_term${term}` : '';
  const safeLang = secondLang ? `_${secondLang}` : '';
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}${safeTerm}${safeLang}_term_report.docx"`);
  res.send(buffer);
});

// ---------- Settings (teacher) — Anthropic API key for auto-grading ----------
const CONFIG_PATH = path.join(__dirname, '..', 'data', 'config.json');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {}
  return {};
}
function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
}

// GET — returns whether a key is configured (never the key itself).
app.get('/api/settings/grading', requireTeacher, (req, res) => {
  const hasKey = Boolean(readApiKey());
  res.json({
    aiGradingEnabled: hasKey,
    rubricStages: ['7', '8'],
  });
});

// POST — accept an API key from the teacher and persist it to data/config.json.
// Only the teacher who owns the file matters here; we store one key per server.
app.post('/api/settings/grading', requireTeacher, (req, res) => {
  const { anthropicApiKey } = req.body || {};
  if (typeof anthropicApiKey !== 'string') {
    return res.status(400).json({ error: 'anthropicApiKey must be a string' });
  }
  const cfg = loadConfig();
  if (anthropicApiKey.trim()) {
    cfg.anthropicApiKey = anthropicApiKey.trim();
  } else {
    delete cfg.anthropicApiKey;
  }
  saveConfig(cfg);
  res.json({ ok: true, aiGradingEnabled: Boolean(readApiKey()) });
});

// ---------- Excel scoresheet download (teacher) ----------
// Builds a .xlsx of all student results for this assessment.
app.get('/api/assessments/:id/scoresheet', requireTeacher, async (req, res) => {
  const assessments = readAll('assessments.json');
  const a = assessments.find((x) => x.id === req.params.id);
  if (!a) return res.status(404).send('Not found');
  if (a.teacherId !== req.session.user.id) return res.status(403).send('Forbidden');

  const results = readAll('results.json').filter((r) => r.assessmentId === a.id);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'ClassCurio';
  wb.created = new Date();

  const ws = wb.addWorksheet('Scoresheet');

  // Header row: fixed columns, then one column per question, then totals.
  const header = ['Student name', 'Email', 'Submitted at'];
  a.questions.forEach((q, i) => {
    header.push(`Q${i + 1} (${q.points} pt)`);
  });
  header.push('Auto score', 'Manual score', 'Total score', 'Total possible', 'Violations');
  ws.addRow(header);
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { vertical: 'middle', wrapText: true };

  // Data rows.
  for (const r of results) {
    const row = [
      r.studentName || '',
      r.studentEmail || '',
      r.submittedAt ? new Date(r.submittedAt) : '',
    ];

    let manualScore = 0;
    let manualMax = 0;

    for (const q of a.questions) {
      const ans = (r.answers || []).find((x) => x.questionId === q.id) || {};
      const manual = (r.manualGrades || {})[q.id];

      if (q.type === 'mc' || q.type === 'tf' || q.type === 'tfng') {
        row.push(ans.correct === true ? q.points : 0);
      } else if (q.type === 'short' && q.correctAnswer) {
        row.push(ans.correct === true ? q.points : 0);
      } else if (manual) {
        row.push(manual.score || 0);
        manualScore += Number(manual.score) || 0;
        manualMax += Number(manual.maxScore) || q.points;
      } else {
        row.push(''); // ungraded
        manualMax += q.points;
      }
    }

    const totalScore = (r.autoScore || 0) + manualScore;
    const totalMax = (r.autoMax || 0) + manualMax;

    row.push(
      r.autoScore || 0,
      manualScore,
      totalScore,
      totalMax,
      (r.violations || []).length
    );
    ws.addRow(row);
  }

  // Column widths — best-effort.
  ws.columns.forEach((col, i) => {
    if (i === 0) col.width = 22;       // name
    else if (i === 1) col.width = 28;  // email
    else if (i === 2) col.width = 20;  // submitted
    else col.width = 14;
  });

  // Freeze the header row.
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  const safeName = (a.title || 'scoresheet').replace(/[^a-z0-9\- _]/gi, '_').slice(0, 60);
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${safeName}-scoresheet.xlsx"`
  );
  await wb.xlsx.write(res);
  res.end();
});

// ---------- AI Assessment Generator ----------
// Teacher uploads a scheme-of-work file (optional) plus a natural-language
// prompt like "20 MCQs on photosynthesis for Grade 9 Biology". The server
// extracts text from any uploaded file, sends it together with the prompt to
// Claude, and asks Claude to return a structured JSON assessment that maps
// 1:1 to the existing question schema. Frontend opens the builder with the
// returned questions pre-filled — teacher reviews and saves.
//
// Cost: ~$0.01-0.10 per generation. Requires the teacher's Anthropic API key.
// Accept up to 20 scheme-of-work files. Each file is one of:
//   - PDF / Word / TXT → server extracts text via extractText() and embeds
//   - Screenshot (PNG / JPEG / GIF / WebP) → forwarded as a Claude Vision
//     image block so the model can read text from the screenshot AND see
//     diagrams, tables, formulas, calligraphy, etc.
app.post('/api/assessments/ai-generate', requireTeacher, upload.array('schemeOfWork', 20), async (req, res) => {
  const cleanupAll = () => {
    for (const f of (req.files || [])) {
      try { fs.unlinkSync(f.path); } catch {}
    }
  };

  const apiKey = readApiKey();
  if (!apiKey) {
    cleanupAll();
    return res.status(503).json({
      ok: false,
      error: 'AI generation requires an Anthropic API key. Open Settings on the dashboard and paste your key.',
    });
  }
  const prompt = String(req.body?.prompt || '').trim();
  const requestedCount = Math.max(1, Math.min(50, parseInt(req.body?.count, 10) || 10));
  const subject = String(req.body?.subject || '').trim();
  const language = String(req.body?.language || 'English').trim();
  const files = Array.isArray(req.files) ? req.files : [];
  if (!prompt && files.length === 0) {
    return res.status(400).json({
      ok: false,
      error: 'Either a prompt or a scheme-of-work file is required.',
    });
  }

  // Split uploaded files into text documents and screenshots.
  const imageBlocks = []; // Claude Vision blocks to append after the system prompt
  const textChunks = [];  // extracted text from PDFs / Word docs
  const skipped = [];     // for client-side error reporting

  const MAX_IMAGE_BYTES = 4 * 1024 * 1024;   // Claude caps single images at ~5MB
  const MAX_TOTAL_IMAGE_BYTES = 30 * 1024 * 1024; // overall safety cap
  let totalImageBytes = 0;

  for (const f of files) {
    const name = (f.originalname || '').toLowerCase();
    const mt = (f.mimetype || '').toLowerCase();

    try {
      if (mt.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(name)) {
        const stat = fs.statSync(f.path);
        if (stat.size > MAX_IMAGE_BYTES) {
          skipped.push(`${f.originalname} (image too large; over 4MB)`);
          continue;
        }
        if (totalImageBytes + stat.size > MAX_TOTAL_IMAGE_BYTES) {
          skipped.push(`${f.originalname} (total image quota exceeded)`);
          continue;
        }
        totalImageBytes += stat.size;
        const buf = fs.readFileSync(f.path);
        // Normalize media type. Anthropic supports png, jpeg, gif, webp.
        const media =
          mt.startsWith('image/') && mt !== 'image/svg+xml' ? mt :
          /\.png$/i.test(name) ? 'image/png' :
          /\.gif$/i.test(name) ? 'image/gif' :
          /\.webp$/i.test(name) ? 'image/webp' : 'image/jpeg';
        imageBlocks.push({
          type: 'image',
          source: { type: 'base64', media_type: media, data: buf.toString('base64') },
        });
      } else if (/\.(pdf|docx|doc|txt)$/i.test(name) || mt === 'application/pdf' ||
                 mt === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                 mt === 'text/plain') {
        const t = await extractText(f.path, f.mimetype, f.originalname);
        if (t && t.trim()) {
          textChunks.push({ name: f.originalname || 'document', text: t });
        } else {
          skipped.push(`${f.originalname} (no readable text found)`);
        }
        // Pull embedded images out of the PDF/DOCX and add them as Claude
        // Vision blocks alongside the text. Cap so we don't blow the
        // per-request payload limit.
        try {
          const docImgs = await extractMediaImages(f.path, f.mimetype, f.originalname);
          for (const img of docImgs) {
            if (totalImageBytes + img.buf.length > MAX_TOTAL_IMAGE_BYTES) break;
            totalImageBytes += img.buf.length;
            imageBlocks.push({
              type: 'image',
              source: { type: 'base64', media_type: img.media, data: img.buf.toString('base64') },
            });
          }
        } catch {}
      } else {
        skipped.push(`${f.originalname} (unsupported file type)`);
      }
    } catch (e) {
      skipped.push(`${f.originalname} (${e.message})`);
    }
  }

  cleanupAll();

  // Concatenate extracted text with file labels so Claude can keep them
  // straight. Cap total length to avoid blowing the token budget.
  let schemeText = '';
  if (textChunks.length) {
    let total = '';
    for (const c of textChunks) {
      total += `\n=== ${c.name} ===\n${c.text}\n`;
    }
    schemeText = total.length > 60000 ? total.slice(0, 60000) + '\n…[truncated]' : total;
  }

  // Build the prompt for Claude. We give a strict JSON schema and a tight
  // example so the model can't drift into prose responses.
  const systemPrompt = [
    'You are an expert classroom-assessment designer with deep experience reproducing exam papers EXACTLY as the teacher provides them.',
    'Generate ONE assessment as a JSON object that matches the schema below.',
    'Return ONLY the JSON object. Do not wrap it in markdown. Do not add commentary.',
    '',
    '=== TOP-LEVEL SCHEMA ===',
    '{',
    '  "title": "string — short, descriptive title (matches the title on the uploaded paper if present)",',
    '  "description": "string — 1-2 sentences describing the assessment",',
    '  "sections": [ Section, ... ],   // MUST include at least one section',
    '  "questions": [ Question, ... ]  // flat list; each question links to a section via sectionIndex',
    '}',
    '',
    '=== SECTION SCHEMA ===',
    '{',
    '  "title": "string — section heading verbatim from the source if provided (e.g. \\"Section A: Reading Comprehension\\", \\"Part 1\\", \\"Question 1\\")",',
    '  "instructions": "string — the EXACT instruction text from the source paper for this section, verbatim. Examples: \\"Read the passage and answer the questions below.\\", \\"Choose the correct option for each question.\\", \\"Answer ALL questions in complete sentences.\\". If no instructions exist, use a sensible default.",',
    '  "passage": "string — if the section has a reading passage / source text / extract / poem / story / case study / scenario, include it HERE, copied VERBATIM from the source. NEVER paraphrase or shorten. Leave empty string if the section has no passage."',
    '}',
    '',
    '=== QUESTION SCHEMA ===',
    '  Multiple choice:    { "type": "mc", "prompt": "...", "options": ["A","B","C","D"], "correctAnswer": 0, "points": 1, "sectionIndex": 0 }',
    '  True / False:       { "type": "tf", "prompt": "...", "correctAnswer": true, "points": 1, "sectionIndex": 0 }',
    '  True/False/NotGiven:{ "type": "tfng", "prompt": "...", "correctAnswer": "true|false|ng", "points": 1, "sectionIndex": 0 }',
    '  Short answer:       { "type": "short", "prompt": "...", "correctAnswer": "expected answer or empty string", "points": 1, "sectionIndex": 0 }',
    '  Long answer:        { "type": "long", "prompt": "...", "points": 5, "sectionIndex": 0 }',
    '  Essay (manual):     { "type": "essay", "prompt": "...", "points": 5, "sectionIndex": 0 }',
    '  Essay (auto rubric):{ "type": "writing", "prompt": "...", "points": 40, "sectionIndex": 0 }',
    '  sectionIndex is the 0-based index of the section this question belongs to in the "sections" array.',
    '',
    '=== HARD RULES THAT MUST BE FOLLOWED ===',
    '',
    'A. PRESERVE STRUCTURE FROM THE UPLOAD',
    '   - If the teacher uploaded a scheme of work or exam paper, MIRROR ITS STRUCTURE EXACTLY.',
    '   - Count the sections in the source. Reproduce the same number with the same titles.',
    '   - Use the same question types in the same order. Same number of questions per section if specified.',
    '   - Use the same point allocations if specified.',
    '   - If the source says "Section A — Reading (10 marks)", reproduce that section title and target ~10 marks.',
    '',
    'B. READING PASSAGES — EXTRACT OR INVENT',
    '   - When the source contains a reading passage, story, poem, news article, case study, source text, scenario, or extract, COPY IT INTO the "passage" field of the relevant section EXACTLY as written.',
    '   - DO NOT summarise, paraphrase, shorten, or rewrite an extracted passage. Copy character-for-character.',
    '   - Include the passage even if it is long (up to ~10 000 characters per section).',
    '   - The student will see this passage above the questions in that section.',
    '   - If the source has multiple passages (one per section), put each in its own section.',
    '',
    '   - INVENT a passage when no source provides one AND any of the following signals are present:',
    '       • the subject is "English", "Arabic", "French" (or any language)',
    '       • the teacher\'s prompt mentions "reading", "comprehension", "passage", "text", "story", "extract", "article", "poem", "non-fiction", "fiction", "vocabulary in context"',
    '       • the section title includes words like "Reading", "Comprehension", "Vocabulary"',
    '       • a question of type "mc", "tf", "tfng", "short" refers to "the passage", "the text", "the author", "the writer", "the article", "the story", "Line N", "paragraph N"',
    '   - When inventing a passage:',
    '       • Make it ORIGINAL — do not reproduce copyrighted text.',
    '       • Pitch the difficulty to the grade level if the prompt or source mentions one (e.g. "Grade 7 reading comprehension" → roughly 300-500 words; "Grade 11" → 500-800 words).',
    '       • Use age-appropriate vocabulary and sentence structures.',
    '       • Genre: match the prompt (fiction, non-fiction, biography, news article, poem, etc.). If unspecified, pick a topic that engages the target age group.',
    '       • Number paragraphs implicitly via line breaks so questions can refer to "paragraph 2", "Line 14", etc.',
    '       • Place the passage in the section\'s "passage" field. Tie every reading question in that section back to specific details, inferences, or vocabulary from the passage you wrote.',
    '   - It is BETTER to invent one solid passage than to write reading questions with no passage to anchor them. Reading questions without a passage are FORBIDDEN.',
    '',
    'C0. LISTENING ASSESSMENTS (subject == "Listening" OR prompt mentions listening)',
    '   - WRITE A FULL audioScript that the student will hear during the exam. The script is the WHOLE TRANSCRIPT — announcement, dialogue, monologue, news report, etc. — written verbatim as it should be spoken.',
    '   - Format dialogues with explicit speaker labels at the START of each line, followed by a colon. Use either "Speaker 1:", "Speaker 2:", … OR named roles like "Interviewer:", "Dr. Khan:", "Sarah:". Each turn starts on a NEW LINE. Each speaker uses the SAME label EVERY time they speak. Avoid stage directions.',
    '   - Length: roughly 150-250 words per minute of intended audio, scaled to grade level and questionCount.',
    '   - The questions must be answerable ONLY by listening to the audioScript (not by reading the page) — i.e. design like a real IELTS/PISA Listening section.',
    '   - Do NOT copy the audioScript into any section.passage. The script is heard, not seen.',
    '',
    'C. INSTRUCTIONS ARE NOT QUESTIONS',
    '   - Lines like "Read the following passage", "Answer all questions", "Use a separate sheet", "Spelling counts" are INSTRUCTIONS — put them in the section\'s "instructions" field. NEVER create a question with that text.',
    '   - Lines like "Section B: Writing", "Part 2", "Question 1" are SECTION TITLES — put them in "title".',
    '   - A question is something a student must answer. Instructions tell them HOW to answer.',
    '',
    'D. SECTIONS DEFAULT (when no upload)',
    '   - If the teacher provided no scheme of work AND the prompt does not request multiple parts, create ONE default section with an empty title, sensible default instructions ("Answer all questions"), and no passage. Put all questions in section index 0.',
    '   - HOWEVER, if the prompt requests reading comprehension or names parts/sections (e.g. "Part 1 Vocabulary, Part 2 Grammar, Part 3 Reading"), create those sections faithfully and write/extract a passage for each Reading section per rule B.',
    '',
    'E. QUESTION DETAILS',
    `   - Generate around ${requestedCount} questions unless the source/prompt specifies a different count.`,
    '   - For "mc": correctAnswer is the 0-based INDEX of the right option.',
    '   - For "tf": correctAnswer is true or false.',
    '   - For "tfng": correctAnswer is the string "true", "false", or "ng".',
    '   - For "short": include a concise correctAnswer when there is one canonical right answer.',
    '   - For "long" / "essay" / "writing": no correctAnswer field needed.',
    '   - Numbering: do NOT prepend "1.", "2.", etc. to the prompt — the front-end numbers questions automatically.',
    '',
    'F. OPTIONAL imageDescription FIELD on any question',
    '   Short (<80 words) description of a graphic that would help that question. Add only when a graphic genuinely helps comprehension.',
    '   Examples by subject: Math diagrams, Physics circuits, Chemistry molecules, Biology cells, Social Studies maps, Arabic calligraphy.',
    '',
    'G. LANGUAGE',
    `   All text — titles, instructions, passages, prompts, options, correctAnswer for short questions — must be in: ${language || 'English'}.`,
    subject ? `   Subject conventions: ${subject}. Use the standard format, vocabulary, and graphic types for this subject.` : '',
    '',
    '=== EXAMPLE OF GOOD OUTPUT (English Reading Comprehension exam) ===',
    '{',
    '  "title": "Grade 9 English — Mid-Term Reading Paper",',
    '  "description": "A 30-minute reading-comprehension assessment with two passages.",',
    '  "sections": [',
    '    { "title": "Section A: Reading Comprehension", "instructions": "Read the passage below carefully. Then answer questions 1-5.", "passage": "It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness... [full passage copied verbatim from source]" },',
    '    { "title": "Section B: Writing", "instructions": "Write a paragraph of at least 200 words on the topic below.", "passage": "" }',
    '  ],',
    '  "questions": [',
    '    { "type": "mc", "prompt": "What does the narrator mean by \\"the best of times\\"?", "options": ["A period of peace", "A period of contradictions", "A period of war", "A period of joy"], "correctAnswer": 1, "points": 1, "sectionIndex": 0 },',
    '    { "type": "writing", "prompt": "Discuss the theme of duality in the passage. Use evidence from the text.", "points": 40, "sectionIndex": 1 }',
    '  ]',
    '}',
    '',
    'Teacher\'s request:',
    prompt || '(no prompt — design a balanced assessment based on the scheme of work)',
  ].filter(Boolean).join('\n');

  const userContent = [
    { type: 'text', text: systemPrompt },
  ];
  if (schemeText && schemeText.trim()) {
    userContent.push({ type: 'text', text: '---\nScheme of work (extracted text):\n' + schemeText });
  }
  if (imageBlocks.length) {
    userContent.push({
      type: 'text',
      text: `---\nScheme of work (${imageBlocks.length} screenshot${imageBlocks.length === 1 ? '' : 's'}):\nRead the content of each screenshot below. The screenshots may include text, diagrams, tables, formulas, or handwritten notes — all relevant for generating the assessment.`,
    });
    for (const img of imageBlocks) {
      userContent.push(img);
    }
  }

  try {
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8192,
        messages: [{ role: 'user', content: userContent }],
      }),
    });
    if (!apiRes.ok) {
      const errText = await apiRes.text().catch(() => '');
      console.error('[ai-generate] API error', apiRes.status, errText);
      return res.status(502).json({ ok: false, error: 'AI service error: ' + apiRes.status });
    }
    const data = await apiRes.json();
    let text = (data.content || []).map((b) => b.type === 'text' ? b.text : '').join('').trim();
    // Strip markdown fences if Claude included them.
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.error('[ai-generate] failed to parse JSON', text.slice(0, 400));
      return res.status(502).json({ ok: false, error: 'AI returned an invalid response. Please try again.' });
    }

    // Normalise the sections array. We pass these to the client with a
    // generated id so the builder can link questions to sections via id.
    const aiSections = Array.isArray(parsed.sections) ? parsed.sections : [];
    const outSections = aiSections.map((s, i) => ({
      id: uuidv4(),
      title: String(s && s.title ? s.title : '').slice(0, 200),
      instructions: String(s && s.instructions ? s.instructions : '').slice(0, 4000),
      passage: String(s && s.passage ? s.passage : '').slice(0, 12000),
      order: i,
    }));
    // If Claude forgot to provide a sections array, synthesise one default
    // section so every question still has somewhere to live.
    if (!outSections.length) {
      outSections.push({
        id: uuidv4(),
        title: '',
        instructions: 'Answer all questions.',
        passage: String(parsed.passage || ''),
        order: 0,
      });
    }

    // Validate + normalize each question to match exactly what the builder expects.
    const validTypes = new Set(['mc', 'tf', 'tfng', 'short', 'long', 'essay', 'writing', 'match']);
    const questions = (Array.isArray(parsed.questions) ? parsed.questions : []).map((q) => {
      const type = validTypes.has(q.type) ? q.type : 'short';
      // Map AI's sectionIndex (0-based) → our generated sectionId.
      const sidx = Number.isFinite(q.sectionIndex) && q.sectionIndex >= 0 && q.sectionIndex < outSections.length
        ? q.sectionIndex
        : 0;
      const out = {
        type,
        prompt: String(q.prompt || ''),
        options: Array.isArray(q.options) ? q.options.map(String) : [],
        correctAnswer: null,
        points: Number(q.points) || (type === 'writing' ? 40 : type === 'essay' || type === 'long' ? 5 : 1),
        sectionId: outSections[sidx].id,
        imageDescription: typeof q.imageDescription === 'string' ? String(q.imageDescription).slice(0, 500) : '',
        imageUrl: '', // populated client-side after teacher uploads
      };
      if (type === 'mc') {
        if (!out.options.length) out.options = ['', '', '', ''];
        const idx = parseInt(q.correctAnswer, 10);
        out.correctAnswer = (idx >= 0 && idx < out.options.length) ? idx : 0;
      } else if (type === 'tf') {
        out.correctAnswer = q.correctAnswer === true || q.correctAnswer === 'true';
      } else if (type === 'tfng') {
        const v = String(q.correctAnswer ?? '').toLowerCase();
        out.correctAnswer = ['true', 'false', 'ng'].includes(v) ? v : 'true';
      } else if (type === 'short') {
        out.correctAnswer = q.correctAnswer ? String(q.correctAnswer) : '';
      }
      return out;
    }).filter((q) => q.prompt.trim());

    if (!questions.length) {
      return res.status(502).json({ ok: false, error: 'AI did not produce any usable questions. Please try a more specific prompt.' });
    }

    res.json({
      ok: true,
      title: String(parsed.title || 'AI-generated assessment').slice(0, 200),
      description: String(parsed.description || '').slice(0, 500),
      audioScript: String(parsed.audioScript || '').slice(0, 12000),
      // Top-level `passage` is kept for backward-compat — front-end now
      // prefers sections[].passage. We surface the first section's passage
      // for clients that still read it.
      passage: outSections[0]?.passage || '',
      sections: outSections,
      questions,
      filesProcessed: {
        text: textChunks.length,
        images: imageBlocks.length,
        skipped,
      },
    });
  } catch (e) {
    console.error('[ai-generate] failed', e);
    res.status(500).json({ ok: false, error: 'AI generation failed: ' + e.message });
  }
});

// ---------- Quick Import (PDF / DOCX / TXT → questions) ----------
app.post('/api/import', requireTeacher, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  // Pull the raw text out once. We'll either send it to Claude for full
  // structured parsing (preferred — captures every passage in a multi-passage
  // paper and groups questions by section) or fall back to the regex parser
  // (the old behaviour) when no API key is configured.
  let rawText = '';
  try {
    rawText = await extractText(req.file.path, req.file.mimetype, req.file.originalname);
  } catch (e) {
    try { fs.unlinkSync(req.file.path); } catch {}
    return res.status(500).json({ error: 'Could not read file: ' + e.message });
  }

  const apiKey = readApiKey();
  if (apiKey && rawText && rawText.trim().length > 40) {
    // ---- Claude path ----
    // Send the file's text to Claude with the SAME sections+passages schema
    // the AI generator uses. We instruct it to mirror the source exactly —
    // verbatim passages, original instructions, original question wording.
    try {
      const sys = [
        'You are an expert classroom-assessment digitiser. Convert the exam paper text below into a JSON object that exactly mirrors the source.',
        'Return ONLY the JSON object. No markdown fences. No commentary.',
        '',
        '{',
        '  "title": "string — exam title from the paper (or a sensible fallback)",',
        '  "sections": [ { "title": "string — section/part heading verbatim (e.g. \\"Part 1: Vocabulary\\", \\"Part 3A: Reading\\")", "instructions": "string — instruction text verbatim, or sensible default", "passage": "string — reading passage / source text VERBATIM if the section has one, else empty string" } ],',
        '  "questions": [ Question, ... ]',
        '}',
        '',
        'Question = ONE of:',
        '  { "type": "mc",    "prompt": "...", "options": ["A","B","C","D"], "correctAnswer": 0, "points": 1, "sectionIndex": 0 }',
        '  { "type": "tf",    "prompt": "...", "correctAnswer": true,  "points": 1, "sectionIndex": 0 }',
        '  { "type": "tfng",  "prompt": "...", "correctAnswer": "true|false|ng", "points": 1, "sectionIndex": 0 }',
        '  { "type": "short", "prompt": "...", "correctAnswer": "expected answer or empty string", "points": 1, "sectionIndex": 0 }',
        '  { "type": "long",  "prompt": "...", "points": 5, "sectionIndex": 0 }',
        '  { "type": "essay", "prompt": "...", "points": 5, "sectionIndex": 0 }',
        '  { "type": "match", "prompt": "Match the words on the left with their definitions on the right.", "matchVariant": "word-definition|word-word|word-picture", "pairs": [ { "left": "...", "right": "...", "rightImageUrl": "" } ], "points": <pair-count>, "sectionIndex": 0 }',
        '',
        'HARD RULES:',
        '1. Reproduce the paper EXACTLY. Do not invent, paraphrase, or shorten anything.',
        '2. Every section header / "Part N" / "Section X" in the paper becomes ONE section in the JSON.',
        '3. Every reading passage / source text / extract / story / poem / case study goes VERBATIM into the passage field of its section. Do not split a passage across sections. Do not put a passage into the questions array.',
        '4. Lines like "Read the following passage", "Choose the correct option", "Answer all questions" are INSTRUCTIONS — put them in the section\'s instructions field, NEVER as a question.',
        '5. Number EVERY question with sectionIndex (0-based index into the sections array).',
        '6. For "mc" questions, correctAnswer is the 0-based INDEX of the correct option (or 0 if not given).',
        '7. Do NOT prepend "1.", "Q1.", etc. to the prompt — the front-end numbers questions automatically.',
        '8. If the paper has no sections at all, create ONE section with empty title, sensible default instructions, and (only if the paper has a single reading passage) put it in that section\'s passage field.',
        '9. When the paper has "Match the following", "Match column A with column B", "Match the word to its meaning", or "Draw lines to connect", emit type "match" with the original pairs in the same order they appear. Use matchVariant "word-definition" for word/definition, "word-word" for word/word, or "word-picture" if the paper shows pictures (leave rightImageUrl as empty string — the teacher will upload pictures in the builder). NEVER convert match questions into multiple-choice.',
        '',
        'EXAM PAPER TEXT:',
        '"""',
        rawText.length > 60000 ? rawText.slice(0, 60000) + '\n…[truncated]' : rawText,
        '"""',
      ].join('\n');

      // Also extract any embedded images (or PDF page rasters) so Claude can
      // SEE the pictures. Important for match-with-picture questions and
      // any diagram-heavy paper.
      let mediaImages = [];
      try { mediaImages = await extractMediaImages(req.file.path, req.file.mimetype, req.file.originalname); } catch {}
      const userContent = [{ type: 'text', text: sys }];
      if (mediaImages.length) {
        userContent.push({ type: 'text', text: `\n---\nThe paper contains ${mediaImages.length} image${mediaImages.length === 1 ? '' : 's'}. Use them to reproduce match-with-picture questions, diagrams, and any visual elements. If a question shows pictures to be matched, emit type "match" with matchVariant "word-picture" and leave rightImageUrl empty (teacher uploads pictures in the builder).` });
        for (const img of mediaImages) {
          userContent.push({
            type: 'image',
            source: { type: 'base64', media_type: img.media, data: img.buf.toString('base64') },
          });
        }
      }
      const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 8192,
          messages: [{ role: 'user', content: userContent }],
        }),
      });

      if (apiRes.ok) {
        const data = await apiRes.json();
        let text = (data.content || []).map((b) => b.type === 'text' ? b.text : '').join('').trim();
        text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
        let parsed = null;
        try { parsed = JSON.parse(text); } catch { /* fall through to regex */ }

        if (parsed && Array.isArray(parsed.questions) && parsed.questions.length) {
          // Normalise sections.
          const aiSections = Array.isArray(parsed.sections) && parsed.sections.length
            ? parsed.sections
            : [{ title: '', instructions: '', passage: '' }];
          const sections = aiSections.map((s, i) => ({
            id: uuidv4(),
            title: String((s && s.title) || '').slice(0, 200),
            instructions: String((s && s.instructions) || '').slice(0, 4000),
            passage: String((s && s.passage) || '').slice(0, 12000),
            order: i,
          }));

          const validTypes = new Set(['mc', 'tf', 'tfng', 'short', 'long', 'essay', 'writing', 'match']);
          const questions = parsed.questions.map((q) => {
            const type = validTypes.has(q.type) ? q.type : 'short';
            const sidx = Number.isFinite(q.sectionIndex) && q.sectionIndex >= 0 && q.sectionIndex < sections.length
              ? q.sectionIndex
              : 0;
            const out = {
              type,
              prompt: String(q.prompt || ''),
              options: Array.isArray(q.options) ? q.options.map(String) : [],
              correctAnswer: null,
              points: Number(q.points) || (type === 'writing' ? 40 : (type === 'essay' || type === 'long' ? 5 : 1)),
              sectionId: sections[sidx].id,
            };
            if (type === 'mc') {
              if (!out.options.length) out.options = ['', '', '', ''];
              const idx = parseInt(q.correctAnswer, 10);
              out.correctAnswer = (idx >= 0 && idx < out.options.length) ? idx : 0;
            } else if (type === 'tf') {
              out.correctAnswer = q.correctAnswer === true || q.correctAnswer === 'true';
            } else if (type === 'tfng') {
              const v = String(q.correctAnswer ?? '').toLowerCase();
              out.correctAnswer = ['true', 'false', 'ng'].includes(v) ? v : 'true';
            } else if (type === 'short') {
              out.correctAnswer = q.correctAnswer ? String(q.correctAnswer) : '';
            } else if (type === 'match') {
              out.matchVariant = (q.matchVariant === 'word-word' || q.matchVariant === 'word-picture')
                ? q.matchVariant : 'word-definition';
              out.pairs = Array.isArray(q.pairs) ? q.pairs.slice(0, 30).map((p) => ({
                left:  String((p && p.left)  || ''),
                right: String((p && p.right) || ''),
                rightImageUrl: typeof (p && p.rightImageUrl) === 'string' ? p.rightImageUrl : '',
              })) : [];
              if (!out.points || out.points < out.pairs.length) out.points = Math.max(1, out.pairs.length);
            }
            return out;
          }).filter((q) => q.prompt.trim() || (q.type === 'match' && q.pairs && q.pairs.length));

          if (questions.length) {
            try { fs.unlinkSync(req.file.path); } catch {}
            return res.json({
              title: String(parsed.title || 'Imported assessment').slice(0, 200),
              sections,
              questions,
              // Legacy fallback — populate `passage` from the first section so
              // older clients that still read top-level `passage` keep working.
              passage: sections[0]?.passage || '',
              parsedBy: 'claude',
            });
          }
        }
      } else {
        console.warn('[import] Claude returned', apiRes.status, '— falling back to regex parser');
      }
    } catch (e) {
      console.warn('[import] Claude path failed, falling back to regex:', e.message);
    }
  }

  // ---- Regex fallback ----
  try {
    const { title, questions, passage } = await importFile(
      req.file.path,
      req.file.mimetype,
      req.file.originalname
    );
    try { fs.unlinkSync(req.file.path); } catch {}
    if (!questions.length) {
      return res.status(422).json({
        error: 'Could not detect any questions in this file. Make sure questions start with "1.", "Q1.", "1)", etc.',
        rawTextPreview: (rawText || '').slice(0, 400),
      });
    }
    res.json({ title, questions, passage: passage || '', parsedBy: 'regex' });
  } catch (e) {
    try { fs.unlinkSync(req.file.path); } catch {}
    res.status(500).json({ error: e.message });
  }
});

// ---------- Webcam proctor snapshots ----------
// Student posts a base64 JPEG every N seconds during an assessment.
app.post('/api/proctor/snapshot', requireStudent, (req, res) => {
  const { assessmentId, dataUrl, note } = req.body || {};
  if (!assessmentId || !dataUrl) return res.status(400).json({ error: 'Missing fields' });

  // data:image/jpeg;base64,AAAA...
  const m = /^data:image\/(jpeg|png);base64,(.+)$/.exec(dataUrl);
  if (!m) return res.status(400).json({ error: 'Invalid image data' });
  const buf = Buffer.from(m[2], 'base64');

  const folder = path.join(
    PROCTOR_DIR,
    `${req.session.user.id}__${assessmentId}`
  );
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const suffix = note ? `_${String(note).replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}` : '';
  const filename = `${ts}${suffix}.${m[1] === 'png' ? 'png' : 'jpg'}`;
  fs.writeFileSync(path.join(folder, filename), buf);
  res.json({ ok: true, filename });
});

// Teacher views all proctor snapshots for a given student's submission.
app.get('/api/proctor/:assessmentId/:studentId', requireTeacher, (req, res) => {
  const assessments = readAll('assessments.json');
  const a = assessments.find((x) => x.id === req.params.assessmentId);
  if (!a) return res.status(404).json({ error: 'Not found' });
  if (a.teacherId !== req.session.user.id) return res.status(403).json({ error: 'Forbidden' });

  const folder = path.join(PROCTOR_DIR, `${req.params.studentId}__${req.params.assessmentId}`);
  if (!fs.existsSync(folder)) return res.json({ snapshots: [] });

  const files = fs.readdirSync(folder)
    .filter((f) => /\.(jpe?g|png)$/i.test(f))
    .sort()
    .map((f) => ({
      filename: f,
      url: `/api/proctor/file/${req.params.assessmentId}/${req.params.studentId}/${encodeURIComponent(f)}`,
    }));
  res.json({ snapshots: files });
});

// Serves an individual proctor image (teacher only, with ownership check).
app.get('/api/proctor/file/:assessmentId/:studentId/:filename', requireTeacher, (req, res) => {
  const assessments = readAll('assessments.json');
  const a = assessments.find((x) => x.id === req.params.assessmentId);
  if (!a || a.teacherId !== req.session.user.id) return res.status(403).send('Forbidden');
  const folder = path.join(PROCTOR_DIR, `${req.params.studentId}__${req.params.assessmentId}`);
  const filePath = path.join(folder, path.basename(req.params.filename));
  if (!filePath.startsWith(folder)) return res.status(400).send('Bad path');
  if (!fs.existsSync(filePath)) return res.status(404).send('Not found');
  res.sendFile(filePath);
});

// ---------- Webcam identity check (Claude Vision) ----------
// Compares a baseline snapshot (taken at exam start) with a current snapshot
// to detect: (a) is a face visible in the current image, (b) is it the same
// person as the baseline. Used as the third pillar of webcam proctoring,
// alongside getUserMedia stream-end detection and dark-frame detection.
//
// Cost: ~$0.001-0.005 per call. With polling every 30-60s for a 30-min exam,
// expected per-exam cost is well under $0.10. Requires the same Anthropic
// API key the teacher already configured for AI essay grading.
app.post('/api/proctor/identity-check', requireStudent, async (req, res) => {
  const apiKey = readApiKey();
  if (!apiKey) {
    return res.status(503).json({
      ok: false,
      reason: 'no_api_key',
      // Soft-fail: client should treat as "skip this check" not as a violation,
      // so missing API key doesn't lock students out.
      faceVisible: true,
      samePerson: true,
    });
  }
  const { baselineDataUrl, currentDataUrl } = req.body || {};
  if (!baselineDataUrl || !currentDataUrl) {
    return res.status(400).json({ ok: false, reason: 'missing_images' });
  }

  // data:image/jpeg;base64,AAAA...
  const parse = (url) => {
    const m = /^data:image\/(jpeg|jpg|png);base64,(.+)$/.exec(url || '');
    return m ? { mediaType: `image/${m[1] === 'jpg' ? 'jpeg' : m[1]}`, data: m[2] } : null;
  };
  const base = parse(baselineDataUrl);
  const cur = parse(currentDataUrl);
  if (!base || !cur) return res.status(400).json({ ok: false, reason: 'bad_image' });

  const prompt = [
    'You are a remote-proctoring assistant for an online exam.',
    'I will send two images: BASELINE (taken when the student started) and CURRENT (taken just now).',
    'Compare them and respond with ONLY a JSON object, no other text:',
    '{',
    '  "faceVisible": true|false,        // is a clear human face visible in CURRENT?',
    '  "samePerson": true|false,         // is CURRENT the same person as BASELINE?',
    '  "otherPersonVisible": true|false, // is a SECOND person visible in CURRENT (anyone other than the student — leaning in, sitting beside, behind, etc.)?',
    '  "phoneVisible": true|false,       // is a phone, tablet, or hand-held camera visible in CURRENT, especially one being held up or pointed AT the screen (which suggests the student is photographing the test)?',
    '  "confidence": "low"|"medium"|"high"',
    '}',
    'Be conservative on samePerson: only set false if you are confident it is a different person. Lighting changes, head turns, and minor angle differences should still be samePerson=true.',
    'Be confident on otherPersonVisible: set true if you can clearly see a second human face, head, shoulder, or hand from another person. A reflection of the student in glasses or a wall poster of a face is NOT another person.',
    'Be confident on phoneVisible: set true if you can clearly see a smartphone, tablet, or camera in the frame — especially one held up toward the screen. A phone visible on a desk in the background that is not being used is NOT a violation; only flag when the device is in-hand or aimed at the screen.',
    'If you cannot tell whether a face is visible, default to faceVisible=true.',
    'If you are unsure about otherPersonVisible or phoneVisible, default to false (do not flag).',
  ].join('\n');

  try {
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'BASELINE:' },
            { type: 'image', source: { type: 'base64', media_type: base.mediaType, data: base.data } },
            { type: 'text', text: 'CURRENT:' },
            { type: 'image', source: { type: 'base64', media_type: cur.mediaType, data: cur.data } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });
    if (!apiRes.ok) {
      console.error('[proctor] API error', apiRes.status);
      // Soft-fail so a transient API issue doesn't lock students out.
      return res.json({ ok: false, reason: 'api_error', faceVisible: true, samePerson: true });
    }
    const data = await apiRes.json();
    const text = (data.content || []).map((b) => b.type === 'text' ? b.text : '').join('').trim();
    const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```\s*$/, '').trim();
    let parsed;
    try { parsed = JSON.parse(cleaned); } catch {
      return res.json({ ok: false, reason: 'bad_response', faceVisible: true, samePerson: true });
    }
    res.json({
      ok: true,
      faceVisible: parsed.faceVisible !== false,
      samePerson: parsed.samePerson !== false,
      otherPersonVisible: parsed.otherPersonVisible === true,
      phoneVisible: parsed.phoneVisible === true,
      confidence: parsed.confidence || 'medium',
    });
  } catch (e) {
    console.error('[proctor] identity-check failed', e.message);
    res.json({ ok: false, reason: 'exception', faceVisible: true, samePerson: true });
  }
});

// ---------- UI translation (Claude) ----------
// Translates dashboard UI strings on demand. Backed by an in-memory cache
// keyed by [lang|sourceText] so each unique string is translated exactly
// once per language across the whole server lifetime. Cheap after warm-up.
const uiTranslateCache = new Map(); // key = `${lang}::${str}` → translated
app.post('/api/translate-ui', requireAuth, async (req, res) => {
  const apiKey = readApiKey();
  if (!apiKey) return res.json({ ok: false, reason: 'no_api_key', translations: req.body?.strings || [] });

  const targetLang = String(req.body?.targetLang || '').toLowerCase().trim();
  const incoming = Array.isArray(req.body?.strings) ? req.body.strings : [];
  if (!targetLang || !incoming.length) {
    return res.json({ ok: true, translations: incoming });
  }
  // Normalize inputs and look each one up in the cache. Anything missing goes
  // into a "to translate" batch.
  const seen = new Map(); // index in incoming → cache key
  const toTranslate = [];
  const indexOfMissing = [];
  for (let i = 0; i < incoming.length; i++) {
    const s = String(incoming[i] || '');
    const key = `${targetLang}::${s}`;
    seen.set(i, key);
    if (!uiTranslateCache.has(key) && s.trim()) {
      indexOfMissing.push(i);
      toTranslate.push(s);
    } else if (!s.trim()) {
      uiTranslateCache.set(key, s);
    }
  }
  if (toTranslate.length) {
    try {
      const langName = ({
        ar: 'Arabic', hi: 'Hindi', th: 'Thai', zh: 'Mandarin Chinese (Simplified)',
        es: 'Spanish', fr: 'French', bn: 'Bengali', ur: 'Urdu', ta: 'Tamil',
        pa: 'Punjabi (Gurmukhi)', te: 'Telugu', ml: 'Malayalam', id: 'Indonesian',
        ms: 'Malay', vi: 'Vietnamese', tl: 'Filipino (Tagalog)', km: 'Khmer',
        ja: 'Japanese', ko: 'Korean', fa: 'Persian (Farsi)', tr: 'Turkish',
        he: 'Hebrew', sw: 'Swahili', de: 'German', it: 'Italian',
        pt: 'Portuguese', ru: 'Russian', pl: 'Polish', nl: 'Dutch',
      })[targetLang] || targetLang;

      const prompt = [
        `You are translating short UI labels for a classroom assessment app from English to ${langName}.`,
        `Return ONLY a JSON array of translated strings, same length and order as the input.`,
        `Rules:`,
        `- Preserve exact case for emails, URLs, file paths, file extensions (.docx, .pdf), product names, and short codes.`,
        `- Preserve any leading emoji or icon character at the start of a string unchanged.`,
        `- Numbers, dates, and times stay in Latin numerals — do not transliterate.`,
        `- If the input is just a number, an empty string, or a single punctuation mark, return it unchanged.`,
        `- Use a polite, professional register suitable for teachers.`,
        ``,
        `Input array:`,
        JSON.stringify(toTranslate),
      ].join('\n');

      const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (apiRes.ok) {
        const data = await apiRes.json();
        const text = (data.content || []).map((b) => b.type === 'text' ? b.text : '').join('').trim();
        const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```\s*$/, '').trim();
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed) && parsed.length === toTranslate.length) {
          for (let i = 0; i < toTranslate.length; i++) {
            const orig = toTranslate[i];
            uiTranslateCache.set(`${targetLang}::${orig}`, String(parsed[i] || orig));
          }
        }
      }
    } catch (e) {
      console.error('[translate-ui] failed', e.message);
      // Fall back: cache originals so we don't keep retrying.
      for (const s of toTranslate) {
        uiTranslateCache.set(`${targetLang}::${s}`, s);
      }
    }
  }
  // Build the output array using the cache.
  const out = incoming.map((s, i) => {
    const key = seen.get(i);
    return uiTranslateCache.has(key) ? uiTranslateCache.get(key) : s;
  });
  res.json({ ok: true, translations: out });
});

// ---------- VM / environment flag ----------
// Student's Electron preload calls this at the start of an assessment.
// We store it on the assessment result on submission, but also record
// it immediately so teacher can see early warnings.
const vmFlags = new Map(); // key: studentId__assessmentId, value: report
app.post('/api/proctor/environment', requireStudent, (req, res) => {
  const { assessmentId, report } = req.body || {};
  if (!assessmentId || !report) return res.status(400).json({ error: 'Missing fields' });
  vmFlags.set(`${req.session.user.id}__${assessmentId}`, {
    ...report,
    at: new Date().toISOString(),
  });
  res.json({ ok: true });
});

// ---------- Public share link: /take/:id ----------
// Anyone with this link lands here. We route them to the right place.
app.get('/take/:id', (req, res) => {
  const id = req.params.id;
  if (!req.session.user) {
    // Not signed in — send to login with a return-to.
    return res.redirect(`/?next=${encodeURIComponent('/take/' + id)}`);
  }
  if (req.session.user.role === 'teacher') {
    // Teachers can preview by going to their dashboard; we don't auto-take.
    return res.redirect('/teacher.html');
  }
  // Student — jump straight into the consent screen for this assessment.
  return res.redirect(`/student.html#take=${encodeURIComponent(id)}`);
});

// Static ----------
app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(PORT, () => {
  console.log(`[ClassCurio] listening on http://localhost:${PORT}`);
});
