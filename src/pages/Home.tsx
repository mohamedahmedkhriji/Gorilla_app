import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, MoonStar } from 'lucide-react';
import { WorkoutCard } from '../components/dashboard/WorkoutCard';
import { RecoveryIndicator } from '../components/dashboard/RecoveryIndicator';
import { RankDisplay } from '../components/dashboard/RankDisplay';
import { GhostButton } from '../components/ui/GhostButton';
import { CalculatorCard } from '../components/home/CalculatorCard';
import { AgendaSection } from '../components/home/AgendaSection';
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
import { api } from '../services/api';
import { getRankBadgeImage } from '../services/rankTheme';
import { emojiComingSoon, emojiMyNutrition, emojiProfile, emojiRightArrow, emojiShop } from '../services/emojiTheme';
import { useScrollToTopOnChange } from '../shared/scroll';
interface HomeProps {
  onNavigate: (tab: string, day?: string) => void;
  resetSignal?: number;
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

const loadTodayExerciseSnapshot = (keys: { workoutDate: string; exerciseSnapshot: string }) => {
  const today = new Date().toDateString();
  const savedDate = localStorage.getItem(keys.workoutDate);
  if (savedDate && savedDate !== today) return [];

  try {
    const raw = localStorage.getItem(keys.exerciseSnapshot);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

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
export function Home({ onNavigate, resetSignal = 0 }: HomeProps) {
  const currentUser = readStoredUser();
  const currentUserId = Number(currentUser?.id || 0);
  const workoutStorageKeys = getWorkoutStorageKeys(currentUser);
  const homeMetricKeys = getHomeMetricStorageKeys(currentUser);
  const todayKey = new Date().toDateString();

  const [view, setView] = useState<HomeView>('main');
  const [selectedExercise, setSelectedExercise] = useState<{name: string, muscle: string, video?: string | null} | null>(null);
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
  const [workoutProgress, setWorkoutProgress] = useState(() => {
    const savedDate = localStorage.getItem(workoutStorageKeys.workoutDate);
    if (savedDate && savedDate !== todayKey) return 0;
    return readCachedPercent(homeMetricKeys.homeWorkoutProgress, 0);
  });
  const [programProgress, setProgramProgress] = useState<any>(null);
  const [isHomeLoading, setIsHomeLoading] = useState(true);
  const [showShopComingSoon, setShowShopComingSoon] = useState(false);
  const [showBooksComingSoon, setShowBooksComingSoon] = useState(false);
  const [extraTodayExercises, setExtraTodayExercises] = useState<any[]>(
    () => loadTodayExtraExercises(workoutStorageKeys),
  );
  const [storedTodayExerciseCount, setStoredTodayExerciseCount] = useState(
    () => loadTodayExerciseCount(workoutStorageKeys),
  );
  const [storedTodayExerciseSnapshot, setStoredTodayExerciseSnapshot] = useState<any[]>(
    () => loadTodayExerciseSnapshot(workoutStorageKeys),
  );

  useScrollToTopOnChange([view, resetSignal]);
  const todayWorkoutExercises = useMemo(() => {
    const baseExercises = normalizeTodayWorkoutExercises(todayWorkoutData?.exercises);
    const extraExercises = normalizeTodayWorkoutExercises(extraTodayExercises);
    const snapshotExercises = normalizeTodayWorkoutExercises(storedTodayExerciseSnapshot);
    const seen = new Set<string>();
    const mergedExercises = [...baseExercises, ...extraExercises];
    const preferredExercises = snapshotExercises.length > mergedExercises.length
      ? snapshotExercises
      : mergedExercises;

    return preferredExercises.filter((exercise: any) => {
      const key = getExerciseName(exercise).toLowerCase();
      if (!key) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [todayWorkoutData, extraTodayExercises, storedTodayExerciseSnapshot]);
  const todayWorkoutExerciseCount = Math.max(todayWorkoutExercises.length, storedTodayExerciseCount);
  const hasAnyTodayExercises = todayWorkoutExerciseCount > 0;
  const workoutCardTitle = todayWorkout === 'Rest Day' && hasAnyTodayExercises ? 'Custom Workout' : todayWorkout;
  const isWorkoutCardRestDay = todayWorkout === 'Rest Day' && !hasAnyTodayExercises;
  const rankName = String(programProgress?.rank || 'Bronze');
  const rankBadgeImage = getRankBadgeImage(rankName);

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

  useEffect(() => {
    setView('main');
    setSelectedExercise(null);
    setSelectedCoach(null);
    setSelectedFriend(null);
  }, [resetSignal]);

  useEffect(() => {
    let isMounted = true;
    const userName = currentUser.name || 'Moha';
    
    setGreeting(userName);

    // Fetch user program
    const fetchProgram = async () => {
      setExtraTodayExercises(loadTodayExtraExercises(workoutStorageKeys));
      setStoredTodayExerciseCount(loadTodayExerciseCount(workoutStorageKeys));
      setStoredTodayExerciseSnapshot(loadTodayExerciseSnapshot(workoutStorageKeys));
      if (!currentUserId) {
        setUserProgram({ workouts: [] });
        setTodayWorkout('Rest Day');
        setTodayWorkoutData(null);
        setStoredTodayExerciseSnapshot([]);
        return;
      }

      try {
        const programData = await api.getUserProgram(currentUserId);
        const weeklyWorkouts = Array.isArray(programData?.currentWeekWorkouts)
          ? programData.currentWeekWorkouts
          : Array.isArray(programData?.workouts)
            ? programData.workouts
            : [];

        setUserProgram({ ...(programData || {}), workouts: weeklyWorkouts });

        const normalizedToday = resolveTodayWorkoutPayload(programData, weeklyWorkouts);
        if (normalizedToday?.workout_name) {
          setTodayWorkout(normalizedToday.workout_name);
          setTodayWorkoutData(normalizedToday);
        } else {
          setTodayWorkout('Rest Day');
          setTodayWorkoutData(null);
        }
      } catch (error) {
        console.error('Failed to fetch user program:', error);
        setUserProgram({ workouts: [] });
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
    // Fetch recovery status from API (same data shown on the recovery page)
    const fetchRecovery = async () => {
      const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
      if (!user.id) {
        updateRecovery(100);
        return;
      }

      try {
        const data = await api.getRecoveryStatus(user.id);
        if (typeof data?.overallRecovery === 'number') {
          updateRecovery(data.overallRecovery);
          return;
        }

        if (Array.isArray(data?.recovery) && data.recovery.length > 0) {
          const avg = data.recovery.reduce((sum: number, m: any) => sum + (Number(m.score) || 0), 0) / data.recovery.length;
          updateRecovery(avg);
          return;
        }

        updateRecovery(100);
      } catch (error) {
        console.error('Failed to fetch recovery status:', error);
      }
    };
    
    const loadInitialHomeData = async () => {
      setIsHomeLoading(true);
      await Promise.allSettled([
        fetchProgram(),
        fetchProgramProgress(),
        fetchRecovery(),
      ]);
      if (isMounted) {
        setIsHomeLoading(false);
      }
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
      setStoredTodayExerciseSnapshot(loadTodayExerciseSnapshot(workoutStorageKeys));
    };
    window.addEventListener('workout-extra-exercises-updated', handleExtraExercisesUpdated);

    const handleProgramUpdated = () => {
      void fetchProgram();
      void fetchProgramProgress();
    };
    window.addEventListener('program-updated', handleProgramUpdated);

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
      clearInterval(recoveryInterval);
      clearInterval(periodicRecoveryRefresh);
      clearInterval(progressRefresh);
    };
  }, [currentUser.name, currentUserId]);

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

    calculateProgress();
    const interval = setInterval(calculateProgress, 1000);
    return () => clearInterval(interval);
  }, [todayWorkoutData, todayWorkout, currentUserId]);
  if (view === 'nutrition') {
    return <MyNutrition onBack={() => setView('main')} />;
  }
  if (view === 'workoutDetail') {
    if (todayWorkout === 'Rest Day' && !hasAnyTodayExercises) {
      return (
        <div className="flex flex-col items-center justify-center h-screen pb-24 px-4">
          <button
            onClick={() => setView('main')}
            className="absolute top-7 left-0 inline-flex items-center gap-2 rounded-xl surface-glass px-3 py-2 text-sm text-text-primary">
            <ArrowLeft size={16} />
            Back
          </button>
          <div className="w-20 h-20 rounded-3xl bg-accent/12 border border-accent/30 flex items-center justify-center mb-6">
            <MoonStar size={36} className="text-accent" />
          </div>
          <h2 className="text-3xl font-semibold text-white mb-3">Rest Day</h2>
          <p className="text-text-secondary text-sm">Eat well and recover</p>
        </div>
      );
    }
    
    // Get today's workout exercises
    const exercises = todayWorkoutExercises;
    const workoutDetailTitle = todayWorkout === 'Rest Day' ? 'Custom Workout' : todayWorkout;
    
    return (
      <div className="pb-24 pt-4">
        <button
          onClick={() => setView('main')}
          className="inline-flex items-center gap-2 rounded-xl surface-glass px-3 py-2 text-sm text-text-primary mb-4">
          <ArrowLeft size={16} />
          Back
        </button>
        <h2 className="text-2xl font-semibold text-white mb-2">{workoutDetailTitle}</h2>
        <p className="text-text-secondary text-sm mb-6">{todayWorkoutData?.workout_type}</p>
        
        <div className="space-y-3">
          {exercises.map((ex: any, i: number) => (
            <div key={i} className="surface-card rounded-2xl p-4 border border-white/15">
              <h3 className="text-base font-semibold text-white mb-2">{ex.exerciseName || ex.name}</h3>
              <div className="flex gap-4 text-xs text-text-secondary">
                <span>{ex.sets} sets</span>
                <span>{ex.reps} reps</span>
                <span>{ex.rest}s rest</span>
              </div>
              {ex.notes && <p className="text-xs text-text-tertiary mt-2">{ex.notes}</p>}
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (view === 'friends')
  return (
    <FriendsList
      onBack={() => setView('main')}
      onFriendClick={(friend) => {
        setSelectedFriend(friend);
        setView('friendProfile');
      }} />);


  if (view === 'friendProfile')
  return (
    <FriendProfile
      onBack={() => setView('friends')}
      onChallenge={() => setView('friendChallenge')}
      friend={selectedFriend}
    />
  );
  if (view === 'friendChallenge') {
    return (
      <div className="flex-1 flex flex-col bg-background min-h-screen pb-24">
        <div className="px-4 sm:px-6 pt-2">
          <button
            type="button"
            onClick={() => setView('friendProfile')}
            className="inline-flex items-center gap-2 rounded-xl surface-glass px-3 py-2 text-sm text-text-primary"
          >
            <ArrowLeft size={16} />
            Back
          </button>
        </div>
        <div className="px-4 sm:px-6 pt-8">
          <div className="surface-card rounded-2xl border border-white/10 p-5">
            <h2 className="text-xl font-semibold text-white">Challenge</h2>
            <p className="mt-2 text-sm text-text-secondary">
              Challenge screen placeholder for {selectedFriend?.name || 'this friend'}.
            </p>
          </div>
        </div>
      </div>
    );
  }
  if (view === 'coachList')
  return <CoachList onBack={() => setView('main')} onSelectCoach={(id, name) => { setSelectedCoach({id, name}); setView('chat'); }} />;
  if (view === 'chat') return <Messaging onBack={() => setView('coachList')} coachId={selectedCoach?.id} coachName={selectedCoach?.name} />;
  if (view === 'calculator')
  return <Calculator onBack={() => setView('main')} />;
  if (view === 'exercises')
  return (
    <ExerciseLibrary
      onBack={() => setView('main')}
      initialFilter={exerciseLibraryFilter}
      onFilterChange={setExerciseLibraryFilter}
      onExerciseClick={(exercise) => {
        setSelectedExercise(exercise);
        setView('video');
      }} />);


  if (view === 'books') return <BooksLibrary onBack={() => setView('main')} />;
  if (view === 'video')
  return <ExerciseVideoScreen onBack={() => setView('exercises')} exercise={selectedExercise || undefined} />;
  if (view === 'recovery')
  return <MuscleRecoveryScreen onBack={() => setView('main')} />;
  if (view === 'rank')
  return <RankingsRewardsScreen onBack={() => setView('main')} />;
  if (view === 'main' && isHomeLoading) {
    return (
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
  return (
    <div className="pb-24 pt-4">
      {/* Header Section */}
      <motion.header
        initial={{
          opacity: 0,
          y: -20
        }}
        animate={{
          opacity: 1,
          y: 0
        }}
        transition={{
          duration: 0.6,
          ease: 'easeOut'
        }}
        onClick={() => onNavigate('profile')}
        className="mb-7 surface-card relative overflow-hidden rounded-2xl border border-white/12 px-4 py-3 flex items-start justify-between gap-4 cursor-pointer">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-60"
          style={{ backgroundImage: `url(${emojiProfile})` }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-gradient-to-r from-background/65 via-background/45 to-background/25"
          aria-hidden="true"
        />

        <div className="relative z-10">
          <h1 className="mt-1 text-3xl font-electrolize font-bold text-text-primary">
            {greeting}
          </h1>
          <p className="text-text-secondary mt-2 text-sm max-w-[200px] leading-snug">
            Ready to crush your goals today?
          </p>
        </div>
        
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setView('rank');
          }}
          className="relative z-10 flex items-center gap-2 surface-glass px-3.5 py-2 rounded-2xl border border-white/15 shrink-0"
        >
          <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/35 flex items-center justify-center">
            <img src={rankBadgeImage} alt={rankName} className="h-5 w-5 object-contain" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.1em] text-text-secondary">Rank</div>
            <div className="text-sm font-semibold text-accent">{rankName}</div>
          </div>
        </button>
      </motion.header>

      {/* Main Content Grid */}
      <div className="space-y-8">
        {/* Today's Workout */}
        <div onClick={() => onNavigate('workout', workoutCardTitle)} className="cursor-pointer">
          <WorkoutCard
            title={workoutCardTitle}
            workoutType={todayWorkoutData?.workout_type || ''}
            estimatedDurationMinutes={todayWorkoutData?.estimated_duration_minutes ?? null}
            exercises={todayWorkoutExercises}
            exerciseCount={todayWorkoutExerciseCount}
            progress={workoutProgress}
            isRestDay={isWorkoutCardRestDay} />
        </div>

        {/* Agenda */}
        <AgendaSection
          userProgram={userProgram}
          programProgress={programProgress}
          accountCreatedAt={currentUser?.created_at || currentUser?.createdAt || null}
        />

        {/* Rank & Recovery */}
        <div className="grid grid-cols-1 gap-5">
          <div onClick={() => setView('rank')} className="cursor-pointer">
            <RankDisplay points={programProgress?.totalPoints || 0} />
          </div>
          <RecoveryIndicator percentage={overallRecovery} onClick={() => setView('recovery')} />
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{
            opacity: 0,
            y: 20
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          transition={{
            duration: 0.5,
            delay: 0.5
          }}
          className="grid grid-cols-2 gap-4">

          <GhostButton onClick={() => setView('nutrition')} className="justify-between">
            <span className="flex items-center gap-2">
              <img src={emojiMyNutrition} alt="My nutrition" className="h-4 w-4 object-contain" />
              <span>My Nutrition</span>
            </span>
            <img src={emojiRightArrow} alt="" aria-hidden="true" className="mb-1 h-[18px] w-[18px] shrink-0 object-contain opacity-70" />
          </GhostButton>
          <GhostButton onClick={() => setShowShopComingSoon(true)}>
            <span className="flex items-center gap-2">
              <img src={emojiComingSoon} alt="Coming soon" className="h-4 w-4 object-contain" />
              <span>Shop</span>
            </span>
          </GhostButton>
        </motion.div>

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
                <img src={emojiShop} alt="Shop" className="h-6 w-6 object-contain" />
                <span>Shop</span>
              </h3>
              <p className="text-sm text-text-secondary mt-2">Coming soon</p>
              <button
                type="button"
                onClick={() => setShowShopComingSoon(false)}
                className="mt-4 w-full bg-accent text-black py-2.5 rounded-xl font-semibold hover:bg-accent/90 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        )}

        {showBooksComingSoon && (
          <div
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6"
            onClick={() => setShowBooksComingSoon(false)}
          >
            <div
              className="w-full max-w-sm surface-glass border border-white/15 rounded-2xl p-5 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-semibold text-white">Books</h3>
              <p className="text-sm text-text-secondary mt-2">Coming soon</p>
              <button
                type="button"
                onClick={() => setShowBooksComingSoon(false)}
                className="mt-4 w-full bg-accent text-black py-2.5 rounded-xl font-semibold hover:bg-accent/90 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        )}

        {/* Education */}
        <EducationSection
          onExercises={() => setView('exercises')}
          onBooks={() => setShowBooksComingSoon(true)} />


        {/* Calculators */}
        <CalculatorCard onClick={() => setView('calculator')} />
      </div>
    </div>);

}

