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
    const finish = () => {
      window.clearTimeout(timeoutId);
      removeVoicesChangedListener(finish);
      resolve(getVoices());
    };
    const timeoutId = window.setTimeout(() => {
      removeVoicesChangedListener(finish);
      resolve(getVoices());
    }, VOICE_WAIT_TIMEOUT_MS);

    addVoicesChangedListener(finish);
  });

  return voicesReadyPromise;
}

function getFrenchVoiceScore(voice: SpeechSynthesisVoice): number {
  const lang = voice.lang.toLowerCase();
  const name = `${voice.name} ${voice.voiceURI}`.toLowerCase();

  if (!lang.startsWith('fr')) {
    return -1;
  }

  let score = 0;

  if (lang === 'fr-fr') {
    score += 100;
  } else if (lang.startsWith('fr-')) {
    score += 60;
  } else {
    score += 40;
  }

  if (name.includes('france') || name.includes('français') || name.includes('francais')) {
    score += 28;
  }

  if (name.includes('natural') || name.includes('online')) {
    score += 16;
  }

  if (name.includes('microsoft') || name.includes('google') || name.includes('apple')) {
    score += 10;
  }

  if (name.includes('denise') || name.includes('henri') || name.includes('thomas') || name.includes('amelie')) {
    score += 8;
  }

  if (voice.localService) {
    score += 4;
  }

  if (name.includes('canada') || lang === 'fr-ca') {
    score -= 20;
  }

  return score;
}

function pickFrenchVoice(
  availableVoices = cachedVoices.length > 0 ? cachedVoices : getVoices(),
): SpeechSynthesisVoice | undefined {
  const rankedVoices = availableVoices
    .map((voice) => ({ voice, score: getFrenchVoiceScore(voice) }))
    .filter(({ score }) => score >= 0)
    .sort((left, right) => right.score - left.score);

  return rankedVoices[0]?.voice;
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

  try {
    await audio.play();
  } catch (error) {
    activeAudio = null;
    throw error;
  }
}

async function speakFallback(text: string, token: number): Promise<void> {
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
  activeUtterance.lang = 'fr-FR';
  activeUtterance.rate = 0.86;
  activeUtterance.pitch = 1;
  activeUtterance.volume = 1;
  activeUtterance.voice = pickFrenchVoice(voices) ?? null;

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

export async function playWordAudio(word: Word): Promise<void> {
  if (!canReplay()) {
    return;
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
    await speakFallback(getSpokenWordText(word), token);
  } catch {
    return;
  }
}

export function stopAudio(): void {
  playbackToken += 1;

  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  activeUtterance = null;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  addVoicesChangedListener(getVoices);
  void waitForVoices();
}
