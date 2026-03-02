import React from 'react';
import { Card } from '../ui/Card';
import { Repeat, Dumbbell } from 'lucide-react';
interface ExerciseCardProps {
  name: string;
  sets: number;
  reps: string;
  weight: string;
  muscles: string[];
}
export function ExerciseCard({
  name,
  sets,
  reps,
  weight,
  muscles
}: ExerciseCardProps) {
  return (
    <Card className="space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-medium text-white">{name}</h3>
          <div className="flex gap-2 mt-1">
            {muscles.map((m) =>
            <span
              key={m}
              className="text-[10px] uppercase tracking-wider text-accent bg-accent/10 px-2 py-0.5 rounded">

                {m}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-text-secondary">Target</div>
          <div className="font-medium text-white">
            {sets} x {reps}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-text-secondary mb-1 block">
            Weight (kg)
          </label>
          <div className="relative">
            <input
              type="number"
              defaultValue={weight}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:border-accent" />

            <Dumbbell
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary" />

          </div>
        </div>
        <div>
          <label className="text-xs text-text-secondary mb-1 block">Reps</label>
          <div className="relative">
            <input
              type="number"
              defaultValue={reps.split('-')[0]} // simplistic parsing
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:border-accent" />

            <Repeat
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary" />

          </div>
        </div>
      </div>
    </Card>);

}
