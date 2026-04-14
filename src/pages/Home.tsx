import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, MoonStar } from 'lucide-react';
import { CoachmarkOverlay, type CoachmarkStep } from '../components/coachmarks/CoachmarkOverlay';
import { WorkoutCard } from '../components/dashboard/WorkoutCard';
import { RecoveryIndicator } from '../components/dashboard/RecoveryIndicator';
import { RankDisplay } from '../components/dashboard/RankDisplay';
import { GhostButton } from '../components/ui/GhostButton';
import { CalculatorCard } from '../components/home/CalculatorCard';
import { EducationSection } from '../components/home/EducationSection';
import { FriendsList, FriendMember } from './FriendsList';
import { FriendProfile } from './FriendProfile';
import { CoachList } from './CoachList';
import { Messaging } from './Messaging';
import { Calculator } from './Calculator';
import { ExerciseLibrary } from './ExerciseLibrary';
import { BooksLibrary } from './BooksLibrary';
import { MyNutrition } from './MyNutrition';
import { ExerciseVideoScreen } from '../components/workout/ExerciseVideoScreen';
import { MuscleRecoveryScreen } from '../components/progress/MuscleRecoveryScreen';
import { RankingsRewardsScreen } from '../components/profile/RankingsRewardsScreen';
import { FriendChallengeScreen } from '../components/profile/FriendChallengeScreen';
import { api } from '../services/api';
import {
  getCoachmarkUserScope,
  HOME_COACHMARK_TOUR_ID,
  HOME_COACHMARK_VERSION,
  incrementCoachmarkVisitCount,
  patchCoachmarkProgress,
  readCoachmarkProgress,
} from '../services/coachmarks';
import { getRankBadgeImage } from '../services/rankTheme';
import { emojiComingSoon, emojiMyNutrition, emojiProfile, emojiRightArrow, emojiShop } from '../services/emojiTheme';
import { AppLanguage, getActiveLanguage, pickLanguage } from '../services/language';
import { formatWorkoutDayLabel, normalizeWorkoutDayKey } from '../services/workoutDayLabel';
import {
  clearTodayWorkoutSelection,
  readTodayWorkoutSelection,
  TODAY_WORKOUT_SELECTION_UPDATED_EVENT,
  type TodayWorkoutSelection,
} from '../services/todayWorkoutSelection';
import { offlineCacheKeys, readOfflineCacheValue } from '../services/offlineCache';
import { OPEN_PICKED_WORKOUT_PLAN } from '../services/workoutNavigation';
import { normalizeGamificationSummary } from '../services/gamificationEvents';
import type { GamificationSummaryResponse } from '../types/gamification';
import { useScrollToTopOnChange } from '../shared/scroll';
import { ScreenSection, ScreenTransition, getNavigationDirection } from '../components/ui/ScreenTransition';
import { HOME_CARD_OVERLAY_CLASS } from '../components/home/homeCardStyles';
interface HomeProps {
  onNavigate: (tab: string, day?: string) => void;
  onTabBarVisibilityChange?: (visible: boolean) => void;
  resetSignal?: number;
  guidedTourActive?: boolean;
  onGuidedTourComplete?: () => void;
  onGuidedTourDismiss?: () => void;
}

const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

const toScopePart = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '_');

const getUserStorageScope = (user: any) => {
  const userId = Number(user?.id || 0);
  if (Number.isInteger(userId) && userId > 0) return `id_${userId}`;

  const email = toScopePart(user?.email);
  if (email) return `email_${email}`;

  const phone = toScopePart(user?.phone);
  if (phone) return `phone_${phone}`;

  const name = toScopePart(user?.name);
  if (name) return `name_${name}`;

  return 'guest';
};

const getWorkoutStorageKeys = (user: any) => {
  const scope = getUserStorageScope(user);
  return {
    workoutDate: `workoutDate:${scope}`,
    completedExercises: `completedExercises:${scope}`,
    exerciseSets: `exerciseSets:${scope}`,
    extraExercises: `extraExercises:${scope}`,
    exerciseCount: `exerciseCount:${scope}`,
    exerciseSnapshot: `exerciseSnapshot:${scope}`,
  };
};

const getHomeMetricStorageKeys = (user: any) => {
  const scope = getUserStorageScope(user);
  return {
    homeRecovery: `homeRecovery:${scope}`,
    homeWorkoutProgress: `homeWorkoutProgress:${scope}`,
  };
};

const clampPercent = (value: unknown) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

const readCachedPercent = (key: string, fallback: number) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return fallback;
    return clampPercent(parsed);
  } catch {
    return fallback;
  }
};

const getExerciseName = (exercise: any) =>
  String(exercise?.exerciseName || exercise?.exercise_name || exercise?.name || '').trim();

const getExercisePlannedSets = (exercise: any) => {
  const raw = Number(
    exercise?.sets
    ?? exercise?.targetSets
    ?? exercise?.target_sets
    ?? exercise?.setCount
    ?? 0,
  );
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
};

const isSetCompleted = (setRow: any) =>
  !!(
    setRow?.completed
    ?? setRow?.isCompleted
    ?? setRow?.done
    ?? false
  );

const parseWorkoutExercises = (raw: unknown) => {
  if (Array.isArray(raw)) return raw;

  if (typeof raw !== 'string' || !raw.trim()) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const parseTargetMuscles = (raw: unknown): string[] => {
  if (Array.isArray(raw)) {
    return raw
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
  }

  if (typeof raw === 'string') {
    const text = raw.trim();
    if (!text) return [];

    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed
          .map((entry) => String(entry || '').trim())
          .filter(Boolean);
      }
      if (typeof parsed === 'string' && parsed.trim()) return [parsed.trim()];
    } catch {
      return text
        .split(/[,;|]+/)
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
  }

  return [];
};

const normalizeTodayWorkoutExercises = (raw: unknown) => {
  const exercises = parseWorkoutExercises(raw);

  return exercises
    .map((exercise: any) => ({
      ...exercise,
      exerciseName: String(
        exercise?.exerciseName
        || exercise?.exercise_name
        || exercise?.name
        || '',
      ).trim(),
      name: String(
        exercise?.name
        || exercise?.exerciseName
        || exercise?.exercise_name
        || '',
      ).trim(),
      targetMuscles: parseTargetMuscles(
        exercise?.targetMuscles
        ?? exercise?.muscleTargets
        ?? exercise?.muscles,
      ),
      muscleGroup: String(exercise?.muscleGroup || exercise?.muscle_group || '').trim(),
      sets: Number(
        exercise?.sets
        ?? exercise?.targetSets
        ?? exercise?.target_sets
        ?? 0,
      ) || 0,
      reps: String(
        exercise?.reps
        ?? exercise?.targetReps
        ?? exercise?.target_reps
        ?? '',
      ).trim(),
      rest: Number(
        exercise?.rest
        ?? exercise?.restSeconds
        ?? exercise?.rest_seconds
        ?? 0,
      ) || 0,
    }))
    .filter((exercise: any) => exercise.exerciseName || exercise.name);
};

const getWeekdayIndex = (value: unknown) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .slice(0, 3);

  const map: Record<string, number> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
  };

  return Number.isInteger(map[normalized]) ? map[normalized] : null;
};

const resolveTodayWorkoutPayload = (programData: any, weeklyWorkouts: any[]) => {
  if (String(programData?.missedTodayWorkoutName || '').trim()) {
    return null;
  }

  const todayWorkout = programData?.todayWorkout || null;
  const normalizedWeeklyWorkouts = Array.isArray(weeklyWorkouts) ? weeklyWorkouts : [];
  const clientWeekdayIndex = new Date().getDay();
  const scheduleHasWeekdays = normalizedWeeklyWorkouts.some(
    (workout: any) => getWeekdayIndex(workout?.day_name) !== null,
  );
  const weeklyWorkoutByClientDay = normalizedWeeklyWorkouts.find(
    (workout: any) => getWeekdayIndex(workout?.day_name) === clientWeekdayIndex,
  ) || null;

  if (!weeklyWorkoutByClientDay && scheduleHasWeekdays) {
    return null;
  }

  const todayWorkoutWeekday = getWeekdayIndex(todayWorkout?.dayName);
  const canUseTodayPayload = !!(
    todayWorkout
    && (
      todayWorkoutWeekday === null
      || todayWorkoutWeekday === clientWeekdayIndex
      || !scheduleHasWeekdays
    )
  );

  const resolvedWorkout = weeklyWorkoutByClientDay || null;
  const weeklyExercises = normalizeTodayWorkoutExercises(resolvedWorkout?.exercises);
  const directExercises = canUseTodayPayload
    ? normalizeTodayWorkoutExercises(todayWorkout?.exercises)
    : [];
  const resolvedExercises = weeklyExercises.length >= directExercises.length
    ? weeklyExercises
    : directExercises;

  const workoutName = String(
    resolvedWorkout?.workout_name
    || (canUseTodayPayload ? todayWorkout?.name : '')
    || '',
  ).trim();

  if (!workoutName) return null;

  return {
    workout_name: workoutName,
    workout_type: String(
      resolvedWorkout?.workout_type
      || (canUseTodayPayload ? todayWorkout?.workoutType : '')
      || '',
    ).trim(),
    estimated_duration_minutes:
      Number(
        resolvedWorkout?.estimated_duration_minutes
        ?? (canUseTodayPayload ? (todayWorkout?.estimatedDurationMinutes ?? todayWorkout?.estimated_duration_minutes) : 0)
        ?? 0,
      ) || null,
    exercises: resolvedExercises,
  };
};

type WeekPlanWorkoutChoice = {
  key: string;
  workoutName: string;
  workoutType: string;
  estimatedDurationMinutes: number | null;
  exercises: any[];
  dayLabel: string;
  dayOrder: number;
};

const resolveWeekPlanWorkoutName = (raw: unknown, exercises: any[]) => {
  const trimmed = String(raw || '').trim();
  if (trimmed) return trimmed;

  const muscles = exercises
    .flatMap((exercise: any) => parseTargetMuscles(exercise?.targetMuscles ?? exercise?.muscles ?? exercise?.muscleGroup))
    .map((entry) => String(entry || '').trim().toLowerCase());

  if (muscles.some((muscle) => ['chest', 'triceps', 'shoulders'].includes(muscle))) return 'Push Day';
  if (muscles.some((muscle) => ['back', 'biceps', 'forearms'].includes(muscle))) return 'Pull Day';
  if (muscles.some((muscle) => ['quadriceps', 'hamstrings', 'glutes', 'calves'].includes(muscle))) return 'Leg Day';
  return 'Workout';
};

