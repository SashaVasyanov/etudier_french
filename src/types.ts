export type WordStatus = 'new' | 'learning' | 'review' | 'known' | 'mastered' | 'difficult' | 'ignored';
export type WordLevel = 'A1' | 'A2' | 'B1';
/** Japanese Language Proficiency Test level, N5 (easiest) … N1. */
export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
export type LessonMode = 'default' | 'extra' | 'mistakes' | 'pack';
export type LessonDurationMinutes = 10 | 20 | 30;
export type LessonWordTarget = 10 | 15 | 20 | 25 | 30 | 35 | 40 | 45 | 50;
export type DictionaryTab = 'all' | 'learning' | 'mastered' | 'difficult';
export type LessonModuleTheme = 'new' | 'practice' | 'review' | 'reinforcement' | 'recap' | 'mistakes';
export type PackStatus = 'not_added' | 'added' | 'in_progress' | 'completed';
export type WordSource = 'core' | 'pack' | 'custom';
export type LearningLanguage = 'french' | 'japanese';
export type RadicalStatus = 'new' | 'learning' | 'mastered';

export type ExerciseType =
  | 'audio_to_translation_choice'
  | 'translation_to_original_choice'
  | 'original_to_translation_choice'
  | 'audio_to_original_input'
  | 'translation_to_original_input'
  | 'kanji_to_hiragana_input'
  | 'sentence_cloze_input'
  | 'memory_check'
  /** Put the words of the example sentence in order (options are the words). */
  | 'sentence_order'
  /** Hear the example sentence and choose its translation. */
  | 'audio_sentence_choice'
  /** French noun: choose le or la. */
  | 'article_choice'
  /** Japanese word with kanji: choose its reading. */
  | 'kanji_reading_choice'
  | 'sentence_dictation'
  /** Read the definition in the studied language and choose the word. */
  | 'definition_choice'
  /** Put the letters (Japanese: kana) of the word in order. */
  | 'letter_assembly';

/** How common the word is in everyday use. */
export type WordFrequency = 'high' | 'mid' | 'low';

/** An example sentence with the studied word in it. */
export interface WordExample {
  original: string;
  /** Japanese: the whole sentence in kana, for furigana. */
  reading?: string;
  translation: string;
  /** The studied word exactly as it appears in `original`. */
  form: string;
}

export interface Word {
  id: string;
  language: LearningLanguage;
  original: string;
  translation: string;
  transcription: string;
  audio_original: string;
  example_original: string;
  example_reading?: string;
  example_translation: string;
  part_of_speech: string;
  level: WordLevel;
  /** Japanese words only; missing when the word is not in the JLPT lists. */
  jlpt?: JlptLevel;
  tags: string[];
  packIds: string[];
  source: WordSource;
  imagePath?: string;
  imageUrl?: string;
  imageAlt?: string;
  imagePackCategory?: string;
  illustrationType?: string;
  imagePrompt?: string;
  imageSource?: string;
  imageSourceTitle?: string;
  imageProvider?: string;
  imageLicense?: string;
  imageLicenseUrl?: string;
  imageAttribution?: string;
  imageAssociationWordId?: string;
  /** French: IPA without slashes. */
  ipa?: string;
  frequency?: WordFrequency;
  /** A short definition in the studied language. */
  definition?: string;
  /** Japanese: the definition in kana. */
  definition_reading?: string;
  definition_translation?: string;
  /** Two or three examples; the first one is also `example_original`. */
  examples?: WordExample[];
}

export interface WordProgress {
  word_id: string;
  shown_count: number;
  correct_count: number;
  wrong_count: number;
  last_seen_at: string | null;
  next_review_at: string | null;
  ease_factor: number;
  interval_days: number;
  repetition_step: number;
  status: WordStatus;
  learned_at: string | null;
  /** Distinct local calendar days on which a due review was passed. */
  successful_review_dates: string[];
  /** FSRS memory: days until recall falls to 90 %. Absent on words scheduled
   *  before FSRS; derived from interval and ease on their next review. */
  stability?: number;
  /** FSRS difficulty, 1 (easy) … 10 (hard). */
  difficulty?: number;
  /** When the last graded review took place. */
  last_review_at?: string | null;
  /** Times the word was forgotten at a due review. */
  lapses?: number;
}

