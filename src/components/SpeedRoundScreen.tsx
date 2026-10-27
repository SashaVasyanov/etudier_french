import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createSpeedQuestion, type SpeedQuestion } from '../lib/exercises';
import { pluralRu, shuffleArray } from '../lib/utils';
import type { Word } from '../types';
import { AppIcon } from './AppIcon';

const ROUND_MS = 60_000;
const FEEDBACK_MS = 380;

interface SpeedRoundScreenProps {
  /** Words for the questions (already met ones first). */
  words: Word[];
  /** Words wrong options may come from. */
  pool: Word[];
  best: number;
  language: 'french' | 'japanese';
  onFinish: (score: number) => void;
  onClose: () => void;
}

/**
 * «Минута на скорость»: as many word ↔ translation questions as possible in
 * 60 seconds. A game for variety — answers do not change the review schedule.
 */
export default function SpeedRoundScreen({ words, pool, best, language, onFinish, onClose }: SpeedRoundScreenProps) {
  const [view, setView] = useState<'intro' | 'play' | 'done'>('intro');
  const [questions, setQuestions] = useState<SpeedQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const startedAt = useRef(0);
  const finished = useRef(false);
  const lang = language === 'japanese' ? 'ja' : 'fr';

  const buildQuestions = useCallback(() => {
    const order = shuffleArray(words);
    const result: SpeedQuestion[] = [];
    // Enough for a fast minute: the words repeat in a new order if needed.
    for (let round = 0; result.length < 80 && round < 6; round += 1) {
      for (const word of round === 0 ? order : shuffleArray(words)) {
        const question = createSpeedQuestion(word, pool, result.length);
        if (question) result.push(question);
      }
    }
    return result;
  }, [pool, words]);

  const start = useCallback(() => {
    setQuestions(buildQuestions());
    setIndex(0);
    setScore(0);
    setAnswered(0);
    setPicked(null);
    finished.current = false;
    startedAt.current = Date.now();
    setNow(Date.now());
    setView('play');
  }, [buildQuestions]);

  const remainingMs = view === 'play' ? Math.max(0, ROUND_MS - (now - startedAt.current)) : ROUND_MS;
  const question = questions[index];

  useEffect(() => {
    if (view !== 'play') return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [view]);

  useEffect(() => {
    if (view === 'play' && (remainingMs === 0 || (questions.length > 0 && index >= questions.length)) && !finished.current) {
      finished.current = true;
      setView('done');
      onFinish(score);
    }
  }, [index, onFinish, questions.length, remainingMs, score, view]);

  const answer = useCallback((option: string) => {
    if (!question || picked !== null || view !== 'play') return;
    setPicked(option);
    setAnswered((value) => value + 1);
    if (option === question.correct) setScore((value) => value + 1);
    window.setTimeout(() => {
      setPicked(null);
      setIndex((value) => value + 1);
    }, option === question.correct ? FEEDBACK_MS / 2 : FEEDBACK_MS * 2);
  }, [picked, question, view]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      if (view === 'play' && question) {
        const digit = Number(event.key);
        if (digit >= 1 && digit <= question.options.length) {
          event.preventDefault();
          answer(question.options[digit - 1]);
        }
      } else if (event.key === 'Enter' && view !== 'play') {
        event.preventDefault();
        start();
      } else if (event.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [answer, onClose, question, start, view]);

  const seconds = Math.ceil(remainingMs / 1000);
  const accuracy = answered > 0 ? Math.round((score / answered) * 100) : 0;
  const isRecord = useMemo(() => view === 'done' && score > best, [best, score, view]);

  if (view === 'play' && question) {
    return (
      <section className="radicals-page radical-study-page speed-page">
        <header className="radical-study-progress">
          <button type="button" className="radical-back-button" onClick={onClose}>
            <AppIcon name="close" size={20} /> Завершить
          </button>
          <div>
            <span>Минута на скорость</span>
            <strong>{score} верно · {seconds} с</strong>
          </div>
          <div className="radical-progress-track speed-timer" aria-label={`Осталось ${seconds} секунд`}>
            <span style={{ width: `${(remainingMs / ROUND_MS) * 100}%` }} />
          </div>
        </header>
        <article className="radical-question-card">
          <span className="radical-question-kicker">{question.promptIsOriginal ? 'Слово → перевод' : 'Перевод → слово'}</span>
          <div className="radical-question-focus speed-prompt" lang={question.promptIsOriginal ? lang : 'ru'}>{question.prompt}</div>
          <div className="radical-options">
            {question.options.map((option, optionIndex) => {
              const state = picked === null ? '' : option === question.correct ? ' correct' : option === picked ? ' incorrect' : ' muted';
              return (
                <button key={option} type="button" className={`radical-option${state}`} disabled={picked !== null} onClick={() => answer(option)}>
                  <span className="choice-key" aria-hidden="true">{optionIndex + 1}</span>{' '}
                  <span lang={question.promptIsOriginal ? 'ru' : lang}>{option}</span>
                </button>
              );
            })}
          </div>
        </article>
      </section>
    );
  }

  return (
    <section className="radicals-page radical-study-page speed-page">
      <article className="radical-result-card">
        <span className="radical-result-mark"><AppIcon name="clock" size={32} /></span>
        <span className="radical-question-kicker">Минута на скорость</span>
        {view === 'done' ? (
          <>
            <h1>{isRecord ? `Новый рекорд: ${score}!` : `${score} ${pluralRu(score, ['верный ответ', 'верных ответа', 'верных ответов'])} за минуту`}</h1>
            <p>{answered > 0 ? `Точность ${accuracy} %. ` : ''}{best > 0 && !isRecord ? `Рекорд — ${best}.` : 'Игра не меняет расписание повторений: это разминка.'}</p>
          </>
        ) : (
          <>
            <h1>Сколько слов успеете за 60 секунд?</h1>
            <p>Слово или перевод — выберите ответ цифрами 1–4. {best > 0 ? `Ваш рекорд — ${best}.` : 'Расписание повторений игра не меняет.'}</p>
          </>
        )}
        <div className="radical-result-actions">
          <button type="button" className="radical-secondary-button" onClick={onClose}>На главную</button>
          <button type="button" className="radical-primary-button" disabled={words.length < 4} onClick={start}>
            {view === 'done' ? 'Ещё раз' : 'Старт'} <AppIcon name="arrow-right" size={18} />
          </button>
        </div>
      </article>
    </section>
  );
}
