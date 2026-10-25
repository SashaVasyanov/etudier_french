import { useEffect, useMemo, useRef, useState } from 'react';
import { KATAKANA, KATAKANA_WORDS, type KanaChar, type LoanWord } from '../data/katakana';
import { getKanaStatus, KANA_LEARNED_STREAK } from '../lib/storage';
import { isKanaWordReadingMatch } from '../lib/utils';
import type { AppStorage } from '../types';
import { AppIcon } from './AppIcon';

interface KatakanaScreenProps {
  storage: AppStorage;
  onCompleteSession: (outcomes: Array<{ kana: string; isCorrect: boolean }>) => void;
}

type View = 'table' | 'study' | 'result';

type Question =
  | { kind: 'sign'; kana: KanaChar; options: string[] }
  | { kind: 'word'; word: LoanWord };

const SIGN_QUESTIONS = 10;
const WORD_QUESTIONS = 5;

// Signs that are easy to mix up are offered as each other's wrong answers.
const LOOK_ALIKES: Record<string, string[]> = {
  シ: ['ツ', 'ン', 'ソ'], ツ: ['シ', 'ソ', 'ン'], ソ: ['ン', 'ツ', 'シ'], ン: ['ソ', 'シ', 'ツ'],
  ク: ['ケ', 'タ', 'ワ'], ケ: ['ク', 'ナ'], タ: ['ク', 'ヌ'], ウ: ['ワ', 'フ', 'ク'], ワ: ['ウ', 'フ', 'ク'],
  フ: ['ワ', 'ヌ', 'ラ'], ヌ: ['ス', 'フ', 'メ'], ス: ['ヌ', 'ヲ', 'ネ'], メ: ['ヌ', 'ナ'], ナ: ['メ', 'チ', 'テ'],
  チ: ['テ', 'ナ'], テ: ['チ', 'ラ'], ラ: ['テ', 'フ', 'ヲ'], コ: ['ユ', 'ロ'], ユ: ['コ', 'エ'], ロ: ['コ', 'ユ'],
  マ: ['ア', 'ム'], ア: ['マ', 'ヤ'], ヤ: ['ア', 'セ'], セ: ['ヤ', 'サ'], サ: ['セ', 'キ'], ノ: ['メ', 'ハ'],
  ハ: ['ノ', 'ル'], ル: ['レ', 'ハ'], レ: ['ル', 'ム'], ム: ['レ', 'マ'], ニ: ['ミ', 'エ'], ミ: ['ニ', 'シ'],
  エ: ['ニ', 'ユ', 'コ'], ヲ: ['ラ', 'ス'], ホ: ['オ', 'キ'], オ: ['ホ', 'キ'], キ: ['サ', 'オ', 'チ'],
};

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function buildOptions(target: KanaChar): string[] {
  const bySign = new Map(KATAKANA.map((item) => [item.kana, item]));
  const lookAlikes = (LOOK_ALIKES[target.kana] ?? [])
    .map((kana) => bySign.get(kana)?.romaji)
    .filter((romaji): romaji is string => Boolean(romaji));
  const sameGroup = shuffle(KATAKANA.filter((item) => item.group === target.group && item.kana !== target.kana)).map((item) => item.romaji);
  const distractors = [...new Set([...shuffle(lookAlikes), ...sameGroup])].filter((romaji) => romaji !== target.romaji).slice(0, 3);
  return shuffle([target.romaji, ...distractors]);
}

/** Weak signs first, then new ones in table order, then a refresher of learned ones. */
function selectSigns(storage: AppStorage): KanaChar[] {
  const withStatus = KATAKANA.map((kana) => ({ kana, progress: storage.kanaProgress[kana.kana], status: getKanaStatus(storage.kanaProgress[kana.kana]) }));
  const learning = withStatus.filter((item) => item.status === 'learning').sort((a, b) => (a.progress?.streak ?? 0) - (b.progress?.streak ?? 0));
  const fresh = withStatus.filter((item) => item.status === 'new');
  const learned = withStatus
    .filter((item) => item.status === 'learned')
    .sort((a, b) => (a.progress?.lastSeenAt ?? '').localeCompare(b.progress?.lastSeenAt ?? ''));
  const picked = [...learning.slice(0, 6), ...fresh.slice(0, 5)];
  const rest = [...learning.slice(6), ...fresh.slice(5), ...learned];
  return shuffle([...picked, ...rest].slice(0, SIGN_QUESTIONS).map((item) => item.kana));
}

function selectWords(): LoanWord[] {
  return shuffle(KATAKANA_WORDS).slice(0, WORD_QUESTIONS);
}

