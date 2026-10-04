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

const CODE_RE = /^\s*[A-Z][A-Z0-9&]{1,6}(?:\.[0-9A-Z]{1,4}){2,7}\s*/;

module.exports = function annex(app, d) {
  const { readAll, requireAdmin, claudeList, questionEarned } = d;
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
  const num = (v, dflt) => (v === '' || v == null || !Number.isFinite(+v) ? dflt : +v);

  // ── Options: classes → assessments (with how many students took them) ────
  app.get('/api/admin/annex/options', requireAdmin, (req, res) => {
    const users = new Map(rd('users.json').map((u) => [u.id, u]));
    const taken = new Map();
    for (const r of rd('results.json')) taken.set(r.assessmentId, (taken.get(r.assessmentId) || 0) + 1);
    const assessments = rd('assessments.json').filter((a) => !a.deletedAt);
    const classes = rd('classes.json').map((c) => {
      const t = users.get(c.teacherId) || {};
      const list = assessments.filter((a) => a.classId === c.id).map((a) => ({
        id: a.id, title: a.title, subject: a.subject || '', grade: a.grade || '', term: a.term || '',
        date: a.scheduledDate || '', submissions: taken.get(a.id) || 0,
      })).sort((x, y) => String(y.date).localeCompare(String(x.date)));
      return { id: c.id, name: c.name, teacherId: c.teacherId, teacher: t.name || t.email || '', assessments: list };
    }).filter((c) => c.assessments.some((a) => a.submissions > 0));
    res.json({ classes });
  });

  // ── Build the tables from the chosen assessments ─────────────────────────
  app.post('/api/admin/annex/build', requireAdmin, (req, res) => {
    try {
      const b = req.body || {};
      const ids = new Set((Array.isArray(b.assessmentIds) ? b.assessmentIds : []).map(String));
      if (!ids.size) return res.status(400).json({ error: 'Choose at least one assessment.' });
      const cls = rd('classes.json').find((c) => c.id === b.classId);
      if (!cls) return res.status(404).json({ error: 'Class not found.' });
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
        plan.push({ kind: 'intervention', skill: r.skill, students: who, baseline: `${r.proficiencyPct}% proficient (avg ${r.average}%)`, strategy: '', responsible: teacher.name || '', sessions: '', indicator: '', followUp: '' });
      }
      for (const r of rows.filter((x) => x.proficiencyPct >= 80 && x.proficient > 0).slice(-2)) {
        plan.push({ kind: 'enrichment', skill: r.skill, students: `Proficient (${r.proficient}): ${short(r.proficientNames, 5)}`, baseline: `${r.proficiencyPct}% proficient (avg ${r.average}%)`, strategy: '', responsible: teacher.name || '', sessions: '', indicator: '', followUp: '' });
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
        const items = await claudeList({ system: sys + '\nFor each plan row write: "strategy" (a concrete teaching strategy for that group and skill), "sessions" (number, length and timing, e.g. "3 × 30 min, weekly, weeks 1–4"), "indicator" (a measurable progress indicator with a target, e.g. "Exit quiz ≥ 60% by week 4"). Intervention rows are for students below the pass mark; enrichment rows are for proficient students.',
          user: JSON.stringify(plan.map((p, i) => ({ id: 'P' + i, kind: p.kind, skill: p.skill, baseline: p.baseline, group: String(p.students || '').split('\n').map((x) => x.replace(/:.*$/, '')).join(', ') }))),
          maxTokens: 3500, itemProps: { id: { type: 'string' }, strategy: { type: 'string' }, sessions: { type: 'string' }, indicator: { type: 'string' } }, required: ['id', 'strategy', 'sessions', 'indicator'] });
        for (const x of items || []) if (x && x.id) out.plan[String(x.id).trim()] = { strategy: String(x.strategy || '').slice(0, 220), sessions: String(x.sessions || '').slice(0, 120), indicator: String(x.indicator || '').slice(0, 160) };
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
  function fillSlide(slideXml, rows, rowsPerSlide, extra) {
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
    if (extra) out = extra(out);
    return out;
  }
  // Estimate how tall a row will be (7pt text, word-wrapped) so each slide
  // only gets as many rows as fit above the signature lines.
  const LINE = 97000, PAD = 91440, MIN_ROW = 304800, TABLE_Y = 2240000, FOOTER_Y = 4480000, HEAD_H = 330000;
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
  async function buildPptx(templateName, rows, rowsPerSlide, extra, chars) {
    const pageRows = paginate(rows, chars || 17, rowsPerSlide);
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
      while (p === pages - 1 && pr.length + blanks < rowsPerSlide && used + MIN_ROW * 1.15 <= FOOTER_Y - TABLE_Y - HEAD_H) { blanks++; used += MIN_ROW * 1.15; }
      zip.file(`ppt/slides/slide${n}.xml`, fillSlide(base, pr, pr.length + blanks, extra));
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

  app.post('/api/admin/annex/annex3.pptx', requireAdmin, async (req, res) => {
    try {
      const b = req.body || {};
      const rows = (Array.isArray(b.rows) ? b.rows : []).slice(0, 200).map((r) => [
        r.subject, r.section, r.skill, r.students, r.proficient, (r.proficiencyPct !== '' && r.proficiencyPct != null ? r.proficiencyPct + '%' : ''), r.level2, r.level3, r.action,
      ]);
      const buf = await buildPptx('annex3.pptx', rows, 5, null, 20);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
      res.setHeader('Content-Disposition', `attachment; filename="Annex3_Skills_Analysis_${safeName(b.section)}.pptx"`);
      res.send(buf);
    } catch (e) { console.error('[annex3.pptx]', e); res.status(500).json({ error: 'Could not build the file: ' + e.message }); }
  });
  app.post('/api/admin/annex/annex4.pptx', requireAdmin, async (req, res) => {
    try {
      const b = req.body || {};
      const month = String(b.month || 'First Month').slice(0, 40);
      const rows = (Array.isArray(b.plan) ? b.plan : []).slice(0, 100).map((p) => [
        (p.kind === 'enrichment' ? 'Enrichment: ' : '') + (p.skill || ''), p.students, p.baseline, p.strategy, p.responsible, p.sessions, p.indicator, p.followUp,
      ]);
      const buf = await buildPptx('annex4.pptx', rows, 5, (xml) => xml.replace('<a:t>First Month</a:t>', `<a:t>${xmlEsc(month)}</a:t>`), 23);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
      res.setHeader('Content-Disposition', `attachment; filename="Annex4_Intervention_Plan_${safeName(b.section)}.pptx"`);
      res.send(buf);
    } catch (e) { console.error('[annex4.pptx]', e); res.status(500).json({ error: 'Could not build the file: ' + e.message }); }
  });

  return { buildPptx };
};
