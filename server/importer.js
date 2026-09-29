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


// ── Word equations (OMML) → LaTeX, so equations survive text extraction ──
// mammoth ignores Word's equation objects entirely; this rewrites each one
// as a text run containing \( … \) LaTeX before mammoth reads the file.
const _OMML_CHARS = {
  '×': '\\times ', '÷': '\\div ', '±': '\\pm ', '∓': '\\mp ', '≤': '\\le ', '≥': '\\ge ', '≠': '\\ne ', '≈': '\\approx ', '≡': '\\equiv ',
  '∞': '\\infty ', '°': '^{\\circ}', '·': '\\cdot ', '⋅': '\\cdot ', '−': '-', '→': '\\rightarrow ', '←': '\\leftarrow ', '⇌': '\\rightleftharpoons ', '⇒': '\\Rightarrow ',
  'π': '\\pi ', 'θ': '\\theta ', 'α': '\\alpha ', 'β': '\\beta ', 'γ': '\\gamma ', 'δ': '\\delta ', 'Δ': '\\Delta ', 'λ': '\\lambda ', 'μ': '\\mu ', 'σ': '\\sigma ', 'Σ': '\\Sigma ',
  'ω': '\\omega ', 'Ω': '\\Omega ', 'φ': '\\phi ', 'ϕ': '\\phi ', 'ρ': '\\rho ', 'τ': '\\tau ', 'ε': '\\varepsilon ', 'η': '\\eta ', '∠': '\\angle ', '△': '\\triangle ', '⊥': '\\perp ', '∥': '\\parallel ',
  '∈': '\\in ', '∪': '\\cup ', '∩': '\\cap ', '⊂': '\\subset ', '∴': '\\therefore ', '∂': '\\partial ', '∇': '\\nabla ', '…': '\\ldots ', '⋯': '\\cdots ',
};
const _OMML_FUNCS = /^(sin|cos|tan|sec|csc|cot|log|ln|exp|lim|max|min|sinh|cosh|tanh|arcsin|arccos|arctan)$/;

