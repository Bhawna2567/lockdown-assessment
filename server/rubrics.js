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

// =============================================================================
//  Stage 3-5 Writing Rubric (5 criteria × 0-8 marks = 40 marks total)
// =============================================================================
//  Source: ClassCurio teacher upload (Stage 3-5 Writing Rubric 2.pdf).
//  Bands: 7-8 (top), 5-6, 3-4, 2, 1, 0. Each criterion scored 0-8 within band.
const STAGE_3_5 = {
  stage: '3-5',
  title: 'Stage 3-5 Writing Rubric',
  totalMax: 40,
  scoreMin: 0,
  scoreMax: 8,
  criteria: [
    {
      id: 'task_completion', name: 'Task Completion', max: 8,
      bands: {
        '7-8': 'Student writes an extended response, obviously reaching or exceeding the expected length, which covers all aspects of the prompt.',
        '5-6': 'Student writes an adequately extended response, approximating the word count, with most aspects covered (no more than one area of the prompt missed).',
        '3-4': 'Student expresses several ideas which cover more than one aspect of the prompt, although more than one area is missed or not covered in sufficient detail.',
        '2': 'Student expresses an idea that covers at least one aspect of the prompt.',
        '1': "Student's writing does not cover any aspect of the prompt.",
        '0': 'No response, or entirety of response plagiarised.',
      },
    },
    {
      id: 'structure', name: 'Structure', max: 8,
      bands: {
        '7-8': 'Response is clearly structured appropriately in paragraphs with evident attempt at an opening and closing.',
        '5-6': 'Response is structured to resemble a clear paragraph with a logical progression of ideas.',
        '3-4': 'Response contains clearly connected text, sentences and ideas. Sentences may be disconnected and not structured into paragraphs.',
        '2': 'Response contains a clear attempt at sentence structure in responding to prompt.',
        '1': 'Response does not appear to be structured in any conventional sense, even in terms of sentences.',
        '0': 'No response.',
      },
    },
    {
      id: 'grammar', name: 'Grammar', max: 8,
      bands: {
        '7-8': 'Response uses a range of simple and possibly some complex grammatical structures appropriate to the prompt/questions. Grammatical errors are infrequent and do not affect readability.',
        '5-6': 'Response uses a range of grammar appropriate to the prompt/questions. Grammatical errors may sometimes affect readability.',
        '3-4': 'Response uses basic grammar appropriate to the prompt/questions. Grammatical errors may be frequent.',
        '2': 'Response shows some attempt at the most basic grammatical structures (e.g. subject-verb use) but there are frequent errors.',
        '1': 'No attempt at grammatical structures is identifiable.',
        '0': 'No response.',
      },
    },
    {
      id: 'vocabulary', name: 'Vocabulary', max: 8,
      bands: {
        '7-8': 'Response uses a few examples of more uncommon or sophisticated vocabulary for the specific topic of the task.',
        '5-6': 'Vocabulary is adequate to communicate a response to the topic, but may largely depend on common/simple vocabulary.',
        '3-4': 'Vocabulary range is clearly limited, but just about sufficient to cover some topics in the prompt.',
        '2': 'A few examples of basic, high-frequency words are used which relate to the topic and task.',
        '1': 'Response contains very little that can be identified as appropriate vocabulary for the task.',
        '0': 'No response.',
      },
    },
    {
      id: 'spelling_punctuation', name: 'Spelling and Punctuation', max: 8,
      bands: {
        '7-8': "There are examples of accuracy in even higher-level spelling and punctuation. There may be multiple errors, but they mostly don't affect readability.",
        '5-6': 'Common vocabulary is mostly spelt accurately, and sentences contain basic punctuation. There may be frequent spelling errors with more difficult words.',
        '3-4': 'There are examples of accurate spelling and punctuation throughout, but also frequent errors.',
        '2': 'There is some attempt at punctuation. Spelling shows some signs of phonemic awareness, but many errors are found.',
        '1': 'Response contains no punctuation and/or almost every word is spelt so as to be barely decipherable.',
        '0': 'No response.',
      },
    },
  ],
};

