import { useState } from 'react';
import { hasFileStore } from '../lib/fileStore';
import type { ComfortPreferences, LearningLanguage, TextSize } from '../types';
import { AppIcon } from './AppIcon';

interface ComfortPanelProps {
  comfort: ComfortPreferences;
  language: LearningLanguage;
  onChange: (change: Partial<ComfortPreferences>) => void;
}

const TEXT_SIZES: Array<{ value: TextSize; label: string }> = [
  { value: 'normal', label: 'Обычный' },
  { value: 'large', label: 'Крупнее' },
  { value: 'larger', label: 'Крупный' },
];

const DEFAULT_REMINDER = '19:00';

/** Text size, sound, motion, the Dock badge and the daily reminder. */
export function ComfortPanel({ comfort, language, onChange }: ComfortPanelProps) {
  const desktop = hasFileStore();
  // Remembers the last chosen time while the reminder is off.
  const [reminderDraft, setReminderDraft] = useState(comfort.reminderTime ?? DEFAULT_REMINDER);

  return (
    <section className="settings-panel settings-comfort-panel">
      <div className="settings-section-title">
        <span className="settings-icon"><AppIcon name="leaf" size={21} /></span>
        <div>
          <h2>Удобство</h2>
          <p>Как выглядят и звучат занятия и когда о них напомнить.</p>
        </div>
      </div>

      <label className="settings-row">
        <span>
          Размер текста
          <small>Для слов, заданий и словаря.</small>
        </span>
        <select
          className="settings-select"
          value={comfort.textSize}
          onChange={(event) => onChange({ textSize: event.target.value as TextSize })}
        >
          {TEXT_SIZES.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>

      <div className="settings-row">
        <span>
          Произносить автоматически
          <small>Новое слово и ответ звучат сами. В заданиях на слух звук включается всегда.</small>
        </span>
        <label className="settings-toggle">
          <input type="checkbox" checked={comfort.autoplay} onChange={(event) => onChange({ autoplay: event.target.checked })} />
          <span>{comfort.autoplay ? 'Включено' : 'Выключено'}</span>
        </label>
      </div>

      {language === 'japanese' ? (
        <>
          <div className="settings-row">
            <span>
              Фуригана
              <small>Чтение над кандзи в примерах и в чтении вместо отдельной строки хираганы.</small>
            </span>
            <label className="settings-toggle">
              <input type="checkbox" checked={comfort.furigana} onChange={(event) => onChange({ furigana: event.target.checked })} />
              <span>{comfort.furigana ? 'Включена' : 'Выключена'}</span>
            </label>
          </div>
          <div className="settings-row">
            <span>
              Ромадзи
              <small>Латиница рядом с чтением слова: [たべる · taberu]. Без неё — только кана.</small>
            </span>
            <label className="settings-toggle">
              <input type="checkbox" checked={comfort.romaji} onChange={(event) => onChange({ romaji: event.target.checked })} />
              <span>{comfort.romaji ? 'Показывать' : 'Скрывать'}</span>
            </label>
          </div>
        </>
      ) : null}

      <div className="settings-row">
        <span>
          Меньше движения
          <small>Без анимаций и плавных переходов.</small>
        </span>
        <label className="settings-toggle">
          <input type="checkbox" checked={comfort.reduceMotion} onChange={(event) => onChange({ reduceMotion: event.target.checked })} />
          <span>{comfort.reduceMotion ? 'Включено' : 'Выключено'}</span>
        </label>
      </div>

      <div className="settings-row">
        <span>
          Счётчик на значке
          <small>Сколько слов ждут повторения — на значке в Dock.</small>
        </span>
        <label className="settings-toggle">
          <input type="checkbox" checked={comfort.dockBadge} onChange={(event) => onChange({ dockBadge: event.target.checked })} />
          <span>{comfort.dockBadge ? 'Включён' : 'Выключен'}</span>
        </label>
      </div>

      <div className="settings-row settings-reminder-row">
        <span>
          Напоминание
          <small>
            {comfort.reminderTime
              ? `Каждый день в ${comfort.reminderTime}, если урок ещё не пройден.`
              : 'Уведомление macOS в выбранное время.'}
          </small>
        </span>
        <span className="settings-reminder">
          <input
            type="time"
            className="settings-input settings-time"
            value={comfort.reminderTime ?? reminderDraft}
            aria-label="Время напоминания"
            onChange={(event) => {
              const value = event.target.value;
              if (!/^\d{2}:\d{2}$/.test(value)) return;
              setReminderDraft(value);
              if (comfort.reminderTime) onChange({ reminderTime: value });
            }}
          />
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={comfort.reminderTime !== null}
              onChange={(event) => onChange({ reminderTime: event.target.checked ? reminderDraft : null })}
            />
            <span>{comfort.reminderTime ? 'Включено' : 'Выключено'}</span>
          </label>
        </span>
      </div>

      {!desktop ? <p className="settings-note">Значок и напоминания работают в приложении для macOS.</p> : null}
    </section>
  );
}
