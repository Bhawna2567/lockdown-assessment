// Lockdown Assessment — Express backend
// Serves the web UI and provides REST endpoints for auth, assessments, and results.
const fs = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const ExcelJS = require('exceljs');

const { readAll, writeAll } = require('./store');
const { importFile } = require('./importer');
const { gradeWriting, readApiKey } = require('./grader');
const reports = require('./reports');
const { Packer } = require('docx');

// Uploads go to a tmp dir; we delete after parsing.
const UPLOAD_DIR = path.join(__dirname, '..', 'data', 'uploads');
const PROCTOR_DIR = path.join(__dirname, '..', 'data', 'proctor');
for (const d of [UPLOAD_DIR, PROCTOR_DIR]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}
const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

const PORT = process.env.PORT || 3000;
const app = express();

// Larger limit to accept base64-encoded webcam JPEGs.
app.use(bodyParser.json({ limit: '15mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change-me-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 },
  })
);

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
  res.json({ user: req.session.user || null });
});

// ---------- Assessments (teacher) ----------
app.get('/api/assessments', requireAuth, (req, res) => {
  const all = readAll('assessments.json');
  if (req.session.user.role === 'teacher') {
    // Teachers see only their own
    return res.json(all.filter((a) => a.teacherId === req.session.user.id));
  }
  // Students see published assessments (sanitized — no correct answers)
  const visible = all
    .filter((a) => a.published)
    .map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      durationMinutes: a.durationMinutes,
      questionCount: a.questions.length,
      teacherName: a.teacherName,
    }));
  res.json(visible);
});

function normalizeTerm(t) {
  return t === '1' || t === '2' || t === '3' ? t : null;
}
function normalizeGrade(g) {
  const n = parseInt(g, 10);
  return n >= 1 && n <= 12 ? String(n) : null;
}

