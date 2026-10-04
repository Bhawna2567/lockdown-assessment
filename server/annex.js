// ════════════════════════════════════════════════════════════════════════
//  📑 Annex 3 (Skills Analysis and Student Classification) and
//     Annex 4 (Intervention and Enrichment Plan) — admin only.
//  Fills the school's own PowerPoint templates (server/templates/annex3.pptx
//  and annex4.pptx) from real results.
//
//  School bands:
//    Cycle 3 (Grades 9–12): pass 60%  · F 0–49.9  · BF 50–59.9 · BP 60–69.9
//    Cycle 2 (Grades 5–8):  pass 50%  · F 0–39.9  · BF 40–49.9 · BP 50–59.9
//  Annex 3 columns: Proficient = at or above the pass mark,
//                   Level 2 = BF (borderline fail), Level 3 = F (fail).
//  BP students (just passed) are reported separately as "at risk".
// ════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const STRATEGIES = {
  intervention: [
    'Weekly practice on the Adeptly platform',
    'Practice on the IELTS platform',
    'Small-group reteaching',
    'Guided reading with question stems',
    'Modelling with think-alouds',
    'Graphic organisers',
    'Vocabulary journals / word walls',
    'Differentiated worksheets',
    'Peer tutoring (paired with a proficient student)',
    'Short daily retrieval practice (5-minute starters)',
    'Exit tickets after each lesson',
    'After-school remedial sessions',
    'Parent communication and home practice plan',
  ],
  enrichment: [
    'Weekly practice on the Adeptly platform',
    'Practice on the IELTS platform',
    'Extension tasks at a higher level',
    'Advanced reading circle / book club',
    'Project-based learning task',
    'Peer mentor / leadership role',
    'Competitions and olympiads',
    'Debate and presentation club',
    'Independent research task',
    'Creative writing workshop',
  ],
};
// Approver names are optional (typed in the tool, so every school can use its own); signatures stay blank;
// the date is the day the sheet is generated (UAE time).
function approversOf(b) {
  const a = (b && b.approvers) || {};
  return { academic: String(a.academic || '').trim().slice(0, 80), principal: String(a.principal || '').trim().slice(0, 80) };
}
function todayUAE() {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(new Date());
  const g = (t) => (p.find((x) => x.type === t) || {}).value || '';
  return `${g('day')}/${g('month')}/${g('year')}`;
}
const CODE_RE = /^\s*[A-Z][A-Z0-9&]{1,6}(?:\.[0-9A-Z]{1,4}){2,7}\s*/;

