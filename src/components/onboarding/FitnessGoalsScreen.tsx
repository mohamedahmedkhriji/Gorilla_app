import React, { useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { SelectionCheck } from '../ui/SelectionCheck';

interface FitnessGoalsScreenProps {
  onNext: () => void;
  onDataChange?: (data: any) => void;
  onboardingData?: any;
}

type GoalOption = {
  id: string;
  title: string;
  description: string;
  tag?: string;
  goalValue: 'Build Muscle' | 'General Fitness' | 'Endurance' | 'Strength';
};

const GOAL_OPTIONS: GoalOption[] = [
  {
    id: 'build_muscle_toned',
    title: 'Build muscle and get toned',
    description:
      'Focus on muscle development and tone your body. Perform pyramid sets to improve your weights in every workout.',
    tag: 'Popular',
    goalValue: 'Build Muscle',
  },
  {
    id: 'general_fitness',
    title: 'Enhance general fitness',
    description:
      'Improve your overall fitness by lifting consistent weights and learning new exercises.',
    goalValue: 'General Fitness',
  },
  {
    id: 'conditioning',
    title: 'Improve conditioning',
    description:
      'Focus on higher reps and lower weights through fast-paced supersets to boost your overall conditioning.',
    goalValue: 'Endurance',
  },
  {
    id: 'get_stronger',
    title: 'Get stronger',
    description:
      'Focus on compound exercises. Train fewer muscles per workout and lift heavier weights in lower rep ranges.',
    tag: 'Powerlifting',
    goalValue: 'Strength',
  },
];

const toSelectedGoalIds = (onboardingData: any) => {
  const fromList = Array.isArray(onboardingData?.fitnessGoalIds)
    ? onboardingData.fitnessGoalIds.map((entry: unknown) => String(entry || '').trim())
    : [];
  if (fromList.length) return fromList.filter(Boolean);

  const fromGoalValue = String(onboardingData?.fitnessGoal || '').trim().toLowerCase();
  if (!fromGoalValue) return [];

  const matched = GOAL_OPTIONS.find(
    (option) => option.goalValue.trim().toLowerCase() === fromGoalValue,
  );
  return matched ? [matched.id] : [];
};

export function FitnessGoalsScreen({ onNext, onDataChange, onboardingData }: FitnessGoalsScreenProps) {
  const initialIds = useMemo(() => toSelectedGoalIds(onboardingData), [onboardingData]);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialIds);

  const persistGoals = (goalIds: string[]) => {
    const selectedOptions = GOAL_OPTIONS.filter((option) => goalIds.includes(option.id));
    const primary = selectedOptions[0] || null;

    onDataChange?.({
      fitnessGoalIds: selectedOptions.map((option) => option.id),
      fitnessGoals: selectedOptions.map((option) => option.title),
      fitnessGoal: primary?.goalValue || '',
      primaryGoal: primary?.goalValue || '',
    });
  };

  const toggleGoal = (goalId: string) => {
    setSelectedIds((prev) => {
      const nextIds = prev.includes(goalId)
        ? prev.filter((id) => id !== goalId)
        : [...prev, goalId];
      persistGoals(nextIds);
      return nextIds;
    });
  };

  const handleContinue = () => {
    onNext();
  };

  return (
    <div className="flex-1 flex flex-col space-y-5">
      <div className="space-y-2">
        <h2 className="text-2xl font-light text-white">What are your top fitness goals?</h2>
        <p className="text-text-secondary">
          This helps us tailor the right exercises and set targets for your plan.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-card/70 overflow-hidden">
        {GOAL_OPTIONS.map((option, index) => {
          const selected = selectedIds.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => toggleGoal(option.id)}
              className={`w-full px-4 py-4 text-left transition-colors ${
                selected ? 'bg-accent/10' : 'hover:bg-white/5'
              } ${index !== GOAL_OPTIONS.length - 1 ? 'border-b border-white/10' : ''}`}
            >
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  {option.tag ? (
                    <span
                      className={`inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${
                        option.tag === 'Popular'
                          ? 'bg-[#BFFF00] text-black'
                          : 'bg-white text-black'
                      }`}
                    >
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

      <Button onClick={handleContinue} disabled={!selectedIds.length}>
        Continue
      </Button>
    </div>
  );
}
