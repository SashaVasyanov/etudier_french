import type { Word } from '../types';
import { getSpokenWordText } from './wordPresentation';

let activeUtterance: SpeechSynthesisUtterance | null = null;
let activeAudio: HTMLAudioElement | null = null;
let lastPlayAt = 0;
let cachedVoices: SpeechSynthesisVoice[] = [];
let voicesReadyPromise: Promise<SpeechSynthesisVoice[]> | null = null;
let playbackToken = 0;

const REPLAY_DEBOUNCE_MS = 180;
const VOICE_WAIT_TIMEOUT_MS = 1200;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function getVoices(): SpeechSynthesisVoice[] {
  if (!('speechSynthesis' in window)) {
    return [];
  }

  cachedVoices = window.speechSynthesis.getVoices();
  return cachedVoices;
}

function addVoicesChangedListener(listener: () => void): void {
  window.speechSynthesis.addEventListener('voiceschanged', listener);
}

function removeVoicesChangedListener(listener: () => void): void {
  window.speechSynthesis.removeEventListener('voiceschanged', listener);
}

function waitForVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!('speechSynthesis' in window)) {
    return Promise.resolve([]);
  }

  const existingVoices = getVoices();

  if (existingVoices.length > 0) {
    return Promise.resolve(existingVoices);
  }

  if (voicesReadyPromise) {
    return voicesReadyPromise;
  }

  voicesReadyPromise = new Promise((resolve) => {
    let isSettled = false;
    const finish = () => {
      if (isSettled) {
        return;
      }

      isSettled = true;
      window.clearTimeout(timeoutId);
      removeVoicesChangedListener(finish);
      voicesReadyPromise = null;
      resolve(getVoices());
    };
    const timeoutId = window.setTimeout(() => {
      finish();
    }, VOICE_WAIT_TIMEOUT_MS);

    addVoicesChangedListener(finish);
  });

  return voicesReadyPromise;
}

// macOS ships playful «novelty» voices and the robotic Eloquence voices for
// every language (Eddy, Flo, Grandma…). They must never be picked on their own.
const LOW_QUALITY_VOICES = [
  'albert', 'bad news', 'bahh', 'bells', 'boing', 'bubbles', 'cellos', 'good news', 'jester', 'junior', 'organ',
  'superstar', 'trinoids', 'whisper', 'wobble', 'zarvox', 'ralph', 'fred', 'kathy', 'deranged', 'hysterical',
  'eddy', 'flo', 'grandma', 'grandpa', 'reed', 'rocko', 'sandy', 'shelley',
];

// Natural-sounding voices that come with macOS or can be downloaded for free.
const GOOD_VOICE_NAMES: Record<Word['language'], string[]> = {
  french: ['amélie', 'amelie', 'thomas', 'audrey', 'aurélie', 'aurelie', 'marie', 'jacques'],
  japanese: ['kyoko', 'otoya', 'o-ren', 'hattori'],
};

export type VoiceQuality = 'premium' | 'enhanced' | 'standard' | 'basic';

export interface VoiceOption {
  id: string;
  name: string;
  quality: VoiceQuality;
}

let preferredVoiceIds: Partial<Record<Word['language'], string>> = {};
let speechRate = 0.9;

/** The learner's choices from the profile; applied to every playback. */
export function setSpeechPreferences(preferences: { voices?: Partial<Record<Word['language'], string>>; rate?: number }): void {
  preferredVoiceIds = preferences.voices ?? {};
  speechRate = preferences.rate && preferences.rate >= 0.5 && preferences.rate <= 1.2 ? preferences.rate : 0.9;
}

function voiceText(voice: SpeechSynthesisVoice): string {
  return `${voice.name} ${voice.voiceURI}`.toLowerCase();
}

export function getVoiceQuality(voice: SpeechSynthesisVoice): VoiceQuality {
  const text = voiceText(voice);
  if (LOW_QUALITY_VOICES.some((name) => new RegExp(`(^|[^a-z])${name}([^a-z]|$)`).test(text))) return 'basic';
  if (/premium|премиум|neural|natural/.test(text)) return 'premium';
  if (/enhanced|улучш|siri/.test(text)) return 'enhanced';
  return 'standard';
}

function matchesLanguage(voice: SpeechSynthesisVoice, language: Word['language']): boolean {
  const lang = voice.lang.toLowerCase().replace('_', '-');
  return language === 'japanese' ? lang.startsWith('ja') : lang.startsWith('fr');
}

