import React, { useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { SelectionCheck } from '../ui/SelectionCheck';
import { DEFAULT_ONBOARDING_CONFIG, type PlanOption } from '../../config/onboardingConfig';
import { getOnboardingLanguage, localizeSportPlanOptions } from './onboardingI18n';

interface SportPlanChoiceScreenProps {
  onNext: () => void;
  onDataChange?: (data: Record<string, unknown>) => void;
  onboardingData?: {
    workoutSplitPreference?: string;
  };
  options?: PlanOption[];
}

const COPY = {
  en: {
    title: 'Plan Generation',
    subtitle: 'Choose how you want to create your workout plan.',
    cta: 'Next Step',
  },
  ar: {
    title: '\u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u062e\u0637\u0629',
    subtitle: '\u0627\u062e\u062a\u0631 \u0627\u0644\u0637\u0631\u064a\u0642\u0629 \u0627\u0644\u062a\u064a \u062a\u0631\u064a\u062f \u0628\u0647\u0627 \u0625\u0646\u0634\u0627\u0621 \u062e\u0637\u0629 \u062a\u062f\u0631\u064a\u0628\u0643.',
    cta: '\u0627\u0644\u062e\u0637\u0648\u0629 \u0627\u0644\u062a\u0627\u0644\u064a\u0629',
  },
  it: {
    title: 'Creazione del piano',
    subtitle: 'Scegli come vuoi creare il tuo piano di allenamento.',
    cta: 'Prossimo passo',
  },
  de: {
    title: 'Planerstellung',
    subtitle: 'Waehle, wie du deinen Trainingsplan erstellen moechtest.',
    cta: 'Naechster Schritt',
  },
} as const;

export function SportPlanChoiceScreen({
  onNext,
  onDataChange,
  onboardingData,
  options,
}: SportPlanChoiceScreenProps) {
  const language = getOnboardingLanguage();
  const copy = COPY[language] ?? COPY.en;
  const planOptions = options?.length
    ? options
    : DEFAULT_ONBOARDING_CONFIG.options.sportPlan;
  const localizedOptions = localizeSportPlanOptions(planOptions, language);
  const initialSelection = useMemo(() => {
    const saved = String(onboardingData?.workoutSplitPreference || '').trim().toLowerCase();
    return saved === 'custom' ? 'custom' : 'auto';
  }, [onboardingData?.workoutSplitPreference]);

  const [selectedId, setSelectedId] = useState<string>(initialSelection);

  const persistSelection = (nextId: string) => {
    const selectedOption = localizedOptions.find((option) => option.id === nextId);
    if (!selectedOption) return;
    onDataChange?.({
      workoutSplitPreference: selectedOption.id,
      workoutSplitLabel: selectedOption.title,
      ...(nextId !== 'auto'
        ? {
            aiTrainingFocus: '',
            aiLimitations: '',
            aiRecoveryPriority: '',
            aiEquipmentNotes: '',
          }
        : {}),
    });
  };

  const advanceToNextStep = () => {
    if (typeof window !== 'undefined') {
      window.setTimeout(() => onNext(), 0);
      return;
    }
    onNext();
  };

  return (
    <div className="flex-1 flex flex-col space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-light text-white">{copy.title}</h2>
        <p className="text-text-secondary">{copy.subtitle}</p>
      </div>

      <div className="space-y-3">
        {localizedOptions.map((option) => {
          const isSelected = selectedId === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setSelectedId(option.id);
                persistSelection(option.id);
              }}
              className={`w-full min-h-[108px] rounded-2xl border px-5 py-4 text-left transition-colors ${
                isSelected
                  ? 'bg-accent/12 border-accent text-white'
                  : 'bg-card border-white/10 text-text-secondary hover:bg-white/5'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <p className="text-base font-semibold leading-snug text-white">{option.title}</p>
                  <p className="text-sm leading-relaxed text-text-secondary">{option.description}</p>
                </div>
                <SelectionCheck selected={isSelected} size={22} className="mt-1 shrink-0" />
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex-1" />

      <Button
        onClick={() => {
          persistSelection(selectedId);
          if (selectedId === 'custom') {
            advanceToNextStep();
            return;
          }
          onNext();
        }}
      >
        {copy.cta}
      </Button>
    </div>
  );
}
