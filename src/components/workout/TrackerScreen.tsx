import React, { useState, useEffect } from 'react';
import { Header } from '../ui/Header';
import { Timer, BarChart3, Video } from 'lucide-react';
import { api } from '../../services/api';

interface TrackerScreenProps {
  onBack: () => void;
  exerciseName: string;
  plannedSets?: number;
  onVideoClick?: () => void;
  savedSets?: SetData[];
  onSaveSets?: (sets: SetData[]) => void;
}

interface SetData {
  set: number;
  reps: number;
  weight: number;
  completed: boolean;
  duration?: number;
  restTime?: number;
}

const DEFAULT_SET_TEMPLATE: Array<{ reps: number; weight: number }> = [
  { reps: 11, weight: 70 },
  { reps: 10, weight: 75 },
  { reps: 8, weight: 80 },
  { reps: 8, weight: 80 },
];

const createInitialSets = (plannedSets?: number): SetData[] => {
  const requested = Number(plannedSets);
  const setCount = Number.isFinite(requested) && requested > 0
    ? Math.max(1, Math.round(requested))
    : DEFAULT_SET_TEMPLATE.length;

  return Array.from({ length: setCount }, (_, index) => {
    const template = DEFAULT_SET_TEMPLATE[index] || DEFAULT_SET_TEMPLATE[DEFAULT_SET_TEMPLATE.length - 1];
    return {
      set: index + 1,
      reps: template.reps,
      weight: template.weight,
      completed: false,
    };
  });
};

