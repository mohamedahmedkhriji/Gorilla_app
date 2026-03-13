import React, { useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { SelectionCheck } from '../ui/SelectionCheck';
import { DEFAULT_ONBOARDING_CONFIG, type PlanOption } from '../../config/onboardingConfig';

interface SportPlanChoiceScreenProps {
  onNext: () => void;
  onDataChange?: (data: Record<string, unknown>) => void;
  onboardingData?: {
    workoutSplitPreference?: string;
  };
  options?: PlanOption[];
}
export function SportPlanChoiceScreen({
  onNext,
  onDataChange,
  onboardingData,
  options,
}: SportPlanChoiceScreenProps) {
  const planOptions = options?.length
    ? options
    : DEFAULT_ONBOARDING_CONFIG.options.sportPlan;
  const initialSelection = useMemo(() => {
    const saved = String(onboardingData?.workoutSplitPreference || '').trim().toLowerCase();
    return saved === 'custom' ? 'custom' : 'auto';
  }, [onboardingData?.workoutSplitPreference]);

  const [selectedId, setSelectedId] = useState<string>(initialSelection);

  const persistSelection = (nextId: string) => {
    const selectedOption = planOptions.find((option) => option.id === nextId);
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

  const handleNext = () => {
    persistSelection(selectedId);
    onNext();
  };

  return (
    <div className="flex-1 flex flex-col space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-light text-white">Plan Generation</h2>
        <p className="text-text-secondary">Choose how you want to create your workout plan.</p>
      </div>

      <div className="space-y-3">
        {planOptions.map((option) => {
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

      <Button onClick={handleNext}>Next Step</Button>
    </div>
  );
}