function _ommlToLatex(root) {
  const local = (n) => n.localName || String(n.nodeName).split(':').pop();
  const kids = (n) => { const out = []; for (let c = n.firstChild; c; c = c.nextSibling) if (c.nodeType === 1) out.push(c); return out; };
  const child = (n, name) => (n ? kids(n).find((c) => local(c) === name) : null);
  const attrVal = (n) => (n ? (n.getAttribute('m:val') || n.getAttribute('val') || '') : '');
  const chars = (t) => [...String(t || '')].map((ch) => _OMML_CHARS[ch] !== undefined ? _OMML_CHARS[ch] : ch).join('');
  const conv = (n) => (n ? kids(n).map(one).join('') : '');
  const delim = (c) => ({ '(': '(', ')': ')', '[': '[', ']': ']', '{': '\\{', '}': '\\}', '|': '|', '‖': '\\|', '⟨': '\\langle ', '⟩': '\\rangle ', '': '.' }[c] ?? c);
  function one(n) {
    switch (local(n)) {
      case 'r': return kids(n).filter((c) => local(c) === 't').map((t) => chars(t.textContent)).join('');
      case 'f': return '\\frac{' + conv(child(n, 'num')) + '}{' + conv(child(n, 'den')) + '}';
      case 'sSup': return '{' + conv(child(n, 'e')) + '}^{' + conv(child(n, 'sup')) + '}';
      case 'sSub': return '{' + conv(child(n, 'e')) + '}_{' + conv(child(n, 'sub')) + '}';
      case 'sSubSup': return '{' + conv(child(n, 'e')) + '}_{' + conv(child(n, 'sub')) + '}^{' + conv(child(n, 'sup')) + '}';
      case 'sPre': return '{}_{' + conv(child(n, 'sub')) + '}^{' + conv(child(n, 'sup')) + '}' + conv(child(n, 'e'));
      case 'rad': {
        const deg = conv(child(n, 'deg')).trim();
        return (deg ? '\\sqrt[' + deg + ']{' : '\\sqrt{') + conv(child(n, 'e')) + '}';
      }
      case 'd': {
        const pr = child(n, 'dPr');
        const bc = child(pr, 'begChr'), ec = child(pr, 'endChr');
        const beg = bc ? attrVal(bc) : '(', end = ec ? attrVal(ec) : ')';
        const parts = kids(n).filter((c) => local(c) === 'e').map(conv);
        return '\\left' + delim(beg) + parts.join(',') + '\\right' + delim(end);
      }
      case 'nary': {
        const pr = child(n, 'naryPr');
        const ch = child(pr, 'chr');
        const sym = ch ? attrVal(ch) : '∫';
        const op = { '∑': '\\sum', '∏': '\\prod', '∫': '\\int', '∬': '\\iint', '∭': '\\iiint', '∮': '\\oint', '⋃': '\\bigcup', '⋂': '\\bigcap' }[sym] || '\\int';
        const sub = conv(child(n, 'sub')), sup = conv(child(n, 'sup'));
        return op + (sub ? '_{' + sub + '}' : '') + (sup ? '^{' + sup + '}' : '') + ' ' + conv(child(n, 'e'));
      }
      case 'func': {
        const name = conv(child(n, 'fName')).trim();
        return (_OMML_FUNCS.test(name) ? '\\' + name : name) + ' ' + conv(child(n, 'e'));
      }
      case 'acc': {
        const ch = child(child(n, 'accPr'), 'chr');
        const c = ch ? attrVal(ch) : '̂';
        const cmd = { '⃗': '\\vec', '→': '\\vec', '̅': '\\overline', '¯': '\\overline', '̂': '\\hat', '̇': '\\dot', '̈': '\\ddot', '̃': '\\tilde' }[c] || '\\hat';
        return cmd + '{' + conv(child(n, 'e')) + '}';
      }
      case 'bar': return '\\overline{' + conv(child(n, 'e')) + '}';
      case 'groupChr': return '\\underbrace{' + conv(child(n, 'e')) + '}';
      case 'limLow': return '{' + conv(child(n, 'e')) + '}_{' + conv(child(n, 'lim')) + '}';
      case 'limUpp': return '{' + conv(child(n, 'e')) + '}^{' + conv(child(n, 'lim')) + '}';
      case 'eqArr': return '\\begin{aligned}' + kids(n).filter((c) => local(c) === 'e').map(conv).join('\\\\') + '\\end{aligned}';
      case 'm': return '\\begin{pmatrix}' + kids(n).filter((c) => local(c) === 'mr').map((r) => kids(r).filter((c) => local(c) === 'e').map(conv).join('&')).join('\\\\') + '\\end{pmatrix}';
      default:
        if (/Pr$/.test(local(n))) return '';
        return conv(n);
    }
  }
  return conv(root).replace(/\s+/g, ' ').trim();
}

