import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Header } from '../components/ui/Header';
import { Card } from '../components/ui/Card';
import { api } from '../services/api';
import { getNutritionInputsOverride, NUTRITION_INPUTS_UPDATED_EVENT } from '../services/nutritionOverrides';
import { getActiveLanguage, getStoredLanguage } from '../services/language';
import { NutritionHealthOnboarding, type NutritionHealthOnboardingPayload } from '../components/nutrition/NutritionHealthOnboarding';
import { NutritionOverview, type NutritionPlan } from '../components/nutrition/NutritionOverview';

interface MyNutritionProps {
  onBack: () => void;
}

type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very';

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

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const isGirlsStyleValue = (value: unknown) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'woman' || normalized === 'female' || normalized === 'f' || normalized === 'girls' || normalized === 'femme';
};

const readStoredStyleGender = () => {
  try {
    return String(localStorage.getItem('appStyleGender') || '').trim().toLowerCase();
  } catch {
    return '';
  }
};

const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

const readOnboardingProfile = (user: any) => {
  const rawProfile = user?.onboarding_profile || user?.onboardingProfile;
  if (!rawProfile) return {};
  if (typeof rawProfile === 'object') return rawProfile;
  try {
    return JSON.parse(String(rawProfile));
  } catch {
    return {};
  }
};

const shouldUseGirlsTheme = () => {
  const styleGender = readStoredStyleGender();
  if (styleGender) return isGirlsStyleValue(styleGender);
  const user = readStoredUser();
  const profile = readOnboardingProfile(user);
  return isGirlsStyleValue(user?.gender) || isGirlsStyleValue(profile?.gender) || profile?.onboardingTheme === 'girls';
};

