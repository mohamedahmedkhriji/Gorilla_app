import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/Button';
import { StrengthChart } from './StrengthChart';
import { Card } from '../ui/Card';
import { Activity, ChevronRight, TrendingUp } from 'lucide-react';
import { api } from '../../services/api';
import { emojiFire } from '../../services/emojiTheme';
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
  });
  const [topBadge, setTopBadge] = useState('Top --');
  const [muscleDistribution, setMuscleDistribution] = useState<MuscleDistributionItem[]>([]);

  const getUserId = () => {
    const localUserId = Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || 0);
    const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
    const parsedUserId = Number(user?.id || 0);
    return localUserId || parsedUserId;
  };

  const loadStats = useCallback(async () => {
    const userId = getUserId();
    if (!userId) {
      setTopBadge('Top --');
      setStats({
        totalWorkouts: 0,
        totalVolume: 0,
        consistency: 0,
        currentStreak: 0,
        workoutsCompletedThisWeek: 0,
        workoutsPlannedThisWeek: 0,
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

    try {
      const progress = await api.getProgramProgress(userId);
      const weeklyRate = Number(progress?.summary?.weeklyCompletionRate || 0);
      consistency = Math.max(0, Math.min(100, weeklyRate));
      currentStreak = Number(progress?.summary?.workoutStreakDays || 0);
      totalWorkouts = Number(progress?.summary?.completedWorkouts || 0);
      workoutsCompletedThisWeek = Number(progress?.summary?.workoutsCompletedThisWeek || 0);
      workoutsPlannedThisWeek = Number(progress?.summary?.workoutsPlannedThisWeek || 0);
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
      const leaderboardResponse = await api.getLeaderboard(userId, 'alltime');
      const leaderboard = Array.isArray(leaderboardResponse?.leaderboard)
        ? leaderboardResponse.leaderboard
        : [];
      const totalUsers = leaderboard.length;
      const rankIndex = leaderboard.findIndex((item: any) => Number(item?.id || 0) === userId);

      if (rankIndex >= 0 && totalUsers > 0) {
        const percentile = Math.max(1, Math.round(((rankIndex + 1) / totalUsers) * 100));
        setTopBadge(`Top ${percentile}%`);
      } else {
        setTopBadge('Top --');
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard badge:', error);
      setTopBadge('Top --');
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

  const streakLabel = String(stats.currentStreak || 0);
  const streakSubLabel = stats.currentStreak === 1 ? 'streak day' : 'streak days';
  const weeklyDaysLabel = `${stats.workoutsCompletedThisWeek} / ${stats.workoutsPlannedThisWeek} days`;

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-light text-white">Your Progress</h1>
        <div className="px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-bold">
          {topBadge}
        </div>
      </div>

      <StrengthChart />

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Activity className="text-green-500 mb-2" size={20} />
              <div className="text-2xl font-bold text-white font-electrolize">{streakLabel}</div>
              <div className="text-xs text-text-secondary">{streakSubLabel}</div>
              <div className="mt-1 text-xs text-text-tertiary">{weeklyDaysLabel}</div>
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
            <ChevronRight size={18} className="mb-1 shrink-0 text-text-tertiary" />
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
    </div>);

}
