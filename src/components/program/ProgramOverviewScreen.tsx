import React, { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, TrendingUp, Utensils, BookOpen, Play } from 'lucide-react';

interface ProgramOverviewScreenProps {
  program: any;
  onBack: () => void;
  onStartWorkout: (day: any, weekNumber: number) => void;
}

export const ProgramOverviewScreen: React.FC<ProgramOverviewScreenProps> = ({ program, onBack, onStartWorkout }) => {
  const [activeTab, setActiveTab] = useState<'schedule' | 'nutrition' | 'principles'>('schedule');
  const [currentWeek, setCurrentWeek] = useState(1);

  useEffect(() => {
    const saved = localStorage.getItem('activeProgram');
    if (saved) {
      const data = JSON.parse(saved);
      setCurrentWeek(data.currentWeek || 1);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white pb-20">
      <div className="p-4">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 mb-6">
          <ArrowLeft size={20} />
          <span>Back</span>
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1">{program.programName}</h1>
          <p className="text-gray-400">{program.phase} • Week {currentWeek}/{program.weeks}</p>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-4 py-2 rounded-lg whitespace-nowrap ${
              activeTab === 'schedule' ? 'bg-[#10b981] text-black' : 'bg-[#242424]'
            }`}
          >
            <Calendar size={16} className="inline mr-2" />
            Schedule
          </button>
          <button
            onClick={() => setActiveTab('nutrition')}
            className={`px-4 py-2 rounded-lg whitespace-nowrap ${
              activeTab === 'nutrition' ? 'bg-[#10b981] text-black' : 'bg-[#242424]'
            }`}
          >
            <Utensils size={16} className="inline mr-2" />
            Nutrition
          </button>
          <button
            onClick={() => setActiveTab('principles')}
            className={`px-4 py-2 rounded-lg whitespace-nowrap ${
              activeTab === 'principles' ? 'bg-[#10b981] text-black' : 'bg-[#242424]'
            }`}
          >
            <BookOpen size={16} className="inline mr-2" />
            Principles
          </button>
        </div>

        {activeTab === 'schedule' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Week {currentWeek}</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentWeek(Math.max(1, currentWeek - 1))}
                  disabled={currentWeek === 1}
                  className="px-3 py-1 bg-[#242424] rounded disabled:opacity-50"
                >
                  ←
                </button>
                <button
                  onClick={() => setCurrentWeek(Math.min(program.weeks, currentWeek + 1))}
                  disabled={currentWeek === program.weeks}
                  className="px-3 py-1 bg-[#242424] rounded disabled:opacity-50"
                >
                  →
                </button>
              </div>
            </div>

            {program.schedule.map((day: any, idx: number) => (
              <div key={idx} className="bg-[#242424] rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{day.day}</h3>
                    <p className="text-sm text-gray-400">{day.focus}</p>
                  </div>
                  <button
                    onClick={() => onStartWorkout(day, currentWeek)}
                    className="bg-[#10b981] text-black px-4 py-2 rounded-lg flex items-center gap-2"
                  >
                    <Play size={16} />
                    Start
                  </button>
                </div>
                <div className="space-y-2">
                  {day.exercises.map((ex: any, i: number) => (
                    <div key={i} className="text-sm border-l-2 border-[#10b981] pl-3 py-1">
                      <div className="font-medium">{ex.name}</div>
                      <div className="text-gray-400">
                        {ex.sets} sets × {ex.reps} reps • {ex.rest} rest
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'nutrition' && (
          <div className="space-y-4">
            <div className="bg-[#242424] rounded-lg p-4">
              <h3 className="font-semibold mb-4">Daily Targets</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-2xl font-bold text-emerald-600">{program.nutrition.calories}</div>
                  <div className="text-sm text-gray-400">Calories</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-emerald-600">{program.nutrition.protein}g</div>
                  <div className="text-sm text-gray-400">Protein</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-emerald-600">{program.nutrition.carbs}g</div>
                  <div className="text-sm text-gray-400">Carbs</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-emerald-600">{program.nutrition.fats}g</div>
                  <div className="text-sm text-gray-400">Fats</div>
                </div>
              </div>
              {program.nutrition.notes && (
                <div className="mt-4 p-3 bg-[#1A1A1A] rounded text-sm text-gray-300">
                  {program.nutrition.notes}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'principles' && (
          <div className="space-y-3">
            {program.principles.map((principle: string, idx: number) => (
              <div key={idx} className="bg-[#242424] rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <TrendingUp size={20} className="text-emerald-600 mt-1 flex-shrink-0" />
                  <p className="text-sm">{principle}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

