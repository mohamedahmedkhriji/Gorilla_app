import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Droplets, Flame, Gauge, Pencil, PieChart, UserRound } from 'lucide-react';
import { Header } from '../components/ui/Header';
import { Card } from '../components/ui/Card';
import { api } from '../services/api';
import { getNutritionInputsOverride, saveNutritionInputsOverride } from '../services/nutritionOverrides';

interface CalculatorProps {
  onBack: () => void;
}

type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very';

type DatasetInsights = {
  baselinePosition?: {
    agePercentile?: number | null;
    bmiPercentile?: number | null;
    restingBpmPercentile?: number | null;
  };
  interpretation?: {
    suggestedExperienceLevel?: string;
    suggestedWorkoutTypes?: string[];
  };
};

type AutoTargets = {
  age: number;
  weightKg: number;
  heightCm: number;
  sex: 'male' | 'female';
  goalLabel: string;
  activityLabel: string;
  daysPerWeek: number;
  restingBpm: number | null;
  bmr: number;
  tdee: number;
  recommendedCalories: number;
  recommendedProtein: number;
  recommendedWaterLiters: number;
  recommendedWaterCups: number;
  waterRangeMinLiters: number;
  waterRangeMaxLiters: number;
  loggedHydrationLiters: number | null;
  carbsGrams: number;
  fatGrams: number;
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
  maintainCalories: number;
  cutCalories: number;
  gainCalories: number;
};

type EditableInputs = {
  age: number;
  sex: 'male' | 'female';
  weightKg: number;
  heightCm: number;
  goal: string;
  daysPerWeek: number;
};

type ProfileSnapshot = {
  name: string;
  email: string;
  primaryGoal: string;
  experienceLevel: string;
};

const getCurrentUserId = () => {
  const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
  const localUserId = Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || 0);
  const parsedUserId = Number(user?.id || 0);
  return localUserId || parsedUserId || 0;
};

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const normalizeGoal = (goal: string) =>
  String(goal || '')
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .trim();

const formatGoalLabel = (goal: string) => {
  const key = normalizeGoal(goal);
  if (!key) return 'General Fitness';
  return key
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const getProteinMultiplier = (goal: string) => {
  const key = normalizeGoal(goal);
  if (key.includes('fat') || key.includes('loss')) return 2.0;
  if (key.includes('recomp')) return 2.0;
  if (key.includes('hypertrophy') || key.includes('muscle') || key.includes('strength')) return 1.8;
  if (key.includes('endurance')) return 1.6;
  return 1.6;
};

const getCaloriesDelta = (goal: string) => {
  const key = normalizeGoal(goal);
  if (key.includes('fat') || key.includes('loss') || key.includes('weight loss')) return -450;
  if (key.includes('hypertrophy') || key.includes('muscle')) return 250;
  if (key.includes('strength')) return 150;
  if (key.includes('endurance')) return 150;
  return 0;
};

const getWaterGoalBonusLiters = (goal: string) => {
  const key = normalizeGoal(goal);
  if (key.includes('endurance')) return 0.3;
  if (key.includes('fat') || key.includes('loss')) return 0.2;
  return 0.1;
};

const getWaterActivityBonusLiters = (activity: ActivityLevel) => {
  if (activity === 'sedentary') return 0.2;
  if (activity === 'light') return 0.35;
  if (activity === 'moderate') return 0.55;
  return 0.8;
};

const inferActivityLevel = (daysPerWeek: number): ActivityLevel => {
  if (daysPerWeek <= 2) return 'sedentary';
  if (daysPerWeek === 3) return 'light';
  if (daysPerWeek === 4) return 'moderate';
  return 'very';
};

const activityLabel = (activity: ActivityLevel) => {
  if (activity === 'sedentary') return 'Sedentary';
  if (activity === 'light') return 'Lightly Active';
  if (activity === 'moderate') return 'Moderately Active';
  return 'Very Active';
};

const activityToWorkoutFrequency = (activity: ActivityLevel) => {
  if (activity === 'sedentary') return 1;
  if (activity === 'light') return 2;
  if (activity === 'moderate') return 4;
  return 6;
};

const formatPercentileLabel = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) return 'N/A';
  const rounded = Math.round(value);
  if (rounded <= 25) return `${rounded}% (Lower quartile)`;
  if (rounded <= 75) return `${rounded}% (Mid range)`;
  return `${rounded}% (Upper quartile)`;
};

