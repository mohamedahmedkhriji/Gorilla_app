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
  sessionDuration?: number | string;
  preferredTime?: string;
  bodyImages?: string[];
  [key: string]: unknown;
};

type MuscleBalanceTier = {
  percent: number;
  label: string;
  color: string;
  barClass: string;
};

type MuscleBalance = {
  upper: MuscleBalanceTier;
  core: MuscleBalanceTier;
  lower: MuscleBalanceTier;
};

type CoachPlanWorkout = {
  dayName?: string;
  workoutName?: string;
  workoutType?: string;
  focus?: string;
  exercises?: Array<{ name?: string; reps?: string; sets?: number; rpe?: number }>;
};

type CoachPlan = {
  model?: string;
  usedImages?: number;
  planName?: string;
  summary?: string;
  goalMatch?: string;
  durationWeeks?: number;
  weeklySchedule?: CoachPlanWorkout[];
  progressionRules?: string[];
  recoveryRules?: string[];
  nutritionGuidance?: string[];
  checkpoints?: Array<{ week?: number; target?: string }>;
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
const toTitleCase = (value: string) => value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : '';
const parseStoredJson = (key: string) => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};
const normalizeGoalLabel = (value: string) => {
  if (!value) return 'General fitness';
  if (value.includes('weight loss')) return 'Weight loss';
  return toTitleCase(value.replace(/_/g, ' '));
};
const getScoreStatus = (score: number) => {
  if (score >= 80) return { label: 'Strong', labelClass: 'text-accent', barClass: 'bg-accent' };
  if (score >= 65) return { label: 'Balanced', labelClass: 'text-text-secondary', barClass: 'bg-white/50' };
  if (score >= 50) return { label: 'Developing', labelClass: 'text-yellow-500', barClass: 'bg-yellow-500' };
  return { label: 'Focus Area', labelClass: 'text-yellow-500', barClass: 'bg-yellow-500' };
};
const buildBalance = (upperScore: number, coreScore: number, lowerScore: number): MuscleBalance => {
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
};

