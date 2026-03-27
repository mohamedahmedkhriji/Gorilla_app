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
import { AppLanguage, getActiveLanguage, getStoredLanguage } from '../services/language';
import { offlineCacheKeys, readOfflineCacheValue } from '../services/offlineCache';

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

const NUTRITION_I18N = {
  en: {
    title: 'My Nutrition',
    today: 'Today',
    remaining: 'Remaining',
    over: 'Over',
    baseGoal: 'Base Goal',
    food: 'Food',
    exercise: 'Exercise',
    goalPrefix: 'Goal',
    tdee: 'TDEE',
    carbs: 'Carbs',
    protein: 'Protein',
    fat: 'Fat',
    meals: 'Meals',
    activity: 'Activity',
    hydration: 'Hydration',
    dailyTotals: 'Daily Totals',
    dailyWater: 'Daily water',
    fromFoods: 'From foods',
    drinkDirectly: 'Drink directly',
    caloriesPlanned: 'Calories planned',
    proteinPlanned: 'Protein planned',
    fiber: 'Fiber',
    sodium: 'Sodium',
    loadingPlan: 'Building your daily food plan...',
    noSession: 'No active user session found. Please login again.',
    missingProfile: 'Missing profile data (age, weight, height). Update profile details to generate automatic nutrition.',
    loadFailed: 'Failed to build nutrition plan.',
    generalFitness: 'General Fitness',
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    snack: (n: number) => `Snack ${n}`,
  },
  ar: {
    title: '\u062a\u063a\u0630\u064a\u062a\u064a',
    today: '\u0627\u0644\u064a\u0648\u0645',
    remaining: '\u0645\u062a\u0628\u0642\u064a',
    over: '\u0641\u0627\u0626\u0636',
    baseGoal: '\u0627\u0644\u0647\u062f\u0641 \u0627\u0644\u0623\u0633\u0627\u0633\u064a',
    food: '\u0627\u0644\u0637\u0639\u0627\u0645',
    exercise: '\u0627\u0644\u062a\u0645\u0631\u064a\u0646',
    goalPrefix: '\u0627\u0644\u0647\u062f\u0641',
    tdee: '\u0645\u0639\u062f\u0644 \u0627\u0644\u062d\u0631\u0642 \u0627\u0644\u064a\u0648\u0645\u064a',
    carbs: '\u0627\u0644\u0643\u0631\u0628\u0648\u0647\u064a\u062f\u0631\u0627\u062a',
    protein: '\u0627\u0644\u0628\u0631\u0648\u062a\u064a\u0646',
    fat: '\u0627\u0644\u062f\u0647\u0648\u0646',
    meals: '\u0627\u0644\u0648\u062c\u0628\u0627\u062a',
    activity: '\u0627\u0644\u0646\u0634\u0627\u0637',
    hydration: '\u0627\u0644\u062a\u0631\u0637\u064a\u0628',
    dailyTotals: '\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a\u0627\u062a \u0627\u0644\u064a\u0648\u0645\u064a\u0629',
    dailyWater: '\u0627\u0644\u0645\u0627\u0621 \u0627\u0644\u064a\u0648\u0645\u064a',
    fromFoods: '\u0645\u0646 \u0627\u0644\u0637\u0639\u0627\u0645',
    drinkDirectly: '\u0627\u0634\u0631\u0628 \u0645\u0628\u0627\u0634\u0631\u0629',
    caloriesPlanned: '\u0627\u0644\u0633\u0639\u0631\u0627\u062a \u0627\u0644\u0645\u062e\u0637\u0637\u0629',
    proteinPlanned: '\u0627\u0644\u0628\u0631\u0648\u062a\u064a\u0646 \u0627\u0644\u0645\u062e\u0637\u0637',
    fiber: '\u0627\u0644\u0623\u0644\u064a\u0627\u0641',
    sodium: '\u0627\u0644\u0635\u0648\u062f\u064a\u0648\u0645',
    loadingPlan: '\u062c\u0627\u0631\u064d \u0625\u0639\u062f\u0627\u062f \u062e\u0637\u0629 \u0627\u0644\u0637\u0639\u0627\u0645 \u0627\u0644\u064a\u0648\u0645\u064a\u0629...',
    noSession: '\u0644\u0627 \u062a\u0648\u062c\u062f \u062c\u0644\u0633\u0629 \u0645\u0633\u062a\u062e\u062f\u0645 \u0646\u0634\u0637\u0629. \u064a\u0631\u062c\u0649 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649.',
    missingProfile: '\u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0634\u062e\u0635\u064a \u0646\u0627\u0642\u0635\u0629 (\u0627\u0644\u0639\u0645\u0631\u060c \u0627\u0644\u0648\u0632\u0646\u060c \u0627\u0644\u0637\u0648\u0644). \u062d\u062f\u0651\u062b \u0628\u064a\u0627\u0646\u0627\u062a\u0643 \u0644\u0625\u0646\u0634\u0627\u0621 \u062e\u0637\u0629 \u0627\u0644\u062a\u063a\u0630\u064a\u0629.',
    loadFailed: '\u062a\u0639\u0630\u0631 \u0625\u0646\u0634\u0627\u0621 \u062e\u0637\u0629 \u0627\u0644\u062a\u063a\u0630\u064a\u0629.',
    generalFitness: '\u0644\u064a\u0627\u0642\u0629 \u0639\u0627\u0645\u0629',
    breakfast: '\u0627\u0644\u0625\u0641\u0637\u0627\u0631',
    lunch: '\u0627\u0644\u063a\u062f\u0627\u0621',
    dinner: '\u0627\u0644\u0639\u0634\u0627\u0621',
    snack: (n: number) => `\u0648\u062c\u0628\u0629 \u062e\u0641\u064a\u0641\u0629 ${n}`,
  },
  it: {
    title: 'La Mia Nutrizione',
    today: 'Oggi',
    remaining: 'Rimanenti',
    over: 'Oltre',
    baseGoal: 'Obiettivo base',
    food: 'Cibo',
    exercise: 'Esercizio',
    goalPrefix: 'Obiettivo',
    tdee: 'TDEE',
    carbs: 'Carboidrati',
    protein: 'Proteine',
    fat: 'Grassi',
    meals: 'Pasti',
    activity: 'Attivita',
    hydration: 'Idratazione',
    dailyTotals: 'Totali giornalieri',
    dailyWater: 'Acqua giornaliera',
    fromFoods: 'Dagli alimenti',
    drinkDirectly: 'Da bere',
    caloriesPlanned: 'Calorie pianificate',
    proteinPlanned: 'Proteine pianificate',
    fiber: 'Fibre',
    sodium: 'Sodio',
    loadingPlan: 'Sto preparando il tuo piano alimentare giornaliero...',
    noSession: 'Nessuna sessione utente attiva trovata. Effettua di nuovo l accesso.',
    missingProfile: 'Dati profilo mancanti (eta, peso, altezza). Aggiorna il profilo per generare la nutrizione automatica.',
    loadFailed: 'Impossibile creare il piano nutrizionale.',
    generalFitness: 'Fitness generale',
    breakfast: 'Colazione',
    lunch: 'Pranzo',
    dinner: 'Cena',
    snack: (n: number) => `Spuntino ${n}`,
  },
  de: {
    title: 'Meine Ernahrung',
    today: 'Heute',
    remaining: 'Ubrig',
    over: 'Daruber',
    baseGoal: 'Basisziel',
    food: 'Essen',
    exercise: 'Training',
    goalPrefix: 'Ziel',
    tdee: 'TDEE',
    carbs: 'Kohlenhydrate',
    protein: 'Protein',
    fat: 'Fett',
    meals: 'Mahlzeiten',
    activity: 'Aktivitat',
    hydration: 'Hydration',
    dailyTotals: 'Tagessummen',
    dailyWater: 'Taegliches Wasser',
    fromFoods: 'Aus Lebensmitteln',
    drinkDirectly: 'Direkt trinken',
    caloriesPlanned: 'Geplante Kalorien',
    proteinPlanned: 'Geplantes Protein',
    fiber: 'Ballaststoffe',
    sodium: 'Natrium',
    loadingPlan: 'Dein taeglicher Ernahrungsplan wird erstellt...',
    noSession: 'Keine aktive Benutzersitzung gefunden. Bitte melde dich erneut an.',
    missingProfile: 'Profildaten fehlen (Alter, Gewicht, Groesse). Aktualisiere dein Profil, um die automatische Ernahrung zu erstellen.',
    loadFailed: 'Ernaehrungsplan konnte nicht erstellt werden.',
    generalFitness: 'Allgemeine Fitness',
    breakfast: 'Fruehstueck',
    lunch: 'Mittagessen',
    dinner: 'Abendessen',
    snack: (n: number) => `Snack ${n}`,
  },
} as const;

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
  const [language, setLanguage] = useState<AppLanguage>(() => getActiveLanguage(getStoredLanguage()));
  const isArabic = language === 'ar';
  const legacyCopy = {
    title: isArabic ? 'تغذيتي' : 'My Nutrition',
    today: isArabic ? 'اليوم' : 'Today',
    remaining: isArabic ? 'متبقي' : 'Remaining',
    over: isArabic ? 'فائض' : 'Over',
    baseGoal: isArabic ? 'الهدف الأساسي' : 'Base Goal',
    food: isArabic ? 'الطعام' : 'Food',
    exercise: isArabic ? 'التمرين' : 'Exercise',
    goalPrefix: isArabic ? 'الهدف' : 'Goal',
    tdee: isArabic ? 'معدل الحرق اليومي' : 'TDEE',
    carbs: isArabic ? 'الكربوهيدرات' : 'Carbs',
    protein: isArabic ? 'البروتين' : 'Protein',
    fat: isArabic ? 'الدهون' : 'Fat',
    meals: isArabic ? 'الوجبات' : 'Meals',
    activity: isArabic ? 'النشاط' : 'Activity',
    hydration: isArabic ? 'الترطيب' : 'Hydration',
    dailyTotals: isArabic ? 'الإجماليات اليومية' : 'Daily Totals',
    dailyWater: isArabic ? 'الماء اليومي' : 'Daily water',
    fromFoods: isArabic ? 'من الطعام' : 'From foods',
    drinkDirectly: isArabic ? 'اشرب مباشرة' : 'Drink directly',
    caloriesPlanned: isArabic ? 'السعرات المخططة' : 'Calories planned',
    proteinPlanned: isArabic ? 'البروتين المخطط' : 'Protein planned',
    fiber: isArabic ? 'الألياف' : 'Fiber',
    sodium: isArabic ? 'الصوديوم' : 'Sodium',
    loadingPlan: isArabic ? 'جارٍ إعداد خطة الطعام اليومية...' : 'Building your daily food plan...',
    noSession: isArabic ? 'لا توجد جلسة مستخدم نشطة. يرجى تسجيل الدخول مرة أخرى.' : 'No active user session found. Please login again.',
    missingProfile: isArabic
      ? 'بيانات الملف الشخصي ناقصة (العمر، الوزن، الطول). حدّث بياناتك لإنشاء خطة التغذية.'
      : 'Missing profile data (age, weight, height). Update profile details to generate automatic nutrition.',
    loadFailed: isArabic ? 'تعذر إنشاء خطة التغذية.' : 'Failed to build nutrition plan.',
  };
  void legacyCopy;
  const copy = NUTRITION_I18N[language] || NUTRITION_I18N.en;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState<NutritionPlanResponse | null>(null);
  const [goalLabel, setGoalLabel] = useState('General Fitness');
  const [goalKey, setGoalKey] = useState('general_fitness');
  const [tdee, setTdee] = useState<number | null>(null);
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [activeView, setActiveView] = useState<NutritionView>('meals');
  const [expandedMeals, setExpandedMeals] = useState<Record<string, boolean>>({});
  const userId = useMemo(() => getCurrentUserId(), []);

  useEffect(() => {
    const handleLanguageChanged = () => {
      setLanguage(getStoredLanguage());
    };

    window.addEventListener('app-language-changed', handleLanguageChanged);
    window.addEventListener('storage', handleLanguageChanged);
    return () => {
      window.removeEventListener('app-language-changed', handleLanguageChanged);
      window.removeEventListener('storage', handleLanguageChanged);
    };
  }, []);

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

    const buildNutritionContext = (profile: any, program: any) => {
      const persistedOverride = getNutritionInputsOverride(userId);
      const age = Number((persistedOverride?.age ?? profile?.age) || 0);
      const weightKg = Number((persistedOverride?.weightKg ?? profile?.weightKg) || 0);
      const heightCm = Number((persistedOverride?.heightCm ?? profile?.heightCm) || 0);

      if (!(age > 0 && weightKg > 0 && heightCm > 0)) {
        return null;
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

      return {
        goalRaw,
        computedTdee,
        request: {
          userId,
          targetCalories,
          targetProtein,
          targetCarbs,
          targetFat,
          targetWaterMl,
          goal: goalRaw,
        },
      };
    };

    if (userId) {
      const cachedProfile = readOfflineCacheValue<any>(offlineCacheKeys.profileDetails(userId));
      const cachedProgram = readOfflineCacheValue<any>(offlineCacheKeys.userProgram(userId));
      const cachedContext = buildNutritionContext(cachedProfile, cachedProgram);
      if (cachedContext) {
        const cachedPlan = readOfflineCacheValue<NutritionPlanResponse>(
          offlineCacheKeys.dailyNutritionPlan(userId, cachedContext.request),
        );
        if (cachedPlan) {
          setPlan(cachedPlan);
          setGoalLabel(formatGoalLabel(cachedContext.goalRaw));
          setGoalKey(cachedContext.goalRaw);
          setTdee(cachedContext.computedTdee);
          setError('');
          setLoading(false);
        }
      }
    }

    const loadNutrition = async () => {
      setLoading(true);
      setError('');

      if (!userId) {
        setError(copy.noSession);
        setLoading(false);
        return;
      }

      try {
        const [profile, program] = await Promise.all([
          api.getProfileDetails(userId),
          api.getUserProgram(userId).catch(() => null),
        ]);

        if (cancelled) return;

        const nutritionContext = buildNutritionContext(profile, program);
        if (!nutritionContext) {
          setError(copy.missingProfile);
          setPlan(null);
          setLoading(false);
          return;
        }

        const dailyPlan = await api.getDailyNutritionPlan(nutritionContext.request);

        if (cancelled) return;
        setPlan(dailyPlan as NutritionPlanResponse);
        setGoalLabel(formatGoalLabel(nutritionContext.goalRaw));
        setGoalKey(nutritionContext.goalRaw);
        setTdee(nutritionContext.computedTdee);
      } catch (loadError: unknown) {
        const message = loadError instanceof Error ? loadError.message : copy.loadFailed;
        if (!cancelled) {
          setPlan(null);
          setError(language === 'en' ? message : copy.loadFailed);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadNutrition();
    return () => {
      cancelled = true;
    };
  }, [userId, refreshSeed, copy.loadFailed, copy.missingProfile, copy.noSession, language]);

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
      const slotKey = slot.toLowerCase();
      if (slotKey.includes('snack')) {
        snackNumber += 1;
        return isArabic ? `وجبة خفيفة ${snackNumber}` : `Snack ${snackNumber}`;
      }
      if (!isArabic) return slot;
      if (slotKey.includes('breakfast')) return 'الإفطار';
      if (slotKey.includes('lunch')) return 'الغداء';
      if (slotKey.includes('dinner')) return 'العشاء';
      return slot;
    });
  }, [isArabic, plan]);

  const goalDisplay = useMemo(() => {
    if (!isArabic) return goalLabel;
    const key = normalizeGoal(goalKey);
    if (!key) return 'لياقة عامة';
    if (key.includes('fat') || key.includes('loss')) return 'خسارة الدهون';
    if (key.includes('recomp')) return 'إعادة تركيب الجسم';
    if (key.includes('hypertrophy') || key.includes('muscle')) return 'بناء العضلات';
    if (key.includes('strength')) return 'زيادة القوة';
    if (key.includes('endurance')) return 'تحمل أعلى';
    return 'لياقة عامة';
  }, [goalKey, goalLabel, isArabic]);

  const translateCategory = (value: string) => {
    if (!isArabic) return value;
    const key = String(value || '').trim().toLowerCase();
    const categoryMap: Record<string, string> = {
      'meal/protein': 'وجبة/بروتين',
      'meal/carbs': 'وجبة/كربوهيدرات',
      'meal/fat': 'وجبة/دهون',
      'snack/protein': 'سناك/بروتين',
      'snack/carbs': 'سناك/كربوهيدرات',
      'snack/fat': 'سناك/دهون',
    };
    return categoryMap[key] ?? value;
  };

  const localizedMealTitles = useMemo(() => {
    if (!plan?.meals || language === 'en' || language === 'ar') return mealTitles;
    let snackNumber = 0;
    return plan.meals.map((meal, index) => {
      const slot = String(meal.slot || 'Meal');
      const slotKey = slot.toLowerCase();
      if (slotKey.includes('snack')) {
        snackNumber += 1;
        return copy.snack(snackNumber);
      }
      if (slotKey.includes('breakfast')) return copy.breakfast;
      if (slotKey.includes('lunch')) return copy.lunch;
      if (slotKey.includes('dinner')) return copy.dinner;
      return mealTitles[index] || slot;
    });
  }, [copy, language, mealTitles, plan]);

  const localizedGoalDisplay = useMemo(() => {
    if (language === 'en' || language === 'ar') return goalDisplay;
    const key = normalizeGoal(goalKey);
    if (!key) return copy.generalFitness;
    if (language === 'it') {
      if (key.includes('fat') || key.includes('loss')) return 'Perdita di grasso';
      if (key.includes('recomp')) return 'Ricomposizione corporea';
      if (key.includes('hypertrophy') || key.includes('muscle')) return 'Costruzione muscolare';
      if (key.includes('strength')) return 'Aumento della forza';
      if (key.includes('endurance')) return 'Maggiore resistenza';
      return copy.generalFitness;
    }
    if (key.includes('fat') || key.includes('loss')) return 'Fettverlust';
    if (key.includes('recomp')) return 'Koerperrekomposition';
    if (key.includes('hypertrophy') || key.includes('muscle')) return 'Muskelaufbau';
    if (key.includes('strength')) return 'Kraftaufbau';
    if (key.includes('endurance')) return 'Mehr Ausdauer';
    return copy.generalFitness;
  }, [copy.generalFitness, goalDisplay, goalKey, language]);

  const localizeCategory = (value: string) => {
    if (language === 'en' || language === 'ar') return translateCategory(value);
    const key = String(value || '').trim().toLowerCase();
    const categoryMap =
      language === 'it'
        ? {
            'meal/protein': 'Pasto/Proteine',
            'meal/carbs': 'Pasto/Carboidrati',
            'meal/fat': 'Pasto/Grassi',
            'snack/protein': 'Spuntino/Proteine',
            'snack/carbs': 'Spuntino/Carboidrati',
            'snack/fat': 'Spuntino/Grassi',
          }
        : {
            'meal/protein': 'Mahlzeit/Protein',
            'meal/carbs': 'Mahlzeit/Kohlenhydrate',
            'meal/fat': 'Mahlzeit/Fett',
            'snack/protein': 'Snack/Protein',
            'snack/carbs': 'Snack/Kohlenhydrate',
            'snack/fat': 'Snack/Fett',
          };
    return categoryMap[key as keyof typeof categoryMap] ?? value;
  };

  const toggleMeal = (mealKey: string) =>
    setExpandedMeals((prev) => ({ ...prev, [mealKey]: !prev[mealKey] }));

  return (
    <div className="flex-1 flex flex-col bg-background min-h-screen pb-24">
      <div className="px-4 sm:px-6 pt-2">
        <Header title={copy.title} onBack={onBack} />
      </div>

      <div className="px-4 sm:px-6 space-y-4 pb-4">
        {loading && (
          <Card className="border border-white/5 bg-card/80 p-4">
            <div className="text-sm text-text-secondary">{copy.loadingPlan}</div>
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
                <div className="text-center text-sm font-semibold text-text-secondary">{copy.today}</div>

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
                        {caloriesRemaining >= 0 ? copy.remaining : copy.over}
                      </div>
                    </div>
                  </CircularMeter>

                  <div className="min-w-0 space-y-2.5">
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-400/10">
                        <Flag size={13} className="text-cyan-400" />
                      </div>
                      <div className="leading-none">
                        <div className="text-xs text-text-secondary">{copy.baseGoal}</div>
                        <div className="mt-1 text-[30px] font-semibold tabular-nums text-white">{baseGoalCalories}</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-400/10">
                        <UtensilsCrossed size={13} className="text-cyan-400" />
                      </div>
                      <div className="leading-none">
                        <div className="text-xs text-text-secondary">{copy.food}</div>
                        <div className="mt-1 text-[30px] font-semibold tabular-nums text-white">{plan.totals.calories}</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-400/10">
                        <Dumbbell size={13} className="text-cyan-400" />
                      </div>
                      <div className="leading-none">
                        <div className="text-xs text-text-secondary">{copy.exercise}</div>
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
                  {copy.goalPrefix}: {localizedGoalDisplay}{tdee ? ` | ${copy.tdee} ${tdee} kcal` : ''}
                </div>
              </div>
            </Card>

            <Card className="border border-white/5 bg-[#14181f] p-4">
              <div className="grid grid-cols-3 gap-1">
                <div className="flex min-w-0 flex-col items-center gap-1.5">
                  <div className="text-sm font-semibold text-white">{copy.carbs}</div>
                  <CircularMeter value={plan.totals.carbs} max={plan.targets.carbs} size={64} strokeWidth={5} color="#14d3df">
                    <div className="text-sm font-bold tabular-nums text-white">{plan.totals.carbs}g</div>
                  </CircularMeter>
                </div>
                <div className="flex min-w-0 flex-col items-center gap-1.5">
                  <div className="text-sm font-semibold text-white">{copy.protein}</div>
                  <CircularMeter value={plan.totals.protein} max={plan.targets.protein} size={64} strokeWidth={5} color="#0ea5e9">
                    <div className="text-sm font-bold tabular-nums text-white">{plan.totals.protein}g</div>
                  </CircularMeter>
                </div>
                <div className="flex min-w-0 flex-col items-center gap-1.5">
                  <div className="text-sm font-semibold text-white">{copy.fat}</div>
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
                  {copy.meals}
                </button>
                <button
                  onClick={() => setActiveView('activity')}
                  className={`
                    flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition-colors
                    ${activeView === 'activity' ? 'bg-cyan-400 text-black' : 'text-text-secondary hover:text-white'}
                  `}>
                  <Flame size={15} />
                  {copy.activity}
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
                            {localizedMealTitles[index]}
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
                                  {localizeCategory(item.category)}
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
                  <h3 className="mb-3 text-sm font-semibold text-white">{copy.hydration}</h3>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-xl bg-white/5 p-2.5">
                      <div className="text-text-secondary">{copy.dailyWater}</div>
                      <div className="mt-1 text-sm font-semibold text-white">{toLitersLabel(plan.hydration.recommendedWaterMl)}</div>
                    </div>
                    <div className="rounded-xl bg-white/5 p-2.5">
                      <div className="text-text-secondary">{copy.fromFoods}</div>
                      <div className="mt-1 text-sm font-semibold text-white">{toLitersLabel(plan.hydration.waterFromFoodsMl)}</div>
                    </div>
                    <div className="rounded-xl bg-white/5 p-2.5">
                      <div className="text-text-secondary">{copy.drinkDirectly}</div>
                      <div className="mt-1 text-sm font-semibold text-white">{toLitersLabel(plan.hydration.remainingWaterMl)}</div>
                    </div>
                  </div>
                </Card>

                <Card className="border border-white/5 bg-[#14181f] p-4">
                  <h3 className="mb-3 text-sm font-semibold text-white">{copy.dailyTotals}</h3>
                  <div className="space-y-2">
                    <div>
                      <div className="mb-1 flex justify-between text-[11px] text-text-secondary">
                        <span>{copy.caloriesPlanned}</span>
                        <span className="text-white">{plan.totals.calories} / {plan.targets.calories}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.min(calorieProgress, 100)}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between text-[11px] text-text-secondary">
                        <span>{copy.proteinPlanned}</span>
                        <span className="text-white">{plan.totals.protein}g / {plan.targets.protein}g</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.min(proteinProgress, 100)}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-white/5 p-2 text-text-secondary">{copy.carbs} <span className="font-semibold text-white">{plan.totals.carbs} g</span></div>
                    <div className="rounded-lg bg-white/5 p-2 text-text-secondary">{copy.fat} <span className="font-semibold text-white">{plan.totals.fat} g</span></div>
                    <div className="rounded-lg bg-white/5 p-2 text-text-secondary">{copy.fiber} <span className="font-semibold text-white">{plan.totals.fiber} g</span></div>
                    <div className="rounded-lg bg-white/5 p-2 text-text-secondary">{copy.sodium} <span className="font-semibold text-white">{plan.totals.sodium} mg</span></div>
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