async function _ccDocxMathToLatex(buf) {
  let JSZip, xmldom;
  try { JSZip = require('jszip'); xmldom = require('@xmldom/xmldom'); } catch (e) { return buf; }
  const zip = await JSZip.loadAsync(buf);
  const f = zip.file('word/document.xml');
  if (!f) return buf;
  const xml = await f.async('string');
  if (xml.indexOf('<m:oMath') === -1) return buf;
  const doc = new xmldom.DOMParser().parseFromString(xml, 'text/xml');
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const makeRun = (text) => {
    const r = doc.createElementNS(W, 'w:r');
    const t = doc.createElementNS(W, 'w:t');
    t.setAttribute('xml:space', 'preserve');
    t.appendChild(doc.createTextNode(text));
    r.appendChild(t);
    return r;
  };
  const replaceAll = (tag, wrapL, wrapR) => {
    const list = Array.from(doc.getElementsByTagName(tag));
    for (const node of list) {
      if (!node.parentNode) continue;
      const latex = tag === 'm:oMathPara'
        ? Array.from(node.getElementsByTagName('m:oMath')).map(_ommlToLatex).join(' \\\\ ')
        : _ommlToLatex(node);
      if (!latex) { node.parentNode.removeChild(node); continue; }
      node.parentNode.replaceChild(makeRun(' ' + wrapL + latex + wrapR + ' '), node);
    }
  };
  replaceAll('m:oMathPara', '\\[', '\\]');
  replaceAll('m:oMath', '\\(', '\\)');
  const out = new xmldom.XMLSerializer().serializeToString(doc);
  zip.file('word/document.xml', out);
  return zip.generateAsync({ type: 'nodebuffer' });
}

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
    let docBuf = buf;
    try { docBuf = await _ccDocxMathToLatex(buf); } catch (e) { docBuf = buf; }
    const result = await mammoth.extractRawText({ buffer: docBuf });
    return result.value || '';
  }
  if (
    mimeType === 'text/plain' || name.endsWith('.txt') ||
    mimeType === 'text/csv'   || name.endsWith('.csv') ||
    (mimeType || '').startsWith('text/')
  ) {
    return buf.toString('utf8');
  }
  throw new Error('Unsupported file type. Upload a PDF, DOCX, CSV, or TXT file.');
}

const Q_NUM = /^\s*(?:Q\s*)?[\(\[]?(\d{1,3})[\)\].:\s]\s*(.+?)\s*$/i;
const OPT_LINE = /^\s*[\(\[]?([A-Ha-h])[\)\].:\s]\s*(.+?)\s*$/;

// Inline option detector. Finds option markers anywhere in a string.
// Matches "A.", "A)", "(A)", "a.", " A " — but only when preceded by
// whitespace, a punctuation mark, or the start of the string. The
// sequential-letters check below filters out false positives (e.g. "A."
// appearing in the middle of a sentence won't cause a misread because
// we only accept matches that appear in alphabetical order: A, B, C…).
const OPT_INLINE = /(^|[\s\.\?\!\,\;\:\)\]])(?:\(([A-Ha-h])\)|([A-Ha-h])\s*[\)\.])\s+/g;

function extractInlineOptions(text) {
  const matches = [];
  let m;
  // Reset regex state between calls.
  OPT_INLINE.lastIndex = 0;
  while ((m = OPT_INLINE.exec(text)) !== null) {
    const letter = (m[2] || m[3] || '').toUpperCase();
    if (!letter) continue;
    // Where the option text starts (after the marker).
    const optTextStart = m.index + m[0].length;
    matches.push({
      index: m.index + (m[1] ? m[1].length : 0), // start of the marker itself
      contentStart: optTextStart,
      letter,
    });
  }
  if (matches.length < 2) return null;

  // Only keep matches that form a valid alphabetical sequence A, B, C…
  // starting from the first one. As soon as the sequence breaks, stop.
  const expected = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  // Find the first letter — must be 'A' for it to count as a real option list.
  if (matches[0].letter !== 'A') return null;
  let validCount = 1;
  for (let i = 1; i < matches.length; i++) {
    if (matches[i].letter === expected[validCount]) {
      validCount++;
    } else {
      break;
    }
  }
  if (validCount < 2) return null; // need at least A and B

  const valid = matches.slice(0, validCount);

  // Prompt = everything before the first option marker.
  const prompt = text.slice(0, valid[0].index).trim();
  if (!prompt) return null;

  // Each option's text spans from contentStart to the next marker (or EOF).
  const options = [];
  for (let i = 0; i < valid.length; i++) {
    const start = valid[i].contentStart;
    const end = i + 1 < valid.length ? valid[i + 1].index : text.length;
    options.push(text.slice(start, end).trim().replace(/\s+/g, ' '));
  }
  return { prompt, options };
}

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
    // Strategy 1: line-by-line option detection (each option on its own line).
    let options = [];
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
    let prompt = promptLines.join(' ').replace(/\s+/g, ' ').trim();

    // Strategy 2: if we didn't find enough options on separate lines, try
    // detecting them inline within the joined block text. This handles
    // PDFs where line breaks were lost during extraction so a question
    // and its options collapsed onto one or two lines.
    if (options.length < 2) {
      const joined = b.lines.join(' ').replace(/\s+/g, ' ').trim();
      const inline = extractInlineOptions(joined);
      if (inline) {
        prompt = inline.prompt;
        options = inline.options;
      } else {
        prompt = joined;
        options = [];
      }
    }

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


