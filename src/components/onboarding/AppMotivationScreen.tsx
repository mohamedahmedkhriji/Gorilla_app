import React, { useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { SelectionCheck } from '../ui/SelectionCheck';
import { DEFAULT_ONBOARDING_CONFIG, type MotivationOption } from '../../config/onboardingConfig';

interface AppMotivationScreenProps {
  onNext: () => void;
  onDataChange?: (data: any) => void;
  onboardingData?: any;
  options?: MotivationOption[];
}

export function AppMotivationScreen({
  onNext,
  onDataChange,
  onboardingData,
  options,
}: AppMotivationScreenProps) {
  const motivationOptions = options?.length
    ? options
    : DEFAULT_ONBOARDING_CONFIG.options.appMotivation;
  const initialSelection = useMemo(() => {
    const saved = String(onboardingData?.appMotivation || '').trim();
    return motivationOptions.some((option) => option.id === saved) ? saved : '';
  }, [motivationOptions, onboardingData?.appMotivation]);

  const [selectedId, setSelectedId] = useState(initialSelection);

  const persistMotivation = (nextId: string) => {
    const selectedOption = motivationOptions.find((option) => option.id === nextId);
    if (!selectedOption) return;

    onDataChange?.({
      appMotivation: selectedOption.id,
      appMotivationLabel: selectedOption.title,
      onboardingReason: selectedOption.title,
    });
  };

  const handleNext = () => {
    const selectedOption = motivationOptions.find((option) => option.id === selectedId);
    if (!selectedOption) return;

    onNext();
  };

  return (
    <div className="flex-1 flex flex-col space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-light text-white">What brings you to RepSet?</h2>
        <p className="text-text-secondary">
          Pick the main reason so we can tailor your onboarding and first plan.
        </p>
      </div>

      <div className="space-y-4">
        {motivationOptions.map((option) => {
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

      <Button onClick={handleNext} disabled={!selectedId}>
        Continue
      </Button>
    </div>
  );
}
