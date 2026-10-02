// ─────────────────────────────────────────────────────────────────────────────
//  MOE curriculum → AI generation context.
//  Teachers pick grade / stream / term / lessons in the AI panel; the chosen
//  lessons' outcomes (SLOs + KPIs), objectives, focus questions, misconceptions
//  and vocabulary are given to the AI so every question is on-syllabus.
// ─────────────────────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');

let CUR = {};
function load() {
  try { CUR = JSON.parse(fs.readFileSync(path.join(__dirname, 'curriculum', 'moe-curriculum.json'), 'utf8')); }
  catch (e) { console.warn('[curriculum] not loaded:', e.message); CUR = {}; }
}
load();

const SUBJ = { Math: 'Maths', Maths: 'Maths', English: 'English', Science: 'Science', Physics: 'Physics', Chemistry: 'Chemistry', Biology: 'Biology', 'AI & Technology': 'AI & Technology' };
function gradeKey(grade, stream) {
  const g = parseInt(grade, 10);
  if (!g) return null;
  return g >= 9 ? String(g) + (stream === 'G' ? 'G' : 'A') : String(g);
}
function entry(subject, grade, stream, term) {
  const gk = gradeKey(grade, stream), sk = SUBJ[subject];
  if (!gk || !sk || !CUR[gk] || !CUR[gk][String(term)]) return null;
  return CUR[gk][String(term)][sk] || null;
}
// Lessons a teacher can pick. Entries without a lesson list fall back to strands.
function lessonsOf(e) {
  if (!e) return [];
  if (Array.isArray(e.lessons) && e.lessons.length) {
    return e.lessons.map((l, i) => ({ key: l.code || `L${i + 1}`, ...l }));
  }
  return Object.entries(e.strands || {}).map(([strand, outs], i) => ({ key: `S${i + 1}`, module: strand, lesson: strand, outcomes: outs, type: 'core' }));
}
function options({ subject, grade, stream, term }) {
  const e = entry(subject, grade, stream, term);
  const list = lessonsOf(e).map((l) => ({
    key: l.key, module: l.module || l.unit || '', lesson: l.lesson || '', weeks: l.weeks || '', type: l.type || 'core',
    outcomes: Array.isArray(l.slos) ? l.slos.length : (Array.isArray(l.outcomes) ? l.outcomes.length : 0),
  }));
  return { available: !!e, source: e ? e.source || '' : '', lessons: list };
}
function contextFor({ subject, grade, stream, term, keys }) {
  const e = entry(subject, grade, stream, term);
  if (!e) return '';
  const pick = new Set(Array.isArray(keys) ? keys : []);
  const chosen = lessonsOf(e).filter((l) => !pick.size || pick.has(l.key));
  if (!chosen.length) return '';
  const out = [];
  out.push(`=== MOE CURRICULUM — ${subject}, Grade ${grade}${stream ? (stream === 'G' ? ' General' : ' Advanced') : ''}, Term ${term} ===`);
  out.push(`Source: ${e.source || 'MOE curriculum'}`);
  for (const l of chosen) {
    out.push('');
    out.push(`LESSON ${l.key}: ${l.lesson}${l.module ? ` (${l.module})` : ''}${l.weeks ? ` — ${l.weeks}` : ''}${l.type === 'enrichment' ? ' [enrichment]' : ''}`);
    if (l.objectives) out.push(`  Lesson objectives: ${l.objectives}`);
    if (l.focusQuestion) out.push(`  Focus question: ${l.focusQuestion}`);
    if (Array.isArray(l.slos) && l.slos.length) {
      for (const s of l.slos) {
        out.push(`  OUTCOME ${s.code}${s.priority ? ` [${s.priority}]` : ''}: ${s.text}`);
        for (const k of s.kpis || []) out.push(`    - KPI: ${k}`);
      }
    }
    if (Array.isArray(l.outcomes)) for (const o of l.outcomes) out.push(`  OUTCOME: ${o}`);
    if (Array.isArray(l.misconceptions) && l.misconceptions.length) out.push(`  Common misconceptions: ${l.misconceptions.join(' | ')}`);
    if (Array.isArray(l.vocabulary) && l.vocabulary.length) out.push(`  Key vocabulary: ${l.vocabulary.join(', ')}`);
    if (l.note) out.push(`  Note: ${l.note}`);
  }
  const fw = CUR.__science_framework;
  const isSci = ['Science', 'Physics', 'Chemistry', 'Biology'].includes(subject);
  const isTech = subject === 'AI & Technology';
  out.push('');
  out.push('CURRICULUM RULES:');
  out.push('- Every question must assess one of the OUTCOMES / KPIs listed above — nothing outside these lessons.');
  out.push('- Set each question\'s "skill" to the outcome it assesses: the outcome code followed by a short name, e.g. "BIO.3.1.02.021 Enzymes as catalysts" (if there is no code, use a short outcome name).');
  out.push('- Spread questions across the chosen lessons and KPIs; enrichment lessons only lightly.');
  if (chosen.some((l) => (l.slos || []).some((s) => /power/i.test(s.priority || '')))) out.push('- Give about 60–80% of the marks to Power outcomes and 20–40% to Support outcomes.');
  out.push('- Use the common misconceptions as tempting wrong options (distractors) in multiple-choice questions.');
  out.push('- Use the key vocabulary accurately; some questions may test the vocabulary in context.');
  if (isSci && fw) {
    out.push(`- Science: include some questions that use science and engineering practices (${fw.sep.join('; ')}), e.g. interpreting data, a model or diagram, or an investigation's variables.`);
  }
  const guide = (CUR.__assessment_guides || {})[subject];
  if (guide && Array.isArray(guide.rules)) { out.push(`- From the ${guide.source}:`); for (const r of guide.rules) out.push(`  • ${r}`); }
  if (isSci && fw && fw.threeDimensional) out.push('- ' + fw.threeDimensional);
  if (isTech) out.push('- AI & Technology: include practical items where they fit — reading or predicting the output of short code/pseudocode, spotting a bug, choosing the right algorithm or component, interpreting a CAD/technical drawing description, and scenario questions on AI ethics, data and e-safety.');
  return out.join('\n');
}
module.exports = { load, options, contextFor, gradeKey };