export type StorageErrorKind = 'read' | 'corrupt' | 'unsupported_version' | 'write';

export interface StorageError {
  kind: StorageErrorKind;
  message: string;
  /** When true, automatic writes must pause until the learner explicitly continues. */
  blocksSave: boolean;
}

export interface StorageLoadResult {
  storage: AppStorage;
  error: StorageError | null;
}

export type StorageSaveResult =
  | { ok: true }
  | { ok: false; error: StorageError };

export interface ExerciseOption {
  id: string;
  label: string;
}

export interface Exercise {
  id: string;
  type: ExerciseType;
  wordId: string;
  prompt: string;
  correctAnswer: string;
  context?: string;
  options?: ExerciseOption[];
  retryOfExerciseId?: string;
}

export interface ExerciseOutcome {
  exerciseId: string;
  wordId: string;
  type: ExerciseType;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  /** Time from showing the task to the answer, ms. */
  responseMs?: number;
  /** Accepted with a one-letter typo («почти верно»). */
  nearMiss?: boolean;
  /** Answered after taking a hint (the key button). */
  hinted?: boolean;
}

export interface LessonSession {
  id: string;
  title: string;
  mode: LessonMode;
  presentation: 'standard' | 'flashcards';
  durationMinutes: LessonDurationMinutes;
  startedAt: string;
  exerciseIds: string[];
  exercises: Exercise[];
  sourceWordIds: string[];
  modules: LessonModule[];
  steps: LessonStep[];
  activePackIds: string[];
}

export interface DailyStats {
  date: string;
  language: LearningLanguage;
  completedLessons: number;
  correctAnswers: number;
  totalAnswers: number;
  wordsLearned: number;
  reviewsCompleted: number;
}

export interface DailyLessonRecord {
  date: string;
  language: LearningLanguage;
  completedAt: string;
  sessionId: string;
  totalModules: number;
  completedModules: number;
  totalSteps: number;
  completedSteps: number;
  correctAnswers: number;
  totalAnswers: number;
  newWords: number;
  reviewWords: number;
  reinforcementWords: number;
  knownWords: number;
  difficultWordIds: string[];
  timeSpentSeconds: number;
}

export interface StudyHistoryEntry {
  id: string;
  date: string;
  language: LearningLanguage;
  completedAt: string;
  sessionId: string;
  mode: LessonMode;
  durationMinutes: LessonDurationMinutes;
  moduleTitles: string[];
  modulesCompleted: number;
  wordsLearned: number;
  mistakesMade: number;
  correctAnswers: number;
  totalAnswers: number;
  timeSpentSeconds: number;
  activePackIds: string[];
}

export interface UserProfile {
  displayName: string;
  createdAt: string;
  updatedAt: string;
  lastStudiedAt: string | null;
}

export interface UserPackState {
  packId: string;
  status: PackStatus;
  addedAt: string | null;
  completedAt: string | null;
}

export interface KanjiExample {
  character: string;
  reading: string;
  meaning: string;
  isReference?: boolean;
}

export interface KanjiRadical {
  id: string;
  number: number;
  isFeatured: boolean;
  symbol: string;
  variants: string[];
  meaning: string;
  japaneseName: string;
  japaneseReading: string;
  strokes: number;
  position: string;
  description: string;
  mnemonic: string;
  examples: KanjiExample[];
}

export interface RadicalProgress {
  radicalId: string;
  attempts: number;
  correctAnswers: number;
  wrongAnswers: number;
  status: RadicalStatus;
  lastStudiedAt: string | null;
  masteredAt: string | null;
}

export interface RadicalExerciseOutcome {
  radicalId: string;
  isCorrect: boolean;
}

export interface RadicalStudyHistoryEntry {
  id: string;
  date: string;
  completedAt: string;
  radicalIds: string[];
  correctAnswers: number;
  totalAnswers: number;
}