app.post('/api/assessments', requireTeacher, (req, res) => {
  const {
    title, description, durationMinutes, questions, published,
    passage, rubricStage, term, academicYear, scheduledDate, grade,
  } = req.body || {};
  if (!title || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'Title and at least one question required' });
  }
  const assessment = {
    id: uuidv4(),
    teacherId: req.session.user.id,
    teacherName: req.session.user.name,
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
    questions: questions.map((q, i) => ({
      id: q.id || uuidv4(),
      order: i,
      type: q.type, // 'mc' | 'tf' | 'short' | 'essay' | 'writing'
      prompt: q.prompt,
      options: q.options || [], // for mc
      correctAnswer: q.correctAnswer ?? null, // mc index, tf bool, short string
      points: Number(q.points) || 1,
    })),
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
  } = req.body || {};
  const updated = {
    ...all[idx],
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
    questions: Array.isArray(questions)
      ? questions.map((q, i) => ({
          id: q.id || uuidv4(),
          order: i,
          type: q.type,
          prompt: q.prompt,
          options: q.options || [],
          correctAnswer: q.correctAnswer ?? null,
          points: Number(q.points) || 1,
        }))
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

// ---------- Student assessment flow ----------
// Fetch one assessment for taking — strips correct answers
app.get('/api/assessments/:id/take', requireStudent, (req, res) => {
  const all = readAll('assessments.json');
  const a = all.find((x) => x.id === req.params.id && x.published);
  if (!a) return res.status(404).json({ error: 'Not found' });

  // Ensure the student hasn't already submitted
  const results = readAll('results.json');
  const already = results.find(
    (r) => r.studentId === req.session.user.id && r.assessmentId === a.id
  );
  if (already) return res.status(403).json({ error: 'You have already submitted this assessment.' });

  const safe = {
    id: a.id,
    title: a.title,
    description: a.description,
    passage: a.passage || '',
    rubricStage: a.rubricStage || null,
    durationMinutes: a.durationMinutes,
    teacherName: a.teacherName,
    questions: a.questions.map((q) => ({
      id: q.id,
      order: q.order,
      type: q.type,
      prompt: q.prompt,
      options: q.options,
      points: q.points,
    })),
  };
  res.json({ assessment: safe });
});

// Submit answers — auto-grades MC/TF and stores everything else for teacher review
app.post('/api/assessments/:id/submit', requireStudent, (req, res) => {
  const all = readAll('assessments.json');
  const a = all.find((x) => x.id === req.params.id && x.published);
  if (!a) return res.status(404).json({ error: 'Not found' });

  const { answers, violations, startedAt } = req.body || {};
  const results = readAll('results.json');

  // Block re-submission
  if (results.find((r) => r.studentId === req.session.user.id && r.assessmentId === a.id)) {
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
    } else if (q.type === 'short' && q.correctAnswer) {
      // Case-insensitive exact match as a soft auto-grade
      autoMax += q.points;
      correct =
        typeof given === 'string' &&
        given.trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
      if (correct) autoScore += q.points;
    }
    return {
      questionId: q.id,
      given: given ?? null,
      correct, // null for essay / ungradable
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
    environment: vmFlags.get(envKey) || null,
    answers: gradedAnswers,
    manualGrades: {},
  };
  vmFlags.delete(envKey);
  results.push(result);
  writeAll('results.json', results);

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
      if (!a || !a.rubricStage) return;

      const writingQs = a.questions.filter((q) => q.type === 'writing' || q.type === 'essay');
      if (!writingQs.length) return;

      let touched = false;
      for (const q of writingQs) {
        const ans = (r.answers || []).find((x) => x.questionId === q.id);
        const essay = ans ? String(ans.given || '') : '';
        if (!essay.trim()) continue;
        const graded = await gradeWriting({
          rubricStage: a.rubricStage,
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
      given: ans.given ?? null,
      correct: ans.correct ?? null,
      correctAnswer:
        (q.type === 'mc' || q.type === 'tf' || (q.type === 'short' && q.correctAnswer))
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
    if (q.type === 'essay' || q.type === 'writing' || (q.type === 'short' && !q.correctAnswer)) {
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
      (r.type === 'essay' || r.type === 'writing' || (r.type === 'short' && r.correctAnswer == null)) && !r.manualGrade
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
      given: ans.given ?? null,
      correct: ans.correct ?? null,
      correctAnswer:
        (q.type === 'mc' || q.type === 'tf' || (q.type === 'short' && q.correctAnswer))
          ? q.correctAnswer
          : null,
      explanation: q.explanation || null,
      manualGrade: manual,
    };
  });

  let manualScore = 0;
  let manualMax = 0;
  for (const q of a.questions) {
    if (q.type === 'essay' || q.type === 'writing' || (q.type === 'short' && !q.correctAnswer)) {
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

    if (q.type === 'mc' || q.type === 'tf' || (q.type === 'short' && q.correctAnswer)) {
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
      if (q.type === 'essay' || q.type === 'writing' || (q.type === 'short' && !q.correctAnswer)) {
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

// Excel download per student. ?lang=ar|hi|th|en for bilingual mode.
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
    secondLang: ['ar', 'hi', 'th'].includes(secondLang) ? secondLang : null,
  });

  const safeName = (sample.studentName || 'student').replace(/[^a-z0-9]/gi, '_');
  const safeTerm = term ? `_term${term}` : '';
  const safeLang = secondLang ? `_${secondLang}` : '';
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}${safeTerm}${safeLang}_report.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

// Word download per student. ?lang=ar|hi|th|en for bilingual mode.
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
    secondLang: ['ar', 'hi', 'th'].includes(secondLang) ? secondLang : null,
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

      if (q.type === 'mc' || q.type === 'tf') {
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

// ---------- Quick Import (PDF / DOCX / TXT → questions) ----------
app.post('/api/import', requireTeacher, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const { title, questions, passage, rawText } = await importFile(
      req.file.path,
      req.file.mimetype,
      req.file.originalname
    );
    // Clean up the uploaded file — we only persist the parsed output.
    try { fs.unlinkSync(req.file.path); } catch {}
    if (!questions.length) {
      return res.status(422).json({
        error: 'Could not detect any questions in this file. Make sure questions start with "1.", "Q1.", "1)", etc.',
        rawTextPreview: rawText.slice(0, 400),
      });
    }
    res.json({ title, questions, passage: passage || '' });
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
