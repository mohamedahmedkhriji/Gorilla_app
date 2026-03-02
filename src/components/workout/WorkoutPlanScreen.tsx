import React from 'react';
import { Header } from '../ui/Header';
import { Card } from '../ui/Card';
import { Play } from 'lucide-react';

interface WorkoutPlanScreenProps {
  onBack: () => void;
  onExerciseClick: (exercise: string) => void;
  workoutDay: string;
  completedExercises: string[];
  todayExercises: any[];
  loading: boolean;
}

export function WorkoutPlanScreen({ onBack, onExerciseClick, workoutDay, completedExercises, todayExercises, loading }: WorkoutPlanScreenProps) {
  if (loading) {
    return (
      <div className="flex-1 flex flex-col h-full bg-background pb-24">
        <div className="px-4 sm:px-6 pt-2">
          <Header title={workoutDay} onBack={onBack} />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-text-secondary">Loading workout...</div>
        </div>
      </div>
    );
  }

  const exercises = todayExercises.map(ex => ({
    name: ex.exerciseName,
    sets: ex.sets,
    reps: ex.reps,
    rest: `${ex.rest}s`
  }));
  const completedLookup = new Set(completedExercises.map((name) => String(name || '').trim().toLowerCase()));

  return (
    <div className="flex-1 flex flex-col h-full bg-background pb-24">
      <div className="px-4 sm:px-6 pt-2">
        <Header title={workoutDay} onBack={onBack} />
      </div>

      {exercises.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-4 sm:px-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-2">Rest Day</h2>
            <p className="text-text-secondary">Recovery is just as important as training</p>
          </div>
        </div>
      ) : (
        <div className="px-4 sm:px-6 space-y-3 mt-4">
          <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
            Today's Exercises
          </h3>
          {exercises.map((exercise, index) => {
            const isCompleted = completedLookup.has(String(exercise.name || '').trim().toLowerCase());
            const isNext = !isCompleted && completedExercises.length === index;
            return (
            <Card
              key={index}
              onClick={() => onExerciseClick(exercise.name)}
              className={`p-4 cursor-pointer transition-colors ${
                isCompleted ? 'border-green-500/50 bg-green-500/5' : 
                isNext ? 'border-accent bg-accent/5' : 
                'hover:border-accent/20'
              }`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-white">{exercise.name}</h4>
                  </div>
                  <div className="flex gap-4 text-xs text-text-secondary">
                    <span>{exercise.sets} sets</span>
                    <span>•</span>
                    <span>{exercise.reps}</span>
                    <span>•</span>
                    <span>{exercise.rest} rest</span>
                  </div>
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isCompleted ? 'bg-green-500/20' : 'bg-accent/10'
                }`}>
                  <Play size={16} className={isCompleted ? 'text-green-500' : 'text-accent'} fill="currentColor" />
                </div>
              </div>
            </Card>
          )})}
        </div>
      )}
    </div>
  );
}