// ───────────────────────────────────────────────────────────────────────────
//  extractMediaImages — pull images out of an uploaded PDF / DOCX so the
//  Claude API can SEE them.
//
//  PDF: shells out to `pdftoppm` (poppler-utils). If the binary isn't
//  installed (some hosts), returns [] and the caller falls back to
//  text-only Claude prompting.
//  DOCX: uses mammoth's image hook to extract embedded media.
//
//  Returns: Array<{ media: 'image/jpeg' | 'image/png' | ..., buf: Buffer }>
// ───────────────────────────────────────────────────────────────────────────
const { execFile } = require('child_process');
const path = require('path');
const os = require('os');
const fsP = require('fs').promises;

function execFileP(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { ...opts, timeout: 60000 }, (err, stdout, stderr) => {
      if (err) return reject(err);
      resolve({ stdout, stderr });
    });
  });
}

async function extractPageImagesFromPDF(filepath, maxPages = 8) {
  // Try pdftoppm first — produces page-1.jpg, page-2.jpg, ... in a tmpdir.
  let tmp;
  try {
    tmp = await fsP.mkdtemp(path.join(os.tmpdir(), 'cc-pdf-'));
    await execFileP('pdftoppm', [
      '-jpeg', '-r', '110',
      '-f', '1', '-l', String(maxPages),    // limit to first N pages
      filepath,
      path.join(tmp, 'page'),
    ]);
    const files = (await fsP.readdir(tmp))
      .filter((f) => /^page-?\d+\.jpe?g$/i.test(f))
      .sort();
    const out = [];
    for (const f of files) {
      const buf = await fsP.readFile(path.join(tmp, f));
      out.push({ media: 'image/jpeg', buf, kind: 'page' });
    }
    return out;
  } catch (e) {
    // pdftoppm not installed, file unreadable, or timeout. Return [] —
    // text extraction still works for the caller.
    return [];
  } finally {
    if (tmp) { try { await fsP.rm(tmp, { recursive: true, force: true }); } catch {} }
  }
}

async function extractEmbeddedImagesFromDOCX(filepath, maxImages = 20) {
  try {
    const mammoth = require('mammoth');
    const images = [];
    await mammoth.extractRawText({
      path: filepath,
      convertImage: mammoth.images.imgElement(async (image) => {
        if (images.length >= maxImages) return { src: '' };
        try {
          const buf = await image.read();
          const contentType = String(image.contentType || '').toLowerCase();
          // Anthropic and browsers support png, jpeg, gif, webp. Skip the rest
          // (emf/wmf/tiff) rather than mislabel them.
          if (!['image/png','image/jpeg','image/gif','image/webp'].includes(contentType)) return { src: '' };
          images.push({ media: contentType, buf, kind: 'embedded' });
        } catch {}
        return { src: '' };
      }),
    });
    return images;
  } catch (e) {
    return [];
  }
}


