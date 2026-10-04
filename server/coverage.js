// ─────────────────────────────────────────────────────────────────────────────
//  Learning-outcome coverage — per class section.
//  An outcome counts as "assessed" only when a question on it was in an
//  assessment that students have actually taken (at least one submission).
//  Outcome of each question: the spec-table tag (AI-matched to the MOE list)
//  or an outcome code at the start of the question's skill tag.
//  Power outcomes need 2 assessments, other outcomes 1; enrichment is optional.
// ─────────────────────────────────────────────────────────────────────────────
const ExcelJS = require('exceljs');

module.exports = function coverage(app, d) {
  const { readAll, writeAll, ADMIN_EMAILS, spec } = d;
  const rd = (n) => { const r = readAll(n); return Array.isArray(r) ? r : []; };
  const SUBJ_KEY = { Math: 'Maths', Maths: 'Maths', English: 'English', Science: 'Science', Physics: 'Physics', Chemistry: 'Chemistry', Biology: 'Biology', 'AI & Technology': 'AI & Technology', 'Business Studies': 'Business Studies', 'Health Science': 'Health Science' };
  const isPower = (p) => /power|أولوية|main slo/i.test(String(p || ''));

  function isAdmin(req) {
    const u = req.session && req.session.user;
    if (!u) return false;
    if (req.session.ccViewAs && req.session.ccViewAs.admin) return true;
    return ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(String(u.email || '').toLowerCase());
  }
  function teacherOnly(req, res) {
    const u = req.session && req.session.user;
    if (!u) { res.status(401).json({ error: 'Not authenticated' }); return null; }
    if (u.role !== 'teacher') { res.status(403).json({ error: 'Teachers only' }); return null; }
    return u;
  }

  // ── Class profile (grade + stream of a class section) ─────────────────────
  function guessFromName(name) {
    const s = String(name || '');
    const g = (s.match(/(?:^|[^\d])(1[0-2]|[1-9])(?!\d)/) || [])[1] || '';
    let stream = '';
    if (/adv|advanced|متقدم/i.test(s) || /(?:^|[^\d])(9|1[0-2])\s*-?\s*A(?![a-z])/i.test(s)) stream = 'A';
    else if (/gen|general|عام/i.test(s) || /(?:^|[^\d])(9|1[0-2])\s*-?\s*G(?![a-z])/i.test(s)) stream = 'G';
    return { grade: g, stream };
  }
  function profileFor(cls, assessments) {
    const saved = rd('class-profiles.json').find((p) => p.classId === cls.id);
    if (saved && saved.grade) return { grade: saved.grade, stream: saved.stream || '', guessed: false };
    const nm = guessFromName(cls.name);
    const mine = assessments.filter((a) => a.classId === cls.id);
    const count = (arr) => { const m = new Map(); arr.filter(Boolean).forEach((x) => m.set(x, (m.get(x) || 0) + 1)); return [...m.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0])[0] || ''; };
    const grade = count(mine.map((a) => a.grade)) || nm.grade;
    let stream = nm.stream;
    if (!stream && parseInt(grade, 10) >= 9) {
      const st = mine.map((a) => (spec.getSettings(a.id) || {}).stream).filter(Boolean);
      stream = count(st);
    }
    return { grade: grade || '', stream: stream || '', guessed: true };
  }
  function saveProfile(classId, grade, stream) {
    const all = rd('class-profiles.json');
    const rec = { classId, grade: String(parseInt(grade, 10) || ''), stream: ['A', 'G'].includes(stream) ? stream : '', updatedAt: new Date().toISOString() };
    const i = all.findIndex((p) => p.classId === classId);
    if (i >= 0) all[i] = rec; else all.push(rec);
    writeAll('class-profiles.json', all);
    return rec;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  function termOf(a, firstSubmit) {
    if (['1', '2', '3'].includes(String(a.term || ''))) return String(a.term);
    const w = spec.weekOf(a.scheduledDate) || spec.weekOf(firstSubmit);
    return w ? w.term : '';
  }
  function nowWeek() { return spec.weekOf(new Date().toISOString().slice(0, 10)); }
  function curriculumFor(prof, subject, term) {
    if (!SUBJ_KEY[subject] || !prof.grade || !term) return { list: [], source: null };
    let stream = prof.stream;
    let cur = spec.curriculumOutcomes({ grade: prof.grade, subject }, { stream, term });
    if (!cur.list.length && parseInt(prof.grade, 10) >= 9) {
      const other = stream === 'G' ? 'A' : 'G';
      const alt = spec.curriculumOutcomes({ grade: prof.grade, subject }, { stream: other, term });
      if (alt.list.length && !stream) { cur = alt; stream = other; }
    }
    cur.stream = stream;
    return cur;
  }
  const CODE_RE = /^\s*([A-Z][A-Z0-9&]{1,6}(?:\.[0-9]{1,4}){2,7})/;
  function codeFromSkill(skill, codes) {
    const m = String(skill || '').match(CODE_RE);
    if (!m) return '';
    let c = m[1];
    while (c) {
      if (codes.has(c)) return c;
      const i = c.lastIndexOf('.');
      if (i < 0) break;
      c = c.slice(0, i);
    }
    return '';
  }

  // ── Background matching of older questions to outcomes (AI, one at a time)
  const queue = []; let busy = false; const tried = new Map();
  function enqueue(a, stream, term) {
    if (queue.includes(a.id)) return;
    const j = spec.JOBS.get(a.id);
    if (j && j.state === 'running') return;
    const last = tried.get(a.id);
    if (last && Date.now() - last < 30 * 60 * 1000) return;
    try {
      const st = spec.getSettings(a.id);
      const want = Object.assign({}, st);
      let changed = false;
      if (!st.stream && stream && parseInt(a.grade, 10) >= 9) { want.stream = stream; changed = true; }
      if (!st.term && term) { want.term = term; changed = true; }
      if (changed) spec.saveSettings(a.id, want);
    } catch (e) { /* settings are optional */ }
    queue.push(a.id);
    pump();
  }
  async function pump() {
    if (busy) return; busy = true;
    try {
      while (queue.length) {
        const aid = queue.shift();
        tried.set(aid, Date.now());
        const job = spec.tagJob(aid, false);
        const t0 = Date.now();
        while (job.state === 'running' && Date.now() - t0 < 10 * 60 * 1000) await new Promise((r) => setTimeout(r, 1500));
        if (job.state === 'error' && /API key|credit|billing/i.test(job.error || '')) { queue.length = 0; break; }
      }
    } finally { busy = false; }
  }

  // ── Core computation for one class section + subject + term ──────────────
  function compute({ cls, subject, term, prof, assessments, results, teacherId, kick }) {
    const today = nowWeek();
    term = String(term || (today && today.term) || '1');
    const cur = curriculumFor(prof, subject, term);
    const codes = new Set(cur.list.map((o) => o.code));
    const byA = new Map();
    for (const r of results) { if (!byA.has(r.assessmentId)) byA.set(r.assessmentId, []); byA.get(r.assessmentId).push(r); }
    const taken = [];
    let pending = 0, unmatched = 0;
    const hit = new Map(); // code -> { assessments:Set, questions, marks, last, titles:[] }
    for (const a of assessments) {
      if (a.classId !== cls.id || (teacherId && a.teacherId !== teacherId)) continue;
      if (subject && a.subject !== subject) continue;
      const subs = byA.get(a.id) || [];
      if (!subs.length) continue;                                  // never taken — doesn't count
      const first = subs.map((s) => s.submittedAt).filter(Boolean).sort()[0] || '';
      const last = subs.map((s) => s.submittedAt).filter(Boolean).sort().pop() || '';
      if (termOf(a, first) !== term) continue;
      const tags = spec.tagsFor(a.id);
      let matched = 0, waiting = 0;
      for (const q of a.questions || []) {
        const t = tags.get(q.id);
        let code = t && t.outcomeCode && codes.has(t.outcomeCode) ? t.outcomeCode : '';
        if (!code) code = codeFromSkill(q.skill, codes);
        if (!code) {
          if (!t || !t.outcome) waiting++; else unmatched++;
          continue;
        }
        matched++;
        if (!hit.has(code)) hit.set(code, { aset: new Set(), questions: 0, marks: 0, last: '', titles: [] });
        const h = hit.get(code);
        h.questions++; h.marks += Number(q.points) || 1;
        if (!h.aset.has(a.id)) { h.aset.add(a.id); h.titles.push(a.title); }
        if (last > h.last) h.last = last;
      }
      pending += waiting;
      if (waiting && kick && cur.list.length) enqueue(a, cur.stream, term);
      taken.push({ id: a.id, title: a.title, date: last.slice(0, 10), students: subs.length, questions: (a.questions || []).length, matched, waiting });
    }
    const termNow = today ? today.term : '';
    const outcomes = cur.list.map((o) => {
      const h = hit.get(o.code);
      const power = isPower(o.priority);
      const required = o.type === 'enrichment' ? 0 : (power ? 2 : 1);
      const count = h ? h.aset.size : 0;
      let taught = true;
      if (termNow && Number(term) > Number(termNow)) taught = false;
      else if (termNow === term && today && o.wFrom && o.wFrom > today.week) taught = false;
      const status = required === 0 ? (count ? 'met' : 'optional') : (count >= required ? 'met' : (count ? 'partial' : 'none'));
      return { code: o.code, text: o.text, unit: o.unit, module: o.module || '', lesson: o.lesson || '', lessonKey: o.lessonKey || '', weeks: o.weeks || '',
        type: o.type || 'core', priority: o.priority || '', power, required, count, questions: h ? h.questions : 0, marks: h ? h.marks : 0,
        last: h ? h.last.slice(0, 10) : '', assessments: h ? h.titles : [], status, taught };
    });
    const req = outcomes.filter((o) => o.required > 0);
    const summary = {
      required: req.length, met: req.filter((o) => o.status === 'met').length, partial: req.filter((o) => o.status === 'partial').length,
      none: req.filter((o) => o.status === 'none').length,
      taught: req.filter((o) => o.taught).length, taughtMissing: req.filter((o) => o.taught && o.status !== 'met').length,
      power: req.filter((o) => o.power).length, powerMet: req.filter((o) => o.power && o.status === 'met').length,
    };
    summary.pct = summary.required ? Math.round((summary.met + 0.5 * summary.partial) / summary.required * 100) : 0;
    return { class: { id: cls.id, name: cls.name }, profile: Object.assign({}, prof, { stream: cur.stream || prof.stream }), subject, term,
      week: today && today.term === term ? today.week : null,
      curriculum: cur.source ? { source: cur.source, key: `${cur.gk} · Term ${cur.term} · ${cur.sk}` } : null,
      summary, outcomes, assessments: taken, pending, unmatched, matching: queue.length + (busy ? 1 : 0) };
  }
  function subjectsOf(cls, assessments) {
    const m = new Map();
    for (const a of assessments) if (a.classId === cls.id && a.subject && SUBJ_KEY[a.subject]) m.set(a.subject, (m.get(a.subject) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0]);
  }

  // ── Teacher routes ────────────────────────────────────────────────────────
  app.get('/api/coverage/overview', (req, res) => {
    const u = teacherOnly(req, res); if (!u) return;
    const assessments = rd('assessments.json').filter((a) => a.teacherId === u.id && !a.deletedAt);
    const results = rd('results.json');
    const classes = rd('classes.json').filter((c) => c.teacherId === u.id);
    const term = String(req.query.term || ((nowWeek() || {}).term) || '1');
    const out = classes.map((cls) => {
      const prof = profileFor(cls, assessments);
      const subjects = subjectsOf(cls, assessments);
      return { id: cls.id, name: cls.name, profile: prof, subjects: subjects.map((s) => {
        const c = compute({ cls, subject: s, term, prof, assessments, results, teacherId: u.id, kick: false });
        return { subject: s, curriculum: !!c.curriculum, summary: c.summary, pending: c.pending };
      }) };
    });
    res.json({ term, week: (nowWeek() || {}).week || null, classes: out });
  });
  app.get('/api/coverage', (req, res) => {
    const u = teacherOnly(req, res); if (!u) return;
    const cls = rd('classes.json').find((c) => c.id === req.query.classId && c.teacherId === u.id);
    if (!cls) return res.status(404).json({ error: 'Class not found.' });
    const assessments = rd('assessments.json').filter((a) => a.teacherId === u.id && !a.deletedAt);
    let prof = profileFor(cls, assessments);
    if (req.query.grade) prof = { grade: String(parseInt(req.query.grade, 10) || ''), stream: ['A', 'G'].includes(req.query.stream) ? req.query.stream : prof.stream, guessed: prof.guessed };
    else if (req.query.stream && ['A', 'G'].includes(req.query.stream)) prof = Object.assign({}, prof, { stream: req.query.stream });
    const subjects = subjectsOf(cls, assessments);
    const subject = String(req.query.subject || subjects[0] || '');
    const c = compute({ cls, subject, term: req.query.term, prof, assessments, results: rd('results.json'), teacherId: u.id, kick: true });
    c.subjects = subjects;
    res.json(c);
  });
  app.post('/api/coverage/profile', (req, res) => {
    const u = teacherOnly(req, res); if (!u) return;
    const b = req.body || {};
    const cls = rd('classes.json').find((c) => c.id === b.classId && c.teacherId === u.id);
    if (!cls) return res.status(404).json({ error: 'Class not found.' });
    res.json({ profile: saveProfile(cls.id, b.grade, b.stream) });
  });

  // ── Admin report ──────────────────────────────────────────────────────────
  function adminRows(term, kick) {
    const assessments = rd('assessments.json').filter((a) => !a.deletedAt);
    const results = rd('results.json');
    const users = new Map(rd('users.json').map((x) => [x.id, x]));
    const rows = [];
    for (const cls of rd('classes.json')) {
      const t = users.get(cls.teacherId);
      if (!t) continue;
      const mine = assessments.filter((a) => a.teacherId === cls.teacherId);
      const prof = profileFor(cls, mine);
      for (const s of subjectsOf(cls, mine)) {
        const c = compute({ cls, subject: s, term, prof, assessments: mine, results, teacherId: cls.teacherId, kick });
        rows.push({ teacher: t.name || t.email, teacherEmail: t.email || '', classId: cls.id, className: cls.name, grade: c.profile.grade, stream: c.profile.stream,
          guessed: !!prof.guessed, subject: s, curriculum: c.curriculum ? c.curriculum.key : '', taken: c.assessments.length,
          summary: c.summary, pending: c.pending, missing: c.outcomes.filter((o) => o.required && o.status !== 'met'), outcomes: c.outcomes });
      }
    }
    rows.sort((a, b) => (a.teacher || '').localeCompare(b.teacher || '') || (a.className || '').localeCompare(b.className || '') || a.subject.localeCompare(b.subject));
    return rows;
  }
  app.get('/api/admin/coverage', (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admins only.' });
    const term = String(req.query.term || ((nowWeek() || {}).term) || '1');
    const rows = adminRows(term, req.query.match === '1');
    res.json({ term, week: (nowWeek() || {}).week || null, matching: queue.length + (busy ? 1 : 0),
      rows: rows.map((r) => Object.assign({}, r, { missing: r.missing.slice(0, 200).map((o) => ({ code: o.code, text: o.text, power: o.power, status: o.status, taught: o.taught, unit: o.unit })), outcomes: undefined })) });
  });
  app.get('/api/admin/coverage.xlsx', async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admins only.' });
    try {
      const term = String(req.query.term || ((nowWeek() || {}).term) || '1');
      const rows = adminRows(term, false);
      const wb = new ExcelJS.Workbook(); wb.creator = 'ClassCurio';
      const head = (ws, cols) => {
        ws.columns = cols;
        const r = ws.getRow(1); r.font = { bold: true, color: { argb: 'FFFFFFFF' } }; r.height = 30;
        r.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } }; c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; });
        ws.views = [{ state: 'frozen', ySplit: 1 }];
      };
      const stTxt = { met: '✅ Assessed', partial: '🟠 Partly (Power: once)', none: '🔴 Not assessed', optional: '— Enrichment (optional)' };
      const color = { met: 'FFDCFCE7', partial: 'FFFEF3C7', none: 'FFFEE2E2', optional: 'FFF1F5F9' };
      const s1 = wb.addWorksheet('Summary');
      head(s1, [{ header: 'Teacher', key: 't', width: 24 }, { header: 'Class', key: 'c', width: 14 }, { header: 'Grade', key: 'g', width: 8 }, { header: 'Stream', key: 's', width: 10 },
        { header: 'Subject', key: 'sub', width: 16 }, { header: 'Assessments taken', key: 'tk', width: 12 }, { header: 'Outcomes required', key: 'rq', width: 12 },
        { header: 'Fully assessed', key: 'mt', width: 11 }, { header: 'Partly', key: 'pt', width: 9 }, { header: 'Not assessed', key: 'nn', width: 11 },
        { header: 'Taught so far but not fully assessed', key: 'tm', width: 16 }, { header: 'Power outcomes met', key: 'pw', width: 13 }, { header: 'Coverage %', key: 'pc', width: 11 },
        { header: 'Questions waiting for AI matching', key: 'pd', width: 14 }, { header: 'Curriculum', key: 'cu', width: 26 }]);
      for (const r of rows) {
        const x = s1.addRow({ t: r.teacher, c: r.className, g: r.grade, s: r.stream === 'A' ? 'Advanced' : r.stream === 'G' ? 'General' : '', sub: r.subject, tk: r.taken,
          rq: r.summary.required, mt: r.summary.met, pt: r.summary.partial, nn: r.summary.none, tm: r.summary.taughtMissing, pw: `${r.summary.powerMet}/${r.summary.power}`,
          pc: r.summary.required ? r.summary.pct / 100 : null, pd: r.pending, cu: r.curriculum || 'No MOE curriculum stored' });
        x.getCell('pc').numFmt = '0%';
        const p = r.summary.pct;
        x.getCell('pc').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: !r.summary.required ? 'FFF1F5F9' : p >= 80 ? 'FFDCFCE7' : p >= 50 ? 'FFFEF3C7' : 'FFFEE2E2' } };
      }
      const s2 = wb.addWorksheet('Not yet assessed');
      head(s2, [{ header: 'Teacher', key: 't', width: 22 }, { header: 'Class', key: 'c', width: 12 }, { header: 'Subject', key: 'sub', width: 14 }, { header: 'Outcome code', key: 'code', width: 18 },
        { header: 'Learning outcome', key: 'o', width: 70 }, { header: 'Unit / lesson', key: 'u', width: 36 }, { header: 'Weeks', key: 'w', width: 12 },
        { header: 'Priority', key: 'p', width: 14 }, { header: 'Taught so far?', key: 'tg', width: 10 }, { header: 'Status', key: 'st', width: 20 }]);
      for (const r of rows) for (const o of r.missing) {
        const x = s2.addRow({ t: r.teacher, c: r.className, sub: r.subject, code: o.code, o: o.text, u: o.unit, w: o.weeks, p: o.power ? 'Power' : (o.priority || 'Support'), tg: o.taught ? 'Yes' : 'Not yet', st: stTxt[o.status] });
        x.alignment = { vertical: 'top', wrapText: true };
        x.getCell('st').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color[o.status] } };
      }
      const s3 = wb.addWorksheet('All outcomes');
      head(s3, [{ header: 'Teacher', key: 't', width: 22 }, { header: 'Class', key: 'c', width: 12 }, { header: 'Subject', key: 'sub', width: 14 }, { header: 'Outcome code', key: 'code', width: 18 },
        { header: 'Learning outcome', key: 'o', width: 64 }, { header: 'Unit / lesson', key: 'u', width: 32 }, { header: 'Priority', key: 'p', width: 12 },
        { header: 'Assessments', key: 'n', width: 11 }, { header: 'Questions', key: 'q', width: 10 }, { header: 'Marks', key: 'm', width: 8 }, { header: 'Last assessed', key: 'l', width: 12 },
        { header: 'Assessed in', key: 'in', width: 40 }, { header: 'Status', key: 'st', width: 20 }]);
      for (const r of rows) for (const o of r.outcomes) {
        const x = s3.addRow({ t: r.teacher, c: r.className, sub: r.subject, code: o.code, o: o.text, u: o.unit, p: o.power ? 'Power' : (o.type === 'enrichment' ? 'Enrichment' : 'Support'),
          n: o.count, q: o.questions, m: o.marks, l: o.last, in: o.assessments.join(' · '), st: stTxt[o.status] });
        x.alignment = { vertical: 'top', wrapText: true };
        x.getCell('st').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color[o.status] } };
      }
      const s4 = wb.addWorksheet('How it is counted');
      s4.getColumn(1).width = 110;
      ['Outcome coverage — Term ' + term + ' (generated ' + new Date().toISOString().slice(0, 10) + ')', '',
        '• Coverage is per class section. Only assessments that students have actually taken (at least one submission) count.',
        '• Each question is linked to a curriculum outcome by its outcome code (AI-generated questions carry it) or by the AI matching used for the specification table.',
        '• Power outcomes need to be assessed in at least 2 assessments; Support outcomes in at least 1. Enrichment lessons are optional.',
        '• Coverage % = (fully assessed + half of partly assessed) ÷ outcomes required for the term.',
        '• "Taught so far" uses the weeks in the MOE scope & sequence and the 2026-27 calendar.',
        '• Grade and stream come from the class settings (teachers can set them in the Outcome coverage window), otherwise they are guessed from the class name and assessments.',
      ].forEach((t, i) => { const c = s4.getCell(i + 1, 1); c.value = t; c.alignment = { wrapText: true }; if (i === 0) c.font = { bold: true, size: 14 }; });
      const buf = await wb.xlsx.writeBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="Outcome-coverage-T${term}.xlsx"`);
      res.send(Buffer.from(buf));
    } catch (e) {
      console.error('[coverage] xlsx failed:', e);
      res.status(500).json({ error: 'Could not build the file: ' + e.message });
    }
  });
  return { compute, adminRows, profileFor, codeFromSkill, nowWeek, subjectsOf, isPower };
};
