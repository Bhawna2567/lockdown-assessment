// AI auto-grader for "writing" question type. Calls the Claude (Anthropic)
// API with the chosen rubric stage and the student's essay, then parses a
// strict JSON response into per-criterion scores + feedback.
//
// Set ANTHROPIC_API_KEY in the environment (or in `data/config.json`) to
// enable this. If the key is missing, gradeWriting() returns
// { ok:false, reason:'no-api-key' } and the calling code should fall back
// to the manual essay queue.

const fs = require('fs');
const path = require('path');
const { getRubric, rubricAsText } = require('./rubrics');

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'config.json');

function readApiKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY.trim();
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      if (cfg && cfg.anthropicApiKey) return String(cfg.anthropicApiKey).trim();
    }
  } catch {}
  return '';
}

function buildPrompt(rubric, prompt, essay) {
  // Generate the JSON shape dynamically from whatever criteria + score range
  // the chosen rubric defines. Old rubrics (Stage 7/8): 4 criteria × 1-3.
  // New rubrics (Stage 3-5, 5-9): 5 criteria × 0-8.
  const lo = rubric.scoreMin != null ? rubric.scoreMin : 1;
  const wordCount = String(essay || '').trim().split(/\s+/).filter(Boolean).length;

  // Build the JSON shape Claude must return.
  const criteriaJsonLines = rubric.criteria.map((c, i) => {
    const sep = i < rubric.criteria.length - 1 ? ',' : '';
    return `    "${c.id}": { "score": <integer ${lo}-${c.max}>, "comment": "<one to two sentences explaining the score in plain English>" }${sep}`;
  });

  // Concrete worked examples calibrate the model. Without these Claude has
  // been observed returning the minimum score on every criterion regardless
  // of essay quality — see the issue log.
  const isShortScale = (rubric.scoreMin == null); // Stage 7/8 (1-3 scale)
  const examples = isShortScale
    ? [
        `EXAMPLE A — A 5-word answer like "I like my friends very much" should score around 1 per criterion (about 4/12 total) — barely touches the prompt.`,
        `EXAMPLE B — A 150-word paragraph that addresses the prompt, has a clear opening and closing, uses varied vocabulary, with only minor grammar slips, should score 2 per criterion (about 8/12 total).`,
        `EXAMPLE C — A 300-word fully-developed response that covers every part of the prompt with reasons, examples, varied sentence types, accurate punctuation, and rich vocabulary should score 3 per criterion (12/12 total).`,
      ]
    : [
        `EXAMPLE A — A 5-word answer like "I like my school." should score 1 per criterion (5/40 total) — barely an attempt.`,
        `EXAMPLE B — A short paragraph (60-100 words) addressing only part of the prompt with simple grammar and common vocabulary scores around 3-4 per criterion (15-20/40 total).`,
        `EXAMPLE C — A complete, well-structured 200+ word essay covering every aspect of the prompt with varied grammar, sophisticated vocabulary, and accurate spelling/punctuation scores 7-8 per criterion (35-40/40 total).`,
      ];

  // The HARD rule that fixes "everyone gets 4" — short essays must get LOW
  // scores explicitly. We tell Claude up front.
  const shortRule = isShortScale
    ? `CRITICAL: Essays under 20 words MUST score 1 on every criterion. Essays that are completely off-topic or empty MUST score 1 on every criterion. Do NOT default to the minimum for an honest attempt; only give 1 when the work truly fails the descriptor.`
    : `CRITICAL: Essays under 20 words MUST score 0-1 on every criterion. Essays that are completely off-topic or empty MUST score 0 on every criterion. Do NOT default to the minimum for an honest attempt; reserve 0-2 scores for genuinely failing work.`;

  return [
    `You are an experienced writing teacher grading a single student's essay against a published rubric.`,
    `Your scores MUST reflect the actual quality and length of the response below — different essays MUST receive different scores. A one-word essay must score very differently from a 200-word paragraph.`,
    ``,
    `=== RUBRIC ===`,
    rubricAsText(rubric),
    ``,
    `=== HOW TO CALIBRATE YOUR SCORES ===`,
    ...examples,
    ``,
    shortRule,
    ``,
    `=== ASSIGNMENT PROMPT ===`,
    prompt || '(no specific prompt — score on overall writing quality)',
    ``,
    `=== STUDENT ESSAY (word count: ${wordCount}) ===`,
    essay,
    ``,
    `=== YOUR TASK ===`,
    `Look at the essay carefully. Count the words. Compare it to the rubric bands and to EXAMPLE A/B/C above. Choose the score for each criterion that fits this specific response. Then return ONLY valid JSON in exactly this shape, with no surrounding prose, no markdown fences:`,
    `{`,
    `  "criteria": {`,
    ...criteriaJsonLines,
    `  },`,
    `  "overallFeedback": "<two to four sentences combining strengths and one or two improvement targets, written directly to the student>"`,
    `}`,
    ``,
    `Use the EXACT criterion id strings shown above ('${rubric.criteria.map(c => c.id).join("', '")}'). Do not rename them. Do not capitalise them. Do not translate them.`,
  ].join('\n');
}

