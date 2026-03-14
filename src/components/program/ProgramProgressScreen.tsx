import React, { useState, useEffect } from 'react';
import { ArrowLeft, TrendingUp, Calendar, Dumbbell, Clock, Award } from 'lucide-react';

interface ProgramProgressScreenProps {
  onBack: () => void;
}

export const ProgramProgressScreen: React.FC<ProgramProgressScreenProps> = ({ onBack }) => {
  const [history, setHistory] = useState<any[]>([]);
  const [activeProgram, setActiveProgram] = useState<any>(null);

  useEffect(() => {
    const saved = localStorage.getItem('programHistory');
    if (saved) setHistory(JSON.parse(saved));

    const program = localStorage.getItem('activeProgram');
    if (program) setActiveProgram(JSON.parse(program));
  }, []);

  const groupByWeek = () => {
    const weeks: any = {};
    history.forEach(workout => {
      const week = workout.weekNumber;
      if (!weeks[week]) weeks[week] = [];
      weeks[week].push(workout);
    });
    return weeks;
  };

  const weeklyData = groupByWeek();
  const totalWorkouts = history.length;
  const totalTime = history.reduce((sum, w) => sum + (w.duration || 0), 0);
  const avgDuration = totalWorkouts > 0 ? Math.floor(totalTime / totalWorkouts / 60) : 0;

  const getWeekCompletion = (weekNum: number) => {
    const workouts = weeklyData[weekNum] || [];
    const expectedWorkouts = activeProgram?.schedule?.length || 3;
    return Math.min(100, Math.floor((workouts.length / expectedWorkouts) * 100));
  };

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white pb-20">
      <div className="p-4">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 mb-6">
          <ArrowLeft size={20} />
          <span>Back</span>
        </button>

        <h1 className="text-2xl font-bold mb-6">Program Progress</h1>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-[#242424] rounded-lg p-4">
            <Dumbbell size={20} className="text-emerald-600 mb-2" />
            <div className="text-2xl font-bold">{totalWorkouts}</div>
            <div className="text-xs text-gray-400">Workouts</div>
          </div>
          <div className="bg-[#242424] rounded-lg p-4">
            <Clock size={20} className="text-emerald-600 mb-2" />
            <div className="text-2xl font-bold">{avgDuration}</div>
            <div className="text-xs text-gray-400">Avg Min</div>
          </div>
          <div className="bg-[#242424] rounded-lg p-4">
            <Award size={20} className="text-emerald-600 mb-2" />
            <div className="text-2xl font-bold">{Object.keys(weeklyData).length}</div>
            <div className="text-xs text-gray-400">Weeks</div>
          </div>
        </div>

        {activeProgram && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Weekly Progress</h2>
            <div className="space-y-3">
              {Array.from({ length: activeProgram.weeks }, (_, i) => i + 1).map(weekNum => {
                const completion = getWeekCompletion(weekNum);
                const workouts = weeklyData[weekNum] || [];
                const isCurrent = weekNum === activeProgram.currentWeek;

                return (
                  <div key={weekNum} className={`bg-[#242424] rounded-lg p-4 ${isCurrent ? 'border-2 border-[#10b981]' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-emerald-600" />
                        <span className="font-semibold">Week {weekNum}</span>
                        {isCurrent && <span className="text-xs bg-[#10b981] text-black px-2 py-1 rounded">Current</span>}
                      </div>
                      <span className="text-sm text-gray-400">{workouts.length} workouts</span>
                    </div>
                    <div className="w-full bg-[#1A1A1A] rounded-full h-2">
                      <div
                        className="bg-[#10b981] h-2 rounded-full transition-all"
                        style={{ width: `${completion}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{completion}% complete</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Recent Workouts</h2>
          <div className="space-y-3">
            {history.slice(-5).reverse().map((workout, idx) => (
              <div key={idx} className="bg-[#242424] rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-semibold">{workout.day}</div>
                    <div className="text-sm text-gray-400">Week {workout.weekNumber}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{Math.floor(workout.duration / 60)} min</div>
                    <div className="text-xs text-gray-400">
                      {new Date(workout.date).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <TrendingUp size={14} />
                  <span>{workout.exercises.length} exercises</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

