// ════════════════════════════════════════════════════════════════════════
//  📋 MOE test specifications (English, End-of-Term) + grade writing rubrics
//  - server/specs/blueprints-*.json : built-in plans, one per Grade Level Goal
//    (parts, question counts, marks, text lengths, themes, vocabulary,
//    grammar, learning-outcome codes, writing tasks).
//  - server/specs/rubrics.json      : built-in grade/stream writing rubrics.
//  - data/specsets.json             : specifications an admin uploaded later
//    (draft → active → retired). data/spec-rubrics.json : uploaded rubrics.
//  The AI writes a paper part by part from the plan; every part is checked
//  against the plan and rewritten (up to 3 tries) if it does not match.
//  Every assessment keeps the specification set it was written from.
// ════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'specs');
function loadJson(f, fb) { try { return JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { console.warn('[specs] could not read', f, e.message); return fb; } }

const BUILTIN_SETS = [
  { id: '2026-27-t1', label: 'End of Term 1 · 2026-2027', file: 'blueprints-2026-27-t1.json', academicYear: '2026-2027', term: '1', builtIn: true, status: 'active' },
].map((s) => Object.assign({}, s, { blueprints: loadJson(s.file, []) }));
const BUILTIN_RUBRICS = loadJson('rubrics.json', []);

const norm = (s) => String(s || '').trim().toLowerCase();
const countWords = (t) => String(t || '').replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
const classLabel = (c) => `Grade ${c.grade} ${c.stream}`;
// "230-250" / "150" → allowed [min, max] with 10% either way (every spec allows it).
function wordRange(w) {
  const nums = String(w || '').match(/\d+/g);
  if (!nums) return null;
  const lo = Number(nums[0]), hi = Number(nums[1] || nums[0]);
  return [Math.floor(lo * 0.9), Math.ceil(hi * 1.1)];
}
const stripGaps = (t) => String(t || '').replace(/\(\d+\)\s*_{2,}/g, 'gap');
// Easy / medium / hard from the level the specification gives each part:
// "Towards Grade Level Goal" = easy, "At Grade Level Goal" / "Mastery" = medium,
// "Beyond Grade Level Goal" / "Mastery with Greater Depth" = hard. Writing = medium.
function levelOf(p) {
  const l = String((p && p.level) || '').toLowerCase();
  if (!p || p.skill === 'writing') return 'medium';
  if (/beyond|greater depth/.test(l)) return 'hard';
  if (/towards?/.test(l)) return 'easy';
  return 'medium';
}

// Paper length: the full paper, or a shorter quiz with fewer questions per part
// (same texts, same task types, same balance between parts).
const SIZES = { full: 1, half: 0.5, quarter: 0.25 };
function partCounts(b, size) {
  const f = SIZES[size] || 1;
  const out = {};
  for (const p of b.parts || []) {
    const n = Number((p.items || {}).count) || 0;
    if (p.skill === 'writing' || !n) continue;
    out[p.id] = f === 1 ? n : Math.max(2, Math.min(n, Math.round(n * f)));
  }
  return out;
}

// Writing tasks the teacher can choose. Grade 9 General may use either the
// email reply in the specification or an opinion essay.
function writingChoices(b) {
  const p = (b.parts || []).find((x) => x.skill === 'writing');
  if (!p) return [];
  const out = (p.writingTasks || []).map((w) => ({ key: w.id, id: w.id, name: w.name, genre: w.genre, marks: w.marks, rubric: w.rubric, length: w.length, minWords: w.minWords }));
  if (/g9glg$/.test(b.id) && b.cycle === 3) {
    const t = out.find((w) => w.id === '1.2' && w.genre === 'email');
    if (t) out.push(Object.assign({}, t, { key: '1.2-opinion', name: 'Opinion essay', genre: 'opinion-essay', alternativeTo: '1.2' }));
  }
  return out;
}
function writingTasksFor(b, keys) {
  const p = (b.parts || []).find((x) => x.skill === 'writing');
  if (!p) return [];
  const base = p.writingTasks || [];
  const choices = writingChoices(b);
  const want = Array.isArray(keys) && keys.length ? keys : base.map((w) => w.id);
  const out = [];
  for (const k of want) {
    const c = choices.find((x) => x.key === k);
    if (!c) continue;
    const w = base.find((x) => x.id === c.id);
    if (!w || out.some((o) => o.id === w.id)) continue;
    out.push(Object.assign({}, w, { key: c.key }, c.alternativeTo ? { name: c.name, genre: c.genre, alternativeTo: c.alternativeTo } : {}));
  }
  return out;
}

// ── The check: does a paper (sections + questions) match the plan? ──
// opts.parts = part ids included, opts.writing = writing task keys,
// opts.counts = questions per part for a shorter quiz.
function check(b, sections, questions, opts) {
  opts = opts || {};
  const issues = [];
  const parts = (b.parts || []).filter((p) => !opts.parts || !opts.parts.length || opts.parts.includes(p.id));
  const secByPart = new Map();
  for (const s of sections || []) if (s && s.specPart) secByPart.set(s.specPart, s);
  let total = 0, expected = 0;
  for (const p of parts) {
    const it = p.items || {};
    const s = secByPart.get(p.id);
    if (!s) { issues.push({ part: p.id, msg: `${p.title} is missing.` }); continue; }
    const qs = (questions || []).filter((q) => q.sectionId === s.id);
    if (p.skill === 'writing') {
      const tasks = writingTasksFor(b, opts.writing);
      for (const w of tasks) {
        expected += Number(w.marks) || 0;
        const q = qs.find((x) => x.specTask === w.id);
        if (!q) { issues.push({ part: p.id, msg: `Writing Task ${w.id} (${w.name}) is missing.` }); continue; }
        if (q.type !== 'writing') issues.push({ part: p.id, msg: `Task ${w.id} should be an auto-graded essay question.` });
        if (Number(q.points) !== Number(w.marks)) issues.push({ part: p.id, msg: `Task ${w.id} should be worth ${w.marks} marks (now ${q.points}).` });
        if (!q.rubricId) issues.push({ part: p.id, msg: `Task ${w.id} has no rubric attached.` });
        if (!String(q.prompt || '').trim()) issues.push({ part: p.id, msg: `Task ${w.id} has no prompt.` });
        total += Number(q.points) || 0;
      }
      const src = tasks.map((w) => w.sourceText).find(Boolean);
      if (src && src.words) {
        const r = wordRange(src.words), n = countWords(s.passage);
        if (r && (n < r[0] || n > r[1])) issues.push({ part: p.id, msg: `The text for the writing task should be about ${src.words} words (allowed ${r[0]}–${r[1]}); it has ${n}.` });
      }
      continue;
    }
    const want = (opts.counts && opts.counts[p.id]) || it.count;
    expected += (Number(want) || 0) * (Number(it.marksEach) || 0);
    if (want && qs.length !== want) issues.push({ part: p.id, msg: `${p.title} should have ${want} questions (now ${qs.length}).` });
    const nOpt = it.format === 'matching' ? 3 : Number(it.options) || 0;
    qs.forEach((q, i) => {
      if (q.type !== 'mc') issues.push({ part: p.id, msg: `${p.title} Q${i + 1} should be multiple choice.` });
      if (nOpt && Array.isArray(q.options) && q.options.length !== nOpt) issues.push({ part: p.id, msg: `${p.title} Q${i + 1} should have ${nOpt} options (now ${q.options.length}).` });
      if (it.marksEach && Number(q.points) !== Number(it.marksEach)) issues.push({ part: p.id, msg: `${p.title} Q${i + 1} should be worth ${it.marksEach} marks (now ${q.points}).` });
      if (Array.isArray(q.options) && q.options.some((o) => !String(o || '').trim()) && !(q.optionImages || []).some(Boolean)) issues.push({ part: p.id, msg: `${p.title} Q${i + 1} has an empty option.` });
      total += Number(q.points) || 0;
    });
    if (p.text && p.text.words && p.text.count) {
      const r = wordRange(p.text.words), wc = countWords(stripGaps(s.passage));
      if (r && (wc < r[0] || wc > r[1])) issues.push({ part: p.id, msg: `${p.title}: the text should be ${p.text.words} words (allowed ${r[0]}–${r[1]}); it has ${wc}.` });
    }
    if (p.text && p.text.count && it.format === 'gapfill-mc' && want) {
      const gaps = (String(s.passage || '').match(/\(\d+\)\s*_{2,}/g) || []).length;
      if (gaps !== want) issues.push({ part: p.id, msg: `${p.title}: the text should have ${want} numbered gaps like (1) ______ (now ${gaps}).` });
    }
  }
  return { ok: !issues.length, issues, total, expected };
}

// ── Sanity check of an uploaded (AI-read) blueprint, for the admin review ──
function reviewBlueprint(b) {
  const w = [];
  if (!b || typeof b !== 'object') return ['Not a blueprint.'];
  if (!b.id) w.push('No id.');
  if (!Array.isArray(b.classes) || !b.classes.length) w.push('No classes listed.');
  if (!Array.isArray(b.parts) || !b.parts.length) { w.push('No parts.'); return w; }
  let sum = 0, reading = 0, writing = 0;
  for (const p of b.parts) {
    const it = p.items || {};
    const t = Number(it.totalMarks) || 0;
    sum += t;
    if (p.skill === 'writing') {
      writing += t;
      const wt = (p.writingTasks || []).reduce((a, x) => a + (Number(x.marks) || 0), 0);
      if (!(p.writingTasks || []).length) w.push(`${p.title || p.id}: no writing tasks.`);
      else if (t && wt !== t) w.push(`${p.title || p.id}: writing tasks add up to ${wt}, the part says ${t}.`);
    } else {
      reading += t;
      if (it.count && it.marksEach && it.count * it.marksEach !== t) w.push(`${p.title || p.id}: ${it.count} × ${it.marksEach} ≠ ${t}.`);
      const oc = (p.outcomes || []).reduce((a, o) => a + (Number(o.count) || 0), 0);
      if (it.count && oc && oc !== it.count && oc !== 1) w.push(`${p.title || p.id}: outcome counts add up to ${oc}, not ${it.count}.`);
      if (!it.options && it.format !== 'writing') w.push(`${p.title || p.id}: number of options not found.`);
    }
  }
  if (b.totalMarks && sum !== Number(b.totalMarks)) w.push(`Parts add up to ${sum}, the paper says ${b.totalMarks}.`);
  if (b.readingMarks && reading !== Number(b.readingMarks)) w.push(`Reading parts add up to ${reading}, the paper says ${b.readingMarks}.`);
  if (b.writingMarks && writing !== Number(b.writingMarks)) w.push(`Writing adds up to ${writing}, the paper says ${b.writingMarks}.`);
  return w;
}
function reviewRubric(r) {
  const w = [];
  if (!r || !Array.isArray(r.criteria) || !r.criteria.length) return ['No criteria found.'];
  if (!Array.isArray(r.classes) || !r.classes.length) w.push('No classes listed.');
  if (!['writing', 'main-idea'].includes(r.kind)) w.push('Kind should be "writing" or "main-idea".');
  const sm = Number(r.scoreMax) || 0;
  if (sm && r.totalMax && sm * r.criteria.length !== Number(r.totalMax)) w.push(`${r.criteria.length} criteria × ${sm} ≠ ${r.totalMax}.`);
  for (const c of r.criteria) if (!c.bands || !Object.keys(c.bands).length) w.push(`${c.name || c.id}: no band descriptors.`);
  return w;
}

const SPEC_SCHEMA_TEXT = `Return ONE blueprint object:
{ "id": "c{cycle}-g{n}glg" (e.g. "c3-g10glg"; "c1-g3" for Cycle 1 grade 3; "c3-g12adv" for working beyond Grade 12),
  "cycle": number, "title": heading line as printed, "gradeLevelGoal": e.g. "Grade 10 GLG",
  "classes": [ { "grade": "9", "stream": "Advanced" }, … ] (every class the page is for; Cycle 1 stream "General"),
  "stage": "6" or null, "cefr": "B1.2", "totalMarks": 100, "readingMarks": 60, "writingMarks": 40, "platform": as printed, "languageDomains": as printed,
  "parts": [ { "id": "P1"|"P1A"|"P2"|"P3A"|"P3B"|"P4"…, "title": "Part 1: Vocabulary", "level": "Towards Grade Level Goal",
    "skill": "vocabulary"|"grammar"|"reading"|"writing"|"spelling"|"other", "taskType": "Multiple-Choice Gap-Fill",
    "instructions": as printed, "themes": [ { "theme": "...", "vocabulary": ["..."] } ], "grammar": ["G.19.2 ..."], "functionalLanguage": ["FL.44 ..."],
    "text": { "count": 1, "type": "descriptive", "words": "230-250", "tolerance": "10% either way", "cefr": "B1.1" } or null,
    "items": { "count": 8, "format": "mc"|"gapfill-mc"|"matching"|"true-false"|"short"|"writing"|"other", "options": 3, "marksEach": 3, "totalMarks": 24 },
    "outcomes": [ { "code": "ENG.05.RV.CS.2.1", "count": 4, "skill": "Specific Information", "text": "..." } ],
    "constructLimits": ["verbatim bullet", …],
    "writingTasks": null or [ { "id": "1.1", "name": "Main idea", "genre": "main-idea"|"email"|"opinion-essay"|"story"|"informational"|"description"|"other",
       "instructions": as printed, "promptBullets": 3, "sourceText": { "type": "email", "words": "160", "tolerance": "10% either way" } or null,
       "image": false, "wordBank": null, "minWords": 130, "length": "at least 130 words in paragraphs", "marks": 15, "rubric": "main-idea"|"writing" } ] } ] }
Copy wording exactly. Never invent content; use null or [] when something is not printed. Part marks must add up to the printed totals.`;
const RUBRIC_SCHEMA_TEXT = `Return ONE rubric object:
{ "id": short id from classes + kind (e.g. "g9a-g10g-writing", "g12a-main-idea"), "title": as printed, "kind": "writing"|"main-idea",
  "classes": [ { "grade": "9", "stream": "Advanced" }, … ] (Grade 3/4 stream "General"),
  "scoreMin": 0, "scoreMax": highest score per criterion, "bandLabels": ["5","4","3","2","1","0"] as printed (e.g. "7-8"),
  "criteria": [ { "id": "task_completion", "name": "Task Completion", "max": 5, "bands": { "5": "descriptor", "4": "…" } } ],
  "zeroRule": text of a whole-script 0 row or null, "totalMax": scoreMax × number of criteria }
Copy every descriptor word for word.`;

module.exports = function specs(app, deps) {
  const { requireTeacher, readApiKey, claudeFetch, asyncJob, uuid, readAll, writeAll, isAdminReq, upload } = deps;

  // ── Sets (built-in + uploaded) and rubrics (built-in + uploaded) ──
  const SETS_FILE = 'specsets.json', RUB_FILE = 'spec-rubrics.json', CFG_FILE = 'specs-config.json';
  const uploadedSets = () => { try { return readAll(SETS_FILE) || []; } catch { return []; } };
  const cfg = () => { try { const c = readAll(CFG_FILE); return Array.isArray(c) ? (c[0] || {}) : (c || {}); } catch { return {}; } };
  const saveCfg = (c) => writeAll(CFG_FILE, [c]);
  function allSets() {
    const up = uploadedSets();
    const hidden = new Set(cfg().retiredBuiltIn || []);
    return BUILTIN_SETS.map((s) => Object.assign({}, s, hidden.has(s.id) ? { status: 'retired' } : {})).concat(up);
  }
  const activeSets = () => allSets().filter((s) => s.status === 'active');
  function currentSetId() {
    const c = cfg().currentSet;
    const act = activeSets();
    if (c && act.some((s) => s.id === c)) return c;
    return act.length ? act[act.length - 1].id : (BUILTIN_SETS[0] && BUILTIN_SETS[0].id);
  }
  const findSet = (id) => allSets().find((s) => s.id === id) || null;
  function getBlueprint(setId, id) {
    const sets = setId ? [findSet(setId)].filter(Boolean) : [];
    for (const s of sets.concat(allSets())) {
      const b = (s.blueprints || []).find((x) => x.id === id);
      if (b) return Object.assign({ set: s.id, setLabel: s.label, academicYear: s.academicYear, term: s.term }, b);
    }
    return null;
  }
  function allRubrics() {
    let up = [];
    try { up = (readAll(RUB_FILE) || []).filter((r) => r.status === 'active'); } catch {}
    const out = BUILTIN_RUBRICS.slice();
    for (const r of up) {
      const i = out.findIndex((x) => x.id === r.id);
      if (i >= 0) out[i] = r; else out.push(r);
    }
    return out;
  }
  const getRubric = (id) => allRubrics().find((r) => r.id === id) || null;
  function rubricFor(grade, stream, kind) {
    const list = allRubrics().filter((r) => r.kind === kind && (r.classes || []).some((c) => String(c.grade) === String(grade) && norm(c.stream) === norm(stream)));
    return list.length ? list[list.length - 1] : null;   // an uploaded rubric wins over the built-in one
  }

  function summary(s, b) {
    return {
      id: b.id, set: s.id, setLabel: s.label, cycle: b.cycle, title: b.title, gradeLevelGoal: b.gradeLevelGoal,
      classes: b.classes, stage: b.stage, cefr: b.cefr, totalMarks: b.totalMarks,
      parts: (b.parts || []).map((p) => ({ id: p.id, title: p.title, level: p.level, skill: p.skill, themes: (p.themes || []).map((t) => t.theme), marks: (p.items || {}).totalMarks, items: (p.items || {}).count, marksEach: (p.items || {}).marksEach })),
      writing: writingChoices(b),
    };
  }

  app.get('/api/specs', requireTeacher, (req, res) => {
    const sets = activeSets();
    res.json({
      current: currentSetId(),
      sets: sets.map((s) => ({ id: s.id, label: s.label, academicYear: s.academicYear, term: s.term })),
      blueprints: sets.flatMap((s) => (s.blueprints || []).map((b) => summary(s, b))),
      rubrics: allRubrics().map((r) => ({ id: r.id, title: r.title, kind: r.kind, classes: r.classes, totalMax: r.totalMax })),
      sizes: Object.keys(SIZES),
    });
  });
  app.get('/api/specs/rubrics/:id', requireTeacher, (req, res) => {
    const r = getRubric(req.params.id);
    if (!r) return res.status(404).json({ error: 'Rubric not found' });
    res.json({ rubric: r });
  });
  app.post('/api/specs/:id/check', requireTeacher, (req, res) => {
    const body = req.body || {};
    const b = getBlueprint(body.set, req.params.id);
    if (!b) return res.status(404).json({ error: 'Specification not found' });
    res.json(check(b, body.sections || [], body.questions || [], { parts: body.parts, writing: body.writing, counts: body.counts }));
  });

  // ── Generate a paper, some of its parts, or a shorter quiz ──
  app.post('/api/specs/:id/generate', requireTeacher, asyncJob, async (req, res) => {
    const body = req.body || {};
    const b = getBlueprint(body.set, req.params.id);
    if (!b) return res.status(404).json({ ok: false, error: 'Specification not found' });
    if (!readApiKey()) return res.status(503).json({ ok: false, error: 'AI generation needs the Anthropic API key (Settings).' });
    const cls = (b.classes || []).find((c) => String(c.grade) === String(body.grade) && norm(c.stream) === norm(body.stream)) || b.classes[0];
    const wantParts = Array.isArray(body.parts) && body.parts.length ? body.parts.map(String) : b.parts.map((p) => p.id);
    const parts = b.parts.filter((p) => wantParts.includes(p.id));
    if (!parts.length) return res.status(400).json({ ok: false, error: 'Choose at least one part.' });
    const wTasks = writingTasksFor(b, body.writing);
    if (parts.some((p) => p.skill === 'writing') && !wTasks.length) return res.status(400).json({ ok: false, error: 'Choose at least one writing task.' });
    const size = SIZES[body.size] ? body.size : 'full';
    const counts = partCounts(b, size);
    const topic = String(body.topic || '').slice(0, 300);
    const plans = {};
    for (const p of parts) plans[p.id] = makePlan(b, p, wTasks, p.skill === 'writing' ? body.writingTheme : null);
    try {
      const results = await Promise.all(parts.map((p) => genPart(b, p, cls, wTasks, topic, counts, plans[p.id])));
      try { remember(b, parts, results, plans); } catch (e) { console.warn('[specs] history', e.message); }
      const sections = [], questions = [], notes = [];
      results.forEach((r) => { sections.push(r.section); questions.push(...r.questions); if (r.note) notes.push(r.note); });
      sections.forEach((s, i) => { s.order = i; });
      const writingKeys = wTasks.map((w) => w.key);
      const chk = check(b, sections, questions, { parts: wantParts, writing: writingKeys, counts });
      const whole = parts.length === b.parts.length;
      const kind = size !== 'full' ? `${size === 'half' ? 'Half-length' : 'Short'} quiz` : whole ? 'End-of-Term practice paper' : parts.map((p) => p.title.split(':')[0]).join(' + ');
      res.json({
        ok: true, title: `English – ${classLabel(cls)} – ${kind}`,
        description: `Written from the MOE test specification (${b.setLabel}): ${b.gradeLevelGoal}.`,
        sections, questions,
        spec: { id: b.id, set: b.set, parts: wantParts, writing: writingKeys, grade: cls.grade, stream: cls.stream, term: b.term, academicYear: b.academicYear, size, counts: size === 'full' ? undefined : counts },
        check: chk, notes,
      });
    } catch (e) {
      console.error('[specs] generate failed', e);
      res.status(502).json({ ok: false, error: 'The AI could not finish this paper: ' + e.message + '. Please try again.' });
    }
  });

  // ── Variety: rotate the specification's themes and never repeat recent prompts ──
  // Every generated part is remembered (data/spec-gen-history.json, across all teachers),
  // so the next paper for the same Grade Level Goal uses the theme used longest ago and
  // a different situation / text / question from the last few papers.
  const HISTORY = 'spec-gen-history.json';
  const histFor = (key) => (readAll(HISTORY) || []).filter((h) => h && h.key === key);
  // Does this writing task use the source text the students read first?
  const usesSource = (w) => w.genre === 'main-idea' || w.genre === 'email' || !!w.alternativeTo || !!w.sourceText;
  function makePlan(b, p, wTasks, chosen) {
    const key = b.id + '|' + p.id;
    const themes = (p.themes || []).map((t) => t.theme).filter(Boolean);
    const hist = histFor(key);
    let main = null;
    if (themes.length) {
      const idx = Number.parseInt(chosen, 10);
      if (chosen !== null && chosen !== undefined && chosen !== '' && idx >= 0 && idx < themes.length) main = themes[idx];
      else {
        // The theme used longest ago (or never) comes next; ties are broken at random.
        const lastUse = (t) => { for (let i = hist.length - 1; i >= 0; i--) if (hist[i].theme === t) return i; return -1; };
        const order = themes.map((t) => ({ t, at: lastUse(t), r: Math.random() })).sort((x, y) => x.at - y.at || x.r - y.r);
        main = order[0].t;
      }
    }
    const plan = { theme: main, themeFor: {}, avoid: [] };
    if (p.skill === 'writing') {
      const other = themes.find((t) => t !== main) || null;
      const pinned = chosen !== null && chosen !== undefined && chosen !== '';
      const hasSource = wTasks.some(usesSource);
      for (const w of wTasks) {
        // A task that does not use the source text takes the paper's other theme, so both
        // themes of the specification are covered (unless the teacher picked one theme).
        plan.themeFor[w.id] = (!pinned && other && hasSource && wTasks.length > 1 && !usesSource(w)) ? other : main;
      }
    }
    for (const h of hist.slice(-6).reverse()) for (const x of h.items || []) if (x && plan.avoid.length < 12) plan.avoid.push(x);
    return plan;
  }
  function remember(b, parts, results, plans) {
    const all = readAll(HISTORY) || [];
    parts.forEach((p, i) => {
      const r = results[i]; if (!r) return;
      const items = [];
      const clip = (t) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, 170);
      if (r.section && r.section.passage) items.push('Text: ' + clip(r.section.passage));
      if (p.skill === 'writing') for (const q of r.questions || []) items.push(`Task ${q.specTask}: ` + clip(q.prompt));
      all.push({ key: b.id + '|' + p.id, theme: plans[p.id] && plans[p.id].theme, items: items.filter((x) => x.length > 12), at: new Date().toISOString() });
    });
    writeAll(HISTORY, all.slice(-600));
  }

  async function genPart(b, p, cls, wTasks, topic, counts, plan) {
    let last = null, issues = [];
    const keys = wTasks.map((w) => w.key);
    for (let attempt = 0; attempt < 3; attempt++) {
      const raw = await askPart(b, p, cls, wTasks, topic, issues, counts, plan);
      const built = buildPart(b, p, cls, wTasks, raw, counts);
      if (plan && plan.theme) built.section.theme = plan.theme;
      const chk = check(b, [built.section], built.questions, { parts: [p.id], writing: keys, counts });
      last = built;
      if (chk.ok) return built;
      issues = chk.issues.map((x) => x.msg);
      console.warn('[specs]', b.id, p.id, 'attempt', attempt + 1, 'issues:', issues.join(' | '));
    }
    last.note = `${p.title}: ${issues.join(' ')}`;
    return last;
  }

  function partBrief(b, p, cls, wTasks, counts, plan) {
    plan = plan || {};
    const vocabOf = (name) => { const t = (p.themes || []).find((x) => x.theme === name); return t && t.vocabulary && t.vocabulary.length ? ' (vocabulary: ' + t.vocabulary.join(', ') + ')' : ''; };
    const it = p.items || {};
    const n = (counts && counts[p.id]) || it.count;
    const lines = [
      `Class: ${classLabel(cls)} · ${b.gradeLevelGoal} · Learning Continuum Stage ${b.stage || '-'} · CEFR ${b.cefr || '-'}.`,
      `Part: ${p.title} — ${p.level}. Task type: ${p.taskType}.`,
      `Instructions printed on the paper: ${p.instructions}`,
      plan.theme ? (p.skill === 'writing' && Object.values(plan.themeFor || {}).some((t) => t !== plan.theme)
          ? `Themes for this paper: the source text and the tasks that use it are on "${plan.theme}"${vocabOf(plan.theme)}; the other task is on "${Object.values(plan.themeFor).find((t) => t !== plan.theme)}" — a different topic.`
          : `Theme for this paper: "${plan.theme}"${vocabOf(plan.theme)}. Base the whole part on this theme.`)
        : (p.themes && p.themes.length ? `Theme(s) — base the part on ONE of these: ${p.themes.map((t) => t.theme + vocabOf(t.theme)).join(' || ')}` : ''),
      p.grammar && p.grammar.length ? `Grammar points to test: ${p.grammar.join('; ')}` : '',
      p.functionalLanguage && p.functionalLanguage.length ? `Functional language: ${p.functionalLanguage.join('; ')}` : '',
      p.outcomes && p.outcomes.length ? `Learning outcomes (number of questions for each in the full paper): ${p.outcomes.map((o) => `${o.count || 1} × ${o.code}${o.skill ? ' (' + o.skill + ')' : ''}: ${o.text}`).join(' || ')}` : '',
      `Construct limits (follow exactly${n !== it.count ? ', except the number of questions below' : ''}): ${(p.constructLimits || []).join(' · ')}`,
    ];
    if (p.skill === 'writing') {
      lines.push('Write these writing tasks (put each in "tasks" with its taskId):');
      for (const w of wTasks) {
        lines.push(`- Task ${w.id} "${w.name}" (${w.marks} marks)${plan.themeFor && plan.themeFor[w.id] ? ` — topic from the theme "${plan.themeFor[w.id]}"` : ''}. Template from the specification: ${w.instructions} Length: ${w.length || '-'}.` +
          (w.alternativeTo ? ' IMPORTANT: instead of an email reply, this task is an OPINION ESSAY about an issue raised in the email: "Write an opinion essay in which you:" followed by 3 bullet prompts. Write at least 130 words in paragraphs.' : '') +
          (w.promptBullets ? ` Exactly ${w.promptBullets} bullet prompts, each on its own line starting with "• ".` : '') +
          (w.image ? ' The task uses a picture: describe the picture(s) in imageDescription.' : '') +
          (w.wordBank ? ` Include ${w.wordBank} in the prompt.` : ''));
      }
      const src = wTasks.map((w) => w.sourceText).find(Boolean);
      if (src) {
        const r = wordRange(src.words);
        lines.push(`Source text the students read first — put it in "passage": a ${src.type} of ${src.words} words${src.cefr ? ' (' + src.cefr + ')' : ''}${r ? ` (it MUST be between ${r[0]} and ${r[1]} words)` : ''}. Task 1.1 asks for its main ideas, so give it 2–4 clear main ideas.`);
      } else lines.push('This part has no reading text: leave "passage" empty.');
    } else {
      const r = p.text && p.text.words ? wordRange(p.text.words) : null;
      lines.push(`Questions: exactly ${n}, each worth ${it.marksEach} marks.${n !== it.count ? ` (This is a shorter quiz: ${n} instead of ${it.count}; spread them across the learning outcomes in the same proportion.)` : ''}`);
      if (it.format === 'matching') {
        lines.push(`This is a word–picture matching task. For the online paper write each item as a picture (describe it clearly in imageDescription) with the prompt "Which word matches the picture?" and exactly 3 options: the correct word + 2 other words from the vocabulary list. Use only words from the vocabulary lists. Leave "passage" empty.`);
      } else if (it.format === 'gapfill-mc' && p.text && p.text.count) {
        lines.push(`Write ONE ${p.text.type || ''} text in "passage" of ${p.text.words} words${p.text.cefr ? ' (' + p.text.cefr + ')' : ''}${r ? ` — it MUST be between ${r[0]} and ${r[1]} words` : ''}, with exactly ${n} numbered gaps written as (1) ______, (2) ______ … in order (an example gap is not needed). Question k is about gap (k): prompt "Gap (k)", exactly ${it.options} options, one correct.` +
          (Number(it.options) > 3 ? ` The options are the WORD BANK: give every question the same list of ${it.options} words (correct answers + distractors).` : ''));
      } else if (it.format === 'gapfill-mc') {
        lines.push(`No reading text: each question is ONE sentence with one gap written as ______ and exactly ${it.options} options.` + (Number(it.options) > 3 ? ` The options are the word bank: the same list of ${it.options} words for every question; also write "Word bank: …" in "passage".` : ' Leave "passage" empty.'));
      } else {
        lines.push(`Write ONE ${p.text && p.text.type ? p.text.type : ''} text in "passage" of ${p.text ? p.text.words : '?'} words${p.text && p.text.cefr ? ' (' + p.text.cefr + ')' : ''}${r ? ` — it MUST be between ${r[0]} and ${r[1]} words` : ''}. Then exactly ${n} questions about it, each with exactly ${it.options || 3} options and one correct answer, following the outcome counts above (put the outcome code in "outcome").`);
      }
    }
    if (plan.avoid && plan.avoid.length) {
      lines.push('Recent papers for this class level already used the texts and prompts below. Write something clearly NEW: a different situation, different people, a different question and different bullet prompts (same theme is fine, but not the same idea):');
      plan.avoid.forEach((x) => lines.push('  ✗ ' + x));
    }
    return lines.filter(Boolean).join('\n');
  }

  async function askPart(b, p, cls, wTasks, topic, issues, counts, plan) {
    const isW = p.skill === 'writing';
    const tool = {
      name: 'submit_part', description: 'Submit this part of the exam paper.',
      input_schema: { type: 'object', required: ['passage'].concat(isW ? ['tasks'] : ['questions']), properties: {
        passage: { type: 'string', description: 'The text students read for this part (or the word bank). Empty if the part has no text.' },
        theme: { type: 'string' },
        questions: { type: 'array', items: { type: 'object', required: ['prompt', 'options', 'correctAnswer'], properties: {
          prompt: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, correctAnswer: { type: 'integer', description: '0-based index of the correct option' },
          outcome: { type: 'string', description: 'learning outcome code, e.g. ENG.05.RV.CS.2.1' }, skill: { type: 'string' }, imageDescription: { type: 'string' }, explanation: { type: 'string', description: 'one-sentence feedback for students' } } } },
        tasks: { type: 'array', items: { type: 'object', required: ['taskId', 'prompt'], properties: {
          taskId: { type: 'string', description: 'e.g. 1.1, 1.2 or 1' }, prompt: { type: 'string', description: 'the full task wording the student sees; bullet prompts on new lines' }, imageDescription: { type: 'string' } } } },
      } },
    };
    const system = [
      'You write UAE Ministry of Education English End-of-Term exam papers that follow the official test specification exactly.',
      'Write original texts (never copy textbook passages). Age-appropriate and culturally appropriate for UAE schools.',
      'Multiple choice: exactly one correct option, plausible distractors of similar length, no "all/none of the above"; vary the position of the correct answer.',
      'Count the words of every text you write and keep it inside the required range.',
    ].join('\n');
    const user = partBrief(b, p, cls, wTasks, counts, plan) + (topic ? `\nTeacher's topic request (stay inside the specification): ${topic}` : '') +
      (issues && issues.length ? `\n\nYOUR PREVIOUS VERSION DID NOT MATCH THE SPECIFICATION. Fix these problems: ${issues.join(' ')}` : '') +
      '\n\nSubmit with the submit_part tool.';
    const r = await claudeFetch({ max_tokens: 8000, temperature: 1, system, messages: [{ role: 'user', content: user }], tools: [tool], tool_choice: { type: 'tool', name: 'submit_part' } }, 'smart');
    if (!r || !r.ok) { const t = r ? await r.text().catch(() => '') : ''; throw new Error('AI service error ' + (r ? r.status : '') + ' ' + t.slice(0, 120)); }
    const d = await r.json();
    const blk = (d.content || []).find((x) => x.type === 'tool_use');
    const input = (blk && blk.input) || {};
    for (const k of ['questions', 'tasks']) if (typeof input[k] === 'string') { try { input[k] = JSON.parse(input[k]); } catch { input[k] = []; } }
    return input;
  }

  function buildPart(b, p, cls, wTasks, raw, counts) {
    const it = p.items || {};
    const n = (counts && counts[p.id]) || it.count || 50;
    const section = { id: uuid(), title: p.title + (p.level ? ` (${p.level})` : ''), instructions: p.instructions || '', passage: String(raw.passage || '').slice(0, 12000), specPart: p.id };
    const questions = [];
    if (p.skill === 'writing') {
      wTasks.forEach((w, k) => {
        const t = (raw.tasks || []).find((x) => String(x.taskId).trim() === w.id) || (raw.tasks || [])[k] || {};
        const rub = rubricFor(cls.grade, cls.stream, w.rubric);
        questions.push({
          type: 'writing', prompt: String(t.prompt || '').trim(), options: [], correctAnswer: null,
          points: Number(w.marks) || 0, sectionId: section.id, specPart: p.id, specTask: w.id, rubricId: rub ? rub.id : '', level: levelOf(p), levelSource: 'specification',
          imageDescription: w.image ? String(t.imageDescription || '').slice(0, 500) : '', imageKind: w.image ? 'photo' : '', imageSearch: '', imageUrl: '',
          skill: `Writing – Task ${w.id} ${w.name}`.slice(0, 80), outcome: '', explanation: '',
        });
      });
      section.instructions = wTasks.length > 1
        ? wTasks.map((w) => `Task ${w.id} – ${w.name} (${w.marks} marks)`).join(' · ')
        : (wTasks[0] ? `${wTasks[0].name} (${wTasks[0].marks} marks)` : section.instructions);
      return { section, questions };
    }
    const want = it.format === 'matching' ? 3 : Number(it.options) || 3;
    for (const q of (raw.questions || []).slice(0, n)) {
      const opts = Array.isArray(q.options) ? q.options.map((o) => String(o).replace(/^\s*[A-H][).:]\s+/, '').trim()) : [];
      let ci = parseInt(q.correctAnswer, 10); if (!(ci >= 0 && ci < opts.length)) ci = 0;
      const oc = (p.outcomes || []).find((o) => o.code === String(q.outcome || '').trim()) || null;
      questions.push({
        type: 'mc', prompt: String(q.prompt || '').trim() || 'Choose the correct answer.', options: opts.slice(0, Math.max(want, 2)), correctAnswer: ci,
        points: Number(it.marksEach) || 1, sectionId: section.id, specPart: p.id, level: levelOf(p), levelSource: 'specification',
        imageDescription: it.format === 'matching' ? String(q.imageDescription || '').slice(0, 500) : '', imageKind: it.format === 'matching' ? 'diagram' : '', imageSearch: '', imageUrl: '',
        skill: String(q.skill || (oc && oc.skill) || p.title.split(':').pop().trim()).slice(0, 80),
        outcome: oc ? `${oc.code}: ${oc.text}`.slice(0, 300) : String(q.outcome || '').slice(0, 300),
        cefr: /^(A1|A2|B1|B2|C1|C2)/.test(String(b.cefr || '')) ? String(b.cefr).slice(0, 2) : '',
        explanation: String(q.explanation || '').slice(0, 1500),
      });
    }
    return { section, questions };
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Admin: upload a new specification (or rubric) PDF → the AI reads it →
  //  the admin reviews → Approve makes it current. Nothing changes for
  //  teachers until it is approved; old assessments keep their own set.
  // ══════════════════════════════════════════════════════════════════════
  const adminOnly = (req, res, next) => (isAdminReq(req) ? next() : res.status(403).json({ error: 'Admins only.' }));
  const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

  app.get('/api/specs/admin/sets', requireTeacher, adminOnly, (req, res) => {
    const cur = currentSetId();
    let rub = []; try { rub = readAll(RUB_FILE) || []; } catch {}
    res.json({
      current: cur,
      sets: allSets().map((s) => ({ id: s.id, label: s.label, academicYear: s.academicYear, term: s.term, status: s.status, builtIn: !!s.builtIn, createdAt: s.createdAt || null, by: s.by || '', source: s.source || '',
        blueprints: (s.blueprints || []).map((b) => Object.assign(summary(s, b), { warnings: reviewBlueprint(b) })) })),
      rubrics: allRubrics().map((r) => ({ id: r.id, title: r.title, kind: r.kind, classes: r.classes, totalMax: r.totalMax, builtIn: BUILTIN_RUBRICS.includes(r) })),
      rubricUploads: rub.map((r) => ({ id: r.id, title: r.title, kind: r.kind, classes: r.classes, totalMax: r.totalMax, status: r.status, createdAt: r.createdAt, warnings: reviewRubric(r) })),
    });
  });
  app.get('/api/specs/admin/sets/:id', requireTeacher, adminOnly, (req, res) => {
    const s = findSet(req.params.id);
    if (!s) return res.status(404).json({ error: 'Not found' });
    res.json({ set: s });
  });
  // Edit an uploaded set (label / year / term, or the blueprints themselves).
  app.put('/api/specs/admin/sets/:id', requireTeacher, adminOnly, (req, res) => {
    const list = uploadedSets();
    const s = list.find((x) => x.id === req.params.id);
    if (!s) return res.status(404).json({ error: 'Only uploaded sets can be edited.' });
    const b = req.body || {};
    if (b.label) s.label = String(b.label).slice(0, 80);
    if (b.academicYear !== undefined) s.academicYear = String(b.academicYear || '').slice(0, 20);
    if (b.term !== undefined) s.term = ['1', '2', '3'].includes(String(b.term)) ? String(b.term) : s.term;
    if (Array.isArray(b.blueprints)) s.blueprints = b.blueprints;
    s.updatedAt = new Date().toISOString();
    writeAll(SETS_FILE, list);
    res.json({ ok: true, warnings: (s.blueprints || []).map((x) => ({ id: x.id, warnings: reviewBlueprint(x) })) });
  });
  app.post('/api/specs/admin/sets/:id/activate', requireTeacher, adminOnly, (req, res) => {
    const s = findSet(req.params.id);
    if (!s) return res.status(404).json({ error: 'Not found' });
    if (s.builtIn) { const c = cfg(); c.retiredBuiltIn = (c.retiredBuiltIn || []).filter((x) => x !== s.id); c.currentSet = s.id; saveCfg(c); return res.json({ ok: true }); }
    const list = uploadedSets();
    const x = list.find((y) => y.id === s.id);
    if (!(x.blueprints || []).length) return res.status(400).json({ error: 'This set has no specifications.' });
    x.status = 'active'; x.activatedAt = new Date().toISOString(); x.activatedBy = req.session.user.email;
    writeAll(SETS_FILE, list);
    const c = cfg(); c.currentSet = x.id; saveCfg(c);
    res.json({ ok: true });
  });
  app.post('/api/specs/admin/sets/:id/retire', requireTeacher, adminOnly, (req, res) => {
    const s = findSet(req.params.id);
    if (!s) return res.status(404).json({ error: 'Not found' });
    const c = cfg();
    if (s.builtIn) { c.retiredBuiltIn = Array.from(new Set((c.retiredBuiltIn || []).concat(s.id))); }
    else { const list = uploadedSets(); list.find((y) => y.id === s.id).status = 'retired'; writeAll(SETS_FILE, list); }
    if (c.currentSet === s.id) delete c.currentSet;
    saveCfg(c);
    res.json({ ok: true, note: 'Teachers can no longer choose it. Assessments already made from it keep it.' });
  });
  app.delete('/api/specs/admin/sets/:id', requireTeacher, adminOnly, (req, res) => {
    const list = uploadedSets();
    const i = list.findIndex((x) => x.id === req.params.id);
    if (i < 0) return res.status(404).json({ error: 'Only uploaded sets can be deleted.' });
    if (list[i].status === 'active') return res.status(400).json({ error: 'Retire it first.' });
    list.splice(i, 1); writeAll(SETS_FILE, list);
    res.json({ ok: true });
  });
  app.post('/api/specs/admin/rubrics/:id/:action', requireTeacher, adminOnly, (req, res) => {
    let list = []; try { list = readAll(RUB_FILE) || []; } catch {}
    const r = list.find((x) => x.id === req.params.id && (req.params.action !== 'activate' || x.status !== 'active'));
    if (!r) return res.status(404).json({ error: 'Not found' });
    if (req.params.action === 'activate') { list.forEach((x) => { if (x.id === r.id && x !== r && x.status === 'active') x.status = 'retired'; }); r.status = 'active'; }
    else if (req.params.action === 'retire') r.status = 'retired';
    else if (req.params.action === 'delete') list = list.filter((x) => x !== r);
    else return res.status(400).json({ error: 'Unknown action' });
    writeAll(RUB_FILE, list);
    res.json({ ok: true });
  });

  // Upload: kind=specs (a test-specification PDF) or kind=rubric (one rubric page).
  app.post('/api/specs/admin/upload', requireTeacher, adminOnly, upload.single('file'), asyncJob, async (req, res) => {
    const f = req.file;
    const cleanup = () => { if (f) { try { fs.unlinkSync(f.path); } catch {} } };
    try {
      if (!readApiKey()) { cleanup(); return res.status(503).json({ ok: false, error: 'Reading a PDF needs the Anthropic API key (Settings).' }); }
      if (!f) return res.status(400).json({ ok: false, error: 'Choose a PDF file.' });
      const buf = fs.readFileSync(f.path); cleanup();
      if (buf.slice(0, 4).toString() !== '%PDF') return res.status(400).json({ ok: false, error: 'That file is not a PDF.' });
      const kind = req.body && req.body.kind === 'rubric' ? 'rubric' : 'specs';
      if (kind === 'rubric') {
        const r = await askJson([pdfBlock(buf), { type: 'text', text: 'This is a UAE MOE English writing rubric. ' + RUBRIC_SCHEMA_TEXT }], 'rubric');
        if (!r || !Array.isArray(r.criteria)) return res.status(502).json({ ok: false, error: 'The AI could not read this rubric. Try a clearer PDF.' });
        r.status = 'draft'; r.createdAt = new Date().toISOString(); r.by = req.session.user.email; r.source = f.originalname;
        r.id = slug(r.id || r.title) || ('rubric-' + Date.now());
        let list = []; try { list = readAll(RUB_FILE) || []; } catch {}
        list.push(r); writeAll(RUB_FILE, list);
        return res.json({ ok: true, kind, rubric: { id: r.id, title: r.title, kind: r.kind, classes: r.classes, totalMax: r.totalMax, warnings: reviewRubric(r) } });
      }
      // 1) Which Grade Level Goals are in the PDF, and on which pages?
      const idx = await askJson([pdfBlock(buf), { type: 'text', text: 'This is a UAE MOE English End-of-Term test specification. List every separate grade specification in it (one per Grade Level Goal / grade). Return { "items": [ { "id": "c{cycle}-g{n}glg (c1-g3 for Cycle 1 grade 3; c3-g12adv for working beyond Grade 12)", "title": "the heading line", "classes": [ { "grade": "9", "stream": "Advanced" } ], "firstPage": 6, "lastPage": 11 } ] } with 1-based page numbers covering all of that grade\'s tables.' }], 'items');
      const items = (idx && Array.isArray(idx.items)) ? idx.items : [];
      if (!items.length) return res.status(502).json({ ok: false, error: 'The AI could not find any grade specifications in this PDF.' });
      // 2) Read each grade on its own pages (smaller, more accurate).
      let PDFDocument = null; try { ({ PDFDocument } = require('pdf-lib')); } catch {}
      const src = PDFDocument ? await PDFDocument.load(buf, { ignoreEncryption: true }).catch(() => null) : null;
      const blueprints = [];
      for (const it of items.slice(0, 20)) {
        let part = buf;
        if (src && it.firstPage && it.lastPage && it.lastPage >= it.firstPage) {
          try {
            const out = await PDFDocument.create();
            const idxs = []; for (let i = Math.max(1, it.firstPage); i <= Math.min(src.getPageCount(), it.lastPage); i++) idxs.push(i - 1);
            (await out.copyPages(src, idxs)).forEach((pg) => out.addPage(pg));
            part = Buffer.from(await out.save());
          } catch (e) { part = buf; }
        }
        const bp = await askJson([pdfBlock(part), { type: 'text', text: `Read the specification for: ${it.title}. ${SPEC_SCHEMA_TEXT}\nUse id "${it.id}".` }], 'blueprint');
        if (bp && Array.isArray(bp.parts)) { bp.id = bp.id || it.id; blueprints.push(bp); }
      }
      if (!blueprints.length) return res.status(502).json({ ok: false, error: 'The AI could not read the specification tables. Try again, or a clearer PDF.' });
      const label = String((req.body && req.body.label) || '').slice(0, 80) || `Uploaded specification ${new Date().toISOString().slice(0, 10)}`;
      const set = { id: 'up-' + slug(label) + '-' + Date.now().toString(36), label, academicYear: String((req.body && req.body.academicYear) || '').slice(0, 20), term: String((req.body && req.body.term) || ''), status: 'draft', createdAt: new Date().toISOString(), by: req.session.user.email, source: f.originalname, blueprints };
      const list = uploadedSets(); list.push(set); writeAll(SETS_FILE, list);
      res.json({ ok: true, kind, set: { id: set.id, label: set.label, blueprints: blueprints.map((b) => ({ id: b.id, title: b.title, warnings: reviewBlueprint(b) })) } });
    } catch (e) {
      cleanup();
      console.error('[specs] upload failed', e);
      res.status(502).json({ ok: false, error: 'Reading the PDF failed: ' + e.message });
    }
  });

  const pdfBlock = (buf) => ({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buf.toString('base64') } });
  async function askJson(content, field) {
    const tool = { name: 'submit', description: 'Submit the result.', input_schema: { type: 'object', properties: { [field]: field === 'items' ? { type: 'array', items: { type: 'object' } } : { type: 'object' } }, required: [field] } };
    const r = await claudeFetch({ max_tokens: 16000, messages: [{ role: 'user', content }], tools: [tool], tool_choice: { type: 'tool', name: 'submit' } }, 'smart');
    if (!r || !r.ok) { const t = r ? await r.text().catch(() => '') : ''; throw new Error('AI service error ' + (r ? r.status : '') + ' ' + t.slice(0, 160)); }
    const d = await r.json();
    const blk = (d.content || []).find((x) => x.type === 'tool_use');
    let v = blk && blk.input ? blk.input[field] : null;
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch { v = null; } }
    return field === 'items' ? { items: v || [] } : v;
  }

  return { getBlueprint, getRubric, rubricFor, check };
};
module.exports.check = check;
module.exports.writingTasksFor = writingTasksFor;
module.exports.partCounts = partCounts;
module.exports.reviewBlueprint = reviewBlueprint;
module.exports.levelOf = levelOf;
