import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '../ui/Button';
import { StrengthChart } from './StrengthChart';
import { Card } from '../ui/Card';
import { Activity, CircleQuestionMark, TrendingUp, X } from 'lucide-react';
import { api } from '../../services/api';
import { emojiFire, emojiRightArrow } from '../../services/emojiTheme';
import { getBodyPartImage } from '../../services/bodyPartTheme';
import { AppLanguage, getActiveLanguage, getStoredLanguage } from '../../services/language';
import { offlineCacheKeys, readOfflineCacheValue } from '../../services/offlineCache';
import { buildT2PremiumProgressInsight, getActiveT2PremiumConfig } from '../../services/premiumPlan';
import { getLatestT2WorkoutCheckIn, T2_CHECKIN_UPDATED_EVENT } from '../../services/t2CheckIn';
interface ProgressDashboardProps {
  onViewReport: () => void;
  onViewStrengthScore: () => void;
}

interface MuscleDistributionItem {
  name: string;
  val: number;
}

const SEGMENT_COUNT = 10;

const toTitleCase = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const parseTargetMuscles = (raw: unknown): string[] => {
  if (Array.isArray(raw)) {
    return raw.map((entry) => toTitleCase(entry)).filter(Boolean);
  }

  if (typeof raw !== 'string' || !raw.trim()) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((entry) => toTitleCase(entry)).filter(Boolean);
    }
  } catch {
    return raw
      .split(/[,;|]+/)
      .map((entry) => toTitleCase(entry))
      .filter(Boolean);
  }

  return [];
};

const inferMusclesFromExerciseName = (exerciseName: unknown) => {
  const name = String(exerciseName || '').toLowerCase();
  const matches: string[] = [];

  if (/bench|chest|fly|push-up|push up/.test(name)) matches.push('Chest', 'Triceps', 'Shoulders');
  if (/deadlift|row|pull-up|pull up|lat|pulldown|pullover/.test(name)) matches.push('Back', 'Biceps', 'Forearms');
  if (/squat|leg press|lunge|split squat|step up/.test(name)) matches.push('Quadriceps', 'Hamstrings', 'Calves');
  if (/romanian deadlift|rdl|leg curl|hamstring/.test(name)) matches.push('Hamstrings');
  if (/lateral raise|rear delt|face pull|front raise/.test(name)) matches.push('Shoulders');
  if (/shoulder|overhead press|arnold press|seated shoulder press|machine shoulder press/.test(name)) matches.push('Shoulders', 'Triceps');
  if (/curl/.test(name)) matches.push('Biceps', 'Forearms');
  if (/tricep|triceps|dip/.test(name)) matches.push('Triceps');
  if (/calf/.test(name)) matches.push('Calves');
  if (/abs|core|crunch|plank|sit-up|sit up/.test(name)) matches.push('Abs');

  return [...new Set(matches.map((entry) => toTitleCase(entry)).filter(Boolean))];
};

const normalizeDistributionItems = (items: Array<{ muscle?: unknown; percent?: unknown }>) =>
  items
    .slice(0, 3)
    .map((item) => ({
      name: String(item?.muscle || '-'),
      val: Math.max(0, Math.min(100, Number(item?.percent || 0))),
    }));

