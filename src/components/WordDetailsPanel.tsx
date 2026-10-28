import type { Word, WordProgress } from '../types';
import { getMemoryState, getRecallProbability } from '../lib/storage';
import { countRu, RU_DAYS } from '../lib/utils';
import { JapaneseExampleReading } from './JapaneseExampleReading';
import { SentenceAudioButton } from './SentenceAudioButton';
import { getJapaneseExampleReading, getPartOfSpeechLabel, getWordDescription, getWordExampleLabel } from '../lib/wordPresentation';
import { JapaneseSentence } from './JapaneseSentence';

interface WordDetailsPanelProps {
  word: Word;
  /** The learner's progress on the word; adds the «Память» block. */
  progress?: WordProgress;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function describeNextReview(nextReviewAt: string | null, now: Date): string {
  if (!nextReviewAt) return 'в ближайшем уроке';
  const due = new Date(nextReviewAt);
  const days = Math.ceil((due.getTime() - now.getTime()) / DAY_MS);
  if (days <= 0) return 'уже пора — слово в ближайшем уроке';
  if (days === 1) return 'завтра';
  return `через ${countRu(days, RU_DAYS)}, ${due.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`;
}

function describeStability(days: number): string {
  if (days < 1) return 'меньше дня';
  if (days < 60) return `около ${countRu(Math.round(days), RU_DAYS)}`;
  if (days < 365) return `около ${Math.round(days / 30)} мес.`;
  return 'больше года';
}

/** How the word is held in memory: recall chance, next review, history. */
function MemoryBlock({ progress }: { progress: WordProgress }) {
  const now = new Date();
  const state = getMemoryState(progress, now);
  const recall = getRecallProbability(progress, now);
  if (!state || recall === null) return null;
  return (
    <div className="flashcard-meta-item word-memory-panel">
      <span className="eyebrow">Память</span>
      <strong>Вспомните сейчас с вероятностью {Math.round(recall * 100)}%</strong>
      <dl className="word-memory-facts">
        <div><dt>Следующий повтор</dt><dd>{describeNextReview(progress.next_review_at, now)}</dd></div>
        <div><dt>Прочность</dt><dd title="Через сколько шанс вспомнить опустится до 90 %">{describeStability(state.stability)}</dd></div>
        <div><dt>Ответы</dt><dd>{progress.correct_count} верно · {progress.wrong_count} с ошибкой</dd></div>
        {progress.lapses ? <div><dt>Забывалось</dt><dd>{progress.lapses} раз(а)</dd></div> : null}
      </dl>
    </div>
  );
}

export function WordDetailsPanel({ word, progress }: WordDetailsPanelProps) {
  const imageSourceUrl = word.imageSource?.startsWith('https://') ? word.imageSource : null;
  const imageLicenseUrl = word.imageLicenseUrl?.startsWith('https://') ? word.imageLicenseUrl : null;
  const showImageCredit = Boolean(word.imageAttribution || word.imageLicense || imageSourceUrl);

  return (
    <div className="word-details-grid">
      {progress ? <MemoryBlock progress={progress} /> : null}
      <div className="flashcard-meta-item">
        <span className="eyebrow">Что это</span>
        <strong>{getPartOfSpeechLabel(word.part_of_speech)}</strong>
        <p className="detail-copy">{getWordDescription(word)}</p>
      </div>
      <div className="flashcard-meta-item">
        <span className="eyebrow">{getWordExampleLabel(word)}</span>
        <div className="example-line">
          <strong><JapaneseSentence text={word.example_original} reading={getJapaneseExampleReading(word)} /></strong>
          <SentenceAudioButton text={word.example_original} language={word.language} />
        </div>
        <JapaneseExampleReading word={word} />
        {word.example_translation ? <p className="detail-copy word-example-translation">{word.example_translation}</p> : null}
      </div>
      {showImageCredit ? (
        <div className="flashcard-meta-item image-credit-panel">
          <span className="eyebrow">Изображение</span>
          <strong>{word.imageProvider === 'openai-imagegen' ? 'Авторская ассоциация' : 'Источник и лицензия'}</strong>
          {word.imageAttribution ? <p className="detail-copy">{word.imageAttribution}</p> : null}
          <div className="image-credit-links">
            {imageSourceUrl ? (
              <a href={imageSourceUrl} target="_blank" rel="noreferrer">
                Открыть источник
              </a>
            ) : null}
            {word.imageLicense ? (
              imageLicenseUrl ? (
                <a href={imageLicenseUrl} target="_blank" rel="noreferrer">
                  {word.imageLicense}
                </a>
              ) : (
                <span>{word.imageLicense}</span>
              )
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
