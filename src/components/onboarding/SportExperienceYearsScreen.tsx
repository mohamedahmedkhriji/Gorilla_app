import React, { useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { SelectionCheck } from '../ui/SelectionCheck';
import { getOnboardingLanguage } from './onboardingI18n';

interface SportExperienceYearsScreenProps {
  onNext: () => void;
  onDataChange?: (data: Record<string, unknown>) => void;
  onboardingData?: {
    athleteIdentityLabel?: string;
    athleteIdentity?: string;
    athleteSubCategoryLabel?: string;
    athleteGoal?: string;
    experienceLevel?: string;
  };
}

const normalizeAthleteName = (label: unknown, id: unknown) => {
  const fromLabel = String(label || '').trim();
  if (fromLabel) return fromLabel;
  const normalized = String(id || '').trim().replace(/_/g, ' ');
  if (!normalized) return 'Sport';
  return normalized
    .split(' ')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
};

const LEVELS = [
  { id: 'Beginner', years: 0.5 },
  { id: 'Intermediate', years: 2 },
  { id: 'Advanced', years: 5 },
] as const;

const COPY = {
  en: {
    title: 'Fitness Background',
    subtitle: (specialty: string, sportName: string) =>
      `Help us understand your starting point${specialty ? ` for ${specialty}` : ` in ${sportName}`}.`,
    label: 'Experience Level',
    cta: 'Next Step',
    labels: { Beginner: 'Beginner', Intermediate: 'Intermediate', Advanced: 'Advanced' },
    desc: {
      Beginner: (name: string) => `New to ${name.toLowerCase()} training`,
      Intermediate: (name: string) => `1-2 years in ${name.toLowerCase()}`,
      Advanced: (name: string) => `3+ years in ${name.toLowerCase()}`,
    },
  },
  ar: {
    title: '\u0627\u0644\u062e\u0644\u0641\u064a\u0629 \u0627\u0644\u062a\u062f\u0631\u064a\u0628\u064a\u0629',
    subtitle: (specialty: string, sportName: string) =>
      `\u0633\u0627\u0639\u062f\u0646\u0627 \u0639\u0644\u0649 \u0641\u0647\u0645 \u0646\u0642\u0637\u0629 \u0627\u0644\u0628\u062f\u0627\u064a\u0629 \u0644\u062f\u064a\u0643${specialty ? ` \u0641\u064a ${specialty}` : ` \u0641\u064a ${sportName}`}.`,
    label: '\u0645\u0633\u062a\u0648\u0649 \u0627\u0644\u062e\u0628\u0631\u0629',
    cta: '\u0627\u0644\u062e\u0637\u0648\u0629 \u0627\u0644\u062a\u0627\u0644\u064a\u0629',
    labels: { Beginner: '\u0645\u0628\u062a\u062f\u0626', Intermediate: '\u0645\u062a\u0648\u0633\u0637', Advanced: '\u0645\u062a\u0642\u062f\u0645' },
    desc: {
      Beginner: (name: string) => `\u0645\u0628\u062a\u062f\u0626 \u0641\u064a \u062a\u062f\u0631\u064a\u0628 ${name}`,
      Intermediate: (name: string) => `\u062e\u0628\u0631\u0629 1-2 \u0633\u0646\u0629 \u0641\u064a ${name}`,
      Advanced: (name: string) => `\u062e\u0628\u0631\u0629 3 \u0633\u0646\u0648\u0627\u062a \u0623\u0648 \u0623\u0643\u062b\u0631 \u0641\u064a ${name}`,
    },
  },
  it: {
    title: 'Esperienza sportiva',
    subtitle: (specialty: string, sportName: string) =>
      `Aiutaci a capire il tuo punto di partenza${specialty ? ` per ${specialty}` : ` in ${sportName}`}.`,
    label: 'Livello di esperienza',
    cta: 'Prossimo passo',
    labels: { Beginner: 'Principiante', Intermediate: 'Intermedio', Advanced: 'Avanzato' },
    desc: {
      Beginner: (name: string) => `Nuovo nell allenamento ${name.toLowerCase()}`,
      Intermediate: (name: string) => `1-2 anni in ${name.toLowerCase()}`,
      Advanced: (name: string) => `3+ anni in ${name.toLowerCase()}`,
    },
  },
  de: {
    title: 'Sporterfahrung',
    subtitle: (specialty: string, sportName: string) =>
      `Hilf uns, deinen Ausgangspunkt besser zu verstehen${specialty ? ` fuer ${specialty}` : ` in ${sportName}`}.`,
    label: 'Erfahrungslevel',
    cta: 'Naechster Schritt',
    labels: { Beginner: 'Anfaenger', Intermediate: 'Fortgeschritten', Advanced: 'Profi' },
    desc: {
      Beginner: (name: string) => `Neu im ${name.toLowerCase()}-Training`,
      Intermediate: (name: string) => `1-2 Jahre in ${name.toLowerCase()}`,
      Advanced: (name: string) => `3+ Jahre in ${name.toLowerCase()}`,
    },
  },
} as const;

export function SportExperienceYearsScreen({
  onNext,
  onDataChange,
  onboardingData,
}: SportExperienceYearsScreenProps) {
  const language = getOnboardingLanguage();
  const copy = COPY[language] ?? COPY.en;
  const sportName = useMemo(
    () => normalizeAthleteName(onboardingData?.athleteIdentityLabel, onboardingData?.athleteIdentity),
    [onboardingData?.athleteIdentity, onboardingData?.athleteIdentityLabel],
  );
  const specialty = String(onboardingData?.athleteSubCategoryLabel || onboardingData?.athleteGoal || '').trim();
  const specializationLabel = specialty || sportName;
  const validLevels = new Set(LEVELS.map((l) => l.id));
  const initialLevel = String(onboardingData?.experienceLevel || 'Intermediate');
  const [level, setLevel] = useState(validLevels.has(initialLevel as (typeof LEVELS)[number]['id']) ? initialLevel : 'Intermediate');

  const persistLevel = (nextLevel: string) => {
    const selected = LEVELS.find((entry) => entry.id === nextLevel);
    if (!selected) return;
    onDataChange?.({
      experienceLevel: selected.id,
      sportPracticeYears: selected.years,
      experienceLevelSource: 'specialized_selection',
    });
  };

  return (
    <div className="flex-1 flex flex-col space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-light text-white">{copy.title}</h2>
        <p className="text-text-secondary">{copy.subtitle(specialty, sportName)}</p>
      </div>

      <div className="space-y-6">
        <div className="space-y-3">
          <label className="text-sm font-medium text-text-secondary ml-1">{copy.label}</label>
          <div className="grid grid-cols-1 gap-3">
            {LEVELS.map((entry) => {
              const isSelected = level === entry.id;
              const labels = copy.labels as Record<string, string>;
              const descriptions = copy.desc as Record<string, (name: string) => string>;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    setLevel(entry.id);
                    persistLevel(entry.id);
                  }}
                  className={`
                    w-full p-4 rounded-xl border text-left transition-all duration-200 flex justify-between items-center
                    ${isSelected ? 'bg-accent/10 border-accent text-white' : 'bg-card border-white/10 text-text-secondary hover:bg-white/5'}
                  `}
                >
                  <div>
                    <div className="font-medium">{labels[entry.id]}</div>
                    <div className="text-xs opacity-70">{descriptions[entry.id](specializationLabel)}</div>
                  </div>
                  {isSelected && <SelectionCheck selected size={20} />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1" />

      <Button
        onClick={() => {
          persistLevel(level);
          onNext();
        }}
      >
        {copy.cta}
      </Button>
    </div>
  );
}
