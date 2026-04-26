import type { LearningLanguage } from '../types';

export const LEARNING_LANGUAGE_OPTIONS: LearningLanguage[] = ['french', 'japanese'];

export function getLearningLanguageMenuLabel(language: LearningLanguage): string {
  return language === 'french' ? 'Французский' : 'Японский';
}

export function getLearningLanguageTitle(language: LearningLanguage): string {
  return language === 'french' ? 'французский' : 'японский';
}

export function getLearningLanguageAdverb(language: LearningLanguage): string {
  return language === 'french' ? 'по-французски' : 'по-японски';
}

export function getLearningLanguageLocale(language: LearningLanguage): string {
  return language === 'french' ? 'fr' : 'ja';
}

export function getLearningLanguageProductTitle(language: LearningLanguage): string {
  return language === 'french' ? 'Etudier French' : 'Etudier Japanese';
}

export function getLearningLanguageSectionEyebrow(language: LearningLanguage): string {
  return language === 'french' ? 'Французский словарь и уроки' : 'Японский словарь и уроки';
}
