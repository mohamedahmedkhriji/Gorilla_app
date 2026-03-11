import React, { useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { SelectionCheck } from '../ui/SelectionCheck';

interface WorkoutSplitScreenProps {
  onNext: () => void;
  onDataChange?: (data: any) => void;
  onboardingData?: any;
}

type SplitOption = {
  id: string;
  title: string;
  summary: string;
  detail: string;
  days: number[];
};

const SPLIT_OPTIONS: SplitOption[] = [
  {
    id: 'auto',
    title: 'AI Coach Plan',
    summary: 'Generate a fully personalized plan with Claude AI',
    detail: 'Uses your onboarding profile and preferences to build a structured 8-week plan.',
    days: [2, 3, 4, 5, 6],
  },
  {
    id: 'full_body',
    title: 'Full Body Focus',
    summary: 'Train all major muscle groups each session',
    detail: 'Great for fewer days and steady weekly progress.',
    days: [2, 3, 4],
  },
  {
    id: 'upper_lower',
    title: 'Upper / Lower',
    summary: 'Alternate upper-body and lower-body days',
    detail: 'Balanced structure with good recovery between sessions.',
    days: [3, 4, 5, 6],
  },
  {
    id: 'push_pull_legs',
    title: 'Push / Pull / Legs',
    summary: 'Movement-based split with focused training days',
    detail: 'Best for moderate-to-high frequency training weeks.',
    days: [3, 4, 5, 6],
  },
  {
    id: 'hybrid',
    title: 'Push / Pull / Legs + Upper / Lower',
    summary: 'Blend PPL and upper/lower for more total volume',
    detail: 'Great when you want extra variety and balanced weekly workload.',
    days: [4, 5, 6],
  },
  {
    id: 'custom',
    title: 'Customized Plan',
    summary: 'Build a tailored split around your own priorities',
    detail: 'Designed for advanced lifters who want maximum control over structure and volume.',
    days: [2, 3, 4, 5, 6],
  },
];

const toTrainingDays = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 4;
  return Math.max(2, Math.min(6, Math.round(parsed)));
};

const recommendedSplitForDays = (days: number) => {
  if (days <= 3) return 'full_body';
  if (days === 4) return 'upper_lower';
  return 'push_pull_legs';
};

export function WorkoutSplitScreen({ onNext, onDataChange, onboardingData }: WorkoutSplitScreenProps) {
  const trainingDays = toTrainingDays(onboardingData?.workoutDays);
  const levelLabel = String(onboardingData?.experienceLevel || 'intermediate').trim().toLowerCase();
  const genderLabel = String(onboardingData?.gender || 'unspecified').trim().toLowerCase();
  const availableOptions = useMemo(
    () => SPLIT_OPTIONS.filter((option) => option.days.includes(trainingDays)),
    [trainingDays],
  );
  const recommendedId = recommendedSplitForDays(trainingDays);

  const initialSelection = useMemo(() => {
    const saved = String(onboardingData?.workoutSplitPreference || '').trim().toLowerCase();
    if (availableOptions.some((option) => option.id === saved)) return saved;
    if (availableOptions.some((option) => option.id === recommendedId)) return recommendedId;
    if (availableOptions.some((option) => option.id === 'auto')) return 'auto';
    return availableOptions[0]?.id || 'auto';
  }, [availableOptions, onboardingData?.workoutSplitPreference, recommendedId]);

  const [selectedId, setSelectedId] = useState(initialSelection);
  const persistSelection = (optionId: string) => {
    const selectedOption = availableOptions.find((option) => option.id === optionId);
    if (!selectedOption) return;
    onDataChange?.({
      workoutSplitPreference: selectedOption.id,
      workoutSplitLabel: selectedOption.title,
      ...(optionId !== 'auto'
        ? {
            aiTrainingFocus: '',
            aiLimitations: '',
            aiRecoveryPriority: '',
            aiEquipmentNotes: '',
          }
        : {}),
    });
    return selectedOption;
  };

  const handleNext = () => {
    const selectedOption = persistSelection(selectedId);
    if (!selectedOption) return;
    onNext();
  };

  return (
    <div className="flex-1 flex flex-col space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-light text-white">Choose your plan type</h2>
        <p className="text-text-secondary">
          Based on {trainingDays} training day{trainingDays > 1 ? 's' : ''}, {levelLabel} level, and {genderLabel} profile, these are your best-fit options.
        </p>
      </div>

      <div className="space-y-3">
        {availableOptions.map((option) => {
          const isSelected = selectedId === option.id;
          const isRecommended = option.id === recommendedId;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setSelectedId(option.id);
                const selectedOption = persistSelection(option.id);
                if (option.id === 'custom') {
                  if (selectedOption) onNext();
                }
              }}
              className={`w-full rounded-xl border p-4 text-left transition-colors ${
                isSelected
                  ? 'bg-accent/12 border-accent text-white'
                  : 'bg-card border-white/10 text-text-secondary hover:bg-white/5'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  {option.id === 'custom' && (
                    <span className="inline-flex items-center rounded-full bg-accent/20 text-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                      Create + AI Feedback
                    </span>
                  )}
                  {isRecommended && (
                    <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black">
                      Recommended for you
                    </span>
                  )}
                  <p className="text-sm font-semibold text-white">{option.title}</p>
                  <p className="text-xs text-text-secondary">{option.summary}</p>
                  <p className="text-[11px] text-text-tertiary">{option.detail}</p>
                </div>
                <SelectionCheck selected={isSelected} className="mt-0.5 shrink-0" />
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex-1" />

      <Button onClick={handleNext} disabled={!selectedId}>
        Next Step
      </Button>
    </div>
  );
}
