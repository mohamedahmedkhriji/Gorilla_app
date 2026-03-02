import React, { useEffect, useMemo, useState } from 'react';
import {
  Apple,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Flag,
  Flame,
  Moon,
  Sun,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import { Header } from '../components/ui/Header';
import { Card } from '../components/ui/Card';
import { api } from '../services/api';
import { getNutritionInputsOverride, NUTRITION_INPUTS_UPDATED_EVENT } from '../services/nutritionOverrides';

interface MyNutritionProps {
  onBack: () => void;
}

type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very';
type NutritionView = 'meals' | 'activity';

type NutritionFoodItem = {
  name: string;
  category: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  waterMl: number;
};

type NutritionPlanResponse = {
  generatedAt: string;
  goal: string;
  targets: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    waterMl: number;
  };
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sugars: number;
    sodium: number;
    cholesterol: number;
  };
  hydration: {
    recommendedWaterMl: number;
    waterFromFoodsMl: number;
    remainingWaterMl: number;
  };
  meals: Array<{
    slot: string;
    items: NutritionFoodItem[];
    totals: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    };
  }>;
};

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
};

const getCurrentUserId = () => {
  const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
  const localUserId = Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || 0);
  const parsedUserId = Number(user?.id || 0);
  return localUserId || parsedUserId || 0;
};

const normalizeGoal = (goal: string) =>
  String(goal || '')
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .trim();

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
  if (key.includes('fat') || key.includes('loss')) return -450;
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

