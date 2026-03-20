import React, { useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { SelectionCheck } from '../ui/SelectionCheck';
import { DEFAULT_ONBOARDING_CONFIG, type MotivationOption } from '../../config/onboardingConfig';
import { getOnboardingLanguage, localizeMotivationOptions } from './onboardingI18n';

interface AppMotivationScreenProps {
  onNext: () => void;
  onDataChange?: (data: any) => void;
  onboardingData?: any;
  options?: MotivationOption[];
}

const COPY = {
  en: {
    title: 'What brings you to RepSet?',
    subtitle: 'Pick the main reason so we can tailor your onboarding and first plan.',
    cta: 'Continue',
  },
  ar: {
    title: '\u0645\u0627 \u0627\u0644\u0630\u064a \u062c\u0627\u0621 \u0628\u0643 \u0625\u0644\u0649 RepSet\u061f',
    subtitle: '\u0627\u062e\u062a\u0631 \u0627\u0644\u0633\u0628\u0628 \u0627\u0644\u0631\u0626\u064a\u0633\u064a \u0644\u0646\u062e\u0635\u0635 \u0644\u0643 \u062e\u0637\u0648\u0627\u062a \u0627\u0644\u0628\u062f\u0627\u064a\u0629 \u0648\u0627\u0644\u062e\u0637\u0629 \u0627\u0644\u0623\u0648\u0644\u0649.',
    cta: '\u0645\u062a\u0627\u0628\u0639\u0629',
  },
  it: {
    title: 'Cosa ti porta su RepSet?',
    subtitle: 'Scegli il motivo principale cosi possiamo personalizzare onboarding e primo piano.',
    cta: 'Continua',
  },
  de: {
    title: 'Warum bist du bei RepSet?',
    subtitle: 'Waehle den Hauptgrund, damit wir dein Onboarding und deinen ersten Plan anpassen koennen.',
    cta: 'Weiter',
  },
} as const;

export function AppMotivationScreen({
  onNext,
  onDataChange,
  onboardingData,
  options,
}: AppMotivationScreenProps) {
  const language = getOnboardingLanguage();
  const copy = COPY[language] ?? COPY.en;
  const motivationOptions = options?.length
    ? options
    : DEFAULT_ONBOARDING_CONFIG.options.appMotivation;
  const localizedOptions = localizeMotivationOptions(motivationOptions, language);
  const initialSelection = useMemo(() => {
    const saved = String(onboardingData?.appMotivation || '').trim();
    return motivationOptions.some((option) => option.id === saved) ? saved : '';
  }, [motivationOptions, onboardingData?.appMotivation]);

  const [selectedId, setSelectedId] = useState(initialSelection);

  const persistMotivation = (nextId: string) => {
    const selectedOption = localizedOptions.find((option) => option.id === nextId);
    if (!selectedOption) return;

    onDataChange?.({
      appMotivation: selectedOption.id,
      appMotivationLabel: selectedOption.title,
      onboardingReason: selectedOption.title,
    });
  };

  return (
    <div className="flex-1 flex flex-col space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-light text-white">{copy.title}</h2>
        <p className="text-text-secondary">{copy.subtitle}</p>
      </div>

      <div className="space-y-4">
        {localizedOptions.map((option) => {
          const isSelected = selectedId === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setSelectedId(option.id);
                persistMotivation(option.id);
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

      <Button onClick={onNext} disabled={!selectedId}>
        {copy.cta}
      </Button>
    </div>
  );
}
