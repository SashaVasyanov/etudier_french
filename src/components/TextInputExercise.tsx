import { useEffect, useRef } from 'react';
import { getLearningLanguageAdverb, getLearningLanguageTitle } from '../lib/languages';
import { diffAnswer, editDistance, normalizeDictation, stripFrenchArticleForDisplay } from '../lib/utils';
import { getExerciseCopy, getJapaneseHiraganaReading } from '../lib/wordPresentation';
import { HintButton } from './HintButton';
import { AppIcon } from './AppIcon';
import { WordImage } from './WordImage';
import type { Exercise, Word } from '../types';
import { AnswerWordDetails } from './AnswerWordDetails';
import { AnswerContext } from './AnswerContext';
import { CenteredWordBlock } from './CenteredWordBlock';
import { LessonCard } from './LessonCard';

interface TextInputExerciseProps {
  exercise: Exercise;
  word: Word;
  value: string;
  isSubmitted: boolean;
  isCorrect?: boolean;
  /** Accepted with a one-letter typo. */
  nearMiss?: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onReplayAudio: () => void;
  onNext: () => void;
  onMarkKnown?: () => void;
  onIgnoreWord?: () => void;
  /** Hints taken: each one fills in one more letter of the answer. */
  hintsUsed?: number;
  onHint?: () => void;
}

