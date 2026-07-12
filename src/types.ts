export type WordStatus = 'new' | 'learning' | 'review' | 'mastered' | 'difficult' | 'ignored';
export type WordLevel = 'A1' | 'A2' | 'B1';
export type LessonMode = 'default' | 'extra' | 'mistakes' | 'pack';
export type LessonDurationMinutes = 10 | 20 | 30;
export type LessonWordTarget = 10 | 15 | 20 | 25 | 30 | 35 | 40 | 45 | 50;
export type DictionaryTab = 'all' | 'learning' | 'mastered' | 'difficult';
export type LessonModuleTheme = 'new' | 'practice' | 'review' | 'reinforcement' | 'recap' | 'mistakes';
export type PackStatus = 'not_added' | 'added' | 'in_progress' | 'completed';
export type WordSource = 'core' | 'pack' | 'custom';
export type LearningLanguage = 'french' | 'japanese';

export type ExerciseType =
  | 'audio_to_translation_choice'
  | 'translation_to_original_choice'
  | 'original_to_translation_choice'
  | 'audio_to_original_input'
  | 'memory_check';

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
}

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
}

export interface ExerciseOutcome {
  exerciseId: string;
  wordId: string;
  type: ExerciseType;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
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

export interface AppStorage {
  learningLanguage: LearningLanguage;
  progressByWordId: Record<string, WordProgress>;
  dailyStats: DailyStats[];
  completedDailyLessons: DailyLessonRecord[];
  streakDays: number;
  lastLessonDate: string | null;
  lessonDurationEnabled: boolean;
  lessonDurationMinutes: LessonDurationMinutes;
  lessonWordTarget: LessonWordTarget;
  lessonSourcePackId: string | null;
  profile: UserProfile;
  studyHistory: StudyHistoryEntry[];
  packStates: Record<string, UserPackState>;
  customWords: Word[];
  customPacks: WordPack[];
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
