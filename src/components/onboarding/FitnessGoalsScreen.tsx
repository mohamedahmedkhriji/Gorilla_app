import React, { useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { SelectionCheck } from '../ui/SelectionCheck';
import { DEFAULT_ONBOARDING_CONFIG, type GoalOption } from '../../config/onboardingConfig';
import { getOnboardingLanguage, localizeFitnessGoals } from './onboardingI18n';

interface FitnessGoalsScreenProps {
  onNext: () => void;
  onDataChange?: (data: any) => void;
  onboardingData?: any;
  options?: GoalOption[];
}

const COPY = {
  en: {
    title: 'What are your top fitness goals?',
    subtitle: 'This helps us tailor the right exercises and set targets for your plan.',
    cta: 'Continue',
  },
  ar: {
    title: '\u0645\u0627 \u0623\u0647\u0645 \u0623\u0647\u062f\u0627\u0641\u0643 \u0641\u064a \u0627\u0644\u0644\u064a\u0627\u0642\u0629\u061f',
    subtitle: '\u064a\u0633\u0627\u0639\u062f\u0646\u0627 \u0630\u0644\u0643 \u0639\u0644\u0649 \u0627\u062e\u062a\u064a\u0627\u0631 \u0627\u0644\u062a\u0645\u0627\u0631\u064a\u0646 \u0627\u0644\u0645\u0646\u0627\u0633\u0628\u0629 \u0648\u062a\u062d\u062f\u064a\u062f \u0623\u0647\u062f\u0627\u0641 \u062e\u0637\u062a\u0643.',
    cta: '\u0645\u062a\u0627\u0628\u0639\u0629',
  },
  it: {
    title: 'Quali sono i tuoi obiettivi fitness principali?',
    subtitle: 'Questo ci aiuta a scegliere gli esercizi giusti e gli obiettivi del tuo piano.',
    cta: 'Continua',
  },
  de: {
    title: 'Was sind deine wichtigsten Fitnessziele?',
    subtitle: 'So koennen wir die richtigen Uebungen und Ziele fuer deinen Plan festlegen.',
    cta: 'Weiter',
  },
} as const;

const toSelectedGoalIds = (onboardingData: any, goalOptions: GoalOption[]) => {
  const fromList = Array.isArray(onboardingData?.fitnessGoalIds)
    ? onboardingData.fitnessGoalIds.map((entry: unknown) => String(entry || '').trim())
    : [];
  if (fromList.length) return fromList.filter(Boolean);

  const fromGoalValue = String(onboardingData?.fitnessGoal || '').trim().toLowerCase();
  if (!fromGoalValue) return [];

  const matched = goalOptions.find(
    (option) => option.goalValue.trim().toLowerCase() === fromGoalValue,
  );
  return matched ? [matched.id] : [];
};

export function FitnessGoalsScreen({
  onNext,
  onDataChange,
  onboardingData,
  options,
}: FitnessGoalsScreenProps) {
  const language = getOnboardingLanguage();
  const copy = COPY[language] ?? COPY.en;
  const goalOptions = options?.length
    ? options
    : DEFAULT_ONBOARDING_CONFIG.options.fitnessGoals;
  const localizedOptions = localizeFitnessGoals(goalOptions, language);
  const initialIds = useMemo(
    () => toSelectedGoalIds(onboardingData, goalOptions),
    [goalOptions, onboardingData],
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(initialIds);

  const persistGoals = (goalIds: string[]) => {
    const selectedOptions = localizedOptions.filter((option) => goalIds.includes(option.id));
    const primary = selectedOptions[0] || null;

    onDataChange?.({
      fitnessGoalIds: selectedOptions.map((option) => option.id),
      fitnessGoals: selectedOptions.map((option) => option.title),
      fitnessGoal: primary?.goalValue || '',
      primaryGoal: primary?.goalValue || '',
    });
  };

  const toggleGoal = (goalId: string) => {
    const nextIds = selectedIds.includes(goalId)
      ? selectedIds.filter((id) => id !== goalId)
      : [...selectedIds, goalId];

    setSelectedIds(nextIds);
    persistGoals(nextIds);
  };

  return (
    <div className="flex-1 flex flex-col space-y-5">
      <div className="space-y-2">
        <h2 className="text-2xl font-light text-white">{copy.title}</h2>
        <p className="text-text-secondary">{copy.subtitle}</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-card/70 overflow-hidden">
        {localizedOptions.map((option, index) => {
          const selected = selectedIds.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => toggleGoal(option.id)}
              className={`w-full px-4 py-4 text-left transition-colors ${
                selected ? 'bg-accent/10' : 'hover:bg-white/5'
              } ${index !== goalOptions.length - 1 ? 'border-b border-white/10' : ''}`}
            >
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  {option.tag ? (
                    <span className="inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] bg-white text-black">
                      {option.tag}
                    </span>
                  ) : null}
                  <p className="mt-1 text-base font-semibold text-white">{option.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-text-secondary">{option.description}</p>
                </div>

                <span className="pt-1 shrink-0">
                  <SelectionCheck selected={selected} size={24} rounded="md" />
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex-1" />

      <Button onClick={onNext} disabled={!selectedIds.length}>
        {copy.cta}
      </Button>
    </div>
  );
}
