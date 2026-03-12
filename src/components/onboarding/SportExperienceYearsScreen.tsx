import React, { useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { SelectionCheck } from '../ui/SelectionCheck';

interface SportExperienceYearsScreenProps {
  onNext: () => void;
  onDataChange?: (data: Record<string, unknown>) => void;
  onboardingData?: {
    athleteIdentityLabel?: string;
    athleteIdentity?: string;
    athleteSubCategoryLabel?: string;
    athleteGoal?: string;
    experienceLevel?: string;
  };
}

const normalizeAthleteName = (label: unknown, id: unknown) => {
  const fromLabel = String(label || '').trim();
  if (fromLabel) return fromLabel;
  const normalized = String(id || '').trim().replace(/_/g, ' ');
  if (!normalized) return 'Sport';
  return normalized
    .split(' ')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
};

const LEVELS = [
  { id: 'Beginner', label: 'Beginner', years: 0.5 },
  { id: 'Intermediate', label: 'Intermediate', years: 2 },
  { id: 'Advanced', label: 'Advanced', years: 5 },
] as const;

export function SportExperienceYearsScreen({
  onNext,
  onDataChange,
  onboardingData,
}: SportExperienceYearsScreenProps) {
  const sportName = useMemo(
    () => normalizeAthleteName(onboardingData?.athleteIdentityLabel, onboardingData?.athleteIdentity),
    [onboardingData?.athleteIdentity, onboardingData?.athleteIdentityLabel],
  );
  const specialty = String(onboardingData?.athleteSubCategoryLabel || onboardingData?.athleteGoal || '').trim();
  const specializationLabel = specialty || sportName;

  const validLevels = new Set(LEVELS.map((l) => l.id));
  const initialLevel = String(onboardingData?.experienceLevel || 'Intermediate');
  const [level, setLevel] = useState(validLevels.has(initialLevel as (typeof LEVELS)[number]['id']) ? initialLevel : 'Intermediate');

  const persistLevel = (nextLevel: string) => {
    const selected = LEVELS.find((entry) => entry.id === nextLevel);
    if (!selected) return;
    onDataChange?.({
      experienceLevel: selected.id,
      sportPracticeYears: selected.years,
      experienceLevelSource: 'specialized_selection',
    });
  };

  const handleNext = () => {
    persistLevel(level);
    onNext();
  };

  return (
    <div className="flex-1 flex flex-col space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-light text-white">Fitness Background</h2>
        <p className="text-text-secondary">
          Help us understand your starting point{specialty ? ` for ${specialty}` : ` in ${sportName}`}.
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-3">
          <label className="text-sm font-medium text-text-secondary ml-1">Experience Level</label>
          <div className="grid grid-cols-1 gap-3">
            {LEVELS.map((entry) => {
              const isSelected = level === entry.id;
              const description =
                entry.id === 'Beginner'
                  ? `New to ${specializationLabel.toLowerCase()} training`
                  : entry.id === 'Intermediate'
                    ? `1-2 years in ${specializationLabel.toLowerCase()}`
                    : `3+ years in ${specializationLabel.toLowerCase()}`;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    setLevel(entry.id);
                    persistLevel(entry.id);
                  }}
                  className={`
                    w-full p-4 rounded-xl border text-left transition-all duration-200 flex justify-between items-center
                    ${isSelected ? 'bg-accent/10 border-accent text-white' : 'bg-card border-white/10 text-text-secondary hover:bg-white/5'}
                  `}
                >
                  <div>
                    <div className="font-medium">{entry.label}</div>
                    <div className="text-xs opacity-70">{description}</div>
                  </div>
                  {isSelected && <SelectionCheck selected size={20} />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1" />

      <Button onClick={handleNext}>Next Step</Button>
    </div>
  );
}
