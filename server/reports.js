// Per-student term/year reports for parent meetings.
//
// Two formats:
//   - Word (.docx) — formatted parent-friendly document with student info
//     header, summary table, teacher narrative, rubric breakdown.
//   - Excel (.xlsx) — multi-sheet workbook with summary, class-comparison,
//     and rubric-progress data. Conditional cell colors signal performance
//     bands. (No embedded charts — ExcelJS doesn't support them well; the
//     teacher can use Excel's chart wizard on the data tables.)

const ExcelJS = require('exceljs');
const {
  Document, Packer, Paragraph, TextRun,
  HeadingLevel, AlignmentType, WidthType,
  Table, TableRow, TableCell, BorderStyle,
} = require('docx');
const { readApiKey } = require('./grader');

// -- Bilingual support ------------------------------------------------------
// Hardcoded translations of structural labels we control. Native-speaker
// review is recommended before using these in formal parent-facing reports.
// Dynamic content (teacher comments, narrative summary) is translated at
// runtime via the Claude API.
const LABELS = {
  en: {
    title: 'Student Term Report',
    student: 'Student', email: 'Email', term: 'Term', year: 'Academic Year',
    teacher: 'Class Teacher', date: 'Report Date',
    summary: 'Summary of Assessments',
    assessment: 'Assessment', dateCol: 'Date', score: 'Score', percent: 'Percent',
    classAvg: 'Class Average %', overall: 'Overall',
    commentary: 'Performance Commentary',
    rubric: 'Writing Rubric Progress',
    criterion: 'Criterion', average: 'Average', level: 'Level',
    content: 'Content & Task Achievement',
    organisation: 'Organisation & Cohesion',
    grammar: 'Grammatical Range & Accuracy',
    lexis: 'Lexical Range & Accuracy',
    towards: 'Towards grade level',
    at: 'At grade level',
    beyond: 'Beyond grade level',
    teacherComments: "Teacher's Comments",
    basedOn: 'Based on',
    writingAssessments: 'writing assessment(s) this term.',
  },
  ar: {
    title: 'تقرير الفصل الدراسي للطالب',
    student: 'الطالب', email: 'البريد الإلكتروني', term: 'الفصل', year: 'العام الدراسي',
    teacher: 'المعلم', date: 'تاريخ التقرير',
    summary: 'ملخص التقييمات',
    assessment: 'التقييم', dateCol: 'التاريخ', score: 'الدرجة', percent: 'النسبة المئوية',
    classAvg: 'متوسط الفصل %', overall: 'الإجمالي',
    commentary: 'تعليق على الأداء',
    rubric: 'تقدم رؤوس الكتابة',
    criterion: 'المعيار', average: 'المتوسط', level: 'المستوى',
    content: 'المحتوى وإنجاز المهمة',
    organisation: 'التنظيم والترابط',
    grammar: 'النطاق النحوي والدقة',
    lexis: 'النطاق المفرداتي والدقة',
    towards: 'نحو مستوى الصف',
    at: 'في مستوى الصف',
    beyond: 'أعلى من مستوى الصف',
    teacherComments: 'تعليقات المعلم',
    basedOn: 'بناءً على',
    writingAssessments: 'تقييم(ات) الكتابة هذا الفصل.',
  },
  hi: {
    title: 'छात्र सत्र रिपोर्ट',
    student: 'छात्र', email: 'ईमेल', term: 'सत्र', year: 'शैक्षणिक वर्ष',
    teacher: 'कक्षा शिक्षक', date: 'रिपोर्ट दिनांक',
    summary: 'मूल्यांकन का सारांश',
    assessment: 'मूल्यांकन', dateCol: 'दिनांक', score: 'अंक', percent: 'प्रतिशत',
    classAvg: 'कक्षा औसत %', overall: 'कुल',
    commentary: 'प्रदर्शन टिप्पणी',
    rubric: 'लेखन रूब्रिक प्रगति',
    criterion: 'मानदंड', average: 'औसत', level: 'स्तर',
    content: 'सामग्री और कार्य उपलब्धि',
    organisation: 'संगठन और सामंजस्य',
    grammar: 'व्याकरणिक श्रेणी और शुद्धता',
    lexis: 'शब्दावली श्रेणी और शुद्धता',
    towards: 'कक्षा स्तर की ओर',
    at: 'कक्षा स्तर पर',
    beyond: 'कक्षा स्तर से ऊपर',
    teacherComments: 'शिक्षक की टिप्पणियाँ',
    basedOn: 'इस पर आधारित',
    writingAssessments: 'इस सत्र के लेखन मूल्यांकन।',
  },
  th: {
    title: 'รายงานภาคเรียนของนักเรียน',
    student: 'นักเรียน', email: 'อีเมล', term: 'ภาคเรียน', year: 'ปีการศึกษา',
    teacher: 'ครูประจำชั้น', date: 'วันที่รายงาน',
    summary: 'สรุปการประเมิน',
    assessment: 'การประเมิน', dateCol: 'วันที่', score: 'คะแนน', percent: 'ร้อยละ',
    classAvg: 'ค่าเฉลี่ยชั้นเรียน %', overall: 'รวม',
    commentary: 'ความคิดเห็นเกี่ยวกับผลการเรียน',
    rubric: 'ความก้าวหน้าตามเกณฑ์การเขียน',
    criterion: 'เกณฑ์', average: 'ค่าเฉลี่ย', level: 'ระดับ',
    content: 'เนื้อหาและการบรรลุภารกิจ',
    organisation: 'การจัดระเบียบและความเชื่อมโยง',
    grammar: 'ความหลากหลายและความถูกต้องของไวยากรณ์',
    lexis: 'ความหลากหลายและความถูกต้องของคำศัพท์',
    towards: 'กำลังพัฒนาสู่ระดับชั้น',
    at: 'อยู่ในระดับชั้น',
    beyond: 'เกินระดับชั้น',
    teacherComments: 'ความเห็นของครู',
    basedOn: 'อิงจาก',
    writingAssessments: 'การประเมินการเขียนในภาคเรียนนี้',
  },
};