function safeParseJson(text) {
  if (!text) return null;
  // Strip markdown code fences if the model adds any.
  const cleaned = text
    .replace(/^```(?:json)?/i, '')
    .replace(/```\s*$/, '')
    .trim();
  try { return JSON.parse(cleaned); } catch {}
  // Try to find the first {...} block as a fallback.
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch {}
  }
  return null;
}

async function callClaude({ apiKey, prompt }) {
  // Uses native fetch (Node 18+).
  
const _ccCfgPath = require('path').join(__dirname, '..', 'data', 'config.json');
function _ccReadCfg() { try { return JSON.parse(require('fs').readFileSync(_ccCfgPath, 'utf8')); } catch { return {}; } }
function _ccWriteCfg(c) { try { require('fs').writeFileSync(_ccCfgPath, JSON.stringify(c, null, 2)); } catch {} }
function _ccFlag(status, text) {
  const lower = String(text || '').toLowerCase();
  const isCredit = status === 402 || status === 401 ||
    lower.includes('credit balance') || lower.includes('insufficient_quota') ||
    lower.includes('billing') || lower.includes('payment required') ||
    lower.includes('over your monthly limit');
  if (isCredit) {
    const c = _ccReadCfg();
    c.apiCreditWarning = { status: Number(status) || 0, message: String(text || '').slice(0, 400), detectedAt: new Date().toISOString() };
    _ccWriteCfg(c);
  } else if (status >= 200 && status < 300) {
    const c = _ccReadCfg();
    if (c.apiCreditWarning) { delete c.apiCreditWarning; _ccWriteCfg(c); }
  }
}

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  try { const _txt = await res.clone().text(); _ccFlag(res.status, _txt); } catch {}
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Claude API error ${res.status}: ${txt.slice(0, 300)}`);
  }
  const data = await res.json();
  // Extract the text content.
  const out = (data.content || [])
    .map((b) => (b && b.type === 'text' ? b.text : ''))
    .join('')
    .trim();
  return out;
}

async function gradeWriting({ rubricStage, prompt, essay, maxScore = 40 }) {
  const apiKey = readApiKey();
  if (!apiKey) {
    return { ok: false, reason: 'no-api-key' };
  }
  const rubric = getRubric(rubricStage);
  if (!rubric) {
    return { ok: false, reason: 'no-rubric', detail: `Unknown rubric stage "${rubricStage}"` };
  }
  const text = String(essay || '').trim();
  if (!text) {
    return { ok: false, reason: 'empty-essay' };
  }

  const userPrompt = buildPrompt(rubric, prompt, text);

  let raw;
  try {
    raw = await callClaude({ apiKey, prompt: userPrompt });
  } catch (e) {
    return { ok: false, reason: 'api-error', detail: e.message };
  }

  const parsed = safeParseJson(raw);
  if (!parsed || !parsed.criteria) {
    return { ok: false, reason: 'parse-error', detail: raw.slice(0, 200) };
  }

  // Normalise — clamp scores to the rubric's allowed range.
  // Old rubrics: 1..3. New rubrics: scoreMin..scoreMax (0..8).
  const lo = rubric.scoreMin != null ? rubric.scoreMin : 1;

  // Word count guard: if Claude (or our prompt) failed to be strict on very
  // short essays, force them into the bottom band server-side. Prevents the
  // "every student gets 4" symptom on one-word submissions.
  const wordCount = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  const veryShort = wordCount < 20;

  // Build a tolerant index of the parsed.criteria object: keys are normalised
  // to lower-case-no-punctuation so 'Content', 'content', 'content_score',
  // 'CONTENT' all collide on the same slot. We also stash a normalised-name
  // index so a model that returned 'vocabulary' will match the lexis or
  // vocabulary criterion regardless of the exact id we asked for.
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const criteriaByNormKey = {};
  for (const [k, v] of Object.entries(parsed.criteria || {})) {
    criteriaByNormKey[norm(k)] = v;
  }
  const synonyms = {
    lexis: ['vocabulary', 'vocab', 'wordchoice', 'diction'],
    organisation: ['organization', 'structure', 'cohesion', 'coherence'],
    content: ['ideas', 'taskcompletion', 'taskachievement', 'task'],
    grammar: ['grammaticalrangeandaccuracy', 'syntax', 'language'],
    spelling_punctuation: ['spellingpunctuation', 'spellingandpunctuation', 'mechanics', 'punctuation', 'spelling'],
    task_completion: ['taskcompletion', 'task', 'content', 'ideas', 'taskachievement'],
    structure: ['organisation', 'organization', 'cohesion', 'coherence'],
    vocabulary: ['lexis', 'vocab', 'wordchoice', 'diction'],
  };

  const findItemForCriterion = (c) => {
    const candidates = [
      c.id,                                  // exact id ('content')
      norm(c.id),                            // normalised id ('content')
      norm(c.name),                          // normalised name ('contenttaskachievement')
      ...(synonyms[c.id] || []),             // common synonyms
    ];
    for (const cand of candidates) {
      const k = norm(cand);
      if (criteriaByNormKey[k]) return criteriaByNormKey[k];
    }
    return null;
  };

  const breakdown = {};
  let total = 0;
  let matchedAny = false;
  for (const c of rubric.criteria) {
    const item = findItemForCriterion(c);
    if (item) matchedAny = true;
    const rawScore = item ? Number(item.score) : NaN;
    let s = Number.isFinite(rawScore)
      ? Math.max(lo, Math.min(c.max, Math.round(rawScore)))
      : lo;
    // Safety net for very short essays — never award more than the bottom
    // band, no matter what Claude returned.
    if (veryShort) {
      const bottomBand = Math.max(lo, Math.min(c.max, lo === 0 ? 1 : 1));
      s = Math.min(s, bottomBand);
    }
    breakdown[c.id] = {
      name: c.name,
      score: s,
      max: c.max,
      comment: String((item && item.comment) || (veryShort ? 'Essay is too short to demonstrate this criterion.' : '')).trim(),
    };
    total += s;
  }

  // If NOTHING in Claude's response matched our criteria IDs, that's a real
  // bug — return parse-error so the teacher manually grades, instead of
  // silently returning the minimum score.
  if (!matchedAny && !veryShort) {
    console.error('[grader] criteria mismatch — Claude returned keys:', Object.keys(parsed.criteria || {}), 'expected:', rubric.criteria.map(c => c.id));
    return { ok: false, reason: 'criteria-mismatch', detail: 'AI response keys did not match the rubric.' };
  }

  const feedbackParts = [];
  for (const c of rubric.criteria) {
    const b = breakdown[c.id];
    feedbackParts.push(`${c.name}: ${b.score}/${b.max} — ${b.comment}`);
  }
  if (parsed.overallFeedback) {
    feedbackParts.push('');
    feedbackParts.push(`Overall: ${String(parsed.overallFeedback).trim()}`);
  }

  // Normalise to a universal 40-mark scale regardless of which rubric
  // stage the teacher chose. Stage 3-5 / 5-9 already use totalMax=40
  // (so this is a no-op). Stage 7 / 8 use totalMax=12 internally — we
  // scale linearly so a 9/12 raw becomes 30/40.
  const TARGET_MAX = 40;
  const scaledScore = rubric.totalMax > 0
    ? Math.round((total * TARGET_MAX / rubric.totalMax) * 10) / 10
    : 0;
  // Also scale every per-criterion max so the breakdown adds up to 40.
  const scaledBreakdown = {};
  const scaleFactor = rubric.totalMax > 0 ? (TARGET_MAX / rubric.totalMax) : 1;
  for (const [k, v] of Object.entries(breakdown)) {
    scaledBreakdown[k] = {
      ...v,
      score: Math.round((v.score * scaleFactor) * 10) / 10,
      max: Math.round((v.max * scaleFactor) * 10) / 10,
    };
  }
  return {
    ok: true,
    score: scaledScore,
    maxScore: TARGET_MAX,
    rubricStage: rubric.stage,
    breakdown: scaledBreakdown,
    feedback: feedbackParts.join('\n'),
  };
}

module.exports = { gradeWriting, readApiKey };
