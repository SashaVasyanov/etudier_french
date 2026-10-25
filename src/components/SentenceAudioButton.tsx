import { playTextAudio } from '../lib/audio';
import type { LearningLanguage } from '../types';
import { AppIcon } from './AppIcon';

interface SentenceAudioButtonProps {
  text: string;
  language: LearningLanguage;
}

/** Plays a whole example sentence, not only the studied word. */
export function SentenceAudioButton({ text, language }: SentenceAudioButtonProps) {
  if (!text.trim()) return null;
  return (
    <button
      type="button"
      className="audio-button icon-button sentence-audio-button"
      title="Прослушать предложение"
      aria-label="Прослушать предложение"
      onClick={(event) => {
        event.stopPropagation();
        void playTextAudio(text, language);
      }}
    >
      <AppIcon name="volume" size={17} />
    </button>
  );
}
