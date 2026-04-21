import React, { memo } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { ExerciseCard } from '../components/ExerciseCard';
import { EXERCISE_OPTIONS } from '../logic/constants';
import type { ExerciseName } from '../types/tracking';

interface ExerciseSelectionPageProps {
  selectedExercise: ExerciseName | null;
  onSelectExercise: (exercise: ExerciseName) => void;
  onContinue: () => void;
}

export const ExerciseSelectionPage = memo(function ExerciseSelectionPage({
  selectedExercise,
  onSelectExercise,
  onContinue,
}: ExerciseSelectionPageProps) {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-xl flex-col justify-between gap-8">
      <div className="space-y-6">
        <div className="space-y-3">
          <h2 className="text-3xl font-electrolize text-text-primary sm:text-4xl">
            Choose Exercise
          </h2>
          <p className="text-sm leading-6 text-text-secondary">
            Select an exercise to start tracking
          </p>
        </div>

        <div className="space-y-4">
          {EXERCISE_OPTIONS.map((exercise) => (
            <ExerciseCard
              key={exercise.name}
              exercise={exercise}
              isSelected={selectedExercise === exercise.name}
              onSelect={onSelectExercise}
            />
          ))}
        </div>
      </div>

      <div className="pb-4 pt-2">
        <Button
          type="button"
          onClick={onContinue}
          disabled={!selectedExercise}
        >
          <span>Continue</span>
          <ArrowRight size={18} />
        </Button>
      </div>
    </section>
  );
});