// =============================================================================
//  Stage 5-9 Writing Rubric (5 criteria × 0-8 marks = 40 marks total)
// =============================================================================
//  Source: ClassCurio teacher upload (Stage 5-9 Writing Rubric [40].pdf).
//  Same banded structure as Stage 3-5 but more advanced descriptors.
const STAGE_5_9 = {
  stage: '5-9',
  title: 'Stage 5-9 Writing Rubric',
  totalMax: 40,
  scoreMin: 0,
  scoreMax: 8,
  criteria: [
    {
      id: 'task_completion', name: 'Task Completion', max: 8,
      bands: {
        '7-8': 'Student writes an extended and sophisticated response, with all aspects of the prompt covered in detail.',
        '5-6': 'Student writes an extended response, obviously achieving the expected length, which covers all aspects of the prompt.',
        '3-4': 'Student writes an adequately extended response, approximating the word count, with most aspects covered (no more than one area of the prompt missed).',
        '2': 'Student expresses several ideas, but more than one area of the prompt is missed or not dealt with in sufficient detail.',
        '1': "Student's writing does not cover any aspect of the prompt.",
        '0': 'No response, or entirety of response plagiarised.',
      },
    },
    {
      id: 'structure', name: 'Structure', max: 8,
      bands: {
        '7-8': 'Entire response is appropriately structured with awareness of style and audience.',
        '5-6': 'Response is clearly structured appropriately in paragraphs with evident attempt at an introduction, main body and conclusion.',
        '3-4': 'Response is written using a paragraph or more which contain a topic sentence and supporting ideas.',
        '2': 'Response is clearly structured into sentences but there is little to no attempt to structure into a paragraph.',
        '1': 'Response does not appear to be structured in any conventional sense, even in terms of sentences.',
        '0': 'No response.',
      },
    },
    {
      id: 'grammar', name: 'Grammar', max: 8,
      bands: {
        '7-8': 'Response uses both simple and complex language structures. Language chosen is appropriate to the task, with only isolated minor mistakes, if any.',
        '5-6': 'Response uses a range of simple and complex grammatical structures appropriate to the prompt/questions. Grammatical errors are infrequent and do not affect readability.',
        '3-4': 'Response uses a range of grammar appropriate to the prompt/questions. Grammatical errors may sometimes affect readability.',
        '2': 'Response uses only basic grammar to answer the prompt/questions. Grammatical errors may be frequent.',
        '1': 'No attempt at grammatical structures is identifiable.',
        '0': 'No response.',
      },
    },
    {
      id: 'vocabulary', name: 'Vocabulary', max: 8,
      bands: {
        '7-8': 'Response uses a range of technical and sophisticated vocabulary for the specific topic of the task.',
        '5-6': 'Response uses a few examples of more technical or sophisticated vocabulary for the specific topic of the task.',
        '3-4': 'Vocabulary is adequate to communicate a response to the topic, but may largely depend on common/simple vocabulary.',
        '2': 'Vocabulary range is clearly limited, and is not sufficient to address some topics in the prompt.',
        '1': 'Response contains very little that can be identified as appropriate vocabulary for the task.',
        '0': 'No response.',
      },
    },
    {
      id: 'spelling_punctuation', name: 'Spelling and Punctuation', max: 8,
      bands: {
        '7-8': 'Spelling and punctuation are consistently accurate, even within complex words and sentences.',
        '5-6': "There are examples of accuracy in more complex spelling and punctuation. There may be multiple errors, but they mostly don't affect readability.",
        '3-4': 'Common vocabulary is mostly spelt accurately and sentences contain basic punctuation. There may be frequent spelling errors with more complex words.',
        '2': 'There are examples of accurate spelling and punctuation throughout, but also frequent errors.',
        '1': 'Response contains little to no punctuation and/or almost every word is spelt so as to be barely decipherable.',
        '0': 'No response.',
      },
    },
  ],
};

const RUBRICS = {
  '7': STAGE_7,
  '8': STAGE_8,
  '3-5': STAGE_3_5,
  '5-9': STAGE_5_9,
};

function getRubric(stage) {
  return RUBRICS[String(stage)] || null;
}

// Build a single string the LLM will see, listing every criterion and band.
// Handles BOTH the old 1/2/3 numeric-band rubrics AND the new banded rubrics
// (7-8, 5-6, 3-4, 2, 1, 0).
function rubricAsText(rubric) {
  const lines = [`${rubric.title} — total possible: ${rubric.totalMax} marks`];
  for (const c of rubric.criteria) {
    lines.push('');
    lines.push(`### ${c.name} (out of ${c.max})`);
    // Sort band keys descending so the highest band is listed first.
    const bandKeys = Object.keys(c.bands).sort((a, b) => {
      // For ranges like "7-8", use the LOW end for comparison.
      const aLow = parseInt(String(a).split('-')[0], 10);
      const bLow = parseInt(String(b).split('-')[0], 10);
      return bLow - aLow;
    });
    for (const band of bandKeys) {
      const label = String(band).includes('-')
        ? `${band} marks`
        : (band === '1' || band === 1) ? '1 mark' : `${band} marks`;
      lines.push(`- ${label}: ${c.bands[band]}`);
    }
  }
  return lines.join('\n');
}

module.exports = { getRubric, rubricAsText, STAGE_7, STAGE_8, STAGE_3_5, STAGE_5_9 };
