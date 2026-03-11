import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { SelectionCheck } from '../ui/SelectionCheck';
interface FitnessBackgroundScreenProps {
  onNext: () => void;
  onDataChange?: (data: any) => void;
  onboardingData?: any;
}
export function FitnessBackgroundScreen({
  onNext,
  onDataChange,
  onboardingData,
}: FitnessBackgroundScreenProps) {
  const validLevels = new Set(['Beginner', 'Intermediate', 'Advanced']);
  const initialLevel = String(onboardingData?.experienceLevel || 'Intermediate');
  const [level, setLevel] = useState(validLevels.has(initialLevel) ? initialLevel : 'Intermediate');

  const handleNext = () => {
    onNext();
  };
  const levels = [
  {
    id: 'Beginner',
    label: 'Beginner',
    desc: 'New to lifting'
  },
  {
    id: 'Intermediate',
    label: 'Intermediate',
    desc: '1-2 years experience'
  },
  {
    id: 'Advanced',
    label: 'Advanced',
    desc: '3+ years experience'
  }];

  return (
    <div className="flex-1 flex flex-col space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-light text-white">Fitness Background</h2>
        <p className="text-text-secondary">
          Help us understand your starting point.
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-3">
          <label className="text-sm font-medium text-text-secondary ml-1">
            Experience Level
          </label>
          <div className="grid grid-cols-1 gap-3">
            {levels.map((l) =>
            <button
              key={l.id}
              onClick={() => {
                setLevel(l.id);
                onDataChange?.({ experienceLevel: l.id });
              }}
              className={`
                  w-full p-4 rounded-xl border text-left transition-all duration-200 flex justify-between items-center
                  ${level === l.id ? 'bg-accent/10 border-accent text-white' : 'bg-card border-white/10 text-text-secondary hover:bg-white/5'}
                `}>

                <div>
                  <div className="font-medium">{l.label}</div>
                  <div className="text-xs opacity-70">{l.desc}</div>
                </div>
                {level === l.id && <SelectionCheck selected />}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1" />

      <Button onClick={handleNext}>Next Step</Button>
    </div>);

}
