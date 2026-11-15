// ════════════════════════════════════════════════════════════════════════
//  Colour-coded marked writing report (pdfkit).
//  drawReport(doc, data) draws the summary pages; the caller adds the scans.
//  data = { student, subtitle, total, max, tasks: [{ label, score, max, rubricTitle, rubricNote,
//           text, mistakes: [{ start, end, type, wrong, correct, why }],
//           criteria: [{ name, score, max, comment }], wentWell, toImprove, feedback }] }
//  Only standard PDF fonts are used, so text sticks to plain Latin characters.
// ════════════════════════════════════════════════════════════════════════
const TYPES = {
  spell: { name: 'Spelling', short: 'Spelling', bg: '#FDE2E2', bd: '#DC2626', dk: '#991B1B' },
  grammar: { name: 'Grammar', short: 'Grammar', bg: '#DBEAFE', bd: '#2563EB', dk: '#1E40AF' },
  punct: { name: 'Punctuation and capitals', short: 'Punctuation', bg: '#FFEDD5', bd: '#EA580C', dk: '#9A3412' },
  vocab: { name: 'Word choice', short: 'Word choice', bg: '#EDE9FE', bd: '#7C3AED', dk: '#5B21B6' },
};
const ORDER = ['spell', 'grammar', 'punct', 'vocab'];
const INK = '#1a1e33', MUTED = '#64748b', LINE = '#E2E8F0';
const F = 'Helvetica', FB = 'Helvetica-Bold', FI = 'Helvetica-Oblique';
// Characters outside the standard fonts' set are replaced, so nothing prints as garbage.
const clean = (s) => String(s == null ? '' : s)
  .replace(/[→⇒]/g, '->').replace(/[•▪●]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ–—]/g, '');

function badgeColours(score, max) {
  const r = max ? score / max : 0;
  if (r >= 1) return ['#DCFCE7', '#166534'];
  if (r >= 0.5) return ['#FEF3C7', '#92400E'];
  return ['#FEE2E2', '#991B1B'];
}

