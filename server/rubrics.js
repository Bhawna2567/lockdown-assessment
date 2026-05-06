// Stage 7 and Stage 8 writing rubrics, embedded for AI auto-grading.
// Source: ClassCurio teacher uploads (Stage 7 Writing Rubric.pdf, Stage 8 Writing Rubric.pdf).
// Each criterion is graded 1–3 marks; total per essay = 12.

const STAGE_7 = {
  stage: '7',
  title: 'Stage 7 Writing Rubric',
  totalMax: 12,
  criteria: [
    {
      id: 'content',
      name: 'Content & Task Achievement',
      max: 3,
      bands: {
        1: 'Towards Grade Level — All parts of prompt covered with some explanation, but explanations very limited and not developed. A simple, continuous, extended text. Sections connect in clear sequence. Ideas and perspectives have reasons or explanations, though development may be uneven. Uses a task-appropriate format consistently.',
        2: 'At Grade Level — All parts of prompt covered with explanation; some parts developed with reasons or examples; other parts have little added detail or rely on repetition. An extended, detailed and continuous text. Sections connect in clear sequence. Range of relevant ideas and perspectives with reasons and explanations. Uses a task-appropriate format consistently.',
        3: 'Beyond Grade Level — All parts of prompt clearly covered with explanation and supporting detail; development sustained across response; depth may vary and occasional repetition occurs. A clear, extended and detailed continuous text. Developed ideas with some detailed reasons and explanations. Uses a task-appropriate format consistently.',
      },
    },
    {
      id: 'organisation',
      name: 'Organisation & Cohesion',
      max: 3,
      bands: {
        1: 'Towards Grade Level — Ideas sequenced to fit purpose of task; sequence not controlled throughout whole text; some conventional features of the text type are attempted but only partly controlled. Uses increasing range of cohesive devices, referencing and substitution to connect ideas in ways that are generally coherent; links may sometimes be inaccurate or mechanical. Paragraphs clearly show topic sentences and supporting details.',
        2: 'At Grade Level — Ideas arranged in a clear sequence that holds across most of the text; some lapses in connection remain; texts generally follow conventional features of the required text type; developing awareness of audience. Uses increasing range of cohesive devices and referencing/substitution; links sometimes inaccurate or mechanical, giving uneven coherence. Paragraphs include topic sentences and supporting detail.',
        3: 'Beyond Grade Level — Ideas sequenced consistently across the text; progression is logical throughout; texts follow conventional text-type features for the task; show an increasing awareness of audience. Uses wide range of cohesive devices and referencing/substitution; coherence maintained across the text, despite occasional errors or overuse. Paragraphs include topic sentences and supporting detail.',
      },
    },
    {
      id: 'grammar',
      name: 'Grammatical Range & Accuracy',
      max: 3,
      bands: {
        1: 'Towards Grade Level — Increasing control of a varied range of sentence structures (e.g., subordination, coordination, passive voice), improving fluency and precision in less familiar topics; some inconsistency in advanced forms, particularly in abstract or unfamiliar contexts. Wide range of punctuation used (capital letters, full stops, commas, question marks, apostrophes, hyphens, etc.); errors rarely impede meaning.',
        2: 'At Grade Level — Flexible and accurate use of a broad range of grammatical structures across a variety of contexts (e.g., narrative, explanation, argument); more precise control of tense, aspect and modality; some errors with more advanced forms; generally non-disruptive, even in less familiar or abstract topics. Wide range of punctuation used; errors rarely impede meaning.',
        3: 'Beyond Grade Level — Consistent control of complex structures; ability to use tense, modality and sentence variety (e.g., inversion, conditionals, reported speech) to express nuanced meanings and respond to contextual demands; grammar choices support coherence and tone; subtle errors are infrequent. Wide range of punctuation used; errors rarely impede meaning.',
      },
    },
    {
      id: 'lexis',
      name: 'Lexical Range & Accuracy',
      max: 3,
      bands: {
        1: 'Towards Grade Level — Begins to use topic-specific vocabulary related to less familiar or semi-academic topics (e.g., aspects of culture, technology, and current events). Increasing control over synonyms, reformulation and strategies to avoid repetition. Some errors in spelling and/or word formation; these do not impede communication.',
        2: 'At Grade Level — Broad and varied range of vocabulary across general and some specialised topics. More precise, nuanced communication. Flexibility in sentence structure and tone.',
        3: 'Beyond Grade Level — Wide range of vocabulary, including appropriate collocations and synonyms. Growing awareness of subtle differences in meaning. Ability to adjust word choice to suit context and register.',
      },
    },
  ],
};

