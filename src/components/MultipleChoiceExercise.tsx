import { useEffect, useMemo, useRef, useState } from 'react';
import type { Exercise, Word } from '../types';
import { containsJapaneseKanji, getDisplayWord, getExerciseCopy, getJapaneseExampleReading } from '../lib/wordPresentation';
import { AnswerWordDetails } from './AnswerWordDetails';
import { AnswerContext } from './AnswerContext';
import { CenteredWordBlock } from './CenteredWordBlock';
import { LessonCard } from './LessonCard';
import { LessonChoiceButton } from './LessonChoiceButton';
import { HintButton } from './HintButton';
import { AppIcon } from './AppIcon';
import { WordImage } from './WordImage';
import { SentenceAudioButton } from './SentenceAudioButton';
import { JapaneseSentence } from './JapaneseSentence';
import { formatTranscription } from '../lib/readingPrefs';

interface MultipleChoiceExerciseProps {
  exercise: Exercise;
  word: Word;
  selectedAnswer: string | null;
  isSubmitted: boolean;
  onSelect: (answer: string) => void;
  onNext: () => void;
  onReplayAudio?: () => void;
  onMarkKnown?: () => void;
  onIgnoreWord?: () => void;
  /** How many hints were taken on this task; the first removes wrong options. */
  hintsUsed?: number;
  onHint?: () => void;
}

