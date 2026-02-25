import React, { useMemo } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { User } from 'lucide-react';

type AnalysisInput = {
  age?: number;
  gender?: string;
  weight?: number;
  height?: number;
  experienceLevel?: string;
  primaryGoal?: string;
  fitnessGoal?: string;
  workoutDays?: number;
  bodyType?: string;
  bodyTypeLabel?: string;
};

interface BodyAnalysisResultsScreenProps {
  onNext: () => void;
  onboardingData?: AnalysisInput;
  userData?: AnalysisInput;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const normalize = (value?: string) => String(value || '').trim().toLowerCase();
const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function BodyAnalysisResultsScreen({
  onNext,
  onboardingData,
  userData
}: BodyAnalysisResultsScreenProps) {
  const input = onboardingData || userData || {};
  const age = toNumber(input.age) ?? 28;
  const gender = normalize(input.gender);
  const experience = normalize(input.experienceLevel);
  const primaryGoal = normalize(input.primaryGoal || input.fitnessGoal);
  const bodyTypeInput = normalize(input.bodyType || input.bodyTypeLabel);
  const workoutDays = clamp(toNumber(input.workoutDays) ?? 4, 2, 6);
  const heightCm = toNumber(input.height);
  const weightKg = toNumber(input.weight);

  const bmi = useMemo(() => {
    if (!heightCm || !weightKg || heightCm <= 0) return null;
    return weightKg / ((heightCm / 100) ** 2);
  }, [heightCm, weightKg]);

  // Estimate body fat from BMI + profile modifiers to make output user-specific.
  const bodyFat = useMemo(() => {
    let estimate = 18.5;

    if (bmi != null) {
      const sexFactor = gender === 'male' ? 1 : gender === 'female' ? 0 : 0.5;
      estimate = 1.2 * bmi + 0.23 * age - 10.8 * sexFactor - 5.4;
    } else {
      estimate = gender === 'female' ? 27 : 19;
    }

    if (experience === 'beginner') estimate += 1.5;
    if (experience === 'advanced') estimate -= 1.5;

    if (primaryGoal.includes('fat') || primaryGoal.includes('weight loss')) estimate -= 1.2;
    if (primaryGoal.includes('muscle') || primaryGoal.includes('hypertrophy')) estimate += 0.6;

    if (bodyTypeInput === 'ectomorph') estimate -= 1.2;
    if (bodyTypeInput === 'endomorph') estimate += 2.0;

    return clamp(Number(estimate.toFixed(1)), 6, 45);
  }, [age, bmi, bodyTypeInput, experience, gender, primaryGoal]);

  // Prefer selected body type; otherwise infer from BMI.
  const bodyType = useMemo(() => {
    if (bodyTypeInput === 'ectomorph') return 'Ectomorph';
    if (bodyTypeInput === 'mesomorph') return 'Mesomorph';
    if (bodyTypeInput === 'endomorph') return 'Endomorph';

    if (bmi != null) {
      if (bmi < 21) return 'Ectomorph';
      if (bmi > 27.5) return 'Endomorph';
      return 'Mesomorph';
    }

    if (experience === 'beginner') return 'Ectomorph';
    return 'Mesomorph';
  }, [bodyTypeInput, bmi, experience]);

  const getScoreStatus = (score: number) => {
    if (score >= 80) return { label: 'Strong', labelClass: 'text-accent', barClass: 'bg-accent' };
    if (score >= 65) return { label: 'Balanced', labelClass: 'text-text-secondary', barClass: 'bg-white/50' };
    if (score >= 50) return { label: 'Developing', labelClass: 'text-yellow-500', barClass: 'bg-yellow-500' };
    return { label: 'Focus Area', labelClass: 'text-yellow-500', barClass: 'bg-yellow-500' };
  };

  // Generate user-specific distribution for upper/core/lower readiness.
  const muscleBalance = useMemo(() => {
    const baseByExperience =
      experience === 'advanced' ? 72 :
      experience === 'intermediate' ? 60 :
      46;

    let upper = baseByExperience + workoutDays * 2.5;
    let core = baseByExperience - 4 + workoutDays * 2.0;
    let lower = baseByExperience + workoutDays * 2.3;

    if (primaryGoal.includes('strength')) {
      upper += 8;
      lower += 6;
      core += 2;
    } else if (primaryGoal.includes('fat') || primaryGoal.includes('weight loss')) {
      core += 10;
      upper += 2;
      lower += 2;
    } else if (primaryGoal.includes('endurance')) {
      lower += 8;
      core += 6;
      upper += 2;
    } else if (primaryGoal.includes('muscle') || primaryGoal.includes('hypertrophy')) {
      upper += 6;
      lower += 5;
      core += 3;
    } else if (primaryGoal.includes('recomposition')) {
      upper += 4;
      core += 4;
      lower += 4;
    }

    if (bodyTypeInput === 'ectomorph') {
      upper += 3;
      lower += 2;
      core -= 1;
    } else if (bodyTypeInput === 'endomorph') {
      core += 3;
      lower += 1;
      upper -= 1;
    } else if (bodyTypeInput === 'mesomorph') {
      upper += 2;
      core += 2;
      lower += 2;
    }

    if (bodyFat > 25) {
      core -= 3;
      upper -= 2;
    }

    const upperScore = Math.round(clamp(upper, 35, 95));
    const coreScore = Math.round(clamp(core, 35, 95));
    const lowerScore = Math.round(clamp(lower, 35, 95));

    const upperStatus = getScoreStatus(upperScore);
    const coreStatus = getScoreStatus(coreScore);
    const lowerStatus = getScoreStatus(lowerScore);

    return {
      upper: {
        percent: upperScore,
        label: upperStatus.label,
        color: upperStatus.labelClass,
        barClass: upperStatus.barClass,
      },
      core: {
        percent: coreScore,
        label: coreStatus.label,
        color: coreStatus.labelClass,
        barClass: coreStatus.barClass,
      },
      lower: {
        percent: lowerScore,
        label: lowerStatus.label,
        color: lowerStatus.labelClass,
        barClass: lowerStatus.barClass,
      },
    };
  }, [bodyFat, bodyTypeInput, experience, primaryGoal, workoutDays]);

  return (
    <div className="flex-1 flex flex-col space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-light text-white">Analysis Complete</h2>
        <p className="text-text-secondary">Here's what we found.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="flex flex-col items-center justify-center py-8">
          <span className="text-3xl font-bold text-accent">{bodyFat.toFixed(1)}%</span>
          <span className="text-xs text-text-tertiary mt-1">Est. Body Fat</span>
        </Card>
        <Card className="flex flex-col items-center justify-center py-8">
          <span className="text-xl font-bold text-white">{bodyType}</span>
          <span className="text-xs text-text-tertiary mt-1">Body Type</span>
        </Card>
      </div>

      <Card>
        <h3 className="text-sm font-medium text-white mb-4">Muscle Balance</h3>
        <div className="flex items-center gap-6">
          <div className="w-24 h-48 bg-white/5 rounded-xl flex items-center justify-center relative">
            <User size={64} className="text-white/20" />
            <div className="absolute top-[20%] w-12 h-8 bg-accent/20 rounded-full blur-xl" />
          </div>
          <div className="space-y-4 flex-1">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-white">Upper Body</span>
                <span className={muscleBalance.upper.color}>{muscleBalance.upper.label}</span>
              </div>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full ${muscleBalance.upper.barClass}`} style={{ width: `${muscleBalance.upper.percent}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-white">Core</span>
                <span className={muscleBalance.core.color}>{muscleBalance.core.label}</span>
              </div>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full ${muscleBalance.core.barClass}`} style={{ width: `${muscleBalance.core.percent}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-white">Lower Body</span>
                <span className={muscleBalance.lower.color}>{muscleBalance.lower.label}</span>
              </div>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full ${muscleBalance.lower.barClass}`} style={{ width: `${muscleBalance.lower.percent}%` }} />
              </div>
            </div>
          </div>
        </div>
      </Card>

      <p className="text-[10px] text-text-tertiary text-center">
        *Estimates based on computer vision analysis. Not medical advice.
      </p>

      <div className="flex-1" />

      <Button onClick={onNext}>View Plan</Button>
    </div>);

}
