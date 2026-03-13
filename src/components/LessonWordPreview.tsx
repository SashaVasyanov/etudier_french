import type { Word } from '../types';
import { FlashcardView } from './FlashcardView';

interface LessonWordPreviewProps {
  word: Word;
  current: number;
  total: number;
  onReplayAudio: () => void;
  onMarkKnown?: () => void;
  onNext: () => void;
}

export function LessonWordPreview({
  word,
  current,
  total,
  onReplayAudio,
  onMarkKnown,
  onNext,
}: LessonWordPreviewProps) {
  return (
    <FlashcardView
      word={word}
      current={current}
      total={total}
      onReplayAudio={onReplayAudio}
      onMarkKnown={onMarkKnown}
      onDefer={onNext}
      onNext={onNext}
    />
  );
}
