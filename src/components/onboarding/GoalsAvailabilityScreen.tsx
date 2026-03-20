import React, { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { DEFAULT_ONBOARDING_CONFIG, type SelectOption, type WorkoutDaysRange } from '../../config/onboardingConfig';
import {
  getOnboardingLanguage,
  localizePreferredTimeOptions,
  localizeSessionDurationOptions,
} from './onboardingI18n';

interface GoalsAvailabilityScreenProps {
  onNext: () => void;
  onDataChange?: (data: any) => void;
  onboardingData?: any;
  sessionDurationOptions?: SelectOption[];
  preferredTimeOptions?: SelectOption[];
  workoutDaysRange?: WorkoutDaysRange;
}

const COPY = {
  en: {
    title: 'Availability',
    subtitle: 'How often can you train?',
    days: 'Days Per Week',
    duration: 'Session Duration',
    time: 'Preferred Time',
    cta: 'Next Step',
  },
  ar: {
    title: '\u0627\u0644\u0648\u0642\u062a \u0627\u0644\u0645\u062a\u0627\u062d',
    subtitle: '\u0643\u0645 \u0645\u0631\u0629 \u064a\u0645\u0643\u0646\u0643 \u0627\u0644\u062a\u062f\u0631\u064a\u0628\u061f',
    days: '\u0627\u0644\u0623\u064a\u0627\u0645 \u0641\u064a \u0627\u0644\u0623\u0633\u0628\u0648\u0639',
    duration: '\u0645\u062f\u0629 \u0627\u0644\u062c\u0644\u0633\u0629',
    time: '\u0627\u0644\u0648\u0642\u062a \u0627\u0644\u0645\u0641\u0636\u0644',
    cta: '\u0627\u0644\u062e\u0637\u0648\u0629 \u0627\u0644\u062a\u0627\u0644\u064a\u0629',
  },
  it: {
    title: 'Disponibilita',
    subtitle: 'Quante volte puoi allenarti?',
    days: 'Giorni a settimana',
    duration: 'Durata sessione',
    time: 'Orario preferito',
    cta: 'Prossimo passo',
  },
  de: {
    title: 'Verfuegbarkeit',
    subtitle: 'Wie oft kannst du trainieren?',
    days: 'Tage pro Woche',
    duration: 'Dauer pro Einheit',
    time: 'Bevorzugte Zeit',
    cta: 'Naechster Schritt',
  },
} as const;

export function GoalsAvailabilityScreen({
  onNext,
  onDataChange,
  onboardingData,
  sessionDurationOptions,
  preferredTimeOptions,
  workoutDaysRange,
}: GoalsAvailabilityScreenProps) {
  const language = getOnboardingLanguage();
  const copy = COPY[language] ?? COPY.en;
  const durationOptions = sessionDurationOptions?.length
    ? sessionDurationOptions
    : DEFAULT_ONBOARDING_CONFIG.options.sessionDurations;
  const timeOptions = preferredTimeOptions?.length
    ? preferredTimeOptions
    : DEFAULT_ONBOARDING_CONFIG.options.preferredTimes;
  const localizedDurations = localizeSessionDurationOptions(durationOptions, language);
  const localizedTimes = localizePreferredTimeOptions(timeOptions, language);
  const daysRange = workoutDaysRange || DEFAULT_ONBOARDING_CONFIG.options.workoutDaysRange;

  const normalizeDays = (value: unknown) => {
    const parsed = Number(value);
    const fallback = Number(daysRange.defaultValue ?? 4);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(daysRange.min, Math.min(daysRange.max, Math.round(parsed)));
  };

  const normalizeDuration = (value: unknown) => {
    const normalized = String(value || '').trim();
    const allowed = new Set(durationOptions.map((option) => String(option.value)));
    if (allowed.has(normalized)) return normalized;
    return String(durationOptions[0]?.value || '60');
  };

  const normalizeTime = (value: unknown) => {
    const normalized = String(value || '').trim().toLowerCase();
    const allowed = new Set(timeOptions.map((option) => String(option.value).toLowerCase()));
    if (allowed.has(normalized)) return normalized;
    return String(timeOptions[0]?.value || 'evening');
  };

  const [days, setDays] = useState(normalizeDays(onboardingData?.workoutDays));
  const [duration, setDuration] = useState(normalizeDuration(onboardingData?.sessionDuration));
  const [time, setTime] = useState(normalizeTime(onboardingData?.preferredTime));
  const dayOptions = (daysRange.labels && daysRange.labels.length
    ? daysRange.labels
    : Array.from({ length: daysRange.max - daysRange.min + 1 }, (_, idx) => daysRange.min + idx)
  ).map((value) => Number(value));

  useEffect(() => {
    setDays(normalizeDays(onboardingData?.workoutDays));
  }, [daysRange, onboardingData?.workoutDays]);

  useEffect(() => {
    setDuration(normalizeDuration(onboardingData?.sessionDuration));
  }, [durationOptions, onboardingData?.sessionDuration]);

  useEffect(() => {
    setTime(normalizeTime(onboardingData?.preferredTime));
  }, [timeOptions, onboardingData?.preferredTime]);

  useEffect(() => {
    onDataChange?.({
      workoutDays: days,
      sessionDuration: duration,
      preferredTime: time,
    });
  }, [days, duration, onDataChange, time]);

  return (
    <div className="flex-1 flex flex-col space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-light text-white">{copy.title}</h2>
        <p className="text-text-secondary">{copy.subtitle}</p>
      </div>

      <div className="space-y-8">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-secondary ml-1">{copy.days}</p>
          <div className="grid grid-cols-5 gap-2">
            {dayOptions.map((value) => {
              const selected = days === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setDays(value)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                    selected
                      ? 'border-accent bg-accent/15 text-white'
                      : 'border-white/15 bg-white/[0.03] text-text-secondary hover:border-white/25 hover:bg-white/[0.05]'
                  }`}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-secondary ml-1">{copy.duration}</p>
          <div className="grid grid-cols-2 gap-2">
            {localizedDurations.map((option) => {
              const optionValue = String(option.value || '');
              const selected = duration === optionValue;
              return (
                <button
                  key={optionValue}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setDuration(optionValue)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                    selected
                      ? 'border-accent bg-accent/15 text-white'
                      : 'border-white/15 bg-white/[0.03] text-text-secondary hover:border-white/25 hover:bg-white/[0.05]'
                  }`}
                >
                  {String(option.label || optionValue)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-secondary ml-1">{copy.time}</p>
          <div className="grid grid-cols-3 gap-2">
            {localizedTimes.map((option) => {
              const optionValue = String(option.value || '').trim().toLowerCase();
              const selected = time === optionValue;
              return (
                <button
                  key={optionValue}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setTime(optionValue)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                    selected
                      ? 'border-accent bg-accent/15 text-white'
                      : 'border-white/15 bg-white/[0.03] text-text-secondary hover:border-white/25 hover:bg-white/[0.05]'
                  }`}
                >
                  {String(option.label || optionValue)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1" />

      <Button onClick={onNext}>{copy.cta}</Button>
    </div>
  );
}