export default function KatakanaScreen({ storage, onCompleteSession }: KatakanaScreenProps) {
  const [view, setView] = useState<View>('table');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [signOutcomes, setSignOutcomes] = useState<Array<{ kana: string; isCorrect: boolean }>>([]);
  const [wordResults, setWordResults] = useState<boolean[]>([]);
  // Guards against a repeated key press answering twice before React re-renders.
  const submittedRef = useRef(false);

  const summary = useMemo(() => {
    const statuses = KATAKANA.map((kana) => getKanaStatus(storage.kanaProgress[kana.kana]));
    return {
      learned: statuses.filter((status) => status === 'learned').length,
      learning: statuses.filter((status) => status === 'learning').length,
    };
  }, [storage.kanaProgress]);

  const question = questions[index] ?? null;
  const isCorrect = question
    ? question.kind === 'sign'
      ? answer === question.kana.romaji
      : isKanaWordReadingMatch(answer, question.word.kana, question.word.romaji)
    : false;

  function start() {
    const signs = selectSigns(storage).map((kana): Question => ({ kind: 'sign', kana, options: buildOptions(kana) }));
    const wordTasks = selectWords().map((word): Question => ({ kind: 'word', word }));
    setQuestions([...signs, ...wordTasks]);
    setIndex(0);
    setAnswer('');
    setSubmitted(false);
    setSignOutcomes([]);
    setWordResults([]);
    submittedRef.current = false;
    setView('study');
  }

  function submit(value: string) {
    if (!question || submittedRef.current || !value.trim()) return;
    submittedRef.current = true;
    setAnswer(value);
    setSubmitted(true);
    if (question.kind === 'sign') {
      setSignOutcomes((current) => current.concat({ kana: question.kana.kana, isCorrect: value === question.kana.romaji }));
    } else {
      setWordResults((current) => current.concat(isKanaWordReadingMatch(value, question.word.kana, question.word.romaji)));
    }
  }

  function next() {
    if (!submitted) return;
    if (index >= questions.length - 1) {
      onCompleteSession(signOutcomes);
      setView('result');
      return;
    }
    setIndex((current) => current + 1);
    setAnswer('');
    setSubmitted(false);
    submittedRef.current = false;
  }

  /** «Завершить» keeps the answers already given. */
  function stop() {
    if (signOutcomes.length > 0) onCompleteSession(signOutcomes);
    setView('table');
  }

  // 1–4 pick an answer, Enter moves on (the input handles its own Enter).
  useEffect(() => {
    if (view !== 'study' || !question) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === 'Enter' && submitted) {
        event.preventDefault();
        next();
        return;
      }
      const digit = Number(event.key);
      if (question.kind === 'sign' && !submitted && digit >= 1 && digit <= question.options.length) {
        event.preventDefault();
        submit(question.options[digit - 1]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  if (view === 'study' && question) {
    return (
      <section className="radicals-page radical-study-page katakana-page">
        <header className="radical-study-progress">
          <button type="button" className="radical-back-button" onClick={stop}>
            <AppIcon name="close" size={20} /> Завершить
          </button>
          <div>
            <span>Тренировка катаканы</span>
            <strong>{index + 1} из {questions.length}</strong>
          </div>
          <div className="radical-progress-track" aria-label={`Задание ${index + 1} из ${questions.length}`}>
            <span style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
          </div>
        </header>

        <article className="radical-question-card">
          <span className="radical-question-kicker">{question.kind === 'sign' ? 'Знак → чтение' : 'Прочитайте слово'}</span>
          <h1>{question.kind === 'sign' ? 'Как читается этот знак?' : 'Напишите чтение ромадзи или хираганой'}</h1>
          <div className="radical-question-focus glyph" lang="ja">
            {question.kind === 'sign' ? question.kana.kana : question.word.kana}
          </div>

          {question.kind === 'sign' ? (
            <div className="radical-options">
              {question.options.map((option, optionIndex) => {
                const state = !submitted
                  ? ''
                  : option === question.kana.romaji
                    ? ' correct'
                    : option === answer
                      ? ' incorrect'
                      : ' muted';
                return (
                  <button
                    key={option}
                    type="button"
                    className={`radical-option${state}`}
                    disabled={submitted}
                    onClick={() => submit(option)}
                  >
                    <span className="choice-key" aria-hidden="true">{optionIndex + 1}</span> {option}
                  </button>
                );
              })}
            </div>
          ) : (
            <form
              className="katakana-word-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (submitted) next();
                else submit(answer);
              }}
            >
              <input
                className="settings-input"
                value={answer}
                autoFocus
                readOnly={submitted}
                placeholder="например, koohii или こーひー"
                aria-label="Чтение слова"
                onChange={(event) => setAnswer(event.target.value)}
                onKeyDown={(event) => {
                  // Enter that confirms a Japanese IME candidate must not send the
                  // answer (WKWebView may report keyCode 229 without isComposing).
                  if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault();
                }}
              />
              {!submitted ? <button type="submit" className="radical-primary-button" disabled={!answer.trim()}>Проверить</button> : null}
            </form>
          )}

          {submitted ? (
            <div className={isCorrect ? 'radical-feedback success' : 'radical-feedback error'} role="status">
              <span>{isCorrect ? <AppIcon name="check-circle" size={23} /> : <AppIcon name="close" size={23} />}</span>
              <div>
                {question.kind === 'sign' ? (
                  <>
                    <strong>{isCorrect ? 'Верно' : `Правильно: ${question.kana.romaji}`}</strong>
                    <p lang="ja">{question.kana.kana} — {question.kana.romaji}, в хирагане {question.kana.hiragana}</p>
                  </>
                ) : (
                  <>
                    <strong>{isCorrect ? 'Верно' : `Правильно: ${question.word.romaji}`}</strong>
                    <p><span lang="ja">{question.word.kana}</span> — {question.word.translation}</p>
                  </>
                )}
              </div>
              <button type="button" onClick={next}>
                {index >= questions.length - 1 ? 'Показать результат' : 'Дальше'}
                <AppIcon name="arrow-right" size={18} />
              </button>
            </div>
          ) : null}
        </article>
      </section>
    );
  }

  if (view === 'result') {
    const signsRight = signOutcomes.filter((item) => item.isCorrect).length;
    const wordsRight = wordResults.filter(Boolean).length;
    const missed = signOutcomes.filter((item) => !item.isCorrect).map((item) => item.kana);
    return (
      <section className="radicals-page radical-result-page katakana-page">
        <article className="radical-result-card">
          <span className="radical-result-mark"><AppIcon name="sparkles" size={32} /></span>
          <span className="radical-question-kicker">Тренировка завершена</span>
          <h1>{signsRight === signOutcomes.length ? 'Все знаки — без ошибок' : 'Катакана становится привычнее'}</h1>
          <p>{missed.length > 0 ? <>Повторить: <span lang="ja">{missed.join(' ')}</span></> : 'Знаки без ошибок засчитаны в серию.'}</p>
          <div className="radical-result-stats">
            <span><strong>{signsRight} из {signOutcomes.length}</strong> знаков</span>
            {wordResults.length > 0 ? <span><strong>{wordsRight} из {wordResults.length}</strong> слов</span> : null}
          </div>
          <div className="radical-result-actions">
            <button type="button" className="radical-secondary-button" onClick={() => setView('table')}>К таблице</button>
            <button type="button" className="radical-primary-button" onClick={start}>Ещё тренировка</button>
          </div>
        </article>
      </section>
    );
  }

  return (
    <section className="radicals-page katakana-page">
      <header className="radicals-hero">
        <div>
          <span className="radical-question-kicker">Отдельный режим · カタカナ</span>
          <h1>Катакана</h1>
          <p>
            Катаканой пишут заимствованные слова: コーヒー, テレビ, ホテル. Знак считается выученным после{' '}
            {KANA_LEARNED_STREAK} верных ответов подряд. В конце тренировки — чтение слов, которые встречаются в меню, на вывесках и в магазинах.
          </p>
        </div>
        <button type="button" className="radical-primary-button" onClick={start}>
          Начать тренировку <AppIcon name="arrow-right" size={18} />
        </button>
      </header>

      <section className="radical-summary-grid" aria-label="Сводка по катакане">
        <article><span className="violet"><AppIcon name="grid" size={22} /></span><div><strong>{KATAKANA.length}</strong><small>знаков в таблице</small></div></article>
        <article><span className="orange"><AppIcon name="clock" size={22} /></span><div><strong>{summary.learning}</strong><small>в работе</small></div></article>
        <article><span className="green"><AppIcon name="check-circle" size={22} /></span><div><strong>{summary.learned}</strong><small>выучено</small></div></article>
        <article><span className="blue"><AppIcon name="book-open" size={22} /></span><div><strong>{KATAKANA_WORDS.length}</strong><small>слов для чтения</small></div></article>
      </section>

      {(['basic', 'voiced'] as const).map((group) => (
        <section key={group} className="radical-catalog-panel">
          <div className="radical-catalog-head">
            <div>
              <h2>{group === 'basic' ? 'Основные знаки' : 'Звонкие и полузвонкие знаки'}</h2>
            </div>
          </div>
          <div className="kana-grid" lang="ja">
            {KATAKANA.filter((item) => item.group === group).map((item) => {
              const status = getKanaStatus(storage.kanaProgress[item.kana]);
              return (
                <div key={item.kana} className={`kana-cell ${status}`} title={status === 'learned' ? 'выучено' : status === 'learning' ? 'в работе' : 'ещё не встречался'}>
                  <strong>{item.kana}</strong>
                  <span>{item.romaji}</span>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <p className="radical-caveat" lang="ru">
        В словах встречаются и маленькие знаки: <span lang="ja">ャ ュ ョ</span> смягчают слог (<span lang="ja">ニュ</span> — nyu),{' '}
        <span lang="ja">ッ</span> удваивает следующий согласный (<span lang="ja">ベッド</span> — beddo), а <span lang="ja">ー</span>{' '}
        удлиняет гласный (<span lang="ja">コーヒー</span> — koohii). Редкие <span lang="ja">ヂ</span> и <span lang="ja">ヅ</span> в таблицу не вошли.
      </p>
    </section>
  );
}
