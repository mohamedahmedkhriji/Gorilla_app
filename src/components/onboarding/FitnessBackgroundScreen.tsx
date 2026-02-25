import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Check } from 'lucide-react';
interface FitnessBackgroundScreenProps {
  onNext: () => void;
  onDataChange?: (data: any) => void;
}
export function FitnessBackgroundScreen({
  onNext,
  onDataChange
}: FitnessBackgroundScreenProps) {
  const [level, setLevel] = useState('Intermediate');
  const [goal, setGoal] = useState('Muscle Gain');

  const handleNext = () => {
    onDataChange?.({ experienceLevel: level, primaryGoal: goal });
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

  const goals = [
  {
    id: 'Strength',
    label: 'Strength'
  },
  {
    id: 'Muscle Gain',
    label: 'Build Muscle'
  },
  {
    id: 'Fat Loss',
    label: 'Fat Loss'
  },
  {
    id: 'Recomposition',
    label: 'Recomposition'
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
              onClick={() => setLevel(l.id)}
              className={`
                  w-full p-4 rounded-xl border text-left transition-all duration-200 flex justify-between items-center
                  ${level === l.id ? 'bg-accent/10 border-accent text-white' : 'bg-card border-white/10 text-text-secondary hover:bg-white/5'}
                `}>

                <div>
                  <div className="font-medium">{l.label}</div>
                  <div className="text-xs opacity-70">{l.desc}</div>
                </div>
                {level === l.id && <Check size={18} className="text-accent" />}
              </button>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium text-text-secondary ml-1">
            Primary Goal
          </label>
          <div className="grid grid-cols-2 gap-3">
            {goals.map((g) =>
            <button
              key={g.id}
              onClick={() => setGoal(g.id)}
              className={`
                  p-4 rounded-xl border text-center transition-all duration-200
                  ${goal === g.id ? 'bg-accent/10 border-accent text-white' : 'bg-card border-white/10 text-text-secondary hover:bg-white/5'}
                `}>

                <div className="font-medium text-sm">{g.label}</div>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1" />

      <Button onClick={handleNext}>Next Step</Button>
    </div>);

}