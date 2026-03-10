import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/Button';
import { StrengthChart } from './StrengthChart';
import { Card } from '../ui/Card';
import { Activity, ChevronRight, TrendingUp } from 'lucide-react';
import { api } from '../../services/api';
import { emojiFire } from '../../services/emojiTheme';
interface ProgressDashboardProps {
  onViewReport: () => void;
  onViewStrengthScore: () => void;
}

interface MuscleDistributionItem {
  name: string;
  val: number;
  col: string;
}

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
  const [muscleDistribution, setMuscleDistribution] = useState<MuscleDistributionItem[]>([
    { name: 'Chest', val: 0, col: 'bg-blue-500' },
    { name: 'Back', val: 0, col: 'bg-indigo-500' },
    { name: 'Legs', val: 0, col: 'bg-purple-500' },
  ]);

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
      setMuscleDistribution([
        { name: 'Chest', val: 0, col: 'bg-blue-500' },
        { name: 'Back', val: 0, col: 'bg-indigo-500' },
        { name: 'Legs', val: 0, col: 'bg-purple-500' },
      ]);
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
      const palette = ['bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-cyan-500', 'bg-emerald-500'];
      const top = Array.isArray(response?.distribution) ? response.distribution.slice(0, 3) : [];
      if (top.length > 0) {
        setMuscleDistribution(
          top.map((item: any, index: number) => ({
            name: String(item.muscle || '-'),
            val: Math.max(0, Math.min(100, Number(item.percent || 0))),
            col: palette[index % palette.length],
          })),
        );
      } else {
        const fallbackResponse = await api.getMuscleDistribution(userId, 30);
        const fallbackTop = Array.isArray(fallbackResponse?.distribution) ? fallbackResponse.distribution.slice(0, 3) : [];
        if (fallbackTop.length > 0) {
          setMuscleDistribution(
            fallbackTop.map((item: any, index: number) => ({
              name: String(item.muscle || '-'),
              val: Math.max(0, Math.min(100, Number(item.percent || 0))),
              col: palette[index % palette.length],
            })),
          );
        } else {
          setMuscleDistribution([
            { name: 'Chest', val: 0, col: 'bg-blue-500' },
            { name: 'Back', val: 0, col: 'bg-indigo-500' },
            { name: 'Legs', val: 0, col: 'bg-purple-500' },
          ]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch muscle distribution:', error);
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

    const intervalId = window.setInterval(() => {
      void loadStats();
    }, 30000);

    return () => {
      window.removeEventListener('gamification-updated', handleProgressRefresh);
      window.removeEventListener('recovery-updated', handleProgressRefresh);
      window.clearInterval(intervalId);
    };
  }, [loadStats]);

  const streakLabel = `${stats.currentStreak}%`;
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
        <div className="space-y-3">
          {muscleDistribution.map((m) =>
          <div key={m.name}>
              <div className="flex justify-between text-xs mb-1 text-text-secondary">
                <span>{m.name}</span>
                <span className="font-electrolize">{Math.round(m.val)}%</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                className={`h-full rounded-full ${m.col}`}
                style={{
                  width: `${m.val}%`
                }} />

              </div>
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3">
        <Button variant="secondary" onClick={onViewReport}>
          View Bi-Weekly Report
        </Button>
      </div>
    </div>);

}