const buildAutoTargets = ({
  age,
  weightKg,
  heightCm,
  sex,
  goalRaw,
  daysPerWeek,
  restingBpm,
  loggedHydrationLiters,
}: {
  age: number;
  weightKg: number;
  heightCm: number;
  sex: 'male' | 'female';
  goalRaw: string;
  daysPerWeek: number;
  restingBpm: number | null;
  loggedHydrationLiters: number | null;
}): AutoTargets => {
  const inferredActivity = inferActivityLevel(daysPerWeek);

  const sexConstant = sex === 'female' ? -161 : 5;
  const bmr = Math.round((10 * weightKg) + (6.25 * heightCm) - (5 * age) + sexConstant);
  const tdee = Math.round(bmr * ACTIVITY_FACTORS[inferredActivity]);

  const proteinMultiplier = getProteinMultiplier(goalRaw);
  const caloriesDelta = getCaloriesDelta(goalRaw);
  const recommendedCalories = Math.max(1200, Math.round(tdee + caloriesDelta));
  const recommendedProtein = Math.max(60, Math.round(weightKg * proteinMultiplier));
  const waterLitersRaw = (weightKg * 0.035)
    + getWaterActivityBonusLiters(inferredActivity)
    + getWaterGoalBonusLiters(goalRaw);
  const recommendedWaterLiters = Number(clamp(waterLitersRaw, 1.8, 6.0).toFixed(2));
  const recommendedWaterCups = Math.max(6, Math.round((recommendedWaterLiters * 1000) / 250));
  const waterRangeMinLiters = Number(Math.max(1.6, recommendedWaterLiters - 0.4).toFixed(2));
  const waterRangeMaxLiters = Number(Math.min(6.5, recommendedWaterLiters + 0.6).toFixed(2));

  const fatGrams = Math.max(40, Math.round((recommendedCalories * 0.27) / 9));
  const remainingCalories = Math.max(0, recommendedCalories - (recommendedProtein * 4) - (fatGrams * 9));
  const carbsGrams = Math.max(50, Math.round(remainingCalories / 4));

  const proteinPct = clamp(Math.round(((recommendedProtein * 4) / recommendedCalories) * 100), 10, 60);
  const fatPct = clamp(Math.round(((fatGrams * 9) / recommendedCalories) * 100), 10, 50);
  const carbsPct = clamp(100 - proteinPct - fatPct, 10, 70);

  const maintainCalories = Math.round(tdee);
  const cutCalories = Math.max(1200, Math.round(tdee - 450));
  const gainCalories = Math.max(1200, Math.round(tdee + 250));

  return {
    age,
    weightKg,
    heightCm,
    sex,
    goalLabel: formatGoalLabel(goalRaw),
    activityLabel: activityLabel(inferredActivity),
    daysPerWeek,
    restingBpm,
    bmr,
    tdee,
    recommendedCalories,
    recommendedProtein,
    recommendedWaterLiters,
    recommendedWaterCups,
    waterRangeMinLiters,
    waterRangeMaxLiters,
    loggedHydrationLiters,
    carbsGrams,
    fatGrams,
    proteinPct,
    carbsPct,
    fatPct,
    maintainCalories,
    cutCalories,
    gainCalories,
  };
};

