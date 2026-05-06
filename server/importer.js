// Quick-import: turn a PDF or DOCX into a structured assessment draft.
// Heuristic parser — works on typical classroom exam papers.
//
// Recognized patterns:
//   - Question number: "1.", "1)", "Q1.", "Q 1:", "(1)" at line start.
//   - MC options:     "A.", "A)", "(A)", "a.", etc. at line start.
//   - True/False:     if the question text contains "true or false" or "T/F".
//   - Essay:          cues like "essay", "explain", "discuss", "describe in detail".
//   - Short answer:   default when no options and not an essay.
//
// The teacher always reviews and edits before saving, so we err on the side
// of producing a usable draft rather than being perfect.

const fs = require('fs');

const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

async function extractText(filePath, mimeType, originalName = '') {
  const name = (originalName || '').toLowerCase();
  const buf = fs.readFileSync(filePath);
  if (mimeType === 'application/pdf' || name.endsWith('.pdf')) {
    const data = await pdfParse(buf);
    return data.text || '';
  }
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx')
  ) {
    const result = await mammoth.extractRawText({ buffer: buf });
    return result.value || '';
  }
  if (mimeType === 'text/plain' || name.endsWith('.txt')) {
    return buf.toString('utf8');
  }
  throw new Error('Unsupported file type. Upload a PDF, DOCX, or TXT file.');
}

const Q_NUM = /^\s*(?:Q\s*)?[\(\[]?(\d{1,3})[\)\].:\s]\s*(.+?)\s*$/i;
const OPT_LINE = /^\s*[\(\[]?([A-Ha-h])[\)\].:\s]\s*(.+?)\s*$/;

function isEssayCue(text) {
  const t = text.toLowerCase();
  return /\b(essay|explain in detail|discuss|describe in detail|in your own words|write a paragraph|elaborate)\b/.test(t);
}
function isTrueFalseCue(text) {
  const t = text.toLowerCase();
  return /\b(true or false|t\s*\/\s*f|true\/false)\b/.test(t);
}

// Headings that mark the start of a reading passage in many exam papers.
// Used to detect when a chunk of pre-question text is a passage we should
// preserve, vs. just instructions / metadata.
const PASSAGE_HEADING = /^(reading\s+passage|passage|read\s+the\s+(?:following|passage|text|extract)|text\s+\d*|extract\s+\d*)\s*[:\-]?\s*$/i;

// Headings that mark the start of the questions block. Anything BEFORE one
// of these (after a passage heading) is treated as the passage body.
const QUESTIONS_HEADING = /^(questions?|comprehension\s+questions?|answer\s+the\s+(?:following|questions?))\s*[:\-]?\s*$/i;

function parse(text) {
  // Normalize line endings, collapse triple blank lines.
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((l) => l.trimEnd());

  // Find the first line that looks like a question number \u2014 everything
  // BEFORE it is candidate passage / preamble / instructions.
  let firstQIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(Q_NUM);
    if (m && Number(m[1]) >= 1 && Number(m[1]) <= 200 && /[A-Za-z]/.test(m[2])) {
      firstQIdx = i;
      break;
    }
  }

  // Extract a reading passage from the pre-question region, if it looks
  // substantial enough. We accept either an explicit "Reading passage:"
  // heading OR a long block of prose (>= ~40 words across multiple lines)
  // before the first question.
  let passage = '';
  if (firstQIdx > 0) {
    const pre = lines.slice(0, firstQIdx);

    // Strategy 1: explicit heading wins.
    const passageStart = pre.findIndex((l) => PASSAGE_HEADING.test(l.trim()));
    let passageEnd = pre.findIndex((l) => QUESTIONS_HEADING.test(l.trim()));
    if (passageEnd === -1) passageEnd = pre.length;

    if (passageStart !== -1 && passageEnd > passageStart) {
      passage = pre
        .slice(passageStart + 1, passageEnd)
        .map((l) => l.trim())
        .filter(Boolean)
        .join('\n');
    } else {
      // Strategy 2: take the longest run of prose before the questions.
      // Skip a single short line at the very top (likely the title) and
      // anything that looks like instructions ("Time allowed:", "Total marks:").
      const meta = /^(time\s+allowed|total\s+marks|name|class|date|instructions?|directions?)\b/i;
      const body = [];
      let inBody = false;
      let skippedTitle = false;
      for (const l of pre) {
        const trimmed = l.trim();
        if (!trimmed) {
          if (inBody) body.push('');
          continue;
        }
        if (meta.test(trimmed)) continue;
        if (!skippedTitle && body.length === 0 && trimmed.length <= 80 && !/[.!?]$/.test(trimmed)) {
          // Treat the first short, non-sentence line as the title and skip it.
          skippedTitle = true;
          continue;
        }
        inBody = true;
        body.push(trimmed);
      }
      const joined = body.join('\n').trim();
      const wordCount = joined.split(/\s+/).filter(Boolean).length;
      if (wordCount >= 40) passage = joined;
    }
  }

  // Group lines into question blocks by detecting lines starting with a question number.
  const blocks = [];
  let current = null;
  const startIdx = firstQIdx === -1 ? 0 : firstQIdx;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(Q_NUM);
    // Heuristic: treat as a question marker only if the captured number is
    // reasonable (<= 200) AND the rest looks like a sentence (has a letter).
    const looksLikeQuestion = m && Number(m[1]) >= 1 && Number(m[1]) <= 200 && /[A-Za-z]/.test(m[2]);

    if (looksLikeQuestion) {
      if (current) blocks.push(current);
      current = { number: Number(m[1]), lines: [m[2]] };
    } else if (current) {
      if (line.trim()) current.lines.push(line);
    }
  }
  if (current) blocks.push(current);

  // Convert each block into a question object.
  const questions = [];
  for (const b of blocks) {
    const options = [];
    const promptLines = [];
    for (const l of b.lines) {
      const om = l.match(OPT_LINE);
      if (om && options.length < 8) {
        options.push(om[2]);
      } else if (options.length === 0) {
        promptLines.push(l);
      } else {
        // Trailing non-option line after options — append to last option
        // unless it looks like a new section.
        options[options.length - 1] += ' ' + l.trim();
      }
    }
    const prompt = promptLines.join(' ').replace(/\s+/g, ' ').trim();
    if (!prompt) continue;

    let type, q;
    if (options.length >= 2) {
      type = 'mc';
      q = { type, prompt, options, correctAnswer: 0, points: 1 };
    } else if (isTrueFalseCue(prompt)) {
      type = 'tf';
      q = { type, prompt, correctAnswer: true, points: 1 };
    } else if (isEssayCue(prompt)) {
      type = 'essay';
      q = { type, prompt, points: 5 };
    } else {
      type = 'short';
      q = { type, prompt, correctAnswer: '', points: 1 };
    }
    questions.push(q);
  }

  return { questions, passage };
}

async function importFile(filePath, mimeType, originalName) {
  const text = await extractText(filePath, mimeType, originalName);
  const { questions, passage } = parse(text);
  // Try to find a title — first non-empty line that isn't a question.
  const firstLine =
    text.split('\n').map((l) => l.trim()).find((l) => l && !Q_NUM.test(l)) || '';
  const title = firstLine.slice(0, 120) || 'Imported assessment';
  return { title, questions, passage, rawText: text };
}

module.exports = { importFile, parse, extractText };