// ── Embedded pictures inside a PDF (no external tools needed) ─────────────
// JPEG streams (DCTDecode) are copied as-is. Flate-compressed RGB / grey
// pixel data is re-wrapped as a PNG. Tiny images (bullets, icons) are skipped.
const _zlib = require('zlib');
const _CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function _crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = _CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function _pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(_crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function _encodePng(width, height, channels, filteredRows) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = channels === 3 ? 2 : 0; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    _pngChunk('IHDR', ihdr),
    _pngChunk('IDAT', _zlib.deflateSync(filteredRows)),
    _pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

async function extractEmbeddedImagesFromPDF(filepath, maxImages = 20) {
  const out = [];
  try {
    const { PDFDocument, PDFName, PDFRawStream, PDFNumber, PDFArray, PDFDict } = require('pdf-lib');
    const bytes = await fsP.readFile(filepath);
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    const num = (d, k) => { const v = d.get(PDFName.of(k)); return v instanceof PDFNumber ? v.asNumber() : (v && v.asNumber ? v.asNumber() : 0); };
    for (const [, obj] of doc.context.enumerateIndirectObjects()) {
      if (out.length >= maxImages) break;
      if (!(obj instanceof PDFRawStream)) continue;
      const d = obj.dict;
      if (d.get(PDFName.of('Subtype')) !== PDFName.of('Image')) continue;
      const w = num(d, 'Width'), h = num(d, 'Height');
      if (!w || !h || w * h < 6000 || w < 50 || h < 50) continue;   // icons, bullets, lines
      let filter = d.get(PDFName.of('Filter'));
      if (filter instanceof PDFArray) filter = filter.size() === 1 ? filter.get(0) : null;
      const raw = Buffer.from(obj.contents);
      if (filter === PDFName.of('DCTDecode')) {
        out.push({ media: 'image/jpeg', buf: raw, kind: 'embedded' });
        continue;
      }
      if (filter !== PDFName.of('FlateDecode')) continue;              // JBIG2, CCITT, JPX: skip
      if (num(d, 'BitsPerComponent') !== 8) continue;
      let data;
      try { data = _zlib.inflateSync(raw); } catch { continue; }
      let parms = d.get(PDFName.of('DecodeParms'));
      if (parms instanceof PDFArray) parms = parms.get(0);
      const predictor = parms instanceof PDFDict ? num(parms, 'Predictor') : 0;
      let channels, rows;
      if (predictor >= 10) {
        // Data is already PNG-filtered rows (one filter byte per row).
        channels = Math.round((data.length / h - 1) / w);
        if (channels !== 1 && channels !== 3) continue;
        if (data.length < h * (w * channels + 1)) continue;
        rows = data.subarray(0, h * (w * channels + 1));
      } else if (!predictor || predictor === 1) {
        channels = Math.round(data.length / (w * h));
        if (channels !== 1 && channels !== 3) continue;
        const stride = w * channels;
        if (data.length < h * stride) continue;
        rows = Buffer.alloc(h * (stride + 1));
        for (let y = 0; y < h; y++) {
          rows[y * (stride + 1)] = 0;
          data.copy(rows, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
        }
      } else continue;
      out.push({ media: 'image/png', buf: _encodePng(w, h, channels, rows), kind: 'embedded' });
    }
  } catch (e) {
    return out;
  }
  return out;
}

async function extractMediaImages(filepath, mimetype, name) {
  const lname = String(name || '').toLowerCase();
  const lmime = String(mimetype || '').toLowerCase();
  // Cap individual + total payload sizes so we don't blow the Anthropic limit.
  const MAX_ONE = 4 * 1024 * 1024;
  const MAX_TOTAL = 25 * 1024 * 1024;
  let total = 0;
  const filtered = (imgs) => {
    const out = [];
    for (const img of imgs) {
      if (!img || !img.buf) continue;
      if (img.buf.length > MAX_ONE) continue;
      if (total + img.buf.length > MAX_TOTAL) break;
      total += img.buf.length;
      out.push(img);
    }
    return out;
  };
  if (lmime === 'application/pdf' || lname.endsWith('.pdf')) {
    const embedded = filtered(await extractEmbeddedImagesFromPDF(filepath));
    if (embedded.length) return embedded;
    return filtered(await extractPageImagesFromPDF(filepath));
  }
  if (lmime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      lname.endsWith('.docx')) {
    return filtered(await extractEmbeddedImagesFromDOCX(filepath));
  }
  return [];
}

module.exports = { importFile, parse, extractText, extractMediaImages };