function drawReport(doc, data) {
  const L = 50, W = doc.page.width - 100;
  const bottom = () => doc.page.height - 60;
  let y = 46;
  const ensure = (h) => { if (y + h > bottom()) { doc.addPage(); y = 46; } };
  const label = (txt) => { ensure(16); doc.font(FB).fontSize(7.5).fillColor(MUTED).text(clean(txt).toUpperCase(), L, y, { width: W, lineBreak: false }); y += 12; };

  // ── header ──
  doc.font(FB).fontSize(18).fillColor(INK).text(clean(data.student), L, y, { width: W - 120, lineBreak: false });
  doc.font(FB).fontSize(7.5).fillColor(MUTED).text('TOTAL', L + W - 120, y - 2, { width: 120, align: 'right' });
  doc.font(FB).fontSize(20).fillColor(INK).text(`${data.total} / ${data.max}`, L + W - 120, y + 8, { width: 120, align: 'right' });
  y += 24;
  doc.font(F).fontSize(9).fillColor(MUTED).text(clean(data.subtitle), L, y, { width: W - 120 });
  y += 16;
  if (data.note) { doc.font(FI).fontSize(8.5).fillColor('#92400E').text(clean(data.note), L, y, { width: W - 120 }); y += 13; }
  doc.moveTo(L, y).lineTo(L + W, y).lineWidth(1.6).strokeColor(INK).stroke();
  y += 10;

  // ── mistakes by type ──
  const all = [].concat(...data.tasks.map((t) => t.mistakes || []));
  if (all.length) {
    label('Mistakes found, by type (these colours are used throughout this report)');
    const cw = W / 4;
    ORDER.forEach((k, i) => {
      const c = TYPES[k];
      doc.rect(L + i * cw + (i ? 1.5 : 0), y, cw - 1.5, 36).fill(c.bg);
      doc.font(FB).fontSize(15).fillColor(c.dk).text(String(all.filter((m) => m.type === k).length), L + i * cw, y + 4, { width: cw, align: 'center' });
      doc.font(F).fontSize(7.5).fillColor(c.dk).text(c.name, L + i * cw, y + 23, { width: cw, align: 'center' });
    });
    y += 48;
  }

  for (const t of data.tasks) drawTask(t);

  // ── one task ──
  function drawTask(t) {
    ensure(110);
    doc.font(FB).fontSize(12.5).fillColor(INK).text(clean(t.label), L, y, { width: W - 90, lineBreak: false });
    doc.font(FB).fontSize(12.5).fillColor(INK).text(`${t.score} / ${t.max}`, L + W - 90, y, { width: 90, align: 'right' });
    y += 17;
    doc.moveTo(L, y).lineTo(L + W, y).lineWidth(1).strokeColor(INK).stroke();
    y += 7;

    if (t.text && t.text.trim()) {
      label('Your writing (as read from your paper)');
      const marks = flowText(String(t.text), (t.mistakes || []));
      y += 6;
      if (marks.length) { ensure(52); label('Corrections'); corrections(marks); }
      y += 4;
    }

    if (t.criteria && t.criteria.length) {
      ensure(40);
      label('Rubric marks' + (t.rubricTitle ? ' · ' + t.rubricTitle : ''));
      rubric(t);
    }
    if (t.wentWell) callout('What went well', t.wentWell, '#F0FDF4', '#16A34A', '#166534');
    if (t.toImprove) callout('To improve', t.toImprove, '#FFFBEB', '#D97706', '#92400E');
    if (!t.wentWell && !t.toImprove && t.feedback) callout('Feedback', t.feedback, '#F8FAFC', '#94A3B8', INK);
    y += 12;
  }

  // The student's writing with each mistake highlighted in its colour and numbered.
  // Returns the mistakes in the order they were numbered.
  function flowText(text, mistakes) {
    const size = 10, lineH = 18, padX = 8;
    const spans = mistakes.filter((m) => Number.isFinite(m.start) && Number.isFinite(m.end) && m.end > m.start)
      .sort((a, b) => a.start - b.start)
      .filter((m, i, arr) => !i || m.start >= arr[i - 1].end);
    spans.forEach((m, i) => { m.n = i + 1; });
    // Cut the text into pieces at spaces and at mistake boundaries.
    const cuts = new Set([0, text.length]);
    spans.forEach((m) => { cuts.add(m.start); cuts.add(m.end); });
    const pieces = [];
    const sorted = [...cuts].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i], b = sorted[i + 1];
      const span = spans.find((m) => a >= m.start && a < m.end) || null;
      const re = /\n|[ \t]+|[^\s]+/g; let mm;
      const chunk = text.slice(a, b);
      while ((mm = re.exec(chunk))) {
        const s = mm[0];
        if (s === '\n') pieces.push({ nl: true });
        else if (/^[ \t]+$/.test(s)) pieces.push({ sp: true });
        else pieces.push({ s: clean(s), span, endOfSpan: span && a + mm.index + s.length === span.end });
      }
    }
    doc.font(F).fontSize(size);
    const spaceW = doc.widthOfString(' ');
    const supW = (p) => (p.endOfSpan ? (doc.font(FB).fontSize(6.5), doc.widthOfString(String(p.span.n)) + 1.5) : 0);
    const widthOf = (p) => { doc.font(F).fontSize(size); const w = doc.widthOfString(p.s); return w + supW(p); };
    // Group pieces with no space between them into words, then wrap the words into lines.
    const lines = []; let line = [], lineW = 0, word = [], pendingSpace = false;
    const maxW = W - padX * 2;
    const flushWord = () => {
      if (!word.length) return;
      const ww = word.reduce((t, p) => t + widthOf(p), 0);
      const add = (line.length && pendingSpace ? spaceW : 0) + ww;
      if (line.length && lineW + add > maxW) { lines.push(line); line = []; lineW = 0; }
      if (line.length && pendingSpace) { line.push({ sp: true }); lineW += spaceW; }
      word.forEach((p) => line.push(p)); lineW += ww; word = []; pendingSpace = false;
    };
    for (const p of pieces) {
      if (p.nl) { flushWord(); lines.push(line); lines.push(null); line = []; lineW = 0; pendingSpace = false; continue; }
      if (p.sp) { flushWord(); pendingSpace = true; continue; }
      word.push(p);
    }
    flushWord(); if (line.length) lines.push(line);
    // Draw line by line (the grey panel is drawn per line, so it continues over a page break).
    for (const ln of lines) {
      const h = ln === null ? 6 : lineH;
      ensure(h);
      doc.rect(L, y, W, h).fill('#F8FAFC');
      doc.moveTo(L, y).lineTo(L, y + h).lineWidth(0.6).strokeColor(LINE).stroke();
      doc.moveTo(L + W, y).lineTo(L + W, y + h).lineWidth(0.6).strokeColor(LINE).stroke();
      if (ln === null) { y += h; continue; }
      let x = L + padX;
      const ty = y + 4;
      for (const p of ln) {
        if (p.sp) { x += spaceW; continue; }
        doc.font(F).fontSize(size);
        const w = doc.widthOfString(p.s);
        if (p.span) {
          const c = TYPES[p.span.type] || TYPES.grammar;
          doc.rect(x - 1, y + 2, w + 2, lineH - 4).fill(c.bg);
          doc.moveTo(x - 1, y + lineH - 2.5).lineTo(x + w + 1, y + lineH - 2.5).lineWidth(1.2).strokeColor(c.bd).stroke();
        }
        doc.font(F).fontSize(size).fillColor(INK).text(p.s, x, ty, { lineBreak: false });
        x += w;
        if (p.endOfSpan) {
          const c = TYPES[p.span.type] || TYPES.grammar;
          doc.font(FB).fontSize(6.5).fillColor(c.dk).text(String(p.span.n), x + 0.8, ty - 2.5, { lineBreak: false });
          x += supW(p);
        }
      }
      y += h;
    }
    doc.moveTo(L, y).lineTo(L + W, y).lineWidth(0.6).strokeColor(LINE).stroke();
    return spans;
  }

  function corrections(marks) {
    const cols = [18, 70, 175, W - 263];
    const xs = cols.reduce((a, w, i) => { a.push(i ? a[i - 1] + cols[i - 1] : L); return a; }, []);
    const head = ['#', 'Type', 'You wrote -> Correct form', 'Why'];
    ensure(14);
    head.forEach((h, i) => doc.font(FB).fontSize(7.5).fillColor(MUTED).text(h, xs[i] + 3, y, { width: cols[i] - 6, lineBreak: false }));
    y += 11;
    doc.moveTo(L, y).lineTo(L + W, y).lineWidth(0.5).strokeColor(LINE).stroke();
    for (const m of marks) {
      const c = TYPES[m.type] || TYPES.grammar;
      const wrong = clean(m.wrong), correct = clean(m.correct), why = clean(m.why);
      doc.font(F).fontSize(8.5);
      const wPart = doc.widthOfString(wrong + '  ->  ');
      doc.font(F).fontSize(8.5);
      const oneLine = wPart + (doc.font(FB).fontSize(8.5), doc.widthOfString(correct)) <= cols[2] - 6;
      doc.font(F).fontSize(8.5);
      const hw = doc.heightOfString(wrong, { width: cols[2] - 6 });
      doc.font(FB).fontSize(8.5);
      const h3 = oneLine ? 10 : hw + doc.heightOfString('-> ' + correct, { width: cols[2] - 6 }) + 2;
      doc.font(F).fontSize(8.5);
      const h4 = doc.heightOfString(why, { width: cols[3] - 6 });
      const rh = Math.max(h3, h4, 10) + 7;
      ensure(rh);
      doc.rect(xs[1], y, cols[1], rh).fill(c.bg);
      doc.font(FB).fontSize(8.5).fillColor(INK).text(String(m.n), xs[0] + 3, y + 3.5, { width: cols[0] - 6 });
      doc.font(FB).fontSize(8.5).fillColor(c.dk).text(c.short, xs[1] + 4, y + 3.5, { width: cols[1] - 8 });
      // wrong (struck through) -> correct (bold)
      if (oneLine) {
        doc.font(F).fontSize(8.5).fillColor('#475569').text(wrong, xs[2] + 3, y + 3.5, { lineBreak: false });
        const ww = doc.widthOfString(wrong);
        doc.moveTo(xs[2] + 3, y + 7.6).lineTo(xs[2] + 3 + ww, y + 7.6).lineWidth(0.7).strokeColor('#475569').stroke();
        doc.font(F).fontSize(8.5).fillColor(MUTED).text('  ->  ', xs[2] + 3 + ww, y + 3.5, { lineBreak: false });
        doc.font(FB).fontSize(8.5).fillColor(INK).text(correct, xs[2] + 3 + wPart, y + 3.5, { lineBreak: false });
      } else {
        doc.font(F).fontSize(8.5).fillColor('#475569').text(wrong, xs[2] + 3, y + 3.5, { width: cols[2] - 6 });
        doc.font(FB).fontSize(8.5).fillColor(INK).text('-> ' + correct, xs[2] + 3, y + 3.5 + hw + 2, { width: cols[2] - 6 });
      }
      doc.font(F).fontSize(8.5).fillColor('#334155').text(why, xs[3] + 3, y + 3.5, { width: cols[3] - 6 });
      y += rh;
      doc.moveTo(L, y).lineTo(L + W, y).lineWidth(0.5).strokeColor(LINE).stroke();
    }
    y += 6;
  }

  function rubric(t) {
    const cols = [120, 52, W - 172];
    for (const c of t.criteria) {
      const com = clean(c.comment || '');
      doc.font(F).fontSize(8.5);
      const rh = Math.max(com ? doc.heightOfString(com, { width: cols[2] - 8 }) : 0, doc.font(FB).heightOfString(clean(c.name), { width: cols[0] - 6 }), 12) + 9;
      ensure(rh);
      const [bg, fg] = badgeColours(Number(c.score) || 0, Number(c.max) || 0);
      doc.rect(L + cols[0], y, cols[1], rh).fill(bg);
      doc.font(FB).fontSize(8.5).fillColor(INK).text(clean(c.name), L + 3, y + 4.5, { width: cols[0] - 6 });
      doc.font(FB).fontSize(9.5).fillColor(fg).text(`${c.score} / ${c.max}`, L + cols[0], y + rh / 2 - 5, { width: cols[1], align: 'center' });
      if (com) doc.font(F).fontSize(8.5).fillColor('#334155').text(com, L + cols[0] + cols[1] + 6, y + 4.5, { width: cols[2] - 8 });
      y += rh;
      doc.moveTo(L, y).lineTo(L + W, y).lineWidth(0.5).strokeColor(LINE).stroke();
    }
    ensure(16);
    const raw = t.criteria.reduce((s, c) => s + (Number(c.score) || 0), 0), mx = t.criteria.reduce((s, c) => s + (Number(c.max) || 0), 0);
    doc.font(FB).fontSize(8.5).fillColor(INK).text('Task total', L + 3, y + 4, { lineBreak: false });
    doc.font(FB).fontSize(9.5).fillColor(INK).text(`${raw} / ${mx}` + (t.rubricNote ? '' : ''), L + cols[0], y + 3.5, { width: cols[1], align: 'center' });
    if (t.rubricNote) doc.font(F).fontSize(8.5).fillColor(MUTED).text(clean(t.rubricNote), L + cols[0] + cols[1] + 6, y + 4, { width: cols[2] - 8, lineBreak: false });
    y += 18;
  }

  function callout(title, text, bg, bar, fg) {
    const body = clean(text);
    doc.font(F).fontSize(9);
    const h = doc.heightOfString(body, { width: W - 20 }) + 22;
    ensure(h + 4);
    doc.rect(L, y, W, h).fill(bg);
    doc.rect(L, y, 3, h).fill(bar);
    doc.font(FB).fontSize(9).fillColor(fg).text(title, L + 11, y + 5, { width: W - 20 });
    doc.font(F).fontSize(9).fillColor(INK).text(body, L + 11, y + 17, { width: W - 20 });
    y += h + 5;
  }
  return y;
}

