import type { Word } from '../types';
import { getSpokenWordText } from './wordPresentation';

let activeUtterance: SpeechSynthesisUtterance | null = null;

/*
 * Recorded speech: every word and example sentence of the course is voiced
 * ahead of time by a neural voice (Kokoro) and shipped as small audio files.
 * The manifest maps a text to its file; anything not in it (a word the
 * learner added, a sentence typed elsewhere) falls back to the system voice.
 */
type SpeechManifest = Record<string, string>;
const speechManifests: Partial<Record<Word['language'], SpeechManifest>> = {};
const speechManifestRequests: Partial<Record<Word['language'], Promise<SpeechManifest>>> = {};

/** The key a text is stored under: same spelling rules as at generation. */
export function speechKey(text: string): string {
  return text.normalize('NFC').replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();
}

function loadSpeechManifest(language: Word['language']): Promise<SpeechManifest> {
  const ready = speechManifests[language];
  if (ready) return Promise.resolve(ready);
  const pending = speechManifestRequests[language];
  if (pending) return pending;
  const code = language === 'japanese' ? 'ja' : 'fr';
  const request = fetch(`/data/speech_${code}.json`, { cache: 'force-cache' })
    .then((response) => (response.ok ? response.json() : {}))
    .then((value: unknown) => {
      const manifest = value && typeof value === 'object' && !Array.isArray(value) ? (value as SpeechManifest) : {};
      speechManifests[language] = manifest;
      return manifest;
    })
    .catch(() => {
      delete speechManifestRequests[language];
      return {} as SpeechManifest;
    });
  speechManifestRequests[language] = request;
  return request;
}

/** Starts loading the recorded speech list early, so the first word plays at once. */
export function preloadSpeech(language: Word['language']): void {
  void loadSpeechManifest(language);
}

function speechFileUrl(language: Word['language'], file: string): string {
  return `/speech/${language === 'japanese' ? 'ja' : 'fr'}/${file}`;
}

/** Files for a text: the whole text, or each of its sentences when they are all recorded. */
async function findRecordedSpeech(text: string, language: Word['language']): Promise<string[] | null> {
  const manifest = await loadSpeechManifest(language);
  const whole = manifest[speechKey(text)];
  if (whole) return [speechFileUrl(language, whole)];
  const sentences = text.match(/[^.!?。！？]+[.!?。！？]*\s*/g)?.map((part) => speechKey(part)).filter(Boolean) ?? [];
  if (sentences.length < 2) return null;
  const files = sentences.map((sentence) => manifest[sentence]);
  return files.every(Boolean) ? files.map((file) => speechFileUrl(language, file!)) : null;
}
let activeAudio: HTMLAudioElement | null = null;
// Settles the promise of the file that is playing when it gets stopped.
let settleActive: (() => void) | null = null;
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

/** Plays one file to the end; resolves early when another playback takes over. */
function playFileAudio(src: string, token = playbackToken, rate = 1): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(src);
    activeAudio = audio;
    audio.preload = 'auto';
    audio.playbackRate = rate;
    (audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
    const release = () => {
      if (activeAudio === audio) {
        activeAudio = null;
        settleActive = null;
      }
      audio.onended = null;
      audio.onerror = null;
    };
    settleActive = () => {
      release();
      resolve();
    };
    audio.onended = () => {
      release();
      resolve();
    };
    audio.onerror = () => {
      release();
      reject(new Error('Audio file failed'));
    };
    if (token !== playbackToken) {
      release();
      resolve();
      return;
    }
    audio.play().catch((error: unknown) => {
      release();
      reject(error instanceof Error ? error : new Error('Audio playback failed'));
    });
  });
}

/** Recorded voice speed follows the «Скорость» setting (0.9 is the recording's own pace). */
function recordedRate(): number {
  return Math.min(1.3, Math.max(0.6, speechRate / 0.9));
}

async function playRecorded(text: string, language: Word['language'], token: number): Promise<boolean> {
  const files = await findRecordedSpeech(text, language);
  if (!files || token !== playbackToken) return Boolean(files);
  for (const file of files) {
    if (token !== playbackToken) return true;
    await playFileAudio(file, token, recordedRate());
  }
  return true;
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
      await playFileAudio(word.audio_original, token);
      return;
    } catch {
      activeAudio = null;
    }
  }

  const spoken = getSpokenWordText(word);
  try {
    if (await playRecorded(spoken, word.language, token)) return;
  } catch {
    activeAudio = null;
  }

  try {
    await speakFallback(spoken, token, word.language);
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
    if (await playRecorded(text, language, token)) return;
  } catch {
    activeAudio = null;
  }
  try {
    await speakFallback(text, token, language);
  } catch {
    // Speech is a convenience; a failed playback must not break the lesson.
  }
}

export function stopAudio(): void {
  playbackToken += 1;

  const audio = activeAudio;
  const settle = settleActive;
  settleActive = null;
  activeAudio = null;
  if (audio) {
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio.currentTime = 0;
  }
  settle?.();

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  activeUtterance = null;
}
