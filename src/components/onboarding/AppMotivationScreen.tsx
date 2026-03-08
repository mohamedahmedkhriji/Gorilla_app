import React, { useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { Check } from 'lucide-react';

interface AppMotivationScreenProps {
  onNext: () => void;
  onDataChange?: (data: any) => void;
  onboardingData?: any;
}

const MOTIVATION_OPTIONS = [
  {
    id: 'guided_start',
    title: 'I want clear guidance from day one',
    description: 'Give me structure so I know exactly what to do each session.',
  },
  {
    id: 'consistency',
    title: 'I need help staying consistent',
    description: 'Build a realistic routine I can follow every week.',
  },
  {
    id: 'progress_plateau',
    title: 'I am stuck and want better progress',
    description: 'Help me break plateaus with smarter programming.',
  },
  {
    id: 'time_efficiency',
    title: 'I want efficient workouts for my schedule',
    description: 'Keep sessions focused and aligned to my available time.',
  },
  {
    id: 'accountability',
    title: 'I want accountability and feedback',
    description: 'Track my training and keep me on track long term.',
  },
];

export function AppMotivationScreen({ onNext, onDataChange, onboardingData }: AppMotivationScreenProps) {
  const initialSelection = useMemo(() => {
    const saved = String(onboardingData?.appMotivation || '').trim();
    return MOTIVATION_OPTIONS.some((option) => option.id === saved) ? saved : '';
  }, [onboardingData?.appMotivation]);

  const [selectedId, setSelectedId] = useState(initialSelection);

  const handleNext = () => {
    const selectedOption = MOTIVATION_OPTIONS.find((option) => option.id === selectedId);
    if (!selectedOption) return;

    onDataChange?.({
      appMotivation: selectedOption.id,
      appMotivationLabel: selectedOption.title,
      onboardingReason: selectedOption.title,
    });
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

      <div className="space-y-3">
        {MOTIVATION_OPTIONS.map((option) => {
          const isSelected = selectedId === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setSelectedId(option.id)}
              className={`w-full rounded-xl border p-4 text-left transition-colors ${
                isSelected
                  ? 'bg-accent/12 border-accent text-white'
                  : 'bg-card border-white/10 text-text-secondary hover:bg-white/5'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white">{option.title}</p>
                  <p className="text-xs text-text-secondary">{option.description}</p>
                </div>
                {isSelected && (
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-black">
                    <Check size={13} strokeWidth={3} />
                  </span>
                )}
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