const LANG_NAME = { ar: 'Arabic', hi: 'Hindi', th: 'Thai' };

function L(lang, key) {
  return (LABELS[lang] && LABELS[lang][key]) || LABELS.en[key] || key;
}

// Translate a list of free-text strings via the Claude API. Returns a parallel
// array. Returns the original strings unchanged if translation fails so the
// report still renders.
async function translateStrings(strings, targetLang) {
  if (!targetLang || targetLang === 'en') return strings;
  const apiKey = readApiKey();
  if (!apiKey) return strings;
  if (!strings.length || strings.every((s) => !s || !s.trim())) return strings;

  const langName = LANG_NAME[targetLang] || targetLang;
  const prompt = [
    `Translate the following English text snippets into ${langName}.`,
    `Return ONLY a JSON array of strings, the same length as the input, in the same order.`,
    `Preserve any numbers, names, dates, and email addresses unchanged inside the translation.`,
    `Use a formal, professional tone suitable for a school progress report given to parents.`,
    ``,
    `Input array:`,
    JSON.stringify(strings),
  ].join('\n');

  try {
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
    if (!res.ok) {
      console.error('[translate] API error', res.status);
      return strings;
    }
    const data = await res.json();
    const text = (data.content || []).map((b) => b.type === 'text' ? b.text : '').join('').trim();
    const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.length === strings.length) {
      return parsed.map(String);
    }
    return strings;
  } catch (e) {
    console.error('[translate] failed', e.message);
    return strings;
  }
}

// -- helpers ----------------------------------------------------------------

function pct(num, denom) {
  return denom > 0 ? num / denom : 0;
}
function pctText(num, denom) {
  return `${Math.round(pct(num, denom) * 100)}%`;
}
function dateStr(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString();
}

// Aggregate rubric-criteria scores across writing questions in a submission.
function rubricAverages(submission) {
  const sums = { content: 0, organisation: 0, grammar: 0, lexis: 0 };
  let count = 0;
  for (const q of submission.review || []) {
    const breakdown = q.manualGrade && q.manualGrade.breakdown;
    if (q.type !== 'writing' || !breakdown) continue;
    for (const k of Object.keys(sums)) {
      if (breakdown[k] && typeof breakdown[k].score === 'number') {
        sums[k] += breakdown[k].score;
      }
    }
    count++;
  }
  if (count === 0) return null;
  return {
    content: sums.content / count,
    organisation: sums.organisation / count,
    grammar: sums.grammar / count,
    lexis: sums.lexis / count,
    count,
    total: (sums.content + sums.organisation + sums.grammar + sums.lexis) / count,
  };
}

