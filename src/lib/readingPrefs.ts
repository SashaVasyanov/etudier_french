/**
 * How Japanese readings are shown. Set once per render by the app from the
 * comfort settings, read by the components that print readings.
 */
export interface ReadingPreferences {
  /** Readings over the kanji of example sentences instead of a separate line. */
  furigana: boolean;
  /** Romaji next to the kana reading of a word. */
  romaji: boolean;
}

let current: ReadingPreferences = { furigana: false, romaji: true };

export function setReadingPreferences(next: ReadingPreferences): void {
  current = next;
}

export function getReadingPreferences(): ReadingPreferences {
  return current;
}

/** «[たべる · taberu]» → «[たべる]» when romaji is off; other text unchanged. */
export function formatTranscription(transcription: string | undefined, language: string): string {
  const value = transcription ?? '';
  if (language !== 'japanese' || current.romaji || !value.includes('·')) return value;
  const kana = value.replace(/^\[|]$/g, '').split('·')[0]?.trim();
  return kana ? `[${kana}]` : value;
}
