import type { Exercise, ExerciseOutcome, LearningLanguage, LessonModule, LessonSession, LessonStep } from '../types';

export interface LessonDraft {
  session: LessonSession;
  stepIndex: number;
  outcomes: ExerciseOutcome[];
  knownWordIds: string[];
  selectedAnswer: string | null;
  typedAnswer: string;
  isSubmitted: boolean;
}

const keyFor = (language: LearningLanguage) => `anki-plus-daily-draft-${language}`;
const exerciseTypes = new Set([
  'audio_to_translation_choice', 'translation_to_original_choice', 'original_to_translation_choice',
  'audio_to_original_input', 'translation_to_original_input', 'kanji_to_hiragana_input',
  'sentence_cloze_input', 'memory_check',
]);
const themes = new Set(['new', 'practice', 'review', 'reinforcement', 'recap', 'mistakes']);
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const fields = (value: Record<string, unknown>, names: string[]) => names.every((key) => typeof value[key] === 'string');

function isExercise(value: unknown): value is Exercise {
  return record(value) && fields(value, ['id', 'wordId', 'prompt', 'correctAnswer']) && exerciseTypes.has(String(value.type))
    && (value.context === undefined || typeof value.context === 'string')
    && (value.retryOfExerciseId === undefined || typeof value.retryOfExerciseId === 'string')
    && (value.options === undefined || (Array.isArray(value.options) && value.options.every((option: unknown) => record(option) && fields(option, ['id', 'label']))));
}

function isModule(value: unknown): value is LessonModule {
  return record(value) && fields(value, ['id', 'title', 'description']) && themes.has(String(value.theme))
    && (value.kind === 'preview' || value.kind === 'exercise') && integer(value.position)
    && strings(value.wordIds) && strings(value.stepIds) && strings(value.exerciseTypes)
    && value.exerciseTypes.every((type) => exerciseTypes.has(type));
}

function isStep(value: unknown): value is LessonStep {
  return record(value) && fields(value, ['id', 'wordId', 'moduleId', 'moduleTitle', 'moduleDescription'])
    && themes.has(String(value.moduleTheme)) && typeof value.allowMarkKnown === 'boolean'
    && integer(value.modulePosition) && integer(value.moduleCount) && integer(value.indexInModule) && integer(value.totalInModule)
    && (value.kind === 'preview' || (value.kind === 'exercise' && isExercise(value.exercise) && value.exercise.wordId === value.wordId));
}

function isOutcome(value: unknown): value is ExerciseOutcome {
  return record(value) && fields(value, ['exerciseId', 'wordId', 'userAnswer', 'correctAnswer'])
    && exerciseTypes.has(String(value.type)) && typeof value.isCorrect === 'boolean';
}

function isDraft(value: unknown): value is LessonDraft {
  if (!record(value) || !record(value.session)) return false;
  const session = value.session;
  if (!fields(session, ['id', 'title', 'startedAt']) || !Number.isFinite(Date.parse(String(session.startedAt)))
    || session.mode !== 'default' || session.presentation !== 'standard'
    || typeof session.durationMinutes !== 'number' || ![10, 20, 30].includes(session.durationMinutes)
    || !strings(session.exerciseIds) || !strings(session.sourceWordIds) || !strings(session.activePackIds)
    || !Array.isArray(session.exercises) || !session.exercises.every(isExercise)
    || !Array.isArray(session.modules) || session.modules.length !== 5 || !session.modules.every(isModule)
    || !Array.isArray(session.steps) || !session.steps.every(isStep) || session.steps.length === 0
    || !integer(value.stepIndex) || value.stepIndex >= session.steps.length
    || !Array.isArray(value.outcomes) || !value.outcomes.every(isOutcome) || !strings(value.knownWordIds)
    || !(value.selectedAnswer === null || typeof value.selectedAnswer === 'string')
    || typeof value.typedAnswer !== 'string' || typeof value.isSubmitted !== 'boolean') return false;
  const modules = session.modules as LessonModule[];
  const steps = session.steps as LessonStep[];
  const exercises = session.exercises as Exercise[];
  const outcomes = value.outcomes as ExerciseOutcome[];
  const stepIndex = value.stepIndex;
  const ids = new Set(steps.map((step) => step.id));
  if (ids.size !== steps.length || new Set(outcomes.map((outcome) => outcome.exerciseId)).size !== outcomes.length) return false;
  const equalList = (left: string[], right: string[]) => left.length === right.length && left.every((id, index) => id === right[index]);
  const equalSet = (left: string[], right: string[]) => new Set(left).size === left.length
    && left.length === new Set(right).size && left.every((id) => right.includes(id));
  if (new Set(modules.map((module) => module.id)).size !== modules.length) return false;
  if (!modules.every((module, index) => {
    const moduleSteps = steps.filter((step) => step.moduleId === module.id);
    return module.position === index + 1
      && equalList(module.stepIds, moduleSteps.map((step) => step.id))
      && equalSet(module.wordIds, moduleSteps.map((step) => step.wordId));
  })) return false;
  if (!steps.every((step) => modules.some((module) => module.id === step.moduleId
    && step.modulePosition === module.position && step.moduleCount === modules.length
    && step.moduleTitle === module.title && step.moduleTheme === module.theme
    && step.indexInModule === module.stepIds.indexOf(step.id) + 1 && step.totalInModule === module.stepIds.length))) return false;
  if (!equalList(session.exerciseIds, exercises.map((exercise) => exercise.id))
    || !equalSet(session.exerciseIds, steps.flatMap((step) => step.kind === 'exercise' ? [step.exercise.id] : []))
    || !equalSet(session.sourceWordIds, steps.map((step) => step.wordId))) return false;
  if (!steps.every((step) => step.kind !== 'exercise' || exercises.some((exercise) =>
    exercise.id === step.exercise.id && exercise.wordId === step.wordId && exercise.type === step.exercise.type
    && exercise.correctAnswer === step.exercise.correctAnswer && exercise.prompt === step.exercise.prompt
    && JSON.stringify(exercise.options) === JSON.stringify(step.exercise.options),
  ))) return false;
  if (!outcomes.every((outcome) => steps.some((step, index) => index <= stepIndex
    && step.kind === 'exercise' && step.exercise.id === outcome.exerciseId && step.wordId === outcome.wordId
    && step.exercise.type === outcome.type && step.exercise.correctAnswer === outcome.correctAnswer))) return false;
  const current = steps[stepIndex];
  const currentOutcome = current.kind === 'exercise' ? outcomes.find((outcome) => outcome.exerciseId === current.exercise.id) : undefined;
  return value.isSubmitted ? Boolean(currentOutcome && value.selectedAnswer === currentOutcome.userAnswer) : !currentOutcome;
}

export function loadLessonDraft(language: LearningLanguage): LessonDraft | null {
  try {
    const raw = window.localStorage.getItem(keyFor(language));
    if (!raw || raw.length > 4_000_000) return null;
    const envelope: unknown = JSON.parse(raw);
    return record(envelope) && envelope.version === 1 && isDraft(envelope.draft) ? envelope.draft : null;
  } catch {
    return null;
  }
}

export function saveLessonDraft(language: LearningLanguage, draft: LessonDraft | null): boolean {
  try {
    if (draft) window.localStorage.setItem(keyFor(language), JSON.stringify({ version: 1, draft }));
    else window.localStorage.removeItem(keyFor(language));
    return true;
  } catch {
    return false;
  }
}
