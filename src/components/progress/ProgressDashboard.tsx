import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { StrengthChart } from './StrengthChart';
import { Card } from '../ui/Card';
import { Activity, TrendingUp } from 'lucide-react';
import { api } from '../../services/api';
interface ProgressDashboardProps {
  onViewReport: () => void;
}

interface MuscleDistributionItem {
  name: string;
  val: number;
  col: string;
}

export function ProgressDashboard({ onViewReport }: ProgressDashboardProps) {
  const [stats, setStats] = useState({
    totalWorkouts: 0,
    totalVolume: 0,
    consistency: 0,
    currentStreak: 0
  });
  const [muscleDistribution, setMuscleDistribution] = useState<MuscleDistributionItem[]>([
    { name: 'Chest', val: 0, col: 'bg-blue-500' },
    { name: 'Back', val: 0, col: 'bg-indigo-500' },
    { name: 'Legs', val: 0, col: 'bg-purple-500' },
  ]);

  useEffect(() => {
    const loadStats = async () => {
      const workoutHistory = JSON.parse(localStorage.getItem('programHistory') || '[]');
      const totalWorkouts = workoutHistory.length;
      const totalVolumeLocal = workoutHistory.reduce((sum: number, w: any) => {
        return sum + w.exercises.reduce((exSum: number, ex: any) => {
          return exSum + ex.sets.reduce((setSum: number, s: any) => setSum + (s.weight * s.reps), 0);
        }, 0);
      }, 0);
      let totalVolumeTons = Math.round(totalVolumeLocal / 1000);

      const localUserId = Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || 0);
      const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
      const parsedUserId = Number(user?.id || 0);
      const userId = localUserId || parsedUserId;

      let consistency = 0;
      let currentStreak = 0;

      if (userId) {
        try {
          const progress = await api.getProgramProgress(userId);
          const weeklyRate = Number(progress?.summary?.weeklyCompletionRate || 0);
          consistency = Math.max(0, Math.min(100, weeklyRate));
          currentStreak = Number(progress?.summary?.workoutStreakDays || 0);
          const volumeLoadLast30Days = Number(progress?.summary?.volumeLoadLast30Days || 0);
          totalVolumeTons = Math.round((volumeLoadLast30Days / 1000) * 10) / 10;
        } catch (error) {
          console.error('Failed to fetch program progress for consistency:', error);
        }

        try {
          const response = await api.getMuscleDistribution(userId, 30);
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
          }
        } catch (error) {
          console.error('Failed to fetch muscle distribution:', error);
        }
      }

      setStats({
        totalWorkouts,
        totalVolume: totalVolumeTons,
        consistency,
        currentStreak
      });
    };

    loadStats();
  }, []);
  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-light text-white">Your Progress</h1>
        <div className="px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-bold">
          Top 5%
        </div>
      </div>

      <StrengthChart />

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <Activity className="text-green-500 mb-2" size={20} />
          <div className="text-2xl font-bold text-white">{stats.consistency}%</div>
          <div className="text-xs text-text-secondary">Consistency</div>
        </Card>
        <Card className="p-4">
          <TrendingUp className="text-purple-500 mb-2" size={20} />
          <div className="text-2xl font-bold text-white">
            {Number.isInteger(stats.totalVolume) ? stats.totalVolume : stats.totalVolume.toFixed(1)}t
          </div>
          <div className="text-xs text-text-secondary">Total Volume</div>
        </Card>
      </div>

      <Card>
        <h3 className="font-medium text-white mb-4">Muscle Distribution</h3>
        <div className="space-y-3">
          {muscleDistribution.map((m) =>
          <div key={m.name}>
              <div className="flex justify-between text-xs mb-1 text-text-secondary">
                <span>{m.name}</span>
                <span>{Math.round(m.val)}%</span>
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

      <Button variant="secondary" onClick={onViewReport}>
        View Bi-Weekly Report
      </Button>
    </div>);

}