const buildProgramDistribution = (programData: any): MuscleDistributionItem[] => {
  const weeklyWorkouts = Array.isArray(programData?.currentWeekWorkouts)
    ? programData.currentWeekWorkouts
    : Array.isArray(programData?.workouts)
      ? programData.workouts
      : [];
  const fallbackWorkouts = programData?.todayWorkout ? [programData.todayWorkout] : [];
  const workouts = weeklyWorkouts.length ? weeklyWorkouts : fallbackWorkouts;
  const byMuscle = new Map<string, number>();

  workouts.forEach((workout: any) => {
    const exercises = Array.isArray(workout?.exercises)
      ? workout.exercises
      : typeof workout?.exercises === 'string'
        ? (() => {
            try {
              const parsed = JSON.parse(workout.exercises);
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return [];
            }
          })()
        : [];

    exercises.forEach((exercise: any) => {
      const plannedSets = Math.max(
        1,
        Number(
          exercise?.sets
          ?? exercise?.targetSets
          ?? exercise?.target_sets
          ?? 1,
        ) || 1,
      );

      const muscles = [
        ...parseTargetMuscles(exercise?.targetMuscles ?? exercise?.muscleTargets ?? exercise?.muscles),
        toTitleCase(exercise?.muscleGroup || exercise?.muscle_group || exercise?.muscle || exercise?.bodyPart || ''),
      ].filter(Boolean);

      const resolvedMuscles = muscles.length
        ? [...new Set(muscles)]
        : inferMusclesFromExerciseName(exercise?.exerciseName || exercise?.exercise_name || exercise?.name || '');

      if (!resolvedMuscles.length) return;

      const share = plannedSets / resolvedMuscles.length;
      resolvedMuscles.forEach((muscle) => {
        byMuscle.set(muscle, Number(byMuscle.get(muscle) || 0) + share);
      });
    });
  });

  const total = Array.from(byMuscle.values()).reduce((sum, value) => sum + Number(value || 0), 0);
  if (total <= 0) return [];

  return Array.from(byMuscle.entries())
    .map(([muscle, value]) => ({
      muscle,
      percent: (Number(value) / total) * 100,
    }))
    .sort((left, right) => Number(right.percent) - Number(left.percent))
    .slice(0, 3)
    .map((item) => ({
      name: String(item.muscle || '-'),
      val: Math.max(0, Math.min(100, Number(item.percent || 0))),
    }));
};