export interface AppStorage {
  learningLanguage: LearningLanguage;
  progressByWordId: Record<string, WordProgress>;
  dailyStats: DailyStats[];
  completedDailyLessons: DailyLessonRecord[];
  streakDays: number;
  lastLessonDate: string | null;
  /** Missed days that did not break the streak (one per seven days). */
  streakFreezeDates: string[];
  lessonDurationEnabled: boolean;
  lessonDurationMinutes: LessonDurationMinutes;
  lessonWordTarget: LessonWordTarget;
  lessonSourcePackId: string | null;
  profile: UserProfile;
  studyHistory: StudyHistoryEntry[];
  packStates: Record<string, UserPackState>;
  customWords: Word[];
  customPacks: WordPack[];
  radicalProgressById: Record<string, RadicalProgress>;
  radicalStudyHistory: RadicalStudyHistoryEntry[];
  /** Lessons finished per language over all time; history itself is capped. */
  lessonTotals: Record<LearningLanguage, number>;
  /** Hour (0–6) at which a new study day starts; 0 = midnight. */
  dayStartHour: number;
  /** Katakana reading practice, keyed by the katakana character. */
  kanaProgress: Record<string, KanaProgress>;
  /** Voice per language (speechSynthesis voiceURI) and speaking rate. */
  speech: SpeechPreferences;
  /** Target chance of recalling a word at its review (FSRS), 0.8–0.97. */
  desiredRetention: number;
  /** Best «Минута на скорость» score per language. */
  speedRecords?: Partial<Record<LearningLanguage, number>>;
  /** Reading comfort, sound and reminders; defaults when absent. */
  comfort?: ComfortPreferences;
  /** How this learner's lapses compare with the FSRS forecast, per language. */
  memoryCalibration?: Partial<Record<LearningLanguage, MemoryCalibration>>;
}

export interface MemoryCalibration {
  /** Faded sum of forecast lapse chances at due reviews. */
  expectedLapses: number;
  /** Faded count of real lapses at the same reviews. */
  actualLapses: number;
  reviews: number;
  /** Faded count of the same reviews (for the recent recall rate). */
  weight?: number;
}

export type TextSize = 'normal' | 'large' | 'larger';

export interface ComfortPreferences {
  textSize: TextSize;
  /** Say words aloud by themselves (word cards, answers). Listening tasks always play. */
  autoplay: boolean;
  /** Calm the interface: no animations or transitions. */
  reduceMotion: boolean;
  /** Number of reviews due on the Dock icon. */
  dockBadge: boolean;
  /** Daily reminder at this local time («HH:MM»), or off. */
  reminderTime: string | null;
  /** Japanese: readings over the kanji of example sentences. */
  furigana: boolean;
  /** Japanese: romaji next to the kana reading of a word. */
  romaji: boolean;
}

export interface SpeechPreferences {
  voices: Partial<Record<LearningLanguage, string>>;
  rate: number;
}

export interface KanaProgress {
  correct: number;
  wrong: number;
  /** Correct answers in a row; three in a row = the sign is learned. */
  streak: number;
  lastSeenAt: string | null;
}

export interface DailyLessonCompletionPayload {
  record: DailyLessonRecord;
  historyEntry: StudyHistoryEntry;
}

export interface LessonModule {
  id: string;
  title: string;
  description: string;
  theme: LessonModuleTheme;
  position: number;
  kind: 'preview' | 'exercise';
  wordIds: string[];
  exerciseTypes: ExerciseType[];
  stepIds: string[];
}

export type LessonStep =
  | {
      id: string;
      moduleId: string;
      moduleTitle: string;
      moduleDescription: string;
      moduleTheme: LessonModuleTheme;
      modulePosition: number;
      moduleCount: number;
      allowMarkKnown: boolean;
      kind: 'preview';
      wordId: string;
      indexInModule: number;
      totalInModule: number;
    }
  | {
      id: string;
      moduleId: string;
      moduleTitle: string;
      moduleDescription: string;
      moduleTheme: LessonModuleTheme;
      modulePosition: number;
      moduleCount: number;
      allowMarkKnown: boolean;
      kind: 'exercise';
      exercise: Exercise;
      wordId: string;
      indexInModule: number;
      totalInModule: number;
    };

export interface LessonSummary {
  newWords: number;
  learningWords: number;
  reviewWords: number;
  difficultWords: number;
  masteredWords: number;
  totalWords: number;
  accuracy: number;
}

export interface WordPack {
  id: string;
  language: LearningLanguage;
  title: string;
  description: string;
  accent: string;
  words: Word[];
  coverImageUrl?: string;
  coverImageAlt?: string;
}
