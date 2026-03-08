import React, { useState } from 'react';
import { Header } from '../ui/Header';
import { api } from '../../services/api';

interface GeneratePlanFlowScreenProps {
  onBack: () => void;
  onGenerated: () => void;
  onOpenManualBuilder: () => void;
}

const GOALS = [
  { value: 'hypertrophy', label: 'Build Muscle' },
  { value: 'strength', label: 'Gain Strength' },
  { value: 'fat_loss', label: 'Lose Fat' },
  { value: 'recomposition', label: 'Recomposition' },
  { value: 'general_fitness', label: 'General Fitness' },
];

const EXPERIENCE_LEVELS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

export function GeneratePlanFlowScreen({
  onBack,
  onGenerated,
  onOpenManualBuilder,
}: GeneratePlanFlowScreenProps) {
  const [goal, setGoal] = useState('hypertrophy');
  const [experienceLevel, setExperienceLevel] = useState('intermediate');
  const [workoutDays, setWorkoutDays] = useState(4);
  const [cycleWeeks, setCycleWeeks] = useState(8);
  const [equipment, setEquipment] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleGenerate = async () => {
    setError(null);
    setSuccess(null);

    const user = readStoredUser();
    const userId = Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || user?.id || 0);
    if (!userId) {
      setError('No active user session found.');
      return;
    }

    setIsGenerating(true);
    try {
      const equipmentList = equipment
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      const result = await api.generatePersonalizedProgram(userId, {
        goal,
        experienceLevel,
        workoutDays: Math.max(2, Math.min(6, Math.round(Number(workoutDays) || 4))),
        cycleWeeks: Math.max(8, Math.min(16, Math.round(Number(cycleWeeks) || 8))),
        equipment: equipmentList.length ? equipmentList : undefined,
      });

      if (!result?.success) {
        throw new Error(result?.error || 'Failed to generate plan');
      }

      localStorage.removeItem('recoveryNeedsUpdate');
      const programName = String(result?.assignedProgram?.name || 'Generated plan');
      setSuccess(`${programName} is now your active plan.`);
      window.setTimeout(() => onGenerated(), 600);
    } catch (generationError) {
      console.error('Failed to generate plan:', generationError);
      setError(generationError instanceof Error ? generationError.message : 'Failed to generate plan.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background pb-24">
      <div className="px-4 sm:px-6 pt-2">
        <Header title="Generate My Plan" onBack={onBack} />
      </div>

      <div className="px-4 sm:px-6 pt-2 space-y-4">
        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 text-red-300 text-sm p-3">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-green-500/40 bg-green-500/10 text-green-300 text-sm p-3">
            {success}
          </div>
        )}

        <div className="bg-card border border-white/10 rounded-xl p-4 space-y-3">
          <div className="text-sm text-text-secondary">Goal</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {GOALS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setGoal(item.value)}
                className={`rounded-lg px-3 py-2 text-sm border transition-colors ${
                  goal === item.value
                    ? 'bg-accent/20 border-accent text-accent'
                    : 'bg-background border-white/10 text-text-secondary hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-card border border-white/10 rounded-xl p-4 space-y-3">
          <div className="text-sm text-text-secondary">Experience Level</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {EXPERIENCE_LEVELS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setExperienceLevel(item.value)}
                className={`rounded-lg px-3 py-2 text-sm border transition-colors ${
                  experienceLevel === item.value
                    ? 'bg-accent/20 border-accent text-accent'
                    : 'bg-background border-white/10 text-text-secondary hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-card border border-white/10 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs uppercase text-text-secondary">Workout Days / Week</span>
              <input
                type="number"
                min={2}
                max={6}
                value={workoutDays}
                onChange={(e) => setWorkoutDays(Math.max(2, Math.min(6, Number(e.target.value || 4))))}
                className="mt-1 w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-accent/60"
              />
            </label>

            <label className="block">
              <span className="text-xs uppercase text-text-secondary">Duration (Weeks)</span>
              <input
                type="number"
                min={8}
                max={16}
                value={cycleWeeks}
                onChange={(e) => setCycleWeeks(Math.max(8, Math.min(16, Number(e.target.value || 8))))}
                className="mt-1 w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-accent/60"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs uppercase text-text-secondary">Equipment (Optional, comma-separated)</span>
            <input
              type="text"
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              placeholder="Dumbbells, Barbell, Bench"
              className="mt-1 w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-accent/60"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onOpenManualBuilder}
            className="w-full bg-white/5 text-white border border-white/10 font-semibold rounded-xl p-3 hover:bg-white/10 transition-colors"
          >
            Open Manual Builder
          </button>
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={isGenerating}
            className="w-full bg-accent text-black font-semibold rounded-xl p-3 hover:bg-accent/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isGenerating ? 'Generating...' : 'Generate Plan'}
          </button>
        </div>
      </div>
    </div>
  );
}
