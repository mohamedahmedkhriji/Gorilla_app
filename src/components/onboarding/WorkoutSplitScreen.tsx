import React, { useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { Check } from 'lucide-react';

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
  const [aiTrainingFocus, setAiTrainingFocus] = useState(
    String(onboardingData?.aiTrainingFocus || 'balanced').trim().toLowerCase() || 'balanced',
  );
  const [aiLimitations, setAiLimitations] = useState(
    String(onboardingData?.aiLimitations || '').trim(),
  );
  const [aiRecoveryPriority, setAiRecoveryPriority] = useState(
    String(onboardingData?.aiRecoveryPriority || 'balanced').trim().toLowerCase() || 'balanced',
  );
  const [aiEquipmentNotes, setAiEquipmentNotes] = useState(
    String(onboardingData?.aiEquipmentNotes || '').trim(),
  );

  const handleNext = () => {
    const selectedOption = availableOptions.find((option) => option.id === selectedId);
    if (!selectedOption) return;
    onDataChange?.({
      workoutSplitPreference: selectedOption.id,
      workoutSplitLabel: selectedOption.title,
      aiTrainingFocus: selectedId === 'auto' ? aiTrainingFocus : '',
      aiLimitations: selectedId === 'auto' ? aiLimitations.trim() : '',
      aiRecoveryPriority: selectedId === 'auto' ? aiRecoveryPriority : '',
      aiEquipmentNotes: selectedId === 'auto' ? aiEquipmentNotes.trim() : '',
    });
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
              onClick={() => setSelectedId(option.id)}
              className={`w-full rounded-xl border p-4 text-left transition-colors ${
                isSelected
                  ? 'bg-accent/12 border-accent text-white'
                  : 'bg-card border-white/10 text-text-secondary hover:bg-white/5'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  {isRecommended && (
                    <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black">
                      Recommended for you
                    </span>
                  )}
                  <p className="text-sm font-semibold text-white">{option.title}</p>
                  <p className="text-xs text-text-secondary">{option.summary}</p>
                  <p className="text-[11px] text-text-tertiary">{option.detail}</p>
                </div>
                {isSelected ? (
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-black">
                    <Check size={13} strokeWidth={3} />
                  </span>
                ) : (
                  <span className="mt-0.5 inline-flex h-5 w-5 rounded-full border border-white/20" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selectedId === 'auto' && (
        <div className="rounded-xl border border-white/10 bg-card p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-tertiary">AI plan tuning</p>

          <div className="space-y-1">
            <label className="text-xs text-text-secondary">Training focus</label>
            <select
              value={aiTrainingFocus}
              onChange={(e) => setAiTrainingFocus(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-background px-3 py-2 text-sm text-white"
            >
              <option value="balanced">Balanced</option>
              <option value="hypertrophy">Muscle growth focus</option>
              <option value="strength">Strength focus</option>
              <option value="fat_loss">Fat-loss support</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-text-secondary">Injuries or movements to avoid (optional)</label>
            <textarea
              value={aiLimitations}
              onChange={(e) => setAiLimitations(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-white/10 bg-background px-3 py-2 text-sm text-white resize-none"
              placeholder="e.g. lower back pain, avoid overhead pressing"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-text-secondary">Recovery strategy</label>
            <select
              value={aiRecoveryPriority}
              onChange={(e) => setAiRecoveryPriority(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-background px-3 py-2 text-sm text-white"
            >
              <option value="balanced">Balanced</option>
              <option value="performance">Push progression</option>
              <option value="recovery">Conservative recovery-first</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-text-secondary">Equipment notes (optional)</label>
            <input
              value={aiEquipmentNotes}
              onChange={(e) => setAiEquipmentNotes(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-background px-3 py-2 text-sm text-white"
              placeholder="e.g. no barbell bench, dumbbells + cables only"
            />
          </div>
        </div>
      )}

      <div className="flex-1" />

      <Button onClick={handleNext} disabled={!selectedId}>
        Next Step
      </Button>
    </div>
  );
}
