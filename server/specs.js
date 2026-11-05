// ════════════════════════════════════════════════════════════════════════
//  📋 MOE test specifications (English, End-of-Term) + grade writing rubrics
//  - server/specs/blueprints-*.json : one plan per Grade Level Goal (parts,
//    question counts, marks, text lengths, themes, vocabulary, grammar,
//    learning-outcome codes, writing tasks).
//  - server/specs/rubrics.json      : the grade/stream writing rubrics
//    (main-idea 3×5 = 15, Cycle 3 writing 5×5 = 25, Cycles 1–2 5×8 = 40).
//  The AI writes a paper part by part from the plan; every part is checked
//  against the plan and rewritten once if it does not match.
// ════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'specs');
function loadJson(f, fb) { try { return JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { console.warn('[specs] could not read', f, e.message); return fb; } }

const SETS = [
  { id: '2026-27-t1', label: 'End of Term 1 · 2026-2027', file: 'blueprints-2026-27-t1.json', academicYear: '2026-2027', term: '1' },
];
const BLUEPRINTS = [];
for (const s of SETS) for (const b of loadJson(s.file, [])) BLUEPRINTS.push(Object.assign({ set: s.id, setLabel: s.label, academicYear: s.academicYear, term: s.term }, b));
const RUBRICS = loadJson('rubrics.json', []);

const norm = (s) => String(s || '').trim().toLowerCase();
const countWords = (t) => String(t || '').replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
const getBlueprint = (id) => BLUEPRINTS.find((b) => b.id === id) || null;
const getRubric = (id) => RUBRICS.find((r) => r.id === id) || null;
function rubricFor(grade, stream, kind) {
  return RUBRICS.find((r) => r.kind === kind && (r.classes || []).some((c) => String(c.grade) === String(grade) && norm(c.stream) === norm(stream))) || null;
}
const classLabel = (c) => `Grade ${c.grade} ${c.stream}`;

// "230-250" / "150" → allowed [min, max] with 10% either way (every spec allows it).
function wordRange(w) {
  const nums = String(w || '').match(/\d+/g);
  if (!nums) return null;
  const lo = Number(nums[0]), hi = Number(nums[1] || nums[0]);
  return [Math.floor(lo * 0.9), Math.ceil(hi * 1.1)];
}
const stripGaps = (t) => String(t || '').replace(/\(\d+\)\s*_{2,}/g, 'gap');

// Writing tasks the teacher can choose for a blueprint. Grade 9 General may
// use either the email reply in the specification or an opinion essay.
function writingChoices(b) {
  const p = (b.parts || []).find((x) => x.skill === 'writing');
  if (!p) return [];
  const out = (p.writingTasks || []).map((w) => ({ key: w.id, id: w.id, name: w.name, genre: w.genre, marks: w.marks, rubric: w.rubric, length: w.length, minWords: w.minWords }));
  if (b.id === 'c3-g9glg') {
    const t = out.find((w) => w.id === '1.2');
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

function summary(b) {
  return {
    id: b.id, set: b.set, setLabel: b.setLabel, cycle: b.cycle, title: b.title, gradeLevelGoal: b.gradeLevelGoal,
    classes: b.classes, stage: b.stage, cefr: b.cefr, totalMarks: b.totalMarks,
    parts: (b.parts || []).map((p) => ({ id: p.id, title: p.title, level: p.level, skill: p.skill, marks: (p.items || {}).totalMarks, items: (p.items || {}).count })),
    writing: writingChoices(b),
  };
}

// ── The check: does a paper (sections + questions) match the plan? ──
// opts.parts = part ids included, opts.writing = writing task keys included.
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
    expected += Number(it.totalMarks) || 0;
    if (it.count && qs.length !== it.count) issues.push({ part: p.id, msg: `${p.title} should have ${it.count} questions (now ${qs.length}).` });
    const want = it.format === 'matching' ? 3 : Number(it.options) || 0;
    qs.forEach((q, i) => {
      if (q.type !== 'mc') issues.push({ part: p.id, msg: `${p.title} Q${i + 1} should be multiple choice.` });
      if (want && Array.isArray(q.options) && q.options.length !== want) issues.push({ part: p.id, msg: `${p.title} Q${i + 1} should have ${want} options (now ${q.options.length}).` });
      if (it.marksEach && Number(q.points) !== Number(it.marksEach)) issues.push({ part: p.id, msg: `${p.title} Q${i + 1} should be worth ${it.marksEach} marks (now ${q.points}).` });
      if (Array.isArray(q.options) && q.options.some((o) => !String(o || '').trim()) && !(q.optionImages || []).some(Boolean)) issues.push({ part: p.id, msg: `${p.title} Q${i + 1} has an empty option.` });
      total += Number(q.points) || 0;
    });
    if (p.text && p.text.words && p.text.count) {
      const r = wordRange(p.text.words), wc = countWords(stripGaps(s.passage));
      if (r && (wc < r[0] || wc > r[1])) issues.push({ part: p.id, msg: `${p.title}: the text should be ${p.text.words} words (allowed ${r[0]}–${r[1]}); it has ${wc}.` });
    }
    if (p.text && p.text.count && it.format === 'gapfill-mc' && it.count) {
      const gaps = (String(s.passage || '').match(/\(\d+\)\s*_{2,}/g) || []).length;
      if (gaps !== it.count) issues.push({ part: p.id, msg: `${p.title}: the text should have ${it.count} numbered gaps like (1) ______ (now ${gaps}).` });
    }
  }
  return { ok: !issues.length, issues, total, expected };
}

module.exports = function specs(app, deps) {
  const { requireTeacher, readApiKey, claudeFetch, asyncJob, uuid } = deps;

  app.get('/api/specs', requireTeacher, (req, res) => {
    res.json({
      sets: SETS.map((s) => ({ id: s.id, label: s.label })),
      blueprints: BLUEPRINTS.map(summary),
      rubrics: RUBRICS.map((r) => ({ id: r.id, title: r.title, kind: r.kind, classes: r.classes, totalMax: r.totalMax })),
    });
  });
  app.get('/api/specs/rubrics/:id', requireTeacher, (req, res) => {
    const r = getRubric(req.params.id);
    if (!r) return res.status(404).json({ error: 'Rubric not found' });
    res.json({ rubric: r });
  });
  app.get('/api/specs/:id', requireTeacher, (req, res) => {
    const b = getBlueprint(req.params.id);
    if (!b) return res.status(404).json({ error: 'Specification not found' });
    res.json({ blueprint: b, writing: writingChoices(b) });
  });
  app.post('/api/specs/:id/check', requireTeacher, (req, res) => {
    const b = getBlueprint(req.params.id);
    if (!b) return res.status(404).json({ error: 'Specification not found' });
    const body = req.body || {};
    res.json(check(b, body.sections || [], body.questions || [], { parts: body.parts, writing: body.writing }));
  });

  // ── Generate a paper (or some parts of it) from a specification ──
  app.post('/api/specs/:id/generate', requireTeacher, asyncJob, async (req, res) => {
    const b = getBlueprint(req.params.id);
    if (!b) return res.status(404).json({ ok: false, error: 'Specification not found' });
    if (!readApiKey()) return res.status(503).json({ ok: false, error: 'AI generation needs the Anthropic API key (Settings).' });
    const body = req.body || {};
    const cls = (b.classes || []).find((c) => String(c.grade) === String(body.grade) && norm(c.stream) === norm(body.stream)) || b.classes[0];
    const wantParts = Array.isArray(body.parts) && body.parts.length ? body.parts.map(String) : b.parts.map((p) => p.id);
    const parts = b.parts.filter((p) => wantParts.includes(p.id));
    if (!parts.length) return res.status(400).json({ ok: false, error: 'Choose at least one part.' });
    const wTasks = writingTasksFor(b, body.writing);
    if (parts.some((p) => p.skill === 'writing') && !wTasks.length) return res.status(400).json({ ok: false, error: 'Choose at least one writing task.' });
    const topic = String(body.topic || '').slice(0, 300);
    try {
      const results = await Promise.all(parts.map((p) => genPart(b, p, cls, wTasks, topic)));
      const sections = [], questions = [], notes = [];
      results.forEach((r) => { sections.push(r.section); questions.push(...r.questions); if (r.note) notes.push(r.note); });
      sections.forEach((s, i) => { s.order = i; });
      const writingKeys = wTasks.map((w) => w.key);
      const chk = check(b, sections, questions, { parts: wantParts, writing: writingKeys });
      const whole = parts.length === b.parts.length;
      const title = `English – ${classLabel(cls)} – ${whole ? 'End-of-Term practice paper' : parts.map((p) => p.title.split(':')[0]).join(' + ')}`;
      res.json({
        ok: true, title, description: `Written from the MOE test specification (${b.setLabel}): ${b.gradeLevelGoal}.`,
        sections, questions, spec: { id: b.id, set: b.set, parts: wantParts, writing: writingKeys, grade: cls.grade, stream: cls.stream, term: b.term, academicYear: b.academicYear },
        check: chk, notes,
      });
    } catch (e) {
      console.error('[specs] generate failed', e);
      res.status(502).json({ ok: false, error: 'The AI could not finish this paper: ' + e.message + '. Please try again.' });
    }
  });

  // ── One part: ask the AI, check, and rewrite once with the problems listed ──
  async function genPart(b, p, cls, wTasks, topic) {
    let last = null, issues = [];
    const keys = wTasks.map((w) => w.key);
    for (let attempt = 0; attempt < 3; attempt++) {
      const raw = await askPart(b, p, cls, wTasks, topic, issues);
      const built = buildPart(b, p, cls, wTasks, raw);
      const chk = check(b, [built.section], built.questions, { parts: [p.id], writing: keys });
      last = built;
      if (chk.ok) return built;
      issues = chk.issues.map((x) => x.msg);
      console.warn('[specs]', b.id, p.id, 'attempt', attempt + 1, 'issues:', issues.join(' | '));
    }
    last.note = `${p.title}: ${issues.join(' ')}`;
    return last;
  }

  function partBrief(b, p, cls, wTasks) {
    const it = p.items || {};
    const lines = [
      `Class: ${classLabel(cls)} · ${b.gradeLevelGoal} · Learning Continuum Stage ${b.stage || '-'} · CEFR ${b.cefr || '-'}.`,
      `Part: ${p.title} — ${p.level}. Task type: ${p.taskType}.`,
      `Instructions printed on the paper: ${p.instructions}`,
      p.themes && p.themes.length ? `Theme(s) — base the part on ONE of these: ${p.themes.map((t) => t.theme + (t.vocabulary && t.vocabulary.length ? ' (vocabulary: ' + t.vocabulary.join(', ') + ')' : '')).join(' || ')}` : '',
      p.grammar && p.grammar.length ? `Grammar points to test: ${p.grammar.join('; ')}` : '',
      p.functionalLanguage && p.functionalLanguage.length ? `Functional language: ${p.functionalLanguage.join('; ')}` : '',
      p.outcomes && p.outcomes.length ? `Learning outcomes (number of questions for each): ${p.outcomes.map((o) => `${o.count || 1} × ${o.code}${o.skill ? ' (' + o.skill + ')' : ''}: ${o.text}`).join(' || ')}` : '',
      `Construct limits (follow exactly): ${(p.constructLimits || []).join(' · ')}`,
    ];
    if (p.skill === 'writing') {
      lines.push('Write these writing tasks (put each in "tasks" with its taskId):');
      for (const w of wTasks) {
        lines.push(`- Task ${w.id} "${w.name}" (${w.marks} marks). Template from the specification: ${w.instructions} Length: ${w.length || '-'}.` +
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
      lines.push(`Questions: exactly ${it.count}, each worth ${it.marksEach} marks.`);
      if (it.format === 'matching') {
        lines.push(`This is a word–picture matching task. For the online paper write each item as a picture (describe it clearly in imageDescription) with the prompt "Which word matches the picture?" and exactly 3 options: the correct word + 2 other words from the vocabulary list. Use only words from the vocabulary lists. Leave "passage" empty.`);
      } else if (it.format === 'gapfill-mc' && p.text && p.text.count) {
        lines.push(`Write ONE ${p.text.type || ''} text in "passage" of ${p.text.words} words${p.text.cefr ? ' (' + p.text.cefr + ')' : ''}${r ? ` — it MUST be between ${r[0]} and ${r[1]} words` : ''}, with exactly ${it.count} numbered gaps written as (1) ______, (2) ______ … in order (an example gap is not needed). Question k is about gap (k): prompt "Gap (k)", exactly ${it.options} options, one correct.` +
          (Number(it.options) > 3 ? ` The options are the WORD BANK: give every question the same list of ${it.options} words (correct answers + distractors).` : ''));
      } else if (it.format === 'gapfill-mc') {
        lines.push(`No reading text: each question is ONE sentence with one gap written as ______ and exactly ${it.options} options.` + (Number(it.options) > 3 ? ` The options are the word bank: the same list of ${it.options} words for every question; also write "Word bank: …" in "passage".` : ' Leave "passage" empty.'));
      } else {
        lines.push(`Write ONE ${p.text && p.text.type ? p.text.type : ''} text in "passage" of ${p.text ? p.text.words : '?'} words${p.text && p.text.cefr ? ' (' + p.text.cefr + ')' : ''}${r ? ` — it MUST be between ${r[0]} and ${r[1]} words` : ''}. Then exactly ${it.count} questions about it, each with exactly ${it.options || 3} options and one correct answer, following the outcome counts above (put the outcome code in "outcome").`);
      }
    }
    return lines.filter(Boolean).join('\n');
  }

  async function askPart(b, p, cls, wTasks, topic, issues) {
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
    const user = partBrief(b, p, cls, wTasks) + (topic ? `\nTeacher's topic request (stay inside the specification): ${topic}` : '') +
      (issues && issues.length ? `\n\nYOUR PREVIOUS VERSION DID NOT MATCH THE SPECIFICATION. Fix these problems: ${issues.join(' ')}` : '') +
      '\n\nSubmit with the submit_part tool.';
    const r = await claudeFetch({ max_tokens: 8000, system, messages: [{ role: 'user', content: user }], tools: [tool], tool_choice: { type: 'tool', name: 'submit_part' } }, 'smart');
    if (!r || !r.ok) { const t = r ? await r.text().catch(() => '') : ''; throw new Error('AI service error ' + (r ? r.status : '') + ' ' + t.slice(0, 120)); }
    const d = await r.json();
    const blk = (d.content || []).find((x) => x.type === 'tool_use');
    const input = (blk && blk.input) || {};
    for (const k of ['questions', 'tasks']) if (typeof input[k] === 'string') { try { input[k] = JSON.parse(input[k]); } catch { input[k] = []; } }
    return input;
  }

  function buildPart(b, p, cls, wTasks, raw) {
    const it = p.items || {};
    const section = { id: uuid(), title: p.title + (p.level ? ` (${p.level})` : ''), instructions: p.instructions || '', passage: String(raw.passage || '').slice(0, 12000), specPart: p.id };
    const questions = [];
    if (p.skill === 'writing') {
      wTasks.forEach((w, k) => {
        const t = (raw.tasks || []).find((x) => String(x.taskId).trim() === w.id) || (raw.tasks || [])[k] || {};
        const rub = rubricFor(cls.grade, cls.stream, w.rubric);
        questions.push({
          type: 'writing', prompt: String(t.prompt || '').trim(), options: [], correctAnswer: null,
          points: Number(w.marks) || 0, sectionId: section.id, specPart: p.id, specTask: w.id, rubricId: rub ? rub.id : '',
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
    for (const q of (raw.questions || []).slice(0, it.count || 50)) {
      const opts = Array.isArray(q.options) ? q.options.map((o) => String(o).replace(/^\s*[A-H][).:]\s+/, '').trim()) : [];
      let ci = parseInt(q.correctAnswer, 10); if (!(ci >= 0 && ci < opts.length)) ci = 0;
      const oc = (p.outcomes || []).find((o) => o.code === String(q.outcome || '').trim()) || null;
      questions.push({
        type: 'mc', prompt: String(q.prompt || '').trim() || 'Choose the correct answer.', options: opts.slice(0, Math.max(want, 2)), correctAnswer: ci,
        points: Number(it.marksEach) || 1, sectionId: section.id, specPart: p.id,
        imageDescription: it.format === 'matching' ? String(q.imageDescription || '').slice(0, 500) : '', imageKind: it.format === 'matching' ? 'diagram' : '', imageSearch: '', imageUrl: '',
        skill: String(q.skill || (oc && oc.skill) || p.title.split(':').pop().trim()).slice(0, 80),
        outcome: oc ? `${oc.code}: ${oc.text}`.slice(0, 300) : String(q.outcome || '').slice(0, 300),
        cefr: /^(A1|A2|B1|B2|C1|C2)/.test(String(b.cefr || '')) ? String(b.cefr).slice(0, 2) : '',
        explanation: String(q.explanation || '').slice(0, 1500),
      });
    }
    return { section, questions };
  }

  return { getBlueprint, getRubric, rubricFor, check };
};
module.exports.getRubric = getRubric;
module.exports.rubricFor = rubricFor;
module.exports.getBlueprint = getBlueprint;
module.exports.check = check;
module.exports.writingTasksFor = writingTasksFor;