export function TextInputExercise({
  exercise,
  word,
  value,
  isSubmitted,
  isCorrect,
  nearMiss = false,
  onChange,
  onSubmit,
  onReplayAudio,
  onNext,
  onMarkKnown,
  onIgnoreWord,
  hintsUsed = 0,
  onHint,
}: TextInputExerciseProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);
  // A «Заполните пропуск» task left in a lesson saved before it was dropped is
  // asked as «Напишите слово» by its translation.
  const isLegacyCloze = exercise.type === 'sentence_cloze_input';
  const copy = getExerciseCopy(isLegacyCloze ? 'translation_to_original_input' : exercise.type, word.language);
  const prompt = isLegacyCloze ? word.translation : exercise.prompt;
  const languageAdverb = getLearningLanguageAdverb(word.language);
  const languageTitle = getLearningLanguageTitle(word.language);
  const isDictation = exercise.type === 'sentence_dictation';
  const isAudioExercise = exercise.type === 'audio_to_original_input' || isDictation;
  const isReadingExercise = exercise.type === 'kanji_to_hiragana_input';
  const isTranslationPrompt = exercise.type === 'translation_to_original_input' || exercise.type === 'sentence_cloze_input';
  // Japanese answers are hinted in kana, so the hint does not need an IME.
  const hintTarget = word.language === 'japanese' && !isReadingExercise
    ? getJapaneseHiraganaReading(word) ?? exercise.correctAnswer
    : exercise.correctAnswer;
  const canHint = Boolean(onHint) && !isDictation && hintTarget.length > 1;
  const hintsLeft = canHint && hintsUsed < hintTarget.length - 1;
  function takeHint() {
    const shown = Math.min(hintsUsed + 1, hintTarget.length - 1);
    onChange(hintTarget.slice(0, shown));
    onHint?.();
    inputRef.current?.focus();
  }
  const answerFormatHint = isDictation
    ? 'Заглавные буквы и знаки препинания не проверяются'
    : isReadingExercise
    ? 'Хирагана обязательна; катакана тоже будет распознана'
    : word.language === 'japanese'
      ? 'Подойдут кандзи, хирагана, катакана или ромадзи'
      : `Ответ должен быть на ${languageTitle} языке; артикль можно не писать`;
  const placeholder = isDictation
    ? 'Напишите фразу, которую услышали'
    : isReadingExercise
    ? 'Введите чтение хираганой'
    : `Напишите слово ${languageAdverb}`;

  useEffect(() => {
    if (!isSubmitted) {
      inputRef.current?.focus();
      return undefined;
    }

    nextButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      // The Enter that submitted the answer bubbles up from the input after
      // React has already re-rendered and attached this listener. Ignore it
      // (and IME/auto-repeat Enters), otherwise the result screen is skipped.
      if (event.key !== 'Enter' || event.defaultPrevented || event.isComposing || event.repeat) {
        return;
      }

      const target = event.target;

      if (target instanceof Element && target.closest('button, input, textarea, select, a, [contenteditable="true"]')) {
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

  // Letter-by-letter comparison when the typed answer is close to the
  // dictionary form but not equal: a typo, a missing accent or a near guess.
  const answerDiff = (() => {
    if (!isSubmitted || !value.trim() || word.language !== 'french') return null;
    // A dictation is compared as heard: without case and punctuation.
    const typed = isDictation ? normalizeDictation(value) : stripFrenchArticleForDisplay(value.trim());
    const expected = isDictation ? normalizeDictation(exercise.correctAnswer) : stripFrenchArticleForDisplay(exercise.correctAnswer.trim());
    if (typed.toLocaleLowerCase() === expected.toLocaleLowerCase()) return null;
    const close = editDistance(typed.toLocaleLowerCase(), expected.toLocaleLowerCase()) <= Math.max(2, Math.ceil(expected.length / 2));
    return isCorrect || nearMiss || close ? diffAnswer(typed, expected) : null;
  })();

  return (
    <LessonCard
      className={[
        'lesson-exercise-card',
        'lesson-input-card',
        isReadingExercise ? 'lesson-reading-card' : '',
      ].filter(Boolean).join(' ')}
      header={
        <header className="exercise-header lesson-focus-header">
          <span className="eyebrow">{exercise.retryOfExerciseId ? 'Возврат к ошибке' : copy.eyebrow}</span>
          <h2 className="exercise-title">{copy.title}</h2>
          {isAudioExercise ? (
            <div className="audio-panel lesson-audio-panel">
              <button className="audio-round-button" type="button" onClick={onReplayAudio} title="Повторить аудио (R)" aria-label="Повторить аудио">
                <AppIcon name="volume" size={44} />
              </button>
              <p className="lesson-prompt-copy">{copy.hint}</p>
            </div>
          ) : (
            <CenteredWordBlock
              title={prompt}
              subtitle={copy.hint}
              titleClassName={isReadingExercise ? 'lesson-prompt-title lesson-kanji-reading-prompt' : 'lesson-prompt-title lesson-translation'}
              subtitleClassName="lesson-prompt-copy"
            />
          )}
        </header>
      }
      visual={isTranslationPrompt && !isSubmitted ? <WordImage word={word} size="large" className="lesson-word-image lesson-choice-image" /> : null}
      body={
        <div className="exercise-input-panel">
          <label className="input-label" htmlFor={`word-answer-${exercise.id}`}>
            Ваш ответ
          </label>
          <div className="input-with-hint">
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
              // Enter while a Japanese/Chinese IME is converting kana confirms
              // the conversion; it must not submit a half-typed answer.
              if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.keyCode === 229) {
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
          {canHint && !isSubmitted ? (
            <HintButton label="Подсказка: следующая буква" disabled={!hintsLeft} onClick={takeHint} />
          ) : null}
          </div>

          <div className="input-meta">
            <span>{answerFormatHint}</span>
          </div>

          {isSubmitted ? (
            <>
              <div className={nearMiss ? 'answer-feedback near' : isCorrect ? 'answer-feedback success' : 'answer-feedback error'}>
                <div>
                  <strong>{nearMiss ? 'Почти верно — опечатка' : isCorrect ? (hintsUsed ? 'Верно, с подсказкой' : 'Верно') : 'Правильный ответ:'}</strong>
                  {isDictation ? (
                    <span className="answer-dictation">
                      <span lang="fr">{exercise.correctAnswer}</span>
                      <span className="answer-feedback-translation" lang="ru">{exercise.prompt}</span>
                    </span>
                  ) : (
                    <AnswerWordDetails word={word} />
                  )}
                  {answerDiff ? (
                    <div className="answer-diff" aria-label="Сравнение с правильным ответом">
                      <span className="answer-diff-row">
                        <small>Вы</small>
                        <span lang={word.language === 'japanese' ? 'ja' : 'fr'}>
                          {answerDiff.user.map((segment, index) => (
                            <span key={index} className={segment.kind === 'changed' ? 'diff-wrong' : undefined}>{segment.text}</span>
                          ))}
                        </span>
                      </span>
                      <span className="answer-diff-row">
                        <small>Надо</small>
                        <span lang={word.language === 'japanese' ? 'ja' : 'fr'}>
                          {answerDiff.correct.map((segment, index) => (
                            <span key={index} className={segment.kind === 'changed' ? 'diff-right' : undefined}>{segment.text}</span>
                          ))}
                        </span>
                      </span>
                    </div>
                  ) : null}
                  {isDictation ? null : <AnswerContext word={word} />}
                </div>
                <button type="button" className="feedback-replay-button" onClick={onReplayAudio}>
                  Прослушать ещё раз
                </button>
              </div>
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
            {isSubmitted ? 'Дальше' : 'Проверить'} <kbd className="key-hint" aria-hidden="true">Enter</kbd>
          </button>
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
