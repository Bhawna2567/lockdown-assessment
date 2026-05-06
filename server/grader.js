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
  return [
    `You are an experienced writing teacher grading a student's essay.`,
    `You must evaluate the essay strictly against the rubric below. Score each criterion on a 1–3 scale (whole numbers only). Be fair and consistent — only award the top band when the descriptors are clearly met.`,
    ``,
    `=== RUBRIC ===`,
    rubricAsText(rubric),
    ``,
    `=== ASSIGNMENT PROMPT ===`,
    prompt || '(no specific prompt — score on overall writing quality)',
    ``,
    `=== STUDENT ESSAY ===`,
    essay,
    ``,
    `=== INSTRUCTIONS ===`,
    `Return ONLY valid JSON in exactly this shape, with no surrounding prose, no markdown fences:`,
    `{`,
    `  "criteria": {`,
    `    "content": { "score": <1|2|3>, "comment": "<one or two sentences>" },`,
    `    "organisation": { "score": <1|2|3>, "comment": "<one or two sentences>" },`,
    `    "grammar": { "score": <1|2|3>, "comment": "<one or two sentences>" },`,
    `    "lexis": { "score": <1|2|3>, "comment": "<one or two sentences>" }`,
    `  },`,
    `  "overallFeedback": "<two to four sentences combining strengths and one or two improvement targets, written directly to the student>"`,
    `}`,
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
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
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

async function gradeWriting({ rubricStage, prompt, essay, maxScore = 12 }) {
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

  // Normalise — clamp scores to 1..3 and total them.
  const breakdown = {};
  let total = 0;
  for (const c of rubric.criteria) {
    const item = parsed.criteria[c.id] || {};
    const s = Math.max(1, Math.min(c.max, Math.round(Number(item.score) || 0)));
    breakdown[c.id] = {
      name: c.name,
      score: s,
      max: c.max,
      comment: String(item.comment || '').trim(),
    };
    total += s;
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

  return {
    ok: true,
    score: total,
    maxScore: rubric.totalMax,
    rubricStage: rubric.stage,
    breakdown,
    feedback: feedbackParts.join('\n'),
  };
}

module.exports = { gradeWriting, readApiKey };
