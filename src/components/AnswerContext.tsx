import type { Word } from '../types';
import { JapaneseSentence } from './JapaneseSentence';
import { WordExamplesList } from './WordExamplesList';

interface AnswerContextProps {
  word: Word;
  /** Hide the definition when the task itself was built on it. */
  showDefinition?: boolean;
}

/**
 * Under the verdict: what the word means (a short definition) and one more
 * example — the second one when there is one, so the learner meets the word
 * in a new sentence rather than the one on the word card.
 */
export function AnswerContext({ word, showDefinition = true }: AnswerContextProps) {
  const lang = word.language === 'japanese' ? 'ja' : 'fr';
  const definition = showDefinition && word.definition ? word.definition : null;
  const hasExamples = Boolean(word.examples?.length) || Boolean(word.example_original && word.example_original !== word.original);
  if (!definition && !hasExamples) return null;

  return (
    <div className="answer-context">
      {definition ? (
        <p className="answer-context-definition">
          <span lang={lang}><JapaneseSentence text={definition} reading={word.definition_reading} /></span>
          {word.definition_translation ? <span className="answer-context-definition-translation" lang="ru">{word.definition_translation}</span> : null}
        </p>
      ) : null}
      {hasExamples ? <WordExamplesList word={word} limit={1} offset={1} className="answer-context-examples" /> : null}
    </div>
  );
}
