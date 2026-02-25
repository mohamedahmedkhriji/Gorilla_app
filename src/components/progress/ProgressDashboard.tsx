import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { StrengthChart } from './StrengthChart';
import { Card } from '../ui/Card';
import { Activity, TrendingUp, Camera, Ruler, Dumbbell, Sparkles, BarChart3 } from 'lucide-react';
interface ProgressDashboardProps {
  onViewReport: () => void;
  onNavigate: (screen: string) => void;
}
export function ProgressDashboard({ onViewReport, onNavigate }: ProgressDashboardProps) {
  const [stats, setStats] = useState({
    totalWorkouts: 0,
    totalVolume: 0,
    consistency: 0,
    currentStreak: 0
  });

  useEffect(() => {
    const workoutHistory = JSON.parse(localStorage.getItem('programHistory') || '[]');
    const totalWorkouts = workoutHistory.length;
    const totalVolume = workoutHistory.reduce((sum: number, w: any) => {
      return sum + w.exercises.reduce((exSum: number, ex: any) => {
        return exSum + ex.sets.reduce((setSum: number, s: any) => setSum + (s.weight * s.reps), 0);
      }, 0);
    }, 0);

    const last30Days = workoutHistory.filter((w: any) => {
      const date = new Date(w.date);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      return diff < 30 * 24 * 60 * 60 * 1000;
    });
    const consistency = Math.round((last30Days.length / 30) * 100);

    setStats({
      totalWorkouts,
      totalVolume: Math.round(totalVolume / 1000),
      consistency,
      currentStreak: 7
    });
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
          <div className="text-2xl font-bold text-white">{stats.totalVolume}t</div>
          <div className="text-xs text-text-secondary">Total Volume</div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onNavigate('measurements')}
          className="bg-[#242424] rounded-lg p-4 flex flex-col items-start hover:bg-[#2A2A2A] transition-colors"
        >
          <Ruler size={20} className="text-[#BFFF00] mb-2" />
          <div className="text-sm font-semibold">Measurements</div>
          <div className="text-xs text-gray-400">Track body stats</div>
        </button>
        <button
          onClick={() => onNavigate('photos')}
          className="bg-[#242424] rounded-lg p-4 flex flex-col items-start hover:bg-[#2A2A2A] transition-colors"
        >
          <Camera size={20} className="text-[#BFFF00] mb-2" />
          <div className="text-sm font-semibold">Photos</div>
          <div className="text-xs text-gray-400">Compare progress</div>
        </button>
        <button
          onClick={() => onNavigate('exercise')}
          className="bg-[#242424] rounded-lg p-4 flex flex-col items-start hover:bg-[#2A2A2A] transition-colors"
        >
          <BarChart3 size={20} className="text-[#BFFF00] mb-2" />
          <div className="text-sm font-semibold">Exercise Stats</div>
          <div className="text-xs text-gray-400">Strength graphs</div>
        </button>
        <button
          onClick={() => onNavigate('insights')}
          className="bg-[#242424] rounded-lg p-4 flex flex-col items-start hover:bg-[#2A2A2A] transition-colors"
        >
          <Sparkles size={20} className="text-[#BFFF00] mb-2" />
          <div className="text-sm font-semibold">AI Insights</div>
          <div className="text-xs text-gray-400">Get analysis</div>
        </button>
      </div>

      <Card>
        <h3 className="font-medium text-white mb-4">Muscle Distribution</h3>
        <div className="space-y-3">
          {[
          {
            name: 'Chest',
            val: 75,
            col: 'bg-blue-500'
          },
          {
            name: 'Back',
            val: 60,
            col: 'bg-indigo-500'
          },
          {
            name: 'Legs',
            val: 45,
            col: 'bg-purple-500'
          }].
          map((m) =>
          <div key={m.name}>
              <div className="flex justify-between text-xs mb-1 text-text-secondary">
                <span>{m.name}</span>
                <span>{m.val}%</span>
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