const STAGE_8 = {
  stage: '8',
  title: 'Stage 8 Writing Rubric',
  totalMax: 12,
  criteria: [
    {
      id: 'content',
      name: 'Content & Task Achievement',
      max: 3,
      bands: {
        1: 'Towards Grade Level — All parts of prompt covered with explanation; some parts developed with reasons or examples; other parts have little added detail or rely on repetition. An extended, detailed and continuous text. Range of relevant ideas and perspectives with reasons and explanations. Uses a task-appropriate format consistently.',
        2: 'At Grade Level — All parts of prompt clearly covered with explanation and supporting detail; development sustained across response; depth may vary and occasional repetition occurs. A clear, extended and detailed continuous text. Developed ideas with some detailed reasons and explanations. Uses a task-appropriate format consistently.',
        3: 'Beyond Grade Level — All parts of prompt are covered with detailed explanation and sustained development; balance across parts and sophistication of treatment remain limited. A clear, extended and detailed text. Connected ideas and perspectives with detailed reasons and extended explanations. Uses a task-appropriate format consistently.',
      },
    },
    {
      id: 'organisation',
      name: 'Organisation & Cohesion',
      max: 3,
      bands: {
        1: 'Towards Grade Level — Ideas arranged in a clear sequence that holds across most of the text; some lapses in connection remain; links sometimes inaccurate or mechanical, giving uneven coherence. Uses increasing range of cohesive devices and referencing/substitution. Texts generally follow conventional features of required text type; paragraphs include topic sentences and supporting detail; shows developing awareness of audience.',
        2: 'At Grade Level — Ideas sequenced consistently across the text; progression is logical throughout; coherence maintained across the text, despite occasional errors or overuse of cohesive devices or referencing/substitution. Uses wide range of cohesive devices and referencing/substitution. Texts follow conventional text-type features for the task; paragraphs include topic sentences and supporting detail; shows an increasing awareness of audience.',
        3: 'Beyond Grade Level — Ideas sequenced securely across the text; coherence is sustained throughout the text; organisation controlled throughout and clearly adapted to the task and audience. Uses a wide range of cohesive devices, with referencing and substitution, to connect ideas clearly. Texts clearly follow required text-type features; paragraphs include topic sentences and supporting detail; awareness of audience is clear and consistent.',
      },
    },
    {
      id: 'grammar',
      name: 'Grammatical Range & Accuracy',
      max: 3,
      bands: {
        1: 'Towards Grade Level — Flexible and accurate use of a broad range of grammatical structures across a variety of contexts (e.g., narrative, explanation, argument); more precise control of tense, aspect and modality; some errors with more advanced forms; generally non-disruptive, even in less familiar or abstract topics. Wide range of punctuation used; errors occur but rarely impede meaning.',
        2: 'At Grade Level — Consistent control of complex structures; ability to use tense, modality and sentence variety (e.g., inversion, conditionals, reported speech) to express nuanced meanings and respond to contextual demands; grammar choices support coherence and tone; subtle errors are infrequent. Wide range of punctuation used; errors may occur but rarely impede meaning.',
        3: 'Beyond Grade Level — Uses a wide and varied range of grammatical structures with high accuracy and flexibility; natural control over complex forms (e.g., mixed conditionals, reduced clauses); awareness of stylistic variation in formal and informal registers; errors are minimal (one or two minor errors) and usually limited to complex or unfamiliar contexts. Wide range of punctuation used; few errors may occur but do not impede meaning.',
      },
    },
    {
      id: 'lexis',
      name: 'Lexical Range & Accuracy',
      max: 3,
      bands: {
        1: 'Towards Grade Level — Broad and varied range of vocabulary across general and some specialised topics. More precise, nuanced communication. Flexibility in sentence structure and tone.',
        2: 'At Grade Level — Wide range of vocabulary, including appropriate collocations and synonyms. Growing awareness of subtle differences in meaning. Ability to adjust word choice to suit context and register.',
        3: 'Beyond Grade Level — Some idiomatic expressions, phrasal verbs and advanced collocations to enhance fluency. Increasing ability to adapt language to different contexts and registers (formal/informal, spoken/written).',
      },
    },
  ],
};

const RUBRICS = { 7: STAGE_7, 8: STAGE_8 };

function getRubric(stage) {
  return RUBRICS[String(stage)] || null;
}

// Build a single string the LLM will see, listing every criterion and band.
function rubricAsText(rubric) {
  const lines = [`${rubric.title} — total possible: ${rubric.totalMax} marks`];
  for (const c of rubric.criteria) {
    lines.push('');
    lines.push(`### ${c.name} (out of ${c.max})`);
    for (const band of [1, 2, 3]) {
      lines.push(`- ${band} mark${band === 1 ? '' : 's'}: ${c.bands[band]}`);
    }
  }
  return lines.join('\n');
}

module.exports = { getRubric, rubricAsText, STAGE_7, STAGE_8 };
