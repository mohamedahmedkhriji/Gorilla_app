import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { SelectionCheck } from '../ui/SelectionCheck';
import { getOnboardingLanguage } from './onboardingI18n';

interface FitnessBackgroundScreenProps {
  onNext: () => void;
  onDataChange?: (data: any) => void;
  onboardingData?: any;
}

const COPY = {
  en: {
    title: 'Fitness Background',
    subtitle: 'Help us understand your starting point.',
    label: 'Experience Level',
    cta: 'Next Step',
    levels: {
      Beginner: { label: 'Beginner', desc: 'New to lifting' },
      Intermediate: { label: 'Intermediate', desc: '1-2 years experience' },
      Advanced: { label: 'Advanced', desc: '3+ years experience' },
    },
  },
  ar: {
    title: '\u0627\u0644\u062e\u0644\u0641\u064a\u0629 \u0627\u0644\u062a\u062f\u0631\u064a\u0628\u064a\u0629',
    subtitle: '\u0633\u0627\u0639\u062f\u0646\u0627 \u0639\u0644\u0649 \u0641\u0647\u0645 \u0646\u0642\u0637\u0629 \u0627\u0644\u0628\u062f\u0627\u064a\u0629 \u0644\u062f\u064a\u0643.',
    label: '\u0645\u0633\u062a\u0648\u0649 \u0627\u0644\u062e\u0628\u0631\u0629',
    cta: '\u0627\u0644\u062e\u0637\u0648\u0629 \u0627\u0644\u062a\u0627\u0644\u064a\u0629',
    levels: {
      Beginner: { label: '\u0645\u0628\u062a\u062f\u0626', desc: '\u062c\u062f\u064a\u062f \u0639\u0644\u0649 \u062a\u0645\u0627\u0631\u064a\u0646 \u0627\u0644\u062d\u062f\u064a\u062f' },
      Intermediate: { label: '\u0645\u062a\u0648\u0633\u0637', desc: '\u062e\u0628\u0631\u0629 1-2 \u0633\u0646\u0629' },
      Advanced: { label: '\u0645\u062a\u0642\u062f\u0645', desc: '\u062e\u0628\u0631\u0629 3 \u0633\u0646\u0648\u0627\u062a \u0623\u0648 \u0623\u0643\u062b\u0631' },
    },
  },
  it: {
    title: 'Esperienza fitness',
    subtitle: 'Aiutaci a capire il tuo punto di partenza.',
    label: 'Livello di esperienza',
    cta: 'Prossimo passo',
    levels: {
      Beginner: { label: 'Principiante', desc: 'Nuovo ai pesi' },
      Intermediate: { label: 'Intermedio', desc: '1-2 anni di esperienza' },
      Advanced: { label: 'Avanzato', desc: '3+ anni di esperienza' },
    },
  },
  de: {
    title: 'Trainingshintergrund',
    subtitle: 'Hilf uns, deinen Ausgangspunkt zu verstehen.',
    label: 'Erfahrungslevel',
    cta: 'Naechster Schritt',
    levels: {
      Beginner: { label: 'Anfaenger', desc: 'Neu beim Krafttraining' },
      Intermediate: { label: 'Fortgeschritten', desc: '1-2 Jahre Erfahrung' },
      Advanced: { label: 'Profi', desc: '3+ Jahre Erfahrung' },
    },
  },
} as const;

export function FitnessBackgroundScreen({
  onNext,
  onDataChange,
  onboardingData,
}: FitnessBackgroundScreenProps) {
  const language = getOnboardingLanguage();
  const copy = COPY[language] ?? COPY.en;
  const validLevels = new Set(['Beginner', 'Intermediate', 'Advanced']);
  const initialLevel = String(onboardingData?.experienceLevel || 'Intermediate');
  const [level, setLevel] = useState(validLevels.has(initialLevel) ? initialLevel : 'Intermediate');

  const levels = [
    { id: 'Beginner' },
    { id: 'Intermediate' },
    { id: 'Advanced' },
  ] as const;

  return (
    <div className="flex-1 flex flex-col space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-light text-white">{copy.title}</h2>
        <p className="text-text-secondary">{copy.subtitle}</p>
      </div>

      <div className="space-y-6">
        <div className="space-y-3">
          <label className="text-sm font-medium text-text-secondary ml-1">{copy.label}</label>
          <div className="grid grid-cols-1 gap-3">
            {levels.map((entry) => {
              const localized = copy.levels[entry.id];
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    setLevel(entry.id);
                    onDataChange?.({ experienceLevel: entry.id });
                  }}
                  className={`
                    w-full p-4 rounded-xl border text-left transition-all duration-200 flex justify-between items-center
                    ${level === entry.id ? 'bg-accent/10 border-accent text-white' : 'bg-card border-white/10 text-text-secondary hover:bg-white/5'}
                  `}
                >
                  <div>
                    <div className="font-medium">{localized.label}</div>
                    <div className="text-xs opacity-70">{localized.desc}</div>
                  </div>
                  {level === entry.id && <SelectionCheck selected />}
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
