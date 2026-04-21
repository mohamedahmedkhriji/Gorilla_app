import React, { memo } from 'react';
import { Check, Dumbbell } from 'lucide-react';
import type { ExerciseName } from '../types/tracking';

interface ExerciseCardProps {
  exercise: {
    name: ExerciseName;
    label: string;
    subtitle: string;
  };
  isSelected: boolean;
  onSelect: (exercise: ExerciseName) => void;
}

export const ExerciseCard = memo(function ExerciseCard({
  exercise,
  isSelected,
  onSelect,
}: ExerciseCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(exercise.name)}
      className={`w-full rounded-[28px] border p-5 text-left transition-all duration-200 ${
        isSelected
          ? 'border-accent/50 bg-[linear-gradient(180deg,rgba(191,255,0,0.14),rgba(191,255,0,0.04))] shadow-[0_18px_50px_rgba(191,255,0,0.12)]'
          : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-text-tertiary">
            <Dumbbell size={12} />
            <span>Exercise</span>
          </div>
          <div className="mt-4 text-xl font-electrolize text-text-primary">
            {exercise.label}
          </div>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            {exercise.subtitle}
          </p>
        </div>

        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
            isSelected
              ? 'border-accent/40 bg-accent text-black'
              : 'border-white/10 bg-white/[0.03] text-transparent'
          }`}
        >
          <Check size={16} />
        </div>
      </div>
    </button>
  );
});

