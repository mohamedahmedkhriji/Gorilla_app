import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/Button';
import { StrengthChart } from './StrengthChart';
import { Card } from '../ui/Card';
import { Activity, CircleQuestionMark, TrendingUp, X } from 'lucide-react';
import { api } from '../../services/api';
import { emojiFire, emojiRightArrow } from '../../services/emojiTheme';
import { getBodyPartImage } from '../../services/bodyPartTheme';
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
  if (/shoulder|overhead press|lateral raise|rear delt/.test(name)) matches.push('Shoulders', 'Triceps');
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
      return;
    }

    let consistency = 0;
    let currentStreak = 0;
    let totalVolumeTons = 0;
    let totalWorkouts = 0;
    let workoutsCompletedThisWeek = 0;
    let workoutsPlannedThisWeek = 0;
    let workoutsMissedThisWeek = 0;
    let workoutsRemainingThisWeek = 0;

    try {
      const progress = await api.getProgramProgress(userId);
      const weeklyRate = Number(progress?.summary?.weeklyCompletionRate || 0);
      consistency = Math.max(0, Math.min(100, weeklyRate));
      currentStreak = Number(progress?.summary?.workoutStreakDays || 0);
      totalWorkouts = Number(progress?.summary?.completedWorkouts || 0);
      workoutsCompletedThisWeek = Number(progress?.summary?.workoutsCompletedThisWeek || 0);
      workoutsPlannedThisWeek = Number(progress?.summary?.workoutsPlannedThisWeek || 0);
      workoutsMissedThisWeek = Number(progress?.summary?.workoutsMissedThisWeek || 0);
      workoutsRemainingThisWeek = Number(progress?.summary?.workoutsRemainingThisWeek || 0);
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
        const programData = await api.getUserProgram(userId);
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
  }, []);

  useEffect(() => {
    void loadStats();

    const handleProgressRefresh = () => {
      void loadStats();
    };

    window.addEventListener('gamification-updated', handleProgressRefresh);
    window.addEventListener('recovery-updated', handleProgressRefresh);
    window.addEventListener('program-updated', handleProgressRefresh);

    const intervalId = window.setInterval(() => {
      void loadStats();
    }, 30000);

    return () => {
      window.removeEventListener('gamification-updated', handleProgressRefresh);
      window.removeEventListener('recovery-updated', handleProgressRefresh);
      window.removeEventListener('program-updated', handleProgressRefresh);
      window.clearInterval(intervalId);
    };
  }, [loadStats]);

  const plannedThisWeek = Math.max(0, Number(stats.workoutsPlannedThisWeek || 0));
  const completedThisWeek = Math.max(0, Number(stats.workoutsCompletedThisWeek || 0));
  const completionPercent = plannedThisWeek > 0
    ? Math.round((completedThisWeek / plannedThisWeek) * 100)
    : Math.round(Number(stats.consistency || 0));
  const consistencyLabel = `${completionPercent}%`;
  const weeklyDaysLabel = `${completedThisWeek} / ${plannedThisWeek} days`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-light text-white">Your Progress</h1>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-card/70 text-text-secondary transition-colors hover:border-accent/30 hover:text-text-primary"
          aria-label="Strength score info"
          onClick={() => setShowPageInfo(true)}
        >
          <CircleQuestionMark size={16} />
        </button>
      </div>

      <StrengthChart />

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Activity className="text-green-500 mb-2" size={20} />
              <div className="text-2xl font-bold text-white font-electrolize">{consistencyLabel}</div>
              <div className="mt-1 text-xs text-text-secondary">{weeklyDaysLabel}</div>
            </div>
            <img
              src={emojiFire}
              alt="Fire"
              className="h-14 w-14 shrink-0 object-contain"
            />
          </div>
        </Card>
        <Card
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
              <div className="text-xs text-text-secondary">Total Volume</div>
            </div>
            <img src={emojiRightArrow} alt="" aria-hidden="true" className="mb-1 h-[18px] w-[18px] shrink-0 object-contain opacity-70" />
          </div>
        </Card>
      </div>

      <Card>
        <h3 className="font-medium text-white mb-4">Muscle Distribution (Plan Target)</h3>
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
                    alt={m.name}
                    className="h-24 w-full object-cover object-center sm:h-28"
                    loading="lazy"
                  />
                  <div className="border-t border-white/10 px-3 py-2 text-center text-[11px] font-medium text-text-secondary">
                    {m.name}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              {muscleDistribution.map((m) => (
                <div key={m.name}>
                  <div className="mb-1 flex justify-between text-xs text-text-secondary">
                    <span>{m.name}</span>
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
            No plan distribution is available yet for this user.
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-3">
        <Button variant="secondary" onClick={onViewReport}>
          View Bi-Weekly Report
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
            aria-label="Progress page info dialog"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">What&apos;s on this page</h3>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-text-secondary transition-colors hover:border-accent/30 hover:text-text-primary"
                onClick={() => setShowPageInfo(false)}
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>
            <div className="space-y-2 text-sm text-text-secondary">
              <p>Your weekly strength trend (estimated 1RM).</p>
              <p>Your weekly consistency percentage and completed days.</p>
              <p>Your total lifted volume.</p>
              <p>Your top target muscles for the current plan.</p>
              <p>Next overload recommendations and quick report access.</p>
            </div>
          </div>
        </div>
      )}
    </div>);

}
