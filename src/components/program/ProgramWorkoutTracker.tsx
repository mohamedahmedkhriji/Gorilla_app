import React, { useState, useEffect } from 'react';
import { ArrowLeft, Check, Timer, TrendingUp } from 'lucide-react';
import { api } from '../../services/api';
import { stripExercisePrefix } from '../../services/exerciseName';

interface ProgramWorkoutTrackerProps {
  day: any;
  weekNumber: number;
  onBack: () => void;
  onComplete: () => void;
}

interface ExerciseSet {
  weight: number;
  reps: number;
  completed: boolean;
}

export const ProgramWorkoutTracker: React.FC<ProgramWorkoutTrackerProps> = ({ day, weekNumber, onBack, onComplete }) => {
  const [exercises, setExercises] = useState<any[]>([]);
  const [timer, setTimer] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    const initialExercises = day.exercises.map((ex: any) => ({
      ...ex,
      sets: Array(ex.sets).fill(null).map(() => ({ weight: 0, reps: 0, completed: false }))
    }));
    setExercises(initialExercises);
  }, [day]);

  useEffect(() => {
    let interval: any;
    if (isRunning) {
      interval = setInterval(() => setTimer(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const updateSet = (exIdx: number, setIdx: number, field: 'weight' | 'reps', value: number) => {
    const updated = [...exercises];
    updated[exIdx].sets[setIdx][field] = value;
    setExercises(updated);
  };

  const toggleSetComplete = (exIdx: number, setIdx: number) => {
    const updated = [...exercises];
    updated[exIdx].sets[setIdx].completed = !updated[exIdx].sets[setIdx].completed;
    setExercises(updated);
  };

  const handleFinish = async () => {
    const workoutData = {
      date: new Date(),
      weekNumber,
      day: day.day,
      exercises,
      duration: timer
    };
    
    const history = JSON.parse(localStorage.getItem('programHistory') || '[]');
    history.push(workoutData);
    localStorage.setItem('programHistory', JSON.stringify(history));

    const activeProgram = JSON.parse(localStorage.getItem('activeProgram') || '{}');
    localStorage.setItem('activeProgram', JSON.stringify({ ...activeProgram, lastWorkout: new Date() }));

    const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
    const userId = Number(user?.id || 0);

    if (userId > 0) {
      try {
        const saves: Promise<any>[] = [];

        exercises.forEach((exercise: any) => {
          const exerciseName = String(exercise?.name || exercise?.exerciseName || '').trim();
          if (!exerciseName) return;

          const setsList = Array.isArray(exercise?.sets) ? exercise.sets : [];
          setsList.forEach((set: any, idx: number) => {
            if (!set?.completed) return;
            saves.push(
              api.saveWorkoutSet({
                userId,
                exerciseName,
                setNumber: idx + 1,
                reps: Number(set?.reps || 0),
                weight: Number(set?.weight || 0),
                completed: true,
              }),
            );
          });
        });

        if (saves.length) {
          await Promise.allSettled(saves);
          window.dispatchEvent(new CustomEvent('gamification-updated'));
          localStorage.setItem('recoveryNeedsUpdate', 'true');
          window.dispatchEvent(new CustomEvent('recovery-updated'));
        }
      } catch (error) {
        console.error('Failed to persist program workout sets:', error);
      }
    }

    onComplete();
  };

  const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  const completedSets = exercises.reduce((sum, ex) => sum + ex.sets.filter((s: any) => s.completed).length, 0);

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white pb-20">
      <div className="p-4">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 mb-6">
          <ArrowLeft size={20} />
          <span>Back</span>
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1">{day.day}</h1>
          <p className="text-gray-400">{day.focus} • Week {weekNumber}</p>
        </div>

        <div className="bg-[#242424] rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Timer size={20} className="text-emerald-600" />
              <span className="text-2xl font-bold">{formatTime(timer)}</span>
            </div>
            <button
              onClick={() => setIsRunning(!isRunning)}
              className={`px-4 py-2 rounded-lg ${isRunning ? 'bg-red-500' : 'bg-[#10b981] text-black'}`}
            >
              {isRunning ? 'Pause' : 'Start'}
            </button>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <TrendingUp size={16} />
            <span>{completedSets}/{totalSets} sets completed</span>
          </div>
        </div>

        <div className="space-y-6">
          {exercises.map((exercise, exIdx) => (
            <div key={exIdx} className="bg-[#242424] rounded-lg p-4">
              <h3 className="font-semibold mb-2">{stripExercisePrefix(exercise.name)}</h3>
              <p className="text-sm text-gray-400 mb-3">
                Target: {exercise.reps} reps • {exercise.rest} rest
                {exercise.tempo && ` • Tempo: ${exercise.tempo}`}
              </p>
              {exercise.notes && (
                <p className="text-xs text-emerald-600 mb-3">{exercise.notes}</p>
              )}

              <div className="space-y-2">
                {exercise.sets.map((set: ExerciseSet, setIdx: number) => (
                  <div key={setIdx} className="flex items-center gap-2">
                    <span className="text-sm text-gray-400 w-8">#{setIdx + 1}</span>
                    <input
                      type="number"
                      placeholder="Weight"
                      value={set.weight || ''}
                      onChange={(e) => updateSet(exIdx, setIdx, 'weight', Number(e.target.value))}
                      className="flex-1 bg-[#1A1A1A] rounded px-3 py-2 text-sm"
                    />
                    <span className="text-gray-400">×</span>
                    <input
                      type="number"
                      placeholder="Reps"
                      value={set.reps || ''}
                      onChange={(e) => updateSet(exIdx, setIdx, 'reps', Number(e.target.value))}
                      className="flex-1 bg-[#1A1A1A] rounded px-3 py-2 text-sm"
                    />
                    <button
                      onClick={() => toggleSetComplete(exIdx, setIdx)}
                      className={`p-2 rounded ${set.completed ? 'bg-[#10b981] text-black' : 'bg-[#1A1A1A]'}`}
                    >
                      <Check size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleFinish}
          disabled={completedSets === 0}
          className="w-full bg-[#10b981] text-black py-4 rounded-lg font-semibold mt-6 disabled:opacity-50"
        >
          Finish Workout
        </button>
      </div>
    </div>
  );
};

