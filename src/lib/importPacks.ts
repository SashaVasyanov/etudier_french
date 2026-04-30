import type { LearningLanguage, Word, WordPack } from '../types';

interface ParseImportedPackInput {
  title: string;
  rawText: string;
  language: LearningLanguage;
}

function hashText(value: string): string {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash).toString(36);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42) || 'import';
}

function splitImportedLine(line: string): string[] {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith('#')) {
    return [];
  }

  const separators = ['\t', ';', ','];
  const separated = separators
    .map((separator) => trimmed.split(separator).map((part) => part.trim()).filter(Boolean))
    .find((parts) => parts.length >= 2);

  if (separated) {
    return separated;
  }

  const dashMatch = trimmed.match(/^(.+?)\s[-–—]\s(.+)$/);
  return dashMatch ? [dashMatch[1].trim(), dashMatch[2].trim()] : [];
}

function parseWordFields(parts: string[], language: LearningLanguage): Pick<Word, 'original' | 'translation' | 'transcription'> | null {
  const [first, second, third] = parts;

  if (!first || !second) {
    return null;
  }

  if (language === 'japanese' && third && /[\u3040-\u30ff]/.test(second)) {
    return {
      original: first,
      transcription: `[${second}]`,
      translation: third,
    };
  }

  return {
    original: first,
    translation: second,
    transcription: third ? `[${third}]` : '',
  };
}

export function parseImportedPack({ title, rawText, language }: ParseImportedPackInput): WordPack | null {
  const cleanTitle = title.trim();

  if (!cleanTitle) {
    return null;
  }

  const packId = `custom-pack-${slugify(cleanTitle)}-${Date.now().toString(36)}`;
  const seen = new Set<string>();
  const words = rawText
    .split(/\r?\n/)
    .map((line) => splitImportedLine(line))
    .map((parts) => parseWordFields(parts, language))
    .filter((word): word is Pick<Word, 'original' | 'translation' | 'transcription'> => word !== null)
    .filter((word) => {
      const key = word.original.toLocaleLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .map<Word>((word, index) => ({
      id: `${packId}-${index + 1}-${hashText(word.original)}`,
      language,
      original: word.original,
      translation: word.translation,
      transcription: word.transcription,
      audio_original: '',
      example_original: word.original,
      example_translation: word.translation,
      part_of_speech: 'word',
      level: 'A1',
      tags: ['импорт'],
      packIds: [packId],
      source: 'pack',
    }));

  if (words.length === 0) {
    return null;
  }

  return {
    id: packId,
    language,
    title: cleanTitle,
    description: `Импортировано слов: ${words.length}.`,
    accent: '#1a8ce2',
    words,
  };
}