export function BodyAnalysisResultsScreen({
  onNext,
  onboardingData,
  userData
}: BodyAnalysisResultsScreenProps) {
  const input = onboardingData || userData || {};
  const ageValue = toNumber(input.age);
  const age = ageValue ?? 28;
  const gender = normalize(input.gender);
  const experience = normalize(input.experienceLevel);
  const primaryGoal = normalize(input.primaryGoal || input.fitnessGoal);
  const bodyTypeInput = normalize(input.bodyType || input.bodyTypeLabel);
  const workoutDaysInput = toNumber(input.workoutDays);
  const workoutDays = clamp(workoutDaysInput ?? 4, 2, 6);
  const heightCm = toNumber(input.height);
  const weightKg = toNumber(input.weight);
  const sessionDuration = clamp(toNumber(input.sessionDuration) ?? 60, 30, 120);
  const preferredTime = normalize(String(input.preferredTime || ''));
  const uploadedImages = Array.isArray(input.bodyImages) ? input.bodyImages.filter(Boolean).length : 0;

  const coachPlan = useMemo<CoachPlan | null>(() => parseStoredJson('onboardingCoachPlan') as CoachPlan | null, []);
  const planSource = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return String(localStorage.getItem('onboardingPlanSource') || '').trim() || null;
  }, []);
  const planWarning = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return String(localStorage.getItem('onboardingPlanWarning') || '').trim() || null;
  }, []);

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

  const baselineMuscleBalance = useMemo(() => {
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

    return buildBalance(
      Math.round(clamp(upper, 35, 95)),
      Math.round(clamp(core, 35, 95)),
      Math.round(clamp(lower, 35, 95)),
    );
  }, [bodyFat, bodyTypeInput, experience, primaryGoal, workoutDays]);

  const planMuscleBalance = useMemo(() => {
    const schedule = Array.isArray(coachPlan?.weeklySchedule) ? coachPlan.weeklySchedule : [];
    if (!schedule.length) return null;

    let upper = 52;
    let core = 50;
    let lower = 52;

    schedule.forEach((workout) => {
      const type = normalize(String(workout?.workoutType || workout?.workoutName || ''));
      const focus = normalize(String(workout?.focus || ''));
      const exercises = Array.isArray(workout?.exercises) ? workout.exercises : [];

      if (type.includes('upper') || type.includes('push') || type.includes('pull')) upper += 10;
      if (type.includes('lower') || type.includes('leg')) lower += 10;
      if (type.includes('full')) {
        upper += 6;
        core += 5;
        lower += 6;
      }
      if (focus.includes('core') || focus.includes('abs')) core += 6;

      exercises.forEach((exercise) => {
        const name = normalize(String(exercise?.name || ''));
        if (/(abs|ab|plank|crunch|core)/.test(name)) core += 2;
        if (/(squat|deadlift|lunge|leg|hamstring|quad|calf)/.test(name)) lower += 1.5;
        if (/(press|row|pull|curl|tricep|bicep|shoulder|bench|chest|lat|back)/.test(name)) upper += 1.3;
      });
    });

    return buildBalance(
      Math.round(clamp(upper, 35, 95)),
      Math.round(clamp(core, 35, 95)),
      Math.round(clamp(lower, 35, 95)),
    );
  }, [coachPlan]);

  const muscleBalance = useMemo(() => {
    if (!planMuscleBalance) return baselineMuscleBalance;
    return buildBalance(
      Math.round((baselineMuscleBalance.upper.percent + planMuscleBalance.upper.percent) / 2),
      Math.round((baselineMuscleBalance.core.percent + planMuscleBalance.core.percent) / 2),
      Math.round((baselineMuscleBalance.lower.percent + planMuscleBalance.lower.percent) / 2),
    );
  }, [baselineMuscleBalance, planMuscleBalance]);

  const analyzedRows = useMemo(() => [
    { label: 'Age', value: ageValue != null ? `${Math.round(ageValue)} yrs` : 'Not provided' },
    { label: 'Gender', value: gender ? toTitleCase(gender) : 'Not provided' },
    { label: 'Height', value: heightCm != null ? `${heightCm.toFixed(0)} cm` : 'Not provided' },
    { label: 'Weight', value: weightKg != null ? `${weightKg.toFixed(1)} kg` : 'Not provided' },
    { label: 'Goal', value: normalizeGoalLabel(primaryGoal) },
    { label: 'Experience', value: experience ? toTitleCase(experience) : 'Not provided' },
    { label: 'Days / Week', value: `${workoutDays} days` },
    { label: 'Session', value: `${sessionDuration} min` },
    { label: 'Preferred Time', value: preferredTime ? toTitleCase(preferredTime) : 'Not provided' },
    { label: 'Photos Uploaded', value: `${uploadedImages || Number(coachPlan?.usedImages || 0)} image(s)` },
  ], [ageValue, coachPlan?.usedImages, experience, gender, heightCm, preferredTime, primaryGoal, sessionDuration, uploadedImages, weightKg, workoutDays]);

  return (
    <div className="flex-1 flex flex-col space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-light text-white">Analysis Complete</h2>
        <p className="text-text-secondary">{coachPlan?.summary || "Here's what we found."}</p>
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

      <Card>
        <h3 className="text-sm font-medium text-white mb-4">Analyzed Data</h3>
        <div className="grid grid-cols-2 gap-3">
          {analyzedRows.map((row) => (
            <div key={row.label} className="rounded-xl bg-white/5 border border-white/10 p-3">
              <p className="text-[11px] uppercase tracking-[0.08em] text-text-tertiary">{row.label}</p>
              <p className="text-sm text-white mt-1">{row.value}</p>
            </div>
          ))}
        </div>
        {(planSource || planWarning) && (
          <div className="mt-4 space-y-2">
            {planSource && (
              <p className="text-xs text-text-secondary">
                Plan source: <span className="text-white font-medium">{planSource === 'claude' ? 'Claude AI Coach' : 'Template Generator'}</span>
              </p>
            )}
            {planWarning && (
              <p className="text-xs text-yellow-300">{planWarning}</p>
            )}
          </div>
        )}
      </Card>

      {coachPlan && (
        <Card>
          <h3 className="text-sm font-medium text-white mb-2">{coachPlan.planName || 'AI Coach Plan'}</h3>
          <p className="text-xs text-text-secondary">{coachPlan.goalMatch || 'Plan calibrated to your current profile and goal.'}</p>
          {!!coachPlan.progressionRules?.length && (
            <div className="mt-3 space-y-1">
              {coachPlan.progressionRules.slice(0, 2).map((rule, idx) => (
                <p key={`${rule}-${idx}`} className="text-xs text-text-secondary">- {rule}</p>
              ))}
            </div>
          )}
        </Card>
      )}

      <p className="text-[10px] text-text-tertiary text-center">
        *Estimates based on computer vision analysis. Not medical advice.
      </p>

      <div className="flex-1" />

      <Button onClick={onNext}>View Plan</Button>
    </div>);

}