export function Calculator({ onBack }: CalculatorProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [datasetError, setDatasetError] = useState('');
  const [persistError, setPersistError] = useState('');
  const [targets, setTargets] = useState<AutoTargets | null>(null);
  const [datasetInsights, setDatasetInsights] = useState<DatasetInsights | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editInputs, setEditInputs] = useState<EditableInputs | null>(null);
  const [profileSnapshot, setProfileSnapshot] = useState<ProfileSnapshot | null>(null);
  const [signals, setSignals] = useState<{ restingBpm: number | null; loggedHydrationLiters: number | null }>({
    restingBpm: null,
    loggedHydrationLiters: null,
  });

  const userId = useMemo(() => getCurrentUserId(), []);

  useEffect(() => {
    let cancelled = false;

    const loadAutoTargets = async () => {
      setLoading(true);
      setError('');
      setDatasetError('');
      setPersistError('');

      if (!userId) {
        setError('No active user session found. Please login again.');
        setLoading(false);
        return;
      }

      try {
        const [profile, program, history] = await Promise.all([
          api.getProfileDetails(userId),
          api.getUserProgram(userId).catch(() => null),
          api.getUserInsightsHistory(userId, { days: 90, limit: 20 }).catch(() => null),
        ]);

        if (cancelled) return;

        const persistedOverride = getNutritionInputsOverride(userId);

        const age = Number((persistedOverride?.age ?? profile?.age) || 0);
        const weightKg = Number((persistedOverride?.weightKg ?? profile?.weightKg) || 0);
        const heightCm = Number((persistedOverride?.heightCm ?? profile?.heightCm) || 0);

        if (!(age > 0 && weightKg > 0 && heightCm > 0)) {
          setError('Missing required profile data (age, weight, height). Update your profile details to enable automatic targets.');
          setTargets(null);
          setLoading(false);
          return;
        }

        const sex: 'male' | 'female' = persistedOverride?.sex
          || (String(profile?.gender || '').toLowerCase() === 'female' ? 'female' : 'male');
        const goalRaw = String(persistedOverride?.goal || profile?.fitnessGoal || program?.goal || 'general_fitness');
        const daysPerWeek = clamp(
          Number(
            persistedOverride?.daysPerWeek
            ?? program?.daysPerWeek
            ?? (Array.isArray(program?.currentWeekWorkouts) ? program.currentWeekWorkouts.length : 0)
            ?? 4,
          ),
          1,
          7,
        );
        const restingBpm = Number.isFinite(Number(history?.snapshots?.[0]?.restingHeartRate))
          ? Number(history.snapshots[0].restingHeartRate)
          : null;
        const loggedHydrationLiters = Number.isFinite(Number(history?.snapshots?.[0]?.hydrationLiters))
          ? Number(history.snapshots[0].hydrationLiters)
          : null;

        const autoTargets = buildAutoTargets({
          age,
          weightKg,
          heightCm,
          sex,
          goalRaw,
          daysPerWeek,
          restingBpm,
          loggedHydrationLiters,
        });

        setTargets(autoTargets);
        setSignals({ restingBpm, loggedHydrationLiters });
        setProfileSnapshot({
          name: String(profile?.name || ''),
          email: String(profile?.email || ''),
          primaryGoal: String(profile?.primaryGoal || ''),
          experienceLevel: String(profile?.experienceLevel || ''),
        });
        setEditInputs({
          age,
          sex,
          weightKg,
          heightCm,
          goal: goalRaw,
          daysPerWeek,
        });

        try {
          const inferredActivity = inferActivityLevel(daysPerWeek);
          const onboardingInsights = await api.getOnboardingInsights({
            age,
            gender: sex,
            weightKg,
            heightCm,
            restingBpm,
            workoutFrequency: activityToWorkoutFrequency(inferredActivity),
          });
          if (!cancelled) setDatasetInsights(onboardingInsights || null);
        } catch (insightsError: unknown) {
          const message = insightsError instanceof Error ? insightsError.message : 'Could not load dataset benchmark right now.';
          if (!cancelled) {
            setDatasetInsights(null);
            setDatasetError(message);
          }
        }
      } catch (loadError: unknown) {
        const message = loadError instanceof Error ? loadError.message : 'Failed to auto-generate nutrition targets.';
        if (!cancelled) {
          setTargets(null);
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadAutoTargets();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleRecalculate = async () => {
    if (!editInputs) return;

    const age = Number(editInputs.age || 0);
    const weightKg = Number(editInputs.weightKg || 0);
    const heightCm = Number(editInputs.heightCm || 0);
    const daysPerWeek = clamp(Number(editInputs.daysPerWeek || 1), 1, 7);
    const goalRaw = String(editInputs.goal || 'general_fitness').trim() || 'general_fitness';
    const sex: 'male' | 'female' = editInputs.sex === 'female' ? 'female' : 'male';

    if (!(age >= 10 && age <= 100)) {
      setError('Age must be between 10 and 100.');
      return;
    }
    if (!(weightKg >= 25 && weightKg <= 350)) {
      setError('Weight must be between 25 and 350 kg.');
      return;
    }
    if (!(heightCm >= 100 && heightCm <= 260)) {
      setError('Height must be between 100 and 260 cm.');
      return;
    }

    setError('');
    setDatasetError('');
    setPersistError('');
    setEditSaving(true);

    const nextTargets = buildAutoTargets({
      age,
      weightKg,
      heightCm,
      sex,
      goalRaw,
      daysPerWeek,
      restingBpm: signals.restingBpm,
      loggedHydrationLiters: signals.loggedHydrationLiters,
    });

    setTargets(nextTargets);
    setEditInputs({
      age,
      sex,
      weightKg,
      heightCm,
      goal: goalRaw,
      daysPerWeek,
    });

    saveNutritionInputsOverride(userId, {
      age,
      sex,
      weightKg,
      heightCm,
      goal: goalRaw,
      daysPerWeek,
    });

    if (profileSnapshot?.name && profileSnapshot?.email) {
      try {
        await api.updateProfileDetails(userId, {
          name: profileSnapshot.name,
          email: profileSnapshot.email,
          age,
          gender: sex,
          heightCm,
          weightKg,
          primaryGoal: profileSnapshot.primaryGoal || '',
          fitnessGoal: goalRaw,
          experienceLevel: profileSnapshot.experienceLevel || '',
        });
      } catch (saveError: unknown) {
        const message = saveError instanceof Error ? saveError.message : 'Failed to save profile updates.';
        setPersistError(`Recalculated and synced locally, but profile save failed: ${message}`);
      }
    }

    try {
      const inferredActivity = inferActivityLevel(daysPerWeek);
      const onboardingInsights = await api.getOnboardingInsights({
        age,
        gender: sex,
        weightKg,
        heightCm,
        restingBpm: signals.restingBpm,
        workoutFrequency: activityToWorkoutFrequency(inferredActivity),
      });
      setDatasetInsights(onboardingInsights || null);
      setEditOpen(false);
    } catch (insightsError: unknown) {
      const message = insightsError instanceof Error ? insightsError.message : 'Could not load dataset benchmark right now.';
      setDatasetInsights(null);
      setDatasetError(message);
      setEditOpen(false);
    } finally {
      setEditSaving(false);
    }
  };

  const maxScenario = targets
    ? Math.max(targets.cutCalories, targets.maintainCalories, targets.gainCalories)
    : 1;
  const scenarioItems = targets
    ? [
      { label: 'Fat Loss', kcal: targets.cutCalories, color: 'bg-rose-400' },
      { label: 'Maintain', kcal: targets.maintainCalories, color: 'bg-sky-400' },
      { label: 'Muscle Gain', kcal: targets.gainCalories, color: 'bg-emerald-400' },
    ]
    : [];
  const hydrationProgress = targets && targets.loggedHydrationLiters != null
    ? clamp((targets.loggedHydrationLiters / targets.recommendedWaterLiters) * 100, 0, 100)
    : 0;
  const activeScenarioLabel = targets
    ? (() => {
      const goal = normalizeGoal(targets.goalLabel);
      if (goal.includes('fat') || goal.includes('loss')) return 'Fat Loss';
      if (goal.includes('gain') || goal.includes('muscle') || goal.includes('hypertrophy')) return 'Muscle Gain';
      return 'Maintain';
    })()
    : 'Maintain';
  const sectionCardClass = 'relative overflow-hidden border border-white/10 bg-[linear-gradient(180deg,#1d232d_0%,#141922_100%)] p-4 shadow-[0_12px_24px_rgba(0,0,0,0.24)]';

  return (
    <div className="flex-1 flex flex-col bg-background min-h-screen pb-24">
      <div className="px-6 pt-2">
        <Header
          title="Auto Nutrition Targets"
          onBack={onBack}
          rightElement={(
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              disabled={!editInputs}
              className="w-10 h-10 rounded-full bg-card flex items-center justify-center text-text-primary hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Edit nutrition inputs"
            >
              <Pencil size={18} />
            </button>
          )}
        />
      </div>

      <div className="px-6 space-y-4 pb-4">
        {loading && (
          <Card>
            <div className="text-sm text-text-secondary">Building your targets from profile and training data...</div>
          </Card>
        )}

        {!loading && error && (
          <Card className="border-red-500/40 bg-red-500/10">
            <div className="text-sm text-red-300">{error}</div>
          </Card>
        )}

        {!loading && persistError && (
          <Card className="border-yellow-500/40 bg-yellow-500/10">
            <div className="text-sm text-yellow-300">{persistError}</div>
          </Card>
        )}

        {!loading && targets && (
          <div className="space-y-3">
            <Card className="relative overflow-hidden border border-cyan-400/20 bg-[#14181f] p-5">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_0%,rgba(34,211,238,0.18),transparent_42%)]" />
              <div className="relative">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">Daily Nutrition Plan</div>
                <div className="mt-1 flex items-end gap-2">
                  <div className="text-4xl font-black leading-none tabular-nums text-cyan-300">{targets.recommendedCalories}</div>
                  <div className="pb-1 text-sm font-medium text-white">kcal/day</div>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-text-tertiary">
                  Auto-generated from your profile and current training load.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-text-secondary">
                    Goal <span className="font-semibold text-white">{targets.goalLabel}</span>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-text-secondary">
                    Activity <span className="font-semibold text-white">{targets.activityLabel}</span>
                  </div>
                  <div className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-[11px] text-cyan-200">
                    Active Scenario <span className="font-semibold text-white">{activeScenarioLabel}</span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2.5">
                    <div className="text-[11px] text-text-secondary">Protein Target</div>
                    <div className="mt-1 text-lg font-bold leading-none tabular-nums text-white">{targets.recommendedProtein} g</div>
                    <div className="mt-1 text-[10px] text-text-tertiary">per day</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2.5">
                    <div className="text-[11px] text-text-secondary">Water Target</div>
                    <div className="mt-1 text-lg font-bold leading-none tabular-nums text-white">{targets.recommendedWaterLiters} L</div>
                    <div className="mt-1 text-[10px] text-text-tertiary">{targets.recommendedWaterCups} cups/day</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2.5">
                    <div className="text-[11px] text-text-secondary">Estimated TDEE</div>
                    <div className="mt-1 text-lg font-bold leading-none tabular-nums text-white">{targets.tdee} kcal</div>
                    <div className="mt-1 text-[10px] text-text-tertiary">baseline</div>
                  </div>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Card className={sectionCardClass}>
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-400/15 text-cyan-300">
                    <UserRound size={15} />
                  </div>
                  <h3 className="text-sm font-semibold text-white">Personal Inputs Used</h3>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { label: 'Age', value: `${targets.age}` },
                    { label: 'Sex', value: `${targets.sex}` },
                    { label: 'Weight', value: `${targets.weightKg} kg` },
                    { label: 'Height', value: `${targets.heightCm} cm` },
                    { label: 'Goal', value: targets.goalLabel },
                    { label: 'Training Days', value: `${targets.daysPerWeek}/week` },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg border border-white/5 bg-white/5 px-2.5 py-2">
                      <div className="text-[11px] text-text-secondary">{item.label}</div>
                      <div className="mt-1 text-sm font-semibold leading-tight text-white">{item.value}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className={sectionCardClass}>
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-400/15 text-cyan-300">
                    <Droplets size={15} />
                  </div>
                  <h3 className="text-sm font-semibold text-white">Hydration Target</h3>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                  <div className="min-w-0">
                    <div className="text-xs text-text-secondary">Recommended Daily Water</div>
                    <div className="mt-1 text-2xl font-bold leading-none tabular-nums text-white">
                      {targets.recommendedWaterLiters} L
                    </div>
                    <div className="mt-1 text-[11px] text-text-tertiary">
                      Range: {targets.waterRangeMinLiters} - {targets.waterRangeMaxLiters} L
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-text-secondary">Cups</div>
                    <div className="mt-1 text-xl font-bold leading-none tabular-nums text-cyan-300">{targets.recommendedWaterCups}</div>
                  </div>
                </div>

                {targets.loggedHydrationLiters != null && (
                  <div className="mt-3 rounded-xl border border-white/5 bg-white/5 px-3 py-2.5">
                    <div className="mb-1 flex justify-between text-xs text-text-secondary">
                      <span>Last check-in hydration</span>
                      <span className="text-white">{targets.loggedHydrationLiters} L</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-cyan-400"
                        style={{ width: `${hydrationProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Card className={sectionCardClass}>
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-300">
                    <Gauge size={15} />
                  </div>
                  <h3 className="text-sm font-semibold text-white">Calorie Scenarios</h3>
                </div>
                <div className="space-y-2.5">
                  {scenarioItems.map((item) => (
                    <div key={item.label} className={`rounded-xl border px-3 py-2.5 ${item.label === activeScenarioLabel ? 'border-cyan-400/40 bg-cyan-400/10' : 'border-white/5 bg-white/5'}`}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-text-secondary">{item.label}</span>
                        <span className="font-semibold tabular-nums text-white">{item.kcal} kcal</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div className={`h-full rounded-full ${item.color}`} style={{ width: `${(item.kcal / maxScenario) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className={sectionCardClass}>
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-fuchsia-400/15 text-fuchsia-300">
                    <PieChart size={15} />
                  </div>
                  <h3 className="text-sm font-semibold text-white">Daily Macro Split</h3>
                </div>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="bg-sky-400" style={{ width: `${targets.proteinPct}%` }} />
                  <div className="bg-amber-400" style={{ width: `${targets.carbsPct}%` }} />
                  <div className="bg-fuchsia-400" style={{ width: `${targets.fatPct}%` }} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-sky-400/25 bg-sky-400/10 p-2">
                    <div className="text-[11px] text-sky-200">Protein</div>
                    <div className="mt-1 text-sm font-bold tabular-nums text-white">{targets.recommendedProtein}g</div>
                    <div className="text-[10px] text-text-tertiary">{targets.proteinPct}%</div>
                  </div>
                  <div className="rounded-lg border border-amber-400/25 bg-amber-400/10 p-2">
                    <div className="text-[11px] text-amber-200">Carbs</div>
                    <div className="mt-1 text-sm font-bold tabular-nums text-white">{targets.carbsGrams}g</div>
                    <div className="text-[10px] text-text-tertiary">{targets.carbsPct}%</div>
                  </div>
                  <div className="rounded-lg border border-fuchsia-400/25 bg-fuchsia-400/10 p-2">
                    <div className="text-[11px] text-fuchsia-200">Fat</div>
                    <div className="mt-1 text-sm font-bold tabular-nums text-white">{targets.fatGrams}g</div>
                    <div className="text-[10px] text-text-tertiary">{targets.fatPct}%</div>
                  </div>
                </div>
              </Card>
            </div>

            {datasetError && (
              <Card className="border-yellow-500/40 bg-yellow-500/10">
                <div className="text-xs text-yellow-300">
                  Dataset benchmark unavailable right now: {datasetError}
                </div>
              </Card>
            )}

            {datasetInsights && (
              <Card className={sectionCardClass}>
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-400/15 text-cyan-300">
                    <BarChart3 size={15} />
                  </div>
                  <h3 className="text-sm font-semibold text-white">Dataset Benchmark</h3>
                </div>
                <div className="space-y-3">
                  {[
                    {
                      label: 'Age Percentile',
                      value: datasetInsights.baselinePosition?.agePercentile ?? null,
                    },
                    {
                      label: 'BMI Percentile',
                      value: datasetInsights.baselinePosition?.bmiPercentile ?? null,
                    },
                    {
                      label: 'Resting BPM Percentile',
                      value: datasetInsights.baselinePosition?.restingBpmPercentile ?? null,
                    },
                  ].map((item) => {
                    const value = item.value == null || !Number.isFinite(item.value) ? null : clamp(item.value, 0, 100);
                    return (
                      <div key={item.label} className="rounded-xl border border-white/5 bg-white/5 px-3 py-2.5">
                        <div className="mb-1 flex justify-between text-xs text-text-secondary">
                          <span className="truncate pr-2">{item.label}</span>
                          <span className="text-white">{formatPercentileLabel(value)}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-cyan-400" style={{ width: `${value ?? 0}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                  <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                    <div className="text-text-secondary">Suggested Level</div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {datasetInsights.interpretation?.suggestedExperienceLevel || 'N/A'}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                    <div className="text-text-secondary">Suggested Workout Types</div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {(datasetInsights.interpretation?.suggestedWorkoutTypes || []).slice(0, 3).join(' | ') || 'N/A'}
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>

      {editOpen && editInputs && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4"
          onClick={() => setEditOpen(false)}
        >
          <div
            className="w-full max-w-md bg-card border border-white/10 rounded-2xl p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">Edit Inputs</h3>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="text-xs text-text-secondary hover:text-white transition-colors"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="space-y-1">
                <label className="text-xs text-text-secondary">Age</label>
                <input
                  type="number"
                  value={editInputs.age}
                  onChange={(event) => setEditInputs((prev) => (
                    prev ? { ...prev, age: Number(event.target.value || 0) } : prev
                  ))}
                  className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-accent/60"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-text-secondary">Sex</label>
                <select
                  value={editInputs.sex}
                  onChange={(event) => setEditInputs((prev) => (
                    prev ? { ...prev, sex: event.target.value === 'female' ? 'female' : 'male' } : prev
                  ))}
                  className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-accent/60"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-text-secondary">Weight (kg)</label>
                <input
                  type="number"
                  value={editInputs.weightKg}
                  onChange={(event) => setEditInputs((prev) => (
                    prev ? { ...prev, weightKg: Number(event.target.value || 0) } : prev
                  ))}
                  className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-accent/60"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-text-secondary">Height (cm)</label>
                <input
                  type="number"
                  value={editInputs.heightCm}
                  onChange={(event) => setEditInputs((prev) => (
                    prev ? { ...prev, heightCm: Number(event.target.value || 0) } : prev
                  ))}
                  className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-accent/60"
                />
              </div>

              <div className="col-span-2 space-y-1">
                <label className="text-xs text-text-secondary">Goal</label>
                <input
                  type="text"
                  value={editInputs.goal}
                  onChange={(event) => setEditInputs((prev) => (
                    prev ? { ...prev, goal: event.target.value } : prev
                  ))}
                  className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-accent/60"
                  placeholder="muscle_gain / fat_loss / endurance"
                />
              </div>

              <div className="col-span-2 space-y-1">
                <label className="text-xs text-text-secondary">Training Days Per Week</label>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={editInputs.daysPerWeek}
                  onChange={(event) => setEditInputs((prev) => (
                    prev ? { ...prev, daysPerWeek: Number(event.target.value || 1) } : prev
                  ))}
                  className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-accent/60"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="px-4 py-2 rounded-lg bg-white/5 text-text-secondary hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleRecalculate()}
                disabled={editSaving}
                className="px-4 py-2 rounded-lg bg-accent text-black font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editSaving ? 'Recalculating...' : 'Recalculate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
