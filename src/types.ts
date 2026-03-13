export type WordStatus = 'new' | 'learning' | 'review' | 'mastered';
export type WordLevel = 'A1' | 'A2' | 'B1';
export type LessonMode = 'default' | 'mistakes';
export type DictionaryTab = 'all' | 'learning' | 'mastered' | 'hard';

export type ExerciseType =
  | 'audio_to_translation_choice'
  | 'translation_to_original_choice'
  | 'original_to_translation_choice'
  | 'audio_to_original_input';

export interface Word {
  id: string;
  original: string;
  translation: string;
  transcription: string;
  audio_original: string;
  example_original: string;
  example_translation: string;
  part_of_speech: string;
  level: WordLevel;
  tags: string[];
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
  exerciseIds: string[];
  exercises: Exercise[];
  sourceWordIds: string[];
  modules: LessonModule[];
  steps: LessonStep[];
}

export interface DailyStats {
  date: string;
  completedLessons: number;
  correctAnswers: number;
  totalAnswers: number;
  wordsLearned: number;
  reviewsCompleted: number;
}

export interface AppStorage {
  progressByWordId: Record<string, WordProgress>;
  dailyStats: DailyStats[];
  streakDays: number;
  lastLessonDate: string | null;
}

export interface LessonModule {
  id: string;
  title: string;
  description: string;
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
  masteredWords: number;
  totalWords: number;
  accuracy: number;
}
