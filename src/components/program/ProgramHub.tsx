import React, { useState, useEffect } from 'react';
import { ProgramGeneratorScreen } from './ProgramGeneratorScreen';
import { ProgramOverviewScreen } from './ProgramOverviewScreen';
import { ProgramWorkoutTracker } from './ProgramWorkoutTracker';
import { ProgramProgressScreen } from './ProgramProgressScreen';
import { Dumbbell, TrendingUp, Plus } from 'lucide-react';

type Screen = 'hub' | 'generator' | 'overview' | 'tracker' | 'progress';

export const ProgramHub: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('hub');
  const [activeProgram, setActiveProgram] = useState<any>(null);
  const [selectedDay, setSelectedDay] = useState<any>(null);
  const [selectedWeek, setSelectedWeek] = useState(1);

  useEffect(() => {
    const saved = localStorage.getItem('activeProgram');
    if (saved) {
      setActiveProgram(JSON.parse(saved));
    }
  }, []);

  const handleProgramGenerated = (program: any) => {
    setActiveProgram(program);
    setScreen('overview');
  };

  const handleStartWorkout = (day: any, weekNumber: number) => {
    setSelectedDay(day);
    setSelectedWeek(weekNumber);
    setScreen('tracker');
  };

  const handleWorkoutComplete = () => {
    setScreen('overview');
  };

  if (screen === 'generator') {
    return (
      <ProgramGeneratorScreen
        onBack={() => setScreen('hub')}
        onProgramGenerated={handleProgramGenerated}
      />
    );
  }

  if (screen === 'overview' && activeProgram) {
    return (
      <ProgramOverviewScreen
        program={activeProgram}
        onBack={() => setScreen('hub')}
        onStartWorkout={handleStartWorkout}
      />
    );
  }

  if (screen === 'tracker' && selectedDay) {
    return (
      <ProgramWorkoutTracker
        day={selectedDay}
        weekNumber={selectedWeek}
        onBack={() => setScreen('overview')}
        onComplete={handleWorkoutComplete}
      />
    );
  }

  if (screen === 'progress') {
    return <ProgramProgressScreen onBack={() => setScreen('hub')} />;
  }

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white pb-20">
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-2">Training Programs</h1>
        <p className="text-gray-400 mb-6">Jeff Nippard's Fundamentals</p>

        {activeProgram ? (
          <div className="space-y-4">
            <div className="bg-[#242424] rounded-lg p-4 border-2 border-[#10b981]">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="font-semibold">{activeProgram.programName}</h2>
                  <p className="text-sm text-gray-400">
                    Week {activeProgram.currentWeek}/{activeProgram.weeks}
                  </p>
                </div>
                <Dumbbell size={24} className="text-emerald-600" />
              </div>
              <button
                onClick={() => setScreen('overview')}
                className="w-full bg-[#10b981] text-black py-3 rounded-lg font-semibold"
              >
                View Program
              </button>
            </div>

            <button
              onClick={() => setScreen('progress')}
              className="w-full bg-[#242424] rounded-lg p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <TrendingUp size={20} className="text-emerald-600" />
                <span className="font-semibold">View Progress</span>
              </div>
              <span className="text-gray-400">→</span>
            </button>

            <button
              onClick={() => setScreen('generator')}
              className="w-full bg-[#242424] rounded-lg p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Plus size={20} className="text-emerald-600" />
                <span className="font-semibold">Generate New Program</span>
              </div>
              <span className="text-gray-400">→</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-[#242424] rounded-lg p-6 text-center">
              <Dumbbell size={48} className="text-emerald-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">No Active Program</h2>
              <p className="text-gray-400 mb-4">
                Generate a personalized training program based on your goals and experience
              </p>
              <button
                onClick={() => setScreen('generator')}
                className="bg-[#10b981] text-black px-6 py-3 rounded-lg font-semibold"
              >
                Generate Program
              </button>
            </div>

            <div className="bg-[#242424] rounded-lg p-4">
              <h3 className="font-semibold mb-2">What You'll Get:</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600">✓</span>
                  <span>8-week structured program</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600">✓</span>
                  <span>Exercise selection based on your level</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600">✓</span>
                  <span>Progressive overload built-in</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600">✓</span>
                  <span>Nutrition guidelines</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600">✓</span>
                  <span>Week-by-week progress tracking</span>
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