const formatGoalLabel = (goal: string) => {
  const key = normalizeGoal(goal);
  if (!key) return 'General Fitness';
  return key
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const toLitersLabel = (ml: number) => `${(ml / 1000).toFixed(2)} L`;

const getMealIcon = (slot: string): LucideIcon => {
  const key = String(slot || '').toLowerCase();
  if (key.includes('breakfast')) return Sun;
  if (key.includes('lunch')) return UtensilsCrossed;
  if (key.includes('dinner')) return Moon;
  return Apple;
};

const formatSigned = (value: number) => (value > 0 ? `+${value}` : `${value}`);

interface CircularMeterProps {
  value: number;
  max: number;
  size: number;
  strokeWidth: number;
  color: string;
  trackColor?: string;
  className?: string;
  children?: React.ReactNode;
}

function CircularMeter({
  value,
  max,
  size,
  strokeWidth,
  color,
  trackColor = 'rgba(255,255,255,0.13)',
  className = '',
  children,
}: CircularMeterProps) {
  const safeMax = Math.max(max, 1);
  const progress = clamp(value / safeMax, 0, 1);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference * (1 - progress);

  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeOffset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

export function MyNutrition({ onBack }: MyNutritionProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState<NutritionPlanResponse | null>(null);
  const [goalLabel, setGoalLabel] = useState('General Fitness');
  const [tdee, setTdee] = useState<number | null>(null);
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [activeView, setActiveView] = useState<NutritionView>('meals');
  const [expandedMeals, setExpandedMeals] = useState<Record<string, boolean>>({});
  const userId = useMemo(() => getCurrentUserId(), []);

  useEffect(() => {
    const onInputsUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ userId?: number }>;
      if (Number(custom?.detail?.userId || 0) !== userId) return;
      setRefreshSeed((value) => value + 1);
    };

    window.addEventListener(NUTRITION_INPUTS_UPDATED_EVENT, onInputsUpdated);
    return () => {
      window.removeEventListener(NUTRITION_INPUTS_UPDATED_EVENT, onInputsUpdated);
    };
  }, [userId]);

  useEffect(() => {
    let cancelled = false;

    const loadNutrition = async () => {
      setLoading(true);
      setError('');

      if (!userId) {
        setError('No active user session found. Please login again.');
        setLoading(false);
        return;
      }

      try {
        const [profile, program] = await Promise.all([
          api.getProfileDetails(userId),
          api.getUserProgram(userId).catch(() => null),
        ]);

        if (cancelled) return;

        const persistedOverride = getNutritionInputsOverride(userId);
        const age = Number((persistedOverride?.age ?? profile?.age) || 0);
        const weightKg = Number((persistedOverride?.weightKg ?? profile?.weightKg) || 0);
        const heightCm = Number((persistedOverride?.heightCm ?? profile?.heightCm) || 0);

        if (!(age > 0 && weightKg > 0 && heightCm > 0)) {
          setError('Missing profile data (age, weight, height). Update profile details to generate automatic nutrition.');
          setPlan(null);
          setLoading(false);
          return;
        }

        const sex: 'male' | 'female' = persistedOverride?.sex
          || (String(profile?.gender || '').toLowerCase() === 'female' ? 'female' : 'male');
        const goalRaw = String(persistedOverride?.goal || profile?.fitnessGoal || program?.goal || 'general_fitness');
        const daysPerWeek = Math.max(1, Math.min(
          7,
          Number(
            persistedOverride?.daysPerWeek
            ?? program?.daysPerWeek
            ?? (Array.isArray(program?.currentWeekWorkouts) ? program.currentWeekWorkouts.length : 0)
            ?? 4,
          ),
        ));
        const activity = inferActivityLevel(daysPerWeek);
        const sexConstant = sex === 'female' ? -161 : 5;
        const bmr = Math.round((10 * weightKg) + (6.25 * heightCm) - (5 * age) + sexConstant);
        const computedTdee = Math.round(bmr * ACTIVITY_FACTORS[activity]);
        const proteinMultiplier = getProteinMultiplier(goalRaw);
        const caloriesDelta = getCaloriesDelta(goalRaw);
        const targetCalories = Math.max(1200, Math.round(computedTdee + caloriesDelta));
        const targetProtein = Math.max(60, Math.round(weightKg * proteinMultiplier));
        const targetFat = Math.max(40, Math.round((targetCalories * 0.27) / 9));
        const targetCarbs = Math.max(50, Math.round((targetCalories - (targetProtein * 4) - (targetFat * 9)) / 4));
        const waterLiters = clamp(
          (weightKg * 0.035) + getWaterActivityBonusLiters(activity) + getWaterGoalBonusLiters(goalRaw),
          1.8,
          6.0,
        );
        const targetWaterMl = Math.round(waterLiters * 1000);

        const dailyPlan = await api.getDailyNutritionPlan({
          targetCalories,
          targetProtein,
          targetCarbs,
          targetFat,
          targetWaterMl,
          goal: goalRaw,
        });

        if (cancelled) return;
        setPlan(dailyPlan as NutritionPlanResponse);
        setGoalLabel(formatGoalLabel(goalRaw));
        setTdee(computedTdee);
      } catch (loadError: unknown) {
        const message = loadError instanceof Error ? loadError.message : 'Failed to build nutrition plan.';
        if (!cancelled) {
          setPlan(null);
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadNutrition();
    return () => {
      cancelled = true;
    };
  }, [userId, refreshSeed]);

  useEffect(() => {
    if (!plan?.meals?.length) return;
    const firstKey = `${plan.meals[0].slot}-0`;
    setExpandedMeals((prev) => (Object.keys(prev).length ? prev : { [firstKey]: true }));
  }, [plan]);

  const calorieProgress = plan ? clamp(Math.round((plan.totals.calories / plan.targets.calories) * 100), 0, 160) : 0;
  const proteinProgress = plan ? clamp(Math.round((plan.totals.protein / plan.targets.protein) * 100), 0, 160) : 0;

  const caloriesRemaining = plan ? plan.targets.calories - plan.totals.calories : 0;
  const baseGoalCalories = plan ? Math.round(tdee || plan.targets.calories) : 0;
  const exerciseAdjustment = plan && tdee ? Math.round(plan.targets.calories - tdee) : 0;

  const mealTitles = useMemo(() => {
    if (!plan?.meals) return [];
    let snackNumber = 0;
    return plan.meals.map((meal) => {
      const slot = String(meal.slot || 'Meal');
      if (slot.toLowerCase().includes('snack')) {
        snackNumber += 1;
        return `Snack ${snackNumber}`;
      }
      return slot;
    });
  }, [plan]);

  const toggleMeal = (mealKey: string) =>
    setExpandedMeals((prev) => ({ ...prev, [mealKey]: !prev[mealKey] }));

  return (
    <div className="flex-1 flex flex-col bg-background min-h-screen pb-24">
      <div className="px-4 sm:px-6 pt-2">
        <Header title="My Nutrition" onBack={onBack} />
      </div>

      <div className="px-4 sm:px-6 space-y-4 pb-4">
        {loading && (
          <Card className="border border-white/5 bg-card/80 p-4">
            <div className="text-sm text-text-secondary">Building your daily food plan...</div>
          </Card>
        )}

        {!loading && error && (
          <Card className="border-red-500/40 bg-red-500/10 p-4">
            <div className="text-sm text-red-300">{error}</div>
          </Card>
        )}

        {!loading && plan && (
          <>
            <Card className="relative overflow-hidden border border-white/15 bg-[#14181f] p-4">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(34,211,238,0.2),transparent_45%)]" />
              <div className="relative">
                <div className="text-center text-sm font-semibold text-text-secondary">Today</div>

                <div className="mt-3 grid grid-cols-[126px_minmax(0,1fr)] items-center gap-3">
                  <CircularMeter
                    value={plan.totals.calories}
                    max={plan.targets.calories}
                    size={126}
                    strokeWidth={9}
                    color="#14d3df"
                    trackColor="rgba(255,255,255,0.1)"
                    className="shrink-0">
                    <div className="text-center leading-none">
                      <div className="text-[44px] font-black text-white">{Math.abs(caloriesRemaining)}</div>
                      <div className="mt-1.5 text-[9px] uppercase tracking-[0.14em] text-text-secondary">
                        {caloriesRemaining >= 0 ? 'Remaining' : 'Over'}
                      </div>
                    </div>
                  </CircularMeter>

                  <div className="min-w-0 space-y-2.5">
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-400/10">
                        <Flag size={13} className="text-cyan-400" />
                      </div>
                      <div className="leading-none">
                        <div className="text-xs text-text-secondary">Base Goal</div>
                        <div className="mt-1 text-[30px] font-semibold tabular-nums text-white">{baseGoalCalories}</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-400/10">
                        <UtensilsCrossed size={13} className="text-cyan-400" />
                      </div>
                      <div className="leading-none">
                        <div className="text-xs text-text-secondary">Food</div>
                        <div className="mt-1 text-[30px] font-semibold tabular-nums text-white">{plan.totals.calories}</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-400/10">
                        <Dumbbell size={13} className="text-cyan-400" />
                      </div>
                      <div className="leading-none">
                        <div className="text-xs text-text-secondary">Exercise</div>
                        <div className={`mt-1 text-[30px] font-semibold tabular-nums ${exerciseAdjustment >= 0 ? 'text-cyan-400' : 'text-orange-400'}`}>
                          {formatSigned(exerciseAdjustment)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-cyan-400 transition-all"
                    style={{ width: `${Math.min(calorieProgress, 100)}%` }}
                  />
                </div>
                <div className="mt-3 text-[11px] leading-tight text-text-tertiary">
                  Goal: {goalLabel}{tdee ? ` | TDEE ${tdee} kcal` : ''}
                </div>
              </div>
            </Card>

            <Card className="border border-white/5 bg-[#14181f] p-4">
              <div className="grid grid-cols-3 gap-1">
                <div className="flex min-w-0 flex-col items-center gap-1.5">
                  <div className="text-sm font-semibold text-white">Carbs</div>
                  <CircularMeter value={plan.totals.carbs} max={plan.targets.carbs} size={64} strokeWidth={5} color="#14d3df">
                    <div className="text-sm font-bold tabular-nums text-white">{plan.totals.carbs}g</div>
                  </CircularMeter>
                </div>
                <div className="flex min-w-0 flex-col items-center gap-1.5">
                  <div className="text-sm font-semibold text-white">Protein</div>
                  <CircularMeter value={plan.totals.protein} max={plan.targets.protein} size={64} strokeWidth={5} color="#0ea5e9">
                    <div className="text-sm font-bold tabular-nums text-white">{plan.totals.protein}g</div>
                  </CircularMeter>
                </div>
                <div className="flex min-w-0 flex-col items-center gap-1.5">
                  <div className="text-sm font-semibold text-white">Fat</div>
                  <CircularMeter value={plan.totals.fat} max={plan.targets.fat} size={64} strokeWidth={5} color="#22d3ee">
                    <div className="text-sm font-bold tabular-nums text-white">{plan.totals.fat}g</div>
                  </CircularMeter>
                </div>
              </div>
            </Card>

            <div className="rounded-full border border-white/5 bg-card/90 p-1">
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => setActiveView('meals')}
                  className={`
                    flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition-colors
                    ${activeView === 'meals' ? 'bg-cyan-400 text-black' : 'text-text-secondary hover:text-white'}
                  `}>
                  <UtensilsCrossed size={15} />
                  Meals
                </button>
                <button
                  onClick={() => setActiveView('activity')}
                  className={`
                    flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition-colors
                    ${activeView === 'activity' ? 'bg-cyan-400 text-black' : 'text-text-secondary hover:text-white'}
                  `}>
                  <Flame size={15} />
                  Activity
                </button>
              </div>
            </div>

            {activeView === 'meals' && (
              <div className="space-y-3">
                {plan.meals.map((meal, index) => {
                  const mealKey = `${meal.slot}-${index}`;
                  const isExpanded = Boolean(expandedMeals[mealKey]);
                  const MealIcon = getMealIcon(meal.slot);

                  return (
                    <div key={mealKey} className="overflow-hidden rounded-2xl border border-white/5 bg-card/95">
                      <button
                        onClick={() => toggleMeal(mealKey)}
                        className="flex w-full items-center justify-between gap-2 px-4 py-4 text-left">
                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-400">
                            <MealIcon size={18} />
                          </div>
                          <div className="text-lg font-semibold leading-tight text-white">
                            {mealTitles[index]}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <div className="whitespace-nowrap text-lg font-semibold leading-none text-white">{meal.totals.calories} kcal</div>
                          {isExpanded ? <ChevronUp size={18} className="text-text-secondary" /> : <ChevronDown size={18} className="text-text-secondary" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="space-y-2 border-t border-white/5 px-4 pb-4 pt-3">
                          {meal.items.map((item, itemIndex) => (
                            <div key={`${item.name}-${itemIndex}`} className="rounded-xl bg-white/5 px-3 py-2">
                              <div className="flex items-start justify-between gap-3">
                                <div className="text-sm font-semibold text-white">{item.name}</div>
                                <div className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-text-secondary">
                                  {item.category}
                                </div>
                              </div>
                              <div className="mt-1 text-[11px] text-text-secondary">
                                {item.calories} kcal | P {item.protein}g | C {item.carbs}g | F {item.fat}g
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {activeView === 'activity' && (
              <div className="space-y-3">
                <Card className="border border-white/5 bg-[#14181f] p-4">
                  <h3 className="mb-3 text-sm font-semibold text-white">Hydration</h3>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-xl bg-white/5 p-2.5">
                      <div className="text-text-secondary">Daily water</div>
                      <div className="mt-1 text-sm font-semibold text-white">{toLitersLabel(plan.hydration.recommendedWaterMl)}</div>
                    </div>
                    <div className="rounded-xl bg-white/5 p-2.5">
                      <div className="text-text-secondary">From foods</div>
                      <div className="mt-1 text-sm font-semibold text-white">{toLitersLabel(plan.hydration.waterFromFoodsMl)}</div>
                    </div>
                    <div className="rounded-xl bg-white/5 p-2.5">
                      <div className="text-text-secondary">Drink directly</div>
                      <div className="mt-1 text-sm font-semibold text-white">{toLitersLabel(plan.hydration.remainingWaterMl)}</div>
                    </div>
                  </div>
                </Card>

                <Card className="border border-white/5 bg-[#14181f] p-4">
                  <h3 className="mb-3 text-sm font-semibold text-white">Daily Totals</h3>
                  <div className="space-y-2">
                    <div>
                      <div className="mb-1 flex justify-between text-[11px] text-text-secondary">
                        <span>Calories planned</span>
                        <span className="text-white">{plan.totals.calories} / {plan.targets.calories}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.min(calorieProgress, 100)}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between text-[11px] text-text-secondary">
                        <span>Protein planned</span>
                        <span className="text-white">{plan.totals.protein}g / {plan.targets.protein}g</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.min(proteinProgress, 100)}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-white/5 p-2 text-text-secondary">Carbs <span className="font-semibold text-white">{plan.totals.carbs} g</span></div>
                    <div className="rounded-lg bg-white/5 p-2 text-text-secondary">Fat <span className="font-semibold text-white">{plan.totals.fat} g</span></div>
                    <div className="rounded-lg bg-white/5 p-2 text-text-secondary">Fiber <span className="font-semibold text-white">{plan.totals.fiber} g</span></div>
                    <div className="rounded-lg bg-white/5 p-2 text-text-secondary">Sodium <span className="font-semibold text-white">{plan.totals.sodium} mg</span></div>
                  </div>
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

