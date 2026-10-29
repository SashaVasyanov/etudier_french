import { useEffect, useState } from 'react';
import { listVoices, playTextAudio, type VoiceOption } from '../lib/audio';
import type { LearningLanguage, SpeechPreferences } from '../types';
import { AppIcon } from './AppIcon';

interface SpeechSettingsPanelProps {
  language: LearningLanguage;
  speech: SpeechPreferences;
  onChange: (change: { language?: LearningLanguage; voiceId?: string | null; rate?: number }) => void;
}

const QUALITY_LABELS: Record<VoiceOption['quality'], string> = {
  premium: 'премиум',
  enhanced: 'улучшенный',
  standard: 'обычный',
  basic: 'роботизированный',
};

const RATES = [
  { value: 0.75, label: 'Медленно' },
  { value: 0.9, label: 'Спокойно' },
  { value: 1, label: 'Обычно' },
];

const SAMPLE: Record<LearningLanguage, string> = {
  french: 'Bonjour ! Nous allons à Paris demain matin.',
  japanese: 'こんにちは。明日の朝、東京へ行きます。',
};

/**
 * Speech uses the voices installed in macOS. The default ones are compact;
 * the free «Premium» / «Enhanced» voices sound far more natural, so the panel
 * explains where to get them.
 */
export function SpeechSettingsPanel({ language, speech, onChange }: SpeechSettingsPanelProps) {
  const [voices, setVoices] = useState<VoiceOption[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listVoices(language).then((result) => {
      if (!cancelled) setVoices(result);
    });
    return () => {
      cancelled = true;
    };
  }, [language]);

  const selected = speech.voices[language] ?? '';

  return (
    <section className="settings-panel settings-speech-panel">
      <div className="settings-section-title">
        <span className="settings-icon"><AppIcon name="volume" size={21} /></span>
        <div>
          <h2>Озвучка</h2>
          <p>Слова и примеры курса озвучены заранее нейросетевым голосом. Системный голос ниже нужен только для ваших собственных слов.</p>
        </div>
      </div>

      <label className="settings-row">
        <span>
          Системный голос
          <small>{voices === null ? 'Загружаем список голосов…' : voices.length === 0 ? 'В системе нет голоса для этого языка.' : 'Лучшие голоса стоят первыми.'}</small>
        </span>
        <select
          className="settings-select"
          value={selected}
          disabled={!voices || voices.length === 0}
          onChange={(event) => onChange({ language, voiceId: event.target.value || null })}
        >
          <option value="">Автоматически (лучший)</option>
          {(voices ?? []).map((voice) => (
            <option key={voice.id} value={voice.id}>
              {voice.name} — {QUALITY_LABELS[voice.quality]}
            </option>
          ))}
        </select>
      </label>

      <label className="settings-row">
        <span>
          Скорость
          <small>Медленнее — легче расслышать окончания.</small>
        </span>
        <select
          className="settings-select"
          value={RATES.some((rate) => rate.value === speech.rate) ? speech.rate : 0.9}
          onChange={(event) => onChange({ rate: Number(event.target.value) })}
        >
          {RATES.map((rate) => (
            <option key={rate.value} value={rate.value}>{rate.label}</option>
          ))}
        </select>
      </label>

      <div className="speech-actions">
        <button type="button" className="secondary-button" onClick={() => { void playTextAudio(SAMPLE[language], language); }}>
          <AppIcon name="volume" size={17} /> Прослушать пример
        </button>
      </div>

    </section>
  );
}