const buildWeekPlanWorkoutChoices = (weeklyWorkouts: any[]): WeekPlanWorkoutChoice[] =>
  (Array.isArray(weeklyWorkouts) ? weeklyWorkouts : [])
    .map((workout: any, index: number) => {
      const exercises = normalizeTodayWorkoutExercises(workout?.exercises);
      const dayKey = normalizeWorkoutDayKey(workout?.day_name);
      const workoutName = resolveWeekPlanWorkoutName(workout?.workout_name, exercises);
      const estimatedDurationMinutes =
        Number(workout?.estimated_duration_minutes ?? workout?.estimatedDurationMinutes ?? 0) || null;

      return {
        key: String(workout?.id || `${dayKey || 'day'}-${index}`),
        workoutName,
        workoutType: String(workout?.workout_type || '').trim(),
        estimatedDurationMinutes,
        exercises,
        dayLabel: formatWorkoutDayLabel(dayKey, `Day ${Number(workout?.day_order || index + 1)}`),
        dayOrder: Number(workout?.day_order || index + 1) || (index + 1),
      };
    })
    .sort((left, right) => left.dayOrder - right.dayOrder);

const findNextWeekPlanWorkoutChoice = (
  workouts: WeekPlanWorkoutChoice[],
  currentWorkoutKey?: string | null,
) => {
  if (!Array.isArray(workouts) || workouts.length === 0) return null;
  if (!currentWorkoutKey) return workouts[0] || null;

  const currentIndex = workouts.findIndex((workout) => workout.key === currentWorkoutKey);
  if (currentIndex < 0) return workouts[0] || null;
  return workouts[currentIndex + 1] || null;
};