export function MultipleChoiceExercise({
  exercise,
  word,
  selectedAnswer,
  isSubmitted,
  onSelect,
  onNext,
  onReplayAudio,
  onMarkKnown,
  onIgnoreWord,
  hintsUsed = 0,
  onHint,
}: MultipleChoiceExerciseProps) {
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);
  const isAudioExercise = exercise.type === 'audio_to_translation_choice';
  const isOriginalExercise = exercise.type === 'original_to_translation_choice';
  const isTranslationExercise = exercise.type === 'translation_to_original_choice';
  const isSentenceAudio = exercise.type === 'audio_sentence_choice';
  const isArticle = exercise.type === 'article_choice';
  const isReading = exercise.type === 'kanji_reading_choice';
  const isDefinition = exercise.type === 'definition_choice';
  // «Подсказка» shows the Russian translation of the definition.
  const [hintShown, setHintShown] = useState(false);
  const copy = getExerciseCopy(exercise.type, word.language);
  const options = exercise.options;
  // The hint takes away half of the wrong answers (two of four).
  const canHint = Boolean(onHint) && !isArticle && (options?.length ?? 0) >= 3;
  const hiddenLabels = useMemo(() => {
    if (!hintsUsed || !options || options.length < 3) return new Set<string>();
    const wrong = options.filter((option) => option.label !== exercise.correctAnswer).map((option) => option.label);
    return new Set(wrong.slice(-(options.length >= 4 ? 2 : 1)));
  }, [exercise.correctAnswer, hintsUsed, options]);
  const cardClassName = [
    'lesson-exercise-card',
    isTranslationExercise ? 'lesson-image-choice-card' : '',
    isDefinition ? 'lesson-definition-card' : '',
    isOriginalExercise ? 'lesson-translation-choice-card' : '',
    isAudioExercise || isSentenceAudio ? 'lesson-audio-choice-card' : '',
    isSentenceAudio ? 'lesson-sentence-choice-card' : '',
    isArticle ? 'lesson-article-card' : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Keys 1–9 pick an answer, so a lesson can be done from the keyboard.
  useEffect(() => {
    if (isSubmitted || !exercise.options?.length) {
      return undefined;
    }

    const options = exercise.options;
    function handleDigit(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      const index = Number(event.key) - 1;
      if (Number.isInteger(index) && index >= 0 && index < options.length && !hiddenLabels.has(options[index].label)) {
        event.preventDefault();
        onSelect(options[index].label);
      }
    }

    window.addEventListener('keydown', handleDigit);
    return () => window.removeEventListener('keydown', handleDigit);
  }, [exercise.options, hiddenLabels, isSubmitted, onSelect]);

  useEffect(() => {
    if (!isSubmitted) {
      return undefined;
    }

    nextButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Enter') {
        return;
      }

      const target = event.target;

      if (
        target instanceof HTMLButtonElement ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      event.preventDefault();
      onNext();
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSubmitted, onNext]);

  const showAnswerImage = isOriginalExercise || isTranslationExercise || isDefinition;

  return (
    <LessonCard
      className={cardClassName}
      header={
        <header className="exercise-header lesson-prototype-header">
          <span className="eyebrow">{copy.eyebrow}</span>
          {isOriginalExercise ? (
            <CenteredWordBlock
              title={getDisplayWord(word)}
              subtitle={formatTranscription(word.transcription, word.language) || copy.hint}
              titleClassName="lesson-prompt-title lesson-word-title"
              titleLang={word.language === 'japanese' ? 'ja' : undefined}
            />
          ) : null}
          {isTranslationExercise ? (
            <CenteredWordBlock
              title={word.translation}
              subtitle={copy.hint}
              titleClassName="lesson-prompt-title lesson-translation"
              subtitleClassName="lesson-prompt-copy"
            />
          ) : null}
          {isDefinition ? (
            <div className="definition-prompt">
              <p className="definition-prompt-text" lang={word.language === 'japanese' ? 'ja' : 'fr'}>
                <JapaneseSentence text={exercise.prompt} reading={word.definition === exercise.prompt ? word.definition_reading : null} />
              </p>
              {exercise.context ? (
                hintShown || isSubmitted ? (
                  <p className="definition-prompt-hint" lang="ru">{exercise.context}</p>
                ) : (
                  <button type="button" className="text-action-button definition-hint-button" onClick={() => setHintShown(true)}>
                    Подсказка: перевод определения
                  </button>
                )
              ) : null}
              <p className="lesson-prompt-copy">{copy.hint}</p>
            </div>
          ) : null}
          {isArticle ? (
            <CenteredWordBlock
              title={exercise.prompt}
              subtitle={`${exercise.context ?? ''} · ${copy.hint}`}
              titleClassName="lesson-prompt-title lesson-word-title"
              titleLang={word.language === 'japanese' ? 'ja' : undefined}
              subtitleClassName="lesson-prompt-copy"
            />
          ) : null}
          {isReading ? (
            <CenteredWordBlock
              title={exercise.prompt}
              subtitle={`${exercise.context ?? ''} · ${copy.hint}`}
              titleClassName="lesson-prompt-title lesson-word-title"
              titleLang={word.language === 'japanese' ? 'ja' : undefined}
              subtitleClassName="lesson-prompt-copy"
            />
          ) : null}
          {isSentenceAudio ? (
            <div className="audio-panel lesson-audio-panel">
              <button className="audio-round-button" type="button" onClick={onReplayAudio} title="Повторить фразу (R)" aria-label="Повторить фразу">
                <AppIcon name="volume" size={44} />
              </button>
              <p className="lesson-prompt-copy">{copy.hint}</p>
            </div>
          ) : null}
          {isAudioExercise ? (
            <div className="audio-panel lesson-audio-panel">
              <button className="audio-round-button" type="button" onClick={onReplayAudio} title="Повторить аудио (R)" aria-label="Повторить аудио">
                <AppIcon name="volume" size={44} />
              </button>
              <p className="lesson-prompt-copy">{copy.hint}</p>
            </div>
          ) : null}
        </header>
      }
      body={
        <>
          {canHint && !isSubmitted ? (
            <div className="lesson-hint-row">
              <span>{hintsUsed ? 'Осталось два варианта' : 'Не уверены? Возьмите подсказку'}</span>
              <HintButton label="Подсказка: убрать два неверных варианта" disabled={hintsUsed > 0} onClick={() => onHint?.()} />
            </div>
          ) : null}
          <div
            className={[
              'choice-list',
              isTranslationExercise || isDefinition || isArticle || isReading ? 'lesson-choice-grid' : 'lesson-choice-stack',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {exercise.options?.map((option, optionIndex) => {
              const isCorrect = option.label === exercise.correctAnswer;
              const isSelected = option.label === selectedAnswer;
              const isHidden = hiddenLabels.has(option.label);
              const state = isHidden && !isSubmitted ? 'muted' : isSubmitted
                ? isCorrect
                  ? 'correct'
                  : isSelected
                    ? 'incorrect'
                    : 'muted'
                : isSelected
                  ? 'selected'
                  : 'default';

              return (
                <LessonChoiceButton
                  key={option.id + option.label}
                  state={state}
                  disabled={isSubmitted || isHidden}
                  className={[word.language === 'japanese' && containsJapaneseKanji(option.label) ? 'japanese-kanji-choice' : '', isHidden ? 'hint-removed' : ''].filter(Boolean).join(' ')}
                  onClick={() => onSelect(option.label)}
                >
                  {exercise.options!.length <= 9 ? <span className="choice-key" aria-hidden="true">{optionIndex + 1}</span> : null}
                  <span lang={word.language === 'japanese' && (isTranslationExercise || isDefinition || isReading) ? 'ja' : isArticle || isDefinition ? 'fr' : undefined}>{option.label}</span>
                </LessonChoiceButton>
              );
            })}
          </div>
          {isSubmitted ? (
            <div className={selectedAnswer === exercise.correctAnswer ? 'answer-feedback success' : 'answer-feedback error'}>
              <div>
                <strong>
                  {selectedAnswer === exercise.correctAnswer ? (hintsUsed ? 'Верно, с подсказкой' : 'Верно') : (
                    <>Правильный ответ: <span lang={word.language === 'japanese' && (isTranslationExercise || isDefinition) ? 'ja' : undefined}>{exercise.correctAnswer}</span></>
                  )}
                </strong>
                <AnswerWordDetails word={word} />
                {isSentenceAudio ? (
                  <div className="feedback-example example-line">
                    <span lang={word.language === 'japanese' ? 'ja' : 'fr'}><JapaneseSentence text={word.example_original} reading={getJapaneseExampleReading(word)} /></span>
                    <SentenceAudioButton text={word.example_original} language={word.language} />
                  </div>
                ) : (
                  <AnswerContext word={word} showDefinition={!isDefinition} />
                )}
              </div>
              {showAnswerImage || onReplayAudio ? (
                <div className="answer-feedback-aside">
                  {/* The picture is the reward for answering: beside the answer, so all of it fits on one screen. */}
                  {showAnswerImage ? <WordImage word={word} size="large" className="answer-feedback-image" /> : null}
                  {onReplayAudio ? (
                    <button type="button" className="feedback-replay-button" onClick={onReplayAudio}>
                      Прослушать ещё раз
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      }
      actions={
        <>
          {isSubmitted ? (
            <button ref={nextButtonRef} type="button" className="primary-button full-width" onClick={onNext}>
              Дальше <kbd className="key-hint" aria-hidden="true">Enter</kbd>
            </button>
          ) : null}
          {onMarkKnown || onIgnoreWord ? (
            <div className="lesson-word-action-row">
              {onMarkKnown ? (
                <button type="button" className="secondary-button full-width" onClick={onMarkKnown}>
                  Уже знаю
                </button>
              ) : null}
              {onIgnoreWord ? (
                <button type="button" className="danger-button quiet-danger full-width" onClick={onIgnoreWord}>
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