export function TrackerScreen({
  onBack,
  exerciseName,
  plannedSets,
  onVideoClick,
  savedSets,
  onSaveSets,
}: TrackerScreenProps) {
  const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
  const [sets, setSets] = useState<SetData[]>(() => {
    if (savedSets && savedSets.length > 0) return savedSets;
    return createInitialSets(plannedSets);
  });
  const unit: 'kg' | 'lbs' = 'kg';
  const [isRunning, setIsRunning] = useState(false);
  const [time, setTime] = useState(0);
  const [swipedIndex, setSwipedIndex] = useState<number | null>(null);
  const [setStartTime, setSetStartTime] = useState(0);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [isResting, setIsResting] = useState(false);
  const [restTime, setRestTime] = useState(0);

  useEffect(() => {
    if (savedSets && savedSets.length > 0) {
      setSets(savedSets);
      return;
    }
    setSets(createInitialSets(plannedSets));
  }, [exerciseName, plannedSets, savedSets]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning) {
      interval = setInterval(() => {
        setTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isResting) {
      interval = setInterval(() => {
        setRestTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isResting]);

  const persistSets = (nextSets: SetData[]) => {
    setSets(nextSets);
    onSaveSets?.(nextSets);
  };

  const toggleTimer = async () => {
    if (isRunning) {
      const firstIncomplete = sets.findIndex(s => !s.completed);
      if (firstIncomplete !== -1) {
        const newSets = [...sets];
        const setDuration = Math.max(0, time - setStartTime);
        newSets[firstIncomplete].completed = true;
        newSets[firstIncomplete].duration = setDuration;
        newSets[firstIncomplete].restTime = restTime;
        persistSets(newSets);
        
        // Save to database
        if (user?.id) {
          try {
            await api.saveWorkoutSet({
              userId: user.id,
              exerciseName,
              setNumber: newSets[firstIncomplete].set,
              reps: newSets[firstIncomplete].reps,
              weight: newSets[firstIncomplete].weight,
              duration: setDuration,
              restTime: restTime
            });
          } catch (error) {
            console.error('Failed to save workout set:', error);
          }
        }

        // Start rest timer
        setRestTime(0);
        setIsResting(true);
      }
    } else {
      // Stop rest timer and start set timer
      setIsResting(false);
      setSetStartTime(time);
    }
    setIsRunning(!isRunning);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const updateSet = (index: number, field: 'reps' | 'weight', value: number) => {
    const newSets = [...sets];
    newSets[index][field] = value;
    persistSets(newSets);
  };

  const removeSet = (index: number) => {
    const updated = sets.filter((_, i) => i !== index).map((s, i) => ({ ...s, set: i + 1 }));
    persistSets(updated);
    setSwipedIndex(null);
  };

  const handleTouchStart = (index: number, e: React.TouchEvent) => {
    const touch = e.touches[0];
    (e.currentTarget as any).startX = touch.clientX;
  };

  const handleTouchMove = (index: number, e: React.TouchEvent) => {
    const touch = e.touches[0];
    const startX = (e.currentTarget as any).startX;
    const diff = startX - touch.clientX;
    if (diff > 50) {
      setSwipedIndex(index);
    } else if (diff < -20) {
      setSwipedIndex(null);
    }
  };

  const getTotalWorkTime = () => sets.filter(s => s.completed).reduce((acc, set) => acc + (set.duration || 0), 0);
  const getTotalRestTime = () => sets.filter(s => s.completed).reduce((acc, set) => acc + (set.restTime || 0), 0);
  const getTotalVolume = () => sets.filter(s => s.completed).reduce((acc, set) => acc + (set.reps * set.weight), 0);
  const getCompletedSets = () => sets.filter(s => s.completed).length;

  return (
    <div className="flex-1 flex flex-col h-full bg-background pb-24">
      <div className="px-6 pt-2">
        <Header title="The Tracker" onBack={onBack} />
      </div>

      <div className="px-6 mt-6">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">{exerciseName}</h2>

        {showAnalytics ? (
          <div className="space-y-4 mb-8">
            <button onClick={() => setShowAnalytics(false)} className="text-accent text-sm mb-4">
              ← Back to Tracker
            </button>
            <div className="bg-card rounded-xl p-6 border border-white/5">
              <h3 className="text-lg font-bold text-white mb-4">Workout Analytics</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Total Work Time</span>
                  <span className="text-white font-semibold">{formatTime(getTotalWorkTime())}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Total Rest Time</span>
                  <span className="text-white font-semibold">{formatTime(getTotalRestTime())}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Total Volume</span>
                  <span className="text-white font-semibold">{getTotalVolume()} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Sets Completed</span>
                  <span className="text-white font-semibold">{getCompletedSets()} / {sets.length}</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Set Details</h4>
              {sets.filter(s => s.completed).map((set) => (
                <div key={set.set} className="bg-card rounded-xl p-4 border border-white/5">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-white font-semibold">Set {set.set}</span>
                    <span className="text-text-secondary text-sm">{set.reps} reps × {set.weight} {unit}</span>
                  </div>
                  <div className="flex gap-4 text-xs text-text-secondary">
                    <span>Work: {formatTime(set.duration || 0)}</span>
                    {set.restTime && <span>Rest: {formatTime(set.restTime)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-around mb-8">
              <button onClick={toggleTimer} className="flex flex-col items-center gap-2">
                <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center ${
                  isRunning ? 'border-red-500 bg-red-500/10' : 'border-white/20'
                }`}>
                  <Timer size={20} className={isRunning ? 'text-red-500' : 'text-white'} />
                </div>
                <span className="text-xs text-text-secondary">{formatTime(time)}</span>
              </button>
              <button onClick={onVideoClick} className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full border-2 border-white/20 flex items-center justify-center">
                  <Video size={20} className="text-white" />
                </div>
                <span className="text-xs text-text-secondary">Video</span>
              </button>
              <button onClick={() => setShowAnalytics(true)} className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full border-2 border-white/20 flex items-center justify-center">
                  <BarChart3 size={20} className="text-white" />
                </div>
                <span className="text-xs text-text-secondary">Analytics</span>
              </button>

            </div>

            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-4">
              Effective sets
            </h3>

            <div className="grid grid-cols-[60px_60px_80px_1fr] gap-3 mb-3 px-2">
              <span className="text-xs text-text-secondary uppercase">Set</span>
              <span className="text-xs text-text-secondary uppercase">Reps</span>
              <span className="text-xs text-text-secondary uppercase">Weight</span>
              <span></span>
            </div>

            <div className="space-y-3">
              {sets.map((set, index) => (
                <div
                  key={index}
                  className="relative overflow-hidden"
                  onTouchStart={(e) => handleTouchStart(index, e)}
                  onTouchMove={(e) => handleTouchMove(index, e)}>
                  {swipedIndex === index && (
                    <button
                      onClick={() => removeSet(index)}
                      className="absolute right-0 top-0 bottom-0 w-20 bg-red-500 flex items-center justify-center text-white font-bold rounded-r-lg z-10">
                      Delete
                    </button>
                  )}
                  <div className={`grid grid-cols-[60px_60px_80px_1fr] gap-3 items-center transition-transform ${
                    swipedIndex === index ? '-translate-x-20' : ''
                  } ${set.completed ? 'opacity-50' : ''}`}>
                    <div className={`rounded-full px-4 py-2 text-center ${
                      set.completed ? 'bg-green-500/20 border border-green-500' : 'bg-card'
                    }`}>
                      <span className={`font-semibold ${
                        set.completed ? 'text-green-500' : 'text-white'
                      }`}>{set.set}</span>
                    </div>
                    <input
                      type="number"
                      value={set.reps}
                      onChange={(e) => updateSet(index, 'reps', parseInt(e.target.value) || 0)}
                      className="bg-card rounded-full px-4 py-2 text-center text-white font-semibold border border-white/5 focus:border-accent outline-none"
                    />
                    <input
                      type="number"
                      value={set.weight}
                      onChange={(e) => updateSet(index, 'weight', parseInt(e.target.value) || 0)}
                      className="bg-card rounded-full px-4 py-2 text-center text-white font-semibold border border-white/5 focus:border-accent outline-none"
                    />
                    <div className="relative h-8">
                      <input
                        type="range"
                        min="0"
                        max="200"
                        value={set.weight}
                        onChange={(e) => updateSet(index, 'weight', parseInt(e.target.value))}
                        className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, #ef4444 0%, #ef4444 ${(set.weight / 200) * 100}%, rgba(255,255,255,0.1) ${(set.weight / 200) * 100}%, rgba(255,255,255,0.1) 100%)`
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => persistSets([...sets, { set: sets.length + 1, reps: 8, weight: 80, completed: false }])}
              className="w-full mt-6 py-3 bg-accent text-black font-bold rounded-full hover:bg-accent/90 transition-colors">
              Add Set
            </button>
          </>
        )}
      </div>

      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          width: 6px;
          height: 24px;
          border-radius: 2px;
          background: linear-gradient(to right, #555, #888, #555);
          cursor: pointer;
          border: 1px solid #666;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        input[type="range"]::-moz-range-thumb {
          width: 6px;
          height: 24px;
          border-radius: 2px;
          background: linear-gradient(to right, #555, #888, #555);
          cursor: pointer;
          border: 1px solid #666;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
      `}</style>
    </div>
  );
}
