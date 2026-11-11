// ════════════════════════════════════════════════════════════════════════
//  📄 Mark paper scripts
//  The teacher uploads photos / PDFs of a class's handwritten scripts for an
//  assessment. The AI reads each page (student name, which question, the
//  handwriting), groups the pages into one script per student, matches the
//  name to the class list and marks every writing question with that
//  question's rubric. The teacher reviews and approves; each student then
//  gets a normal result (Results, Class Averages, skills reports), and a
//  marked PDF is saved in the class's writing folder.
// ════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

module.exports = function paper(app, d) {
  const { requireTeacher, readAll, writeAll, upload, asyncJob, claudeFetch, gradeWriting, getSpecRubric, uuid, bcrypt, tempPassword,
    dataDir, folders } = d;
  const ROOT = path.join(dataDir, 'paper-scripts');
  const BATCHES = 'paper-batches.json';
  const ensure = (p) => { try { fs.mkdirSync(p, { recursive: true }); } catch (e) {} };
  const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  const WRITING = new Set(['writing', 'essay', 'long']);

  function ownAssessment(req, res) {
    const a = readAll('assessments.json').find((x) => x.id === req.params.aid);
    if (!a) { res.status(404).json({ error: 'Assessment not found' }); return null; }
    if (a.teacherId !== req.session.user.id) { res.status(403).json({ error: 'Forbidden' }); return null; }
    return a;
  }
  function classList(a) {
    const cls = readAll('classes.json').find((c) => c.id === a.classId);
    const users = readAll('users.json');
    const byEmail = new Map(users.filter((u) => u.role === 'student').map((u) => [String(u.email || '').toLowerCase(), u]));
    const out = [];
    for (const r of (cls && cls.roster) || []) {
      const email = String(r.email || '').toLowerCase();
      const u = email ? byEmail.get(email) : null;
      // key: the email, or the name for class-list entries without an email (these can't get an account)
      out.push({ key: email || ('name:' + norm(r.name)), name: r.name || (u && u.name) || email, email, studentId: u ? u.id : '', hasAccount: !!u });
    }
    return { cls, students: out };
  }
  // Best class-list match for a name read from the paper (word overlap).
  function matchName(read, students) {
    const w = norm(read).split(' ').filter((x) => x.length > 1);
    if (!w.length) return null;
    let best = null, bestScore = 0;
    for (const s of students) {
      const sw = norm(s.name).split(' ').filter((x) => x.length > 1);
      if (!sw.length) continue;
      let hit = 0;
      for (const x of w) if (sw.some((y) => y === x || (x.length > 3 && (y.startsWith(x) || x.startsWith(y))))) hit++;
      const score = hit / Math.max(w.length, Math.min(sw.length, 3));
      if (score > bestScore) { bestScore = score; best = s; }
    }
    return bestScore >= 0.5 ? Object.assign({ confidence: Math.round(bestScore * 100) }, best) : null;
  }
  const writingQs = (a) => (a.questions || []).filter((q) => WRITING.has(q.type));
  // Label for a writing question: its MOE task number if it has one, else "Writing 1", "Writing 2"…
  const qLabel = (a, q) => (q.specTask ? 'Task ' + q.specTask : 'Writing ' + (writingQs(a).indexOf(q) + 1));
  const labelKey = (x) => String(x || '').toLowerCase().replace(/^(task|writing|question|q)\s*/, '').replace(/[^0-9a-z.]/g, '');

  // ── 1) Upload and read every page, then mark ──
  app.post('/api/paper/:aid/scripts', requireTeacher, upload.array('files', 150), asyncJob, async (req, res) => {
    const files = req.files || [];
    const cleanup = () => files.forEach((f) => { try { fs.unlinkSync(f.path); } catch (e) {} });
    const a = ownAssessment(req, res);
    if (!a) return cleanup();
    const wq = writingQs(a);
    if (!wq.length) { cleanup(); return res.status(400).json({ error: 'This assessment has no writing questions to mark.' }); }
    if (!files.length) return res.status(400).json({ error: 'Choose the photos or PDFs of the scripts.' });
    try {
      const batchId = 'pb-' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
      const dir = path.join(ROOT, batchId); ensure(dir);
      // Keep the upload order (the teacher's order of pages); split PDFs into pages.
      files.sort((x, y) => String(x.originalname).localeCompare(String(y.originalname), undefined, { numeric: true }));
      const pages = [];
      let PDFDocument = null; try { ({ PDFDocument } = require('pdf-lib')); } catch (e) {}
      for (const f of files) {
        const buf = fs.readFileSync(f.path);
        const isPdf = buf.slice(0, 4).toString() === '%PDF';
        const isImg = /^image\/(jpe?g|png|webp|gif)$/i.test(f.mimetype || '');
        if (isPdf && PDFDocument) {
          const src = await PDFDocument.load(buf, { ignoreEncryption: true }).catch(() => null);
          const n = src ? src.getPageCount() : 0;
          for (let i = 0; i < Math.min(n, 60); i++) {
            const out = await PDFDocument.create(); const [pg] = await out.copyPages(src, [i]); out.addPage(pg);
            const id = 'p' + (pages.length + 1); fs.writeFileSync(path.join(dir, id + '.pdf'), Buffer.from(await out.save()));
            pages.push({ id, kind: 'pdf', mime: 'application/pdf', file: id + '.pdf', source: f.originalname + ' p' + (i + 1) });
          }
        } else if (isImg) {
          if (buf.length > 4.8e6) continue; // too big for the AI — the browser shrinks photos before upload
          const ext = /png/i.test(f.mimetype) ? 'png' : /webp/i.test(f.mimetype) ? 'webp' : /gif/i.test(f.mimetype) ? 'gif' : 'jpg';
          const id = 'p' + (pages.length + 1); fs.writeFileSync(path.join(dir, id + '.' + ext), buf);
          pages.push({ id, kind: 'image', mime: ext === 'jpg' ? 'image/jpeg' : 'image/' + ext, file: id + '.' + ext, source: f.originalname });
        }
      }
      cleanup();
      if (!pages.length) return res.status(400).json({ error: 'None of the files could be read. Upload photos (JPG/PNG) or PDFs.' });

      // Read every page: name on the page, which question(s), transcription.
      const qList = wq.map((q) => `${qLabel(a, q)}: ${String(q.prompt || '').replace(/\s+/g, ' ').slice(0, 300)}`).join('\n');
      const readPage = async (p) => {
        const buf = fs.readFileSync(path.join(dir, p.file));
        const block = p.kind === 'pdf'
          ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buf.toString('base64') } }
          : { type: 'image', source: { type: 'base64', media_type: p.mime, data: buf.toString('base64') } };
        const tool = { name: 'submit_page', description: 'What is on this page.', input_schema: { type: 'object', required: ['studentName', 'parts'], properties: {
          studentName: { type: 'string', description: 'The student name written on this page, exactly as written; empty if no name on this page.' },
          readable: { type: 'boolean', description: 'false if the handwriting or photo is too unclear to read reliably' },
          parts: { type: 'array', items: { type: 'object', required: ['question', 'text'], properties: {
            question: { type: 'string', description: 'Which writing task this answers — use the label from the list exactly, e.g. ' + wq.map((q) => JSON.stringify(qLabel(a, q))).join(' or ') },
            text: { type: 'string', description: 'The student\'s handwriting transcribed word for word — keep their spelling, grammar and punctuation mistakes; write [?] for an unreadable word' } } } },
        } } };
        const r = await claudeFetch({ max_tokens: 4000, messages: [{ role: 'user', content: [block, { type: 'text', text:
          `This is one page of a student's handwritten answers to an exam. The writing questions are:\n${qList}\n\nRead the page. Give the student's name if it is written on this page, and transcribe each answer word for word under the writing task it answers (decide from what the student wrote and any numbers on the page; label it exactly as in the list above). Do not correct anything. Ignore the printed question text — transcribe only what the student wrote. Submit with submit_page.` }] }],
          tools: [tool], tool_choice: { type: 'tool', name: 'submit_page' } }, 'smart');
        if (!r || !r.ok) throw new Error('AI service error ' + (r ? r.status : ''));
        const j = await r.json();
        const blk = (j.content || []).find((x) => x.type === 'tool_use');
        return (blk && blk.input) || { studentName: '', parts: [] };
      };
      const results = [];
      for (let i = 0; i < pages.length; i += 4) {   // four pages at a time
        const chunk = pages.slice(i, i + 4);
        const got = await Promise.all(chunk.map((p) => readPage(p).catch((e) => ({ error: e.message, studentName: '', parts: [] }))));
        got.forEach((g, k) => results.push(Object.assign({ page: chunk[k] }, g)));
      }
      // Group pages into scripts: a page with a (new) name starts a script.
      const { students } = classList(a);
      const scripts = [];
      for (const r of results) {
        const name = String(r.studentName || '').trim();
        const cur = scripts[scripts.length - 1];
        if (!cur || (name && norm(name) !== norm(cur.nameRead))) scripts.push({ id: 's' + (scripts.length + 1), nameRead: name, pages: [], text: {}, flags: [] });
        const s = scripts[scripts.length - 1];
        s.pages.push(r.page.id);
        if (r.error) s.flags.push(`Page ${r.page.source} could not be read (${r.error}).`);
        if (r.readable === false) s.flags.push(`Handwriting on ${r.page.source} is hard to read — please check.`);
        for (const part of r.parts || []) {
          const key = labelKey(part.question);
          const q = wq.find((x) => labelKey(qLabel(a, x)) === key) || (wq.length === 1 ? wq[0] : null);
          if (!q) continue;
          s.text[q.id] = ((s.text[q.id] || '') + '\n' + String(part.text || '')).trim();
        }
      }
      // Match names and mark each answer with its rubric.
      for (const s of scripts) {
        const m = matchName(s.nameRead, students);
        s.match = m ? { key: m.key, email: m.email, name: m.name, studentId: m.studentId, hasAccount: m.hasAccount, confidence: m.confidence } : null;
        if (!s.nameRead) s.flags.push('No name found on the first page.');
        else if (!m) s.flags.push(`"${s.nameRead}" does not match anyone on the class list.`);
        s.grades = {};
        await Promise.all(wq.map(async (q) => {
          const text = s.text[q.id] || '';
          if (!text.trim()) { s.flags.push(`No answer found for ${qLabel(a, q)}.`); s.grades[q.id] = { score: 0, maxScore: Number(q.points) || 0, feedback: 'No answer found on the script.', breakdown: null }; return; }
          const rub = q.rubricId ? getSpecRubric(q.rubricId) : null;
          const sec = (a.sections || []).find((x) => x.id === q.sectionId);
          const stage = ['7', '8', '3-5', '5-9'].includes(String(a.rubricStage)) ? String(a.rubricStage) : '8';
          const g = await gradeWriting({ rubric: rub, rubricStage: stage, context: sec && sec.passage, prompt: q.prompt, essay: text, maxScore: q.points }).catch((e) => ({ ok: false, detail: e.message }));
          if (!g || !g.ok) { s.flags.push(`${qLabel(a, q)} could not be marked automatically — enter the mark yourself.`); s.grades[q.id] = { score: '', maxScore: Number(q.points) || 0, feedback: '', breakdown: null }; return; }
          // Rubrics scored out of 40/12 are scaled to the question's own marks.
          const max = Number(q.points) || g.maxScore;
          const f = g.maxScore ? max / g.maxScore : 1;
          const bd = {};
          for (const [k, v] of Object.entries(g.breakdown || {})) bd[k] = Object.assign({}, v, { score: Math.round(v.score * f * 10) / 10, max: Math.round(v.max * f * 10) / 10 });
          s.grades[q.id] = { score: Math.round(g.score * f * 2) / 2, maxScore: max, feedback: g.feedback, breakdown: bd, rubricStage: g.rubricStage };
        }));
      }
      const batch = { id: batchId, assessmentId: a.id, teacherId: req.session.user.id, createdAt: new Date().toISOString(), status: 'review', pages, scripts };
      const all = readAll(BATCHES); all.push(batch); writeAll(BATCHES, all.slice(-200));
      res.json({ ok: true, batch: publicBatch(batch, a) });
    } catch (e) {
      cleanup();
      console.error('[paper] failed', e);
      res.status(500).json({ ok: false, error: 'Reading the scripts failed: ' + e.message });
    }
  });

  function publicBatch(b, a) {
    const { students } = classList(a);
    return { id: b.id, status: b.status, createdAt: b.createdAt, assessmentId: b.assessmentId,
      questions: writingQs(a).map((q) => ({ id: q.id, label: qLabel(a, q), points: q.points, prompt: String(q.prompt || '').slice(0, 200) })),
      students, pages: b.pages.map((p) => ({ id: p.id, kind: p.kind, source: p.source })), scripts: b.scripts };
  }
  const ownBatch = (req, res) => {
    const b = readAll(BATCHES).find((x) => x.id === req.params.bid);
    if (!b || b.teacherId !== req.session.user.id) { res.status(404).json({ error: 'Not found' }); return null; }
    return b;
  };
  app.get('/api/paper/batches/:bid', requireTeacher, (req, res) => {
    const b = ownBatch(req, res); if (!b) return;
    const a = readAll('assessments.json').find((x) => x.id === b.assessmentId);
    res.json({ batch: publicBatch(b, a || { questions: [] }) });
  });
  app.get('/api/paper/batches/:bid/pages/:pid', requireTeacher, (req, res) => {
    const b = ownBatch(req, res); if (!b) return;
    const p = b.pages.find((x) => x.id === req.params.pid);
    if (!p) return res.status(404).end();
    res.setHeader('Content-Type', p.mime); res.setHeader('Cache-Control', 'private, max-age=3600');
    fs.createReadStream(path.join(ROOT, b.id, p.file)).pipe(res);
  });

  // ── 2) Approve: results for each student + marked PDFs in the class folder ──
  app.post('/api/paper/batches/:bid/approve', requireTeacher, async (req, res) => {
    const all = readAll(BATCHES);
    const b = all.find((x) => x.id === req.params.bid && x.teacherId === req.session.user.id);
    if (!b) return res.status(404).json({ error: 'Not found' });
    const a = readAll('assessments.json').find((x) => x.id === b.assessmentId);
    if (!a) return res.status(404).json({ error: 'Assessment missing' });
    const wq = writingQs(a);
    const body = req.body || {};
    const decisions = Array.isArray(body.scripts) ? body.scripts : [];
    const users = readAll('users.json');
    const { cls, students } = classList(a);
    const resultsAll = readAll('results.json');
    const created = [], saved = [], skipped = [];
    for (const dcs of decisions) {
      const s = b.scripts.find((x) => x.id === dcs.id);
      if (!s || dcs.skip) { if (s) skipped.push(s.nameRead || s.id); continue; }
      const st = students.find((x) => x.key === String(dcs.key || ''));
      if (!st) { skipped.push((s.nameRead || s.id) + ' (no student chosen)'); continue; }
      const email = st.email;
      if (!email) { skipped.push(st.name + ' (no email on the class list, so no account can be made)'); continue; }
      let u = users.find((x) => String(x.email || '').toLowerCase() === email && x.role === 'student');
      if (!u) {   // on the class list but no account yet: create one (temporary password, changed at first sign-in)
        if (!body.createAccounts) { skipped.push(st.name + ' (no account)'); continue; }
        const pw = tempPassword(10);
        u = { id: uuid(), name: st.name, email, role: 'student', studentNumber: '', passwordHash: await bcrypt.hash(pw, 10), mustChangePassword: true, preRegisteredBy: req.session.user.id, createdAt: new Date().toISOString() };
        users.push(u); created.push({ name: st.name, email, tempPassword: pw });
      }
      const manual = {};
      for (const q of wq) {
        const g = (dcs.grades || {})[q.id] || s.grades[q.id] || {};
        const score = Math.max(0, Math.min(Number(q.points) || 0, Number(g.score) || 0));
        manual[q.id] = { score, maxScore: Number(q.points) || 0, feedback: String(g.feedback != null ? g.feedback : '').slice(0, 4000),
          breakdown: (s.grades[q.id] || {}).breakdown || undefined, rubricStage: (s.grades[q.id] || {}).rubricStage || undefined,
          gradedAt: new Date().toISOString(), gradedBy: req.session.user.name + ' (paper script, AI-assisted)', paper: true };
      }
      const rec = {
        id: uuid(), assessmentId: a.id, assessmentTitle: a.title, studentId: u.id, studentName: u.name, studentEmail: u.email,
        startedAt: null, submittedAt: new Date().toISOString(), source: 'paper', paperBatchId: b.id, paperScriptId: s.id,
        autoScore: 0, autoMax: 0, violations: [], submitReason: 'paper',
        answers: (a.questions || []).map((q) => ({ questionId: q.id, given: s.text[q.id] || null, correct: null })), manualGrades: manual,
      };
      const i = resultsAll.findIndex((r) => r.assessmentId === a.id && r.studentId === u.id);
      if (i >= 0) resultsAll[i] = rec; else resultsAll.push(rec);
      try { saved.push(Object.assign({ name: u.name }, await saveMarkedPdf(req, a, cls, b, s, rec, wq))); } catch (e) { console.warn('[paper] pdf', e.message); saved.push({ name: u.name, error: e.message }); }
    }
    if (created.length) writeAll('users.json', users);
    writeAll('results.json', resultsAll);
    b.status = 'approved'; b.approvedAt = new Date().toISOString();
    writeAll(BATCHES, all);
    res.json({ ok: true, recorded: saved.length, created, skipped, folderId: saved.find((x) => x.folderId) ? saved.find((x) => x.folderId).folderId : null });
  });

  // Marked PDF: marks and feedback per question, then the student's pages.
  async function saveMarkedPdf(req, a, cls, b, s, rec, wq) {
    const PDFKit = require('pdfkit');
    const fl = folders.load();
    let folder = fl.find((f) => f.teacherId === req.session.user.id && f.classId === (cls && cls.id));
    if (!folder) {
      folder = { id: 'fld-' + Date.now().toString(36) + crypto.randomBytes(2).toString('hex'), name: 'Writing — ' + ((cls && cls.name) || 'Class'), classId: (cls && cls.id) || null, className: (cls && cls.name) || null, teacherId: req.session.user.id, createdAt: new Date().toISOString() };
      fl.push(folder); folders.save(fl);
    }
    folders.ensureDir();
    const id = 'mk-' + Date.now().toString(36) + crypto.randomBytes(2).toString('hex');
    const file = id + '.pdf';
    const hasPdfPages = s.pages.some((pid) => (b.pages.find((x) => x.id === pid) || {}).kind === 'pdf');
    const pdfSlots = {};   // page index in the marked PDF → original scanned PDF page
    let buf = await new Promise((resolve, reject) => {
      const doc = new PDFKit({ size: 'A4', margin: 46 });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
      let pageNo = 1; doc.on('pageAdded', () => pageNo++);
      doc.fontSize(18).fillColor('#1a1e33').text(rec.studentName);
      doc.fontSize(11).fillColor('#475569').text(`${a.title} · paper script marked ${new Date().toLocaleDateString('en-GB')}`);
      let tot = 0, max = 0;
      for (const q of wq) {
        const g = rec.manualGrades[q.id]; tot += g.score; max += g.maxScore;
        doc.moveDown(0.8).fontSize(13).fillColor('#1a1e33').text(`${qLabel(a, q)} — ${g.score} / ${g.maxScore}`);
        if (g.breakdown) for (const v of Object.values(g.breakdown)) doc.fontSize(10).fillColor('#334155').text(`• ${v.name}: ${v.score} / ${v.max}${v.comment ? ' — ' + v.comment : ''}`);
        if (g.feedback) doc.moveDown(0.3).fontSize(10).fillColor('#475569').text(String(g.feedback).slice(0, 2500));
      }
      doc.moveDown(0.8).fontSize(13).fillColor('#1a1e33').text(`Total: ${tot} / ${max}`);
      for (const pid of s.pages) {
        const p = b.pages.find((x) => x.id === pid);
        if (!p) continue;
        doc.addPage();
        if (p.kind === 'image' && /jpe?g|png/.test(p.mime)) {
          try { doc.image(path.join(ROOT, b.id, p.file), { fit: [500, 740], align: 'center' }); continue; } catch (e) {}
        }
        if (p.kind === 'pdf') { pdfSlots[pageNo - 1] = p; doc.fontSize(11).fillColor('#475569').text(`Scanned page ${p.source}`); continue; }
        doc.fontSize(11).fillColor('#475569').text(`Page ${p.source} could not be shown. What the AI read:`);
        for (const q of wq) if (s.text[q.id]) doc.moveDown(0.4).fontSize(10).fillColor('#1a1e33').text(`${qLabel(a, q)}: ${s.text[q.id]}`);
      }
      doc.end();
    });
    // Put the original scanned PDF pages in place of their placeholder pages.
    if (hasPdfPages) {
      try {
        const { PDFDocument } = require('pdf-lib');
        const base = await PDFDocument.load(buf);
        const out = await PDFDocument.create();
        const copied = await out.copyPages(base, base.getPageIndices());
        for (let i = 0; i < copied.length; i++) {
          const p = pdfSlots[i];
          if (p) {
            const src = await PDFDocument.load(fs.readFileSync(path.join(ROOT, b.id, p.file)), { ignoreEncryption: true });
            const [pg] = await out.copyPages(src, [0]); out.addPage(pg);
          } else out.addPage(copied[i]);
        }
        buf = Buffer.from(await out.save());
      } catch (e) { console.warn('[paper] could not insert PDF pages:', e.message); }
    }
    fs.writeFileSync(path.join(folders.dir, file), buf);
    const mk = folders.loadMarkings();
    mk.push({ id, folderId: folder.id, teacherId: req.session.user.id, studentName: rec.studentName, filename: file, createdAt: new Date().toISOString(), assessmentId: a.id, source: 'paper' });
    folders.saveMarkings(mk);
    return { folderId: folder.id, markingId: id };
  }
};