// Find where each mistake the AI reported sits in the transcript.
// m = { context, wrong, ... } -> adds start/end (or leaves them out when it cannot be found).
function locateMistakes(text, list) {
  const out = []; const taken = [];
  const free = (a, b) => !taken.some(([x, y]) => a < y && x < b);
  for (const m of list || []) {
    const wrong = String(m.wrong || '').trim(); if (!wrong) continue;
    const ctx = String(m.context || '').trim();
    let start = -1;
    if (ctx && ctx.includes(wrong)) {
      let i = text.indexOf(ctx);
      while (i >= 0) { const a = i + ctx.indexOf(wrong); if (free(a, a + wrong.length)) { start = a; break; } i = text.indexOf(ctx, i + 1); }
    }
    if (start < 0) {
      const re = new RegExp('(^|[^A-Za-z])(' + wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?=$|[^A-Za-z])', 'g'); let mm;
      while ((mm = re.exec(text))) { const a = mm.index + mm[1].length; if (free(a, a + wrong.length)) { start = a; break; } }
    }
    if (start < 0) continue;
    taken.push([start, start + wrong.length]);
    out.push({ start, end: start + wrong.length, type: TYPES[m.type] ? m.type : 'grammar', wrong, correct: String(m.correct || ''), why: String(m.why || '') });
  }
  return out.sort((a, b) => a.start - b.start);
}

module.exports = { drawReport, locateMistakes, TYPES };
