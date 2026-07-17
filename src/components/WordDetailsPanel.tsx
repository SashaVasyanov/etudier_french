import type { Word } from '../types';
import { JapaneseExampleReading } from './JapaneseExampleReading';
import {
  getPartOfSpeechLabel,
  getWordDescription,
  getWordExampleLabel,
} from '../lib/wordPresentation';

interface WordDetailsPanelProps {
  word: Word;
}

export function WordDetailsPanel({ word }: WordDetailsPanelProps) {
  const imageSourceUrl = word.imageSource?.startsWith('https://') ? word.imageSource : null;
  const imageLicenseUrl = word.imageLicenseUrl?.startsWith('https://') ? word.imageLicenseUrl : null;
  const showImageCredit = Boolean(word.imageAttribution || word.imageLicense || imageSourceUrl);

  return (
    <div className="word-details-grid">
      <div className="flashcard-meta-item">
        <span className="eyebrow">Что это</span>
        <strong>{getPartOfSpeechLabel(word.part_of_speech)}</strong>
        <p className="detail-copy">{getWordDescription(word)}</p>
      </div>
      <div className="flashcard-meta-item">
        <span className="eyebrow">{getWordExampleLabel(word)}</span>
        <strong>{word.example_original}</strong>
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