module.exports = function annex(app, d) {
  const { readAll, claudeList, questionEarned } = d;
  const ADMINS = (d.adminEmails || []).map((x) => String(x).toLowerCase());
  const isAdmin = (req) => {
    const u = req.session && req.session.user;
    return !!(u && (ADMINS.includes(String(u.email || '').toLowerCase()) || (req.session.ccViewAs && req.session.ccViewAs.admin)));
  };
  // Admins see every class; teachers see and download only their own classes.
  const requireAdmin = (req, res, next) => {
    const u = req.session && req.session.user;
    if (!u) return res.status(401).json({ error: 'Not signed in' });
    if (isAdmin(req) || u.role === 'teacher') return next();
    return res.status(403).json({ error: 'Teachers only' });
  };
  const rd = (n) => { const r = readAll(n); return Array.isArray(r) ? r : []; };

  function bandsFor(grade) {
    const g = parseInt(grade, 10);
    if (g >= 9) return { cycle: 3, pass: 60, bf: 50, bp: 70 };
    return { cycle: 2, pass: 50, bf: 40, bp: 60 };
  }
  function skillLabel(q, by) {
    if (by === 'focus') return String(q.focus || '').trim() || null;
    if (by === 'cefr') return /^(A1|A2|B1|B2|C1|C2)$/.test(String(q.cefr || '')) ? 'CEFR ' + q.cefr : null;
    const s = String(q.skill || '').trim();
    if (!s) return null;
    return s.replace(CODE_RE, '').trim() || s;
  }
  // Academic year runs September → August, e.g. "2026-2027".
  function yearFromDate(d) { const t = new Date(d); if (isNaN(t)) return ''; const y = t.getUTCFullYear(), m = t.getUTCMonth() + 1; return m >= 9 ? `${y}-${y + 1}` : `${y - 1}-${y}`; }
  function yearOf(a) { const y = String(a.academicYear || '').replace(/\s+/g, '').replace('/', '-'); if (/^\d{4}-\d{4}$/.test(y)) return y; return yearFromDate(a.scheduledDate || a.createdAt || ''); }
  const currentYear = () => yearFromDate(new Date().toISOString());
  const num = (v, dflt) => (v === '' || v == null || !Number.isFinite(+v) ? dflt : +v);

  // ── Options: classes → assessments (with how many students took them) ────
  app.get('/api/admin/annex/options', requireAdmin, (req, res) => {
    const users = new Map(rd('users.json').map((u) => [u.id, u]));
    const taken = new Map();
    for (const r of rd('results.json')) taken.set(r.assessmentId, (taken.get(r.assessmentId) || 0) + 1);
    const assessments = rd('assessments.json').filter((a) => !a.deletedAt);
    const me = req.session.user, admin = isAdmin(req);
    const classes = rd('classes.json').filter((c) => admin || c.teacherId === me.id).map((c) => {
      const t = users.get(c.teacherId) || {};
      const list = assessments.filter((a) => a.classId === c.id).map((a) => ({
        id: a.id, title: a.title, subject: a.subject || '', grade: a.grade || '', term: a.term || '',
        date: a.scheduledDate || '', submissions: taken.get(a.id) || 0, year: yearOf(a),
      })).sort((x, y) => String(y.date).localeCompare(String(x.date)));
      return { id: c.id, name: c.name, teacherId: c.teacherId, teacher: t.name || t.email || '', assessments: list };
    }).filter((c) => c.assessments.some((a) => a.submissions > 0));
    res.json({ classes, strategies: STRATEGIES, admin, currentYear: currentYear() });
  });

  // ── Build the tables from the chosen assessments ─────────────────────────
  app.post('/api/admin/annex/build', requireAdmin, (req, res) => {
    try {
      const b = req.body || {};
      const ids = new Set((Array.isArray(b.assessmentIds) ? b.assessmentIds : []).map(String));
      if (!ids.size) return res.status(400).json({ error: 'Choose at least one assessment.' });
      const cls = rd('classes.json').find((c) => c.id === b.classId);
      if (!cls) return res.status(404).json({ error: 'Class not found.' });
      if (!isAdmin(req) && cls.teacherId !== req.session.user.id) return res.status(403).json({ error: 'You can only build sheets for your own classes.' });
      const teacher = rd('users.json').find((u) => u.id === cls.teacherId) || {};
      const as = rd('assessments.json').filter((a) => ids.has(a.id) && a.classId === cls.id);
      const grade = String(b.grade || (as.find((a) => a.grade) || {}).grade || '');
      const def = bandsFor(grade);
      const bands = { cycle: def.cycle, pass: num(b.pass, def.pass), bf: num(b.bf, def.bf), bp: num(b.bp, def.bp) };
      const by = ['skill', 'focus', 'cefr'].includes(b.groupBy) ? b.groupBy : 'skill';
      const results = rd('results.json').filter((r) => ids.has(r.assessmentId));
      const users = new Map(rd('users.json').map((u) => [u.id, u]));
      const per = new Map();   // skill -> studentKey -> {earned,max}
      const names = new Map();
      for (const r of results) {
        const a = as.find((x) => x.id === r.assessmentId);
        if (!a) continue;
        const sid = r.studentId || r.studentEmail || r.id;
        const u = users.get(r.studentId) || {};
        names.set(sid, r.studentName || u.name || r.studentEmail || u.email || 'Student');
        for (const q of a.questions || []) {
          const sk = skillLabel(q, by);
          if (!sk) continue;
          const e = questionEarned(q, r);
          if (!e || !(e.max > 0)) continue;
          if (!per.has(sk)) per.set(sk, new Map());
          const m = per.get(sk);
          const cur = m.get(sid) || { earned: 0, max: 0 };
          cur.earned += e.earned; cur.max += e.max; m.set(sid, cur);
        }
      }
      const subject = String(b.subject || (as.find((a) => a.subject) || {}).subject || '');
      const rows = [];
      for (const [skill, m] of per) {
        const studs = Array.from(m.entries()).map(([sid, v]) => ({ name: names.get(sid) || 'Student', pct: Math.round((v.earned / v.max) * 1000) / 10 }));
        const prof = studs.filter((s) => s.pct >= bands.pass).sort((x, y) => y.pct - x.pct);
        const l2 = studs.filter((s) => s.pct >= bands.bf && s.pct < bands.pass).sort((x, y) => x.pct - y.pct);
        const l3 = studs.filter((s) => s.pct < bands.bf).sort((x, y) => x.pct - y.pct);
        const bp = studs.filter((s) => s.pct >= bands.pass && s.pct < bands.bp);
        const avg = studs.length ? Math.round(studs.reduce((n, s) => n + s.pct, 0) / studs.length) : 0;
        rows.push({
          subject, section: cls.name, skill, students: studs.length,
          proficient: prof.length, proficiencyPct: studs.length ? Math.round((prof.length / studs.length) * 100) : 0,
          level2: l2.length, level3: l3.length, atRisk: bp.length, average: avg,
          level2Names: l2.map((s) => s.name), level3Names: l3.map((s) => s.name),
          atRiskNames: bp.map((s) => s.name), proficientNames: prof.map((s) => s.name),
          action: '',
        });
      }
      rows.sort((x, y) => x.proficiencyPct - y.proficiencyPct || y.students - x.students);
      const short = (arr, n) => arr.slice(0, n).join(', ') + (arr.length > n ? ` +${arr.length - n} more` : '');
      const plan = [];
      for (const r of rows.filter((x) => x.level2 + x.level3 > 0).slice(0, 8)) {
        const who = [r.level3 ? `Level 3 (${r.level3}): ${short(r.level3Names, 5)}` : '', r.level2 ? `Level 2 (${r.level2}): ${short(r.level2Names, 5)}` : ''].filter(Boolean).join('\n');
        plan.push({ kind: 'intervention', skill: r.skill, level: r.proficiencyPct < 50 ? 'High' : 'Medium', size: r.level2 + r.level3, baselinePct: r.proficiencyPct, students: who, baseline: `${r.proficiencyPct}% proficient (avg ${r.average}%)`, strategies: [], target: '', strategy: '', responsible: teacher.name || '', sessions: '', indicator: '', followUp: '' });
      }
      for (const r of rows.filter((x) => x.proficiencyPct >= 80 && x.proficient > 0).slice(-2)) {
        plan.push({ kind: 'enrichment', skill: r.skill, level: 'Enrichment', size: r.proficient, baselinePct: r.proficiencyPct, students: `Proficient (${r.proficient}): ${short(r.proficientNames, 5)}`, baseline: `${r.proficiencyPct}% proficient (avg ${r.average}%)`, strategies: [], target: '', strategy: '', responsible: teacher.name || '', sessions: '', indicator: '', followUp: '' });
      }
      res.json({ class: { id: cls.id, name: cls.name }, teacher: teacher.name || teacher.email || '', subject, grade, bands, groupBy: by,
        assessments: as.map((a) => ({ id: a.id, title: a.title })), students: names.size, rows, plan });
    } catch (e) {
      console.error('[annex/build]', e);
      res.status(500).json({ error: 'Could not build the tables: ' + (e.message || e) });
    }
  });

  // ── AI drafts: suggested actions (Annex 3) + strategy/sessions/indicator (Annex 4)
  app.post('/api/admin/annex/draft', requireAdmin, async (req, res) => {
    try {
      const b = req.body || {};
      const rows = (Array.isArray(b.rows) ? b.rows : []).slice(0, 30);
      const plan = (Array.isArray(b.plan) ? b.plan : []).slice(0, 15);
      const sys = [
        'You are an experienced academic coordinator in a UAE government school (MOE).',
        `Subject: ${String(b.subject || '').slice(0, 40)}. Grade: ${String(b.grade || '').slice(0, 10)}. Class section: ${String(b.section || '').slice(0, 40)}.`,
        `Pass mark ${num(b.pass, 60)}%. Level 2 = borderline fail, Level 3 = fail.`,
        'Write SHORT, practical text that fits in a small table cell (max 18 words each). Plain English, no bullet symbols, no student names.',
      ].join('\n');
      const out = { actions: {}, plan: {} };
      if (rows.length) {
        const items = await claudeList({ system: sys + '\nFor each skill row write "action": the suggested action for this class (e.g. whole-class reteach, small-group support, targeted practice, extension) based on the proficiency % and the numbers at Level 2 and Level 3.',
          user: JSON.stringify(rows.map((r, i) => ({ id: 'R' + i, skill: r.skill, students: r.students, proficientPct: r.proficiencyPct, level2: r.level2, level3: r.level3, average: r.average }))),
          maxTokens: 2500, itemProps: { id: { type: 'string' }, action: { type: 'string' } }, required: ['id', 'action'] });
        for (const x of items || []) if (x && x.id) out.actions[String(x.id).trim()] = String(x.action || '').slice(0, 220);
      }
      if (plan.length) {
        const items = await claudeList({ system: sys + '\nFor each plan row write:\n' +
          '- "strategy": how the CHOSEN strategies (field "strategies") will be used for this group and skill, in one or two short sentences. Use ONLY the chosen strategies when any are given; if none are given, choose suitable ones. Mention platform practice (Adeptly, IELTS) by name when chosen, with what students do there.\n' +
          '- "sessions": number, length and timing, including platform practice frequency, e.g. "2 × 30 min small group + 1 Adeptly task weekly, weeks 1–4".\n' +
          '- "indicator": a measurable progress indicator, e.g. "Adeptly task score ≥ 70% and exit quiz ≥ pass mark by week 4".\n' +
          '- "target": the target for the end of the month as a short phrase, e.g. "70% of the group at or above the pass mark".\n' +
          'Intervention rows are for students below the pass mark; enrichment rows are for proficient students.',
          user: JSON.stringify(plan.map((p, i) => ({ id: 'P' + i, kind: p.kind, skill: p.skill, baseline: p.baseline, groupSize: p.size, strategies: Array.isArray(p.strategies) ? p.strategies.slice(0, 6) : [], group: String(p.students || '').split('\n').map((x) => x.replace(/:.*$/, '')).join(', ') }))),
          maxTokens: 4000, itemProps: { id: { type: 'string' }, strategy: { type: 'string' }, sessions: { type: 'string' }, indicator: { type: 'string' }, target: { type: 'string' } }, required: ['id', 'strategy', 'sessions', 'indicator'] });
        for (const x of items || []) if (x && x.id) out.plan[String(x.id).trim()] = { strategy: String(x.strategy || '').slice(0, 260), sessions: String(x.sessions || '').slice(0, 140), indicator: String(x.indicator || '').slice(0, 160), target: String(x.target || '').slice(0, 100) };
      }
      res.json(out);
    } catch (e) {
      console.error('[annex/draft]', e);
      res.status(500).json({ error: 'Could not draft with AI: ' + (e.message || e) });
    }
  });

  // ── PowerPoint: fill the school's own template ──────────────────────────
  const xmlEsc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function fillCell(tcXml, text) {
    const lines = String(text == null ? '' : text).split('\n');
    const paras = lines.map((ln) => `<a:p><a:pPr algn="ctr" indent="0" marL="0"><a:buNone/></a:pPr>${ln ? `<a:r><a:rPr lang="en-US" sz="700" dirty="0"/><a:t>${xmlEsc(ln)}</a:t></a:r>` : ''}<a:endParaRPr lang="en-US" sz="700" dirty="0"/></a:p>`).join('');
    const i = tcXml.indexOf('<a:p>'), j = tcXml.lastIndexOf('</a:p>');
    if (i < 0 || j < 0) return tcXml;
    return tcXml.slice(0, i) + paras + tcXml.slice(j + 6);
  }
  function fillSlide(slideXml, rows, rowsPerSlide, extra, approvers) {
    approvers = approvers || { academic: '', principal: '' };
    const trs = slideXml.match(/<a:tr\b[\s\S]*?<\/a:tr>/g) || [];
    const head = trs[0], tmpl = trs[1];
    const filled = [];
    for (let i = 0; i < rowsPerSlide; i++) {
      const vals = rows[i] || [];
      let k = 0;
      filled.push(tmpl.replace(/<a:tc>[\s\S]*?<\/a:tc>/g, (tc) => fillCell(tc, vals[k++])));
    }
    const a = slideXml.indexOf(head), z = slideXml.indexOf('</a:tbl>');
    let out = slideXml.slice(0, a) + head + filled.join('') + slideXml.slice(z);
    out = out.replace('<a:off x="274320" y="2560320"/>', `<a:off x="274320" y="${TABLE_Y}"/>`);
    const date = todayUAE();
    out = out.replace(/(Academic Approval:\s*Name: )(_+)(\s*Signature: _+\s*Date: )_+/, (m, a, u, c) => a + (approvers.academic ? xmlEsc(approvers.academic) : u) + c + date)
      .replace(/(School Principal Approval:\s*Name: )(_+)(\s*Signature: _+\s*Date: )_+/, (m, a, u, c) => a + (approvers.principal ? xmlEsc(approvers.principal) : u) + c + date);
    if (extra) out = extra(out);
    return out;
  }
  // Estimate how tall a row will be (7pt text, word-wrapped) so each slide
  // only gets as many rows as fit above the signature lines.
  const LINE = 84000, PAD = 91440, MIN_ROW = 304800, TABLE_Y = 2240000, FOOTER_Y = 4480000, HEAD_H = 330000;
  function wrapLines(text, chars) {
    let n = 0;
    for (const para of String(text == null ? '' : text).split('\n')) {
      let cur = 0, lines = 1;
      for (const w of para.split(/\s+/).filter(Boolean)) {
        const L = Math.min(w.length, chars);
        if (cur && cur + 1 + L > chars) { lines++; cur = L; } else cur += (cur ? 1 : 0) + L;
      }
      n += lines;
    }
    return Math.max(1, n);
  }
  function rowHeight(vals, chars) { return Math.max(MIN_ROW, Math.max(...vals.map((v) => wrapLines(v, chars))) * LINE + PAD); }
  function paginate(rows, chars, maxRows) {
    const pages = []; let cur = [], h = 0;
    const budget = FOOTER_Y - TABLE_Y - HEAD_H;
    for (const r of rows) {
      const rh = rowHeight(r, chars);
      if (cur.length && (h + rh > budget || cur.length >= maxRows)) { pages.push(cur); cur = []; h = 0; }
      cur.push(r); h += rh;
    }
    if (cur.length || !pages.length) pages.push(cur);
    return pages;
  }
  async function buildPptx(templateName, rows, rowsPerSlide, extra, chars, sections, approvers) {
    // sections: optional [{ rows, extra }] — e.g. one Annex 4 block per month.
    const secs = Array.isArray(sections) && sections.length ? sections : [{ rows, extra }];
    const pageList = [];
    for (const sec of secs) {
      const pr = paginate(sec.rows, chars || 17, rowsPerSlide);
      pr.forEach((r, k) => pageList.push({ rows: r, extra: sec.extra, last: k === pr.length - 1 }));
    }
    const pageRows = pageList.map((x) => x.rows);
    const zip = await JSZip.loadAsync(fs.readFileSync(path.join(__dirname, 'templates', templateName)));
    const base = await zip.file('ppt/slides/slide1.xml').async('string');
    const pages = pageRows.length;
    let pres = await zip.file('ppt/presentation.xml').async('string');
    let presRels = await zip.file('ppt/_rels/presentation.xml.rels').async('string');
    let ct = await zip.file('[Content_Types].xml').async('string');
    // Drop every slide after slide 1 (and their notes); they are rebuilt from slide 1.
    for (const f of Object.keys(zip.files).filter((x) => /^ppt\/slides\/slide\d+\.xml$/.test(x))) {
      const n = f.match(/slide(\d+)\.xml$/)[1];
      if (n === '1') continue;
      zip.remove(f); zip.remove(`ppt/slides/_rels/slide${n}.xml.rels`);
      ct = ct.replace(new RegExp(`<Override PartName="/ppt/slides/slide${n}\\.xml"[^>]*/>`), '');
      const rel = (presRels.match(new RegExp(`<Relationship [^>]*Target="slides/slide${n}\\.xml"[^>]*/>`)) || [])[0];
      if (rel) {
        const rid = rel.match(/Id="([^"]+)"/)[1];
        presRels = presRels.replace(rel, '');
        pres = pres.replace(new RegExp(`<p:sldId [^>]*r:id="${rid}"\\s*/>`), '');
      }
    }
    for (const f of Object.keys(zip.files).filter((x) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(x))) {
      const n = f.match(/notesSlide(\d+)\.xml$/)[1];
      if (n === '1') continue;
      zip.remove(f); zip.remove(`ppt/notesSlides/_rels/notesSlide${n}.xml.rels`);
      ct = ct.replace(new RegExp(`<Override PartName="/ppt/notesSlides/notesSlide${n}\\.xml"[^>]*/>`), '');
    }
    const rels1 = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>';
    let maxId = Math.max(256, ...Array.from(pres.matchAll(/<p:sldId id="(\d+)"/g)).map((m) => +m[1]));
    for (let p = 0; p < pages; p++) {
      const n = p + 1;
      // Fill the page's rows; the last page is topped up with empty rows only while they still fit.
      const pr = pageRows[p];
      let blanks = 0, used = pr.reduce((n, r) => n + rowHeight(r, chars || 17), 0);
      while (pageList[p].last && pr.length + blanks < rowsPerSlide && used + MIN_ROW * 1.15 <= FOOTER_Y - TABLE_Y - HEAD_H) { blanks++; used += MIN_ROW * 1.15; }
      zip.file(`ppt/slides/slide${n}.xml`, fillSlide(base, pr, pr.length + blanks, pageList[p].extra, approvers));
      if (n === 1) continue;
      zip.file(`ppt/slides/_rels/slide${n}.xml.rels`, rels1);
      ct = ct.replace('</Types>', `<Override PartName="/ppt/slides/slide${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`);
      const rid = 'rIdAnx' + n;
      presRels = presRels.replace('</Relationships>', `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${n}.xml"/></Relationships>`);
      pres = pres.replace('</p:sldIdLst>', `<p:sldId id="${++maxId}" r:id="${rid}"/></p:sldIdLst>`);
    }
    zip.file('ppt/presentation.xml', pres);
    zip.file('ppt/_rels/presentation.xml.rels', presRels);
    zip.file('[Content_Types].xml', ct);
    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  }
  const safeName = (s) => String(s || '').replace(/[^\w -]+/g, '').trim().replace(/\s+/g, '_').slice(0, 60) || 'class';

  async function makeAnnex3(b) {
    const rows = (Array.isArray(b.rows) ? b.rows : []).slice(0, 200).map((r) => [
      r.subject, r.section, r.skill, r.students, r.proficient, (r.proficiencyPct !== '' && r.proficiencyPct != null ? r.proficiencyPct + '%' : ''), r.level2, r.level3, r.action,
    ]);
    return buildPptx('annex3.pptx', rows, 5, null, 18, null, approversOf(b));
  }
  app.post('/api/admin/annex/annex3.pptx', requireAdmin, async (req, res) => {
    try {
      const b = req.body || {};
      const buf = await makeAnnex3(b);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
      res.setHeader('Content-Disposition', `attachment; filename="Annex3_Skills_Analysis_${safeName(b.section)}.pptx"`);
      res.send(buf);
    } catch (e) { console.error('[annex3.pptx]', e); res.status(500).json({ error: 'Could not build the file: ' + e.message }); }
  });
  // The printed form has narrow columns: keep each group to its label + 3 short names.
  function shortStudents(t) {
    return String(t || '').split('\n').map((ln) => {
      const m = ln.match(/^([^:]+):\s*(.*)$/);
      if (!m) return ln;
      const more = (m[2].match(/\+(\d+) more\s*$/) || [])[1];
      const names = m[2].replace(/\s*\+\d+ more\s*$/, '').split(/\s*,\s*/).filter(Boolean);
      const extra = names.length - 3 + (more ? +more : 0);
      return `${m[1]}: ${names.slice(0, 3).map((n) => n.split(/\s+/).slice(0, 2).join(' ')).join(', ')}${extra > 0 ? ` +${extra}` : ''}`;
    }).join('\n');
  }
  async function makeAnnex4(b) {
      const months = (Array.isArray(b.months) && b.months.length ? b.months : [b.month || 'First Month']).map((m) => String(m).slice(0, 40)).slice(0, 12);
      const rows = (Array.isArray(b.plan) ? b.plan : []).slice(0, 100).map((p) => [
        (p.kind === 'enrichment' ? 'Enrichment: ' : '') + (p.skill || ''), shortStudents(p.students), p.baseline + (p.target ? '\nTarget: ' + p.target : ''), p.strategy || (Array.isArray(p.strategies) ? p.strategies.join('; ') : ''), p.responsible, p.sessions, p.indicator, p.followUp,
      ]);
      return buildPptx('annex4.pptx', rows, 5, null, 20, months.map((m) => ({ rows, extra: (xml) => xml.replace('<a:t>First Month</a:t>', `<a:t>${xmlEsc(m)}</a:t>`) })), approversOf(b));
  }
  app.post('/api/admin/annex/annex4.pptx', requireAdmin, async (req, res) => {
    try {
      const b = req.body || {};
      const buf = await makeAnnex4(b);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
      res.setHeader('Content-Disposition', `attachment; filename="Annex4_Intervention_Plan_${safeName(b.section)}.pptx"`);
      res.send(buf);
    } catch (e) { console.error('[annex4.pptx]', e); res.status(500).json({ error: 'Could not build the file: ' + e.message }); }
  });

  // ── Enhanced version (Word, landscape) ─────────────────────────────────
  const docx = require('docx');
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, ShadingType, PageOrientation, BorderStyle, VerticalAlign } = docx;
  const NAVY = '1F3864', BLUE = '4472C4', GREEN = '70AD47', GREY = '64748B';
  const tx = (t, o = {}) => new TextRun(Object.assign({ text: String(t == null ? '' : t), size: 17, font: 'Calibri' }, o));
  const para = (runs, o = {}) => new Paragraph(Object.assign({ children: Array.isArray(runs) ? runs : [runs], spacing: { after: 40 } }, o));
  const lines = (t, o) => String(t == null ? '' : t).split('\n').map((ln) => para(tx(ln, o)));
  const cellOf = (content, o = {}) => new TableCell({ children: Array.isArray(content) ? content : lines(content, o.run), verticalAlign: VerticalAlign.CENTER,
    shading: o.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: o.fill } : undefined, width: o.w ? { size: o.w, type: WidthType.DXA } : undefined,
    margins: { top: 50, bottom: 50, left: 70, right: 70 } });
  const headRow = (labels, widths, fill) => new TableRow({ tableHeader: true, children: labels.map((l, i) => cellOf([para(tx(l, { bold: true, color: 'FFFFFF', size: 17 }), { alignment: AlignmentType.CENTER })], { fill, w: widths[i] })) });
  const bar = (pct) => { const n = Math.round(Math.max(0, Math.min(100, +pct || 0)) / 10); return '█'.repeat(n) + '░'.repeat(10 - n); };
  const lvlFill = (pct, pass) => (pct >= 80 ? 'DCFCE7' : pct >= pass ? 'FEF9C3' : pct >= 40 ? 'FFEDD5' : 'FEE2E2');
  function header(meta, title, sub) {
    return [
      para(tx('Al-Nouimiah School', { bold: true, size: 30, color: NAVY })),
      para(tx('Cycles 1, 2, 3 — Girls Section', { size: 18, color: GREY })),
      para([tx(title, { bold: true, size: 26, color: NAVY }), tx(sub ? '   ' + sub : '', { italics: true, size: 20, color: GREY })], { spacing: { before: 120, after: 60 } }),
      para([tx('Class: ', { bold: true }), tx(meta.section || ''), tx('    Subject: ', { bold: true }), tx(meta.subject || ''), tx('    Grade: ', { bold: true }), tx(meta.grade || ''),
        tx('    Teacher: ', { bold: true }), tx(meta.teacher || ''), tx('    Date: ', { bold: true }), tx(new Date().toISOString().slice(0, 10))]),
      para(tx(meta.assessments ? 'Based on: ' + meta.assessments : '', { size: 15, color: GREY, italics: true })),
    ];
  }
  const signatures = (ap) => {
    ap = ap || { academic: '', principal: '' };
    const nm = (v) => (v ? tx(v, { size: 17, bold: true }) : tx('______________________', { size: 17 }));
    return [
      para(tx(' '), { spacing: { before: 200 } }),
      para([tx('Academic Approval:      Name: ', { size: 17 }), nm(ap.academic), tx('     Signature: ______________     Date: ', { size: 17 }), tx(todayUAE(), { size: 17, bold: true })]),
      para([tx('School Principal Approval:      Name: ', { size: 17 }), nm(ap.principal), tx('     Signature: ______________     Date: ', { size: 17 }), tx(todayUAE(), { size: 17, bold: true })], { spacing: { before: 160 } }),
    ];
  };
  function enhanced3(meta, rows) {
    const b = meta.bands || {};
    const W = [1900, 650, 750, 1250, 1250, 1250, 900, 1350, 850, 3100];
    const out = header(meta, 'Annex 3 — Skills Analysis and Student Classification', '');
    out.push(para([tx('Levels: ', { bold: true }), tx(`Proficient ≥ ${b.pass}%  ·  Level 2 (BF) ${b.bf}–${b.pass - 0.1}%  ·  Level 3 (F) below ${b.bf}%  ·  At risk (BP) ${b.pass}–${b.bp - 0.1}%  ·  Priority: High < 50% proficient, Medium 50–79%, Low ≥ 80%`, { size: 15, color: GREY })]));
    const tr = rows.map((r) => {
      const n = +r.students || 0; const pc = (k) => (n ? Math.round((+r[k] || 0) / n * 100) + '%' : '');
      const pr = +r.proficiencyPct || 0; const prio = pr < 50 ? 'High' : pr < 80 ? 'Medium' : 'Low';
      return new TableRow({ children: [
        cellOf(r.skill, { run: { bold: true } }), cellOf(String(n)), cellOf((r.average != null ? r.average + '%' : '')),
        cellOf(`${r.proficient} (${pr}%)`, { fill: lvlFill(pr, b.pass) }), cellOf(`${r.level2} (${pc('level2')})`, { fill: +r.level2 ? 'FFEDD5' : undefined }),
        cellOf(`${r.level3} (${pc('level3')})`, { fill: +r.level3 ? 'FEE2E2' : undefined }), cellOf(String(r.atRisk || 0)),
        cellOf(bar(pr), { run: { color: pr >= b.pass ? '16A34A' : 'DC2626', size: 15 } }),
        cellOf(prio, { run: { bold: true, color: prio === 'High' ? 'B91C1C' : prio === 'Medium' ? 'B45309' : '15803D' } }), cellOf(r.action || ''),
      ] });
    });
    out.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headRow(['Skill', 'No. of students', 'Average', 'Proficient', 'Level 2 (BF)', 'Level 3 (F)', 'At risk (BP)', 'Proficiency', 'Priority', 'Suggested action'], W, BLUE), ...tr] }));
    // Classification lists
    out.push(para(tx('Student classification by skill', { bold: true, size: 22, color: NAVY }), { spacing: { before: 240, after: 80 } }));
    const W2 = [2400, 4300, 4300, 4300];
    out.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headRow(['Skill', 'Level 3 (F) — intensive support', 'Level 2 (BF) — targeted support', 'At risk (BP) — monitor'], W2, NAVY),
      ...rows.map((r) => new TableRow({ children: [cellOf(r.skill, { run: { bold: true } }), cellOf((r.level3Names || []).join(', ') || '—', { fill: 'FEF2F2' }), cellOf((r.level2Names || []).join(', ') || '—', { fill: 'FFF7ED' }), cellOf((r.atRiskNames || []).join(', ') || '—', { fill: 'FEFCE8' })] }))] }));
    return out.concat(signatures(meta.approvers));
  }
  function enhanced4(meta, plan) {
    const W = [1700, 2300, 1300, 2700, 1500, 1500, 1200, 1700, 1700];
    const out = header(meta, 'Annex 4 — Intervention and Enrichment Plan', meta.month || '');
    const plat = (p) => (Array.isArray(p.strategies) ? p.strategies.filter((x) => /adeptly|ielts/i.test(x)) : []).map((x) => x.replace(/^(Weekly )?practice on the /i, '')).join(', ');
    const tr = plan.map((p) => new TableRow({ children: [
      cellOf([para(tx(p.skill || '', { bold: true })), para(tx(p.kind === 'enrichment' ? 'Enrichment' : `Intervention · priority ${p.level || ''}`, { size: 15, color: p.kind === 'enrichment' ? '15803D' : 'B91C1C' }))], { fill: p.kind === 'enrichment' ? 'F0FDF4' : 'FEF2F2' }),
      cellOf(p.students || ''), cellOf((p.baseline || '') + (p.target ? '\n→ Target: ' + p.target : '')),
      cellOf([...(Array.isArray(p.strategies) && p.strategies.length ? p.strategies.map((x) => para(tx('• ' + x, { bold: true, size: 16 }))) : []), ...lines(p.strategy || '')]),
      cellOf(plat(p) || '—'), cellOf(p.sessions || ''), cellOf(p.responsible || ''),
      cellOf([para(tx('Indicator: ', { bold: true })), ...lines(p.indicator || ''), para(tx('Week 2: ______   Week 4: ______', { size: 15, color: GREY }))]),
      cellOf([...(p.followUp ? lines(p.followUp) : []), para(tx('☐ Continue', { size: 16 })), para(tx('☐ Move to enrichment', { size: 16 })), para(tx('☐ Escalate / refer', { size: 16 }))]),
    ] }));
    out.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headRow(['Target skill', 'Group / students', 'Baseline → target', 'Strategies', 'Platform', 'Sessions & timing', 'Responsible', 'Progress indicator & checks', 'Follow-up decision'], W, GREEN), ...tr] }));
    return out.concat(signatures(meta.approvers));
  }
  async function makeEnhanced(b) {
      const meta = Object.assign({}, b.meta || {}, { month: b.month || '', approvers: approversOf(b) });
      const which = String(b.which || 'both');
      const sections = [];
      const page = { size: { orientation: PageOrientation.LANDSCAPE }, margin: { top: 600, bottom: 600, left: 600, right: 600 } };
      if (which !== '4') sections.push({ properties: { page }, children: enhanced3(meta, (Array.isArray(b.rows) ? b.rows : []).slice(0, 200)) });
      const months = (Array.isArray(b.months) && b.months.length ? b.months : [b.month || '']).map((m) => String(m).slice(0, 40)).slice(0, 12);
      if (which !== '3') for (const m of months) sections.push({ properties: { page }, children: enhanced4(Object.assign({}, meta, { month: m }), (Array.isArray(b.plan) ? b.plan : []).slice(0, 100)) });
      const doc = new Document({ creator: 'ClassCurio', title: 'Annex 3 & 4', sections });
      return Packer.toBuffer(doc);
  }
  app.post('/api/admin/annex/enhanced.docx', requireAdmin, async (req, res) => {
    try {
      const b = req.body || {};
      const meta = Object.assign({}, b.meta || {});
      const which = String(b.which || 'both');
      const buf = await makeEnhanced(b);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="Annex${which === 'both' ? '3-4' : which}_Enhanced_${safeName(meta.section)}.docx"`);
      res.send(buf);
    } catch (e) { console.error('[annex enhanced]', e); res.status(500).json({ error: 'Could not build the file: ' + e.message }); }
  });

  // Both formats in one ZIP: the MOE school form (PowerPoint) + the ClassCurio enhanced version (Word).
  app.post('/api/admin/annex/bundle.zip', requireAdmin, async (req, res) => {
    try {
      const b = req.body || {};
      const name = safeName((b.meta && b.meta.section) || b.section);
      const zip = new JSZip();
      zip.file(`MOE form/Annex3_Skills_Analysis_${name}.pptx`, await makeAnnex3(b));
      zip.file(`MOE form/Annex4_Intervention_Plan_${name}.pptx`, await makeAnnex4(b));
      zip.file(`ClassCurio version/Annex3-4_Enhanced_${name}.docx`, await makeEnhanced(Object.assign({}, b, { which: 'both' })));
      const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="Annex3-4_${name}.zip"`);
      res.send(buf);
    } catch (e) { console.error('[annex bundle]', e); res.status(500).json({ error: 'Could not build the ZIP: ' + e.message }); }
  });

  return { buildPptx };
};
