import React from 'react';
import { Button } from '../ui/Button';
import { Header } from '../ui/Header';
import { Clock, Dumbbell, Flame } from 'lucide-react';
interface WorkoutOverviewScreenProps {
  onStart: () => void;
  onBack: () => void;
}
export function WorkoutOverviewScreen({
  onStart,
  onBack
}: WorkoutOverviewScreenProps) {
  return (
    <div className="flex-1 flex flex-col p-6 max-w-md mx-auto w-full">
      <Header onBack={onBack} />

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-light text-white mb-2">Upper Power</h1>
          <div className="flex gap-2">
            <span className="px-2 py-1 rounded bg-accent/10 text-accent text-xs font-bold uppercase">
              Strength
            </span>
            <span className="px-2 py-1 rounded bg-white/10 text-text-secondary text-xs font-bold uppercase">
              Chest & Back
            </span>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-1 bg-card rounded-xl p-4 border border-white/5">
            <Clock className="text-accent mb-2" size={20} />
            <div className="font-bold text-white">45 min</div>
            <div className="text-xs text-text-tertiary">Duration</div>
          </div>
          <div className="flex-1 bg-card rounded-xl p-4 border border-white/5">
            <Dumbbell className="text-accent mb-2" size={20} />
            <div className="font-bold text-white">6</div>
            <div className="text-xs text-text-tertiary">Exercises</div>
          </div>
          <div className="flex-1 bg-card rounded-xl p-4 border border-white/5">
            <Flame className="text-accent mb-2" size={20} />
            <div className="font-bold text-white">320</div>
            <div className="text-xs text-text-tertiary">Calories</div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider">
            Exercises
          </h3>
          {[
          {
            name: 'Barbell Bench Press',
            sets: '4 sets x 6-8 reps'
          },
          {
            name: 'Bent Over Row',
            sets: '4 sets x 8-10 reps'
          },
          {
            name: 'Overhead Press',
            sets: '3 sets x 8-10 reps'
          },
          {
            name: 'Pull Ups',
            sets: '3 sets x AMRAP'
          }].
          map((ex, i) =>
          <div
            key={i}
            className="flex items-center gap-4 p-4 bg-card rounded-xl border border-white/5">

              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-sm font-bold text-text-tertiary">
                {i + 1}
              </div>
              <div>
                <div className="font-medium text-white">{ex.name}</div>
                <div className="text-xs text-text-secondary">{ex.sets}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1" />
      <div className="sticky bottom-6 pt-6 bg-gradient-to-t from-background to-transparent">
        <Button onClick={onStart}>Start Workout</Button>
      </div>
    </div>);

}