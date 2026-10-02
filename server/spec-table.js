// ─────────────────────────────────────────────────────────────────────────────
//  Specification Table (جدول المواصفات) — admin-only Excel download.
//  Format A: the MOE layout.  Format B: full blueprint (Summary, Specification,
//  Outcome coverage, Checks) + the MOE layout as its last tab.
//  Bloom's level + learning outcome are tagged by AI (data/spec-tags.json);
//  outcomes come from server/curriculum/moe-curriculum.json.
// ─────────────────────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ExcelJS = require('exceljs');

module.exports = function specTable(app, d) {
  const { readAll, writeAll, ADMIN_EMAILS, readApiKey } = d;

  // ── Curriculum ─────────────────────────────────────────────────────────────
  let CUR = {};
  try { CUR = JSON.parse(fs.readFileSync(path.join(__dirname, 'curriculum', 'moe-curriculum.json'), 'utf8')); }
  catch (e) { console.warn('[spec] curriculum not loaded:', e.message); }
  const SUBJ_KEY = { Math: 'Maths', Maths: 'Maths', English: 'English', Science: 'Science', Physics: 'Physics', Chemistry: 'Chemistry', Biology: 'Biology', 'AI & Technology': 'AI & Technology', 'Business Studies': 'Business Studies', 'Health Science': 'Health Science' };
  const SUBJ_AR = { Math: 'الرياضيات', Science: 'العلوم', Physics: 'الفيزياء', Chemistry: 'الكيمياء', Biology: 'الأحياء', 'Health Science': 'العلوم الصحية',
    'Islamic Studies': 'التربية الإسلامية', 'Social Studies': 'الدراسات الاجتماعية', Arabic: 'اللغة العربية', 'AI & Technology': 'الذكاء الاصطناعي والتكنولوجيا', 'Business Studies': 'دراسات الأعمال', French: 'اللغة الفرنسية', English: 'اللغة الإنجليزية', Other: 'أخرى' };
  function gradeKey(grade, stream) {
    const g = parseInt(grade, 10);
    if (!g) return null;
    if (g >= 9) return String(g) + (stream === 'G' ? 'G' : 'A');
    return String(g);
  }
  function curriculumOutcomes(a, st) {
    const gk = gradeKey(a.grade, st.stream);
    const sk = SUBJ_KEY[a.subject];
    const term = String(st.term || a.term || '');
    if (!gk || !sk || !term || !CUR[gk] || !CUR[gk][term] || !CUR[gk][term][sk]) return { list: [], source: null };
    const e = CUR[gk][term][sk];
    const list = [];
    if (Array.isArray(e.lessons) && e.lessons.length && !e.sequenceSource) {
      e.lessons.forEach((l, i) => {
        const wk = String(l.weeks || '').match(/(\d+)\D+(\d+)/) || (String(l.weeks || '').match(/(\d+)/) ? [0, RegExp.$1, RegExp.$1] : null);
        if (Array.isArray(l.slos) && l.slos.length) {
          // Biology: one outcome per SLO (code + text), linked to its lesson.
          for (const s of l.slos) {
            if (list.some((x) => x.code === s.code)) continue;
            list.push({ code: s.code, text: s.text, unit: `${l.module || ''} — ${l.lesson}`.replace(/^ — /, ''), weeks: l.weeks || '', wFrom: wk ? +wk[1] : null, wTo: wk ? +wk[2] : null, type: l.type || 'core',
              priority: s.priority || '', module: l.module || l.unit || '', lesson: l.lesson || '', lessonKey: l.code || `L${i + 1}` });
          }
          return;
        }
        list.push({ code: l.code || `L${i + 1}`, text: `${l.module || l.unit || ''} — ${l.lesson}`.replace(/^ — /, ''),
          unit: l.unit || l.module || '', weeks: l.weeks || '', wFrom: wk ? +wk[1] : null, wTo: wk ? +wk[2] : null, type: l.type || 'core',
          module: l.module || l.unit || '', lesson: l.lesson || '', lessonKey: l.code || `L${i + 1}` });
      });
    } else {
      const abbr = { English: 'EN', Maths: 'MA', Science: 'SC', Physics: 'PH', Chemistry: 'CH', Biology: 'BI', 'AI & Technology': 'AT', 'Business Studies': 'BS', 'Health Science': 'HS' }[sk];
      Object.entries(e.strands || {}).forEach(([strand, outs], si) => {
        (outs || []).forEach((t, oi) => list.push({ code: `${abbr}${gk}.T${term}.${si + 1}.${oi + 1}`, text: String(t), unit: strand, weeks: '', wFrom: null, wTo: null, type: 'core', module: strand, lesson: '', lessonKey: '' }));
      });
    }
    const src = String(e.sequenceSource || e.source || 'MOE curriculum').replace(/^Masar \(GitHub\)$/, 'MOE curriculum (from Adeptly)');
    return { list, source: src, gk, sk, term };
  }

  // ── 2026-27 calendar + weekly level plan ──────────────────────────────────
  function weeksFrom(start, n) { const out = []; const d0 = new Date(start + 'T00:00:00Z'); for (let i = 0; i < n; i++) out.push(new Date(d0.getTime() + i * 7 * 864e5).toISOString().slice(0, 10)); return out; }
  const TERMS = [
    { term: '1', mondays: weeksFrom('2026-08-31', 15), skip: ['2026-10-12', '2026-11-30'] },
    { term: '2', mondays: weeksFrom('2027-01-04', 13), skip: ['2027-03-08'] },
    { term: '3', mondays: weeksFrom('2027-04-12', 12), skip: [] },
  ];
  const LEVEL_PLAN = { '1': 'EMEDEMEMDEMEM', '2': 'MEDEMMEDMEDM', '3': 'MDEMDMEDMDMD' };
  const MIX = { E: { easy: 0.6, medium: 0.3, hard: 0.1 }, M: { easy: 0.3, medium: 0.5, hard: 0.2 }, D: { easy: 0.15, medium: 0.45, hard: 0.4 } };
  function weekOf(dateStr) {
    if (!dateStr) return null;
    const t = Date.parse(String(dateStr).slice(0, 10) + 'T00:00:00Z');
    if (!t) return null;
    for (const T of TERMS) {
      let wk = 0;
      for (const m of T.mondays) {
        const ms = Date.parse(m + 'T00:00:00Z');
        if (!T.skip.includes(m)) wk++;
        if (t >= ms && t < ms + 7 * 864e5) { const w = Math.max(1, wk); return { term: T.term, week: w, level: LEVEL_PLAN[T.term][w - 1] || null }; }
      }
    }
    return null;
  }
  function academicYear(a) {
    const dt = new Date(a.scheduledDate || a.createdAt || Date.now());
    const y = dt.getUTCFullYear(), mo = dt.getUTCMonth() + 1;
    return mo >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
  }

  // ── Stores ─────────────────────────────────────────────────────────────────
  const rd = (n) => { const r = readAll(n); return Array.isArray(r) ? r : []; };
  function getSettings(aid) {
    const all = rd('spec-settings.json');
    const def = all.find((x) => x.assessmentId === '__defaults') || {};
    const own = all.find((x) => x.assessmentId === aid) || {};
    return Object.assign({ school: def.school || '', stream: '', term: '', level: 'auto', scope: 'term', targets: {} }, own);
  }
  function saveSettings(aid, s) {
    const all = rd('spec-settings.json');
    const clean = {
      assessmentId: aid,
      school: String(s.school || '').slice(0, 160),
      stream: ['A', 'G', ''].includes(s.stream) ? s.stream : '',
      term: ['1', '2', '3', ''].includes(String(s.term || '')) ? String(s.term || '') : '',
      level: ['auto', 'E', 'M', 'D', 'none'].includes(s.level) ? s.level : 'auto',
      scope: ['term', 'week'].includes(s.scope) ? s.scope : 'term',
      targets: {},
      updatedAt: new Date().toISOString(),
    };
    for (const [k, v] of Object.entries(s.targets || {})) { const n = Number(v); if (k && String(v).trim() !== '' && n >= 0 && n <= 100) clean.targets[String(k).slice(0, 80)] = n; }
    const i = all.findIndex((x) => x.assessmentId === aid);
    if (i >= 0) all[i] = clean; else all.push(clean);
    const di = all.findIndex((x) => x.assessmentId === '__defaults');
    if (clean.school) { if (di >= 0) all[di].school = clean.school; else all.push({ assessmentId: '__defaults', school: clean.school }); }
    writeAll('spec-settings.json', all);
    return clean;
  }
  const qHash = (q) => crypto.createHash('sha1').update(JSON.stringify([q.type, q.prompt, q.options, q.correctAnswer, (q.imageUrl || '').length])).digest('hex').slice(0, 16);
  const tagsFor = (aid) => new Map(rd('spec-tags.json').filter((r) => r.assessmentId === aid).map((r) => [r.questionId, r]));
  function upsertTags(aid, entries) {
    const all = rd('spec-tags.json');
    for (const e of entries) {
      const i = all.findIndex((r) => r.assessmentId === aid && r.questionId === e.questionId);
      const rec = Object.assign({ assessmentId: aid, updatedAt: new Date().toISOString() }, e);
      if (i >= 0) all[i] = Object.assign(all[i], rec); else all.push(rec);
    }
    writeAll('spec-tags.json', all);
  }

  // ── AI tagging (Bloom's level + outcome + difficulty where missing) ────────
  const JOBS = new Map();
  const BLOOM_RULES = `BLOOM'S LEVEL (MOE three-band grouping):
- "recall": Remember / Understand — recall a fact, define, identify, recognise, retrieve information stated directly, explain literal meaning.
- "application": Apply / Analyse — use a rule or procedure, multi-step calculation, compare, classify, infer from a text, analyse structure, word meaning from context.
- "higher": Evaluate / Create (higher-order thinking) — justify, critique, judge, design, solve an unfamiliar open problem, extended writing or composition.`;
  function tagJob(aid, force) {
    const cur0 = JOBS.get(aid);
    if (cur0 && cur0.state === 'running') return cur0;
    const job = { state: 'running', done: 0, total: 0, error: null, startedAt: Date.now() };
    JOBS.set(aid, job);
    (async () => {
      try {
        if (!readApiKey()) throw new Error('No Anthropic API key configured in Settings.');
        if (typeof d.tagMissingSkills === 'function') { try { await d.tagMissingSkills(aid); } catch (e) { console.warn('[spec] skills:', e.message); } }
        const a = readAll('assessments.json').find((x) => x.id === aid);
        if (!a) throw new Error('Assessment not found');
        const st = getSettings(aid);
        const wk = weekOf(a.scheduledDate);
        const cur = curriculumOutcomes(a, Object.assign({}, st, { term: st.term || a.term || (wk && wk.term) || '' }));
        const tags = tagsFor(aid);
        const diff = new Map(d.diffFor(aid).map((r) => [r.questionId, r]));
        const todo = (a.questions || []).filter((q) => {
          const t = tags.get(q.id);
          if (t && t.source === 'admin' && !force) return false;
          return force || !t || t.hash !== qHash(q) || !t.outcome || !diff.has(q.id);
        });
        job.total = todo.length;
        const outList = cur.list.slice(0, 160).map((o, i) => ({ id: 'O' + (i + 1), code: o.code, outcome: o.text.slice(0, 220), unit: o.unit }));
        const system = [
          'You are an experienced assessment moderator preparing an exam specification table (جدول المواصفات).',
          `Subject: ${a.subject || 'not specified'}. Grade: ${a.grade || 'not specified'}. Language of the paper: ${a.assessmentLanguage || 'as written'}.`,
          BLOOM_RULES,
          'LEARNING OUTCOME: ' + (outList.length
            ? 'choose the ONE curriculum outcome (by its id, e.g. "O7") that the question assesses best. Only if none fits at all, leave outcomeId empty and write outcomeText.'
            : 'no curriculum list is available — write outcomeText: one short learning-outcome statement (max 25 words) in the language of the paper, MOE style ("Identifies…", "Analyses…"). Use the SAME wording for questions that assess the same outcome.'),
          'DIFFICULTY for the stated grade: "easy" (one step, recall), "medium" (typical application), "hard" (multi-step, unfamiliar, or higher-order).',
          'Questions may be pictures — read the image. Return one entry per question with exactly the same ids.',
        ].join('\n');
        const secInfo = new Map((a.sections || []).map((s) => [s.id, { title: s.title || '', instructions: String(s.instructions || '').slice(0, 400), passage: String(s.passage || '').slice(0, 1500) }]));
        const usedTexts = new Set();
        for (let i = 0; i < todo.length; i += 8) {
          const chunk = todo.slice(i, i + 8);
          const content = [];
          const qs = chunk.map((q) => {
            const img = d.imageBlock(q.imageUrl);
            if (img) { content.push({ type: 'text', text: `Image for question id ${q.id}:` }); content.push(img); }
            return { id: q.id, type: q.type, points: q.points, sectionId: q.sectionId || undefined,
              prompt: String(q.prompt || '').slice(0, 2000) || (img ? '[see image]' : '[no text]'),
              options: Array.isArray(q.options) && q.options.length ? q.options : undefined, skill: q.skill || undefined };
          });
          const secIds = Array.from(new Set(chunk.map((q) => q.sectionId).filter((s) => secInfo.has(s))));
          content.push({ type: 'text', text: (usedTexts.size ? 'Outcome statements already used (reuse when they fit): ' + Array.from(usedTexts).join(' | ') + '\n\n' : '') + JSON.stringify({
            curriculumOutcomes: outList.length ? outList : undefined,
            sections: secIds.length ? Object.fromEntries(secIds.map((s) => [s, secInfo.get(s)])) : undefined,
            questions: qs }) });
          let arr = null, err = null;
          for (let t = 0; t < 2 && !Array.isArray(arr); t++) {
            try {
              arr = await d.claudeList({ system, content, maxTokens: 6000, itemProps: {
                id: { type: 'string' }, bloom: { type: 'string', enum: ['recall', 'application', 'higher'] },
                outcomeId: { type: 'string' }, outcomeText: { type: 'string' },
                difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] }, difficultyReason: { type: 'string' } },
                required: ['id', 'bloom', 'difficulty'] });
            } catch (e) { err = e; if (/API key|credit|billing/i.test(e.message)) throw e; }
          }
          if (!Array.isArray(arr)) throw err || new Error('AI reply could not be read');
          const byId = new Map(arr.filter((x) => x && x.id).map((x) => [String(x.id).trim(), x]));
          if (!chunk.some((q) => byId.has(q.id)) && arr.length === chunk.length) arr.forEach((x, k) => byId.set(chunk[k].id, x));
          const tagRecs = [], diffRecs = [];
          for (const q of chunk) {
            const x = byId.get(q.id);
            if (!x) continue;
            const oid = String(x.outcomeId || '').trim();
            const idx = /^O\d+$/.test(oid) ? Number(oid.slice(1)) - 1 : -1;
            const full = idx >= 0 && idx < outList.length ? cur.list[idx] : null;
            const text = full ? full.text : String(x.outcomeText || '').slice(0, 300);
            if (!full && text) usedTexts.add(text);
            tagRecs.push({ questionId: q.id, hash: qHash(q), source: 'ai', bloom: ['recall', 'application', 'higher'].includes(x.bloom) ? x.bloom : 'application',
              outcomeCode: full ? full.code : '', outcome: text, unit: full ? full.unit : '', weeks: full ? full.weeks : '' });
            const old = diff.get(q.id);
            if (!old || (force && old.source !== 'admin')) {
              const lvl = d.normLevel(x.difficulty);
              if (lvl) diffRecs.push({ questionId: q.id, level: lvl, reason: String(x.difficultyReason || '').slice(0, 300), source: 'ai' });
            }
          }
          if (tagRecs.length) upsertTags(aid, tagRecs);
          if (diffRecs.length) d.diffUpsert(aid, diffRecs);
          job.done = Math.min(todo.length, i + chunk.length);
        }
        job.state = 'done';
      } catch (e) {
        job.state = 'error'; job.error = String(e.message || e) + (e.detail ? ' — ' + String(e.detail).slice(0, 160) : '');
        console.error('[spec] tagging failed for', aid, job.error);
      }
    })();
    return job;
  }

  // ── Model ──────────────────────────────────────────────────────────────────
  const OBJECTIVE = new Set(['mc', 'tf', 'tfng', 'match']);
  const FORMAT_LABEL = { en: { mc: 'Multiple choice', tf: 'True / False', tfng: 'True / False / Not given', match: 'Matching', short: 'Short answer', long: 'Long answer', essay: 'Essay', writing: 'Extended writing' },
    ar: { mc: 'اختيار من متعدد', tf: 'صح / خطأ', tfng: 'صح / خطأ / غير مذكور', match: 'مزاوجة', short: 'إجابة قصيرة', long: 'إجابة مطولة', essay: 'مقالي', writing: 'كتابة ممتدة' } };
  function buildModel(a, lang) {
    lang = lang === 'ar' ? 'ar' : 'en';
    const st = getSettings(a.id);
    const tags = tagsFor(a.id);
    const diff = new Map(d.diffFor(a.id).map((r) => [r.questionId, r]));
    const wk = weekOf(a.scheduledDate);
    const term = String(st.term || a.term || (wk && wk.term) || '');
    const cur = curriculumOutcomes(a, Object.assign({}, st, { term }));
    const level = st.level === 'auto' ? (wk ? wk.level : null) : (st.level === 'none' ? null : st.level);
    const items = (a.questions || []).map((q, i) => {
      const t = tags.get(q.id) || {};
      const df = diff.get(q.id);
      const skill = String(q.skill || '').trim() || (lang === 'ar' ? 'غير مصنّف' : 'Untagged');
      return {
        id: q.id, no: String(i + 1), skill,
        outcomeCode: t.outcomeCode || '', outcome: t.outcome || '', unit: t.unit || '', weeks: t.weeks || '',
        preview: String(q.prompt || '').replace(/\s+/g, ' ').replace(/\\\(|\\\)|\\\[|\\\]|\$/g, '').trim().slice(0, 90) || (q.imageUrl ? (lang === 'ar' ? '[سؤال بصورة]' : '[picture question]') : ''),
        format: FORMAT_LABEL[lang][q.type] || q.type, objective: OBJECTIVE.has(q.type),
        bloom: t.bloom || '', marks: Number(q.points) || 1,
        difficulty: df ? df.level : '', tagged: t.source === 'admin' ? 'admin' : (t.source ? 'ai' : ''),
        stale: !!(t.hash && t.hash !== qHash(q)),
      };
    });
    const synth = new Map(); let sn = 0;
    for (const it of items) {
      if (!it.outcomeCode && it.outcome) {
        if (!synth.has(it.outcome)) synth.set(it.outcome, 'X' + (++sn));
        it.outcomeCode = synth.get(it.outcome);
      }
    }
    const skills = [];
    for (const it of items) if (!skills.includes(it.skill)) skills.push(it.skill);
    const assessed = new Set(items.map((i) => i.outcomeCode).filter(Boolean));
    const examWeek = wk && wk.term === term ? wk.week : null;
    const coverage = [];
    for (const o of cur.list) {
      const isAssessed = assessed.has(o.code);
      if (!isAssessed) {
        if (o.type === 'enrichment') continue;
        if (examWeek && o.wFrom && o.wFrom > examWeek) continue;                    // not taught yet
        if (st.scope === 'week' && (!examWeek || !o.wFrom || (o.wTo || o.wFrom) < examWeek - 1)) continue;
      }
      coverage.push({ code: o.code, outcome: o.text, unit: o.unit, weeks: o.weeks, skill: (items.find((i) => i.outcomeCode === o.code) || {}).skill || '' });
    }
    for (const [text, code] of synth) coverage.push({ code, outcome: text, unit: '', weeks: '', skill: (items.find((i) => i.outcomeCode === code) || {}).skill || '' });
    return { a, st, wk, term, year: academicYear(a), level, cur, items, skills, coverage, lang };
  }
  function quickChecks(m) {
    const tot = m.items.reduce((s, i) => s + i.marks, 0) || 1;
    const out = [];
    const L = (en, ar) => (m.lang === 'ar' ? ar : en);
    if (tot !== 100) out.push(L(`Total marks are ${tot} (MOE papers are usually out of 100).`, `مجموع الدرجات ${tot} (أوراق الوزارة عادة من 100).`));
    const blanks = m.items.filter((i) => !i.bloom || !i.difficulty || !i.outcome || /^(Untagged|غير مصنّف)$/.test(i.skill)).length;
    if (blanks) out.push(L(`${blanks} item(s) are still missing a skill, outcome, Bloom’s level or difficulty.`, `${blanks} مفردة ينقصها مهارة أو ناتج أو مستوى بلوم أو صعوبة.`));
    const stale = m.items.filter((i) => i.stale).length;
    if (stale) out.push(L(`${stale} question(s) changed since they were tagged — they will be re-tagged.`, `${stale} سؤال تغيّر بعد التصنيف — سيعاد تصنيفه.`));
    const wErr = m.items.filter((i) => /writ|كتاب/i.test(i.skill) && i.objective).length;
    if (wErr) out.push(L(`${wErr} writing item(s) are objective-type questions.`, `${wErr} مفردة كتابة من النوع الموضوعي.`));
    for (const s of m.skills) {
      const t = m.st.targets[s];
      if (t == null) continue;
      const act = Math.round(100 * m.items.filter((i) => i.skill === s).reduce((x, i) => x + i.marks, 0) / tot);
      if (Math.abs(act - t) > 1) out.push(L(`${s}: ${act}% of marks (target ${t}%).`, `${s}: ${act}% من الدرجات (المستهدف ${t}%).`));
    }
    if (m.level) {
      const mix = MIX[m.level];
      for (const lv of ['easy', 'medium', 'hard']) {
        const act = m.items.filter((i) => i.difficulty === lv).reduce((x, i) => x + i.marks, 0) / tot;
        if (Math.abs(act - mix[lv]) > 0.1) out.push(L(`${lv[0].toUpperCase() + lv.slice(1)}: ${Math.round(act * 100)}% of marks (target ${Math.round(mix[lv] * 100)}%).`,
          `${{ easy: 'سهل', medium: 'متوسط', hard: 'صعب' }[lv]}: ${Math.round(act * 100)}% من الدرجات (المستهدف ${Math.round(mix[lv] * 100)}%).`));
      }
    }
    const hots = m.items.filter((i) => i.bloom === 'higher').reduce((x, i) => x + i.marks, 0) / tot;
    if (m.items.some((i) => i.bloom) && hots < 0.2) out.push(L(`Only ${Math.round(hots * 100)}% of marks are higher-order thinking (aim for 20%+).`, `${Math.round(hots * 100)}% فقط من الدرجات لمهارات التفكير العليا (المستهدف 20% فأكثر).`));
    const notAssessed = m.coverage.filter((o) => !m.items.some((i) => i.outcomeCode === o.code)).length;
    if (notAssessed) out.push(L(`${notAssessed} outcome(s) taught so far are not assessed.`, `${notAssessed} ناتج دُرّس ولم يُقس.`));
    return out;
  }

  // ── Excel ──────────────────────────────────────────────────────────────────
  const PAL = ['DCE9F7', 'FCE4D6', 'D9F2D0', 'EDEDED', 'F1DAF2', 'FFF2CC', 'E2EFDA', 'DDEBF7', 'FBE5D6', 'E4DFEC'];
  const NAVY = 'FF1F3864';
  const thin = { style: 'thin', color: { argb: 'FFBFBFBF' } };
  const BORDER = { top: thin, left: thin, bottom: thin, right: thin };
  const CENTER = { horizontal: 'center', vertical: 'middle', wrapText: true };
  const fill = (h) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + h } });
  const font = (o = {}) => Object.assign({ name: 'Arial', size: 10 }, o);
  const T = {
    en: {
      dir: false, bloom: { recall: 'Recall / Understanding', application: 'Application / Analysis', higher: 'Higher-order thinking' },
      diff: { easy: 'Easy', medium: 'Medium', hard: 'Hard' }, type: { o: 'Objective', e: 'Essay' }, levelName: { E: 'Easy', M: 'Medium', D: 'Difficult' },
      moeTitle: (m) => `Exam Paper Specification Table – Grade ${m.a.grade || '—'} – Term ${m.term || '—'} – ${m.a.subject || ''} – ${m.year}`,
      info: (m) => [m.st.stream === 'A' ? 'Advanced stream' : m.st.stream === 'G' ? 'General stream' : 'All streams', `Grade ${m.a.grade || '—'}`, m.a.subject || '—', 'Specification table', `T${m.term || '—'} – ${m.year}`],
      cols: ['Skill', 'Learning outcome', 'Unit / Lesson / Topic', 'Weighting', 'Item no.', 'Item type\nObjective / Essay', 'Recall /\nUnderstanding', 'Application /\nAnalysis', 'Higher-order\nthinking', 'Expected difficulty\nEasy / Medium / Hard'],
      bloomHdr: 'Item marks by thinking level (Bloom’s cognitive domain)', total: 'Total',
      sheets: { sum: 'Summary', spec: 'Specification', cov: 'Outcome coverage', chk: 'Checks', moe: 'MOE format' },
      specTitle: 'Specification Table – Item Detail', sumTitle: 'Assessment Blueprint – Summary', covTitle: 'Learning Outcome Coverage', chkTitle: 'Quality Checks',
      specCols: ['Item no.', 'Skill', 'Outcome code', 'Learning outcome', 'Unit / Lesson / Topic', 'Week taught', 'Question (first line)', 'Question format', 'Item type', 'Bloom’s level', 'Marks', 'Recall / Understanding', 'Application / Analysis', 'Higher-order thinking', 'Expected difficulty', 'Tagged by', 'Admin note'],
      tagged: { ai: 'AI', admin: 'Admin', '': '—' },
      infoRows: (m) => [['Assessment', m.a.title || ''], ['Teacher', m.teacher || ''], ['Date / Week', [m.a.scheduledDate || '—', m.wk ? `Term ${m.wk.term}, Week ${m.wk.week}` : ''].filter(Boolean).join(' · ')],
        ['Required weekly level', m.level ? T.en.levelName[m.level] : 'Not set'], ['Curriculum source', m.cur.source || 'No MOE curriculum for this grade/subject — outcomes written by AI']],
      tiles: ['Total marks', 'Items', 'Higher-order thinking', 'Essay marks', 'Checks passed'],
      s1: '1. Blueprint – marks by skill and thinking level', s2: '2. Difficulty mix (by marks) vs the week’s required level', s3: '3. Item types',
      bpCols: ['Skill', 'Recall / Understanding', 'Application / Analysis', 'Higher-order thinking', 'Total marks', 'Actual weight', 'Target weight', 'Status'],
      share: 'Share of marks', dCols: ['Difficulty', 'Marks', 'Actual %', 'Target %', 'Difference', 'Status'], tCols: ['Item type', 'Items', 'Marks', '% of marks'],
      onT: '✅ On target', over: '⚠ Over by ', under: '⚠ Under by ', within: '✅ Within 10 points', off: '⚠ Off target', dash: '—',
      covCols: ['Outcome code', 'Skill', 'Learning outcome', 'Unit / Lesson', 'Week taught', 'Marks', '% of paper', 'Status'], assessed: '✅ Assessed', notAssessed: '⚠ Not assessed',
      covNote: 'Outcomes taught up to the exam date (enrichment lessons only appear if assessed). Codes starting with X are outcomes written by AI because the curriculum list had no match.',
      chkCols: ['#', 'Check', 'Value', 'Result', 'What to do'], ok: '✅ OK',
      checks: ['Total marks equal 100', 'No duplicate item numbers', 'Every item has a skill, outcome, Bloom’s level and difficulty', 'Writing tasks are not objective-type',
        'Skill weightings match the targets (±1%)', 'Difficulty mix within 10 points of the weekly target', 'At least 20% of marks are higher-order thinking',
        'Every outcome taught so far is assessed', 'Bloom’s marks add up to the item marks'],
      todo: ['Adjust item marks (MOE papers are usually out of 100).', 'Renumber the duplicated items.', 'Re-run tagging or correct the blanks.', 'Change the question type to a written response.',
        'See Summary §1 – move marks between skills.', 'See Summary §2 – make some items harder or easier.', 'Add an analysis / evaluation question.', 'See Outcome coverage – add an item or note why.', 'Check the Bloom’s level of each item.'],
      legend: 'Item type: multiple choice, true/false and matching = Objective; short, long, essay and writing = Essay. Blue numbers are targets you can change.',
      untagged: 'Untagged',
    },
    ar: {
      dir: true, bloom: { recall: 'الفهم/ التذكر', application: 'التحليل/ التطبيق', higher: 'مهارات التفكير العليا' },
      diff: { easy: 'سهل', medium: 'متوسط', hard: 'صعب' }, type: { o: 'موضوعي', e: 'مقالي' }, levelName: { E: 'سهل', M: 'متوسط', D: 'صعب' },
      moeTitle: (m) => `جدول مواصفات الورقة الاختبارية للصف ${m.a.grade || '—'} - الفصل الدراسي ${({ 1: 'الأول', 2: 'الثاني', 3: 'الثالث' })[m.term] || '—'} - مادة ${SUBJ_AR[m.a.subject] || m.a.subject || ''} - ${m.year}`,
      info: (m) => [m.st.stream === 'A' ? 'المسار المتقدم' : m.st.stream === 'G' ? 'المسار العام' : 'جميع المسارات', `الصف ${m.a.grade || '—'}`, SUBJ_AR[m.a.subject] || m.a.subject || '—', 'جدول المواصفات', `T${m.term || '—'} - ${m.year}`],
      cols: ['المهارة', 'الناتج التعليمي', 'الوحدة/ الدرس/ الموضوع', 'الوزن النسبي', 'رقم المفردة', 'تصنيف المفردات\nموضوعي/ مقالي', 'الفهم/ التذكر', 'التحليل/ التطبيق', 'مهارات التفكير العليا', 'درجة الصعوبة المتوقعة\nسهل/ متوسط/ صعب'],
      bloomHdr: 'درجة المفردة/ مستويات التفكير (مجال بلوم المعرفي)', total: 'المجموع',
      sheets: { sum: 'الملخص', spec: 'المواصفات', cov: 'تغطية النواتج', chk: 'التحقق', moe: 'نموذج الوزارة' },
      specTitle: 'جدول المواصفات – تفاصيل المفردات', sumTitle: 'مخطط الاختبار – الملخص', covTitle: 'تغطية نواتج التعلم', chkTitle: 'فحوص الجودة',
      specCols: ['رقم المفردة', 'المهارة', 'رمز الناتج', 'الناتج التعليمي', 'الوحدة/ الدرس', 'أسبوع التدريس', 'السؤال (السطر الأول)', 'شكل السؤال', 'تصنيف المفردة', 'مستوى بلوم', 'الدرجة', 'الفهم/ التذكر', 'التحليل/ التطبيق', 'مهارات التفكير العليا', 'الصعوبة المتوقعة', 'التصنيف بواسطة', 'ملاحظة الإدارة'],
      tagged: { ai: 'الذكاء الاصطناعي', admin: 'الإدارة', '': '—' },
      infoRows: (m) => [['الاختبار', m.a.title || ''], ['المعلم', m.teacher || ''], ['التاريخ/ الأسبوع', [m.a.scheduledDate || '—', m.wk ? `الفصل ${m.wk.term}، الأسبوع ${m.wk.week}` : ''].filter(Boolean).join(' · ')],
        ['مستوى الأسبوع المطلوب', m.level ? T.ar.levelName[m.level] : 'غير محدد'], ['مصدر المنهج', m.cur.source || 'لا يوجد منهج وزاري لهذا الصف/المادة — النواتج من الذكاء الاصطناعي']],
      tiles: ['مجموع الدرجات', 'عدد المفردات', 'التفكير العليا', 'درجات المقالي', 'الفحوص الناجحة'],
      s1: '1. المخطط – الدرجات حسب المهارة ومستوى التفكير', s2: '2. توزيع الصعوبة (حسب الدرجات) مقارنة بمستوى الأسبوع', s3: '3. أنواع المفردات',
      bpCols: ['المهارة', 'الفهم/ التذكر', 'التحليل/ التطبيق', 'مهارات التفكير العليا', 'مجموع الدرجات', 'الوزن الفعلي', 'الوزن المستهدف', 'الحالة'],
      share: 'نسبة الدرجات', dCols: ['الصعوبة', 'الدرجات', 'النسبة الفعلية', 'النسبة المستهدفة', 'الفرق', 'الحالة'], tCols: ['نوع المفردة', 'العدد', 'الدرجات', 'النسبة'],
      onT: '✅ مطابق', over: '⚠ أعلى بـ ', under: '⚠ أقل بـ ', within: '✅ ضمن 10 نقاط', off: '⚠ خارج المستهدف', dash: '—',
      covCols: ['رمز الناتج', 'المهارة', 'الناتج التعليمي', 'الوحدة/ الدرس', 'أسبوع التدريس', 'الدرجات', 'النسبة', 'الحالة'], assessed: '✅ مُقاس', notAssessed: '⚠ غير مُقاس',
      covNote: 'النواتج التي دُرّست حتى تاريخ الاختبار (دروس الإثراء تظهر فقط إذا قيست). الرموز التي تبدأ بـ X نواتج كتبها الذكاء الاصطناعي لعدم وجود تطابق في المنهج.',
      chkCols: ['#', 'الفحص', 'القيمة', 'النتيجة', 'الإجراء المطلوب'], ok: '✅ سليم',
      checks: ['مجموع الدرجات يساوي 100', 'لا تكرار في أرقام المفردات', 'لكل مفردة مهارة وناتج ومستوى بلوم وصعوبة', 'مفردات الكتابة ليست موضوعية',
        'أوزان المهارات مطابقة للمستهدف (±1%)', 'توزيع الصعوبة ضمن 10 نقاط من مستوى الأسبوع', '20% على الأقل من الدرجات لمهارات التفكير العليا',
        'كل ناتج دُرّس حتى الآن مُقاس', 'درجات مستويات بلوم تساوي درجات المفردات'],
      todo: ['عدّل درجات المفردات (أوراق الوزارة عادة من 100).', 'أعد ترقيم المفردات المكررة.', 'أعد التصنيف أو أكمل الخانات الفارغة.', 'غيّر نوع السؤال إلى إجابة مكتوبة.',
        'انظر الملخص §1 – انقل الدرجات بين المهارات.', 'انظر الملخص §2 – اجعل بعض المفردات أصعب أو أسهل.', 'أضف سؤال تحليل/ تقويم.', 'انظر تغطية النواتج – أضف مفردة أو اذكر السبب.', 'راجع مستوى بلوم لكل مفردة.'],
      legend: 'تصنيف المفردة: الاختيار من متعدد والصح/الخطأ والمزاوجة = موضوعي؛ الإجابة القصيرة والمطولة والكتابة = مقالي. الأرقام الزرقاء قيم مستهدفة يمكن تعديلها.',
      untagged: 'غير مصنّف',
    },
  };
  const LOGO = path.join(__dirname, '..', 'public', 'img', 'ministry_logo.png');
  const q = (name) => `'${name.replace(/'/g, "''")}'`;
  const strLit = (s) => '"' + String(s).replace(/"/g, '""') + '"';
  const sideAlign = (t) => ({ horizontal: t.dir ? 'right' : 'left', vertical: 'middle', wrapText: true });

  // Row height that fits wrapped text (Excel does not auto-fit wrapped/merged cells).
  function textHeight(text, width, size) {
    const per = Math.max(4, Math.floor((width || 10) * (size <= 9 ? 1.2 : 1.05)));
    const lines = String(text == null ? '' : text).split('\n').reduce((n, p) => n + Math.max(1, Math.ceil(p.length / per)), 0);
    return lines * (size <= 9 ? 12 : 13.5) + 8;
  }
  function colW(ws, c) { return ws.getColumn(c).width || 10; }
  function fitRow(ws, r, size, minH) {
    let h = minH || 20;
    ws.getRow(r).eachCell({ includeEmpty: false }, (cell, c) => {
      if (cell.isMerged && cell.master !== cell) return;
      const v = cell.value; if (v == null || typeof v === 'object') return;
      let w = colW(ws, c);
      if (cell.isMerged) { let cc = c + 1; while (cc <= 30 && ws.getCell(r, cc).isMerged && ws.getCell(r, cc).master === cell) { w += colW(ws, cc); cc++; } }
      h = Math.max(h, textHeight(v, w, size));
    });
    ws.getRow(r).height = Math.min(h, 400);
  }
  function note(ws, r, lastCol, text) {
    ws.mergeCells(`A${r}:${lastCol}${r}`); const c = ws.getCell(`A${r}`); c.value = text;
    c.font = font({ size: 8, italic: true, color: { argb: 'FF595959' } }); c.alignment = { wrapText: true, vertical: 'top' };
    let w = 0; for (let k = 1; k <= ws.getColumn(lastCol).number; k++) w += colW(ws, k);
    ws.getRow(r).height = textHeight(text, w, 8);
  }
  function headerCells(ws, refs) { for (const ref of refs) { const x = ws.getCell(ref); x.font = font({ bold: true, color: { argb: 'FFFFFFFF' } }); x.fill = fill('1F3864'); x.alignment = CENTER; x.border = BORDER; } }
  function boxRange(ws, r1, c1, r2, c2, o = {}) {
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
      const x = ws.getCell(r, c); x.border = BORDER; x.alignment = o.align || CENTER; x.font = font({ bold: !!o.bold, size: o.size || 10 });
      if (o.fill) x.fill = fill(o.fill);
    }
  }
  function titleBlock(ws, m, text, sub, lastCol) {
    ws.mergeCells(`A1:${lastCol}1`); ws.getCell('A1').value = m.st.school || ''; ws.getCell('A1').font = font({ size: 9, color: { argb: 'FF595959' } });
    ws.mergeCells(`A2:${lastCol}2`); ws.getCell('A2').value = text; ws.getCell('A2').font = font({ bold: true, size: 16, color: { argb: NAVY } });
    ws.mergeCells(`A3:${lastCol}3`); ws.getCell('A3').value = sub; ws.getCell('A3').font = font({ size: 10, italic: true, color: { argb: 'FF595959' } });
    ws.getCell('A3').alignment = { wrapText: true, vertical: 'top' };
    ws.getRow(2).height = 28;
  }
  function cf(ws, ref, first) {
    ws.addConditionalFormatting({ ref, rules: [
      { type: 'expression', formulae: [`LEFT(${first},1)="⚠"`], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFEB9C' } } } },
      { type: 'expression', formulae: [`LEFT(${first},1)="✅"`], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFC6EFCE' } } } }] });
  }
  function addLogo(wb, ws, col, row, w, h) {
    try { if (fs.existsSync(LOGO)) { const id = wb.addImage({ filename: LOGO, extension: 'png' }); ws.addImage(id, { tl: { col, row }, ext: { width: w, height: h } }); } } catch (e) { /* no logo */ }
  }

  function moeSheet(wb, m, name) {
    const t = T[m.lang];
    const ws = wb.addWorksheet(name, { views: [{ rightToLeft: t.dir, showGridLines: false, state: 'frozen', ySplit: 6 }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 } });
    [16, 58, 26, 11, 9, 13, 16, 16, 16, 17].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    ws.mergeCells('A1:J1'); ws.getCell('A1').value = m.st.school || ''; ws.getCell('A1').font = font({ bold: true }); ws.getRow(1).height = 46;
    ws.getCell('A1').alignment = { vertical: 'middle', horizontal: t.dir ? 'right' : 'left' };
    addLogo(wb, ws, 3.2, 0.1, 150, 44);
    ws.mergeCells('A2:J2'); ws.getCell('A2').value = t.moeTitle(m); ws.getCell('A2').font = font({ bold: true, size: 15, color: { argb: NAVY } });
    ws.getCell('A2').alignment = CENTER; ws.getCell('A2').fill = fill('FFFFCC'); ws.getRow(2).height = 30;
    const info = t.info(m);
    [['A3', info[0]], ['B3', info[1]], ['C3', info[2]], ['D3:G3', info[3]], ['H3:J3', info[4]]].forEach(([ref, v]) => {
      if (ref.includes(':')) ws.mergeCells(ref);
      const c = ws.getCell(ref.split(':')[0]); c.value = v; c.font = font({ bold: true }); c.alignment = CENTER;
    });
    ws.getCell('C3').fill = fill('FFFF00');
    for (let c = 1; c <= 10; c++) ws.getCell(3, c).border = BORDER;
    t.cols.forEach((h, i) => {
      const col = 'ABCDEFGHIJ'[i];
      if ('GHI'.includes(col)) ws.getCell(`${col}6`).value = h; else { ws.mergeCells(`${col}5:${col}6`); ws.getCell(`${col}5`).value = h; }
    });
    ws.mergeCells('G5:I5'); ws.getCell('G5').value = t.bloomHdr;
    for (const r of [5, 6]) for (let c = 1; c <= 10; c++) { const x = ws.getCell(r, c); x.font = font({ bold: true, color: { argb: NAVY } }); x.alignment = CENTER; x.fill = fill('F2F2F2'); x.border = BORDER; }
    ws.getRow(5).height = 30; ws.getRow(6).height = 40;
    const first = 7; let r = first;
    const totalRow = first + m.items.length;
    m.skills.forEach((sk, si) => {
      const its = m.items.filter((i) => i.skill === sk);
      const start = r; const color = PAL[si % PAL.length];
      let g0 = r, prev = null;
      const flush = (endRow, it) => {
        if (endRow > g0) { ws.mergeCells(`B${g0}:B${endRow}`); ws.mergeCells(`C${g0}:C${endRow}`); }
        ws.getCell(`B${g0}`).value = it.outcome || ''; ws.getCell(`C${g0}`).value = it.unit || '';
      };
      its.forEach((it, k) => {
        const key = it.outcomeCode || it.outcome;
        if (k > 0 && key !== prev) { flush(r - 1, its[k - 1]); g0 = r; }
        prev = key;
        ws.getCell(`E${r}`).value = it.no;
        ws.getCell(`F${r}`).value = it.objective ? t.type.o : t.type.e;
        const bc = { recall: 'G', application: 'H', higher: 'I' }[it.bloom];
        if (bc) ws.getCell(`${bc}${r}`).value = it.marks;
        ws.getCell(`J${r}`).value = t.diff[it.difficulty] || '';
        for (let c = 1; c <= 10; c++) { const x = ws.getCell(r, c); x.border = BORDER; x.alignment = CENTER; x.font = font({ bold: [5, 7, 8, 9, 10].includes(c) }); x.fill = fill(color); }
        ws.getRow(r).height = 22; r++;
      });
      flush(r - 1, its[its.length - 1]);
      // make each outcome group tall enough for its text
      { let g = start; while (g < r) { let e2 = g; const key = (m.items.find((x) => x.no === String(ws.getCell(`E${g}`).value)) || {});
          const k0 = key.outcomeCode || key.outcome;
          while (e2 + 1 < r) { const nx = m.items.find((x) => x.no === String(ws.getCell(`E${e2 + 1}`).value)) || {}; if ((nx.outcomeCode || nx.outcome) !== k0) break; e2++; }
          const need = Math.max(textHeight(key.outcome, 58, 10), textHeight(key.unit, 26, 10), textHeight(sk, 16, 10) / (r - start));
          const per = Math.max(22, Math.ceil(need / (e2 - g + 1)));
          for (let rr = g; rr <= e2; rr++) ws.getRow(rr).height = per;
          g = e2 + 1; } }
      const end = r - 1;
      if (end > start) { ws.mergeCells(`A${start}:A${end}`); ws.mergeCells(`D${start}:D${end}`); }
      ws.getCell(`A${start}`).value = sk; ws.getCell(`A${start}`).font = font({ bold: true });
      ws.getCell(`D${start}`).value = { formula: `IFERROR(SUM(G${start}:I${end})/$J$${totalRow},0)` }; ws.getCell(`D${start}`).numFmt = '0%';
      ws.getCell(`D${start}`).font = font({ bold: true, size: 11 });
    });
    const tr = totalRow;
    ws.getCell(`A${tr}`).value = t.total;
    ws.getCell(`D${tr}`).value = { formula: `SUM(D${first}:D${Math.max(first, tr - 1)})` }; ws.getCell(`D${tr}`).numFmt = '0%';
    for (const c of 'GHI') ws.getCell(`${c}${tr}`).value = { formula: `SUM(${c}${first}:${c}${Math.max(first, tr - 1)})` };
    ws.getCell(`J${tr}`).value = { formula: `SUM(G${tr}:I${tr})` };
    for (let c = 1; c <= 10; c++) { const x = ws.getCell(tr, c); x.border = BORDER; x.alignment = CENTER; x.font = font({ bold: true, size: 11, color: { argb: 'FFC00000' } }); if (c === 2 || c === 3) x.fill = fill('FFC000'); }
    ws.getRow(tr).height = 24;
    note(ws, tr + 2, 'J', t.legend);
    fitRow(ws, 3, 10, 22);
    ws.pageSetup.printTitlesRow = '5:6';
    return ws;
  }

  function fullWorkbook(wb, m) {
    const t = T[m.lang];
    const SN = t.sheets;
    // Summary is created first so it is the first tab.
    const sm = wb.addWorksheet(SN.sum, { views: [{ rightToLeft: t.dir, showGridLines: false }], pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 1, paperSize: 9 } });
    const sp = wb.addWorksheet(SN.spec, { views: [{ rightToLeft: t.dir, showGridLines: false, state: 'frozen', xSplit: 2, ySplit: 5 }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 } });
    const oc = wb.addWorksheet(SN.cov, { views: [{ rightToLeft: t.dir, showGridLines: false, state: 'frozen', ySplit: 5 }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 } });
    const ck = wb.addWorksheet(SN.chk, { views: [{ rightToLeft: t.dir, showGridLines: false }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1, paperSize: 9 } });

    // ---- Specification
    titleBlock(sp, m, t.specTitle, t.moeTitle(m), 'Q');
    [8, 18, 13, 50, 26, 11, 40, 16, 11, 22, 8, 15, 15, 15, 13, 12, 22].forEach((w, i) => { sp.getColumn(i + 1).width = w; });
    t.specCols.forEach((h, i) => { sp.getCell(5, i + 1).value = h; });
    headerCells(sp, t.specCols.map((_, i) => sp.getCell(5, i + 1).address)); sp.getRow(5).height = 34;
    const r0 = 6; let r = r0;
    const colorOf = (s) => PAL[m.skills.indexOf(s) % PAL.length];
    for (const it of m.items) {
      const vals = [it.no, it.skill, it.outcomeCode, it.outcome, it.unit, it.weeks, it.preview, it.format, it.objective ? t.type.o : t.type.e,
        t.bloom[it.bloom] || '', it.marks,
        { formula: `IF(J${r}=${strLit(t.bloom.recall)},K${r},0)` }, { formula: `IF(J${r}=${strLit(t.bloom.application)},K${r},0)` }, { formula: `IF(J${r}=${strLit(t.bloom.higher)},K${r},0)` },
        t.diff[it.difficulty] || '', t.tagged[it.tagged] || '—', null];
      vals.forEach((v, i) => {
        const c = sp.getCell(r, i + 1); c.value = v; c.border = BORDER;
        c.font = font({ size: 9, bold: i === 0, italic: i === 6, color: i === 6 ? { argb: 'FF595959' } : undefined });
        c.alignment = [3, 4, 6, 16].includes(i) ? sideAlign(t) : CENTER;
      });
      sp.getCell(r, 2).fill = fill(colorOf(it.skill));
      fitRow(sp, r, 9, 24); r++;
    }
    const rl = Math.max(r0, r - 1), tr = r;
    sp.getCell(`A${tr}`).value = t.total;
    for (const c of 'KLMN') sp.getCell(`${c}${tr}`).value = { formula: `SUM(${c}${r0}:${c}${rl})` };
    boxRange(sp, tr, 1, tr, 17, { bold: true, fill: 'FFF2CC' });
    const dvList = (col, opts) => { for (let rr = r0; rr <= rl; rr++) sp.getCell(`${col}${rr}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"' + opts.join(',') + '"'] }; };
    dvList('J', Object.values(t.bloom)); dvList('O', Object.values(t.diff)); dvList('I', Object.values(t.type));
    sp.addConditionalFormatting({ ref: `O${r0}:O${rl}`, rules: [
      { type: 'cellIs', operator: 'equal', formulae: [strLit(t.diff.hard)], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFF8CBAD' } } } },
      { type: 'cellIs', operator: 'equal', formulae: [strLit(t.diff.medium)], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFEB9C' } } } },
      { type: 'cellIs', operator: 'equal', formulae: [strLit(t.diff.easy)], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFC6EFCE' } } } }] });
    sp.autoFilter = { from: { row: 5, column: 1 }, to: { row: rl, column: 17 } };
    note(sp, tr + 2, 'Q', t.legend); fitRow(sp, 5, 10, 34);
    const SPR = (c) => `${q(SN.spec)}!$${c}$${r0}:$${c}$${rl}`;

    // ---- Summary
    titleBlock(sm, m, t.sumTitle, t.moeTitle(m), 'I');
    [30, 16, 16, 16, 12, 12, 12, 3, 24].forEach((w, i) => { sm.getColumn(i + 1).width = w; });
    addLogo(wb, sm, 8, 4, 130, 38);
    t.infoRows(m).forEach(([k, v], i) => {
      const rr = 5 + i; sm.getCell(`A${rr}`).value = k; sm.mergeCells(`B${rr}:G${rr}`); sm.getCell(`B${rr}`).value = v;
      sm.getCell(`A${rr}`).font = font({ bold: true, color: { argb: NAVY } }); sm.getCell(`A${rr}`).fill = fill('DDEBF7'); sm.getCell(`B${rr}`).font = font();
      sm.getCell(`A${rr}`).alignment = { vertical: 'middle', wrapText: true }; sm.getCell(`B${rr}`).alignment = { vertical: 'middle', wrapText: true, horizontal: t.dir ? 'right' : 'left' };
      fitRow(sm, rr, 10, 20);
    });
    const nChecks = t.checks.length;
    const tiles = [
      { formula: `SUM(${SPR('K')})`, fmt: '0' }, { formula: `COUNTA(${SPR('A')})`, fmt: '0' },
      { formula: `IFERROR(SUM(${SPR('N')})/SUM(${SPR('K')}),0)`, fmt: '0%' },
      { formula: `IFERROR(SUMIFS(${SPR('K')},${SPR('I')},${strLit(t.type.e)})/SUM(${SPR('K')}),0)`, fmt: '0%' },
      { formula: `COUNTIF(${q(SN.chk)}!$D$6:$D$${5 + nChecks},"✅*")&" / "&${nChecks}`, fmt: '@' }];
    tiles.forEach((tl, i) => {
      const col = 'ABCDE'[i];
      sm.getCell(`${col}11`).value = t.tiles[i]; sm.getCell(`${col}12`).value = { formula: tl.formula }; sm.getCell(`${col}12`).numFmt = tl.fmt;
      sm.getCell(`${col}11`).font = font({ size: 9, color: { argb: 'FF595959' } }); sm.getCell(`${col}11`).alignment = CENTER;
      sm.getCell(`${col}12`).font = font({ size: 18, bold: true, color: { argb: NAVY } }); sm.getCell(`${col}12`).alignment = CENTER;
      for (const rr of [11, 12]) { sm.getCell(`${col}${rr}`).fill = fill('F2F2F2'); sm.getCell(`${col}${rr}`).border = BORDER; }
    });
    sm.getRow(12).height = 34; fitRow(sm, 11, 9, 24);
    let s = 14;
    sm.mergeCells(`A${s}:I${s}`); sm.getCell(`A${s}`).value = t.s1; sm.getCell(`A${s}`).font = font({ bold: true, size: 12, color: { argb: NAVY } }); sm.getRow(s).height = 22;
    s++;
    t.bpCols.forEach((h, i) => { sm.getCell(s, i < 7 ? i + 1 : 9).value = h; });
    headerCells(sm, ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'I'].map((c) => `${c}${s}`)); sm.getRow(s).height = 30;
    const b0 = s + 1, btot = b0 + m.skills.length;
    m.skills.forEach((sk, i) => {
      const rr = b0 + i;
      sm.getCell(`A${rr}`).value = sk;
      ['B', 'C', 'D'].forEach((c, k) => { sm.getCell(`${c}${rr}`).value = { formula: `SUMIFS(${SPR('LMN'[k])},${SPR('B')},$A${rr})` }; });
      sm.getCell(`E${rr}`).value = { formula: `SUM(B${rr}:D${rr})` };
      sm.getCell(`F${rr}`).value = { formula: `IFERROR(E${rr}/$E$${btot},0)` };
      const tg = m.st.targets[sk];
      sm.getCell(`G${rr}`).value = tg == null ? null : tg / 100;
      sm.getCell(`I${rr}`).value = { formula: `IF(G${rr}="",${strLit(t.dash)},IF(ABS(F${rr}-G${rr})<=0.01,${strLit(t.onT)},IF(F${rr}>G${rr},${strLit(t.over)},${strLit(t.under)})&TEXT(ABS(F${rr}-G${rr}),"0%")))` };
      boxRange(sm, rr, 1, rr, 7); boxRange(sm, rr, 9, rr, 9);
      sm.getCell(`A${rr}`).alignment = sideAlign(t); sm.getCell(`A${rr}`).fill = fill(PAL[i % PAL.length]);
      sm.getCell(`F${rr}`).numFmt = '0%'; sm.getCell(`G${rr}`).numFmt = '0%'; sm.getCell(`G${rr}`).font = font({ color: { argb: 'FF0000FF' } });
      fitRow(sm, rr, 10, 20);
    });
    sm.getCell(`A${btot}`).value = t.total;
    for (const c of 'BCDEF') sm.getCell(`${c}${btot}`).value = { formula: `SUM(${c}${b0}:${c}${Math.max(b0, btot - 1)})` };
    sm.getCell(`G${btot}`).value = { formula: `IF(COUNT(G${b0}:G${Math.max(b0, btot - 1)})=0,"",SUM(G${b0}:G${Math.max(b0, btot - 1)}))` };
    boxRange(sm, btot, 1, btot, 7, { bold: true, fill: 'FFF2CC' }); sm.getCell(`F${btot}`).numFmt = '0%'; sm.getCell(`G${btot}`).numFmt = '0%';
    sm.getCell(`A${btot + 1}`).value = t.share;
    for (const c of 'BCD') { sm.getCell(`${c}${btot + 1}`).value = { formula: `IFERROR(${c}${btot}/$E$${btot},0)` }; sm.getCell(`${c}${btot + 1}`).numFmt = '0%'; }
    boxRange(sm, btot + 1, 1, btot + 1, 4, { bold: true, fill: 'F2F2F2' });
    if (m.skills.length) cf(sm, `I${b0}:I${btot - 1}`, `I${b0}`);
    s = btot + 3;
    sm.mergeCells(`A${s}:I${s}`); sm.getCell(`A${s}`).value = t.s2; sm.getCell(`A${s}`).font = font({ bold: true, size: 12, color: { argb: NAVY } }); sm.getRow(s).height = 22;
    s++;
    t.dCols.forEach((h, i) => { sm.getCell(s, i < 5 ? i + 1 : 9).value = h; });
    headerCells(sm, ['A', 'B', 'C', 'D', 'E', 'I'].map((c) => `${c}${s}`));
    const d0 = s + 1;
    const mix = m.level ? MIX[m.level] : null;
    ['easy', 'medium', 'hard'].forEach((lv, k) => {
      const rr = d0 + k;
      sm.getCell(`A${rr}`).value = t.diff[lv];
      sm.getCell(`B${rr}`).value = { formula: `SUMIFS(${SPR('K')},${SPR('O')},A${rr})` };
      sm.getCell(`C${rr}`).value = { formula: `IFERROR(B${rr}/SUM($B$${d0}:$B$${d0 + 2}),0)` };
      sm.getCell(`D${rr}`).value = mix ? mix[lv] : null;
      sm.getCell(`E${rr}`).value = { formula: `IF(D${rr}="","",C${rr}-D${rr})` };
      sm.getCell(`I${rr}`).value = { formula: `IF(D${rr}="",${strLit(t.dash)},IF(ABS(E${rr})<=0.1,${strLit(t.within)},${strLit(t.off)}))` };
      boxRange(sm, rr, 1, rr, 5); boxRange(sm, rr, 9, rr, 9);
      for (const c of 'CDE') sm.getCell(`${c}${rr}`).numFmt = '0%;-0%;0%';
      sm.getCell(`D${rr}`).font = font({ color: { argb: 'FF0000FF' } });
    });
    const d1 = d0 + 2;
    sm.addConditionalFormatting({ ref: `C${d0}:C${d1}`, rules: [{ type: 'dataBar', cfvo: [{ type: 'num', value: 0 }, { type: 'num', value: 1 }], color: { argb: 'FF5B9BD5' } }] });
    cf(sm, `I${d0}:I${d1}`, `I${d0}`);
    s = d1 + 2;
    sm.mergeCells(`A${s}:I${s}`); sm.getCell(`A${s}`).value = t.s3; sm.getCell(`A${s}`).font = font({ bold: true, size: 12, color: { argb: NAVY } }); sm.getRow(s).height = 22;
    s++;
    t.tCols.forEach((h, i) => { sm.getCell(s, i + 1).value = h; });
    headerCells(sm, ['A', 'B', 'C', 'D'].map((c) => `${c}${s}`));
    [t.type.o, t.type.e].forEach((lab, k) => {
      const rr = s + 1 + k;
      sm.getCell(`A${rr}`).value = lab; sm.getCell(`B${rr}`).value = { formula: `COUNTIF(${SPR('I')},A${rr})` };
      sm.getCell(`C${rr}`).value = { formula: `SUMIFS(${SPR('K')},${SPR('I')},A${rr})` };
      sm.getCell(`D${rr}`).value = { formula: `IFERROR(C${rr}/SUM(${SPR('K')}),0)` }; sm.getCell(`D${rr}`).numFmt = '0%';
      boxRange(sm, rr, 1, rr, 4);
    });

    // ---- Outcome coverage
    titleBlock(oc, m, t.covTitle, m.cur.source || '', 'H');
    [13, 18, 60, 28, 12, 10, 10, 18].forEach((w, i) => { oc.getColumn(i + 1).width = w; });
    t.covCols.forEach((h, i) => { oc.getCell(5, i + 1).value = h; });
    headerCells(oc, t.covCols.map((_, i) => oc.getCell(5, i + 1).address)); oc.getRow(5).height = 28;
    let orow = 5;
    for (const o of m.coverage) {
      orow++;
      [o.code, o.skill, o.outcome, o.unit, o.weeks].forEach((v, i) => { oc.getCell(orow, i + 1).value = v; });
      oc.getCell(`F${orow}`).value = { formula: `SUMIFS(${SPR('K')},${SPR('C')},A${orow})` };
      oc.getCell(`G${orow}`).value = { formula: `IFERROR(F${orow}/SUM(${SPR('K')}),0)` }; oc.getCell(`G${orow}`).numFmt = '0%';
      oc.getCell(`H${orow}`).value = { formula: `IF(F${orow}=0,${strLit(t.notAssessed)},${strLit(t.assessed)})` };
      boxRange(oc, orow, 1, orow, 8);
      oc.getCell(`C${orow}`).alignment = sideAlign(t); oc.getCell(`D${orow}`).alignment = sideAlign(t); fitRow(oc, orow, 10, 22);
    }
    const ocLast = Math.max(6, orow);
    if (orow > 5) cf(oc, `H6:H${orow}`, 'H6');
    note(oc, ocLast + 2, 'H', t.covNote);

    // ---- Checks
    titleBlock(ck, m, t.chkTitle, t.moeTitle(m), 'E');
    [5, 50, 12, 30, 46].forEach((w, i) => { ck.getColumn(i + 1).width = w; });
    t.chkCols.forEach((h, i) => { ck.getCell(5, i + 1).value = h; });
    headerCells(ck, ['A5', 'B5', 'C5', 'D5', 'E5']);
    const tot = `SUM(${SPR('K')})`;
    const OK = strLit(t.ok);
    const writingCrit = m.lang === 'ar' ? '"*كتاب*"' : '"*Writ*"';
    const bEnd = Math.max(b0, btot - 1);
    const vals = [
      [`${tot}`, (rr) => `IF(C${rr}=100,${OK},"⚠ "&C${rr})`],
      [`SUMPRODUCT((COUNTIF(${SPR('A')},${SPR('A')})>1)*1)`, (rr) => `IF(C${rr}=0,${OK},"⚠ "&C${rr})`],
      [`COUNTBLANK(${SPR('B')})+COUNTBLANK(${SPR('D')})+COUNTBLANK(${SPR('J')})+COUNTBLANK(${SPR('O')})+COUNTIF(${SPR('B')},${strLit(t.untagged)})`, (rr) => `IF(C${rr}=0,${OK},"⚠ "&C${rr})`],
      [`COUNTIFS(${SPR('B')},${writingCrit},${SPR('I')},${strLit(t.type.o)})`, (rr) => `IF(C${rr}=0,${OK},"⚠ "&C${rr})`],
      [`COUNTIF(${q(SN.sum)}!$I$${b0}:$I$${bEnd},"⚠*")`, (rr) => `IF(C${rr}=0,${OK},"⚠ "&C${rr})`],
      [`COUNTIF(${q(SN.sum)}!$I$${d0}:$I$${d1},"⚠*")`, (rr) => `IF(C${rr}=0,${OK},"⚠ "&C${rr})`],
      [`IFERROR(SUM(${SPR('N')})/${tot},0)`, (rr) => `IF(C${rr}>=0.2,${OK},"⚠ "&TEXT(C${rr},"0%"))`],
      [`COUNTIF(${q(SN.cov)}!$H$6:$H$${ocLast},"⚠*")`, (rr) => `IF(C${rr}=0,${OK},"⚠ "&C${rr})`],
      [`SUM(${SPR('L')})+SUM(${SPR('M')})+SUM(${SPR('N')})-${tot}`, (rr) => `IF(C${rr}=0,${OK},"⚠ "&C${rr})`],
    ];
    vals.forEach(([v, res], i) => {
      const rr = 6 + i;
      ck.getCell(`A${rr}`).value = i + 1; ck.getCell(`B${rr}`).value = t.checks[i];
      ck.getCell(`C${rr}`).value = { formula: v }; ck.getCell(`D${rr}`).value = { formula: res(rr) }; ck.getCell(`E${rr}`).value = t.todo[i];
      boxRange(ck, rr, 1, rr, 5);
      for (const c of 'BE') ck.getCell(`${c}${rr}`).alignment = sideAlign(t);
      fitRow(ck, rr, 10, 24);
    });
    ck.getCell('C12').numFmt = '0%';
    cf(ck, `D6:D${5 + nChecks}`, 'D6');
  }

  async function buildXlsx(m, format) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'ClassCurio'; wb.created = new Date();
    wb.calcProperties = { fullCalcOnLoad: true };
    if (format === 'B') fullWorkbook(wb, m);
    moeSheet(wb, m, T[m.lang].sheets.moe);
    return wb.xlsx.writeBuffer();
  }

  // ── Routes (admins only; also allowed while an admin is viewing a teacher) ──
  function isAdmin(req) {
    const u = req.session && req.session.user;
    if (!u) return false;
    if (req.session.ccViewAs && req.session.ccViewAs.admin) return true;
    return ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(String(u.email || '').toLowerCase());
  }
  function load(req, res) {
    if (!isAdmin(req)) { res.status(403).json({ error: 'Admins only.' }); return null; }
    const a = readAll('assessments.json').find((x) => x.id === req.params.id);
    if (!a) { res.status(404).json({ error: 'Assessment not found.' }); return null; }
    return a;
  }
  function teacherName(a) { const u = readAll('users.json').find((x) => x.id === a.teacherId); return u ? u.name : ''; }
  function summary(a, lang) {
    const m = buildModel(a, lang || 'en');
    const missing = m.items.filter((i) => !i.bloom || !i.difficulty || !i.outcome).length;
    const job = JOBS.get(a.id) || { state: 'idle' };
    return {
      settings: m.st, term: m.term, week: m.wk, level: m.level, year: m.year,
      curriculum: m.cur.source ? { source: m.cur.source, outcomes: m.cur.list.length, key: `${m.cur.gk} · Term ${m.cur.term} · ${m.cur.sk}` } : null,
      skills: m.skills.map((s) => ({ skill: s, marks: m.items.filter((i) => i.skill === s).reduce((x, i) => x + i.marks, 0) })),
      items: m.items.length, missing, stale: m.items.filter((i) => i.stale).length,
      warnings: quickChecks(m), job: { state: job.state, done: job.done || 0, total: job.total || 0, error: job.error || null },
      needsStream: parseInt(a.grade, 10) >= 9,
    };
  }
  app.get('/api/admin/spec/:id', (req, res) => {
    const a = load(req, res); if (!a) return;
    res.json(Object.assign({ title: a.title, grade: a.grade, subject: a.subject, teacher: teacherName(a) }, summary(a, req.query.lang)));
  });
  app.post('/api/admin/spec/:id/prepare', (req, res) => {
    const a = load(req, res); if (!a) return;
    const b = req.body || {};
    if (b.settings) saveSettings(a.id, b.settings);
    const m = buildModel(a, 'en');
    const need = !!b.force || m.items.some((i) => !i.bloom || !i.difficulty || !i.outcome || i.stale);
    if (need) tagJob(a.id, !!b.force);
    res.json(summary(a, b.lang));
  });
  app.get('/api/admin/spec/:id/status', (req, res) => {
    const a = load(req, res); if (!a) return;
    res.json(summary(a, req.query.lang));
  });
  app.get('/api/admin/spec/:id/xlsx', async (req, res) => {
    const a = load(req, res); if (!a) return;
    try {
      const lang = req.query.lang === 'ar' ? 'ar' : 'en';
      const format = req.query.format === 'A' ? 'A' : 'B';
      const m = buildModel(a, lang);
      m.teacher = teacherName(a);
      const buf = await buildXlsx(m, format);
      const base = `${format === 'A' ? 'MOE-Specification' : 'Specification-Blueprint'}-${(a.title || 'assessment').replace(/[^\w؀-ۿ -]+/g, '').trim().slice(0, 60) || 'assessment'}-${lang.toUpperCase()}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="specification.xlsx"; filename*=UTF-8''${encodeURIComponent(base)}`);
      res.send(Buffer.from(buf));
    } catch (e) {
      console.error('[spec] xlsx failed:', e);
      res.status(500).json({ error: 'Could not build the file: ' + e.message });
    }
  });
  return { buildModel, buildXlsx, weekOf, curriculumOutcomes, quickChecks, saveSettings, getSettings, tagsFor, upsertTags, tagJob, JOBS };
};
