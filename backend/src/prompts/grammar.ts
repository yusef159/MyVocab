export type GrammarLevelId = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface GrammarSkill {
  id: string;
  levelId: GrammarLevelId;
  title: string;
  description?: string;
  aiTopicHint?: string;
  order?: number;
}

export interface GrammarLessonExample {
  sentence: string;
  explanation?: string;
}

export interface GrammarLessonSection {
  title: string;
  body: string;
  examples?: GrammarLessonExample[];
  commonMistakes?: string[];
}

export interface GrammarLesson {
  skillId: string;
  levelId: GrammarLevelId;
  intro?: string;
  sections: GrammarLessonSection[];
}

export type GrammarExerciseType = 'mcq' | 'fillBlank' | 'rewrite' | 'freeSentence';

export interface GrammarExerciseOption {
  id: string;
  text: string;
}

export interface GrammarExercise {
  id: string;
  skillId: string;
  levelId: GrammarLevelId;
  type: GrammarExerciseType;
  prompt: string;
  options?: GrammarExerciseOption[];
  correctOptionId?: string;
  correctAnswerText?: string;
  explanation?: string;
}

export interface GrammarLevelSummary {
  id: GrammarLevelId;
  title: string;
  description?: string;
  skills: GrammarSkill[];
}

export interface GrammarCatalog {
  levels: GrammarLevelSummary[];
}

export interface GrammarAnswerEvaluation {
  isCorrect: boolean;
  score: number;
  feedback: string;
  correctedAnswer?: string;
}

export function grammarCatalogPrompt(): string {
  return `
You are designing a CEFR-aligned English grammar curriculum for Arabic speakers.

Define a compact catalog of core grammar skills for each CEFR level A1–C2.

For each level, give:
- id: one of "A1" | "A2" | "B1" | "B2" | "C1" | "C2"
- title: a short human title, e.g. "A1 Beginner"
- description: 1 short sentence
- skills: array of:
  - id: short stable id in kebab-case (e.g. "present-simple", "articles-a-an-the")
  - levelId: same as the level id
  - title: user-facing title (2–5 words)
  - description: very short description (max 80 chars)
  - aiTopicHint: optional hint for future prompts (1 concise sentence)

Keep it compact:
- 6–10 skills per level.
- Focus on the most useful grammar for everyday communication.

Return STRICT JSON:
{
  "levels": [
    {
      "id": "A1",
      "title": "A1 Beginner",
      "description": "...",
      "skills": [ ... ]
    },
    ...
  ]
}

Do NOT include any commentary or markdown, only the JSON object.
`.trim();
}

export function grammarLessonPrompt(args: {
  levelId: GrammarLevelId;
  skillId: string;
  skillTitle?: string;
  skillDescription?: string;
}): string {
  const { levelId, skillId, skillTitle, skillDescription } = args;

  return `
You are tutoring English grammar to an Arabic-speaking learner.

Create a focused lesson for the grammar skill:
- CEFR level: ${levelId}
- Skill id: ${skillId}
- Skill title: ${skillTitle ?? ''}
- Skill description: ${skillDescription ?? ''}

The lesson must be clear, concise, and practical.

Structure:
- intro: 1–3 short sentences explaining when/why this structure is used.
- sections: 2–4 sections, each with:
  - title: short heading
  - body: short explanation (max ~120 words)
  - examples: 2–4 examples with:
    - sentence: natural example using this grammar
    - explanation: very short explanation in simple English
  - commonMistakes: list of typical learner mistakes (2–4 entries).

Return STRICT JSON:
{
  "lesson": {
    "skillId": "${skillId}",
    "levelId": "${levelId}",
    "intro": "...",
    "sections": [
      {
        "title": "...",
        "body": "...",
        "examples": [
          { "sentence": "...", "explanation": "..." }
        ],
        "commonMistakes": ["...", "..."]
      }
    ]
  }
}

Do NOT include commentary or markdown, only the JSON object.
`.trim();
}

export function grammarExercisesPrompt(args: {
  levelId: GrammarLevelId;
  skillId: string;
  skillTitle?: string;
  count: number;
}): string {
  const { levelId, skillId, skillTitle, count } = args;

  const safeCount = Math.max(1, Math.min(15, count));

  return `
You are creating practice exercises for an English grammar learner (Arabic speaker).

Grammar focus:
- CEFR level: ${levelId}
- Skill id: ${skillId}
- Skill title: ${skillTitle ?? ''}

Create ${safeCount} mixed exercises ONLY about this grammar skill.

Allowed exercise types:
- "mcq": multiple choice (1 correct option, 3–4 distractors)
- "fillBlank": fill in the blank(s) with the correct form/word(s)
- "rewrite": rewrite a sentence using a given instruction
- "freeSentence": ask learner to write their own sentence

For each exercise:
- id: short id (e.g. "ex-1", "ex-2")
- skillId: "${skillId}"
- levelId: "${levelId}"
- type: "mcq" | "fillBlank" | "rewrite" | "freeSentence"
- prompt: the question / instruction text
- options: for "mcq" only, 4 options each:
  - { "id": "a", "text": "..." }
- correctOptionId: for "mcq" only, one of the option ids
- correctAnswerText: for non-mcq types, the expected correct answer or model answer
- explanation: short explanation why it is correct (1–2 sentences)

Return STRICT JSON:
{
  "exercises": [
    {
      "id": "ex-1",
      "skillId": "${skillId}",
      "levelId": "${levelId}",
      "type": "mcq",
      "prompt": "...",
      "options": [
        { "id": "a", "text": "..." },
        { "id": "b", "text": "..." },
        { "id": "c", "text": "..." },
        { "id": "d", "text": "..." }
      ],
      "correctOptionId": "b",
      "correctAnswerText": "...",
      "explanation": "..."
    }
  ]
}

Do NOT include commentary or markdown, only the JSON object.
`.trim();
}

export function grammarGradePrompt(args: {
  exercise: GrammarExercise;
  userAnswer: string | string[];
}): string {
  const { exercise, userAnswer } = args;

  return `
You are grading a learner's answer to an English grammar exercise.

Exercise (JSON):
${JSON.stringify(exercise, null, 2)}

Learner answer (string or list of strings):
${JSON.stringify(userAnswer, null, 2)}

Tasks:
1. Decide if the learner's answer is fully correct for this grammar focus.
2. Give a score between 0 and 1 (1 = perfect, 0 = completely wrong).
3. Give very short feedback in simple English (max 3 sentences).
4. If the answer is not perfect, suggest a corrected version (or one corrected example).

Return STRICT JSON:
{
  "evaluation": {
    "isCorrect": true,
    "score": 1,
    "feedback": "Very short feedback...",
    "correctedAnswer": "Corrected version or best answer"
  }
}

Do NOT include commentary or markdown, only the JSON object.
`.trim();
}

