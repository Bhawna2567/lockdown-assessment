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
  const { requireTeacher, readAll, writeAll, upload, asyncJob, claudeFetch, gradeWriting, getSpecRubric, getStageRubric, uuid, bcrypt, tempPassword,
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
  // The rubric used for a writing question: its MOE grade rubric (specification papers),
  // otherwise the assessment's rubric stage. Criterion marks stay on the rubric's own scale.
  const stageOf = (a) => (['7', '8', '3-5', '5-9'].includes(String(a.rubricStage)) ? String(a.rubricStage) : '8');
  function rubricOf(a, q) {
    const spec = q.rubricId ? getSpecRubric(q.rubricId) : null;
    const r = spec || (getStageRubric ? getStageRubric(stageOf(a)) : null);
    if (!r || !Array.isArray(r.criteria) || !r.criteria.length) return null;
    const criteria = r.criteria.map((c) => ({ id: c.id, name: c.name, max: Number(c.max || r.scoreMax) || 0, bands: c.bands || {} }));
    const total = criteria.reduce((t, c) => t + c.max, 0) || Number(r.totalMax) || 0;
    return { id: spec ? spec.id : 'stage-' + stageOf(a), stage: spec ? spec.id : stageOf(a), title: r.title, total, criteria };
  }
  // The rubric's own descriptor for a score (used when the teacher changes the AI's mark).
  function bandText(c, v) {
    const b = c.bands || {};
    if (b[String(v)] !== undefined) return String(b[String(v)]);
    const k = Object.keys(b).find((key) => { const m = key.split('-').map(Number); return m.length === 2 && v >= m[0] && v <= m[1]; });
    return k ? String(b[k]) : '';
  }
  const MISTAKE_TYPES = ['spelling', 'grammar', 'punctuation', 'word_choice'];
  // The exact words in the student's text matching what the AI quoted (ignores curly quotes, spacing, line breaks, capitals).
  function findInText(text, frag) {
    const f0 = String(frag || '').trim(); if (!f0) return null;
    if (text.includes(f0)) return f0;
    const nq = (ch) => (/[\u2018\u2019\u02BC`]/.test(ch) ? "'" : /[\u201C\u201D]/.test(ch) ? '"' : ch);
    let n = ''; const map = [];
    for (let k = 0; k < text.length; k++) {
      let ch = nq(text[k]);
      if (/\s/.test(ch)) { if (n.endsWith(' ')) continue; ch = ' '; }
      n += ch.toLowerCase(); map.push(k);
    }
    const f = f0.split('').map(nq).join('').replace(/\s+/g, ' ').toLowerCase();
    const i = n.indexOf(f);
    return i < 0 ? null : text.slice(map[i], map[i + f.length - 1] + 1);
  }
  // The AI sometimes returns the list as text, or with other field names — read all of those forms.
  function parseMistakeList(v) {
    let list = v;
    if (typeof list === 'string') {
      const t = list.trim();
      try { list = JSON.parse(t); } catch (e) {
        try { list = JSON.parse(t.replace(/[\u201C\u201D]/g, '"').replace(/,\s*([\]}])/g, '$1')); } catch (e2) {
          // last resort: pull "text"/"correction" pairs out of the text, or lines like  wrong -> right
          const objs = [];
          const re = /\{[^{}]*\}/g; let m;
          while ((m = re.exec(t))) {
            const o = {}; const kv = /"(\w+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g; let k;
            while ((k = kv.exec(m[0]))) o[k[1]] = k[2];
            if (Object.keys(o).length) objs.push(o);
          }
          if (!objs.length) t.split(/\n+/).forEach((ln) => { const mm = ln.match(/^\s*[-*\d.)]*\s*["']?(.+?)["']?\s*(?:->|→|=>)\s*["']?(.+?)["']?\s*$/); if (mm) objs.push({ text: mm[1], correction: mm[2] }); });
          list = objs;
        }
      }
    }
    if (list && !Array.isArray(list) && typeof list === 'object') list = Object.values(list).find(Array.isArray) || [list];
    return (Array.isArray(list) ? list : []).filter((m) => m && typeof m === 'object').map((m) => ({
      text: m.text || m.wrong || m.original || m.error || m.mistake || m.incorrect || m.quote || '',
      correction: m.correction || m.correct || m.corrected || m.fix || m.right || '',
      type: m.type || m.category || '', reason: m.reason || m.explanation || m.why || '' }));
  }
  const normType = (t) => { const x = String(t || '').toLowerCase(); return x.startsWith('spell') ? 'spelling' : x.startsWith('punct') || x.includes('capital') ? 'punctuation' : x.includes('word') || x.includes('vocab') ? 'word_choice' : 'grammar'; };
  // Exact words in the text for what the AI quoted; if the whole quote isn't there, its longest matching word.
  function locate(text, frag) {
    const f = String(frag || '').trim().replace(/^["'\u2018\u201C]+|["'\u2019\u201D.,;:!?]+$/g, '');
    const hit = findInText(text, f) || findInText(text, String(frag || '').trim());
    if (hit) return hit;
    const words = f.split(/\s+/).filter((w) => w.replace(/\W/g, '').length >= 4).sort((a, b) => b.length - a.length);
    for (const w of words) { const re = new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i'); const m = text.match(re); if (m) return m[0]; }
    return null;
  }
  // Up to three tries, so one slow or failed AI reply doesn't leave a task without mistakes and feedback.
  // A reply only counts when BOTH feedback boxes are filled in; otherwise it is tried again
  // (waits grow each time, and the last try uses the faster model). The best partial reply is kept.
  async function findMistakesSafe(q, text, rb, tries) {
    let last = null, best = null;
    const n = tries || 4;
    for (let t = 0; t < n; t++) {
      try {
        const r = await findMistakes(q, text, rb, t === n - 1 ? 'bg-haiku' : 'smart');
        const words = text.trim().split(/\s+/).length;
        const needList = words >= 25 && t < n - 1;   // a real essay almost always has some mistakes
        if (r.wentWell && r.toImprove && (r.mistakes.length || !needList)) return Object.assign(r, { mistakesOk: true });
        if (!best || r.mistakes.length > best.mistakes.length || (!best.wentWell && r.wentWell)) best = r;
        last = new Error('feedback incomplete');
      } catch (e) { last = e; }
      if (t < n - 1) await new Promise((ok) => setTimeout(ok, [3000, 8000, 15000][t] || 15000));
    }
    console.warn('[paper] mistakes failed:', last && last.message);
    return Object.assign({ mistakes: [], wentWell: '', toImprove: '' }, best || {}, { mistakesOk: false });
  }
  // Marking with retries too (a busy AI service should not leave a task unmarked).
  async function gradeSafe(args) {
    let g = null;
    for (let t = 0; t < 3; t++) {
      g = await gradeWriting(args).catch((e) => ({ ok: false, detail: e.message }));
      if (g && g.ok) return g;
      if (g && (g.reason === 'no-api-key' || g.reason === 'empty-essay' || g.reason === 'no-rubric')) return g;
      if (t < 2) await new Promise((ok) => setTimeout(ok, [4000, 10000][t]));
    }
    console.warn('[paper] grading failed:', g && (g.reason || g.detail));
    return g;
  }
  // Mistakes in the student's writing (exact words, type, correction) + what went well / to improve.
  async function findMistakes(q, text, rb, tier) {
    const tool = { name: 'submit_mistakes', description: 'The language mistakes in the student writing and short feedback.', input_schema: { type: 'object', required: ['mistakes', 'wentWell', 'toImprove'], properties: {
      mistakes: { type: 'array', items: { type: 'object', required: ['text', 'type', 'correction'], properties: {
        text: { type: 'string', description: 'The wrong words copied EXACTLY from the student writing (1-6 words, as short as possible)' },
        type: { type: 'string', enum: MISTAKE_TYPES, description: 'spelling | grammar | punctuation (includes capital letters) | word_choice' },
        correction: { type: 'string', description: 'The corrected words' },
        reason: { type: 'string', description: 'Very short reason for the student, max 12 words' } } } },
      wentWell: { type: 'string', description: '1-2 sentences to the student ("You...") on what went well. Never empty: even a weak answer has something positive (e.g. it answers the task, has a clear opinion, uses paragraphs).' },
      toImprove: { type: 'string', description: '1-2 sentences to the student ("You...") on the most important things to improve. Never empty.' } } } };
    const prompt = 'Task: ' + String(q.prompt || '').slice(0, 800) + '\nRubric: ' + (rb ? rb.title : 'writing') +
      "\n\nThe student's handwritten answer, transcribed exactly (mistakes kept; [?] = unreadable word):\n---\n" + text.slice(0, 6000) + '\n---\n\n' +
      'List the clear language mistakes (spelling, grammar, punctuation/capital letters, word choice) - at most 20, the most important first. The mistakes field must be a JSON array of objects, not text. ' +
      "Copy each mistake's words exactly as they appear above so they can be found in the text. Ignore [?] words and handwriting. " +
      'Then ALWAYS write both "what went well" and "what to improve", kindly and simply, for a school student. Submit with submit_mistakes.';
    const r = await claudeFetch({ max_tokens: 6000, messages: [{ role: 'user', content: prompt }], tools: [tool], tool_choice: { type: 'tool', name: 'submit_mistakes' } }, tier || 'smart');
    if (!r || !r.ok) throw new Error('AI service error ' + (r ? r.status : ''));
    const j = await r.json();
    if (j.stop_reason === 'max_tokens') throw new Error('reply was cut off');
    const blk = (j.content || []).find((x) => x.type === 'tool_use');
    const inp = (blk && blk.input) || {};
    const rawList = parseMistakeList(inp.mistakes);
    // Keep only mistakes whose words really appear in the writing (matched loosely: quotes, spaces, line breaks, capitals).
    const seen = new Set();
    const mistakes = rawList.slice(0, 25)
      .map((m) => ({ text: String(m.text || '').trim().slice(0, 80), type: normType(m.type), correction: String(m.correction || '').slice(0, 120), reason: String(m.reason || '').slice(0, 120) }))
      .map((m) => Object.assign(m, { text: locate(text, m.text) || '' }))
      .filter((m) => m.text && !seen.has(m.text.toLowerCase() + '|' + m.correction) && seen.add(m.text.toLowerCase() + '|' + m.correction))
      .slice(0, 20);
    if (!mistakes.length) console.warn('[paper] no usable mistakes; raw list was', typeof inp.mistakes, String(JSON.stringify(inp.mistakes) || '').slice(0, 300));
    return { mistakes, wentWell: String(inp.wentWell || '').slice(0, 600), toImprove: String(inp.toImprove || '').slice(0, 600) };
  }
  // Mark every writing task of one script (rubric, criteria, mistakes, feedback). `override` gives
  // other question wording / reading text per task, for a student who answered a different paper.
  async function gradeTasks(a, s, override) {
    const wq = writingQs(a);
    s.grades = {};
    await Promise.all(wq.map(async (q) => {

      const text = s.text[q.id] || '';
      const rb = rubricOf(a, q);
      const blank = (v) => (rb ? Object.fromEntries(rb.criteria.map((c) => [c.id, { ai: v, score: v, comment: '' }])) : null);
      if (!text.trim()) { s.flags.push(`No answer found for ${qLabel(a, q)}.`); s.grades[q.id] = { score: 0, maxScore: Number(q.points) || 0, feedback: 'No answer found on the script.', breakdown: null, criteria: blank(0) }; return; }
      const rub = q.rubricId ? getSpecRubric(q.rubricId) : null;
      const sec = (a.sections || []).find((x) => x.id === q.sectionId);
      const o = override && override[q.id];
      const qx = o ? Object.assign({}, q, { prompt: o.prompt || q.prompt }) : q;
      const ctx = o ? (o.passage || '') : (sec && sec.passage);
      const stage = ['7', '8', '3-5', '5-9'].includes(String(a.rubricStage)) ? String(a.rubricStage) : '8';
      const [g, mk] = await Promise.all([
        gradeSafe({ rubric: rub, rubricStage: stage, context: ctx, prompt: qx.prompt, essay: text, maxScore: q.points }),
        findMistakesSafe(qx, text, rb),
      ]);
      if (!g || !g.ok) { s.flags.push(`${qLabel(a, q)} could not be marked automatically — enter the mark yourself.`); s.grades[q.id] = { score: '', maxScore: Number(q.points) || 0, feedback: '', breakdown: null, criteria: blank(''), mistakes: mk.mistakes, wentWell: mk.wentWell, toImprove: mk.toImprove, mistakesOk: mk.mistakesOk }; return; }
      // Rubrics scored out of 40/12 are scaled to the question's own marks.
      const max = Number(q.points) || g.maxScore;
      const f = g.maxScore ? max / g.maxScore : 1;
      const bd = {};
      for (const [k, v] of Object.entries(g.breakdown || {})) bd[k] = Object.assign({}, v, { score: Math.round(v.score * f * 10) / 10, max: Math.round(v.max * f * 10) / 10 });
      // The AI's mark for each criterion on the rubric's own scale (e.g. 0–5 or 0–8).
      let criteria = null, raw = 0;
      if (rb) {
        criteria = {};
        for (const c of rb.criteria) {
      const v = (g.breakdown || {})[c.id];
          const n = v && Number(v.max) ? Math.max(0, Math.min(c.max, Math.round(Number(v.score) * c.max / Number(v.max)))) : 0;
          criteria[c.id] = { ai: n, score: n, comment: (v && v.comment) || '' };
          raw += n;
        }
      }
      s.grades[q.id] = { score: criteria ? toQuestion(raw, rb.total, max) : Math.round(g.score * f * 2) / 2, maxScore: max, feedback: overallOnly(g.feedback), breakdown: bd, rubricStage: g.rubricStage, criteria,
        mistakes: mk.mistakes, wentWell: mk.wentWell || '', toImprove: mk.toImprove || overallOnly(g.feedback), mistakesOk: mk.mistakesOk };
      if (!mk.mistakesOk) s.flags.push(`Mistakes and feedback for ${qLabel(a, q)} could not be found — use "Find mistakes again" below.`);
    }));
  }
  const OTHER_FLAG = "This student seems to have answered a different paper, so she was marked against the questions printed on her own paper. You can change this below.";
  const TASK_FLAG_RE = /^(No answer found for|.* could not be marked automatically|Mistakes and feedback for|This student seems to have answered a different paper)/;
  // Does the printed task wording on the student's pages differ from the assessment's questions?
  const STOP = new Set('the and that this with your from have will about which what when where their there they them then than into some more most also each other write words least paragraphs sentences text email read main ideas your own task include following answer question'.split(' '));
  const contentWords = (t) => new Set(String(t || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 4 && !STOP.has(w)));
  // null = too little wording to judge (e.g. the standard "Write the main ideas…" instruction)
  function similarity(x, y) {
    const A = contentWords(x), B = contentWords(y);
    if (A.size < 4 || B.size < 4) return null;
    let hit = 0; A.forEach((w) => { if (B.has(w)) hit++; });
    return hit / Math.min(A.size, B.size);
  }
  // Compares the task wording that really differs between papers (the extended-writing question and
  // the reading text). Most of those signals must differ before a script is treated as another paper.
  function looksLikeOtherPaper(a, s) {
    // The AI's own judgement while reading the pages comes first.
    const v = s.paperVotes || { same: 0, different: 0 };
    if (v.different > v.same) return true;
    if (v.same > v.different) return false;
    const signals = [];
    for (const q of writingQs(a)) {
      const v = similarity((s.printed || {})[q.id], q.prompt);
      if (v !== null) signals.push(v < 0.3);
    }
    const classText = (a.sections || []).map((x) => x.passage || '').join(' ');
    const v2 = similarity(s.printedSource, classText);
    if (v2 !== null) signals.push(v2 < 0.2);
    return signals.length > 0 && signals.filter(Boolean).length > signals.length / 2;
  }
  function ownPaperOverride(a, s) {
    const out = {};
    for (const q of writingQs(a)) out[q.id] = { prompt: (s.printed || {})[q.id] || q.prompt, passage: s.printedSource || '', label: qLabel(a, q) };
    return out;
  }
  // Split a student's transcribed writing into the right tasks, using the questions she actually
  // answered. Used when a task came out empty (her writing was all put under one task) and whenever
  // a script is marked against a different paper. Her words are kept exactly; nothing is rewritten.
  async function resplitTasks(a, s, override) {
    const wq = writingQs(a);
    if (wq.length < 2) return false;
    const original = wq.map((q) => s.text[q.id] || '').filter((t) => t.trim()).join('\n\n');
    const words = (t) => String(t || '').trim().split(/\s+/).filter(Boolean).length;
    if (words(original) < 15) return false;
    const list = wq.map((q) => { const o = override && override[q.id]; return `${qLabel(a, q)}: ${String((o && o.prompt) || q.prompt || '').replace(/\s+/g, ' ').slice(0, 600)}`; }).join('\n');
    const tool = { name: 'submit_split', description: 'The student writing split into the answer for each task.', input_schema: { type: 'object', required: ['tasks'], properties: {
      tasks: { type: 'array', items: { type: 'object', required: ['task', 'text'], properties: { task: { type: 'string', description: 'Task label exactly as listed, e.g. ' + wq.map((q) => JSON.stringify(qLabel(a, q))).join(' or ') }, text: { type: 'string', description: "The student's own words for this task, copied exactly" } } } } } } };
    const prompt = "Below is a student's handwritten exam answers, transcribed in page order. The exam had these writing tasks:\n" + list +
      "\n\nSplit the writing into the answer for each task (a short summary usually answers the main-ideas task; the longer essay, email or opinion piece answers the extended-writing task). Copy the student's words EXACTLY, keep her mistakes, do not add, correct or leave out anything. Every sentence must go to one task.\n---\n" + original.slice(0, 9000) + '\n---\nSubmit with submit_split.';
    const r = await claudeFetch({ max_tokens: 6000, messages: [{ role: 'user', content: prompt }], tools: [tool], tool_choice: { type: 'tool', name: 'submit_split' } }, 'smart');
    if (!r || !r.ok) return false;
    const j = await r.json();
    if (j.stop_reason === 'max_tokens') return false;
    const inp = ((j.content || []).find((x) => x.type === 'tool_use') || {}).input || {};
    const out = {};
    for (const t of Array.isArray(inp.tasks) ? inp.tasks : []) {
      const q = wq.find((x) => labelKey(qLabel(a, x)) === labelKey(t.task)) || wq.find((x) => String(x.specTask || '') === String(t.task || '').replace(/^\D+/, ''));
      if (q && String(t.text || '').trim()) out[q.id] = ((out[q.id] || '') + '\n' + String(t.text)).trim();
    }
    // Accept only if every task got writing and (almost) none of her words were lost.
    const got = Object.values(out).join(' ');
    if (Object.keys(out).length < wq.length || words(got) < words(original) * 0.85) return false;
    for (const q of wq) s.text[q.id] = out[q.id];
    return true;
  }
  const hasEmptyTask = (a, s) => { const wq = writingQs(a); return wq.length > 1 && wq.some((q) => !(s.text[q.id] || '').trim()) && wq.some((q) => (s.text[q.id] || '').trim()); };
  // Read the printed questions and reading text from a script's own pages (used when re-marking).
  async function readPrinted(b, s, a) {
    const wq = writingQs(a);
    const content = [];
    for (const pid of (s.pages || []).slice(0, 6)) {
      const pg = (b.pages || []).find((x) => x.id === pid); if (!pg) continue;
      const buf = fs.readFileSync(path.join(ROOT, b.id, pg.file));
      content.push(pg.kind === 'pdf' ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buf.toString('base64') } }
        : { type: 'image', source: { type: 'base64', media_type: pg.mime, data: buf.toString('base64') } });
    }
    if (!content.length) return null;
    const tool = { name: 'submit_printed', description: 'The printed exam questions and reading text on these pages.', input_schema: { type: 'object', required: ['tasks'], properties: {
      tasks: { type: 'array', items: { type: 'object', required: ['task', 'text'], properties: { task: { type: 'string', description: 'Task number as printed, e.g. 1.1 or 1.2' }, text: { type: 'string', description: 'The printed task instructions, word for word (including bullet prompts and word count)' } } } },
      readingText: { type: 'string', description: 'The printed reading text / email / article the students read, word for word; empty if none' } } } };
    content.push({ type: 'text', text: 'These are the pages of one student\'s exam paper. Copy the PRINTED writing task instructions (not the student\'s handwriting) for each task, and the printed reading text if there is one. The tasks are: ' + wq.map((q) => qLabel(a, q)).join(', ') + '. Submit with submit_printed.' });
    const r = await claudeFetch({ max_tokens: 4000, messages: [{ role: 'user', content }], tools: [tool], tool_choice: { type: 'tool', name: 'submit_printed' } }, 'smart');
    if (!r || !r.ok) throw new Error('AI service error ' + (r ? r.status : ''));
    const j = await r.json();
    const inp = ((j.content || []).find((x) => x.type === 'tool_use') || {}).input || {};
    const printed = {};
    for (const t of Array.isArray(inp.tasks) ? inp.tasks : []) {
      const q = wq.find((x) => String(x.specTask || '') === String(t.task || '').replace(/^\D+/, '')) || wq.find((x) => labelKey(qLabel(a, x)) === labelKey(t.task)) || wq[(inp.tasks.indexOf(t))];
      if (q && t.text) printed[q.id] = String(t.text).slice(0, 2000);
    }
    return { printed, source: String(inp.readingText || '').slice(0, 6000) };
  }
  // The grader's feedback lists every criterion again; keep only its overall comment.
  const overallOnly = (f) => { const t = String(f || ''); const i = t.search(/Overall:/i); return (i >= 0 ? t.slice(i).replace(/^Overall:\s*/i, '') : t).trim(); };
  const toQuestion = (raw, total, points) => (total ? Math.round((raw * (Number(points) || total) / total) * 2) / 2 : raw);
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
          printedTasks: { type: 'array', description: 'The PRINTED task instructions visible on this page (not the student writing), if any', items: { type: 'object', required: ['question', 'text'], properties: { question: { type: 'string', description: 'Task label from the list, e.g. ' + wq.map((q) => JSON.stringify(qLabel(a, q))).join(' or ') }, text: { type: 'string', description: 'The printed instructions word for word' } } } },
          printedText: { type: 'string', description: 'The PRINTED reading text / email / article on this page, word for word; empty if none' },
          samePaper: { type: 'string', enum: ['same', 'different', 'unknown'], description: 'Compare the PRINTED questions / reading text on this page with the writing questions listed above. "different" if they are clearly about a different topic or a different paper; "same" if they match; "unknown" if no printed questions or text are visible on this page.' },
          parts: { type: 'array', items: { type: 'object', required: ['question', 'text'], properties: {
            question: { type: 'string', description: 'Which writing task this answers — use the label from the list exactly, e.g. ' + wq.map((q) => JSON.stringify(qLabel(a, q))).join(' or ') + '. If the page only continues an answer from the previous page and shows no task number, write "continued".' },
            text: { type: 'string', description: 'The student\'s handwriting transcribed word for word — keep their spelling, grammar and punctuation mistakes; write [?] for an unreadable word' } } } },
        } } };
        const r = await claudeFetch({ max_tokens: 7000, messages: [{ role: 'user', content: [block, { type: 'text', text:
          `This is one page of a student's handwritten answers to an exam. The writing questions are:\n${qList}\n\nRead the page. Give the student's name if it is written on this page, and transcribe each answer word for word under the writing task it answers (decide from what the student wrote and any numbers on the page; label it exactly as in the list above; if the writing simply continues from the previous page with no task number, label it "continued"). Do not correct anything. Put only the student's handwriting in parts. Copy any printed task instructions into printedTasks and any printed reading text into printedText. Submit with submit_page.` }] }],
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
      // Which task a transcribed part belongs to. Exact label first, then looser forms
      // ("Q2", "Task 2", "1.2", "2"), then "continued"/unlabelled → the task the student was last writing.
      const matchTask = (label, s) => {
        const key = labelKey(label);
        let q = wq.find((x) => labelKey(qLabel(a, x)) === key);
        if (q) return q;
        if (wq.length === 1) return wq[0];
        const num = (String(label || '').match(/\d+(?:\.\d+)?/) || [])[0];
        if (num) {
          q = wq.find((x) => String(x.specTask || '') === num) ||
              wq.find((x) => String(x.specTask || '').split('.').pop() === num.split('.').pop() && num.includes('.')) ||
              wq[Number(num.split('.').pop()) - 1];
          if (q) return q;
        }
        if (s.lastTask) return wq.find((x) => x.id === s.lastTask);
        return wq.find((x) => !s.text[x.id]) || null;
      };
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
        s.printed = s.printed || {};
        for (const pt of Array.isArray(r.printedTasks) ? r.printedTasks : []) {
          const q = wq.find((x) => labelKey(qLabel(a, x)) === labelKey(pt.question)) || null;
          if (q && pt.text && !s.printed[q.id]) s.printed[q.id] = String(pt.text).slice(0, 2000);
        }
        if (r.samePaper === 'different' || r.samePaper === 'same') { s.paperVotes = s.paperVotes || { same: 0, different: 0 }; s.paperVotes[r.samePaper]++; }
        if (r.printedText && String(r.printedText).trim().length > 40) s.printedSource = ((s.printedSource || '') + '\n' + String(r.printedText)).trim().slice(0, 6000);
        for (const part of r.parts || []) {
          if (!String(part.text || '').trim()) continue;
          const q = matchTask(part.question, s);
          if (!q) { s.flags.push(`Some writing on ${r.page.source} could not be matched to a task — please check.`); continue; }
          s.text[q.id] = ((s.text[q.id] || '') + '\n' + String(part.text || '')).trim();
          s.lastTask = q.id;
        }
      }
      // Match names and mark each answer with its rubric.
      for (const s of scripts) {
        const m = matchName(s.nameRead, students);
        s.match = m ? { key: m.key, email: m.email, name: m.name, studentId: m.studentId, hasAccount: m.hasAccount, confidence: m.confidence } : null;
        if (!s.nameRead) s.flags.push('No name found on the first page.');
        else if (!m) s.flags.push(`"${s.nameRead}" does not match anyone on the class list.`);
        // A script that answers a different paper (detected from the printed task wording) is
        // marked against the questions printed on the student's own paper.
        const ov = looksLikeOtherPaper(a, s) ? ownPaperOverride(a, s) : null;
        if (ov) {
          s.markedAgainst = { mode: 'own', title: "the questions printed on the student's own paper" };
          s.questionsUsed = ov;
          s.flags.push(OTHER_FLAG);
        }
        if (ov || hasEmptyTask(a, s)) await resplitTasks(a, s, ov).catch((e) => console.warn('[paper] split', e.message));
        await gradeTasks(a, s, ov);
      }
      // Second pass: any task still without full feedback is tried again now, one at a time,
      // after the busy part of the batch is over.
      for (const s of scripts) for (const q of wq) {
        const g = s.grades && s.grades[q.id];
        const text = s.text[q.id] || '';
        if (!g || !text.trim() || (g.mistakesOk && g.wentWell && g.toImprove && ((g.mistakes || []).length || text.trim().split(/\s+/).length < 25))) continue;
        const o = (s.questionsUsed || {})[q.id];
        const mk = await findMistakesSafe(o ? Object.assign({}, q, { prompt: o.prompt }) : q, text, rubricOf(a, q), 2);
        if (mk.wentWell || mk.toImprove || mk.mistakes.length) {
          Object.assign(g, { mistakes: mk.mistakes.length ? mk.mistakes : (g.mistakes || []), wentWell: mk.wentWell || g.wentWell || '', toImprove: mk.toImprove || g.toImprove || '', mistakesOk: mk.mistakesOk });
          if (mk.mistakesOk) s.flags = s.flags.filter((f) => !f.startsWith(`Mistakes and feedback for ${qLabel(a, q)}`));
        }
      }
      scripts.forEach((s) => { delete s.lastTask; delete s.paperVotes; });
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
      questions: writingQs(a).map((q) => {
        // The full task and the reading text it is based on, so the teacher can compare them with the student's answer.
        const sec = (a.sections || []).find((x) => x.id === q.sectionId) || {};
        return { id: q.id, label: qLabel(a, q), points: q.points, prompt: String(q.prompt || '').slice(0, 4000), rubric: rubricOf(a, q),
          passage: String(sec.passage || '').slice(0, 15000), sectionTitle: String(sec.title || '').slice(0, 200), imageUrl: q.imageUrl || '' };
      }),
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
  // Batches not approved yet (so the teacher can come back to one without uploading again).
  app.get('/api/paper/batches', requireTeacher, (req, res) => {
    const as = readAll('assessments.json');
    const list = readAll(BATCHES).filter((b) => b.teacherId === req.session.user.id && b.status === 'review')
      .map((b) => ({ id: b.id, createdAt: b.createdAt, assessmentId: b.assessmentId, title: ((as.find((x) => x.id === b.assessmentId) || {}).title) || 'Assessment', scripts: (b.scripts || []).length }))
      .sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt))).slice(0, 10);
    res.json({ batches: list });
  });
  // ── Deleting: a whole batch (and its uploaded photos), old batches, or one student's script ──
  // Save or remove ONE batch against the latest copy of the file, so a long AI step on one batch can
  // never overwrite (or wipe out) another batch that was created or changed in the meantime.
  function saveBatch(b) {
    const all = readAll(BATCHES);
    const i = all.findIndex((x) => x.id === b.id);
    if (i >= 0) all[i] = b; else all.push(b);
    writeAll(BATCHES, all.slice(-200));
  }
  function removeBatch(id) { writeAll(BATCHES, readAll(BATCHES).filter((x) => x.id !== id)); }
  const rmBatchFiles = (bid) => { try { fs.rmSync(path.join(ROOT, path.basename(bid)), { recursive: true, force: true }); } catch (e) {} };
  app.delete('/api/paper/batches/:bid', requireTeacher, (req, res) => {
    const all = readAll(BATCHES);
    const i = all.findIndex((x) => x.id === req.params.bid && x.teacherId === req.session.user.id);
    if (i < 0) return res.status(404).json({ error: 'Not found' });
    const b = all[i]; removeBatch(b.id); rmBatchFiles(b.id);
    res.json({ ok: true });
  });
  app.post('/api/paper/batches/cleanup', requireTeacher, (req, res) => {
    const days = Math.max(1, Math.min(365, Number((req.body || {}).days) || 7));
    const cutoff = Date.now() - days * 864e5;
    const all = readAll(BATCHES);
    const old = all.filter((b) => b.teacherId === req.session.user.id && b.status === 'review' && new Date(b.createdAt).getTime() < cutoff);
    old.forEach((b) => removeBatch(b.id));
    old.forEach((b) => rmBatchFiles(b.id));
    res.json({ ok: true, deleted: old.length });
  });
  app.delete('/api/paper/batches/:bid/scripts/:sid', requireTeacher, (req, res) => {
    const all = readAll(BATCHES);
    const b = all.find((x) => x.id === req.params.bid && x.teacherId === req.session.user.id);
    if (!b) return res.status(404).json({ error: 'Not found' });
    const si = (b.scripts || []).findIndex((x) => x.id === req.params.sid);
    if (si < 0) return res.status(404).json({ error: 'Script not found' });
    const [sc] = b.scripts.splice(si, 1);
    for (const pid of sc.pages || []) {
      const pi = (b.pages || []).findIndex((p) => p.id === pid);
      if (pi >= 0) { try { fs.unlinkSync(path.join(ROOT, b.id, path.basename(b.pages[pi].file))); } catch (e) {} b.pages.splice(pi, 1); }
    }
    if (!b.scripts.length) { removeBatch(b.id); rmBatchFiles(b.id); } else saveBatch(b);
    res.json({ ok: true, batchDeleted: !b.scripts.length });
  });
  // Mark one student's script again: against the class paper, the questions printed on her own
  // paper, or another assessment in ClassCurio (same rubric and marks as the class).
  app.post('/api/paper/batches/:bid/scripts/:sid/remark', requireTeacher, asyncJob, async (req, res) => {
    try {
      const all = readAll(BATCHES);
      const b = all.find((x) => x.id === req.params.bid && x.teacherId === req.session.user.id);
      if (!b) return res.status(404).json({ error: 'Not found' });
      const a = readAll('assessments.json').find((x) => x.id === b.assessmentId);
      const s = (b.scripts || []).find((x) => x.id === req.params.sid);
      if (!a || !s) return res.status(404).json({ error: 'Not found' });
      const mode = String((req.body || {}).mode || 'own');
      let ov = null, title = '';
      if (mode === 'own') {
        // Read her printed questions again from all her pages together (more reliable than page by page).
        const got = await readPrinted(b, s, a).catch((e) => { console.warn('[paper] printed', e.message); return null; });
        if (got && Object.keys(got.printed).length) { s.printed = Object.assign({}, s.printed || {}, got.printed); if (got.source) s.printedSource = got.source; }
        if (!writingQs(a).some((q) => (s.printed || {})[q.id])) return res.status(422).json({ error: 'The printed questions could not be read from this student\'s pages. Choose the paper from your assessments instead.' });
        ov = ownPaperOverride(a, s); title = "the questions printed on the student's own paper";
      } else if (mode === 'assessment') {
        const other = readAll('assessments.json').find((x) => x.id === (req.body || {}).assessmentId && x.teacherId === req.session.user.id);
        if (!other) return res.status(404).json({ error: 'Assessment not found' });
        const oq = writingQs(other);
        if (!oq.length) return res.status(400).json({ error: 'That assessment has no writing questions.' });
        ov = {};
        writingQs(a).forEach((q, i) => {
          const m = oq.find((x) => x.specTask && x.specTask === q.specTask) || oq[i] || oq[oq.length - 1];
          const sec = (other.sections || []).find((x) => x.id === m.sectionId);
          ov[q.id] = { prompt: m.prompt, passage: (sec && sec.passage) || '', label: qLabel(a, q) };
        });
        title = other.title;
      }
      s.flags = (s.flags || []).filter((f) => !TASK_FLAG_RE.test(f));
      s.markedAgainst = ov ? { mode, title, assessmentId: mode === 'assessment' ? req.body.assessmentId : undefined } : null;
      s.questionsUsed = ov;
      await resplitTasks(a, s, ov).catch((e) => console.warn('[paper] split', e.message));
      await gradeTasks(a, s, ov);
      saveBatch(b);
      res.json({ ok: true, script: s });
    } catch (e) {
      console.error('[paper] remark failed', e);
      res.status(500).json({ error: 'Marking again failed: ' + e.message });
    }
  });
  // Rebuild the paper-script reports in one folder with the AI's comment for each criterion.
  // Marks, feedback and mistakes stay exactly as approved; AI comments come from the original batch.
  app.post('/api/paper/folders/:fid/refresh-reports', requireTeacher, asyncJob, async (req, res) => {
    try {
      const uid = req.session.user.id;
      const folder = folders.load().find((f) => f.id === req.params.fid && f.teacherId === uid);
      if (!folder) return res.status(404).json({ error: 'Folder not found' });
      const marks = folders.loadMarkings().filter((m) => m.folderId === folder.id && m.teacherId === uid);
      const assessments = readAll('assessments.json');
      const batches = readAll(BATCHES);
      const results = readAll('results.json');
      let updated = 0, skipped = 0, resultsChanged = false;
      for (const m of marks) {
        if (m.source !== 'paper' || !m.assessmentId) { skipped++; continue; }
        const a = assessments.find((x) => x.id === m.assessmentId && x.teacherId === uid);
        const rec = a && results.find((r) => r.assessmentId === a.id && r.source === 'paper' &&
          (m.studentId ? r.studentId === m.studentId : String(r.studentName || '').toLowerCase() === String(m.studentName || '').toLowerCase()));
        if (!rec) { skipped++; continue; }
        const wq = writingQs(a);
        const b = batches.find((x) => x.id === rec.paperBatchId) || { id: String(rec.paperBatchId || 'none'), pages: [], scripts: [] };
        let s = (b.scripts || []).find((x) => x.id === rec.paperScriptId);
        if (!s) s = { pages: [], text: Object.fromEntries((rec.answers || []).map((x) => [x.questionId, x.given || ''])), grades: {}, markedAgainst: rec.markedAgainst || null };
        // Fill in the AI's comments on the saved result (older results did not keep them).
        for (const q of wq) {
          const g = (rec.manualGrades || {})[q.id]; if (!g || !g.breakdown) continue;
          const crit = ((s.grades || {})[q.id] || {}).criteria || {};
          for (const [cid, v] of Object.entries(g.breakdown)) {
            if (v && !v.aiComment && crit[cid] && crit[cid].comment) { v.aiComment = String(crit[cid].comment).slice(0, 1200); resultsChanged = true; }
          }
        }
        try {
          const buf = await buildMarkedPdf(a, b, s, rec, wq);
          folders.ensureDir();
          fs.writeFileSync(path.join(folders.dir, path.basename(m.filename)), buf);
          updated++;
        } catch (e) { console.warn('[paper] refresh report failed', m.id, e.message); skipped++; }
      }
      if (resultsChanged) writeAll('results.json', results);
      res.json({ ok: true, updated, skipped });
    } catch (e) {
      console.error('[paper] refresh failed', e);
      res.status(500).json({ error: 'Updating the reports failed: ' + e.message });
    }
  });
  // Find mistakes and feedback again for one task of one script.
  app.post('/api/paper/batches/:bid/scripts/:sid/questions/:qid/mistakes', requireTeacher, asyncJob, async (req, res) => {
    const all = readAll(BATCHES);
    const b = all.find((x) => x.id === req.params.bid && x.teacherId === req.session.user.id);
    if (!b) return res.status(404).json({ error: 'Not found' });
    const a = readAll('assessments.json').find((x) => x.id === b.assessmentId);
    const s = (b.scripts || []).find((x) => x.id === req.params.sid);
    const q = a && (a.questions || []).find((x) => x.id === req.params.qid);
    if (!s || !q) return res.status(404).json({ error: 'Not found' });
    const text = String((s.text || {})[q.id] || '');
    if (!text.trim()) return res.status(400).json({ error: 'There is no writing for this task on the script.' });
    const o = (s.questionsUsed || {})[q.id];
    const mk = await findMistakesSafe(o ? Object.assign({}, q, { prompt: o.prompt }) : q, text, rubricOf(a, q));
    if (!mk.mistakesOk && !(mk.wentWell || mk.toImprove || mk.mistakes.length)) return res.status(502).json({ error: 'The AI could not check this writing right now. Please try again in a minute.' });
    s.grades = s.grades || {};
    const g = s.grades[q.id] = Object.assign(s.grades[q.id] || {}, { mistakes: mk.mistakes, wentWell: mk.wentWell, toImprove: mk.toImprove, mistakesOk: mk.mistakesOk });
    s.flags = (s.flags || []).filter((f) => !f.startsWith(`Mistakes and feedback for ${qLabel(a, q)}`));
    saveBatch(b);
    res.json({ ok: true, grade: g, flags: s.flags });
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
    const body = req.body || {};
    let b = readAll(BATCHES).find((x) => x.id === req.params.bid && x.teacherId === req.session.user.id);
    if (!b) {
      // The batch is no longer on the server: use the copy the teacher has on screen (her own marks).
      const fb = body.fallback;
      const own = fb && readAll('assessments.json').find((x) => x.id === fb.assessmentId && x.teacherId === req.session.user.id);
      if (!own || !Array.isArray(fb.scripts)) return res.status(404).json({ error: 'This batch is no longer on the server. Please upload the pages again.' });
      b = { id: path.basename(String(req.params.bid)), assessmentId: own.id, teacherId: req.session.user.id, createdAt: new Date().toISOString(), status: 'review',
        pages: Array.isArray(fb.pages) ? fb.pages.map((p) => ({ id: String(p.id), kind: p.kind === 'pdf' ? 'pdf' : 'image', mime: p.kind === 'pdf' ? 'application/pdf' : 'image/jpeg', file: String(p.id) + (p.kind === 'pdf' ? '.pdf' : '.jpg'), source: String(p.source || '') })) : [],
        scripts: fb.scripts.map((x) => ({ id: String(x.id), nameRead: String(x.nameRead || ''), pages: Array.isArray(x.pages) ? x.pages.map(String) : [], text: x.text || {}, grades: x.grades || {},
          flags: [], markedAgainst: x.markedAgainst || null, questionsUsed: x.questionsUsed || null })), recovered: true };
      console.warn('[paper] approve: batch', b.id, 'was missing; using the on-screen copy');
    }
    const a = readAll('assessments.json').find((x) => x.id === b.assessmentId);
    if (!a) return res.status(404).json({ error: 'Assessment missing' });
    const wq = writingQs(a);
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
        const ai = s.grades[q.id] || {};
        const pts = Number(q.points) || 0;
        let score = Math.max(0, Math.min(pts, Number(g.score != null && g.score !== '' ? g.score : ai.score) || 0));
        let breakdown = ai.breakdown || undefined, rubricStage = ai.rubricStage || undefined, rubricRaw, rubricTotal;
        // Marked criterion by criterion: the total is the sum of the criteria, converted to the question's marks.
        const rb = rubricOf(a, q);
        const crit = g.criteria && typeof g.criteria === 'object' ? g.criteria : null;
        if (rb && crit && rb.criteria.every((c) => crit[c.id] !== undefined && crit[c.id] !== '' && crit[c.id] !== null)) {
          const f = rb.total ? (pts || rb.total) / rb.total : 1;
          breakdown = {}; rubricRaw = 0; rubricTotal = rb.total;
          for (const c of rb.criteria) {
            const n = Math.max(0, Math.min(c.max, Math.round(Number(crit[c.id]) || 0)));
            const aiC = ai.criteria && ai.criteria[c.id];
            rubricRaw += n;
            // AI comment only when the teacher kept the AI's mark; otherwise the rubric's descriptor for her mark.
            const kept = aiC && aiC.ai !== '' && Number(aiC.ai) === n;
            const comment = kept ? (aiC.comment || '') : (bandText(c, n) || 'Mark set by your teacher.');
            breakdown[c.id] = { name: c.name, score: Math.round(n * f * 10) / 10, max: Math.round(c.max * f * 10) / 10, raw: n, rawMax: c.max,
              ai: aiC && aiC.ai !== '' ? aiC.ai : undefined, comment: String(comment).slice(0, 400), changed: !kept,
              aiComment: String((aiC && aiC.comment) || '').slice(0, 1200) };
          }
          score = Math.max(0, Math.min(pts, toQuestion(rubricRaw, rb.total, pts)));
          rubricStage = rb.stage;
        }
        // Mistakes the teacher kept (indexes into the AI's list) and the two feedback boxes.
        const allM = Array.isArray(ai.mistakes) ? ai.mistakes : [];
        const keepIdx = Array.isArray(g.keepMistakes) ? g.keepMistakes.map(Number) : allM.map((_, i) => i);
        const mistakes = allM.filter((_, i) => keepIdx.includes(i));
        const wentWell = String(g.wentWell != null ? g.wentWell : (ai.wentWell || '')).slice(0, 1200).trim();
        const toImprove = String(g.toImprove != null ? g.toImprove : (ai.toImprove || '')).slice(0, 1200).trim();
        const feedback = g.feedback != null && g.wentWell == null && g.toImprove == null ? String(g.feedback)
          : [wentWell && 'What went well: ' + wentWell, toImprove && 'To improve: ' + toImprove].filter(Boolean).join('\n\n');
        manual[q.id] = { score, maxScore: pts, feedback: feedback.slice(0, 4000), wentWell, toImprove, mistakes,
          breakdown, rubricStage, rubricTitle: rb ? rb.title : undefined, rubricRaw, rubricTotal,
          gradedAt: new Date().toISOString(), gradedBy: req.session.user.name + ' (paper script, AI-assisted)', paper: true };
      }
      const rec = {
        id: uuid(), assessmentId: a.id, assessmentTitle: a.title, studentId: u.id, studentName: u.name, studentEmail: u.email,
        startedAt: null, submittedAt: new Date().toISOString(), source: 'paper', paperBatchId: b.id, paperScriptId: s.id,
        autoScore: 0, autoMax: 0, violations: [], submitReason: 'paper',
        markedAgainst: s.markedAgainst || undefined,
        answers: (a.questions || []).map((q) => ({ questionId: q.id, given: s.text[q.id] || null, correct: null })), manualGrades: manual,
      };
      const i = resultsAll.findIndex((r) => r.assessmentId === a.id && r.studentId === u.id);
      if (i >= 0) resultsAll[i] = rec; else resultsAll.push(rec);
      try { saved.push(Object.assign({ name: u.name }, await saveMarkedPdf(req, a, cls, b, s, rec, wq))); } catch (e) { console.warn('[paper] pdf', e.message); saved.push({ name: u.name, error: e.message }); }
    }
    if (created.length) writeAll('users.json', users);
    writeAll('results.json', resultsAll);
    b.status = 'approved'; b.approvedAt = new Date().toISOString();
    saveBatch(b);
    res.json({ ok: true, recorded: saved.length, created, skipped, folderId: saved.find((x) => x.folderId) ? saved.find((x) => x.folderId).folderId : null });
  });

  // Marked PDF: marks and feedback per question, then the student's pages.
  // Comment shown for each criterion: the AI's explanation; when the teacher changed the mark,
  // the rubric's description of her mark is added so comment and mark never disagree.
  function criterionRows(g) {
    return Object.values(g.breakdown || {}).filter((v) => v && v.raw != null).map((v) => {
      const ai = String(v.aiComment || (!v.changed ? v.comment : '') || '').trim();
      const teacher = v.changed ? String(v.comment || '').trim() : '';
      const comment = ai && teacher ? `${ai}\nTeacher's mark (${v.raw}/${v.rawMax}): ${teacher}` : (ai || teacher);
      return { name: v.name, score: v.raw, max: v.rawMax, comment };
    });
  }
  async function buildMarkedPdf(a, b, s, rec, wq) {
    const PDFKit = require('pdfkit');
    const report = require('./paper-pdf');
    const pageFile = (p) => path.join(ROOT, b.id, path.basename(p.file || ''));
    const pages = (s.pages || []).map((pid) => (b.pages || []).find((x) => x.id === pid)).filter((p) => p && fs.existsSync(pageFile(p)));
    const hasPdfPages = pages.some((p) => p.kind === 'pdf');
    const pdfSlots = {};   // page index in the marked PDF → original scanned PDF page
    let buf = await new Promise((resolve, reject) => {
      const doc = new PDFKit({ size: 'A4', margins: { top: 40, bottom: 30, left: 46, right: 46 } });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
      let pageNo = 1; doc.on('pageAdded', () => pageNo++);
      // Colour-coded summary: the student's writing with mistakes highlighted, corrections, rubric marks, feedback.
      const TYPE = { spelling: 'spell', grammar: 'grammar', punctuation: 'punct', word_choice: 'vocab' };
      let tot = 0, max = 0;
      const tasks = wq.map((q) => {
        const g = rec.manualGrades[q.id] || {}; tot += Number(g.score) || 0; max += Number(g.maxScore) || 0;
        const text = String(s.text[q.id] || '');
        const mistakes = report.locateMistakes(text, (g.mistakes || []).map((m) => ({ wrong: m.text, type: TYPE[m.type] || 'grammar', correct: m.correction, why: m.reason })));
        const criteria = criterionRows(g);
        return { label: `${qLabel(a, q)}`, score: g.score, max: g.maxScore, rubricTitle: g.rubricTitle || '',
          rubricNote: g.rubricTotal && g.rubricTotal !== g.maxScore ? `= ${g.score} / ${g.maxScore} marks` : '',
          text, mistakes, criteria, wentWell: g.wentWell || '', toImprove: g.toImprove || '', feedback: g.feedback || '' };
      });
      report.drawReport(doc, { student: rec.studentName, subtitle: `${a.title} · paper script marked ${new Date(rec.submittedAt || Date.now()).toLocaleDateString('en-GB')}`,
        note: s.markedAgainst ? `Marked against a different paper: ${s.markedAgainst.title}.` : '',
        total: Math.round(tot * 2) / 2, max, tasks });
      for (const p of pages) {
        doc.addPage();
        if (p.kind === 'image' && /jpe?g|png/.test(p.mime)) {
          try { doc.image(pageFile(p), { fit: [500, 740], align: 'center' }); continue; } catch (e) {}
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
            const src = await PDFDocument.load(fs.readFileSync(pageFile(p)), { ignoreEncryption: true });
            const [pg] = await out.copyPages(src, [0]); out.addPage(pg);
          } else out.addPage(copied[i]);
        }
        buf = Buffer.from(await out.save());
      } catch (e) { console.warn('[paper] could not insert PDF pages:', e.message); }
    }
    return buf;
  }
  async function saveMarkedPdf(req, a, cls, b, s, rec, wq) {
    const fl = folders.load();
    let folder = fl.find((f) => f.teacherId === req.session.user.id && f.classId === (cls && cls.id));
    if (!folder) {
      folder = { id: 'fld-' + Date.now().toString(36) + crypto.randomBytes(2).toString('hex'), name: 'Writing — ' + ((cls && cls.name) || 'Class'), classId: (cls && cls.id) || null, className: (cls && cls.name) || null, teacherId: req.session.user.id, createdAt: new Date().toISOString() };
      fl.push(folder); folders.save(fl);
    }
    folders.ensureDir();
    const id = 'mk-' + Date.now().toString(36) + crypto.randomBytes(2).toString('hex');
    const file = id + '.pdf';
    const buf = await buildMarkedPdf(a, b, s, rec, wq);
    fs.writeFileSync(path.join(folders.dir, file), buf);
    const mk = folders.loadMarkings();
    mk.push({ id, folderId: folder.id, teacherId: req.session.user.id, studentName: rec.studentName, studentId: rec.studentId, filename: file, createdAt: new Date().toISOString(), assessmentId: a.id, source: 'paper' });
    folders.saveMarkings(mk);
    return { folderId: folder.id, markingId: id };
  }
};