// -- Excel ------------------------------------------------------------------

async function generateStudentExcelReport({
  student, submissions, assessmentsById, classAverages, term, academicYear, teacherName, secondLang,
}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ClassCurio';
  wb.created = new Date();

  // ---- Sheet 1: Summary ----
  const ws1 = wb.addWorksheet('Summary');
  ws1.mergeCells('A1:G1');
  ws1.getCell('A1').value = `Student Report — ${student.name}`;
  ws1.getCell('A1').font = { size: 18, bold: true };
  ws1.getCell('A1').alignment = { horizontal: 'center' };

  ws1.getCell('A3').value = 'Email';
  ws1.getCell('B3').value = student.email;
  ws1.getCell('A4').value = 'Term';
  ws1.getCell('B4').value = term ? `Term ${term}` : 'All terms';
  ws1.getCell('A5').value = 'Academic Year';
  ws1.getCell('B5').value = academicYear || '—';
  ws1.getCell('A6').value = 'Class Teacher';
  ws1.getCell('B6').value = teacherName || '—';
  ws1.getCell('A7').value = 'Report generated';
  ws1.getCell('B7').value = new Date().toLocaleDateString();

  for (const r of [3, 4, 5, 6, 7]) ws1.getCell(`A${r}`).font = { bold: true };

  // Header row
  const HEADER_ROW = 9;
  ws1.getRow(HEADER_ROW).values = ['Assessment', 'Date', 'Term', 'Academic Year', 'Score', 'Max', 'Percent'];
  ws1.getRow(HEADER_ROW).font = { bold: true };
  ws1.getRow(HEADER_ROW).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };

  let row = HEADER_ROW + 1;
  let totalScore = 0;
  let totalMax = 0;

  for (const sub of submissions) {
    const a = assessmentsById.get(sub.assessmentId);
    const p = pct(sub.totalScore, sub.totalMax);
    ws1.getRow(row).values = [
      a ? a.title : '(deleted assessment)',
      sub.submittedAt ? new Date(sub.submittedAt) : '',
      a && a.term ? `Term ${a.term}` : '',
      a ? a.academicYear || '' : '',
      sub.totalScore,
      sub.totalMax,
      p,
    ];
    ws1.getCell(`B${row}`).numFmt = 'yyyy-mm-dd';
    ws1.getCell(`G${row}`).numFmt = '0%';
    // Performance-band coloring on the Percent cell.
    const pCell = ws1.getCell(`G${row}`);
    if (p >= 0.7) pCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F7E9' } };
    else if (p >= 0.4) pCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF5E6' } };
    else pCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEEEEE' } };

    totalScore += sub.totalScore;
    totalMax += sub.totalMax;
    row++;
  }

  // Totals row
  if (submissions.length > 0) {
    ws1.getRow(row).values = ['Overall', '', '', '', totalScore, totalMax, pct(totalScore, totalMax)];
    ws1.getRow(row).font = { bold: true };
    ws1.getCell(`G${row}`).numFmt = '0%';
    ws1.getRow(row).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
  }

  ws1.columns.forEach((c, i) => {
    c.width = i === 0 ? 38 : i === 1 ? 12 : 14;
  });
  ws1.views = [{ state: 'frozen', ySplit: HEADER_ROW }];

  // ---- Sheet 2: Class comparison ----
  const ws2 = wb.addWorksheet('Class Comparison');
  ws2.getRow(1).values = ['Assessment', 'Date', 'Student %', 'Class average %', 'Class min %', 'Class max %'];
  ws2.getRow(1).font = { bold: true };
  ws2.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };

  let r2 = 2;
  for (const sub of submissions) {
    const a = assessmentsById.get(sub.assessmentId);
    const avg = classAverages[sub.assessmentId];
    const studentP = pct(sub.totalScore, sub.totalMax);
    ws2.getRow(r2).values = [
      a ? a.title : '(deleted)',
      sub.submittedAt ? new Date(sub.submittedAt) : '',
      studentP,
      avg ? pct(avg.mean, avg.maxPossible) : null,
      avg ? pct(avg.min, avg.maxPossible) : null,
      avg ? pct(avg.max, avg.maxPossible) : null,
    ];
    ws2.getCell(`B${r2}`).numFmt = 'yyyy-mm-dd';
    for (const col of ['C', 'D', 'E', 'F']) {
      ws2.getCell(`${col}${r2}`).numFmt = '0%';
    }
    // Highlight student vs class average comparison
    if (avg) {
      const classAvgPct = pct(avg.mean, avg.maxPossible);
      const cell = ws2.getCell(`C${r2}`);
      if (studentP > classAvgPct + 0.05) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F7E9' } };
      } else if (studentP < classAvgPct - 0.05) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEEEEE' } };
      }
    }
    r2++;
  }
  ws2.columns.forEach((c, i) => { c.width = i === 0 ? 38 : 14; });
  ws2.views = [{ state: 'frozen', ySplit: 1 }];

  // ---- Sheet 3: Rubric Progress (only if any writing assessments) ----
  const writingSubs = submissions.filter((s) => rubricAverages(s));
  if (writingSubs.length) {
    const ws3 = wb.addWorksheet('Rubric Progress');
    ws3.getRow(1).values = ['Assessment', 'Date', 'Content / 3', 'Organisation / 3', 'Grammar / 3', 'Lexis / 3', 'Total / 12'];
    ws3.getRow(1).font = { bold: true };
    ws3.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };

    let r3 = 2;
    let sumContent = 0, sumOrg = 0, sumGram = 0, sumLex = 0, sumTotal = 0;

    for (const sub of writingSubs) {
      const a = assessmentsById.get(sub.assessmentId);
      const av = rubricAverages(sub);
      const total = av.content + av.organisation + av.grammar + av.lexis;
      ws3.getRow(r3).values = [
        a ? a.title : '(deleted)',
        sub.submittedAt ? new Date(sub.submittedAt) : '',
        Math.round(av.content * 10) / 10,
        Math.round(av.organisation * 10) / 10,
        Math.round(av.grammar * 10) / 10,
        Math.round(av.lexis * 10) / 10,
        Math.round(total * 10) / 10,
      ];
      ws3.getCell(`B${r3}`).numFmt = 'yyyy-mm-dd';
      sumContent += av.content;
      sumOrg += av.organisation;
      sumGram += av.grammar;
      sumLex += av.lexis;
      sumTotal += total;
      r3++;
    }

    // Average row
    if (writingSubs.length > 0) {
      ws3.getRow(r3).values = [
        'Average across writing assessments',
        '',
        Math.round((sumContent / writingSubs.length) * 10) / 10,
        Math.round((sumOrg / writingSubs.length) * 10) / 10,
        Math.round((sumGram / writingSubs.length) * 10) / 10,
        Math.round((sumLex / writingSubs.length) * 10) / 10,
        Math.round((sumTotal / writingSubs.length) * 10) / 10,
      ];
      ws3.getRow(r3).font = { bold: true };
      ws3.getRow(r3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
    }

    ws3.columns.forEach((c, i) => { c.width = i === 0 ? 38 : 16; });
    ws3.views = [{ state: 'frozen', ySplit: 1 }];
  }

  // ---- Sheet 4: Teacher comments aggregated ----
  const withComments = submissions.filter((s) => (s.teacherComment || '').trim());
  if (withComments.length) {
    const ws4 = wb.addWorksheet('Teacher Comments');
    ws4.getRow(1).values = ['Assessment', 'Date', 'Comment'];
    ws4.getRow(1).font = { bold: true };
    ws4.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
    let r4 = 2;
    for (const sub of withComments) {
      const a = assessmentsById.get(sub.assessmentId);
      ws4.getRow(r4).values = [
        a ? a.title : '(deleted)',
        sub.submittedAt ? new Date(sub.submittedAt) : '',
        sub.teacherComment,
      ];
      ws4.getCell(`B${r4}`).numFmt = 'yyyy-mm-dd';
      ws4.getCell(`C${r4}`).alignment = { wrapText: true, vertical: 'top' };
      r4++;
    }
    ws4.columns = [{ width: 30 }, { width: 14 }, { width: 80 }];
    ws4.views = [{ state: 'frozen', ySplit: 1 }];
  }

  // ---- Bilingual: optional translated summary sheet ----
  if (secondLang && LABELS[secondLang]) {
    const ws5 = wb.addWorksheet(LANG_NAME[secondLang] || secondLang);
    ws5.mergeCells('A1:E1');
    ws5.getCell('A1').value = `${L(secondLang, 'title')} — ${student.name}`;
    ws5.getCell('A1').font = { size: 18, bold: true };
    ws5.getCell('A1').alignment = { horizontal: 'center' };

    ws5.getCell('A3').value = L(secondLang, 'student');
    ws5.getCell('B3').value = student.name;
    ws5.getCell('A4').value = L(secondLang, 'email');
    ws5.getCell('B4').value = student.email;
    ws5.getCell('A5').value = L(secondLang, 'term');
    ws5.getCell('B5').value = term ? `${L(secondLang, 'term')} ${term}` : '—';
    ws5.getCell('A6').value = L(secondLang, 'year');
    ws5.getCell('B6').value = academicYear || '—';
    ws5.getCell('A7').value = L(secondLang, 'teacher');
    ws5.getCell('B7').value = teacherName || '—';
    for (const r of [3, 4, 5, 6, 7]) ws5.getCell(`A${r}`).font = { bold: true };

    const HR = 9;
    ws5.getRow(HR).values = [
      L(secondLang, 'assessment'),
      L(secondLang, 'dateCol'),
      L(secondLang, 'score'),
      L(secondLang, 'percent'),
      L(secondLang, 'classAvg'),
    ];
    ws5.getRow(HR).font = { bold: true };
    ws5.getRow(HR).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };

    let r5 = HR + 1;
    for (const sub of submissions) {
      const a = assessmentsById.get(sub.assessmentId);
      const p = pct(sub.totalScore, sub.totalMax);
      const avg = classAverages[sub.assessmentId];
      ws5.getRow(r5).values = [
        a ? a.title : '(deleted)',
        sub.submittedAt ? new Date(sub.submittedAt) : '',
        `${sub.totalScore} / ${sub.totalMax}`,
        p,
        avg ? pct(avg.mean, avg.maxPossible) : null,
      ];
      ws5.getCell(`B${r5}`).numFmt = 'yyyy-mm-dd';
      ws5.getCell(`D${r5}`).numFmt = '0%';
      ws5.getCell(`E${r5}`).numFmt = '0%';
      r5++;
    }

    ws5.columns.forEach((c, i) => { c.width = i === 0 ? 36 : 16; });
    if (secondLang === 'ar') {
      ws5.views = [{ rightToLeft: true, state: 'frozen', ySplit: HR }];
    } else {
      ws5.views = [{ state: 'frozen', ySplit: HR }];
    }

    // Translate teacher comments and append below the table
    if (withComments.length) {
      const commentsToTranslate = withComments.map((s) => s.teacherComment);
      const translated = await translateStrings(commentsToTranslate, secondLang);
      r5 += 1; // blank row spacer
      ws5.getRow(r5).values = [L(secondLang, 'teacherComments')];
      ws5.getRow(r5).font = { bold: true, size: 14 };
      r5++;
      for (let i = 0; i < withComments.length; i++) {
        const sub = withComments[i];
        const a = assessmentsById.get(sub.assessmentId);
        ws5.getRow(r5).values = [
          a ? a.title : '(deleted)',
          sub.submittedAt ? new Date(sub.submittedAt) : '',
          translated[i] || sub.teacherComment,
        ];
        ws5.getCell(`B${r5}`).numFmt = 'yyyy-mm-dd';
        ws5.getCell(`C${r5}`).alignment = { wrapText: true, vertical: 'top' };
        r5++;
      }
    }
  }

  return wb;
}