const inferPlannedWorkoutsThisWeek = (progress: any, programData: any) => {
  const normalizeWorkouts = (raw: unknown) => {
    if (Array.isArray(raw)) return raw;
    if (typeof raw !== 'string' || !raw.trim()) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const programWorkouts = Array.isArray(programData?.currentWeekWorkouts)
    ? programData.currentWeekWorkouts
    : Array.isArray(programData?.workouts)
      ? programData.workouts
      : [];
  const normalizedProgramWorkouts = normalizeWorkouts(programWorkouts);
  if (normalizedProgramWorkouts.length > 0) {
    return normalizedProgramWorkouts.length;
  }

  const progressWorkouts = Array.isArray(progress?.program?.currentWeekWorkouts)
    ? progress.program.currentWeekWorkouts
    : [];
  if (progressWorkouts.length > 0) {
    return progressWorkouts.length;
  }

  const selectedDays = Array.isArray(programData?.selectedDays)
    ? programData.selectedDays.filter(Boolean)
    : [];
  if (selectedDays.length > 0) {
    return selectedDays.length;
  }

  const programDaysPerWeek = Number(
    programData?.daysPerWeek
    ?? progress?.program?.daysPerWeek
    ?? 0,
  );
  if (programDaysPerWeek > 0) {
    return Math.round(programDaysPerWeek);
  }

  return Math.max(0, Number(progress?.summary?.workoutsPlannedThisWeek || 0));
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const getActiveSegments = (percent: number) =>
  Math.round((clampPercent(percent) / 100) * SEGMENT_COUNT);

const getSegmentColor = (index: number, isActive: boolean) => {
  const ratio = SEGMENT_COUNT <= 1 ? 0 : index / (SEGMENT_COUNT - 1);
  if (isActive) {
    // Yellow -> Green progression across active segments
    const hue = 60 + (ratio * 60);
    const saturation = 90;
    const lightness = 48;
    return `hsl(${hue} ${saturation}% ${lightness}%)`;
  }
  return 'rgb(39, 46, 52)';
};

const PROGRESS_DASHBOARD_I18N = {
  en: {
    title: 'Your Progress',
    strengthScoreInfo: 'Strength score info',
    totalVolume: 'Total Volume',
    muscleDistribution: 'Muscle Distribution (Plan Target)',
    noPlanDistribution: 'No plan distribution is available yet for this user.',
    viewBiWeeklyReport: 'View Bi-Weekly Report',
    progressDialogTitle: "What's on this page",
    close: 'Close',
    infoLine1: 'Your weekly strength trend (estimated 1RM).',
    infoLine2: 'Your weekly consistency percentage and completed days.',
    infoLine3: 'Your total lifted volume.',
    infoLine4: 'Your top target muscles for the current plan.',
    infoLine5: 'Next overload recommendations and quick report access.',
    fireAlt: 'Fire',
    progressDialogAria: 'Progress page info dialog',
  },
  ar: {
    title: 'تقدمك',
    strengthScoreInfo: 'معلومات درجة القوة',
    totalVolume: 'الحجم الكلي',
    muscleDistribution: 'توزيع العضلات (هدف الخطة)',
    noPlanDistribution: 'لا يتوفر توزيع للخطة لهذا المستخدم حتى الآن.',
    viewBiWeeklyReport: 'عرض التقرير نصف الأسبوعي',
    progressDialogTitle: 'ما الذي ستجده في هذه الصفحة',
    close: 'إغلاق',
    infoLine1: 'اتجاه قوتك الأسبوعي (تقدير 1RM).',
    infoLine2: 'نسبة التزامك أسبوعيًا وعدد الأيام المكتملة.',
    infoLine3: 'إجمالي حجم الأوزان التي رفعتها.',
    infoLine4: 'أكثر العضلات استهدافًا في خطتك الحالية.',
    infoLine5: 'توصيات التحميل التدريجي القادمة مع وصول سريع للتقرير.',
    fireAlt: 'نار',
    progressDialogAria: 'نافذة معلومات صفحة التقدم',
  },
  it: {
    title: 'I Tuoi Progressi',
    strengthScoreInfo: 'Info punteggio forza',
    totalVolume: 'Volume Totale',
    muscleDistribution: 'Distribuzione Muscolare (Target del Piano)',
    noPlanDistribution: 'Nessuna distribuzione del piano disponibile per questo utente.',
    viewBiWeeklyReport: 'Visualizza Report Bisettimanale',
    progressDialogTitle: 'Cosa trovi in questa pagina',
    close: 'Chiudi',
    infoLine1: 'Il tuo trend settimanale della forza (1RM stimato).',
    infoLine2: 'La tua percentuale settimanale di costanza e i giorni completati.',
    infoLine3: 'Il volume totale sollevato.',
    infoLine4: 'I principali muscoli target del piano attuale.',
    infoLine5: 'Prossimi consigli di overload e accesso rapido al report.',
    fireAlt: 'Fuoco',
    progressDialogAria: 'Finestra info pagina progressi',
  },
  de: {
    title: 'Dein Fortschritt',
    strengthScoreInfo: 'Infos zum Kraftwert',
    totalVolume: 'Gesamtvolumen',
    muscleDistribution: 'Muskelverteilung (Plan-Ziel)',
    noPlanDistribution: 'Fuer diesen Nutzer ist noch keine Planverteilung verfuegbar.',
    viewBiWeeklyReport: 'Zweiwochenbericht Anzeigen',
    progressDialogTitle: 'Was auf dieser Seite ist',
    close: 'Schliessen',
    infoLine1: 'Dein woechentlicher Krafttrend (geschaetztes 1RM).',
    infoLine2: 'Deine woechentliche Konstanz in Prozent und abgeschlossene Tage.',
    infoLine3: 'Dein gesamtes bewegtes Volumen.',
    infoLine4: 'Deine wichtigsten Zielmuskeln im aktuellen Plan.',
    infoLine5: 'Naechste Overload-Empfehlungen und schneller Berichtszugang.',
    fireAlt: 'Feuer',
    progressDialogAria: 'Info-Dialog Fortschrittsseite',
  },
} as const;

const ARABIC_MUSCLE_NAME_MAP: Record<string, string> = {
  Abs: 'البطن',
  Triceps: 'الترايسبس',
  Biceps: 'البايسبس',
  Chest: 'الصدر',
  Back: 'الظهر',
  Shoulders: 'الأكتاف',
  Quadriceps: 'الرباعية',
  Hamstrings: 'الخلفية',
  Calves: 'السمانة',
  Forearms: 'الساعد',
};

const ITALIAN_MUSCLE_NAME_MAP: Record<string, string> = {
  Abs: 'Addome',
  Triceps: 'Tricipiti',
  Biceps: 'Bicipiti',
  Chest: 'Petto',
  Back: 'Schiena',
  Shoulders: 'Spalle',
  Quadriceps: 'Quadricipiti',
  Hamstrings: 'Femorali',
  Calves: 'Polpacci',
  Forearms: 'Avambracci',
};

const GERMAN_MUSCLE_NAME_MAP: Record<string, string> = {
  Abs: 'Bauch',
  Triceps: 'Trizeps',
  Biceps: 'Bizeps',
  Chest: 'Brust',
  Back: 'Ruecken',
  Shoulders: 'Schultern',
  Quadriceps: 'Quadrizeps',
  Hamstrings: 'Beinbeuger',
  Calves: 'Waden',
  Forearms: 'Unterarme',
};

const getLocalizedMuscleName = (name: string, language: AppLanguage) => {
  if (language === 'ar') return ARABIC_MUSCLE_NAME_MAP[name] || name;
  if (language === 'it') return ITALIAN_MUSCLE_NAME_MAP[name] || name;
  if (language === 'de') return GERMAN_MUSCLE_NAME_MAP[name] || name;
  return name;
};

export function ProgressDashboard({ onViewReport, onViewStrengthScore }: ProgressDashboardProps) {
  const [stats, setStats] = useState({
    totalWorkouts: 0,
    totalVolume: 0,
    consistency: 0,
    currentStreak: 0,
    workoutsCompletedThisWeek: 0,
    workoutsPlannedThisWeek: 0,
    workoutsMissedThisWeek: 0,
    workoutsRemainingThisWeek: 0,
  });
  const [muscleDistribution, setMuscleDistribution] = useState<MuscleDistributionItem[]>([]);
  const [showPageInfo, setShowPageInfo] = useState(false);
  const [language, setLanguage] = useState<AppLanguage>('en');
  const [activeProgramData, setActiveProgramData] = useState<any>(null);
  const copy = PROGRESS_DASHBOARD_I18N[language as keyof typeof PROGRESS_DASHBOARD_I18N] || PROGRESS_DASHBOARD_I18N.en;

  useEffect(() => {
    setLanguage(getActiveLanguage());

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

  const getUserId = () => {
    const localUserId = Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || 0);
    let parsedUserId = 0;
    try {
      const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
      parsedUserId = Number(user?.id || 0);
    } catch {
      parsedUserId = 0;
    }
    return localUserId || parsedUserId;
  };

  const loadStats = useCallback(async () => {
    const userId = getUserId();
    if (!userId) {
      setStats({
        totalWorkouts: 0,
        totalVolume: 0,
        consistency: 0,
        currentStreak: 0,
        workoutsCompletedThisWeek: 0,
        workoutsPlannedThisWeek: 0,
        workoutsMissedThisWeek: 0,
        workoutsRemainingThisWeek: 0,
      });
      setMuscleDistribution([]);
      setActiveProgramData(null);
      return;
    }

    const applySnapshot = (progress: any, programData: any, planDistributionData?: any, historyDistributionData?: any) => {
      const weeklyRate = Number(progress?.summary?.weeklyCompletionRate || 0);
      const workoutsPlannedThisWeek = inferPlannedWorkoutsThisWeek(progress, programData);
      const workoutsCompletedThisWeek = Number(progress?.summary?.workoutsCompletedThisWeek || 0);
      const workoutsMissedThisWeek = Number(progress?.summary?.workoutsMissedThisWeek || 0);
      const volumeLoadAllTime = Number(
        progress?.summary?.volumeLoadAllTime
        ?? progress?.summary?.volumeLoadSinceStart
        ?? progress?.summary?.volumeLoadLast30Days
        ?? 0,
      );

      setStats({
        totalWorkouts: Number(progress?.summary?.completedWorkouts || 0),
        totalVolume: Math.round((volumeLoadAllTime / 1000) * 10) / 10,
        consistency: Math.max(0, Math.min(100, weeklyRate)),
        currentStreak: Number(progress?.summary?.workoutStreakDays || 0),
        workoutsCompletedThisWeek,
        workoutsPlannedThisWeek,
        workoutsMissedThisWeek,
        workoutsRemainingThisWeek: Math.max(0, workoutsPlannedThisWeek - workoutsCompletedThisWeek - workoutsMissedThisWeek),
      });
      setActiveProgramData(programData || null);

      const topPlanDistribution = Array.isArray(planDistributionData?.distribution)
        ? planDistributionData.distribution.slice(0, 3)
        : [];
      if (topPlanDistribution.length > 0) {
        setMuscleDistribution(normalizeDistributionItems(topPlanDistribution));
        return;
      }

      const programFallback = buildProgramDistribution(programData);
      if (programFallback.length > 0) {
        setMuscleDistribution(programFallback);
        return;
      }

      const topHistoryDistribution = Array.isArray(historyDistributionData?.distribution)
        ? historyDistributionData.distribution.slice(0, 3)
        : [];
      if (topHistoryDistribution.length > 0) {
        setMuscleDistribution(normalizeDistributionItems(topHistoryDistribution));
        return;
      }

      setMuscleDistribution([]);
    };

    const cachedProgress = readOfflineCacheValue<any>(offlineCacheKeys.programProgress(userId));
    const cachedProgramData = readOfflineCacheValue<any>(offlineCacheKeys.userProgram(userId));
    const cachedPlanDistribution = readOfflineCacheValue<any>(offlineCacheKeys.planMuscleDistribution(userId));
    const cachedHistoryDistribution = readOfflineCacheValue<any>(offlineCacheKeys.muscleDistribution(userId, 30));
    if (cachedProgress || cachedProgramData || cachedPlanDistribution || cachedHistoryDistribution) {
      applySnapshot(
        cachedProgress || {},
        cachedProgramData || null,
        cachedPlanDistribution,
        cachedHistoryDistribution,
      );
    }

    let consistency = 0;
    let currentStreak = 0;
    let totalVolumeTons = 0;
    let totalWorkouts = 0;
    let workoutsCompletedThisWeek = 0;
    let workoutsPlannedThisWeek = 0;
    let workoutsMissedThisWeek = 0;
    let workoutsRemainingThisWeek = 0;
    let activeProgramData: any = null;

    try {
      const progress = await api.getProgramProgress(userId);
      try {
        activeProgramData = await api.getUserProgram(userId);
      } catch (programError) {
        console.error('Failed to fetch active program for weekly plan stats:', programError);
      }
      const weeklyRate = Number(progress?.summary?.weeklyCompletionRate || 0);
      consistency = Math.max(0, Math.min(100, weeklyRate));
      currentStreak = Number(progress?.summary?.workoutStreakDays || 0);
      totalWorkouts = Number(progress?.summary?.completedWorkouts || 0);
      workoutsCompletedThisWeek = Number(progress?.summary?.workoutsCompletedThisWeek || 0);
      workoutsPlannedThisWeek = inferPlannedWorkoutsThisWeek(progress, activeProgramData);
      workoutsMissedThisWeek = Number(progress?.summary?.workoutsMissedThisWeek || 0);
      workoutsRemainingThisWeek = Math.max(0, workoutsPlannedThisWeek - workoutsCompletedThisWeek - workoutsMissedThisWeek);
      const volumeLoadAllTime = Number(
        progress?.summary?.volumeLoadAllTime
        ?? progress?.summary?.volumeLoadSinceStart
        ?? progress?.summary?.volumeLoadLast30Days
        ?? 0,
      );
      totalVolumeTons = Math.round((volumeLoadAllTime / 1000) * 10) / 10;
    } catch (error) {
      console.error('Failed to fetch program progress for consistency:', error);
    }

    try {
      const response = await api.getPlanMuscleDistribution(userId);
      const top = Array.isArray(response?.distribution) ? response.distribution.slice(0, 3) : [];
      if (top.length > 0) {
        setMuscleDistribution(normalizeDistributionItems(top));
      } else {
        const programData = activeProgramData || await api.getUserProgram(userId);
        const programFallback = buildProgramDistribution(programData);
        if (programFallback.length > 0) {
          setMuscleDistribution(programFallback);
          return;
        }

        const fallbackResponse = await api.getMuscleDistribution(userId, 30);
        const fallbackTop = Array.isArray(fallbackResponse?.distribution) ? fallbackResponse.distribution.slice(0, 3) : [];
        if (fallbackTop.length > 0) {
          setMuscleDistribution(normalizeDistributionItems(fallbackTop));
        } else {
          setMuscleDistribution([]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch muscle distribution:', error);
      setMuscleDistribution([]);
    }

    setStats({
      totalWorkouts,
      totalVolume: totalVolumeTons,
      consistency,
      currentStreak,
      workoutsCompletedThisWeek,
      workoutsPlannedThisWeek,
      workoutsMissedThisWeek,
      workoutsRemainingThisWeek,
    });
    setActiveProgramData(activeProgramData);
  }, []);

  useEffect(() => {
    void loadStats();

    const handleProgressRefresh = () => {
      void loadStats();
    };

    window.addEventListener('gamification-updated', handleProgressRefresh);
    window.addEventListener('recovery-updated', handleProgressRefresh);
    window.addEventListener('program-updated', handleProgressRefresh);
    window.addEventListener(T2_CHECKIN_UPDATED_EVENT, handleProgressRefresh);

    const intervalId = window.setInterval(() => {
      void loadStats();
    }, 30000);

    return () => {
      window.removeEventListener('gamification-updated', handleProgressRefresh);
      window.removeEventListener('recovery-updated', handleProgressRefresh);
      window.removeEventListener('program-updated', handleProgressRefresh);
      window.removeEventListener(T2_CHECKIN_UPDATED_EVENT, handleProgressRefresh);
      window.clearInterval(intervalId);
    };
  }, [loadStats]);

  const plannedThisWeek = Math.max(0, Number(stats.workoutsPlannedThisWeek || 0));
  const completedThisWeek = Math.max(0, Number(stats.workoutsCompletedThisWeek || 0));
  const completionPercent = plannedThisWeek > 0
    ? Math.round((completedThisWeek / plannedThisWeek) * 100)
    : Math.round(Number(stats.consistency || 0));
  const consistencyLabel = `${completionPercent}%`;
  const weeklyDaysLabel = language === 'ar'
    ? `${completedThisWeek} / ${plannedThisWeek} أيام`
    : language === 'it'
      ? `${completedThisWeek} / ${plannedThisWeek} giorni`
      : language === 'de'
        ? `${completedThisWeek} / ${plannedThisWeek} Tage`
        : `${completedThisWeek} / ${plannedThisWeek} days`;
  const premiumConfig = useMemo(
    () => getActiveT2PremiumConfig(activeProgramData),
    [activeProgramData],
  );
  const latestT2CheckIn = getLatestT2WorkoutCheckIn();
  const premiumInsight = useMemo(
    () => (
      premiumConfig
        ? buildT2PremiumProgressInsight({
            language,
            config: premiumConfig,
            completionPercent,
            workoutsRemainingThisWeek: stats.workoutsRemainingThisWeek,
            latestCheckIn: latestT2CheckIn,
          })
        : null
    ),
    [completionPercent, language, latestT2CheckIn, premiumConfig, stats.workoutsRemainingThisWeek],
  );
  const premiumInsightToneClass = premiumInsight?.tone === 'good'
    ? 'border-emerald-400/25 bg-[linear-gradient(145deg,rgba(28,36,30,0.96),rgba(12,16,22,0.98))]'
    : premiumInsight?.tone === 'watch'
      ? 'border-amber-400/25 bg-[linear-gradient(145deg,rgba(38,30,20,0.96),rgba(14,16,22,0.98))]'
      : 'border-sky-400/20 bg-[linear-gradient(145deg,rgba(18,24,34,0.96),rgba(12,16,22,0.98))]';

  return (
    <div data-coachmark-target="progress_dashboard" className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-light text-white">{copy.title}</h1>
        <button
          type="button"
          data-coachmark-target="progress_info_button"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-card/70 text-text-secondary transition-colors hover:border-accent/30 hover:text-text-primary"
          aria-label={copy.strengthScoreInfo}
          onClick={() => setShowPageInfo(true)}
        >
          <CircleQuestionMark size={16} />
        </button>
      </div>

      <StrengthChart coachmarkTargetId="progress_strength_chart" />

      {premiumInsight && (
        <div className={`relative overflow-hidden rounded-[1.75rem] border p-5 shadow-[0_18px_44px_rgba(0,0,0,0.18)] ${premiumInsightToneClass}`}>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(191,255,0,0.14),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_42%)]" />
          <div className="relative">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                  T-2 Premium
                </div>
                <h3 className="mt-3 text-lg font-semibold text-white">{premiumInsight.title}</h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">{premiumInsight.body}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-right">
                <div className="text-[10px] uppercase tracking-[0.14em] text-text-tertiary">
                  {language === 'ar' ? '\u0627\u0644\u062d\u0627\u0644\u0629' : language === 'it' ? 'Stato' : language === 'de' ? 'Status' : 'Status'}
                </div>
                <div className="mt-1 text-sm font-semibold text-white">{consistencyLabel}</div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {premiumInsight.stats.map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">{item.label}</div>
                  <div className="mt-2 text-sm font-semibold text-white">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Card coachmarkTargetId="progress_consistency_card" className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Activity className="text-green-500 mb-2" size={20} />
              <div className="text-2xl font-bold text-white font-electrolize">{consistencyLabel}</div>
              <div className="mt-1 text-xs text-text-secondary">{weeklyDaysLabel}</div>
            </div>
            <img
              src={emojiFire}
              alt={copy.fireAlt}
              className="h-14 w-14 shrink-0 object-contain"
            />
          </div>
        </Card>
        <Card
          coachmarkTargetId="progress_total_volume_card"
          className="cursor-pointer p-4"
          onClick={onViewStrengthScore}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onViewStrengthScore();
            }
          }}
        >
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <TrendingUp className="text-purple-500 mb-2" size={20} />
              <div className="text-2xl font-bold text-white font-electrolize">
                {Number.isInteger(stats.totalVolume) ? stats.totalVolume : stats.totalVolume.toFixed(1)}t
              </div>
              <div className="text-xs text-text-secondary">{copy.totalVolume}</div>
            </div>
            <img src={emojiRightArrow} alt="" aria-hidden="true" className="mb-1 h-[18px] w-[18px] shrink-0 object-contain opacity-70" />
          </div>
        </Card>
      </div>

      <Card coachmarkTargetId="progress_muscle_distribution_card">
        <h3 className="font-medium text-white mb-4">{copy.muscleDistribution}</h3>
        {muscleDistribution.length > 0 ? (
          <>
            <div className="mb-5 grid grid-cols-3 gap-3">
              {muscleDistribution.map((m) => (
                <div
                  key={`${m.name}-image`}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
                >
                  <img
                    src={getBodyPartImage(m.name)}
                    alt={getLocalizedMuscleName(m.name, language)}
                    className="h-24 w-full object-cover object-center sm:h-28"
                    loading="lazy"
                  />
                  <div className="border-t border-white/10 px-3 py-2 text-center text-[11px] font-medium text-text-secondary">
                    {getLocalizedMuscleName(m.name, language)}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              {muscleDistribution.map((m) => (
                <div key={m.name}>
                  <div className="mb-1 flex justify-between text-xs text-text-secondary">
                    <span>{getLocalizedMuscleName(m.name, language)}</span>
                    <span className="font-electrolize">{Math.round(m.val)}%</span>
                  </div>
                  <div className="mt-1 rounded-md border border-white/10 bg-white/[0.02] p-1">
                    <div className="flex h-2 items-center gap-1">
                      {Array.from({ length: SEGMENT_COUNT }, (_, index) => {
                        const isActive = index < getActiveSegments(m.val);
                        return (
                          <div
                            key={`${m.name}-segment-${index}`}
                            className="h-full flex-1 rounded-[2px] transition-colors duration-300"
                            style={{ backgroundColor: getSegmentColor(index, isActive) }}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-white/8 bg-background/50 px-4 py-4 text-sm text-text-secondary">
            {copy.noPlanDistribution}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-3">
        <Button coachmarkTargetId="progress_biweekly_report_button" variant="secondary" onClick={onViewReport}>
          {copy.viewBiWeeklyReport}
        </Button>
      </div>

      {showPageInfo && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 px-4"
          onClick={() => setShowPageInfo(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-card p-5"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={copy.progressDialogAria}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">{copy.progressDialogTitle}</h3>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-text-secondary transition-colors hover:border-accent/30 hover:text-text-primary"
                onClick={() => setShowPageInfo(false)}
                aria-label={copy.close}
              >
                <X size={14} />
              </button>
            </div>
            <div className="space-y-2 text-sm text-text-secondary">
              <p>{copy.infoLine1}</p>
              <p>{copy.infoLine2}</p>
              <p>{copy.infoLine3}</p>
              <p>{copy.infoLine4}</p>
              <p>{copy.infoLine5}</p>
            </div>
          </div>
        </div>
      )}
    </div>);

}
