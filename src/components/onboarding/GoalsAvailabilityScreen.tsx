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
    title: 'Let\u2019s fit your real life',
    subtitle: 'Choose a schedule you can actually sustain.',
    days: 'Days Per Week',
    duration: 'Session Duration',
    time: 'Preferred Time',
    optional: 'Optional',
    cta: 'Continue',
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
  fr: {
    title: 'Disponibilite',
    subtitle: 'Combien de fois peux-tu t entrainer ?',
    days: 'Jours par semaine',
    duration: 'Duree de la seance',
    time: 'Moment prefere',
    cta: 'Etape suivante',
  },
} as const;

const radioCardClasses = (selected: boolean, compact = false) =>
  [
    'group relative flex min-h-[3.1rem] w-full items-center overflow-hidden rounded-[13px] border text-left backdrop-blur-xl transition-all duration-300',
    compact ? 'justify-center gap-2 px-2 py-2.5' : 'gap-3 px-3 py-3',
    selected
      ? 'translate-x-[3px] border-accent/40 bg-accent/[0.07] text-white shadow-[0_0_0_1px_rgb(var(--color-accent)/0.16),inset_0_1px_0_rgb(var(--color-accent)/0.1)]'
      : 'border-white/[0.08] bg-white/[0.04] text-text-secondary hover:translate-x-[3px] hover:border-white/15 hover:bg-white/[0.07]',
  ].join(' ');

const radioCircleClasses = (selected: boolean) =>
  [
    'relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300',
    selected
      ? 'border-accent/70 bg-accent/10 shadow-[0_0_0_3px_rgb(var(--color-accent)/0.12)]'
      : 'border-white/15 bg-white/[0.04]',
  ].join(' ');

export function GoalsAvailabilityScreen({
  onNext,
  onDataChange,
  onboardingData,
  sessionDurationOptions,
  preferredTimeOptions,
  workoutDaysRange,
}: GoalsAvailabilityScreenProps) {
  const language = getOnboardingLanguage();
  const copy = COPY[language as keyof typeof COPY] ?? COPY.en;
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

  const renderRadioVisual = (selected: boolean, label: string, compact = false) => (
    <>
      <span
        className={`pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgb(var(--color-accent)/0.08),transparent)] transition-opacity duration-300 ${
          selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'
        }`}
        aria-hidden="true"
      />
      <span className={radioCircleClasses(selected)} aria-hidden="true">
        <span
          className={`h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_rgb(var(--color-accent)/0.6)] transition-transform duration-300 ${
            selected ? 'scale-100' : 'scale-0'
          }`}
        />
      </span>
      <span className={`relative z-10 min-w-0 ${compact ? 'text-center' : ''}`}>
        <span
          className={`block truncate text-sm font-semibold leading-tight transition-colors duration-300 ${
            selected ? 'text-white' : 'text-white/60 group-hover:text-white/75'
          }`}
        >
          {label}
        </span>
      </span>
    </>
  );

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
                  className={radioCardClasses(selected, true)}
                >
                  {renderRadioVisual(selected, String(value), true)}
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
                  className={radioCardClasses(selected)}
                >
                  {renderRadioVisual(selected, String(option.label || optionValue))}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-secondary ml-1">{copy.time}</p>
            {'optional' in copy ? (
              <span className="text-[10px] uppercase tracking-[0.12em] text-text-tertiary">{copy.optional as string}</span>
            ) : null}
          </div>
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
                  className={radioCardClasses(selected, true)}
                >
                  {renderRadioVisual(selected, String(option.label || optionValue), true)}
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