export function MyNutrition({ onBack }: MyNutritionProps) {
  const [language, setLanguage] = useState(() => getActiveLanguage(getStoredLanguage()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState<NutritionPlan | null>(null);
  const [goalLabel, setGoalLabel] = useState('General Fitness');
  const [tdee, setTdee] = useState<number | null>(null);
  const [hydrationLoggedMl, setHydrationLoggedMl] = useState(0);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [savingOnboarding, setSavingOnboarding] = useState(false);
  const [onboardingError, setOnboardingError] = useState('');
  const [addingHydration, setAddingHydration] = useState(false);
  const [hydrationError, setHydrationError] = useState('');
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [themeRefreshKey, setThemeRefreshKey] = useState(0);
  const userId = useMemo(() => getCurrentUserId(), []);
  const isGirlsTheme = useMemo(() => shouldUseGirlsTheme(), [themeRefreshKey]);
  void language;

  useEffect(() => {
    const handleLanguageChanged = () => setLanguage(getStoredLanguage());
    window.addEventListener('app-language-changed', handleLanguageChanged);
    window.addEventListener('storage', handleLanguageChanged);
    return () => {
      window.removeEventListener('app-language-changed', handleLanguageChanged);
      window.removeEventListener('storage', handleLanguageChanged);
    };
  }, []);

  useEffect(() => {
    const refresh = () => setRefreshSeed((current) => current + 1);
    window.addEventListener(NUTRITION_INPUTS_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener(NUTRITION_INPUTS_UPDATED_EVENT, refresh);
    };
  }, []);

  useEffect(() => {
    const refreshTheme = () => setThemeRefreshKey((current) => current + 1);
    window.addEventListener('repset:stored-user-changed', refreshTheme);
    window.addEventListener('repset:app-style-gender-changed', refreshTheme);
    window.addEventListener('storage', refreshTheme);
    return () => {
      window.removeEventListener('repset:stored-user-changed', refreshTheme);
      window.removeEventListener('repset:app-style-gender-changed', refreshTheme);
      window.removeEventListener('storage', refreshTheme);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const buildNutritionContext = (profile: any, program: any) => {
      const persistedOverride = userId ? getNutritionInputsOverride(userId) : null;
      const age = Number((persistedOverride?.age ?? profile?.age) || 0);
      const weightKg = Number((persistedOverride?.weightKg ?? profile?.weightKg) || 0);
      const heightCm = Number((persistedOverride?.heightCm ?? profile?.heightCm) || 0);

      if (!(age > 0 && weightKg > 0 && heightCm > 0)) return null;

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
      const targetCalories = Math.max(1200, Math.round(computedTdee + getCaloriesDelta(goalRaw)));
      const targetProtein = Math.max(60, Math.round(weightKg * getProteinMultiplier(goalRaw)));
      const targetFat = Math.max(40, Math.round((targetCalories * 0.27) / 9));
      const targetCarbs = Math.max(50, Math.round((targetCalories - (targetProtein * 4) - (targetFat * 9)) / 4));
      const waterLiters = clamp(
        (weightKg * 0.035) + getWaterActivityBonusLiters(activity) + getWaterGoalBonusLiters(goalRaw),
        1.8,
        6.0,
      );

      return {
        goalRaw,
        computedTdee,
        request: {
          userId,
          targetCalories,
          targetProtein,
          targetCarbs,
          targetFat,
          targetWaterMl: Math.round(waterLiters * 1000),
          goal: goalRaw,
        },
      };
    };

    const loadNutrition = async () => {
      setLoading(true);
      setError('');
      if (!userId) {
        setError('No active user session found. Please login again.');
        setLoading(false);
        return;
      }

      try {
        const [nutritionProfile, profile, program] = await Promise.all([
          api.getNutritionProfile(),
          api.getProfileDetails(userId),
          api.getUserProgram(userId).catch(() => null),
        ]);
        if (cancelled) return;

        setOnboardingComplete(Boolean(nutritionProfile?.completed));
        setHydrationLoggedMl(Number(nutritionProfile?.hydration?.loggedMl || 0));

        const nutritionContext = buildNutritionContext(profile, program);
        if (!nutritionContext) {
          setPlan(null);
          setError('Missing profile data (age, weight, height). Update profile details to generate automatic nutrition.');
          setLoading(false);
          return;
        }

        const dailyPlan = await api.getDailyNutritionPlan(nutritionContext.request);
        if (cancelled) return;

        setPlan(dailyPlan as NutritionPlan);
        setGoalLabel(formatGoalLabel(nutritionContext.goalRaw));
        setTdee(nutritionContext.computedTdee);
      } catch (loadError: unknown) {
        if (!cancelled) {
          setPlan(null);
          setError(loadError instanceof Error ? loadError.message : 'Failed to load Nutrition.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadNutrition();
    return () => {
      cancelled = true;
    };
  }, [refreshSeed, userId]);

  const saveOnboarding = async (payload: NutritionHealthOnboardingPayload) => {
    try {
      setSavingOnboarding(true);
      setOnboardingError('');
      await api.saveNutritionProfile(payload);
      setOnboardingComplete(true);
      setRefreshSeed((current) => current + 1);
    } catch (saveError: unknown) {
      setOnboardingError(saveError instanceof Error ? saveError.message : 'Failed to save nutrition profile.');
    } finally {
      setSavingOnboarding(false);
    }
  };

  const addHydration = async (amountMl: number) => {
    try {
      setAddingHydration(true);
      setHydrationError('');
      const result = await api.addHydration({ amountMl, drinkType: 'water' });
      setHydrationLoggedMl(Number(result?.hydration?.loggedMl || 0));
    } catch (addError: unknown) {
      setHydrationError(addError instanceof Error ? addError.message : 'Failed to log hydration.');
    } finally {
      setAddingHydration(false);
    }
  };

  if (onboardingComplete === false && !loading) {
    return (
      <div className={`min-h-screen ${isGirlsTheme ? 'bg-[#FFF5F5] text-[#4A4A4A]' : 'bg-background text-white'}`}>
        <div className="px-4 pt-2 sm:px-6">
          <Header title="My Nutrition" onBack={onBack} />
        </div>
        <NutritionHealthOnboarding saving={savingOnboarding} error={onboardingError} onComplete={saveOnboarding} />
      </div>
    );
  }

  return (
    <div className={`min-h-screen pb-24 text-left ${isGirlsTheme ? 'bg-[#FFF5F5] text-[#4A4A4A]' : 'bg-background text-white'}`}>
      <div className="px-4 pt-2 sm:px-6">
        <Header title="My Nutrition" onBack={onBack} />
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] sm:px-6">
        {loading ? (
          <Card className="border border-white/10 bg-[#0d131c] p-5">
            <div className="flex items-center gap-3 text-sm text-text-secondary">
              <RefreshCw className="animate-spin text-cyan-300" size={18} />
              Loading your visual nutrition dashboard...
            </div>
          </Card>
        ) : null}

        {!loading && error ? (
          <Card className="border border-red-400/30 bg-red-500/10 p-5">
            <div className="text-sm text-red-200">{error}</div>
            <button
              type="button"
              onClick={() => setRefreshSeed((current) => current + 1)}
              className="mt-4 rounded-xl bg-red-200 px-4 py-2 text-xs font-black text-red-950"
            >
              Try again
            </button>
          </Card>
        ) : null}

        {!loading && plan ? (
          <NutritionOverview
            plan={plan}
            goalLabel={goalLabel}
            tdee={tdee}
            hydrationLoggedMl={hydrationLoggedMl}
            addingHydration={addingHydration}
            hydrationError={hydrationError}
            onAddHydration={addHydration}
            themeVariant={isGirlsTheme ? 'girls' : 'default'}
          />
        ) : null}
      </div>
    </div>
  );
}
