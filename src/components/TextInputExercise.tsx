import { useEffect, useRef } from 'react';
import { getLearningLanguageAdverb, getLearningLanguageTitle } from '../lib/languages';
import { getExerciseCopy } from '../lib/wordPresentation';
import type { Exercise, Word } from '../types';
import { AnswerWordDetails } from './AnswerWordDetails';
import { CenteredWordBlock } from './CenteredWordBlock';
import { JapaneseExampleReading } from './JapaneseExampleReading';
import { LessonCard } from './LessonCard';

interface TextInputExerciseProps {
  exercise: Exercise;
  word: Word;
  value: string;
  isSubmitted: boolean;
  isCorrect?: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onReplayAudio: () => void;
  onNext: () => void;
  onMarkKnown?: () => void;
  onIgnoreWord?: () => void;
}

export function TextInputExercise({
  exercise,
  word,
  value,
  isSubmitted,
  isCorrect,
  onChange,
  onSubmit,
  onReplayAudio,
  onNext,
  onMarkKnown,
  onIgnoreWord,
}: TextInputExerciseProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);
  const copy = getExerciseCopy(exercise.type, word.language);
  const languageAdverb = getLearningLanguageAdverb(word.language);
  const languageTitle = getLearningLanguageTitle(word.language);
  const isAudioExercise = exercise.type === 'audio_to_original_input';
  const isReadingExercise = exercise.type === 'kanji_to_hiragana_input';
  const isClozeExercise = exercise.type === 'sentence_cloze_input';
  const answerFormatHint = isReadingExercise
    ? 'Хирагана обязательна; катакана тоже будет распознана'
    : word.language === 'japanese'
      ? 'Подойдут кандзи, хирагана, катакана или ромадзи'
      : `Ответ должен быть на ${languageTitle} языке; артикль можно не писать`;
  const placeholder = isReadingExercise
    ? 'Введите чтение хираганой'
    : `Напишите слово ${languageAdverb}`;

  useEffect(() => {
    if (!isSubmitted) {
      inputRef.current?.focus();
      return undefined;
    }

    nextButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Enter') {
        return;
      }

      const target = event.target;

      if (target instanceof HTMLButtonElement) {
        return;
      }

      event.preventDefault();
      onNext();
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [exercise.id, isSubmitted, onNext]);

  return (
    <LessonCard
      className={[
        'lesson-exercise-card',
        'lesson-input-card',
        isClozeExercise ? 'lesson-cloze-card' : '',
        isReadingExercise ? 'lesson-reading-card' : '',
      ].filter(Boolean).join(' ')}
      header={
        <header className="exercise-header lesson-focus-header">
          <span className="eyebrow">{exercise.retryOfExerciseId ? 'Возврат к ошибке' : copy.eyebrow}</span>
          <h2 className="exercise-title">{copy.title}</h2>
          {isAudioExercise ? (
            <div className="audio-panel lesson-audio-panel">
              <button className="audio-button audio-button-prominent" type="button" onClick={onReplayAudio}>
                Повторить аудио
              </button>
              <p className="lesson-prompt-copy">{copy.hint}</p>
            </div>
          ) : isClozeExercise ? (
            <div className="cloze-prompt-panel">
              <p className="cloze-prompt" lang={word.language === 'japanese' ? 'ja' : 'fr'}>{exercise.prompt}</p>
              {exercise.context ? <p className="cloze-context" lang="ru">{exercise.context}</p> : null}
            </div>
          ) : (
            <CenteredWordBlock
              title={exercise.prompt}
              subtitle={copy.hint}
              titleClassName={isReadingExercise ? 'lesson-prompt-title lesson-kanji-reading-prompt' : 'lesson-prompt-title lesson-translation'}
              subtitleClassName="lesson-prompt-copy"
            />
          )}
        </header>
      }
      body={
        <div className="exercise-input-panel">
          <label className="input-label" htmlFor={`word-answer-${exercise.id}`}>
            Ваш ответ
          </label>
          <input
            id={`word-answer-${exercise.id}`}
            ref={inputRef}
            className="text-input"
            value={value}
            disabled={isSubmitted}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck="false"
            placeholder={placeholder}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') {
                return;
              }

              event.preventDefault();

              if (isSubmitted) {
                onNext();
                return;
              }

              if (value.trim()) {
                onSubmit();
              }
            }}
          />

          <div className="input-meta">
            <span>{answerFormatHint}</span>
          </div>

          {isSubmitted ? (
            <>
              <div className={isCorrect ? 'answer-feedback success' : 'answer-feedback error'}>
                <div>
                  <strong>{isCorrect ? 'Верно' : 'Неправильно'}</strong>
                  <AnswerWordDetails word={word} />
                </div>
                <button type="button" className="feedback-replay-button" onClick={onReplayAudio}>
                  Прослушать ещё раз
                </button>
              </div>
              {isClozeExercise ? (
                <div className="cloze-answer-context">
                  <p className="example-original" lang={word.language === 'japanese' ? 'ja' : 'fr'}>{word.example_original}</p>
                  {word.language === 'japanese' ? <JapaneseExampleReading word={word} /> : null}
                  <p className="example-translation" lang="ru">{word.example_translation}</p>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      }
      actions={
        <>
          <button
            ref={nextButtonRef}
            type="button"
            className="primary-button full-width"
            disabled={!isSubmitted && !value.trim()}
            onClick={isSubmitted ? onNext : onSubmit}
          >
            {isSubmitted ? 'Дальше' : 'Проверить'}
          </button>
          {onMarkKnown || onIgnoreWord ? (
            <div className="lesson-word-action-row">
              {onMarkKnown ? (
                <button type="button" className="secondary-button full-width" onClick={onMarkKnown}>
                  Уже знаю
                </button>
              ) : null}
              {onIgnoreWord ? (
                <button type="button" className="danger-button full-width" onClick={onIgnoreWord}>
                  Не хочу учить
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      }
    />
  );
}
