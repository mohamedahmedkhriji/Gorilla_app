import React, { useState, useEffect } from 'react';
import { ArrowLeft, TrendingUp } from 'lucide-react';

interface ExerciseProgressScreenProps {
  onBack: () => void;
}

export const ExerciseProgressScreen: React.FC<ExerciseProgressScreenProps> = ({ onBack }) => {
  const [workoutHistory, setWorkoutHistory] = useState<any[]>([]);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [exercises, setExercises] = useState<string[]>([]);

  useEffect(() => {
    const history = JSON.parse(localStorage.getItem('programHistory') || '[]');
    setWorkoutHistory(history);

    const uniqueExercises = new Set<string>();
    history.forEach((workout: any) => {
      workout.exercises?.forEach((ex: any) => {
        uniqueExercises.add(ex.name);
      });
    });
    const exerciseList = Array.from(uniqueExercises);
    setExercises(exerciseList);
    if (exerciseList.length > 0) setSelectedExercise(exerciseList[0]);
  }, []);

  const getExerciseData = () => {
    const data: { date: string; maxWeight: number }[] = [];
    
    workoutHistory.forEach((workout) => {
      workout.exercises?.forEach((ex: any) => {
        if (ex.name === selectedExercise) {
          const maxWeight = Math.max(...ex.sets.map((s: any) => s.weight || 0));
          if (maxWeight > 0) {
            data.push({
              date: new Date(workout.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              maxWeight
            });
          }
        }
      });
    });

    return data;
  };

  const exerciseData = getExerciseData();
  const maxWeight = Math.max(...exerciseData.map(d => d.maxWeight), 0);
  const minWeight = Math.min(...exerciseData.map(d => d.maxWeight), 0);
  const improvement = exerciseData.length > 1 
    ? exerciseData[exerciseData.length - 1].maxWeight - exerciseData[0].maxWeight 
    : 0;

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white pb-20">
      <div className="p-4">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 mb-6">
          <ArrowLeft size={20} />
          <span>Back</span>
        </button>

        <h1 className="text-2xl font-bold mb-6">Exercise Progress</h1>

        <select
          value={selectedExercise}
          onChange={(e) => setSelectedExercise(e.target.value)}
          className="w-full bg-[#242424] rounded-lg px-4 py-3 mb-6"
        >
          {exercises.map((ex) => (
            <option key={ex} value={ex}>{ex}</option>
          ))}
        </select>

        {improvement !== 0 && (
          <div className="bg-[#242424] rounded-lg p-4 mb-6 flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-400">Total Improvement</div>
              <div className="text-2xl font-bold text-emerald-600">+{improvement.toFixed(1)}kg</div>
            </div>
            <TrendingUp size={32} className="text-emerald-600" />
          </div>
        )}

        {exerciseData.length > 0 ? (
          <div className="bg-[#242424] rounded-lg p-4 mb-6">
            <div className="h-48 relative">
              <svg className="w-full h-full" viewBox="0 0 400 200">
                {exerciseData.map((d, i) => {
                  const x = (i / Math.max(exerciseData.length - 1, 1)) * 380 + 10;
                  const y = 180 - ((d.maxWeight - minWeight) / Math.max(maxWeight - minWeight, 1)) * 160;
                  const nextPoint = exerciseData[i + 1];
                  const nextX = nextPoint ? ((i + 1) / Math.max(exerciseData.length - 1, 1)) * 380 + 10 : x;
                  const nextY = nextPoint ? 180 - ((nextPoint.maxWeight - minWeight) / Math.max(maxWeight - minWeight, 1)) * 160 : y;
                  
                  return (
                    <g key={i}>
                      {i < exerciseData.length - 1 && (
                        <line x1={x} y1={y} x2={nextX} y2={nextY} stroke="#10b981" strokeWidth="2" />
                      )}
                      <circle cx={x} cy={y} r="4" fill="#10b981" />
                    </g>
                  );
                })}
              </svg>
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-2">
              <span>{exerciseData[0]?.date}</span>
              <span>{exerciseData[exerciseData.length - 1]?.date}</span>
            </div>
          </div>
        ) : (
          <div className="bg-[#242424] rounded-lg p-8 text-center text-gray-400 mb-6">
            No data available for this exercise
          </div>
        )}

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Recent Sessions</h2>
          {exerciseData.slice(-5).reverse().map((d, idx) => (
            <div key={idx} className="bg-[#242424] rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm text-gray-400">{d.date}</span>
              <span className="font-semibold">{d.maxWeight}kg</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