const loadTodayExtraExercises = (keys: { workoutDate: string; extraExercises: string }) => {
  const today = new Date().toDateString();
  const savedDate = localStorage.getItem(keys.workoutDate);
  if (savedDate && savedDate !== today) return [];

  try {
    const raw = localStorage.getItem(keys.extraExercises);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const loadTodayExerciseCount = (keys: { workoutDate: string; exerciseCount: string }) => {
  const today = new Date().toDateString();
  const savedDate = localStorage.getItem(keys.workoutDate);
  if (savedDate && savedDate !== today) return 0;

  try {
    const raw = Number(localStorage.getItem(keys.exerciseCount) || 0);
    return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 0;
  } catch {
    return 0;
  }
};

const loadTodayExerciseSnapshotState = (keys: { workoutDate: string; exerciseSnapshot: string }) => {
  const today = new Date().toDateString();
  const savedDate = localStorage.getItem(keys.workoutDate);
  if (savedDate && savedDate !== today) {
    return {
      exercises: [] as any[],
      hasSnapshot: false,
    };
  }

  try {
    const raw = localStorage.getItem(keys.exerciseSnapshot);
    if (raw === null) {
      return {
        exercises: [] as any[],
        hasSnapshot: false,
      };
    }

    const parsed = JSON.parse(raw);
    return {
      exercises: Array.isArray(parsed) ? parsed : [],
      hasSnapshot: true,
    };
  } catch {
    return {
      exercises: [] as any[],
      hasSnapshot: false,
    };
  }
};

const hasCoachmarkTargets = (steps: CoachmarkStep[]) =>
  typeof document !== 'undefined'
  && steps.every((step) => Boolean(document.querySelector(`[data-coachmark-target="${step.targetId}"]`)));

type HomeView =
'main' |
'friends' |
'friendProfile' |
'friendChallenge' |
'coachList' |
'chat' |
'calculator' |
'exercises' |
'books' |
'video' |
'recovery' |
'rank' |
'workoutDetail' |
'nutrition';

const HOME_VIEW_ORDER: HomeView[] = [
  'main',
  'workoutDetail',
  'nutrition',
  'friends',
  'friendProfile',
  'friendChallenge',
  'coachList',
  'chat',
  'calculator',
  'exercises',
  'video',
  'books',
  'recovery',
  'rank',
];
export function Home({
  onNavigate,
  onTabBarVisibilityChange,
  resetSignal = 0,
  guidedTourActive = false,
  onGuidedTourComplete,
  onGuidedTourDismiss,
}: HomeProps) {
  const currentUser = readStoredUser();
  const currentUserId = Number(currentUser?.id || 0);
  const workoutStorageScope = getUserStorageScope(currentUser);
  const workoutStorageKeys = getWorkoutStorageKeys(currentUser);
  const homeMetricKeys = getHomeMetricStorageKeys(currentUser);
  const todayKey = new Date().toDateString();

  const [view, setView] = useState<HomeView>('main');
  const [selectedExercise, setSelectedExercise] = useState<{
    name: string;
    muscle: string;
    video?: string | null;
    exerciseCatalogId?: number | null;
    targetMuscles?: string[];
    anatomy?: string | string[];
  } | null>(null);
  const [exerciseLibraryFilter, setExerciseLibraryFilter] = useState('All');
  const [selectedCoach, setSelectedCoach] = useState<{id: number, name: string} | null>(null);
  const [selectedFriend, setSelectedFriend] = useState<FriendMember | null>(null);
  const [greeting, setGreeting] = useState('');
  const [overallRecovery, setOverallRecovery] = useState(
    () => readCachedPercent(homeMetricKeys.homeRecovery, 100),
  );
  const [todayWorkout, setTodayWorkout] = useState('Push Day');
  const [userProgram, setUserProgram] = useState<any>(null);
  const [todayWorkoutData, setTodayWorkoutData] = useState<any>(null);
  const [weekPlanWorkouts, setWeekPlanWorkouts] = useState<WeekPlanWorkoutChoice[]>([]);
  const [gamificationSummary, setGamificationSummary] = useState<GamificationSummaryResponse | null>(null);
  const [todayWorkoutSelection, setTodayWorkoutSelection] = useState<TodayWorkoutSelection | null>(
    () => readTodayWorkoutSelection(workoutStorageScope),
  );
  const [workoutProgress, setWorkoutProgress] = useState(() => {
    const savedDate = localStorage.getItem(workoutStorageKeys.workoutDate);
    if (savedDate && savedDate !== todayKey) return 0;
    return readCachedPercent(homeMetricKeys.homeWorkoutProgress, 0);
  });
  const [programProgress, setProgramProgress] = useState<any>(null);
  const [isHomeLoading, setIsHomeLoading] = useState(true);
  const [showShopComingSoon, setShowShopComingSoon] = useState(false);
  const [extraTodayExercises, setExtraTodayExercises] = useState<any[]>(
    () => loadTodayExtraExercises(workoutStorageKeys),
  );
  const [storedTodayExerciseCount, setStoredTodayExerciseCount] = useState(
    () => loadTodayExerciseCount(workoutStorageKeys),
  );
  const [storedTodayExerciseSnapshot, setStoredTodayExerciseSnapshot] = useState<any[]>(
    () => loadTodayExerciseSnapshotState(workoutStorageKeys).exercises,
  );
  const [hasStoredTodayExerciseSnapshot, setHasStoredTodayExerciseSnapshot] = useState<boolean>(
    () => loadTodayExerciseSnapshotState(workoutStorageKeys).hasSnapshot,
  );
  const [language, setLanguage] = useState<AppLanguage>(() => getActiveLanguage());
  const [coachmarkMode, setCoachmarkMode] = useState<'main' | null>(null);
  const [coachmarkStepIndex, setCoachmarkStepIndex] = useState(0);
  const hasTrackedHomeVisitRef = useRef(false);
  const previousViewRef = useRef<HomeView>('main');

  useScrollToTopOnChange([view, resetSignal]);

  useEffect(() => {
    onTabBarVisibilityChange?.(view !== 'friendChallenge');

    return () => {
      onTabBarVisibilityChange?.(true);
    };
  }, [onTabBarVisibilityChange, view]);

  useEffect(() => {
    const handleLanguageChanged = () => {
      setLanguage(getActiveLanguage());
    };

    handleLanguageChanged();
    window.addEventListener('app-language-changed', handleLanguageChanged);
    return () => window.removeEventListener('app-language-changed', handleLanguageChanged);
  }, []);

  useEffect(() => {
    previousViewRef.current = view;
  }, [view]);

  const selectedTodayWorkout = useMemo(
    () => weekPlanWorkouts.find((workout) => workout.key === todayWorkoutSelection?.workoutKey) || null,
    [todayWorkoutSelection?.workoutKey, weekPlanWorkouts],
  );
  const nextRecommendedWorkout = useMemo(
    () => findNextWeekPlanWorkoutChoice(weekPlanWorkouts, todayWorkoutSelection?.workoutKey),
    [todayWorkoutSelection?.workoutKey, weekPlanWorkouts],
  );
  const shouldChooseWorkoutToday = !!(weekPlanWorkouts.length && !todayWorkoutSelection?.workoutKey);
  const shouldSuggestRecoveryFirst = !!(
    todayWorkoutSelection?.completed
    && Number(overallRecovery || 0) < 60
  );
  const restDayLabel = pickLanguage(language, {
    en: 'Rest Day',
    ar: '\u064a\u0648\u0645 \u0631\u0627\u062d\u0629',
    it: 'Giorno di riposo',
    de: 'Ruhetag',
  });
  const customWorkoutLabel = pickLanguage(language, {
    en: 'Custom Workout',
    ar: '\u062a\u0645\u0631\u064a\u0646 \u0645\u062e\u0635\u0635',
    it: 'Allenamento personalizzato',
    de: 'Benutzerdefiniertes Workout',
  });
  const workoutCardCopy = useMemo(
    () => pickLanguage(language, {
      en: {
        recoveryFirst: 'Recovery first',
        recoveryMessage: (recovery: number) => `Recovery is ${recovery}%. A rest or lighter day is the better next move.`,
        recommendedNext: 'Recommended next',
        chooseTraining: 'Choose today\'s training',
        chooseWorkoutBody: 'Pick the session from your week plan that fits today.',
        tapToOpenPlan: 'Tap to open your week plan',
        chooseFromPlan: 'Choose from My Plan',
        viewMyPlan: 'View My Plan',
        ready: 'Ready',
        done: 'Done',
        fullyDone: 'Fully Done',
      },
      ar: {
        recoveryFirst: '\u0627\u0644\u062a\u0639\u0627\u0641\u064a \u0623\u0648\u0644\u0627',
        recoveryMessage: (recovery: number) => `\u0627\u0644\u062a\u0639\u0627\u0641\u064a \u0644\u062f\u064a\u0643 \u0627\u0644\u0622\u0646 ${recovery}%. \u062e\u0630 \u0631\u0627\u062d\u0629 \u0623\u0648 \u062d\u0635\u0629 \u0623\u062e\u0641 \u0642\u0628\u0644 \u0627\u0644\u062a\u0645\u0631\u064a\u0646 \u0627\u0644\u062a\u0627\u0644\u064a.`,
        recommendedNext: '\u0627\u0644\u0627\u0642\u062a\u0631\u0627\u062d \u0627\u0644\u062a\u0627\u0644\u064a',
        chooseTraining: '\u0627\u062e\u062a\u0631 \u062a\u062f\u0631\u064a\u0628 \u0627\u0644\u064a\u0648\u0645',
        chooseWorkoutBody: '\u0627\u062e\u062a\u0631 \u0645\u0646 \u062e\u0637\u0629 \u0627\u0644\u0623\u0633\u0628\u0648\u0639 \u0627\u0644\u062d\u0635\u0629 \u0627\u0644\u062a\u064a \u062a\u0646\u0627\u0633\u0628\u0643 \u0627\u0644\u064a\u0648\u0645.',
        tapToOpenPlan: '\u0627\u0636\u063a\u0637 \u0644\u0641\u062a\u062d \u062e\u0637\u062a\u0643 \u0627\u0644\u0623\u0633\u0628\u0648\u0639\u064a\u0629',
        chooseFromPlan: '\u0627\u062e\u062a\u0631 \u0645\u0646 \u062e\u0637\u062a\u064a',
        viewMyPlan: '\u0627\u0637\u0644\u0639 \u0639\u0644\u0649 \u062e\u0637\u062a\u064a',
        ready: '\u062c\u0627\u0647\u0632',
        done: '\u062a\u0645',
        fullyDone: '\u0645\u0643\u062a\u0645\u0644 \u0643\u0644\u064a\u0627',
      },
      it: {
        recoveryFirst: 'Prima il recupero',
        recoveryMessage: (recovery: number) => `Il tuo recupero ora e ${recovery}%. Meglio scegliere riposo o una sessione piu leggera prima del prossimo allenamento.`,
        recommendedNext: 'Prossimo consiglio',
        chooseTraining: 'Scegli l\'allenamento di oggi',
        chooseWorkoutBody: 'Scegli dalla tua settimana la sessione piu adatta a oggi.',
        tapToOpenPlan: 'Tocca per aprire il tuo piano settimanale',
        chooseFromPlan: 'Scegli dal mio piano',
        viewMyPlan: 'Apri il mio piano',
        ready: 'Pronto',
        done: 'Fatto',
        fullyDone: 'Completato',
      },
      de: {
        recoveryFirst: 'Erholung zuerst',
        recoveryMessage: (recovery: number) => `Deine Erholung liegt bei ${recovery}%. Ein Ruhetag oder eine leichtere Einheit ist jetzt die bessere Wahl.`,
        recommendedNext: 'Empfohlener nachster Schritt',
        chooseTraining: 'Wahle dein heutiges Training',
        chooseWorkoutBody: 'Wahle aus deinem Wochenplan die Einheit, die heute passt.',
        tapToOpenPlan: 'Tippe hier, um deinen Wochenplan zu offnen',
        chooseFromPlan: 'Aus meinem Plan wahlen',
        viewMyPlan: 'Meinen Plan offnen',
        ready: 'Bereit',
        done: 'Fertig',
        fullyDone: 'Ganz erledigt',
      },
      fr: {
        recoveryFirst: 'Recuperation d abord',
        recoveryMessage: (recovery: number) => `Ta recuperation est a ${recovery}%. Un jour de repos ou une seance plus legere est le meilleur choix maintenant.`,
        recommendedNext: 'Prochaine recommandation',
        chooseTraining: 'Choisis l entrainement du jour',
        chooseWorkoutBody: 'Choisis dans ton programme hebdomadaire la seance qui convient a aujourd hui.',
        tapToOpenPlan: 'Appuie pour ouvrir ton programme de la semaine',
        chooseFromPlan: 'Choisir depuis Mon Plan',
        viewMyPlan: 'Voir Mon Plan',
        ready: 'Pret',
        done: 'Termine',
        fullyDone: 'Complet',
      },
    }),
    [language],
  );
  const workoutRecommendation = useMemo(() => {
    if (!todayWorkoutSelection?.completed) return null;
    if (shouldSuggestRecoveryFirst) {
      return {
        title: workoutCardCopy.recoveryFirst,
        detail: workoutCardCopy.recoveryMessage(Math.round(overallRecovery)),
      };
    }
    if (!nextRecommendedWorkout) return null;
    return {
      title: workoutCardCopy.recommendedNext,
      detail: `${nextRecommendedWorkout.workoutName} - ${nextRecommendedWorkout.dayLabel}`,
    };
  }, [nextRecommendedWorkout, overallRecovery, shouldSuggestRecoveryFirst, todayWorkoutSelection?.completed, workoutCardCopy]);
  const todayWorkoutExercises = useMemo(() => {
    const baseExercises = normalizeTodayWorkoutExercises(todayWorkoutData?.exercises);
    const extraExercises = normalizeTodayWorkoutExercises(extraTodayExercises);
    const snapshotExercises = normalizeTodayWorkoutExercises(storedTodayExerciseSnapshot);
    const seen = new Set<string>();
    const mergedExercises = [...baseExercises, ...extraExercises];
    const preferredExercises = hasStoredTodayExerciseSnapshot
      ? snapshotExercises
      : mergedExercises;

    return preferredExercises.filter((exercise: any) => {
      const key = getExerciseName(exercise).toLowerCase();
      if (!key) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [todayWorkoutData, extraTodayExercises, hasStoredTodayExerciseSnapshot, storedTodayExerciseSnapshot]);
  const todayWorkoutExerciseCount = Math.max(todayWorkoutExercises.length, storedTodayExerciseCount);
  const hasAnyTodayExercises = todayWorkoutExerciseCount > 0;
  const isWorkoutCardRestDay = !shouldChooseWorkoutToday && todayWorkout === 'Rest Day' && !hasAnyTodayExercises;
  const workoutCardTitle = shouldChooseWorkoutToday
    ? workoutCardCopy.chooseTraining
    : (todayWorkout === 'Rest Day' && hasAnyTodayExercises ? customWorkoutLabel : todayWorkout);
  const workoutCardSubtitle = shouldChooseWorkoutToday
    ? null
    : (workoutRecommendation?.detail ?? null);
  const workoutCardDetailLines = shouldChooseWorkoutToday
    ? [workoutCardCopy.tapToOpenPlan]
    : undefined;
  const workoutCardActionLabel = shouldChooseWorkoutToday
    ? workoutCardCopy.chooseFromPlan
    : todayWorkoutSelection?.completed
      ? workoutCardCopy.viewMyPlan
      : undefined;
  const workoutCardProgressCaption = shouldChooseWorkoutToday
    ? workoutCardCopy.ready
    : todayWorkoutSelection?.completed
      ? workoutCardCopy.done
      : undefined;
  const workoutCardTitleDisplay = shouldChooseWorkoutToday ? workoutCardCopy.chooseTraining : workoutCardTitle;
  const workoutCardSubtitleDisplay = workoutCardSubtitle;
  const workoutCardDetailLinesDisplay = shouldChooseWorkoutToday ? [workoutCardCopy.tapToOpenPlan] : workoutCardDetailLines;
  const workoutCardActionLabelDisplay = shouldChooseWorkoutToday
    ? workoutCardCopy.chooseFromPlan
    : todayWorkoutSelection?.completed
      ? workoutCardCopy.viewMyPlan
      : workoutCardActionLabel;
  const workoutCardProgressCaptionDisplay = shouldChooseWorkoutToday
    ? workoutCardCopy.ready
    : todayWorkoutSelection?.completed
      ? workoutCardCopy.done
      : workoutCardProgressCaption;
  const workoutCardProgressDisplayLabel = shouldChooseWorkoutToday
    ? null
    : todayWorkoutSelection?.completed
      ? workoutCardCopy.fullyDone
      : null;

  const handleOpenWorkoutCard = () => {
    if (todayWorkoutSelection?.workoutKey) {
      onNavigate('workout', OPEN_PICKED_WORKOUT_PLAN);
      return;
    }

    onNavigate('workout', workoutCardTitleDisplay);
  };

  const rankName = String(programProgress?.rank || 'Bronze');
  const rankBadgeImage = getRankBadgeImage(rankName);
  const primaryHeroInsight = gamificationSummary?.weeklyNarrative?.[0] || gamificationSummary?.progress?.summaryInsights?.[0] || null;
  const homeNextAction = gamificationSummary?.nextAction || gamificationSummary?.progress?.nextAction || null;
  const homeRivalry = gamificationSummary?.progress?.rivalry || null;
  const homeRank = gamificationSummary?.progress?.rank || null;
  const homeStreakRisk = gamificationSummary?.progress?.streaks?.risk || null;
  const coachmarkScope = getCoachmarkUserScope(currentUser);
  const coachmarkDefaultSeenSteps = useMemo(
    () => ({
      header: false,
      today_gradient: false,
      today_plan: false,
      rank: false,
      recovery: false,
      nutrition: false,
      exercises: false,
      books: false,
    }),
    [],
  );
  const coachmarkStorageOptions = useMemo(
    () => ({
      tourId: HOME_COACHMARK_TOUR_ID,
      version: HOME_COACHMARK_VERSION,
      userScope: coachmarkScope,
      defaultSeenSteps: coachmarkDefaultSeenSteps,
    }),
    [coachmarkDefaultSeenSteps, coachmarkScope],
  );
  const homeCopy = useMemo(
    () => pickLanguage(language, {
      en: {
        tagline: 'Ready to crush your goals today?',
        rank: 'Rank',
        myNutrition: 'My Nutrition',
        shop: 'Shop',
        comingSoon: 'Coming soon',
        ok: 'OK',
        books: 'Books',
        back: 'Back',
        eatWellAndRecover: 'Eat well and recover',
        sets: 'sets',
        reps: 'reps',
        rest: 'rest',
        challenge: 'Challenge',
        challengePlaceholder: (name: string) => `Challenge screen placeholder for ${name}.`,
        defaultFriendName: 'this friend',
        heroDefaultTitle: 'Keep your streak moving',
        heroDefaultBody: 'One smart action today keeps your momentum alive.',
        heroStatPoints: 'pts to next rank',
        rivalryPrefix: 'Rivalry',
        actionLabel: 'Behavior engine',
      },
      ar: {
        tagline: '\u062c\u0627\u0647\u0632 \u0644\u062a\u062d\u0642\u064a\u0642 \u0623\u0647\u062f\u0627\u0641\u0643 \u0627\u0644\u064a\u0648\u0645\u061f',
        rank: '\u0627\u0644\u0631\u062a\u0628\u0629',
        myNutrition: '\u062a\u063a\u0630\u064a\u062a\u064a',
        shop: '\u0627\u0644\u0645\u062a\u062c\u0631',
        comingSoon: '\u0642\u0631\u064a\u0628\u0627',
        ok: '\u062d\u0633\u0646\u0627',
        books: '\u0627\u0644\u0643\u062a\u0628',
        back: '\u0631\u062c\u0648\u0639',
        eatWellAndRecover: '\u0643\u0644 \u062c\u064a\u062f\u0627 \u0648\u062a\u0639\u0627\u0641',
        sets: '\u0645\u062c\u0645\u0648\u0639\u0627\u062a',
        reps: '\u062a\u0643\u0631\u0627\u0631\u0627\u062a',
        rest: '\u0631\u0627\u062d\u0629',
        challenge: '\u0627\u0644\u062a\u062d\u062f\u064a',
        challengePlaceholder: (name: string) => `\u0647\u0630\u0647 \u0634\u0627\u0634\u0629 \u062a\u062c\u0631\u064a\u0628\u064a\u0629 \u0644\u0644\u062a\u062d\u062f\u064a \u0645\u0639 ${name}.`,
        defaultFriendName: '\u0647\u0630\u0627 \u0627\u0644\u0635\u062f\u064a\u0642',
        heroDefaultTitle: '\u062d\u0627\u0641\u0638 \u0639\u0644\u0649 \u0632\u062e\u0645\u0643',
        heroDefaultBody: '\u062e\u0637\u0648\u0629 \u0630\u0643\u064a\u0629 \u0627\u0644\u064a\u0648\u0645 \u062a\u062d\u0627\u0641\u0638 \u0639\u0644\u0649 \u062a\u0642\u062f\u0645\u0643.',
        heroStatPoints: '\u0646\u0642\u0637\u0629 \u0644\u0644\u0631\u062a\u0628\u0629 \u0627\u0644\u062a\u0627\u0644\u064a\u0629',
        rivalryPrefix: '\u0627\u0644\u0645\u0646\u0627\u0641\u0633\u0629',
        actionLabel: '\u0645\u062d\u0631\u0643 \u0627\u0644\u0633\u0644\u0648\u0643',
      },
      it: {
        tagline: 'Pronto a raggiungere i tuoi obiettivi oggi?',
        rank: 'Grado',
        myNutrition: 'La mia nutrizione',
        shop: 'Negozio',
        comingSoon: 'In arrivo',
        ok: 'OK',
        books: 'Libri',
        back: 'Indietro',
        eatWellAndRecover: 'Mangia bene e recupera',
        sets: 'serie',
        reps: 'ripetizioni',
        rest: 'recupero',
        challenge: 'Sfida',
        challengePlaceholder: (name: string) => `Schermata segnaposto della sfida per ${name}.`,
        defaultFriendName: 'questo amico',
        heroDefaultTitle: 'Proteggi il tuo slancio',
        heroDefaultBody: 'Una buona azione oggi mantiene viva la tua progressione.',
        heroStatPoints: 'pt al prossimo grado',
        rivalryPrefix: 'Rivalita',
        actionLabel: 'Motore di progresso',
      },
      de: {
        tagline: 'Bereit, heute deine Ziele zu erreichen?',
        rank: 'Rang',
        myNutrition: 'Meine Ernahrung',
        shop: 'Shop',
        comingSoon: 'Demnachst',
        ok: 'OK',
        books: 'Bucher',
        back: 'Zuruck',
        eatWellAndRecover: 'Iss gut und erhole dich',
        sets: 'Satze',
        reps: 'Wiederholungen',
        rest: 'Pause',
        challenge: 'Challenge',
        challengePlaceholder: (name: string) => `Challenge-Platzhalter fur ${name}.`,
        defaultFriendName: 'dieser Freund',
        heroDefaultTitle: 'Halte deinen Lauf am Leben',
        heroDefaultBody: 'Eine kluge Aktion heute haelt deinen Fortschritt in Bewegung.',
        heroStatPoints: 'Pkt bis zum naechsten Rang',
        rivalryPrefix: 'Rivale',
        actionLabel: 'Momentum',
      },
      fr: {
        tagline: 'Pret a atteindre tes objectifs aujourd hui ?',
        rank: 'Rang',
        myNutrition: 'Ma Nutrition',
        shop: 'Boutique',
        comingSoon: 'Bientot disponible',
        ok: 'OK',
        books: 'Livres',
        back: 'Retour',
        eatWellAndRecover: 'Mange bien et recupere',
        sets: 'series',
        reps: 'repetitions',
        rest: 'repos',
        challenge: 'Defi',
        challengePlaceholder: (name: string) => `Ecran de demonstration du defi pour ${name}.`,
        defaultFriendName: 'cet ami',
        heroDefaultTitle: 'Garde ton elan',
        heroDefaultBody: 'Une bonne action aujourd hui entretient ta progression.',
        heroStatPoints: 'pts vers le prochain rang',
        rivalryPrefix: 'Rivalite',
        actionLabel: 'Moteur de progression',
      },
    }),
    [language],
  );
  const coachmarkCopy = useMemo(
    () => pickLanguage(language, {
      en: {
        next: 'Next',
        skip: 'Skip',
        finish: 'Got it',
        startHereTitle: shouldChooseWorkoutToday ? 'Choose from My Plan' : 'Open your workout',
        startHereBody: shouldChooseWorkoutToday
          ? 'If you have not picked a session yet, tap here to go to My Plan and choose today\'s workout.'
          : 'Once today\'s session is saved, tap here to open the full workout plan and start training.',
        startHereAction: shouldChooseWorkoutToday ? 'Open My Plan' : 'Open Workout',
        recoveryTitle: 'Train smarter',
        recoveryBody: 'Recovery shows how ready your body is before your next session.',
        progressTitle: 'See your growth',
        progressBody: 'Track your consistency, performance and strength improvements here.',
        nutritionTitle: 'Fuel your results',
        nutritionBody: 'Get guidance for calories and protein based on your goal.',
        exercisesTitle: 'Learn each movement',
        exercisesBody: 'Use this card to browse exercises and watch how each movement should be performed.',
        booksTitle: 'Build your knowledge',
        booksBody: 'This card is for educational guides and books that help you understand your training better.',
      },
      ar: {
        next: '\u0627\u0644\u062a\u0627\u0644\u064a',
        skip: '\u062a\u062e\u0637\u064a',
        finish: '\u062d\u0633\u0646\u0627',
        startHereTitle: shouldChooseWorkoutToday ? '\u0627\u062e\u062a\u0631 \u0645\u0646 \u062e\u0637\u062a\u0643' : '\u0627\u0641\u062a\u062d \u062a\u0645\u0631\u064a\u0646\u0643',
        startHereBody: shouldChooseWorkoutToday
          ? '\u0625\u0630\u0627 \u0644\u0645 \u062a\u062e\u062a\u0631 \u062d\u0635\u0629 \u0628\u0639\u062f\u060c \u0627\u0636\u063a\u0637 \u0647\u0646\u0627 \u0644\u0644\u0630\u0647\u0627\u0628 \u0625\u0644\u0649 \u062e\u0637\u062a\u0643 \u0648\u0627\u062e\u062a\u064a\u0627\u0631 \u062a\u0645\u0631\u064a\u0646 \u0627\u0644\u064a\u0648\u0645.'
          : '\u0628\u0639\u062f \u062d\u0641\u0638 \u062d\u0635\u0629 \u0627\u0644\u064a\u0648\u0645\u060c \u0627\u0636\u063a\u0637 \u0647\u0646\u0627 \u0644\u0641\u062a\u062d \u062e\u0637\u0629 \u0627\u0644\u062a\u0645\u0631\u064a\u0646 \u0627\u0644\u0643\u0627\u0645\u0644\u0629 \u0648\u0627\u0644\u0628\u062f\u0621.',
        startHereAction: shouldChooseWorkoutToday ? '\u0627\u0641\u062a\u062d \u062e\u0637\u062a\u064a' : '\u0627\u0641\u062a\u062d \u0627\u0644\u062a\u0645\u0631\u064a\u0646',
        recoveryTitle: '\u062a\u062f\u0631\u0628 \u0628\u0630\u0643\u0627\u0621',
        recoveryBody: '\u064a\u0639\u0631\u0636 \u0627\u0644\u062a\u0639\u0627\u0641\u064a \u0645\u062f\u0649 \u062c\u0627\u0647\u0632\u064a\u0629 \u062c\u0633\u0645\u0643 \u0642\u0628\u0644 \u0627\u0644\u062c\u0644\u0633\u0629 \u0627\u0644\u062a\u0627\u0644\u064a\u0629.',
        progressTitle: '\u0634\u0627\u0647\u062f \u062a\u0637\u0648\u0631\u0643',
        progressBody: '\u062a\u062a\u0628\u0639 \u0627\u0646\u062a\u0638\u0627\u0645\u0643 \u0648\u0623\u062f\u0627\u0621\u0643 \u0648\u062a\u062d\u0633\u0646 \u0642\u0648\u062a\u0643 \u0645\u0646 \u0647\u0646\u0627.',
        nutritionTitle: '\u063a\u0630 \u0646\u062a\u0627\u0626\u062c\u0643',
        nutritionBody: '\u0627\u062d\u0635\u0644 \u0639\u0644\u0649 \u0625\u0631\u0634\u0627\u062f\u0627\u062a \u0644\u0644\u0633\u0639\u0631\u0627\u062a \u0648\u0627\u0644\u0628\u0631\u0648\u062a\u064a\u0646 \u0628\u0645\u0627 \u064a\u0646\u0627\u0633\u0628 \u0647\u062f\u0641\u0643.',
        exercisesTitle: '\u062a\u0639\u0644\u0645 \u0627\u0644\u062d\u0631\u0643\u0627\u062a',
        exercisesBody: '\u0627\u0633\u062a\u062e\u062f\u0645 \u0647\u0630\u0647 \u0627\u0644\u0628\u0637\u0627\u0642\u0629 \u0644\u0627\u0633\u062a\u0643\u0634\u0627\u0641 \u0627\u0644\u062a\u0645\u0627\u0631\u064a\u0646 \u0627\u0644\u0635\u062d\u064a\u062d\u0629 \u0648\u0645\u0634\u0627\u0647\u062f\u0629 \u0627\u0644\u0634\u0631\u062d \u0642\u0628\u0644 \u0623\u0646 \u062a\u0628\u062f\u0623.',
        booksTitle: '\u0645\u0643\u062a\u0628\u0629 \u0645\u0639\u0631\u0641\u064a\u0629',
        booksBody: '\u0647\u0630\u0647 \u0627\u0644\u0628\u0637\u0627\u0642\u0629 \u0645\u062e\u0635\u0635\u0629 \u0644\u0644\u0645\u062d\u062a\u0648\u0649 \u0627\u0644\u062a\u0639\u0644\u064a\u0645\u064a \u0648\u0627\u0644\u0643\u062a\u0628 \u0627\u0644\u062a\u064a \u062a\u0633\u0627\u0639\u062f\u0643 \u0639\u0644\u0649 \u0641\u0647\u0645 \u0627\u0644\u062a\u062f\u0631\u064a\u0628 \u0628\u0634\u0643\u0644 \u0623\u0641\u0636\u0644.',
      },
      it: {
        next: 'Avanti',
        skip: 'Salta',
        finish: 'Ho capito',
        startHereTitle: shouldChooseWorkoutToday ? 'Scegli dal mio piano' : 'Apri il tuo allenamento',
        startHereBody: shouldChooseWorkoutToday
          ? 'Se non hai ancora scelto una sessione, tocca qui per aprire il tuo piano e selezionare l\'allenamento di oggi.'
          : 'Quando la sessione di oggi e salvata, tocca qui per aprire il piano completo e iniziare ad allenarti.',
        startHereAction: shouldChooseWorkoutToday ? 'Apri il mio piano' : 'Apri allenamento',
        recoveryTitle: 'Allenati con intelligenza',
        recoveryBody: 'Il recupero mostra quanto il tuo corpo e pronto prima della prossima sessione.',
        progressTitle: 'Guarda la tua crescita',
        progressBody: 'Monitora costanza, prestazioni e miglioramenti della forza da qui.',
        nutritionTitle: 'Nutri i tuoi risultati',
        nutritionBody: 'Ricevi indicazioni su calorie e proteine in base al tuo obiettivo.',
        exercisesTitle: 'Impara ogni movimento',
        exercisesBody: 'Usa questa card per esplorare gli esercizi e vedere come eseguire correttamente ogni movimento.',
        booksTitle: 'Cresci con la conoscenza',
        booksBody: 'Questa card e dedicata a guide educative e libri che ti aiutano a capire meglio il tuo allenamento.',
      },
      de: {
        next: 'Weiter',
        skip: 'Uberspringen',
        finish: 'Verstanden',
        startHereTitle: shouldChooseWorkoutToday ? 'Aus meinem Plan wahlen' : 'Dein Workout offnen',
        startHereBody: shouldChooseWorkoutToday
          ? 'Wenn du noch keine Einheit gewahlt hast, tippe hier, um zu Mein Plan zu gehen und das heutige Workout auszuwahlen.'
          : 'Sobald die heutige Einheit gespeichert ist, tippe hier, um den vollstandigen Plan zu offnen und zu starten.',
        startHereAction: shouldChooseWorkoutToday ? 'Meinen Plan offnen' : 'Workout offnen',
        recoveryTitle: 'Smarter trainieren',
        recoveryBody: 'Die Erholung zeigt dir, wie bereit dein Korper vor der nachsten Einheit ist.',
        progressTitle: 'Sieh deinen Fortschritt',
        progressBody: 'Verfolge hier deine Konstanz, Leistung und Kraftentwicklung.',
        nutritionTitle: 'Unterstutze deine Ergebnisse',
        nutritionBody: 'Erhalte Kalorien- und Proteinempfehlungen passend zu deinem Ziel.',
        exercisesTitle: 'Lerne jede Bewegung',
        exercisesBody: 'Nutze diese Karte, um Ubungen zu durchsuchen und die richtige Ausfuhrung anzusehen.',
        booksTitle: 'Wissen ausbauen',
        booksBody: 'Diese Karte fuhrt zu Guides und Buchern, die dir helfen, dein Training besser zu verstehen.',
      },
      fr: {
        next: 'Suivant',
        skip: 'Passer',
        finish: 'Compris',
        startHereTitle: shouldChooseWorkoutToday ? 'Choisir depuis Mon Plan' : 'Ouvrir ton entrainement',
        startHereBody: shouldChooseWorkoutToday
          ? 'Si tu n as pas encore choisi de seance, appuie ici pour ouvrir Mon Plan et selectionner l entrainement du jour.'
          : 'Une fois la seance du jour enregistree, appuie ici pour ouvrir le plan complet et commencer a t entrainer.',
        startHereAction: shouldChooseWorkoutToday ? 'Ouvrir Mon Plan' : 'Ouvrir l entrainement',
        recoveryTitle: 'Entraine-toi intelligemment',
        recoveryBody: 'La recuperation montre a quel point ton corps est pret avant la prochaine seance.',
        progressTitle: 'Observe ta progression',
        progressBody: 'Suis ici ta regularite, tes performances et tes progres en force.',
        nutritionTitle: 'Alimente tes resultats',
        nutritionBody: 'Recois des reperes de calories et de proteines adaptes a ton objectif.',
        exercisesTitle: 'Apprends chaque mouvement',
        exercisesBody: 'Utilise cette carte pour parcourir les exercices et voir comment bien executer chaque mouvement.',
        booksTitle: 'Developpe tes connaissances',
        booksBody: 'Cette carte te mene vers des guides et des livres pour mieux comprendre ton entrainement.',
      },
    }),
    [language, shouldChooseWorkoutToday],
  );
  const homeCoachmarkSteps = useMemo<CoachmarkStep[]>(
    () => [
      {
        id: 'header',
        targetId: 'home_header_card',
        title: pickLanguage(language, {
          en: 'This is your home header',
          ar: '\u0647\u0630\u0647 \u0628\u0637\u0627\u0642\u0629 \u0627\u0644\u0628\u062f\u0627\u064a\u0629',
          it: 'Questa e la tua intestazione home',
          de: 'Das ist dein Home-Header',
        }),
        body: pickLanguage(language, {
          en: 'This top card is the start of your Home page and also opens your profile area.',
          ar: '\u0645\u0646 \u0647\u0646\u0627 \u062a\u0631\u0649 \u0635\u0641\u062d\u062a\u0643 \u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629 \u0628\u0633\u0631\u0639\u0629 \u0648\u064a\u0645\u0643\u0646\u0643 \u0641\u062a\u062d \u0645\u0644\u0641\u0643 \u0627\u0644\u0634\u062e\u0635\u064a \u0645\u0646 \u0627\u0644\u0623\u0639\u0644\u0649.',
          it: 'Questa card in alto e l\'inizio della tua Home e ti permette anche di aprire il profilo.',
          de: 'Diese obere Karte ist der Start deiner Home-Seite und offnet auch deinen Profilbereich.',
        }),
        placement: 'bottom',
        shape: 'rounded',
        padding: 8,
        cornerRadius: 24,
      },
      {
        id: 'today_gradient',
        targetId: 'home_today_plan_gradient',
        title: pickLanguage(language, {
          en: 'This is your workout hero',
          ar: '\u0647\u0630\u0647 \u0648\u0627\u062c\u0647\u0629 \u062a\u0645\u0631\u064a\u0646 \u0627\u0644\u064a\u0648\u0645',
          it: 'Questa e la tua area allenamento',
          de: 'Das ist dein Workout-Bereich',
        }),
        body: pickLanguage(language, {
          en: 'This quick hero area leads you to choose today\'s workout or open the workout plan you already saved.',
          ar: '\u0647\u0630\u0647 \u0627\u0644\u0648\u0627\u062c\u0647\u0629 \u0627\u0644\u0633\u0631\u064a\u0639\u0629 \u062a\u0642\u0648\u062f\u0643 \u0625\u0644\u0649 \u0627\u062e\u062a\u064a\u0627\u0631 \u062a\u0645\u0631\u064a\u0646 \u0627\u0644\u064a\u0648\u0645 \u0623\u0648 \u0641\u062a\u062d \u062e\u0637\u0629 \u0627\u0644\u062a\u0645\u0631\u064a\u0646 \u0627\u0644\u0645\u062d\u0641\u0648\u0638\u0629.',
          it: 'Questa area rapida ti porta a scegliere l\'allenamento di oggi oppure ad aprire il piano che hai gia salvato.',
          de: 'Dieser schnelle Bereich fuhrt dich dazu, das heutige Workout auszuwahlen oder deinen bereits gespeicherten Plan zu offnen.',
        }),
        placement: 'bottom',
        shape: 'rounded',
        padding: 8,
        cornerRadius: 24,
      },
      {
        id: 'today_plan',
        targetId: 'home_today_plan_card',
        title: coachmarkCopy.startHereTitle,
        body: coachmarkCopy.startHereBody,
        placement: 'bottom',
        shape: 'rounded',
        padding: 8,
        cornerRadius: 24,
      },
      {
        id: 'rank',
        targetId: 'home_rank_card',
        title: pickLanguage(language, {
          en: 'This is your rank card',
          ar: '\u0647\u0630\u0647 \u0631\u062a\u0628\u062a\u0643',
          it: 'Questa e la tua card grado',
          de: 'Das ist deine Rangkarte',
        }),
        body: pickLanguage(language, {
          en: 'Use this card to check your rank, points, and reward progress.',
          ar: '\u0645\u0646 \u0647\u0646\u0627 \u062a\u062a\u0627\u0628\u0639 \u0631\u062a\u0628\u062a\u0643 \u0648\u0646\u0642\u0627\u0637\u0643 \u0648\u0645\u0643\u0627\u0641\u0622\u062a \u0627\u0644\u062a\u0642\u062f\u0645.',
          it: 'Usa questa card per controllare grado, punti e avanzamento ricompense.',
          de: 'Nutze diese Karte, um deinen Rang, deine Punkte und deinen Belohnungsfortschritt zu sehen.',
        }),
        placement: 'top',
        shape: 'rounded',
        padding: 8,
        cornerRadius: 24,
      },
      {
        id: 'recovery',
        targetId: 'home_recovery_card',
        title: coachmarkCopy.recoveryTitle,
        body: coachmarkCopy.recoveryBody,
        placement: 'top',
        shape: 'rounded',
        padding: 8,
        cornerRadius: 24,
      },
      {
        id: 'nutrition',
        targetId: 'home_nutrition_card',
        title: coachmarkCopy.nutritionTitle,
        body: coachmarkCopy.nutritionBody,
        placement: 'top',
        shape: 'rounded',
        padding: 8,
        cornerRadius: 20,
      },
      {
        id: 'exercises',
        targetId: 'home_learning_exercises_card',
        title: coachmarkCopy.exercisesTitle,
        body: coachmarkCopy.exercisesBody,
        placement: 'top',
        shape: 'rounded',
        padding: 8,
        cornerRadius: 20,
      },
      {
        id: 'books',
        targetId: 'home_learning_books_card',
        title: coachmarkCopy.booksTitle,
        body: coachmarkCopy.booksBody,
        placement: 'top',
        shape: 'rounded',
        padding: 8,
        cornerRadius: 20,
      },
    ],
    [coachmarkCopy, language],
  );
  const activeCoachmarkSteps = homeCoachmarkSteps;
  const activeCoachmarkStep = activeCoachmarkSteps[coachmarkStepIndex] || null;
  const isCoachmarkOpen = coachmarkMode !== null && !!activeCoachmarkStep;
  const rankKey = String(rankName || '').trim().toLowerCase();
  const rankNameDisplay = pickLanguage(language, {
    en: rankName,
    ar: ({
      bronze: '\u0628\u0631\u0648\u0646\u0632\u064a',
      silver: '\u0641\u0636\u064a',
      gold: '\u0630\u0647\u0628\u064a',
      platinum: '\u0628\u0644\u0627\u062a\u064a\u0646\u064a',
      diamond: '\u0623\u0644\u0645\u0627\u0633\u064a',
      elite: '\u0646\u062e\u0628\u0648\u064a',
    } as Record<string, string>)[rankKey] || rankName,
    it: ({
      bronze: 'Bronzo',
      silver: 'Argento',
      gold: 'Oro',
      platinum: 'Platino',
      diamond: 'Diamante',
      elite: 'Elite',
    } as Record<string, string>)[rankKey] || rankName,
    de: ({
      bronze: 'Bronze',
      silver: 'Silber',
      gold: 'Gold',
      platinum: 'Platin',
      diamond: 'Diamant',
      elite: 'Elite',
    } as Record<string, string>)[rankKey] || rankName,
  });

  const updateRecovery = (value: number) => {
    const next = clampPercent(value);
    setOverallRecovery(next);
    localStorage.setItem(homeMetricKeys.homeRecovery, String(next));
  };

  const updateWorkoutProgress = (value: number) => {
    const next = clampPercent(value);
    setWorkoutProgress(next);
    localStorage.setItem(homeMetricKeys.homeWorkoutProgress, String(next));
  };

  const closeCoachmarks = () => {
    setCoachmarkMode(null);
    setCoachmarkStepIndex(0);
  };

  const handleCoachmarkNext = () => {
    if (!activeCoachmarkStep) return;

    const isLastStep = coachmarkStepIndex >= activeCoachmarkSteps.length - 1;
    if (isLastStep) {
      return;
    }

    patchCoachmarkProgress(coachmarkStorageOptions, (current) => ({
      currentStep: coachmarkMode === 'main' ? coachmarkStepIndex + 1 : current.currentStep,
      seenSteps: {
        ...current.seenSteps,
        [activeCoachmarkStep.id]: true,
      },
    }));

    setCoachmarkStepIndex((current) => Math.min(current + 1, activeCoachmarkSteps.length - 1));
  };

  const handleCoachmarkFinish = () => {
    if (!activeCoachmarkStep) return;

    patchCoachmarkProgress(coachmarkStorageOptions, (current) => ({
      completed: true,
      dismissed: false,
      currentStep: Math.max(homeCoachmarkSteps.length - 1, 0),
      seenSteps: {
        ...current.seenSteps,
        [activeCoachmarkStep.id]: true,
      },
    }));

    closeCoachmarks();
    if (guidedTourActive) onGuidedTourComplete?.();
  };

  const handleCoachmarkSkip = () => {
    patchCoachmarkProgress(coachmarkStorageOptions, {
      dismissed: true,
      currentStep: coachmarkStepIndex,
    });

    closeCoachmarks();
    if (guidedTourActive) onGuidedTourDismiss?.();
  };

  useEffect(() => {
    setView('main');
    setSelectedExercise(null);
    setSelectedCoach(null);
    setSelectedFriend(null);
  }, [resetSignal]);

  useEffect(() => {
    if (view !== 'main' || isHomeLoading || showShopComingSoon) return;
    if (hasTrackedHomeVisitRef.current) return;

    hasTrackedHomeVisitRef.current = true;
    incrementCoachmarkVisitCount(coachmarkStorageOptions);
  }, [
    coachmarkStorageOptions,
    isHomeLoading,
    showShopComingSoon,
    view,
  ]);

  useEffect(() => {
    if (view !== 'main' || isHomeLoading || showShopComingSoon || isCoachmarkOpen) {
      return;
    }

    const timer = window.setTimeout(() => {
      const progress = readCoachmarkProgress(coachmarkStorageOptions);
      const canShowMainOnboarding =
        guidedTourActive
        && !progress.completed
        && !progress.dismissed
        && hasCoachmarkTargets(homeCoachmarkSteps);

      if (canShowMainOnboarding) {
        setCoachmarkStepIndex(Math.min(progress.currentStep, homeCoachmarkSteps.length - 1));
        setCoachmarkMode('main');
      }
    }, 460);

    return () => window.clearTimeout(timer);
  }, [
    coachmarkStorageOptions,
    guidedTourActive,
    homeCoachmarkSteps,
    isCoachmarkOpen,
    isHomeLoading,
    showShopComingSoon,
    view,
  ]);

  useEffect(() => {
    let isMounted = true;
    const userName = currentUser.name || 'Moha';
    
    setGreeting(userName);

    const applyProgramSnapshot = (programData: any) => {
      const weeklyWorkouts = Array.isArray(programData?.currentWeekWorkouts)
        ? programData.currentWeekWorkouts
        : Array.isArray(programData?.workouts)
          ? programData.workouts
          : [];
      const normalizedWeekPlan = buildWeekPlanWorkoutChoices(weeklyWorkouts);
      const storedSelection = readTodayWorkoutSelection(workoutStorageScope);
      const matchedSelection = storedSelection
        ? normalizedWeekPlan.find((workout) => workout.key === storedSelection.workoutKey) || null
        : null;

      setUserProgram({ ...(programData || {}), workouts: weeklyWorkouts });
      setWeekPlanWorkouts(normalizedWeekPlan);
      if (storedSelection && !matchedSelection) {
        clearTodayWorkoutSelection(workoutStorageScope);
      }
      setTodayWorkoutSelection(matchedSelection ? storedSelection : null);
    };

    const applyRecoverySnapshot = (data: any) => {
      if (typeof data?.overallRecovery === 'number') {
        updateRecovery(data.overallRecovery);
        return;
      }

      if (Array.isArray(data?.recovery) && data.recovery.length > 0) {
        const avg = data.recovery.reduce((sum: number, entry: any) => sum + (Number(entry.score) || 0), 0) / data.recovery.length;
        updateRecovery(avg);
        return;
      }

      updateRecovery(100);
    };

    if (currentUserId) {
      const cachedProgram = readOfflineCacheValue<any>(offlineCacheKeys.userProgram(currentUserId));
      if (cachedProgram) {
        applyProgramSnapshot(cachedProgram);
      }

      const cachedProgress = readOfflineCacheValue<any>(offlineCacheKeys.programProgress(currentUserId));
      if (cachedProgress?.summary) {
        setProgramProgress(cachedProgress.summary || null);
      }

      const cachedGamificationSummary = readOfflineCacheValue<any>(offlineCacheKeys.gamificationSummary(currentUserId));
      if (cachedGamificationSummary) {
        setGamificationSummary(normalizeGamificationSummary(cachedGamificationSummary));
      }

      const cachedRecovery = readOfflineCacheValue<any>(offlineCacheKeys.recoveryStatus(currentUserId));
      if (cachedRecovery) {
        applyRecoverySnapshot(cachedRecovery);
      }
    }

    // Fetch user program
    const fetchProgram = async () => {
      setExtraTodayExercises(loadTodayExtraExercises(workoutStorageKeys));
      setStoredTodayExerciseCount(loadTodayExerciseCount(workoutStorageKeys));
      {
        const snapshotState = loadTodayExerciseSnapshotState(workoutStorageKeys);
        setStoredTodayExerciseSnapshot(snapshotState.exercises);
        setHasStoredTodayExerciseSnapshot(snapshotState.hasSnapshot);
      }
      if (!currentUserId) {
        setUserProgram({ workouts: [] });
        setWeekPlanWorkouts([]);
        setTodayWorkoutSelection(null);
        setTodayWorkout('Rest Day');
        setTodayWorkoutData(null);
        setStoredTodayExerciseSnapshot([]);
        setHasStoredTodayExerciseSnapshot(false);
        return;
      }

      try {
        const programData = await api.getUserProgram(currentUserId);
        applyProgramSnapshot(programData);
      } catch (error) {
        console.error('Failed to fetch user program:', error);
        setUserProgram({ workouts: [] });
        setWeekPlanWorkouts([]);
        setTodayWorkout('Rest Day');
        setTodayWorkoutData(null);
      }
    };
    const fetchProgramProgress = async () => {
      if (!currentUserId) return;
      try {
        const progress = await api.getProgramProgress(currentUserId);
        setProgramProgress(progress?.summary || null);
      } catch (error) {
        console.error('Failed to fetch program progress:', error);
      }
    };
    const fetchGamificationSummary = async () => {
      if (!currentUserId) {
        setGamificationSummary(null);
        return;
      }
      try {
        const summary = normalizeGamificationSummary(await api.getGamificationSummary(currentUserId));
        setGamificationSummary(summary);
      } catch (error) {
        console.error('Failed to fetch gamification summary:', error);
      }
    };
    // Fetch recovery status from API (same data shown on the recovery page)
    const fetchRecovery = async () => {
      const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
      if (!user.id) {
        updateRecovery(100);
        return;
      }

      try {
        const data = await api.getRecoveryStatus(user.id);
        applyRecoverySnapshot(data);
      } catch (error) {
        console.error('Failed to fetch recovery status:', error);
      }
    };
    
    const loadInitialHomeData = async () => {
      setIsHomeLoading(true);
      await fetchProgram();
      if (isMounted) {
        setIsHomeLoading(false);
      }
      void fetchProgramProgress();
      void fetchRecovery();
      void fetchGamificationSummary();
    };
    void loadInitialHomeData();
    
    const handleRecoveryUpdated = () => {
      void fetchRecovery();
    };
    window.addEventListener('recovery-updated', handleRecoveryUpdated);

    const handleWorkoutProgressUpdated = () => {
      const savedDate = localStorage.getItem(workoutStorageKeys.workoutDate);
      if (savedDate && savedDate !== todayKey) {
        updateWorkoutProgress(0);
        return;
      }
      const cachedProgress = readCachedPercent(homeMetricKeys.homeWorkoutProgress, workoutProgress);
      updateWorkoutProgress(cachedProgress);
    };
    window.addEventListener('workout-progress-updated', handleWorkoutProgressUpdated);

    const handleExtraExercisesUpdated = () => {
      setExtraTodayExercises(loadTodayExtraExercises(workoutStorageKeys));
      setStoredTodayExerciseCount(loadTodayExerciseCount(workoutStorageKeys));
      const snapshotState = loadTodayExerciseSnapshotState(workoutStorageKeys);
      setStoredTodayExerciseSnapshot(snapshotState.exercises);
      setHasStoredTodayExerciseSnapshot(snapshotState.hasSnapshot);
    };
    window.addEventListener('workout-extra-exercises-updated', handleExtraExercisesUpdated);

    const handleProgramUpdated = () => {
      void fetchProgram();
      void fetchProgramProgress();
    };
    window.addEventListener('program-updated', handleProgramUpdated);

    const handleGamificationUpdated = () => {
      void fetchGamificationSummary();
      void fetchProgramProgress();
    };
    window.addEventListener('gamification-updated', handleGamificationUpdated);

    const handleTodayWorkoutSelectionUpdated = () => {
      setTodayWorkoutSelection(readTodayWorkoutSelection(workoutStorageScope));
    };
    window.addEventListener(TODAY_WORKOUT_SELECTION_UPDATED_EVENT, handleTodayWorkoutSelectionUpdated);

    // Check for recovery updates every 2 seconds
    const recoveryInterval = setInterval(() => {
      if (localStorage.getItem('recoveryNeedsUpdate') === 'true') {
        localStorage.removeItem('recoveryNeedsUpdate');
        void fetchRecovery();
      }
    }, 2000);

    // Keep score fresh even without explicit user actions.
    const periodicRecoveryRefresh = setInterval(() => {
      void fetchRecovery();
    }, 60 * 1000);

    const progressRefresh = setInterval(() => {
      void fetchProgramProgress();
    }, 15 * 1000);

    return () => {
      isMounted = false;
      window.removeEventListener('recovery-updated', handleRecoveryUpdated);
      window.removeEventListener('workout-progress-updated', handleWorkoutProgressUpdated);
      window.removeEventListener('workout-extra-exercises-updated', handleExtraExercisesUpdated);
      window.removeEventListener('program-updated', handleProgramUpdated);
      window.removeEventListener('gamification-updated', handleGamificationUpdated);
      window.removeEventListener(TODAY_WORKOUT_SELECTION_UPDATED_EVENT, handleTodayWorkoutSelectionUpdated);
      clearInterval(recoveryInterval);
      clearInterval(periodicRecoveryRefresh);
      clearInterval(progressRefresh);
    };
  }, [currentUser.name, currentUserId, workoutStorageScope]);

  useEffect(() => {
    if (selectedTodayWorkout) {
      setTodayWorkout(selectedTodayWorkout.workoutName);
      setTodayWorkoutData({
        workout_name: selectedTodayWorkout.workoutName,
        workout_type: selectedTodayWorkout.workoutType,
        estimated_duration_minutes: selectedTodayWorkout.estimatedDurationMinutes,
        exercises: selectedTodayWorkout.exercises,
        dayLabel: selectedTodayWorkout.dayLabel,
      });
      return;
    }

    if (weekPlanWorkouts.length > 0) {
      setTodayWorkout('');
      setTodayWorkoutData(null);
      updateWorkoutProgress(0);
      return;
    }

    setTodayWorkout('Rest Day');
    setTodayWorkoutData(null);
  }, [selectedTodayWorkout, weekPlanWorkouts]);

  useEffect(() => {
    if (!todayWorkoutData || todayWorkout === 'Rest Day') {
      if (todayWorkout === 'Rest Day') updateWorkoutProgress(100);
      return;
    }

    const normalizeExerciseName = (name: string) => String(name || '').trim().toLowerCase();

    const getLocalWorkoutState = () => {
      const user = readStoredUser();
      const storageKeys = getWorkoutStorageKeys(user);
      const today = new Date().toDateString();
      const savedDate = localStorage.getItem(storageKeys.workoutDate);
      if (savedDate && savedDate !== today) {
        return {
          hasTodayState: false,
          hasLocalData: false,
          completedExercises: new Set<string>(),
          exerciseSets: {} as Record<string, any[]>,
        };
      }

      const raw = localStorage.getItem(storageKeys.completedExercises);
      let completedExercises = new Set<string>();
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            completedExercises = new Set(parsed.map((name: string) => normalizeExerciseName(name)));
          }
        } catch {
          completedExercises = new Set<string>();
        }
      }

      let exerciseSets: Record<string, any[]> = {};
      const rawSets = localStorage.getItem(storageKeys.exerciseSets);
      if (rawSets) {
        try {
          const parsedSets = JSON.parse(rawSets);
          if (parsedSets && typeof parsedSets === 'object') {
            exerciseSets = parsedSets;
          }
        } catch {
          exerciseSets = {};
        }
      }

      return {
        hasTodayState: true,
        hasLocalData: Object.keys(exerciseSets).length > 0 || completedExercises.size > 0,
        completedExercises,
        exerciseSets,
      };
    };

    const calculateProgress = async () => {
      const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
      const userId = user.id;

      const exercises = normalizeTodayWorkoutExercises(todayWorkoutData.exercises) as Array<{
        exerciseName?: string;
        exercise_name?: string;
        name?: string;
        sets?: number;
        target_sets?: number;
      }>;

      if (exercises.length === 0) {
        updateWorkoutProgress(0);
        return;
      }

      const plannedSetTargets = new Map<string, number>();
      exercises.forEach((ex: any) => {
        const exerciseName = normalizeExerciseName(getExerciseName(ex));
        if (!exerciseName) return;
        const plannedSets = Math.max(1, getExercisePlannedSets(ex));
        plannedSetTargets.set(exerciseName, (plannedSetTargets.get(exerciseName) || 0) + plannedSets);
      });

      const localState = getLocalWorkoutState();
      const localSetsByName = new Map<string, any[]>();
      Object.entries(localState.exerciseSets || {}).forEach(([exerciseName, setRows]) => {
        const normalizedName = normalizeExerciseName(exerciseName);
        if (!normalizedName) return;
        localSetsByName.set(normalizedName, Array.isArray(setRows) ? setRows : []);
      });

      if (!plannedSetTargets.size) {
        if (localSetsByName.size > 0) {
          let totalTargetSets = 0;
          let totalCompletedSets = 0;
          localSetsByName.forEach((setRows) => {
            const targetSets = Math.max(1, setRows.length);
            const completedSets = setRows.filter((s: any) => isSetCompleted(s)).length;
            totalTargetSets += targetSets;
            totalCompletedSets += Math.min(targetSets, completedSets);
          });
          const fallbackProgress = totalTargetSets > 0
            ? Math.min(100, Math.round((totalCompletedSets / totalTargetSets) * 100))
            : 0;
          updateWorkoutProgress(fallbackProgress);
          return;
        }
        updateWorkoutProgress(0);
        return;
      }

      const shouldUseLocalSetProgress =
        localState.hasTodayState
        && localState.hasLocalData;

      if (shouldUseLocalSetProgress) {
        let totalTargetSets = 0;
        let totalCompletedSets = 0;

        plannedSetTargets.forEach((plannedSets, exerciseName) => {
          const localSets = localSetsByName.get(exerciseName) || [];
          const completedSets = localSets.filter((s: any) => isSetCompleted(s)).length;
          const targetSets = Math.max(plannedSets, localSets.length);
          totalTargetSets += targetSets;
          totalCompletedSets += Math.min(completedSets, targetSets);
        });

        const progress = totalTargetSets > 0
          ? Math.min(100, Math.round((totalCompletedSets / totalTargetSets) * 100))
          : 0;
        updateWorkoutProgress(progress);
        return;
      }

      const plannedNames = Array.from(plannedSetTargets.keys());
      let completedCount = plannedNames.filter((name) => localState.completedExercises.has(name)).length;

      if (!userId) {
        updateWorkoutProgress(Math.min(100, Math.round((completedCount / plannedNames.length) * 100)));
        return;
      }

      try {
        const completedSets = await api.getTodayWorkoutProgress(userId);
        const completedFromApi = new Set(
          (Array.isArray(completedSets) ? completedSets : [])
            .map((s: any) => normalizeExerciseName(s.exercise_name || ''))
            .filter(Boolean),
        );
        const apiCompletedCount = plannedNames.filter((name) => completedFromApi.has(name)).length;
        completedCount = Math.max(completedCount, apiCompletedCount);

        const progress = Math.min(100, Math.round((completedCount / plannedNames.length) * 100));
        updateWorkoutProgress(progress);
      } catch (error) {
        // If API is unavailable, keep local progress so UI still updates.
        const progress = Math.min(100, Math.round((completedCount / plannedNames.length) * 100));
        updateWorkoutProgress(progress);
      }
    };

    const refreshProgress = () => {
      void calculateProgress();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshProgress();
      }
    };

    refreshProgress();
    window.addEventListener('focus', refreshProgress);
    window.addEventListener('storage', refreshProgress);
    window.addEventListener('gamification-updated', refreshProgress);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const interval = window.setInterval(() => {
      if (!document.hidden) {
        refreshProgress();
      }
    }, 15000);

    return () => {
      window.removeEventListener('focus', refreshProgress);
      window.removeEventListener('storage', refreshProgress);
      window.removeEventListener('gamification-updated', refreshProgress);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(interval);
    };
  }, [todayWorkoutData, todayWorkout, currentUserId]);

  const homeMotionDirection = getNavigationDirection(
    view,
    previousViewRef.current,
    HOME_VIEW_ORDER,
  );

  const renderTransitionedView = (content: React.ReactNode) => (
    <ScreenTransition screenKey={view} direction={homeMotionDirection}>
      {content}
    </ScreenTransition>
  );

  if (view === 'nutrition') {
    return renderTransitionedView(<MyNutrition onBack={() => setView('main')} />);
  }
  if (view === 'workoutDetail') {
    if (todayWorkout === 'Rest Day' && !hasAnyTodayExercises) {
      return renderTransitionedView(
        <div className="flex flex-col items-center justify-center h-screen pb-24 px-4">
          <button
            onClick={() => setView('main')}
            className="absolute top-7 left-0 inline-flex items-center gap-2 rounded-xl surface-glass px-3 py-2 text-sm text-text-primary">
            <ArrowLeft size={16} />
            {homeCopy.back}
          </button>
          <div className="w-20 h-20 rounded-3xl bg-accent/12 border border-accent/30 flex items-center justify-center mb-6">
            <MoonStar size={36} className="text-accent" />
          </div>
          <h2 className="text-3xl font-semibold text-white mb-3">{restDayLabel}</h2>
          <p className="text-text-secondary text-sm">{homeCopy.eatWellAndRecover}</p>
        </div>
      );
    }
    
    // Get today's workout exercises
    const exercises = todayWorkoutExercises;
    const workoutDetailTitle = todayWorkout === 'Rest Day' ? customWorkoutLabel : todayWorkout;
    
    return renderTransitionedView(
      <div className="pb-24 pt-4">
        <button
          onClick={() => setView('main')}
          className="inline-flex items-center gap-2 rounded-xl surface-glass px-3 py-2 text-sm text-text-primary mb-4">
          <ArrowLeft size={16} />
          {homeCopy.back}
        </button>
        <h2 className="text-2xl font-semibold text-white mb-2">{workoutDetailTitle}</h2>
        <p className="text-text-secondary text-sm mb-6">{todayWorkoutData?.workout_type}</p>
        
        <div className="space-y-3">
          {exercises.map((ex: any, i: number) => (
            <div key={i} className="surface-card rounded-2xl p-4 border border-white/15">
              <h3 className="text-base font-semibold text-white mb-2">{ex.exerciseName || ex.name}</h3>
              <div className="flex gap-4 text-xs text-text-secondary">
                <span>{ex.sets} {homeCopy.sets}</span>
                <span>{ex.reps} {homeCopy.reps}</span>
                <span>{ex.rest}s {homeCopy.rest}</span>
              </div>
              {ex.notes && <p className="text-xs text-text-tertiary mt-2">{ex.notes}</p>}
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (view === 'friends')
  return renderTransitionedView(
    <FriendsList
      onBack={() => setView('main')}
      onFriendClick={(friend) => {
        setSelectedFriend(friend);
        setView('friendProfile');
      }} />);


  if (view === 'friendProfile')
  return renderTransitionedView(
    <FriendProfile
      onBack={() => setView('friends')}
      onChallenge={() => setView('friendChallenge')}
      friend={selectedFriend}
    />
  );
  if (view === 'friendChallenge') {
    return renderTransitionedView(
      <FriendChallengeScreen
        onBack={() => setView('friendProfile')}
        onExitHome={() => setView('main')}
        friendName={selectedFriend?.name}
        friendId={selectedFriend?.id}
      />
    );
  }
  if (view === 'coachList')
  return renderTransitionedView(<CoachList onBack={() => setView('main')} onSelectCoach={(id, name) => { setSelectedCoach({id, name}); setView('chat'); }} />);
  if (view === 'chat') return renderTransitionedView(<Messaging onBack={() => setView('coachList')} coachId={selectedCoach?.id} coachName={selectedCoach?.name} />);
  if (view === 'calculator')
  return renderTransitionedView(<Calculator onBack={() => setView('main')} />);
  if (view === 'exercises')
  return renderTransitionedView(
    <ExerciseLibrary
      onBack={() => setView('main')}
      initialFilter={exerciseLibraryFilter}
      onFilterChange={setExerciseLibraryFilter}
      onExerciseClick={(exercise) => {
        setSelectedExercise(exercise);
        setView('video');
      }} />);


  if (view === 'books') return renderTransitionedView(<BooksLibrary onBack={() => setView('main')} />);
  if (view === 'video')
  return renderTransitionedView(<ExerciseVideoScreen onBack={() => setView('exercises')} exercise={selectedExercise || undefined} />);
  if (view === 'recovery')
  return renderTransitionedView(<MuscleRecoveryScreen onBack={() => setView('main')} />);
  if (view === 'rank')
  return renderTransitionedView(<RankingsRewardsScreen onBack={() => setView('main')} />);
  if (view === 'main' && isHomeLoading) {
    return renderTransitionedView(
      <div className="pb-24 pt-4 space-y-6 animate-pulse">
        <div className="surface-card rounded-2xl border border-white/12 px-4 py-4">
          <div className="h-8 w-40 rounded-lg bg-white/10" />
          <div className="mt-3 h-4 w-52 rounded bg-white/10" />
        </div>

        <div className="h-44 rounded-2xl surface-card border border-white/10" />
        <div className="h-48 rounded-2xl surface-card border border-white/10" />
        <div className="h-40 rounded-2xl surface-card border border-white/10" />
      </div>
    );
  }
  return renderTransitionedView(
    <div className="pb-24 pt-4">
      <ScreenSection index={0}>
        {/* Header Section */}
        <header
          data-coachmark-target="home_header_card"
          onClick={() => onNavigate('profile')}
          className="mb-7 surface-card relative overflow-hidden rounded-2xl border border-white/12 px-4 py-4 cursor-pointer shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(0,0,0,0.45),0_0_14px_rgba(191,255,0,0.07)]">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-60"
            style={{ backgroundImage: `url(${emojiProfile})` }}
            aria-hidden="true"
          />
          <div
            className={HOME_CARD_OVERLAY_CLASS}
            aria-hidden="true"
          />
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-3xl font-electrolize font-bold text-text-primary">
                {greeting}
              </h1>
              <p className="mt-1 text-sm leading-snug text-text-secondary">
                {primaryHeroInsight?.title || homeCopy.tagline}
              </p>
            </div>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setView('rank');
              }}
              className="relative z-10 shrink-0 rounded-2xl border border-white/15 surface-glass px-3.5 py-2"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-accent/35 bg-accent/15">
                  <img src={rankBadgeImage} alt={rankNameDisplay} className="h-5 w-5 object-contain" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.1em] text-text-secondary">{homeCopy.rank}</div>
                  <div className="text-sm font-semibold text-accent">{rankNameDisplay}</div>
                </div>
              </div>
            </button>
          </div>

          <div className="relative z-10 mt-4 space-y-3">
            <div className="grid grid-cols-1 gap-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-text-tertiary">{homeCopy.actionLabel}</div>
                <div className="mt-1 text-sm font-semibold text-white">{homeNextAction?.title || homeCopy.heroDefaultTitle}</div>
              </div>
            </div>
          </div>
        </header>
      </ScreenSection>

      {/* Main Content Grid */}
      <div className="space-y-8">
        {/* Today's Workout */}
        <ScreenSection index={1}>
          <div onClick={handleOpenWorkoutCard} className="cursor-pointer">
            <WorkoutCard
              coachmarkTargetId="home_today_plan_card"
              coachmarkGradientTargetId="home_today_plan_gradient"
              title={workoutCardTitleDisplay}
              workoutType={todayWorkoutData?.workout_type || ''}
              estimatedDurationMinutes={todayWorkoutData?.estimated_duration_minutes ?? null}
              exercises={todayWorkoutExercises}
              exerciseCount={todayWorkoutExerciseCount}
              progress={shouldChooseWorkoutToday ? 0 : workoutProgress}
              isRestDay={isWorkoutCardRestDay}
              subtitleOverride={null}
              detailLines={workoutCardDetailLinesDisplay}
              actionLabel={workoutCardActionLabelDisplay}
              progressCaption={workoutCardProgressCaptionDisplay}
              progressDisplayLabel={workoutCardProgressDisplayLabel}
            />
          </div>
        </ScreenSection>

        {/* Rank & Recovery */}
        <ScreenSection index={2}>
          <div className="grid grid-cols-1 gap-5">
            <div onClick={() => setView('rank')} className="cursor-pointer">
              <RankDisplay
                coachmarkTargetId="home_rank_card"
                points={programProgress?.totalPoints || 0}
                rankProgress={homeRank}
                streakRisk={homeStreakRisk}
              />
            </div>
            <RecoveryIndicator coachmarkTargetId="home_recovery_card" percentage={overallRecovery} onClick={() => setView('recovery')} />
          </div>
        </ScreenSection>

        {/* Quick Actions */}
        <ScreenSection index={3} className="grid grid-cols-2 gap-4">

          <GhostButton coachmarkTargetId="home_nutrition_card" onClick={() => setView('nutrition')} className="justify-between">
            <span className="flex items-center gap-2">
              <img src={emojiMyNutrition} alt={homeCopy.myNutrition} className="h-4 w-4 object-contain" />
              <span>{homeCopy.myNutrition}</span>
            </span>
            <img src={emojiRightArrow} alt="" aria-hidden="true" className="mb-1 h-[18px] w-[18px] shrink-0 object-contain opacity-70" />
          </GhostButton>
          <GhostButton onClick={() => setShowShopComingSoon(true)}>
            <span className="flex items-center gap-2">
              <img src={emojiComingSoon} alt={homeCopy.comingSoon} className="h-4 w-4 object-contain" />
              <span>{homeCopy.shop}</span>
            </span>
          </GhostButton>
        </ScreenSection>

        {showShopComingSoon && (
          <div
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6"
            onClick={() => setShowShopComingSoon(false)}
          >
            <div
              className="w-full max-w-sm surface-glass border border-white/15 rounded-2xl p-5 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-semibold text-white inline-flex items-center gap-2">
                <img src={emojiShop} alt={homeCopy.shop} className="h-6 w-6 object-contain" />
                <span>{homeCopy.shop}</span>
              </h3>
              <p className="text-sm text-text-secondary mt-2">{homeCopy.comingSoon}</p>
              <button
                type="button"
                onClick={() => setShowShopComingSoon(false)}
                className="mt-4 w-full bg-accent text-black py-2.5 rounded-xl font-semibold hover:bg-accent/90 transition-colors"
              >
                {homeCopy.ok}
              </button>
            </div>
          </div>
        )}

        {/* Education */}
        <ScreenSection index={4}>
          <EducationSection
            onExercises={() => setView('exercises')}
            onBooks={() => setView('books')}
            exercisesCoachmarkTargetId="home_learning_exercises_card"
            booksCoachmarkTargetId="home_learning_books_card"
          />
        </ScreenSection>


        {/* Calculators */}
        <ScreenSection index={5}>
          <CalculatorCard onClick={() => setView('calculator')} />
        </ScreenSection>
      </div>
      <CoachmarkOverlay
        isOpen={isCoachmarkOpen}
        step={activeCoachmarkStep}
        stepIndex={coachmarkStepIndex}
        totalSteps={activeCoachmarkSteps.length}
        nextLabel={coachmarkCopy.next}
      finishLabel={coachmarkCopy.finish}
      skipLabel={coachmarkCopy.skip}
      onNext={handleCoachmarkNext}
      onFinish={handleCoachmarkFinish}
      onSkip={handleCoachmarkSkip}
      onTargetAction={null}
    />
    </div>);

}


