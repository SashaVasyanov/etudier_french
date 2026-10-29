import { describe, expect, it } from 'vitest';
import { getVoiceQuality } from '../src/lib/audio';

const voice = (name: string, lang = 'fr-FR') => ({ name, voiceURI: `com.apple.voice.${name}`, lang } as SpeechSynthesisVoice);

describe('voice quality', () => {
  it('never treats the robotic or novelty macOS voices as good', () => {
    expect(getVoiceQuality(voice('Eddy (French (France))'))).toBe('basic');
    expect(getVoiceQuality(voice('Grandma (日本語（日本）)', 'ja-JP'))).toBe('basic');
    expect(getVoiceQuality(voice('Bubbles', 'en-US'))).toBe('basic');
  });

  it('ranks premium and enhanced voices above the compact ones', () => {
    expect(getVoiceQuality(voice('Amélie (Premium)'))).toBe('premium');
    expect(getVoiceQuality(voice('Kyoko (Enhanced)', 'ja-JP'))).toBe('enhanced');
    expect(getVoiceQuality(voice('Thomas'))).toBe('standard');
  });
});

describe('recorded speech keys', () => {
  it('matches texts regardless of apostrophes and spacing', async () => {
    const { speechKey } = await import('../src/lib/audio');
    expect(speechKey("  l’abeille ")).toBe("l'abeille");
    expect(speechKey('Nous  allons\nà Paris.')).toBe('Nous allons à Paris.');
    expect(speechKey('été')).toBe('été');
  });
});
