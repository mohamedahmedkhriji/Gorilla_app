import React, { useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { Dumbbell, HeartPulse, ShieldAlert, Sparkles, Wrench } from 'lucide-react';
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

  const persistSelection = (optionId: string) => {
    const selectedOption = availableOptions.find((option) => option.id === optionId);
    if (!selectedOption) return;
    onDataChange?.({
      workoutSplitPreference: selectedOption.id,
      workoutSplitLabel: selectedOption.title,
      aiTrainingFocus: optionId === 'auto' ? aiTrainingFocus : '',
      aiLimitations: optionId === 'auto' ? aiLimitations.trim() : '',
      aiRecoveryPriority: optionId === 'auto' ? aiRecoveryPriority : '',
      aiEquipmentNotes: optionId === 'auto' ? aiEquipmentNotes.trim() : '',
    });
    return selectedOption;
  };

  const handleNext = () => {
    const selectedOption = persistSelection(selectedId);
    if (!selectedOption) return;
    onNext();
  };

  const fieldClassName =
    'w-full rounded-2xl border border-white/10 bg-background/80 px-4 py-3 text-sm text-white outline-none transition focus:border-accent/60 focus:bg-background focus:ring-2 focus:ring-accent/20';

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

      {selectedId === 'auto' && (
        <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.25)] backdrop-blur-sm">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(187,255,92,0.16),transparent_70%)]" />

          <div className="relative space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                  <Sparkles size={12} />
                  AI Plan Tuning
                </span>
                <div>
                  <p className="text-base font-semibold text-white">Shape how your AI program is built</p>
                  <p className="text-sm text-text-secondary">
                    Fine-tune the coaching style, recovery bias, and equipment constraints before we generate your plan.
                  </p>
                </div>
              </div>

              <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-accent sm:flex">
                <Sparkles size={20} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 rounded-2xl border border-white/8 bg-black/10 p-4">
                <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                  <Dumbbell size={14} className="text-accent" />
                  Training Focus
                </label>
                <select
                  value={aiTrainingFocus}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setAiTrainingFocus(nextValue);
                    onDataChange?.({ aiTrainingFocus: nextValue });
                  }}
                  className={fieldClassName}
                >
                  <option value="balanced">Balanced</option>
                  <option value="hypertrophy">Muscle growth focus</option>
                  <option value="strength">Strength focus</option>
                  <option value="fat_loss">Fat-loss support</option>
                </select>
              </div>

              <div className="space-y-2 rounded-2xl border border-white/8 bg-black/10 p-4">
                <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                  <HeartPulse size={14} className="text-accent" />
                  Recovery Strategy
                </label>
                <select
                  value={aiRecoveryPriority}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setAiRecoveryPriority(nextValue);
                    onDataChange?.({ aiRecoveryPriority: nextValue });
                  }}
                  className={fieldClassName}
                >
                  <option value="balanced">Balanced</option>
                  <option value="performance">Push progression</option>
                  <option value="recovery">Conservative recovery-first</option>
                </select>
              </div>

              <div className="space-y-2 rounded-2xl border border-white/8 bg-black/10 p-4 sm:col-span-2">
                <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                  <ShieldAlert size={14} className="text-accent" />
                  Injuries Or Movements To Avoid
                  <span className="text-[10px] font-medium normal-case tracking-normal text-text-secondary">(optional)</span>
                </label>
                <textarea
                  value={aiLimitations}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setAiLimitations(nextValue);
                    onDataChange?.({ aiLimitations: nextValue });
                  }}
                  rows={3}
                  className={`${fieldClassName} resize-none`}
                  placeholder="e.g. lower back pain, avoid overhead pressing"
                />
              </div>

              <div className="space-y-2 rounded-2xl border border-white/8 bg-black/10 p-4 sm:col-span-2">
                <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                  <Wrench size={14} className="text-accent" />
                  Equipment Notes
                  <span className="text-[10px] font-medium normal-case tracking-normal text-text-secondary">(optional)</span>
                </label>
                <input
                  value={aiEquipmentNotes}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setAiEquipmentNotes(nextValue);
                    onDataChange?.({ aiEquipmentNotes: nextValue });
                  }}
                  className={fieldClassName}
                  placeholder="e.g. no barbell bench, dumbbells + cables only"
                />
              </div>
            </div>
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