function scoreVoice(voice: SpeechSynthesisVoice, language: Word['language']): number {
  const quality = getVoiceQuality(voice);
  const text = voiceText(voice);
  const lang = voice.lang.toLowerCase().replace('_', '-');
  let score = { premium: 300, enhanced: 200, standard: 100, basic: 0 }[quality];
  if (GOOD_VOICE_NAMES[language].some((name) => text.includes(name))) score += 30;
  if (lang === (language === 'japanese' ? 'ja-jp' : 'fr-fr')) score += 20;
  if (language === 'french' && lang === 'fr-ca') score -= 10;
  return score;
}

function rankVoices(voices: SpeechSynthesisVoice[], language: Word['language']): SpeechSynthesisVoice[] {
  return voices
    .filter((voice) => matchesLanguage(voice, language))
    .sort((left, right) => scoreVoice(right, language) - scoreVoice(left, language));
}

function pickVoice(language: Word['language'], voices = cachedVoices.length > 0 ? cachedVoices : getVoices()): SpeechSynthesisVoice | undefined {
  const preferred = preferredVoiceIds[language];
  const chosen = preferred ? voices.find((voice) => voice.voiceURI === preferred) : undefined;
  return chosen ?? rankVoices(voices, language)[0];
}

/** Installed voices for a language, best first, for the voice picker. */
export async function listVoices(language: Word['language']): Promise<VoiceOption[]> {
  const voices = await waitForVoices();
  return rankVoices(voices, language).map((voice) => ({ id: voice.voiceURI, name: voice.name, quality: getVoiceQuality(voice) }));
}

function normalizeSpeechText(value: string): string {
  return value
    .replace(/[’`]/g, "'")
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function canReplay(): boolean {
  const now = Date.now();

  if (now - lastPlayAt < REPLAY_DEBOUNCE_MS) {
    return false;
  }

  lastPlayAt = now;
  return true;
}

async function playFileAudio(src: string): Promise<void> {
  const audio = new Audio(src);
  activeAudio = audio;
  audio.preload = 'auto';
  const release = () => {
    if (activeAudio === audio) {
      activeAudio = null;
    }

    audio.onended = null;
    audio.onerror = null;
  };

  audio.onended = release;
  audio.onerror = release;

  try {
    await audio.play();
  } catch (error) {
    release();
    throw error;
  }
}

async function speakFallback(text: string, token: number, language: Word['language']): Promise<void> {
  if (!('speechSynthesis' in window)) {
    return;
  }

  const voices = await waitForVoices();

  if (token !== playbackToken) {
    return;
  }

  window.speechSynthesis.cancel();
  await delay(30);

  if (token !== playbackToken) {
    return;
  }

  activeUtterance = new SpeechSynthesisUtterance(normalizeSpeechText(text));
  activeUtterance.lang = language === 'japanese' ? 'ja-JP' : 'fr-FR';
  activeUtterance.rate = speechRate;
  activeUtterance.pitch = 1;
  activeUtterance.volume = 1;
  activeUtterance.voice = pickVoice(language, voices) ?? null;

  return new Promise((resolve, reject) => {
    if (!activeUtterance) {
      resolve();
      return;
    }

    activeUtterance.onend = () => {
      activeUtterance = null;
      resolve();
    };
    activeUtterance.onerror = (event) => {
      activeUtterance = null;

      if (event.error === 'canceled' || event.error === 'interrupted') {
        resolve();
        return;
      }

      reject(new Error('Speech synthesis playback failed'));
    };

    try {
      window.speechSynthesis.speak(activeUtterance);
    } catch (error) {
      activeUtterance = null;
      reject(error instanceof Error ? error : new Error('Speech synthesis unavailable'));
    }
  });
}

export async function playWordAudio(word: Word, options?: { force?: boolean }): Promise<void> {
  if (!options?.force && !canReplay()) {
    return;
  }

  if (options?.force) {
    lastPlayAt = Date.now();
  }

  stopAudio();
  const token = playbackToken + 1;
  playbackToken = token;

  if (word.audio_original) {
    try {
      await playFileAudio(word.audio_original);
      return;
    } catch {
      activeAudio = null;
    }
  }

  try {
    await speakFallback(getSpokenWordText(word), token, word.language);
  } catch {
    return;
  }
}

/** Speaks any text (an example sentence, a voice preview). */
export async function playTextAudio(text: string, language: Word['language']): Promise<void> {
  if (!text.trim()) return;
  stopAudio();
  const token = playbackToken + 1;
  playbackToken = token;
  lastPlayAt = Date.now();
  try {
    await speakFallback(text, token, language);
  } catch {
    // Speech is a convenience; a failed playback must not break the lesson.
  }
}

export function stopAudio(): void {
  playbackToken += 1;

  if (activeAudio) {
    activeAudio.onended = null;
    activeAudio.onerror = null;
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  activeUtterance = null;
}