// -- Word -------------------------------------------------------------------

function tableHeaderCell(text) {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })],
    shading: { fill: 'EEF2FF' },
  });
}
function tableCell(text) {
  return new TableCell({
    children: [new Paragraph(String(text))],
  });
}

async function generateStudentWordReport({
  student, submissions, assessmentsById, classAverages, teacherName, term, academicYear, schoolName, secondLang,
}) {
  // Build the English version first (as before), then if a regional language
  // is requested, append a translated copy below the English version.
  const children = [];

  // ---- Title ----
  children.push(new Paragraph({
    children: [new TextRun({
      text: schoolName ? schoolName.toUpperCase() : 'CLASSCURIO',
      bold: true, size: 24,
    })],
    alignment: AlignmentType.CENTER,
  }));
  children.push(new Paragraph({
    text: 'Student Term Report',
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    spacing: { after: 300 },
  }));

  // ---- Student info block ----
  const infoLines = [
    ['Student', student.name],
    ['Email', student.email],
    ['Term', term ? `Term ${term}` : 'All terms'],
    ['Academic Year', academicYear || '—'],
    ['Class Teacher', teacherName || '—'],
    ['Report Date', new Date().toLocaleDateString()],
  ];
  for (const [k, v] of infoLines) {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: `${k}: `, bold: true }),
        new TextRun(String(v)),
      ],
      spacing: { after: 80 },
    }));
  }

  // ---- Summary table ----
  children.push(new Paragraph({
    text: 'Summary of Assessments',
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 300, after: 200 },
  }));

  const summaryRows = [
    new TableRow({
      children: ['Assessment', 'Date', 'Score', 'Percent', 'Class Average %'].map(tableHeaderCell),
    }),
  ];

  let totalScore = 0;
  let totalMax = 0;
  for (const sub of submissions) {
    const a = assessmentsById.get(sub.assessmentId);
    const p = Math.round(pct(sub.totalScore, sub.totalMax) * 100);
    const avg = classAverages[sub.assessmentId];
    const classP = avg ? Math.round(pct(avg.mean, avg.maxPossible) * 100) : null;
    summaryRows.push(new TableRow({
      children: [
        tableCell(a ? a.title : '(deleted)'),
        tableCell(dateStr(sub.submittedAt)),
        tableCell(`${sub.totalScore} / ${sub.totalMax}`),
        tableCell(`${p}%`),
        tableCell(classP != null ? `${classP}%` : '—'),
      ],
    }));
    totalScore += sub.totalScore;
    totalMax += sub.totalMax;
  }
  // Overall row
  if (submissions.length) {
    summaryRows.push(new TableRow({
      children: [
        tableCell('Overall'),
        tableCell(''),
        tableCell(`${totalScore} / ${totalMax}`),
        tableCell(`${Math.round(pct(totalScore, totalMax) * 100)}%`),
        tableCell(''),
      ],
    }));
  }

  children.push(new Table({
    rows: summaryRows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  }));

  // ---- Performance commentary (auto-generated narrative) ----
  if (submissions.length) {
    const overallPct = Math.round(pct(totalScore, totalMax) * 100);
    let band;
    if (overallPct >= 80) band = 'consistently strong';
    else if (overallPct >= 65) band = 'solid and at grade level';
    else if (overallPct >= 50) band = 'developing — meeting some expectations';
    else band = 'needing focused support to reach grade-level expectations';

    children.push(new Paragraph({
      text: 'Performance Commentary',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 300, after: 200 },
    }));
    children.push(new Paragraph({
      text: `${student.name} has completed ${submissions.length} assessment${submissions.length === 1 ? '' : 's'} this term, achieving an overall score of ${totalScore} / ${totalMax} (${overallPct}%). Performance this term has been ${band}.`,
      spacing: { after: 200 },
    }));
  }

  // ---- Rubric progress (writing assessments) ----
  const writingSubs = submissions.filter((s) => rubricAverages(s));
  if (writingSubs.length) {
    children.push(new Paragraph({
      text: 'Writing Rubric Progress',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 300, after: 200 },
    }));

    const sums = { content: 0, organisation: 0, grammar: 0, lexis: 0 };
    for (const sub of writingSubs) {
      const av = rubricAverages(sub);
      sums.content += av.content;
      sums.organisation += av.organisation;
      sums.grammar += av.grammar;
      sums.lexis += av.lexis;
    }
    const avgs = {
      content: sums.content / writingSubs.length,
      organisation: sums.organisation / writingSubs.length,
      grammar: sums.grammar / writingSubs.length,
      lexis: sums.lexis / writingSubs.length,
    };

    const niceNames = {
      content: 'Content & Task Achievement',
      organisation: 'Organisation & Cohesion',
      grammar: 'Grammatical Range & Accuracy',
      lexis: 'Lexical Range & Accuracy',
    };

    const rubricRows = [
      new TableRow({
        children: ['Criterion', 'Average', 'Level'].map(tableHeaderCell),
      }),
    ];
    for (const k of ['content', 'organisation', 'grammar', 'lexis']) {
      const v = avgs[k];
      let level;
      if (v >= 2.5) level = 'Beyond grade level';
      else if (v >= 1.5) level = 'At grade level';
      else level = 'Towards grade level';
      rubricRows.push(new TableRow({
        children: [
          tableCell(niceNames[k]),
          tableCell(`${v.toFixed(1)} / 3`),
          tableCell(level),
        ],
      }));
    }
    children.push(new Table({
      rows: rubricRows,
      width: { size: 100, type: WidthType.PERCENTAGE },
    }));

    children.push(new Paragraph({
      text: `Based on ${writingSubs.length} writing assessment${writingSubs.length === 1 ? '' : 's'} this term.`,
      spacing: { before: 100 },
    }));
  }

  // ---- Teacher's narrative comments per assessment ----
  const withComments = submissions.filter((s) => (s.teacherComment || '').trim());
  if (withComments.length) {
    children.push(new Paragraph({
      text: "Teacher's Comments",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 300, after: 200 },
    }));
    for (const sub of withComments) {
      const a = assessmentsById.get(sub.assessmentId);
      children.push(new Paragraph({
        children: [new TextRun({
          text: `${a ? a.title : 'Assessment'} (${dateStr(sub.submittedAt)})`,
          bold: true,
        })],
        spacing: { after: 80 },
      }));
      children.push(new Paragraph({
        text: sub.teacherComment,
        spacing: { after: 200 },
      }));
    }
  }

  // ---- Footer / signature line ----
  children.push(new Paragraph({
    text: '',
    spacing: { before: 600 },
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: '_______________________________', }) ],
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: `${teacherName || 'Class Teacher'}`, bold: true })],
  }));

  // ---- Bilingual section: same content in the chosen regional language ----
  if (secondLang && LABELS[secondLang]) {
    children.push(new Paragraph({ text: '', pageBreakBefore: true }));
    children.push(new Paragraph({
      text: L(secondLang, 'title'),
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }));

    // Student info block (translated labels, untranslated values).
    const infoLinesT = [
      [L(secondLang, 'student'), student.name],
      [L(secondLang, 'email'), student.email],
      [L(secondLang, 'term'), term ? `${L(secondLang, 'term')} ${term}` : '—'],
      [L(secondLang, 'year'), academicYear || '—'],
      [L(secondLang, 'teacher'), teacherName || '—'],
      [L(secondLang, 'date'), new Date().toLocaleDateString()],
    ];
    for (const [k, v] of infoLinesT) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `${k}: `, bold: true }),
          new TextRun(String(v)),
        ],
        spacing: { after: 80 },
      }));
    }

    // Summary table in the regional language.
    children.push(new Paragraph({
      text: L(secondLang, 'summary'),
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 300, after: 200 },
    }));

    const summaryRowsT = [
      new TableRow({
        children: [
          L(secondLang, 'assessment'),
          L(secondLang, 'dateCol'),
          L(secondLang, 'score'),
          L(secondLang, 'percent'),
          L(secondLang, 'classAvg'),
        ].map(tableHeaderCell),
      }),
    ];

    let totalScore2 = 0, totalMax2 = 0;
    for (const sub of submissions) {
      const a = assessmentsById.get(sub.assessmentId);
      const p = Math.round(pct(sub.totalScore, sub.totalMax) * 100);
      const avg = classAverages[sub.assessmentId];
      const classP = avg ? Math.round(pct(avg.mean, avg.maxPossible) * 100) : null;
      summaryRowsT.push(new TableRow({
        children: [
          tableCell(a ? a.title : '(deleted)'),
          tableCell(dateStr(sub.submittedAt)),
          tableCell(`${sub.totalScore} / ${sub.totalMax}`),
          tableCell(`${p}%`),
          tableCell(classP != null ? `${classP}%` : '—'),
        ],
      }));
      totalScore2 += sub.totalScore;
      totalMax2 += sub.totalMax;
    }
    if (submissions.length) {
      summaryRowsT.push(new TableRow({
        children: [
          tableCell(L(secondLang, 'overall')),
          tableCell(''),
          tableCell(`${totalScore2} / ${totalMax2}`),
          tableCell(`${Math.round(pct(totalScore2, totalMax2) * 100)}%`),
          tableCell(''),
        ],
      }));
    }
    children.push(new Table({
      rows: summaryRowsT,
      width: { size: 100, type: WidthType.PERCENTAGE },
    }));

    // Translated narrative commentary (use Claude API).
    const stringsToTranslate = [];
    if (submissions.length) {
      const overallPct = Math.round(pct(totalScore2, totalMax2) * 100);
      let band;
      if (overallPct >= 80) band = 'consistently strong';
      else if (overallPct >= 65) band = 'solid and at grade level';
      else if (overallPct >= 50) band = 'developing — meeting some expectations';
      else band = 'needing focused support to reach grade-level expectations';
      stringsToTranslate.push(
        `${student.name} has completed ${submissions.length} assessment${submissions.length === 1 ? '' : 's'} this term, achieving an overall score of ${totalScore2} / ${totalMax2} (${overallPct}%). Performance this term has been ${band}.`
      );
    }
    // Translate teacher comments
    const withCommentsT = submissions.filter((s) => (s.teacherComment || '').trim());
    for (const sub of withCommentsT) {
      stringsToTranslate.push(sub.teacherComment);
    }

    const translated = await translateStrings(stringsToTranslate, secondLang);

    if (submissions.length) {
      children.push(new Paragraph({
        text: L(secondLang, 'commentary'),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 200 },
      }));
      children.push(new Paragraph({
        text: translated[0],
        spacing: { after: 200 },
      }));
    }

    // Rubric averages translated
    const writingSubsT = submissions.filter((s) => rubricAverages(s));
    if (writingSubsT.length) {
      children.push(new Paragraph({
        text: L(secondLang, 'rubric'),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 200 },
      }));

      const sums = { content: 0, organisation: 0, grammar: 0, lexis: 0 };
      for (const sub of writingSubsT) {
        const av = rubricAverages(sub);
        sums.content += av.content;
        sums.organisation += av.organisation;
        sums.grammar += av.grammar;
        sums.lexis += av.lexis;
      }
      const avgs = {
        content: sums.content / writingSubsT.length,
        organisation: sums.organisation / writingSubsT.length,
        grammar: sums.grammar / writingSubsT.length,
        lexis: sums.lexis / writingSubsT.length,
      };

      const rubricRowsT = [
        new TableRow({
          children: [L(secondLang, 'criterion'), L(secondLang, 'average'), L(secondLang, 'level')].map(tableHeaderCell),
        }),
      ];
      const niceNamesT = {
        content: L(secondLang, 'content'),
        organisation: L(secondLang, 'organisation'),
        grammar: L(secondLang, 'grammar'),
        lexis: L(secondLang, 'lexis'),
      };
      for (const k of ['content', 'organisation', 'grammar', 'lexis']) {
        const v = avgs[k];
        let level;
        if (v >= 2.5) level = L(secondLang, 'beyond');
        else if (v >= 1.5) level = L(secondLang, 'at');
        else level = L(secondLang, 'towards');
        rubricRowsT.push(new TableRow({
          children: [
            tableCell(niceNamesT[k]),
            tableCell(`${v.toFixed(1)} / 3`),
            tableCell(level),
          ],
        }));
      }
      children.push(new Table({
        rows: rubricRowsT,
        width: { size: 100, type: WidthType.PERCENTAGE },
      }));
    }

    // Translated teacher comments
    if (withCommentsT.length) {
      children.push(new Paragraph({
        text: L(secondLang, 'teacherComments'),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 200 },
      }));
      // First narrative was at translated[0], then comments start
      for (let i = 0; i < withCommentsT.length; i++) {
        const sub = withCommentsT[i];
        const a = assessmentsById.get(sub.assessmentId);
        children.push(new Paragraph({
          children: [new TextRun({
            text: `${a ? a.title : 'Assessment'} (${dateStr(sub.submittedAt)})`,
            bold: true,
          })],
          spacing: { after: 80 },
        }));
        children.push(new Paragraph({
          text: translated[1 + i] || sub.teacherComment,
          spacing: { after: 200 },
        }));
      }
    }
  }

  return new Document({
    creator: 'ClassCurio',
    title: `${student.name} — Term Report`,
    sections: [{ children }],
  });
}

module.exports = {
  generateStudentExcelReport,
  generateStudentWordReport,
  rubricAverages,
};
