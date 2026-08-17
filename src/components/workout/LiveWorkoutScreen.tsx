import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Header } from '../ui/Header';
import { ExerciseCard } from './ExerciseCard';
import { RestTimer } from './RestTimer';
import { MoreHorizontal } from 'lucide-react';
interface LiveWorkoutScreenProps {
  onFinish: () => void;
}
export function LiveWorkoutScreen({ onFinish }: LiveWorkoutScreenProps) {
  const [isResting, setIsResting] = useState(false);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const exercises = [
  {
    name: 'Barbell Bench Press',
    sets: 4,
    reps: '6-8',
    weight: '60',
    muscles: ['Chest', 'Triceps']
  },
  {
    name: 'Bent Over Row',
    sets: 4,
    reps: '8-10',
    weight: '50',
    muscles: ['Back', 'Biceps']
  }];

  const handleNextSet = () => {
    setIsResting(true);
  };
  const handleRestComplete = () => {
    setIsResting(false);
  };
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-1 flex-col px-4 py-6 sm:px-6">
      <Header
        title="Upper Power"
        rightElement={
        <button className="p-2 text-text-secondary hover:text-white">
            <MoreHorizontal size={24} />
          </button>
        } />


      <div className="flex-1 space-y-6 overflow-y-auto pb-40">
        {/* Progress Bar */}
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full w-[35%] bg-accent shadow-glow" />
        </div>

        <ExerciseCard {...exercises[exerciseIndex]} />

        {isResting &&
        <RestTimer duration={90} onComplete={handleRestComplete} />
        }

        {/* Previous Sets History */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">
            History
          </h3>
          <div className="flex justify-between text-sm text-text-tertiary px-4 py-2 bg-card rounded-lg border border-white/5">
            <span>Set 1</span>
            <span>60kg x 8</span>
          </div>
          <div className="flex justify-between text-sm text-text-tertiary px-4 py-2 bg-card rounded-lg border border-white/5">
            <span>Set 2</span>
            <span>60kg x 8</span>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] border-t border-white/5 bg-background px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-md gap-3 sm:gap-4">
          <Button variant="secondary" className="flex-1" onClick={onFinish}>
            Finish
          </Button>
          <Button className="flex-[2]" onClick={handleNextSet}>
            Complete Set
          </Button>
        </div>
      </div>
    </div>);

}
