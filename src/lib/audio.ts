import type { Word } from '../types';

let activeUtterance: SpeechSynthesisUtterance | null = null;
let activeAudio: HTMLAudioElement | null = null;
let lastPlayAt = 0;
let cachedVoices: SpeechSynthesisVoice[] = [];

const REPLAY_DEBOUNCE_MS = 450;

function getVoices(): SpeechSynthesisVoice[] {
  if (!('speechSynthesis' in window)) {
    return [];
  }

  cachedVoices = window.speechSynthesis.getVoices();
  return cachedVoices;
}

function pickFrenchVoice(): SpeechSynthesisVoice | undefined {
  const voices = cachedVoices.length > 0 ? cachedVoices : getVoices();

  return (
    voices.find((voice) => voice.lang.toLowerCase() === 'fr-fr') ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith('fr'))
  );
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

function speakFallback(text: string): Promise<void> {
  if (!('speechSynthesis' in window)) {
    return Promise.resolve();
  }

  window.speechSynthesis.cancel();
  activeUtterance = new SpeechSynthesisUtterance(text);
  activeUtterance.lang = 'fr-FR';
  activeUtterance.rate = 0.9;
  activeUtterance.pitch = 1;
  activeUtterance.voice = pickFrenchVoice() ?? null;

  return new Promise((resolve, reject) => {
    if (!activeUtterance) {
      resolve();
      return;
    }

    activeUtterance.onend = () => {
      activeUtterance = null;
      resolve();
    };
    activeUtterance.onerror = () => {
      activeUtterance = null;
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

  if (word.audio_original) {
    try {
      await playFileAudio(word.audio_original);
      return;
    } catch {
      activeAudio = null;
    }
  }

  try {
    await speakFallback(word.original);
  } catch {
    return;
  }
}

export function stopAudio(): void {
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
  window.speechSynthesis.onvoiceschanged = () => {
    getVoices();
  };
}
